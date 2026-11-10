-- ====================================================================
-- HARIT JAL™ (हरित जल) — ROLLBACK SCRIPT: 20261109_rollback_phase1h4_security_remediation
-- Stored safely outside `supabase/migrations/` in `supabase/rollback/`
-- so `supabase db push` never replays rollback scripts automatically.
--
-- Security Guarantees:
--   1. Reverts Phase 1H.4 incremental changes (root super admin trigger,
--      email sync trigger, and Phase 1H.4 security RPCs) back to Phase 1H.2.
--   2. RLS REMAINS ENFORCED across all 8 tables.
--   3. NEVER re-introduces plaintext passwords or hashes to public tables.
--   4. NEVER re-introduces permissive `FOR ALL USING (true)` policies.
-- ====================================================================

BEGIN;

-- 1. DROP PHASE 1H.4 ROOT SUPER ADMIN TRIGGERS & INDEXES
DROP TRIGGER IF EXISTS trg_protect_root_super_admin ON public.staff_users;
DROP FUNCTION IF EXISTS public.protect_root_super_admin();
DROP INDEX IF EXISTS public.idx_staff_single_root_super_admin;
ALTER TABLE public.staff_users DROP COLUMN IF EXISTS is_root_super_admin;

-- 2. DROP PHASE 1H.4 CUSTOMER EMAIL SYNC TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_email_updated_customer ON auth.users;
DROP FUNCTION IF EXISTS public.handle_customer_email_sync();

-- 3. DROP PHASE 1H.4 AUDIT & SECURITY BLOCK RPCS (IF REVERTING TO 1H.2 BASELINE)
DROP FUNCTION IF EXISTS public.record_security_block(text, text, text, text, interval);
DROP FUNCTION IF EXISTS public.check_security_block(text, text, text);
DROP FUNCTION IF EXISTS public.append_email_audit_log(text, text, text, text, text, jsonb, boolean, text);

-- 4. ENSURE RLS REMAINS STRICTLY ACTIVE ACROSS ALL 8 TABLES
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- 5. ENSURE PHASE 1H.2 NON-RECURSIVE HELPER EXISTS
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

-- 6. RESTORE HARDENED RLS BASELINE (Phase 1H.2 policies)
-- staff_secrets: Server-only
DROP POLICY IF EXISTS "Deny all client access to staff_secrets" ON public.staff_secrets;
CREATE POLICY "Deny all client access to staff_secrets"
    ON public.staff_secrets FOR ALL
    USING (false) WITH CHECK (false);

-- staff_audit_logs: Admin/Super Admin only
DROP POLICY IF EXISTS "Deny anon access to staff_audit_logs" ON public.staff_audit_logs;
CREATE POLICY "Deny anon access to staff_audit_logs"
    ON public.staff_audit_logs FOR ALL TO anon
    USING (false) WITH CHECK (false);

-- staff_users: Deny anon, Super Admin full, Staff read own
DROP POLICY IF EXISTS "Deny anon access to staff_users" ON public.staff_users;
CREATE POLICY "Deny anon access to staff_users"
    ON public.staff_users FOR ALL TO anon
    USING (false) WITH CHECK (false);

-- customers: Deny anon, Customer read/update own
DROP POLICY IF EXISTS "Deny anon access to customers" ON public.customers;
CREATE POLICY "Deny anon access to customers"
    ON public.customers FOR ALL TO anon
    USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Customer can read own profile" ON public.customers;
CREATE POLICY "Customer can read own profile"
    ON public.customers FOR SELECT TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Customer can update own profile" ON public.customers;
CREATE POLICY "Customer can update own profile"
    ON public.customers FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- orders: Deny anon read, Customer view own, Staff update status
DROP POLICY IF EXISTS "Deny anon read orders" ON public.orders;
CREATE POLICY "Deny anon read orders"
    ON public.orders FOR SELECT TO anon
    USING (false);

DROP POLICY IF EXISTS "Customer can view own orders" ON public.orders;
CREATE POLICY "Customer can view own orders"
    ON public.orders FOR SELECT TO authenticated
    USING (auth.uid() = customer_id);

-- consultations: Deny anon read, Customer view own, Staff manage
DROP POLICY IF EXISTS "Deny anon read consultations" ON public.consultations;
CREATE POLICY "Deny anon read consultations"
    ON public.consultations FOR SELECT TO anon
    USING (false);

-- security_blocks: Deny anon, Staff read
DROP POLICY IF EXISTS "Deny anon access to security_blocks" ON public.security_blocks;
CREATE POLICY "Deny anon access to security_blocks"
    ON public.security_blocks FOR ALL TO anon
    USING (false) WITH CHECK (false);

-- email_logs: Deny anon, Staff read
DROP POLICY IF EXISTS "Deny anon access to email_logs" ON public.email_logs;
CREATE POLICY "Deny anon access to email_logs"
    ON public.email_logs FOR ALL TO anon
    USING (false) WITH CHECK (false);

COMMIT;

