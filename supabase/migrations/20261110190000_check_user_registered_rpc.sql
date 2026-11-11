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

-- ====================================================================
-- 1. Ensure auth_user_id column exists on staff_users
-- ====================================================================
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- ====================================================================
-- 2. Temporarily drop trigger to allow clean admin data reconciliation
-- ====================================================================
DROP TRIGGER IF EXISTS trg_protect_root_super_admin ON public.staff_users;

-- ====================================================================
-- 3. Update protect_root_super_admin function to accept both 'admin' and 'super_admin'
-- ====================================================================
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
        IF (TG_OP = 'UPDATE' AND LOWER(REPLACE(COALESCE(NEW.role, ''), ' ', '_')) NOT IN ('super_admin', 'admin')) THEN
            RAISE EXCEPTION 'Security Violation: Root Super Admin role cannot be downgraded.';
        END IF;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

-- ====================================================================
-- 4. Fix Staff Read Own Record RLS Policy (removes AAL2 deadlock at login)
-- ====================================================================
DROP POLICY IF EXISTS "Staff can read own record" ON public.staff_users;
CREATE POLICY "Staff can read own record"
    ON public.staff_users FOR SELECT TO authenticated
    USING (
        (auth.uid()::text = id OR auth_user_id = auth.uid())
        AND is_blocked IS NOT TRUE
        AND ((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)
        AND ((auth.jwt()->'app_metadata'->>'role') IN (
            'super_admin', 'Super Admin', 'admin', 'staff', 'Staff',
            'sales_manager', 'Sales Manager', 'operations_lead', 'Operations Lead',
            'label_designer', 'Label Designer'
        ))
    );

-- ====================================================================
-- 5. Link info@haritjal.in in auth.users and staff_users (Dynamic SQL to avoid 42703)
-- ====================================================================
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Ensure column exists dynamically first
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'staff_users' 
          AND column_name = 'auth_user_id'
    ) THEN
        EXECUTE 'ALTER TABLE public.staff_users ADD COLUMN auth_user_id UUID';
    END IF;

    SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = 'info@haritjal.in' LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        -- A. Update app_metadata in auth.users
        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
            'role', 'admin',
            'is_root_super_admin', true,
            'is_blocked', false,
            'permissions', jsonb_build_array('all', 'leads', 'orders', 'inventory', 'pricing', 'staff', 'audit_logs')
        )
        WHERE id = v_user_id;

        -- B. If another row was previously root, clear its root flag so unique index doesn't conflict
        UPDATE public.staff_users
        SET is_root_super_admin = false
        WHERE LOWER(email) <> 'info@haritjal.in' AND is_root_super_admin = true;

        -- C. Update or Insert info@haritjal.in in public.staff_users using dynamic SQL
        IF EXISTS (SELECT 1 FROM public.staff_users WHERE LOWER(email) = 'info@haritjal.in') THEN
            EXECUTE 'UPDATE public.staff_users
            SET auth_user_id = $1,
                role = ''admin'',
                is_root_super_admin = true,
                is_blocked = false,
                permissions = ''["all", "leads", "orders", "inventory", "pricing", "staff", "audit_logs"]''::jsonb,
                updated_at = NOW()
            WHERE LOWER(email) = ''info@haritjal.in''' USING v_user_id;
        ELSE
            EXECUTE 'INSERT INTO public.staff_users (
                id,
                auth_user_id,
                name,
                email,
                phone,
                designation,
                role,
                permissions,
                is_blocked,
                is_root_super_admin,
                totp_enabled,
                is_first_login,
                created_at,
                updated_at
            ) VALUES (
                $1::text,
                $1,
                ''Harit Jal Admin'',
                ''info@haritjal.in'',
                ''+916299293497'',
                ''Founder & Operations Director'',
                ''admin'',
                ''["all", "leads", "orders", "inventory", "pricing", "staff", "audit_logs"]''::jsonb,
                false,
                true,
                false,
                false,
                NOW(),
                NOW()
            )' USING v_user_id;
        END IF;
    END IF;
END $$;

-- ====================================================================
-- 6. Re-attach trigger
-- ====================================================================
DROP TRIGGER IF EXISTS trg_protect_root_super_admin ON public.staff_users;
CREATE TRIGGER trg_protect_root_super_admin
    BEFORE UPDATE OR DELETE ON public.staff_users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_root_super_admin();

-- ====================================================================
-- 7. RPC: resolve_phone_login_email
-- ====================================================================
CREATE OR REPLACE FUNCTION public.resolve_phone_login_email(
    p_phone TEXT,
    p_account_type TEXT DEFAULT 'partner'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_clean_phone TEXT := REGEXP_REPLACE(COALESCE(p_phone, ''), '\D', '', 'g');
    v_digits10 TEXT;
    v_email TEXT := NULL;
    v_is_blocked BOOLEAN := FALSE;
BEGIN
    IF LENGTH(v_clean_phone) >= 10 THEN
        v_digits10 := RIGHT(v_clean_phone, 10);
    ELSE
        RETURN jsonb_build_object('found', false, 'error', 'Invalid mobile number');
    END IF;

    -- Check in customers table
    IF LOWER(COALESCE(p_account_type, 'partner')) = 'partner' THEN
        SELECT email INTO v_email
        FROM public.customers
        WHERE RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 10) = v_digits10
        LIMIT 1;
    END IF;

    -- Check in staff_users table
    IF v_email IS NULL THEN
        SELECT email, is_blocked INTO v_email, v_is_blocked
        FROM public.staff_users
        WHERE RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 10) = v_digits10
        LIMIT 1;

        IF v_is_blocked THEN
            RETURN jsonb_build_object(
                'found', true,
                'is_blocked', true,
                'error', 'Account has been blocked or suspended by Administrator.'
            );
        END IF;
    END IF;

    IF v_email IS NOT NULL AND v_email <> '' THEN
        RETURN jsonb_build_object(
            'found', true,
            'email', LOWER(TRIM(v_email)),
            'is_blocked', false
        );
    END IF;

    RETURN jsonb_build_object('found', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_phone_login_email(TEXT, TEXT) TO anon, authenticated, service_role;
