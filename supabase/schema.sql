-- ====================================================================
-- HARIT JAL™ (हरित जल) — AUTHORITATIVE SUPABASE CLI SCHEMA REFERENCE
-- Synchronized Byte-for-Byte with Root Schema (`supabase-schema.sql`)
-- and Consolidated Migration (`CONSOLIDATED_MIGRATION.sql`, Phase 1H.6).
-- Security Status: Non-Recursive RLS via SECURITY DEFINER Helpers
-- Zero Open Anon Policies | Service-Role Edge State & Permission-Gated RLS
-- ====================================================================

BEGIN;

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop protection triggers cleanly if re-applying
DROP TRIGGER IF EXISTS trg_protect_root_super_admin ON public.staff_users;
DROP TRIGGER IF EXISTS trg_protect_customer_profile_columns ON public.customers;
DROP TRIGGER IF EXISTS trg_sanitize_consultation_insert_claims ON public.consultations;

-- --------------------------------------------------------------------
-- 2. TABLE: STAFF_USERS (Super Admin & Operations Staff Members)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    designation TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'staff',
    permissions JSONB DEFAULT '["leads", "orders"]'::jsonb,
    is_blocked BOOLEAN DEFAULT false,
    totp_enabled BOOLEAN DEFAULT false,
    is_first_login BOOLEAN DEFAULT true,
    is_root_super_admin BOOLEAN NOT NULL DEFAULT false,
    email_phone_changes_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS is_root_super_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.staff_users DROP COLUMN IF EXISTS password;
ALTER TABLE public.staff_users DROP COLUMN IF EXISTS temporary_password;
ALTER TABLE public.staff_users DROP COLUMN IF EXISTS temporary_password_hash;
ALTER TABLE public.staff_users DROP COLUMN IF EXISTS temporary_password_expires_at;
ALTER TABLE public.staff_users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.staff_users DROP COLUMN IF EXISTS totp_secret;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_single_root_super_admin
    ON public.staff_users (is_root_super_admin)
    WHERE is_root_super_admin = TRUE;

-- --------------------------------------------------------------------
-- 2.1 TABLE: STAFF_SECRETS (Isolated Server-Only Cryptographic Credentials)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_secrets (
    user_id TEXT PRIMARY KEY REFERENCES public.staff_users(id) ON DELETE CASCADE,
    password_hash TEXT,
    temporary_password_hash TEXT,
    temporary_password_expires_at TIMESTAMPTZ,
    totp_secret TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 2.2 TABLE: STAFF_AUDIT_LOGS (Immutable Administrative Audit Trail)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    action TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    target_user_email TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_audit_action ON public.staff_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_staff_audit_created_at ON public.staff_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_email ON public.staff_users(email);
CREATE INDEX IF NOT EXISTS idx_staff_phone ON public.staff_users(phone);
CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff_users(role);

-- --------------------------------------------------------------------
-- 3. TABLE: CUSTOMERS (Restaurant & Dhaba Partner Accounts)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_name TEXT NOT NULL DEFAULT 'Restaurant Partner',
    owner_name TEXT NOT NULL DEFAULT '',
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    dpdp_consent BOOLEAN DEFAULT true,
    email_phone_changes_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.customers DROP COLUMN IF EXISTS password;
ALTER TABLE public.customers DROP COLUMN IF EXISTS password_hash;

CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers(created_at DESC);

-- --------------------------------------------------------------------
-- 3.1 TRIGGER: Automatic Sync from auth.users to public.customers
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_role TEXT := LOWER(COALESCE(NEW.raw_app_meta_data->>'role', 'customer'));
BEGIN
    IF (v_role <> 'customer' AND v_role <> '')
       OR EXISTS (SELECT 1 FROM public.staff_users WHERE LOWER(email) = LOWER(NEW.email)) THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.customers (
        id,
        email,
        restaurant_name,
        owner_name,
        phone,
        city,
        dpdp_consent,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        LOWER(NEW.email),
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'restaurant_name'), ''), 'Restaurant Partner'),
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'owner_name'), ''), split_part(LOWER(NEW.email), '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'city', ''),
        COALESCE((NEW.raw_user_meta_data->>'dpdp_consent')::boolean, true),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        restaurant_name = COALESCE(NULLIF(EXCLUDED.restaurant_name, ''), public.customers.restaurant_name),
        owner_name = COALESCE(NULLIF(EXCLUDED.owner_name, ''), public.customers.owner_name),
        phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.customers.phone),
        city = COALESCE(NULLIF(EXCLUDED.city, ''), public.customers.city),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;
CREATE TRIGGER on_auth_user_created_customer
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

CREATE OR REPLACE FUNCTION public.handle_customer_email_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_role TEXT := LOWER(COALESCE(NEW.raw_app_meta_data->>'role', 'customer'));
    v_old_email TEXT := LOWER(COALESCE(OLD.email, ''));
    v_new_email TEXT := LOWER(COALESCE(NEW.email, ''));
BEGIN
    IF v_new_email = '' OR v_old_email = v_new_email THEN
        RETURN NEW;
    END IF;

    IF (v_role <> 'customer' AND v_role <> '')
       OR EXISTS (SELECT 1 FROM public.staff_users WHERE id = NEW.id::text) THEN
        RETURN NEW;
    END IF;

    PERFORM set_config('app.internal_customer_email_sync', 'on', true);

    UPDATE public.customers
    SET email = v_new_email,
        email_phone_changes_count = LEAST(5, COALESCE(email_phone_changes_count, 0) + 1),
        updated_at = NOW()
    WHERE id = NEW.id;

    IF v_old_email <> '' THEN
        UPDATE public.orders
        SET owner_email = v_new_email
        WHERE LOWER(owner_email) = v_old_email;

        UPDATE public.consultations
        SET email = v_new_email
        WHERE LOWER(email) = v_old_email;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated_customer ON auth.users;
