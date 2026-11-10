-- ====================================================================
-- HARIT JAL™ (हरित जल) — ROLLBACK SCRIPT: 20261109_rollback_phase1h6_security_remediation
-- Stored safely outside `supabase/migrations/` in `supabase/rollback/`.
-- Security Guarantee:
--   Reverts Phase 1H.6 incremental policy/table additions if emergency
--   rollback is required WITHOUT ever re-granting unsafe `anon` EXECUTE
--   on `record_security_block`, `check_security_block`, or `append_email_audit_log`
--   and WITHOUT ever introducing permissive `USING (true)` policies.
-- ====================================================================

BEGIN;

-- 1. Drop Phase 1H.6 triggers before dropping functions
DROP TRIGGER IF EXISTS trg_sanitize_consultation_insert_claims ON public.consultations;
DROP FUNCTION IF EXISTS public.sanitize_consultation_insert_claims();

DROP TRIGGER IF EXISTS trg_protect_customer_profile_columns ON public.customers;
DROP FUNCTION IF EXISTS public.protect_customer_profile_columns();

-- 2. Restore Phase 1H.4 customer email sync function (preserving fixed search_path)
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

-- 3. Drop Phase 1H.6 atomic Edge RPCs & keep security RPCs restricted to service_role
DROP FUNCTION IF EXISTS public.verify_otp_challenge_attempt(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.consume_edge_rate_limit(TEXT, INT, INT);
DROP FUNCTION IF EXISTS public.db_health_ping();

-- IMPORTANT: Do NOT re-grant anon/authenticated EXECUTE on security block or email audit RPCs during rollback.
REVOKE ALL ON FUNCTION public.record_security_block(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_security_block(TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.append_email_audit_log(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- 4. Restore Phase 1H.4 non-recursive RLS baseline before removing staff_has_permission
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
    );

DROP POLICY IF EXISTS "Staff can read consultations" ON public.consultations;
DROP POLICY IF EXISTS "Staff can update consultations" ON public.consultations;
DROP POLICY IF EXISTS "Super Admin can delete consultations" ON public.consultations;
DROP POLICY IF EXISTS "Staff can manage consultations" ON public.consultations;
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
    );

DROP POLICY IF EXISTS "Admin read security_blocks" ON public.security_blocks;
CREATE POLICY "Admin read security_blocks"
    ON public.security_blocks FOR SELECT TO authenticated
    USING (
        ((auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'Super Admin', 'admin'))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    );

DROP POLICY IF EXISTS "Admin can read email audit logs" ON public.email_logs;
CREATE POLICY "Admin can read email audit logs"
    ON public.email_logs FOR SELECT TO authenticated
    USING (
        ((auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'Super Admin', 'admin'))
        AND ((auth.jwt()->>'aal') = 'aal2')
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND public.is_caller_active_staff()
    );

DROP FUNCTION IF EXISTS public.staff_has_permission(TEXT);

-- 5. Optionally retain columns safely or drop temporary Edge tables
DROP TABLE IF EXISTS public.otp_challenges;
DROP TABLE IF EXISTS public.edge_rate_limits;

COMMIT;

