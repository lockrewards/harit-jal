-- ====================================================================
-- HARIT JAL™ (हरित जल) — SUPABASE PRODUCTION DATABASE SCHEMA
-- Comprehensive PostgreSQL Schema for Dining Hydration Infrastructure
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------
-- 2. TABLE: STAFF_USERS (Super Admin & Operations Staff Members)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    designation TEXT,
    role TEXT NOT NULL DEFAULT 'staff', -- 'admin' | 'staff'
    permissions JSONB DEFAULT '[]'::jsonb,
    is_blocked BOOLEAN DEFAULT false,
    totp_enabled BOOLEAN DEFAULT true,
    totp_secret TEXT,
    is_first_login BOOLEAN DEFAULT false,
    temporary_password TEXT,
    password_hash TEXT,
    email_phone_changes_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for instant lookups on Email & Phone
CREATE INDEX IF NOT EXISTS idx_staff_email ON public.staff_users(email);
CREATE INDEX IF NOT EXISTS idx_staff_phone ON public.staff_users(phone);

-- --------------------------------------------------------------------
-- 3. TABLE: CUSTOMERS (Restaurant & Dhaba Partner Accounts)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    restaurant_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    password TEXT NOT NULL,
    dpdp_consent BOOLEAN DEFAULT true,
    email_phone_changes_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for restaurant partner queries
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- --------------------------------------------------------------------
-- 4. TABLE: CONSULTATIONS (Free Consultation & Tasting Bookings)
-- --------------------------------------------------------------------
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
    status TEXT DEFAULT 'New', -- 'New' | 'Sample Dispatched' | 'Completed' | 'Cancelled'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultations_status ON public.consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON public.consultations(created_at DESC);

-- --------------------------------------------------------------------
-- 5. TABLE: ORDERS (Custom Luxury Bottle Dispatch & Logistics)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    restaurant_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    phone TEXT NOT NULL,
    bottle_type TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    custom_engraving TEXT,
    status TEXT DEFAULT 'Pending', -- 'Pending' | 'Production' | 'Out for Delivery' | 'Delivered'
    ordered_at TIMESTAMPTZ DEFAULT NOW(),
    expected_delivery TEXT,
    driver_name TEXT,
    driver_phone TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_owner_email ON public.orders(owner_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- --------------------------------------------------------------------
-- 6. TABLE: SECURITY_BLOCKS (Multi-Vector 24h Lockout on ID, Device, IP)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_blocks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    target_key TEXT UNIQUE NOT NULL,
    target_type TEXT NOT NULL, -- 'id' | 'device' | 'ip'
    identifier TEXT NOT NULL,
    reason TEXT NOT NULL,
    source_vector TEXT NOT NULL, -- 'password' | 'otp'
    blocked_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_blocks_target_key ON public.security_blocks(target_key);
CREATE INDEX IF NOT EXISTS idx_security_blocks_blocked_until ON public.security_blocks(blocked_until);

-- --------------------------------------------------------------------
-- 7. TABLE: EMAIL_LOGS (Resend Dispatch & Transactional Audit Trail)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT,
    status TEXT NOT NULL DEFAULT 'Dispatched', -- 'Dispatched' | 'Failed' | 'Local Mock'
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at DESC);

-- --------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable Row Level Security while allowing anon API key access for client ops
-- --------------------------------------------------------------------

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon full operations (controlled by client security layer)
DROP POLICY IF EXISTS "Anon full access staff_users" ON public.staff_users;
CREATE POLICY "Anon full access staff_users" ON public.staff_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon full access customers" ON public.customers;
CREATE POLICY "Anon full access customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon full access consultations" ON public.consultations;
CREATE POLICY "Anon full access consultations" ON public.consultations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon full access orders" ON public.orders;
CREATE POLICY "Anon full access orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon full access security_blocks" ON public.security_blocks;
CREATE POLICY "Anon full access security_blocks" ON public.security_blocks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon full access email_logs" ON public.email_logs;
CREATE POLICY "Anon full access email_logs" ON public.email_logs FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------
-- 9. INITIAL SEED DATA (Super Admin Seed)
-- --------------------------------------------------------------------
INSERT INTO public.staff_users (
    id, name, email, phone, designation, role, permissions, is_blocked, totp_enabled, totp_secret, is_first_login, email_phone_changes_count
) VALUES (
    'admin_seed_001',
    'Atal Pandey',
    'admin@haritjal.in',
    '+916299293497',
    'Super Admin & Managing Director',
    'admin',
    '["orders:read", "orders:write", "inventory:read", "inventory:write", "analytics:read", "staff:manage"]'::jsonb,
    false,
    true,
    'JBSWY3DPEHPK3PXP',
    false,
    0
)
ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    name = EXCLUDED.name,
    designation = EXCLUDED.designation;

-- ====================================================================
-- SUCCESS: Schema created successfully! Ready for Harit Jal™ operations.
-- ====================================================================

