-- ====================================================================
-- HARIT JAL™ (हरित जल) — RPC: check_user_registered
-- Purpose: Safely check if an email or 10-digit mobile number is already
-- registered in auth.users or public.customers without leaking identities.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.check_user_registered(
    p_email TEXT,
    p_phone TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_clean_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
    v_clean_phone TEXT := REGEXP_REPLACE(COALESCE(p_phone, ''), '\D', '', 'g');
    v_found_email BOOLEAN := FALSE;
    v_found_phone BOOLEAN := FALSE;
BEGIN
    IF LENGTH(v_clean_phone) >= 10 THEN
        v_clean_phone := RIGHT(v_clean_phone, 10);
    ELSE
        v_clean_phone := '';
    END IF;

    -- 1. Check in auth.users by email
    IF v_clean_email <> '' THEN
        SELECT EXISTS (
            SELECT 1 FROM auth.users WHERE LOWER(email) = v_clean_email
        ) INTO v_found_email;
    END IF;

    -- 2. Check in public.customers by email
    IF NOT v_found_email AND v_clean_email <> '' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.customers WHERE LOWER(email) = v_clean_email
        ) INTO v_found_email;
    END IF;

    -- 3. Check in public.customers by phone
    IF v_clean_phone <> '' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.customers 
            WHERE RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 10) = v_clean_phone
        ) INTO v_found_phone;
    END IF;

    IF v_found_email OR v_found_phone THEN
        RETURN jsonb_build_object(
            'registered', true,
            'by_email', v_found_email,
            'by_phone', v_found_phone
        );
    END IF;

    RETURN jsonb_build_object('registered', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_registered(TEXT, TEXT) TO anon, authenticated, service_role;

