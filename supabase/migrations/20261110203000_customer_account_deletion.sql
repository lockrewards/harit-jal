-- ====================================================================
-- HARIT JAL™ (हरित जल) — 24-Hour Customer Account Deletion Grace Period
-- ====================================================================

-- 1. Add deletion schedule timestamp columns to public.customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deletion_due_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Allow authenticated customers to update deletion columns on their own row
GRANT UPDATE (deletion_scheduled_at, deletion_due_at) ON public.customers TO authenticated;

-- 3. RPC: schedule_customer_account_deletion
CREATE OR REPLACE FUNCTION public.schedule_customer_account_deletion(
    p_customer_id UUID,
    p_due_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_target_due TIMESTAMPTZ := COALESCE(p_due_at, NOW() + INTERVAL '24 hours');
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_customer_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized caller');
    END IF;

    UPDATE public.customers
    SET deletion_scheduled_at = NOW(),
        deletion_due_at = v_target_due,
        updated_at = NOW()
    WHERE id = p_customer_id;

    RETURN jsonb_build_object(
        'success', true,
        'deletion_scheduled_at', NOW(),
        'deletion_due_at', v_target_due
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_customer_account_deletion(UUID, TIMESTAMPTZ) TO authenticated, service_role;

-- 4. RPC: cancel_customer_account_deletion
CREATE OR REPLACE FUNCTION public.cancel_customer_account_deletion(
    p_customer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_customer_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized caller');
    END IF;

    UPDATE public.customers
    SET deletion_scheduled_at = NULL,
        deletion_due_at = NULL,
        updated_at = NOW()
    WHERE id = p_customer_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_customer_account_deletion(UUID) TO authenticated, service_role;
