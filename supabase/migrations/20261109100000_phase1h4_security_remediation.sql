-- ====================================================================
-- HARIT JAL™ (हरित जल) — PRODUCTION CONSOLIDATED DATABASE MIGRATION
-- Phase 1H.4: Non-Recursive RLS, Safe RPC Boundaries & Schema Sync
-- Target Database: Supabase PostgreSQL Cloud
-- Standards: Supabase Auth (GoTrue), RFC 4122 UUID, Native TOTP (AAL2), RLS
-- Security Status: Zero 42P17 Recursion | Hardened SECURITY DEFINER RPCs
-- ====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 0. EXTENSIONS & PREREQUISITES
-- --------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 1. CLEANUP LEGACY / PRIOR POLICIES & PROTECTION TRIGGERS
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_protect_root_super_admin ON public.staff_users;

DROP POLICY IF EXISTS "Anon full access staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Deny anon access to staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Admin full access to staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Super Admin full access to staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Staff can read own record" ON public.staff_users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.staff_users;

DROP POLICY IF EXISTS "Anon full access customers" ON public.customers;
DROP POLICY IF EXISTS "Anon can register customer account" ON public.customers;
DROP POLICY IF EXISTS "Deny anon access to customers" ON public.customers;
DROP POLICY IF EXISTS "Customer can read own profile" ON public.customers;
DROP POLICY IF EXISTS "Customer can insert own profile" ON public.customers;
DROP POLICY IF EXISTS "Customer can update own profile" ON public.customers;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.customers;
DROP POLICY IF EXISTS "staff_read_customers" ON public.customers;

DROP POLICY IF EXISTS "Anon full access orders" ON public.orders;
DROP POLICY IF EXISTS "Anon can place order" ON public.orders;
DROP POLICY IF EXISTS "Customer can place own order" ON public.orders;
DROP POLICY IF EXISTS "Customer can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update order status" ON public.orders;
DROP POLICY IF EXISTS "Staff can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Deny anon read orders" ON public.orders;

DROP POLICY IF EXISTS "Anon full access consultations" ON public.consultations;
DROP POLICY IF EXISTS "Public can book tasting consultation" ON public.consultations;
DROP POLICY IF EXISTS "Customer can book tasting consultation" ON public.consultations;
DROP POLICY IF EXISTS "Customer can view own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Staff can manage consultations" ON public.consultations;
DROP POLICY IF EXISTS "Deny anon read consultations" ON public.consultations;

DROP POLICY IF EXISTS "Anon full access security_blocks" ON public.security_blocks;
DROP POLICY IF EXISTS "Anon can view and record security blocks" ON public.security_blocks;
DROP POLICY IF EXISTS "Anon can record security block entry" ON public.security_blocks;
DROP POLICY IF EXISTS "Deny anon access to security_blocks" ON public.security_blocks;
DROP POLICY IF EXISTS "Admin read security_blocks" ON public.security_blocks;

DROP POLICY IF EXISTS "Anon full access email_logs" ON public.email_logs;
DROP POLICY IF EXISTS "Anon can append email audit log" ON public.email_logs;
DROP POLICY IF EXISTS "Admin can read email audit logs" ON public.email_logs;
DROP POLICY IF EXISTS "Deny anon access to email_logs" ON public.email_logs;

DROP POLICY IF EXISTS "Deny all client access to staff_secrets" ON public.staff_secrets;
DROP POLICY IF EXISTS "Deny anon access to staff_audit_logs" ON public.staff_audit_logs;
DROP POLICY IF EXISTS "Admin full access to staff_audit_logs" ON public.staff_audit_logs;
DROP POLICY IF EXISTS "Super Admin full access to staff_audit_logs" ON public.staff_audit_logs;

-- --------------------------------------------------------------------
-- 2. TABLE DEFINITIONS & IDEMPOTENT SCHEMA DRIFT RECONCILIATION
-- --------------------------------------------------------------------

-- 2.1 TABLE: STAFF_USERS (Operations, Sales, Logistics & Admin Staff)
CREATE TABLE IF NOT EXISTS public.staff_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    designation TEXT NOT NULL,
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

