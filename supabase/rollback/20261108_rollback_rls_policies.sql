-- ====================================================================
-- HARIT JAL™ (हरित जल) — ROLLBACK SCRIPT: 20261108_rollback_rls_policies
-- Stored safely outside `supabase/migrations/` in `supabase/rollback/`
-- so `supabase db push` never replays rollback scripts automatically.
-- Security Guarantee: Restores hardened non-recursive RLS baseline;
-- NEVER reintroduces permissive `FOR ALL USING (true)` policies.
-- ====================================================================

BEGIN;

-- 1. ENSURE RLS REMAINS STRICTLY ACTIVE ACROSS ALL 8 TABLES
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- 2. ENSURE NON-RECURSIVE HELPER EXISTS
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

-- 3. DROP ANY TEMPORARY OR DRIFTED POLICIES AND RE-APPLY HARDENED BASELINE
DROP POLICY IF EXISTS "Anon full access staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Deny anon access to staff_users" ON public.staff_users;
CREATE POLICY "Deny anon access to staff_users"
    ON public.staff_users FOR ALL TO anon
    USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Super Admin full access to staff_users" ON public.staff_users;
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

DROP POLICY IF EXISTS "Anon full access customers" ON public.customers;
DROP POLICY IF EXISTS "Deny anon access to customers" ON public.customers;
CREATE POLICY "Deny anon access to customers"
    ON public.customers FOR ALL TO anon
    USING (false) WITH CHECK (false);

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
        )
    );

DROP POLICY IF EXISTS "Anon full access security_blocks" ON public.security_blocks;
DROP POLICY IF EXISTS "Deny anon access to security_blocks" ON public.security_blocks;
CREATE POLICY "Deny anon access to security_blocks"
    ON public.security_blocks FOR ALL TO anon
    USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Anon full access email_logs" ON public.email_logs;
DROP POLICY IF EXISTS "Deny anon access to email_logs" ON public.email_logs;
CREATE POLICY "Deny anon access to email_logs"
    ON public.email_logs FOR ALL TO anon
    USING (false) WITH CHECK (false);

COMMIT;

