-- ====================================================================
-- HARIT JAL™ (हरित जल) — SECURITY MIGRATION: 20261108_harden_rls_policies
-- Remediated in Phase 1H.4 to Eliminate:
--   1. Top-level `auth.jwt()->>'role'` bugs
--   2. `auth.uid()::text = id` UUID mismatch on `public.customers`
--   3. Open `anon` access to `security_blocks` / `email_logs` / `customers`
--   4. PostgreSQL `42P17` RLS recursion via `public.is_caller_active_staff()`
-- ====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. ENSURE CORE TABLES EXIST IF REPLAYED ON AN EMPTY DATABASE
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

CREATE TABLE IF NOT EXISTS public.staff_secrets (
    user_id TEXT PRIMARY KEY REFERENCES public.staff_users(id) ON DELETE CASCADE,
    password_hash TEXT,
    temporary_password_hash TEXT,
    temporary_password_expires_at TIMESTAMPTZ,
    totp_secret TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    target_user_email TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 1. DROP ALL INSECURE OR STALE POLICIES
DROP POLICY IF EXISTS "Anon full access staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Deny anon access to staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Admin full access to staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Super Admin full access to staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Staff can read own record" ON public.staff_users;

DROP POLICY IF EXISTS "Anon full access customers" ON public.customers;
DROP POLICY IF EXISTS "Anon can register customer account" ON public.customers;
DROP POLICY IF EXISTS "Deny anon access to customers" ON public.customers;
DROP POLICY IF EXISTS "Customer can read own profile" ON public.customers;
DROP POLICY IF EXISTS "Customer can insert own profile" ON public.customers;
DROP POLICY IF EXISTS "Customer can update own profile" ON public.customers;

DROP POLICY IF EXISTS "Anon full access orders" ON public.orders;
DROP POLICY IF EXISTS "Anon can place order" ON public.orders;
DROP POLICY IF EXISTS "Customer can place own order" ON public.orders;
DROP POLICY IF EXISTS "Deny anon read orders" ON public.orders;
DROP POLICY IF EXISTS "Customer can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update order status" ON public.orders;

DROP POLICY IF EXISTS "Anon full access consultations" ON public.consultations;
DROP POLICY IF EXISTS "Public can book tasting consultation" ON public.consultations;
DROP POLICY IF EXISTS "Customer can book tasting consultation" ON public.consultations;
DROP POLICY IF EXISTS "Deny anon read consultations" ON public.consultations;
DROP POLICY IF EXISTS "Customer can view own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Staff can manage consultations" ON public.consultations;

DROP POLICY IF EXISTS "Anon full access security_blocks" ON public.security_blocks;
DROP POLICY IF EXISTS "Anon can view and record security blocks" ON public.security_blocks;
DROP POLICY IF EXISTS "Anon can record security block entry" ON public.security_blocks;
DROP POLICY IF EXISTS "Deny anon access to security_blocks" ON public.security_blocks;
DROP POLICY IF EXISTS "Admin read security_blocks" ON public.security_blocks;

DROP POLICY IF EXISTS "Anon full access email_logs" ON public.email_logs;
DROP POLICY IF EXISTS "Anon can append email audit log" ON public.email_logs;
DROP POLICY IF EXISTS "Deny anon access to email_logs" ON public.email_logs;
DROP POLICY IF EXISTS "Admin can read email audit logs" ON public.email_logs;

DROP POLICY IF EXISTS "Deny all client access to staff_secrets" ON public.staff_secrets;
DROP POLICY IF EXISTS "Deny anon access to staff_audit_logs" ON public.staff_audit_logs;
DROP POLICY IF EXISTS "Admin full access to staff_audit_logs" ON public.staff_audit_logs;
DROP POLICY IF EXISTS "Super Admin full access to staff_audit_logs" ON public.staff_audit_logs;

-- Ensure RLS is active on all tables
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- 2. NON-RECURSIVE SECURITY DEFINER PREDICATE
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

-- 3. HARDENED NON-RECURSIVE POLICIES

-- STAFF_SECRETS
CREATE POLICY "Deny all client access to staff_secrets"
    ON public.staff_secrets FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);
REVOKE ALL ON public.staff_secrets FROM anon, authenticated, public;

-- STAFF_AUDIT_LOGS
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

-- STAFF_USERS
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

-- CUSTOMERS (UUID-safe `auth.uid() = id`)
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

-- ORDERS
CREATE POLICY "Anon can place order"
    ON public.orders FOR INSERT TO anon
    WITH CHECK (owner_email IS NOT NULL AND restaurant_name IS NOT NULL AND quantity > 0);

CREATE POLICY "Customer can place own order"
    ON public.orders FOR INSERT TO authenticated
    WITH CHECK (
        (LOWER(auth.jwt()->>'email') = LOWER(owner_email)) AND
        restaurant_name IS NOT NULL AND
        quantity > 0
    );

CREATE POLICY "Deny anon read orders"
    ON public.orders FOR SELECT TO anon USING (false);

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

-- CONSULTATIONS
CREATE POLICY "Public can book tasting consultation"
    ON public.consultations FOR INSERT TO anon
    WITH CHECK (phone IS NOT NULL AND restaurant_name IS NOT NULL AND email IS NOT NULL);

CREATE POLICY "Customer can book tasting consultation"
    ON public.consultations FOR INSERT TO authenticated
    WITH CHECK (phone IS NOT NULL AND restaurant_name IS NOT NULL AND email IS NOT NULL);

CREATE POLICY "Deny anon read consultations"
    ON public.consultations FOR SELECT TO anon USING (false);

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

-- SECURITY_BLOCKS & EMAIL_LOGS
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

COMMIT;