-- Ensure sensitive credentials cannot exist on staff_users
ALTER TABLE public.staff_users DROP COLUMN IF EXISTS password;
ALTER TABLE public.staff_users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.staff_users DROP COLUMN IF EXISTS temporary_password;
ALTER TABLE public.staff_users DROP COLUMN IF EXISTS temporary_password_hash;
ALTER TABLE public.staff_users DROP COLUMN IF EXISTS temporary_password_expires_at;
ALTER TABLE public.staff_users DROP COLUMN IF EXISTS totp_secret;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_single_root_super_admin
    ON public.staff_users (is_root_super_admin)
    WHERE is_root_super_admin = TRUE;

-- 2.2 TABLE: STAFF_SECRETS (Isolated Server-Only Table)
CREATE TABLE IF NOT EXISTS public.staff_secrets (
    user_id TEXT PRIMARY KEY REFERENCES public.staff_users(id) ON DELETE CASCADE,
    password_hash TEXT,
    temporary_password_hash TEXT,
    temporary_password_expires_at TIMESTAMPTZ,
    totp_secret TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 TABLE: STAFF_AUDIT_LOGS (Immutable Administrative Audit Trail)
CREATE TABLE IF NOT EXISTS public.staff_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- 2.4 TABLE: CUSTOMERS (Restaurant & Dhaba Partner Accounts)
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

-- 2.5 TABLE: CONSULTATIONS (Free Consultation & Tasting Bookings)
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS assigned_staff_id TEXT;
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

-- 2.6 TABLE: ORDERS (Custom Luxury Glass Bottle Batches & Logistics)
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

-- 2.7 TABLE: SECURITY_BLOCKS (Multi-Vector 24h Rate Limiting Lockouts)
CREATE TABLE IF NOT EXISTS public.security_blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    target_key TEXT UNIQUE NOT NULL,
    target_type TEXT NOT NULL,
    identifier TEXT NOT NULL,
    source_vector TEXT NOT NULL DEFAULT 'password',
    blocked_until TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.security_blocks ADD COLUMN IF NOT EXISTS source_vector TEXT NOT NULL DEFAULT 'password';

CREATE INDEX IF NOT EXISTS idx_security_blocks_target ON public.security_blocks(target_key);
CREATE INDEX IF NOT EXISTS idx_security_blocks_expiry ON public.security_blocks(blocked_until);

-- 2.8 TABLE: EMAIL_LOGS (Transactional Notification Audit Trail)
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'email_logs'
          AND column_name = 'template_type' AND column_default IS NULL
    ) THEN
        ALTER TABLE public.email_logs ALTER COLUMN template_type SET DEFAULT 'transactional';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);

-- --------------------------------------------------------------------
-- 3. NON-RECURSIVE SECURITY DEFINER HELPERS & CONTROLLED WRITE RPCS
-- --------------------------------------------------------------------

-- 3.1 Non-Recursive Active Staff Check (Prevents SQLSTATE 42P17 Across All RLS Policies)
-- Runs as postgres (BYPASSRLS) with fixed search_path so querying public.staff_users
-- never triggers RLS rewrite expansion inside authenticated or anon queries.
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

-- 3.2 Controlled RPC: Record Security Block (Replaces Unsafe Anon Direct Table Writes)
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

    -- Clamp expiry strictly between 1 minute and 25 hours from server clock
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

