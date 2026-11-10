-- ====================================================================
-- HARIT JAL™ (हरित जल) — SUPABASE AUTH & CUSTOMER DATABASE SYNC
-- Migration: 20261108_customer_supabase_auth_sync.sql
-- Enforces:
-- 1. UUID primary key referencing auth.users(id) ON DELETE CASCADE
-- 2. Removal of all password / password_hash columns from public.customers
-- 3. Automatic synchronization trigger from auth.users to public.customers
-- 4. Strict Row Level Security (RLS) isolating customer profiles
-- ====================================================================

BEGIN;

-- 1. Eliminate plaintext/hash password columns from public.customers
-- Passwords are encrypted and managed internally by Supabase Auth (auth.users)
ALTER TABLE IF EXISTS public.customers DROP COLUMN IF EXISTS password;
ALTER TABLE IF EXISTS public.customers DROP COLUMN IF EXISTS password_hash;

-- 2. Ensure public.customers table structure conforms to auth.users UUID relationship
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'id' AND data_type = 'text'
  ) THEN
    ALTER TABLE public.customers ALTER COLUMN id TYPE UUID USING (
      CASE 
        WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid 
        ELSE gen_random_uuid() 
      END
    );
  END IF;
END $$;

-- Index for restaurant partner queries
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- 3. Create or replace the automatic profile creation trigger function
-- Runs with SECURITY DEFINER so it can insert profile upon auth.signUp
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

  -- Insert a profile record in public.customers corresponding to auth.users.id
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

-- 4. Attach trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;
CREATE TRIGGER on_auth_user_created_customer
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

-- 5. Row Level Security Hardening on public.customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can register customer account" ON public.customers;
DROP POLICY IF EXISTS "Anon full access customers" ON public.customers;
DROP POLICY IF EXISTS "Customer can read own profile" ON public.customers;
DROP POLICY IF EXISTS "Customer can update own profile" ON public.customers;
DROP POLICY IF EXISTS "Deny anon access to customers" ON public.customers;

-- Disallow direct unauthenticated access to public.customers
CREATE POLICY "Deny anon access to customers"
  ON public.customers FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Customer can insert own profile" ON public.customers;
CREATE POLICY "Customer can insert own profile"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid()::text = id::text)
    AND ((auth.jwt()->'app_metadata'->>'role') IS NULL OR (auth.jwt()->'app_metadata'->>'role') = 'customer')
  );

-- Customers can read ONLY their own record where auth.uid() matches id
CREATE POLICY "Customer can read own profile"
  ON public.customers FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

-- Customers can update ONLY their own record where auth.uid() matches id
CREATE POLICY "Customer can update own profile"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

COMMIT;