CREATE TRIGGER on_auth_user_email_updated_customer
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW
    WHEN (OLD.email IS DISTINCT FROM NEW.email)
    EXECUTE FUNCTION public.handle_customer_email_sync();

-- --------------------------------------------------------------------
-- 3.2 CUSTOMER PROFILE COLUMN INTEGRITY & CONTACT QUOTA (HIGH-H5-03)
-- --------------------------------------------------------------------
REVOKE UPDATE ON public.customers FROM anon, authenticated;
GRANT UPDATE (restaurant_name, owner_name, phone, city, updated_at) ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

CREATE OR REPLACE FUNCTION public.protect_customer_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_internal_sync TEXT := current_setting('app.internal_customer_email_sync', true);
    v_role TEXT := COALESCE(NULLIF(current_setting('role', true), ''), current_user);
    v_old_phone TEXT := REGEXP_REPLACE(COALESCE(OLD.phone, ''), '\D', '', 'g');
    v_new_phone TEXT := REGEXP_REPLACE(COALESCE(NEW.phone, ''), '\D', '', 'g');
    v_next_count INT := COALESCE(OLD.email_phone_changes_count, 0);
BEGIN
    IF v_role IN ('service_role', 'postgres', 'supabase_admin')
       OR v_internal_sync = 'on'
       OR public.is_caller_active_staff() THEN
        IF NEW.email IS NOT NULL THEN
            NEW.email := LOWER(TRIM(NEW.email));
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR LOWER(COALESCE(NEW.email, '')) IS DISTINCT FROM LOWER(COALESCE(OLD.email, ''))
       OR NEW.dpdp_consent IS DISTINCT FROM OLD.dpdp_consent
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.email_phone_changes_count IS DISTINCT FROM OLD.email_phone_changes_count THEN
        RAISE EXCEPTION 'Security Violation: Restricted customer profile columns cannot be modified directly.';
    END IF;

    IF v_new_phone IS DISTINCT FROM v_old_phone THEN
        IF COALESCE(OLD.email_phone_changes_count, 0) >= 5 THEN
            RAISE EXCEPTION 'Lifetime contact modification limit reached (5 maximum).';
        END IF;
        v_next_count := COALESCE(OLD.email_phone_changes_count, 0) + 1;
    END IF;

    NEW.email := OLD.email;
    NEW.dpdp_consent := OLD.dpdp_consent;
    NEW.created_at := OLD.created_at;
    NEW.email_phone_changes_count := v_next_count;
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_customer_profile_columns ON public.customers;
CREATE TRIGGER trg_protect_customer_profile_columns
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_customer_profile_columns();

-- --------------------------------------------------------------------
-- 4. TABLE: CONSULTATIONS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consultations (
    id TEXT PRIMARY KEY,
    restaurant_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    city TEXT NOT NULL,
    preferred_time TEXT NOT NULL,
    bottle_types TEXT[] DEFAULT '{}',
    notes TEXT,
    status TEXT DEFAULT 'New',
    assigned_staff_id TEXT REFERENCES public.staff_users(id) ON DELETE SET NULL,
    confirmation_email_sent_at TIMESTAMPTZ,
    admin_alert_sent_at TIMESTAMPTZ,
    crm_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS assigned_staff_id TEXT;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS admin_alert_sent_at TIMESTAMPTZ;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS crm_synced_at TIMESTAMPTZ;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'consultations_assigned_staff_id_fkey'
          AND conrelid = 'public.consultations'::regclass
    ) THEN
        ALTER TABLE public.consultations
            ADD CONSTRAINT consultations_assigned_staff_id_fkey
            FOREIGN KEY (assigned_staff_id) REFERENCES public.staff_users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_consultations_status ON public.consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON public.consultations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_email ON public.consultations(email);

CREATE OR REPLACE FUNCTION public.sanitize_consultation_insert_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_role TEXT := COALESCE(NULLIF(current_setting('role', true), ''), current_user);
BEGIN
    IF v_role NOT IN ('service_role', 'postgres', 'supabase_admin')
       AND NOT public.is_caller_active_staff() THEN
        NEW.confirmation_email_sent_at := NULL;
        NEW.admin_alert_sent_at := NULL;
        NEW.crm_synced_at := NULL;
        NEW.assigned_staff_id := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_consultation_insert_claims ON public.consultations;
CREATE TRIGGER trg_sanitize_consultation_insert_claims
    BEFORE INSERT ON public.consultations
    FOR EACH ROW
    EXECUTE FUNCTION public.sanitize_consultation_insert_claims();

-- --------------------------------------------------------------------
-- 5. TABLE: ORDERS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    restaurant_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    phone TEXT NOT NULL,
    bottle_type TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    custom_engraving TEXT,
    status TEXT DEFAULT 'Pending',
    assigned_staff_id TEXT REFERENCES public.staff_users(id) ON DELETE SET NULL,
    ordered_at TIMESTAMPTZ DEFAULT NOW(),
    expected_delivery TEXT,
    driver_name TEXT,
    driver_phone TEXT
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_staff_id TEXT;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'orders_assigned_staff_id_fkey'
          AND conrelid = 'public.orders'::regclass
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_assigned_staff_id_fkey
            FOREIGN KEY (assigned_staff_id) REFERENCES public.staff_users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_owner_email ON public.orders(owner_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_ordered_at ON public.orders(ordered_at DESC);

-- --------------------------------------------------------------------
-- 6. TABLE: SECURITY_BLOCKS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_blocks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    target_key TEXT UNIQUE NOT NULL,
    target_type TEXT NOT NULL,
    identifier TEXT NOT NULL,
    reason TEXT NOT NULL,
    source_vector TEXT NOT NULL DEFAULT 'password',
    blocked_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.security_blocks ADD COLUMN IF NOT EXISTS source_vector TEXT NOT NULL DEFAULT 'password';

CREATE INDEX IF NOT EXISTS idx_security_blocks_target_key ON public.security_blocks(target_key);
CREATE INDEX IF NOT EXISTS idx_security_blocks_blocked_until ON public.security_blocks(blocked_until);

-- --------------------------------------------------------------------
-- 7. TABLE: EMAIL_LOGS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    template_type TEXT NOT NULL DEFAULT 'transactional',
    status TEXT NOT NULL DEFAULT 'Dispatched',
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS template_type TEXT NOT NULL DEFAULT 'transactional';
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at DESC);