REVOKE ALL ON FUNCTION public.record_security_block(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_security_block(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;

-- 3.3 Controlled RPC: Targeted Security Block Lookup (Zero Full-Table Enumeration)
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

REVOKE ALL ON FUNCTION public.check_security_block(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_security_block(TEXT[]) TO anon, authenticated;

-- 3.4 Controlled RPC: Append Email Audit Log (Replaces Unsafe Anon Direct Table Writes)
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

    -- Scrub any accidental 6-digit OTP/verification codes from notification audit preview
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

REVOKE ALL ON FUNCTION public.append_email_audit_log(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_email_audit_log(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- --------------------------------------------------------------------
-- 4. CUSTOMER AUTH TRIGGER SYNCHRONIZATION
-- Automatically provisions public.customers rows when a customer signs
-- up via Supabase Auth (ignores staff identities; trusts ONLY app_metadata).
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
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_customer();

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

    UPDATE public.customers
    SET email = v_new_email,
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
-- 5. ENABLE ROW LEVEL SECURITY
-- --------------------------------------------------------------------
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 6. STAFF_SECRETS POLICIES (Strict Server-Only Isolation)
-- --------------------------------------------------------------------
CREATE POLICY "Deny all client access to staff_secrets"
    ON public.staff_secrets FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);

REVOKE ALL ON public.staff_secrets FROM anon, authenticated, public;

-- --------------------------------------------------------------------
-- 7. STAFF_AUDIT_LOGS POLICIES (Super Admin Only - AAL2 & Non-Recursive)
-- --------------------------------------------------------------------
CREATE POLICY "Deny anon access to staff_audit_logs"
    ON public.staff_audit_logs FOR ALL TO anon
    USING (false) WITH CHECK (false);

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

-- --------------------------------------------------------------------
-- 8. STAFF_USERS POLICIES (Super Admin Only Governance + Staff Read Own)
-- --------------------------------------------------------------------
CREATE POLICY "Deny anon access to staff_users"
    ON public.staff_users FOR ALL TO anon
    USING (false) WITH CHECK (false);

CREATE POLICY "Super Admin full access to staff_users"
    ON public.staff_users FOR ALL TO authenticated
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

CREATE POLICY "Staff can read own record"
    ON public.staff_users FOR SELECT TO authenticated
    USING (
        (auth.uid()::text = id)
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND is_blocked IS NOT TRUE
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND ((auth.jwt()->'app_metadata'->>'role') IN (
            'super_admin', 'Super Admin', 'admin', 'staff', 'Staff',
            'sales_manager', 'Sales Manager', 'operations_lead', 'Operations Lead',
            'label_designer', 'Label Designer'
        ))
        AND public.is_caller_active_staff()
    );

-- --------------------------------------------------------------------
-- 9. CUSTOMERS POLICIES (Server-Authoritative app_metadata + AAL2 Staff)
-- --------------------------------------------------------------------
CREATE POLICY "Deny anon access to customers"
    ON public.customers FOR ALL TO anon
    USING (false) WITH CHECK (false);

CREATE POLICY "Customer can insert own profile"
    ON public.customers FOR INSERT TO authenticated
    WITH CHECK (
        (auth.uid()::text = id::text)
        AND (
            (auth.jwt()->'app_metadata'->>'role') IS NULL
            OR (auth.jwt()->'app_metadata'->>'role') = 'customer'
        )
    );

CREATE POLICY "Customer can read own profile"
    ON public.customers FOR SELECT TO authenticated
    USING (
        (auth.uid()::text = id::text) OR
        (
            ((auth.jwt()->'app_metadata'->>'role') IN (
                'super_admin', 'Super Admin', 'admin', 'staff', 'Staff',
                'sales_manager', 'Sales Manager', 'operations_lead', 'Operations Lead',
                'label_designer', 'Label Designer'
            ))
            AND ((auth.jwt()->>'aal') = 'aal2')
            AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
            AND public.is_caller_active_staff()
        )
    );

CREATE POLICY "Customer can update own profile"
    ON public.customers FOR UPDATE TO authenticated
    USING (auth.uid()::text = id::text)
    WITH CHECK (auth.uid()::text = id::text);

-- --------------------------------------------------------------------
-- 10. ORDERS POLICIES
-- --------------------------------------------------------------------
CREATE POLICY "Anon can place order"
    ON public.orders FOR INSERT TO anon
    WITH CHECK (
        owner_email IS NOT NULL AND
        restaurant_name IS NOT NULL AND
        quantity > 0
    );

CREATE POLICY "Customer can place own order"
    ON public.orders FOR INSERT TO authenticated
    WITH CHECK (
        (LOWER(auth.jwt()->>'email') = LOWER(owner_email)) AND
        restaurant_name IS NOT NULL AND
        quantity > 0
    );

CREATE POLICY "Deny anon read orders"
    ON public.orders FOR SELECT TO anon
    USING (false);

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
            AND (
                (auth.jwt()->'app_metadata'->>'is_first_login')::boolean IS NOT TRUE
                OR ((auth.jwt()->'app_metadata'->>'temporary_password_expires_at')::bigint > (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint)
            )
        )
    );

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
        AND (
            (auth.jwt()->'app_metadata'->>'is_first_login')::boolean IS NOT TRUE
            OR ((auth.jwt()->'app_metadata'->>'temporary_password_expires_at')::bigint > (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint)
        )
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
        AND (
            (auth.jwt()->'app_metadata'->>'is_first_login')::boolean IS NOT TRUE
            OR ((auth.jwt()->'app_metadata'->>'temporary_password_expires_at')::bigint > (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint)
        )
    );

-- --------------------------------------------------------------------
-- 11. CONSULTATIONS POLICIES
-- --------------------------------------------------------------------
CREATE POLICY "Public can book tasting consultation"
    ON public.consultations FOR INSERT TO anon
    WITH CHECK (
        phone IS NOT NULL AND
        restaurant_name IS NOT NULL AND
        email IS NOT NULL
    );

CREATE POLICY "Customer can book tasting consultation"
    ON public.consultations FOR INSERT TO authenticated
    WITH CHECK (
        phone IS NOT NULL AND
        restaurant_name IS NOT NULL AND
        email IS NOT NULL
    );

CREATE POLICY "Deny anon read consultations"
    ON public.consultations FOR SELECT TO anon
    USING (false);

CREATE POLICY "Customer can view own consultations"
    ON public.consultations FOR SELECT TO authenticated
    USING (LOWER(auth.jwt()->>'email') = LOWER(email));

CREATE POLICY "Staff can manage consultations"
    ON public.consultations FOR ALL TO authenticated
    USING (
        ((auth.jwt()->'app_metadata'->>'role') IN (
            'super_admin', 'Super Admin', 'admin', 'staff', 'Staff',
            'sales_manager', 'Sales Manager', 'operations_lead', 'Operations Lead',
            'label_designer', 'Label Designer'
        ))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
        AND (
            (auth.jwt()->'app_metadata'->>'is_first_login')::boolean IS NOT TRUE
            OR ((auth.jwt()->'app_metadata'->>'temporary_password_expires_at')::bigint > (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint)
        )
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
        AND (
            (auth.jwt()->'app_metadata'->>'is_first_login')::boolean IS NOT TRUE
            OR ((auth.jwt()->'app_metadata'->>'temporary_password_expires_at')::bigint > (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint)
        )
    );

-- --------------------------------------------------------------------
-- 12. SECURITY_BLOCKS POLICIES (Anon Denied Direct Access; AAL2 Admin + RPC)
-- --------------------------------------------------------------------
CREATE POLICY "Deny anon access to security_blocks"
    ON public.security_blocks FOR ALL TO anon
    USING (false) WITH CHECK (false);

CREATE POLICY "Admin read security_blocks"
    ON public.security_blocks FOR ALL TO authenticated
    USING (
        ((auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'Super Admin', 'admin'))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    )
    WITH CHECK (
        ((auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'Super Admin', 'admin'))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    );

-- --------------------------------------------------------------------
-- 13. EMAIL_LOGS POLICIES (Anon Denied Direct Access; AAL2 Admin + RPC)
-- --------------------------------------------------------------------
CREATE POLICY "Deny anon access to email_logs"
    ON public.email_logs FOR ALL TO anon
    USING (false) WITH CHECK (false);

CREATE POLICY "Admin can read email audit logs"
    ON public.email_logs FOR ALL TO authenticated
    USING (
        ((auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'Super Admin', 'admin'))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    )
    WITH CHECK (
        ((auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'Super Admin', 'admin'))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    );

-- --------------------------------------------------------------------
-- 14. CANONICAL ROOT SUPER ADMIN RECONCILIATION & MULTI-ROW SAFE CLEANUP
-- Synchronizes public.staff_users.id directly to auth.users.id::text,
-- normalizes ALL conflicting duplicate root/canonical email rows defensively,
-- and sets totp_enabled strictly from verified auth.mfa_factors records.
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

        -- Remove any accidental customer profile for Root Super Admin
        DELETE FROM public.customers WHERE id = v_auth_uid::uuid;
    END IF;

    v_target_id := COALESCE(v_auth_uid, v_fallback_uuid);

    -- Quarantines ALL legacy/duplicate root or canonical-email rows safely before insert
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
        email,
        phone,
        name,
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
        v_canonical_email,
        '+916299293497',
        'Atal Pandey',
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
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        name = EXCLUDED.name,
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
-- 15. IMMUTABILITY TRIGGER: Root Super Admin Protection (Non-Email Flag)
-- Uses OLD.is_root_super_admin = TRUE (zero hardcoded emails in pg_proc)
-- and returns OLD on non-root DELETE so legitimate staff deletions succeed.
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

CREATE TRIGGER trg_protect_root_super_admin
    BEFORE UPDATE OR DELETE ON public.staff_users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_root_super_admin();

COMMIT;

-- ====================================================================
-- SUCCESS: Phase 1H.4 Authoritative consolidated migration staged.
-- Non-recursive RLS via public.is_caller_active_staff() (SECURITY DEFINER).
-- Controlled RPCs for security_blocks and email_logs with strict validation.
-- Multi-row Root Super Admin reconciliation & non-root RETURN OLD trigger.
-- ====================================================================
