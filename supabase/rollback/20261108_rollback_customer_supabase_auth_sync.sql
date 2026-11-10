-- ====================================================================
-- HARIT JAL™ (हरित जल) — ROLLBACK: SUPABASE AUTH CUSTOMER TRIGGER
-- Stored safely outside `supabase/migrations/` in `supabase/rollback/`.
-- Drops `on_auth_user_created_customer` trigger if operator must pause
-- trigger sync while retaining tenant-isolated customer RLS policies.
-- ====================================================================

BEGIN;

DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_customer();

DROP POLICY IF EXISTS "Anon can register customer account" ON public.customers;
DROP POLICY IF EXISTS "Anon full access customers" ON public.customers;
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

COMMIT;

