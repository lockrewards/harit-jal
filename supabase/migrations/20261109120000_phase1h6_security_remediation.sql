-- ====================================================================
-- HARIT JAL™ (हरित जल) — SECURITY MIGRATION: 20261109_phase1h6_security_remediation
-- Purpose: Remediates Phase 1H.5 Critical & High Database/Edge Security Findings:
--   1. CRIT-H5-01: Revoke EXECUTE on record_security_block, check_security_block,
--                  and append_email_audit_log from PUBLIC/anon/authenticated;
--                  grant strictly to service_role; add safe db_health_ping().
--   2. CRIT-H5-02: Create persistent public.otp_challenges & public.edge_rate_limits
--                  (RLS deny-all for clients; service_role only), atomic RPCs
--                  consume_edge_rate_limit() & verify_otp_challenge_attempt(),
--                  consultations single-shot claim columns + insert sanitizer trigger.
--   3. HIGH-H5-01: Enforce backend staff_users.permissions via non-recursive
--                  SECURITY DEFINER public.staff_has_permission(TEXT); split
--                  consultations FOR ALL into SELECT/UPDATE/Super-Admin DELETE;
--                  restrict security_blocks & email_logs to SELECT for Super Admin
--                  or staff holding 'audit_logs'.
--   4. HIGH-H5-03: Restrict public.customers UPDATE privileges to safe profile
--                  columns and enforce server-side quota + email/consent immutability
--                  via BEFORE UPDATE trigger protect_customer_profile_columns().
--   5. HIGH-H5-04: Unify 72h temporary invitation expiry inside
--                  public.is_caller_active_staff() across all staff RLS scopes.
-- Execution Mode: Strictly local staged migration (DO NOT run in sandbox).
-- ====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 1. PERSISTENT EDGE STATE TABLES (Service-Role Only)
-- --------------------------------------------------------------------

-- 1.1 TABLE: OTP_CHALLENGES (Multi-Isolate Single-Use OTP Enforcement)
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

ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all client access to otp_challenges" ON public.otp_challenges;
CREATE POLICY "Deny all client access to otp_challenges"
    ON public.otp_challenges FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);

REVOKE ALL ON public.otp_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.otp_challenges TO service_role;

-- 1.2 TABLE: EDGE_RATE_LIMITS (Distributed Per-IP / Cross-Resend / AI Quota Buckets)
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
    bucket_key TEXT PRIMARY KEY,
    request_count INT NOT NULL DEFAULT 0,
    window_expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_expiry
    ON public.edge_rate_limits(window_expires_at);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all client access to edge_rate_limits" ON public.edge_rate_limits;
CREATE POLICY "Deny all client access to edge_rate_limits"
    ON public.edge_rate_limits FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);

REVOKE ALL ON public.edge_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.edge_rate_limits TO service_role;

-- --------------------------------------------------------------------
-- 2. CONSULTATIONS SINGLE-SHOT CLAIM COLUMNS & ANTI-SPOOFING TRIGGER
-- --------------------------------------------------------------------
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS admin_alert_sent_at TIMESTAMPTZ;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS crm_synced_at TIMESTAMPTZ;

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
-- 3. NON-RECURSIVE ACTIVE STAFF (WITH UNIFIED 72H EXPIRY) & PERMISSION CHECK
-- --------------------------------------------------------------------

-- 3.1 Unify 72h Temporary Invitation Expiry Inside public.is_caller_active_staff()
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

-- 3.2 Non-Recursive Permission Check Against staff_users.permissions (HIGH-H5-01)
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

-- --------------------------------------------------------------------
-- 4. RPC HARDENING: REVOKE ANON/AUTH ON PRIVILEGED RPCS & ADD HEALTH PING
-- --------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.record_security_block(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_security_block(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION public.check_security_block(TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_security_block(TEXT[]) TO service_role;

REVOKE ALL ON FUNCTION public.append_email_audit_log(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_email_audit_log(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- 4.1 Safe Zero-Side-Effect Health Check RPC (Replaces Anon check_security_block Probe)
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

-- 4.2 Atomic Edge Rate Limiter RPC (Service-Role Only)
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

-- 4.3 Atomic Single-Use OTP Challenge Verification & Strike Lockout RPC (Service-Role Only)
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
-- 5. CUSTOMER COLUMN INTEGRITY & SERVER-SIDE CONTACT QUOTA (HIGH-H5-03)
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

-- --------------------------------------------------------------------
-- 6. PERMISSION-GATED NON-RECURSIVE RLS POLICIES (HIGH-H5-01)
-- --------------------------------------------------------------------

-- 6.1 CUSTOMERS (Customer Own Row OR Active Staff With leads/orders Permission)
DROP POLICY IF EXISTS "Customer can read own profile" ON public.customers;
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
            AND (
                public.staff_has_permission('leads')
                OR public.staff_has_permission('orders')
            )
        )
    );

-- 6.2 ORDERS (Customer Own Orders OR Active Staff With orders Permission)
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

-- 6.3 CONSULTATIONS (Split FOR ALL into SELECT/UPDATE with leads + Super Admin Only DELETE)
DROP POLICY IF EXISTS "Staff can manage consultations" ON public.consultations;
DROP POLICY IF EXISTS "Staff can read consultations" ON public.consultations;
DROP POLICY IF EXISTS "Staff can update consultations" ON public.consultations;
DROP POLICY IF EXISTS "Super Admin can delete consultations" ON public.consultations;

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

CREATE POLICY "Super Admin can delete consultations"
    ON public.consultations FOR DELETE TO authenticated
    USING (
        ((auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'Super Admin'))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    );

-- 6.4 SECURITY_BLOCKS & EMAIL_LOGS (SELECT Only For Super Admin or Active Staff With audit_logs)
REVOKE INSERT, UPDATE, DELETE ON public.security_blocks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.security_blocks TO authenticated;
GRANT ALL ON public.security_blocks TO service_role;

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

REVOKE INSERT, UPDATE, DELETE ON public.email_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;

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

COMMIT;