-- --------------------------------------------------------------------
-- 7.1 TABLE: OTP_CHALLENGES (Service-Role Only Distributed Single-Use OTPs)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_challenges (
    jti TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    purpose TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    attempts INT NOT NULL DEFAULT 0,
    resend_available_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_email_purpose
    ON public.otp_challenges(email, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_expires_at
    ON public.otp_challenges(expires_at);

-- --------------------------------------------------------------------
-- 7.2 TABLE: EDGE_RATE_LIMITS (Service-Role Only Rate Limit & AI Quota)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
    bucket_key TEXT PRIMARY KEY,
    request_count INT NOT NULL DEFAULT 0,
    window_expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_expiry
    ON public.edge_rate_limits(window_expires_at);

-- --------------------------------------------------------------------
-- 7.3 NON-RECURSIVE SECURITY DEFINER HELPERS & CONTROLLED RPCS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_caller_active_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT
        auth.uid() IS NOT NULL
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND (
            (auth.jwt()->'app_metadata'->>'is_first_login')::boolean IS NOT TRUE
            OR ((auth.jwt()->'app_metadata'->>'temporary_password_expires_at')::bigint > (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint)
        )
        AND ((auth.jwt()->'app_metadata'->>'role') IN (
            'super_admin', 'Super Admin', 'admin', 'staff', 'Staff',
            'sales_manager', 'Sales Manager', 'operations_lead', 'Operations Lead',
            'label_designer', 'Label Designer'
        ))
        AND EXISTS (
            SELECT 1 FROM public.staff_users
            WHERE staff_users.id = auth.uid()::text
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.staff_users
            WHERE staff_users.id = auth.uid()::text
              AND staff_users.is_blocked = TRUE
        );
$$;

REVOKE ALL ON FUNCTION public.is_caller_active_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_caller_active_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT
        public.is_caller_active_staff()
        AND EXISTS (
            SELECT 1
            FROM public.staff_users su
            WHERE su.id = auth.uid()::text
              AND su.is_blocked IS NOT TRUE
              AND (
                  LOWER(REPLACE(COALESCE(su.role, ''), ' ', '_')) = 'super_admin'
                  OR su.is_root_super_admin = TRUE
                  OR COALESCE(su.permissions, '[]'::jsonb) @> '["all"]'::jsonb
                  OR COALESCE(su.permissions, '[]'::jsonb) @> to_jsonb(ARRAY[LOWER(TRIM(COALESCE(p_permission, '')))])
              )
        );
$$;

REVOKE ALL ON FUNCTION public.staff_has_permission(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_has_permission(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_security_block(
    p_target_key TEXT,
    p_target_type TEXT,
    p_identifier TEXT,
    p_reason TEXT,
    p_source_vector TEXT DEFAULT 'password',
    p_blocked_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_clean_key TEXT := LEFT(TRIM(COALESCE(p_target_key, '')), 320);
    v_clean_type TEXT := LOWER(TRIM(COALESCE(p_target_type, '')));
    v_clean_identifier TEXT := LEFT(TRIM(COALESCE(p_identifier, '')), 320);
    v_clean_reason TEXT := LEFT(TRIM(COALESCE(p_reason, 'Security lockout active.')), 500);
    v_clean_vector TEXT := LOWER(TRIM(COALESCE(p_source_vector, 'password')));
    v_until TIMESTAMPTZ := COALESCE(p_blocked_until, NOW() + INTERVAL '24 hours');
BEGIN
    IF v_clean_key = '' OR v_clean_identifier = '' THEN
        RETURN FALSE;
    END IF;

    IF v_clean_type NOT IN ('id', 'device', 'ip') THEN
        RETURN FALSE;
    END IF;

    IF v_clean_key NOT LIKE (v_clean_type || ':%') THEN
        RETURN FALSE;
    END IF;

    IF v_clean_vector NOT IN ('password', 'otp') THEN
        v_clean_vector := 'password';
    END IF;

    IF v_until < NOW() + INTERVAL '1 minute' THEN
        v_until := NOW() + INTERVAL '1 minute';
    ELSIF v_until > NOW() + INTERVAL '25 hours' THEN
        v_until := NOW() + INTERVAL '25 hours';
    END IF;

    INSERT INTO public.security_blocks (
        target_key,
        target_type,
        identifier,
        source_vector,
        blocked_until,
        reason
    )
    VALUES (
        v_clean_key,
        v_clean_type,
        v_clean_identifier,
        v_clean_vector,
        v_until,
        v_clean_reason
    )
    ON CONFLICT (target_key) DO UPDATE SET
        target_type = EXCLUDED.target_type,
        identifier = EXCLUDED.identifier,
        source_vector = EXCLUDED.source_vector,
        blocked_until = GREATEST(public.security_blocks.blocked_until, EXCLUDED.blocked_until),
        reason = EXCLUDED.reason;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.record_security_block(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_security_block(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.check_security_block(
    p_target_keys TEXT[]
)
RETURNS TABLE (
    target_key TEXT,
    target_type TEXT,
    blocked_until TIMESTAMPTZ,
    reason TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT
        sb.target_key,
        sb.target_type,
        sb.blocked_until,
        sb.reason
    FROM public.security_blocks sb
    WHERE sb.blocked_until > NOW()
      AND sb.target_key = ANY(COALESCE(p_target_keys[1:5], ARRAY[]::TEXT[]));
$$;

REVOKE ALL ON FUNCTION public.check_security_block(TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_security_block(TEXT[]) TO service_role;

CREATE OR REPLACE FUNCTION public.append_email_audit_log(
    p_recipient TEXT,
    p_subject TEXT,
    p_body TEXT DEFAULT '',
    p_template_type TEXT DEFAULT 'transactional',
    p_status TEXT DEFAULT 'Dispatched'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_recipient TEXT := LOWER(LEFT(TRIM(COALESCE(p_recipient, '')), 320));
    v_subject TEXT := LEFT(TRIM(COALESCE(p_subject, '')), 500);
    v_body TEXT := LEFT(COALESCE(p_body, ''), 4000);
    v_template TEXT := LOWER(TRIM(COALESCE(p_template_type, 'transactional')));
    v_status TEXT := TRIM(COALESCE(p_status, 'Dispatched'));
BEGIN
    IF v_recipient = '' OR POSITION('@' IN v_recipient) = 0 OR v_subject = '' THEN
        RETURN FALSE;
    END IF;

    IF v_template NOT IN ('admin_lead_alert', 'client_confirmation', 'otp_verification', 'transactional', 'password_reset') THEN
        v_template := 'transactional';
    END IF;

    IF v_status NOT IN ('Dispatched', 'Simulated', 'Failed', 'Blocked') THEN
        v_status := 'Dispatched';
    END IF;

    v_body := regexp_replace(
        v_body,
        '((?:otp|verification\s*code|passcode|auth\s*code)\s*[:#-]*\s*)[0-9]{6}',
        '\1[REDACTED]',
        'gi'
    );

    INSERT INTO public.email_logs (
        recipient,
        subject,
        body,
        template_type,
        status,
        sent_at
    )
    VALUES (
        v_recipient,
        v_subject,
        v_body,
        v_template,
        v_status,
        NOW()
    );

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.append_email_audit_log(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_email_audit_log(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.db_health_ping()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT true;
$$;

REVOKE ALL ON FUNCTION public.db_health_ping() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.db_health_ping() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
    p_bucket_key TEXT,
    p_max_requests INT,
    p_window_seconds INT
)
RETURNS TABLE (
    allowed BOOLEAN,
    current_count INT,
    retry_after_seconds INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_key TEXT := LEFT(TRIM(COALESCE(p_bucket_key, '')), 320);
    v_max INT := GREATEST(1, COALESCE(p_max_requests, 1));
    v_window INT := GREATEST(1, COALESCE(p_window_seconds, 60));
    v_now TIMESTAMPTZ := NOW();
    v_count INT;
    v_expires TIMESTAMPTZ;
BEGIN
    IF v_key = '' THEN
        RETURN QUERY SELECT false, 0, v_window;
        RETURN;
    END IF;

    INSERT INTO public.edge_rate_limits AS rl (
        bucket_key,
        request_count,
        window_expires_at,
        updated_at
    )
    VALUES (
        v_key,
        1,
        v_now + make_interval(secs => v_window),
        v_now
    )
    ON CONFLICT (bucket_key) DO UPDATE SET
        request_count = CASE
            WHEN rl.window_expires_at <= v_now THEN 1
            ELSE rl.request_count + 1
        END,
        window_expires_at = CASE
            WHEN rl.window_expires_at <= v_now THEN v_now + make_interval(secs => v_window)
            ELSE rl.window_expires_at
        END,
        updated_at = v_now
    RETURNING rl.request_count, rl.window_expires_at
    INTO v_count, v_expires;

    RETURN QUERY SELECT
        (v_count <= v_max),
        v_count,
        CASE
            WHEN v_count <= v_max THEN 0
            ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_expires - v_now)))::INT)
        END;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(TEXT, INT, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.verify_otp_challenge_attempt(
    p_jti TEXT,
    p_email TEXT,
    p_purpose TEXT,
    p_otp_hash TEXT,
    p_device_id TEXT DEFAULT '',
    p_client_ip TEXT DEFAULT ''
)
RETURNS TABLE (
    outcome TEXT,
    attempts_remaining INT,
    blocked_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_jti TEXT := LEFT(TRIM(COALESCE(p_jti, '')), 128);
    v_email TEXT := LOWER(LEFT(TRIM(COALESCE(p_email, '')), 320));
    v_purpose TEXT := LOWER(LEFT(TRIM(COALESCE(p_purpose, '')), 64));
    v_otp_hash TEXT := LOWER(LEFT(TRIM(COALESCE(p_otp_hash, '')), 128));
    v_device TEXT := LEFT(TRIM(COALESCE(p_device_id, '')), 160);
    v_ip TEXT := LEFT(TRIM(COALESCE(p_client_ip, '')), 120);
    v_now TIMESTAMPTZ := NOW();
    v_block_until TIMESTAMPTZ;
    v_row public.otp_challenges%ROWTYPE;
    v_latest_jti TEXT;
    v_new_attempts INT := 0;
    v_max_strike INT := 0;
    v_strike_cnt INT := 0;
    v_lock_until TIMESTAMPTZ;
    v_k TEXT;
    v_strike_keys TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF v_jti = '' OR v_email = '' OR v_purpose = '' OR v_otp_hash = '' THEN
        RETURN QUERY SELECT 'not_found'::TEXT, 0, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    IF v_email <> '' THEN
        v_strike_keys := array_append(v_strike_keys, 'id:' || v_email);
    END IF;
    IF v_device <> '' THEN
        v_strike_keys := array_append(v_strike_keys, 'device:' || v_device);
    END IF;
    IF v_ip <> '' AND v_ip <> 'unknown' THEN
        v_strike_keys := array_append(v_strike_keys, 'ip:' || v_ip);
    END IF;

    SELECT sb.blocked_until INTO v_block_until
    FROM public.security_blocks sb
    WHERE sb.target_key = ANY(v_strike_keys)
      AND sb.blocked_until > v_now
    ORDER BY sb.blocked_until DESC
    LIMIT 1;

    IF v_block_until IS NOT NULL THEN
        RETURN QUERY SELECT 'blocked'::TEXT, 0, v_block_until;
        RETURN;
    END IF;

    SELECT * INTO v_row
    FROM public.otp_challenges oc
    WHERE oc.jti = v_jti
    FOR UPDATE;

    IF NOT FOUND OR LOWER(v_row.email) <> v_email OR v_row.purpose <> v_purpose THEN
        RETURN QUERY SELECT 'not_found'::TEXT, 0, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    SELECT oc.jti INTO v_latest_jti
    FROM public.otp_challenges oc
    WHERE LOWER(oc.email) = v_email
      AND oc.purpose = v_purpose
    ORDER BY oc.created_at DESC
    LIMIT 1;

    IF v_latest_jti IS NOT NULL AND v_latest_jti <> v_jti THEN
        RETURN QUERY SELECT 'superseded'::TEXT, 0, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    IF v_row.used IS TRUE THEN
        RETURN QUERY SELECT 'already_used'::TEXT, 0, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    IF v_now > v_row.expires_at THEN
        UPDATE public.otp_challenges
        SET used = true,
            used_at = v_now
        WHERE jti = v_jti;
        RETURN QUERY SELECT 'expired'::TEXT, 0, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    IF LOWER(v_row.otp_hash) = v_otp_hash THEN
        UPDATE public.otp_challenges
        SET used = true,
            used_at = v_now
        WHERE jti = v_jti
          AND used = false;

        FOREACH v_k IN ARRAY v_strike_keys LOOP
            DELETE FROM public.edge_rate_limits
            WHERE bucket_key = 'otp_strike:' || v_k;
        END LOOP;

        RETURN QUERY SELECT 'verified'::TEXT, 3, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    v_new_attempts := COALESCE(v_row.attempts, 0) + 1;
    v_max_strike := v_new_attempts;

    FOREACH v_k IN ARRAY v_strike_keys LOOP
        INSERT INTO public.edge_rate_limits AS rl (
            bucket_key,
            request_count,
            window_expires_at,
            updated_at
        )
        VALUES (
            'otp_strike:' || v_k,
            1,
            v_now + INTERVAL '24 hours',
            v_now
        )
        ON CONFLICT (bucket_key) DO UPDATE SET
            request_count = CASE
                WHEN rl.window_expires_at <= v_now THEN 1
                ELSE rl.request_count + 1
            END,
            window_expires_at = CASE
                WHEN rl.window_expires_at <= v_now THEN v_now + INTERVAL '24 hours'
                ELSE rl.window_expires_at
            END,
            updated_at = v_now
        RETURNING rl.request_count INTO v_strike_cnt;

        IF v_strike_cnt > v_max_strike THEN
            v_max_strike := v_strike_cnt;
        END IF;
    END LOOP;

    IF v_max_strike >= 3 THEN
        UPDATE public.otp_challenges
        SET used = true,
            used_at = v_now,
            attempts = v_new_attempts
        WHERE jti = v_jti;

        v_lock_until := v_now + INTERVAL '24 hours';

        FOREACH v_k IN ARRAY v_strike_keys LOOP
            INSERT INTO public.security_blocks (
                target_key,
                target_type,
                identifier,
                source_vector,
                blocked_until,
                reason
            )
            VALUES (
                v_k,
                split_part(v_k, ':', 1),
                substring(v_k FROM position(':' IN v_k) + 1),
                'otp',
                v_lock_until,
                'Exceeded maximum 3 failed OTP attempts.'
            )
            ON CONFLICT (target_key) DO UPDATE SET
                source_vector = 'otp',
                blocked_until = GREATEST(public.security_blocks.blocked_until, EXCLUDED.blocked_until),
                reason = EXCLUDED.reason;

            DELETE FROM public.edge_rate_limits
            WHERE bucket_key = 'otp_strike:' || v_k;
        END LOOP;

        RETURN QUERY SELECT 'locked'::TEXT, 0, v_lock_until;
        RETURN;
    END IF;

    UPDATE public.otp_challenges
    SET attempts = v_new_attempts
    WHERE jti = v_jti;

    RETURN QUERY SELECT 'invalid'::TEXT, GREATEST(1, 3 - v_max_strike), NULL::TIMESTAMPTZ;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_otp_challenge_attempt(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_otp_challenge_attempt(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- --------------------------------------------------------------------
-- 8. HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------------------
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

-- 8.00 STAFF_SECRETS
DROP POLICY IF EXISTS "Deny all client access to staff_secrets" ON public.staff_secrets;
CREATE POLICY "Deny all client access to staff_secrets"
    ON public.staff_secrets FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);

REVOKE ALL ON public.staff_secrets FROM anon, authenticated, public;

-- 8.01 OTP_CHALLENGES & EDGE_RATE_LIMITS (Service-Role Only Isolation)
DROP POLICY IF EXISTS "Deny all client access to otp_challenges" ON public.otp_challenges;
CREATE POLICY "Deny all client access to otp_challenges"
    ON public.otp_challenges FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);

REVOKE ALL ON public.otp_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.otp_challenges TO service_role;

DROP POLICY IF EXISTS "Deny all client access to edge_rate_limits" ON public.edge_rate_limits;
CREATE POLICY "Deny all client access to edge_rate_limits"
    ON public.edge_rate_limits FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);

REVOKE ALL ON public.edge_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.edge_rate_limits TO service_role;

-- 8.0 STAFF_AUDIT_LOGS
DROP POLICY IF EXISTS "Deny anon access to staff_audit_logs" ON public.staff_audit_logs;
CREATE POLICY "Deny anon access to staff_audit_logs"
    ON public.staff_audit_logs FOR ALL TO anon
    USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Admin full access to staff_audit_logs" ON public.staff_audit_logs;
DROP POLICY IF EXISTS "Super Admin full access to staff_audit_logs" ON public.staff_audit_logs;
CREATE POLICY "Super Admin full access to staff_audit_logs"
    ON public.staff_audit_logs FOR ALL TO authenticated
    USING (
        ((auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'Super Admin'))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    )
    WITH CHECK (
        ((auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'Super Admin'))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    );

-- 8.1 STAFF_USERS
DROP POLICY IF EXISTS "Anon full access staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Deny anon access to staff_users" ON public.staff_users;
CREATE POLICY "Deny anon access to staff_users"
    ON public.staff_users FOR ALL TO anon
    USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Admin full access to staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Super Admin full access to staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Staff can read own record" ON public.staff_users;
DROP POLICY IF EXISTS "Admins and staff can view staff directory" ON public.staff_users;
DROP POLICY IF EXISTS "Root Super Admin write access to staff_users" ON public.staff_users;

-- Read policy (SELECT-ONLY) for Active Admins and Staff
CREATE POLICY "Admins and staff can view staff directory"
    ON public.staff_users FOR SELECT TO authenticated
    USING (
        (
          (((auth.jwt()->'app_metadata'->>'role') IN ('admin', 'Admin')) AND ((auth.jwt()->>'aal') = 'aal2'))
          OR
          ((((auth.uid())::text = id) OR ((auth.uid()) = auth_user_id)) AND ((auth.jwt()->>'aal') = 'aal2'))
        )
        AND is_blocked IS NOT TRUE
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    );

-- Write policy (INSERT, UPDATE, DELETE) STRICTLY RESTRICTED TO ROOT SUPER ADMIN
-- Department Admin (non-root) has ZERO direct table-level write access via PostgREST!
CREATE POLICY "Root Super Admin write access to staff_users"
    ON public.staff_users FOR ALL TO authenticated
    USING (
        ((auth.jwt()->'app_metadata'->>'is_root_super_admin')::boolean = TRUE)
        AND ((auth.jwt()->'app_metadata'->>'role') IN ('admin', 'Admin'))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    )
    WITH CHECK (
        ((auth.jwt()->'app_metadata'->>'is_root_super_admin')::boolean = TRUE)
        AND ((auth.jwt()->'app_metadata'->>'role') IN ('admin', 'Admin'))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    );

-- 8.2 CUSTOMERS
DROP POLICY IF EXISTS "Anon full access customers" ON public.customers;
DROP POLICY IF EXISTS "Anon can register customer account" ON public.customers;
DROP POLICY IF EXISTS "Deny anon access to customers" ON public.customers;
CREATE POLICY "Deny anon access to customers"
    ON public.customers FOR ALL TO anon
    USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Customer can insert own profile" ON public.customers;
CREATE POLICY "Customer can insert own profile"
    ON public.customers FOR INSERT TO authenticated
    WITH CHECK (
        (auth.uid() = id)
        AND (
            (auth.jwt()->'app_metadata'->>'role') IS NULL
            OR (auth.jwt()->'app_metadata'->>'role') = 'customer'
        )
    );

DROP POLICY IF EXISTS "Customer can read own profile" ON public.customers;
CREATE POLICY "Customer can read own profile"
    ON public.customers FOR SELECT TO authenticated
    USING (
        (auth.uid() = id) OR
        (
            ((auth.jwt()->'app_metadata'->>'role') IN (
                'super_admin', 'Super Admin', 'admin', 'staff', 'Staff',
                'sales_manager', 'Sales Manager', 'operations_lead', 'Operations Lead',
                'label_designer', 'Label Designer'
            ))
            AND ((auth.jwt()->>'aal') = 'aal2')
            AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
            AND public.is_caller_active_staff()
            AND (
                public.staff_has_permission('leads')
                OR public.staff_has_permission('orders')
            )
        )
    );

DROP POLICY IF EXISTS "Customer can update own profile" ON public.customers;
CREATE POLICY "Customer can update own profile"
    ON public.customers FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 8.3 ORDERS
DROP POLICY IF EXISTS "Anon full access orders" ON public.orders;
DROP POLICY IF EXISTS "Anon can place order" ON public.orders;
CREATE POLICY "Anon can place order"
    ON public.orders FOR INSERT TO anon
    WITH CHECK (owner_email IS NOT NULL AND restaurant_name IS NOT NULL AND quantity > 0);

DROP POLICY IF EXISTS "Customer can place own order" ON public.orders;
CREATE POLICY "Customer can place own order"
    ON public.orders FOR INSERT TO authenticated
    WITH CHECK (
        (LOWER(auth.jwt()->>'email') = LOWER(owner_email)) AND
        restaurant_name IS NOT NULL AND
        quantity > 0
    );

DROP POLICY IF EXISTS "Deny anon read orders" ON public.orders;
CREATE POLICY "Deny anon read orders"
    ON public.orders FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "Customer can view own orders" ON public.orders;
CREATE POLICY "Customer can view own orders"
    ON public.orders FOR SELECT TO authenticated
    USING (
        (LOWER(auth.jwt()->>'email') = LOWER(owner_email)) OR
        (
            ((auth.jwt()->'app_metadata'->>'role') IN (
                'super_admin', 'Super Admin', 'admin', 'staff', 'Staff',
                'sales_manager', 'Sales Manager', 'operations_lead', 'Operations Lead',
                'label_designer', 'Label Designer'
            ))
            AND ((auth.jwt()->>'aal') = 'aal2')
            AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
            AND public.is_caller_active_staff()
            AND public.staff_has_permission('orders')
        )
    );

DROP POLICY IF EXISTS "Staff can update order status" ON public.orders;
CREATE POLICY "Staff can update order status"
    ON public.orders FOR UPDATE TO authenticated
    USING (
        ((auth.jwt()->'app_metadata'->>'role') IN (
            'super_admin', 'Super Admin', 'admin', 'staff', 'Staff',
            'sales_manager', 'Sales Manager', 'operations_lead', 'Operations Lead',
            'label_designer', 'Label Designer'
        ))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
        AND public.staff_has_permission('orders')
    )
    WITH CHECK (
        ((auth.jwt()->'app_metadata'->>'role') IN (
            'super_admin', 'Super Admin', 'admin', 'staff', 'Staff',
            'sales_manager', 'Sales Manager', 'operations_lead', 'Operations Lead',
            'label_designer', 'Label Designer'
        ))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
        AND public.staff_has_permission('orders')
    );

-- 8.4 CONSULTATIONS (Split SELECT/UPDATE with 'leads' + Super Admin Only DELETE)
DROP POLICY IF EXISTS "Anon full access consultations" ON public.consultations;
DROP POLICY IF EXISTS "Public can book tasting consultation" ON public.consultations;
CREATE POLICY "Public can book tasting consultation"
    ON public.consultations FOR INSERT TO anon
    WITH CHECK (phone IS NOT NULL AND restaurant_name IS NOT NULL AND email IS NOT NULL);

DROP POLICY IF EXISTS "Customer can book tasting consultation" ON public.consultations;
CREATE POLICY "Customer can book tasting consultation"
    ON public.consultations FOR INSERT TO authenticated
    WITH CHECK (phone IS NOT NULL AND restaurant_name IS NOT NULL AND email IS NOT NULL);

DROP POLICY IF EXISTS "Deny anon read consultations" ON public.consultations;
CREATE POLICY "Deny anon read consultations"
    ON public.consultations FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "Customer can view own consultations" ON public.consultations;
CREATE POLICY "Customer can view own consultations"
    ON public.consultations FOR SELECT TO authenticated
    USING (LOWER(auth.jwt()->>'email') = LOWER(email));

DROP POLICY IF EXISTS "Staff can manage consultations" ON public.consultations;
DROP POLICY IF EXISTS "Staff can read consultations" ON public.consultations;
CREATE POLICY "Staff can read consultations"
    ON public.consultations FOR SELECT TO authenticated
    USING (
        ((auth.jwt()->'app_metadata'->>'role') IN (
            'super_admin', 'Super Admin', 'admin', 'staff', 'Staff',
            'sales_manager', 'Sales Manager', 'operations_lead', 'Operations Lead',
            'label_designer', 'Label Designer'
        ))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
        AND public.staff_has_permission('leads')
    );

DROP POLICY IF EXISTS "Staff can update consultations" ON public.consultations;
CREATE POLICY "Staff can update consultations"
    ON public.consultations FOR UPDATE TO authenticated
    USING (
        ((auth.jwt()->'app_metadata'->>'role') IN (
            'super_admin', 'Super Admin', 'admin', 'staff', 'Staff',
            'sales_manager', 'Sales Manager', 'operations_lead', 'Operations Lead',
            'label_designer', 'Label Designer'
        ))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
        AND public.staff_has_permission('leads')
    )
    WITH CHECK (
        ((auth.jwt()->'app_metadata'->>'role') IN (
            'super_admin', 'Super Admin', 'admin', 'staff', 'Staff',
            'sales_manager', 'Sales Manager', 'operations_lead', 'Operations Lead',
            'label_designer', 'Label Designer'
        ))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
        AND public.staff_has_permission('leads')
    );

DROP POLICY IF EXISTS "Super Admin can delete consultations" ON public.consultations;
CREATE POLICY "Super Admin can delete consultations"
    ON public.consultations FOR DELETE TO authenticated
    USING (
        ((auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'Super Admin'))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    );

-- 8.5 SECURITY_BLOCKS (Anon Denied; SELECT Only For Super Admin or 'audit_logs')
REVOKE INSERT, UPDATE, DELETE ON public.security_blocks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.security_blocks TO authenticated;
GRANT ALL ON public.security_blocks TO service_role;

DROP POLICY IF EXISTS "Anon full access security_blocks" ON public.security_blocks;
DROP POLICY IF EXISTS "Anon can view and record security blocks" ON public.security_blocks;
DROP POLICY IF EXISTS "Anon can record security block entry" ON public.security_blocks;
DROP POLICY IF EXISTS "Deny anon access to security_blocks" ON public.security_blocks;
CREATE POLICY "Deny anon access to security_blocks"
    ON public.security_blocks FOR ALL TO anon
    USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Admin read security_blocks" ON public.security_blocks;
CREATE POLICY "Admin read security_blocks"
    ON public.security_blocks FOR SELECT TO authenticated
    USING (
        (
            ((auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'Super Admin'))
            OR public.staff_has_permission('audit_logs')
        )
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    );

-- 8.6 EMAIL_LOGS (Anon Denied; SELECT Only For Super Admin or 'audit_logs')
REVOKE INSERT, UPDATE, DELETE ON public.email_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;

DROP POLICY IF EXISTS "Anon full access email_logs" ON public.email_logs;
DROP POLICY IF EXISTS "Anon can append email audit log" ON public.email_logs;
DROP POLICY IF EXISTS "Deny anon access to email_logs" ON public.email_logs;
CREATE POLICY "Deny anon access to email_logs"
    ON public.email_logs FOR ALL TO anon
    USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Admin can read email audit logs" ON public.email_logs;
CREATE POLICY "Admin can read email audit logs"
    ON public.email_logs FOR SELECT TO authenticated
    USING (
        (
            ((auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'Super Admin'))
            OR public.staff_has_permission('audit_logs')
        )
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    );

-- --------------------------------------------------------------------
-- 9. CANONICAL ROOT SUPER ADMIN SEED & MULTI-ROW UUID RECONCILIATION
-- --------------------------------------------------------------------
DO $$
DECLARE
    v_canonical_email CONSTANT TEXT := 'admin@haritjal.in';
    v_fallback_uuid CONSTANT TEXT := '00000000-0000-4000-8000-000000000001';
    v_auth_uid TEXT;
    v_target_id TEXT;
    v_has_verified_mfa BOOLEAN := false;
    v_dup_ids TEXT[] := ARRAY[]::TEXT[];
    v_dup_row RECORD;
    v_dup_id TEXT;
BEGIN
    SELECT id::text INTO v_auth_uid
    FROM auth.users
    WHERE LOWER(email) = v_canonical_email
    LIMIT 1;

    IF v_auth_uid IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM auth.mfa_factors
            WHERE user_id = v_auth_uid::uuid
              AND factor_type = 'totp'
              AND status = 'verified'
        ) INTO v_has_verified_mfa;

        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
                'role', 'super_admin',
                'is_root_super_admin', true,
                'is_blocked', false,
                'is_first_login', false,
                'totp_enabled', v_has_verified_mfa
            ),
            updated_at = NOW()
        WHERE id = v_auth_uid::uuid;

        DELETE FROM public.customers WHERE id = v_auth_uid::uuid;
    END IF;

    v_target_id := COALESCE(v_auth_uid, v_fallback_uuid);

    FOR v_dup_row IN
        SELECT id
        FROM public.staff_users
        WHERE (LOWER(email) = v_canonical_email OR is_root_super_admin = TRUE)
          AND id <> v_target_id
        ORDER BY is_root_super_admin DESC, created_at ASC
    LOOP
        UPDATE public.staff_users
        SET email = 'migrating_' || v_dup_row.id || '@invalid.local',
            is_root_super_admin = FALSE
        WHERE id = v_dup_row.id;

        v_dup_ids := array_append(v_dup_ids, v_dup_row.id);
    END LOOP;

    INSERT INTO public.staff_users (
        id,
        name,
        email,
        phone,
        designation,
        role,
        permissions,
        is_blocked,
        totp_enabled,
        is_first_login,
        is_root_super_admin,
        email_phone_changes_count
    ) VALUES (
        v_target_id,
        'Atal Pandey',
        v_canonical_email,
        '+916299293497',
        'Founder & Super Admin',
        'super_admin',
        '["all", "leads", "orders", "inventory", "pricing", "staff", "audit_logs"]'::jsonb,
        false,
        v_has_verified_mfa,
        false,
        true,
        0
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        designation = EXCLUDED.designation,
        role = 'super_admin',
        permissions = EXCLUDED.permissions,
        is_blocked = false,
        totp_enabled = CASE WHEN v_auth_uid IS NOT NULL THEN v_has_verified_mfa ELSE public.staff_users.totp_enabled END,
        is_first_login = false,
        is_root_super_admin = true,
        updated_at = NOW();

    IF array_length(v_dup_ids, 1) IS NOT NULL THEN
        FOREACH v_dup_id IN ARRAY v_dup_ids LOOP
            UPDATE public.orders SET assigned_staff_id = v_target_id WHERE assigned_staff_id = v_dup_id;
            UPDATE public.consultations SET assigned_staff_id = v_target_id WHERE assigned_staff_id = v_dup_id;
            DELETE FROM public.staff_secrets WHERE user_id = v_dup_id;
            DELETE FROM public.staff_users WHERE id = v_dup_id;
        END LOOP;
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 10. IMMUTABILITY TRIGGER: Root Super Admin Protection
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_root_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF (OLD.is_root_super_admin = TRUE) THEN
        IF (TG_OP = 'DELETE') THEN
            RAISE EXCEPTION 'Security Violation: Root Super Admin account cannot be deleted.';
        END IF;
        IF (TG_OP = 'UPDATE' AND NEW.is_blocked = TRUE) THEN
            RAISE EXCEPTION 'Security Violation: Root Super Admin account cannot be blocked.';
        END IF;
        IF (TG_OP = 'UPDATE' AND NEW.is_root_super_admin IS DISTINCT FROM TRUE) THEN
            RAISE EXCEPTION 'Security Violation: Root Super Admin immunity flag cannot be removed.';
        END IF;
        IF (TG_OP = 'UPDATE' AND LOWER(REPLACE(COALESCE(NEW.role, ''), ' ', '_')) <> 'super_admin') THEN
            RAISE EXCEPTION 'Security Violation: Root Super Admin role cannot be downgraded.';
        END IF;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_root_super_admin ON public.staff_users;
CREATE TRIGGER trg_protect_root_super_admin
    BEFORE UPDATE OR DELETE ON public.staff_users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_root_super_admin();

COMMIT;

-- ====================================================================
-- SUCCESS: Authoritative `supabase/schema.sql` synchronized with Phase 1H.6.
-- ====================================================================
