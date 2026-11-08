-- ====================================================================
-- HARIT JAL™ (हरित जल) — SUPABASE POSTGRESQL PRODUCTION SCHEMA
-- Complete Data Architecture, Row Level Security (RLS) & Triggers
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS & DOMAINS
CREATE TYPE user_role AS ENUM (
  'customer',
  'super_admin',
  'sales_manager',
  'operations_lead',
  'label_designer'
);

CREATE TYPE booking_status AS ENUM (
  'New',
  'Call Scheduled',
  'Sample Dispatched',
  'Active Client',
  'Follow Up'
);

CREATE TYPE order_status AS ENUM (
  'Order Confirmed',
  'Bottling & BIS Testing',
  'Dispatched (Out for Delivery)',
  'Delivered to Restaurant'
);

-- ====================================================================
-- 3. TABLES DEFINITION
-- ====================================================================

-- 3.1 CUSTOMER PROFILES (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role DEFAULT 'customer' NOT NULL,
  restaurant_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.2 STAFF DIRECTORY & ROLES
CREATE TABLE IF NOT EXISTS public.staff_members (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL CHECK (role IN ('super_admin', 'sales_manager', 'operations_lead', 'label_designer')),
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'On Leave', 'Inactive')),
  inquiries_assigned INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.3 CALL BOOKINGS & CRM INQUIRIES
CREATE TABLE IF NOT EXISTS public.call_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inquiry_code TEXT UNIQUE NOT NULL, -- e.g. HJ-2026-081
  restaurant_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT NOT NULL,
  bottle_size TEXT NOT NULL, -- 250ml, 500ml, 750ml_glass, 1000ml
  monthly_volume INT DEFAULT 1200 NOT NULL,
  cap_color TEXT DEFAULT 'royal_gold',
  label_style TEXT DEFAULT 'classic_luxury',
  preferred_datetime TEXT NOT NULL,
  notes TEXT,
  status booking_status DEFAULT 'New' NOT NULL,
  assigned_to UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  synced_to_sheets BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.4 CUSTOMER ORDERS (B2B Recurring Restocking)
CREATE TABLE IF NOT EXISTS public.customer_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL, -- e.g. ORD-HJ-8910
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  restaurant_name TEXT NOT NULL,
  bottle_size TEXT NOT NULL,
  case_count INT NOT NULL CHECK (case_count > 0),
  bottles_total INT NOT NULL CHECK (bottles_total > 0),
  rate_per_bottle NUMERIC(10, 2) NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  status order_status DEFAULT 'Order Confirmed' NOT NULL,
  driver_name TEXT,
  driver_phone TEXT,
  delivery_address TEXT NOT NULL,
  notes TEXT,
  ordered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expected_delivery TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.5 BOTTLE & PRODUCT CATALOG (Flint Glass & Recyclable Line)
CREATE TABLE IF NOT EXISTS public.gallery_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  gallery_urls TEXT[] DEFAULT '{}',
  category TEXT NOT NULL, -- 'glass', 'flint', 'fluted', 'decanter', 'pocket', 'family'
  categories TEXT[] DEFAULT '{}',
  size TEXT NOT NULL, -- '250ml', '500ml', '750ml', '1000ml'
  material TEXT NOT NULL,
  cap_color TEXT NOT NULL,
  wholesale_rate NUMERIC(10, 2) NOT NULL,
  recommended_mrp NUMERIC(10, 2) NOT NULL,
  badge TEXT DEFAULT 'Signature',
  is_visible BOOLEAN DEFAULT TRUE NOT NULL,
  sort_order INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.6 NEER AI VERIFIED KNOWLEDGE BASE
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL, -- 'product', 'pricing', 'compliance', 'sustainability', 'general'
  title TEXT NOT NULL,
  keywords TEXT[] NOT NULL,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'Harit Jal B2B Admin Desk' NOT NULL,
  verified BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.7 SYSTEM INTEGRATION & SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.8 EMAIL DISPATCH AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ====================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if authenticated user is active staff
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE staff_members.id = auth.uid()
    AND staff_members.status = 'Active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.1 PROFILES POLICIES
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Staff can view all customer profiles" 
ON public.profiles FOR SELECT 
USING (public.is_active_staff());

-- 4.2 STAFF DIRECTORY POLICIES
CREATE POLICY "Staff can view staff directory" 
ON public.staff_members FOR SELECT 
USING (public.is_active_staff());

CREATE POLICY "Super admin can manage staff" 
ON public.staff_members FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.staff_members
  WHERE id = auth.uid() AND role = 'super_admin' AND status = 'Active'
));

-- 4.3 CALL BOOKINGS POLICIES
CREATE POLICY "Public can submit new consultation inquiry" 
ON public.call_bookings FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Staff can view and update all inquiries" 
ON public.call_bookings FOR ALL 
USING (public.is_active_staff());

CREATE POLICY "Customers can view own inquiries by email" 
ON public.call_bookings FOR SELECT 
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 4.4 CUSTOMER ORDERS POLICIES
CREATE POLICY "Customers view own orders" 
ON public.customer_orders FOR SELECT 
USING (auth.uid() = customer_id);

CREATE POLICY "Customers insert own orders" 
ON public.customer_orders FOR INSERT 
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Staff manage all orders" 
ON public.customer_orders FOR ALL 
USING (public.is_active_staff());

-- 4.5 GALLERY PRODUCTS POLICIES
CREATE POLICY "Public can view visible products" 
ON public.gallery_products FOR SELECT 
USING (is_visible = true);

CREATE POLICY "Staff manage all gallery products" 
ON public.gallery_products FOR ALL 
USING (public.is_active_staff());

-- 4.6 KNOWLEDGE BASE POLICIES
CREATE POLICY "Public can read verified knowledge" 
ON public.knowledge_base FOR SELECT 
USING (verified = true);

CREATE POLICY "Staff manage knowledge base" 
ON public.knowledge_base FOR ALL 
USING (public.is_active_staff());

-- 4.7 SYSTEM SETTINGS & EMAIL LOGS
CREATE POLICY "Staff can manage system settings" 
ON public.system_settings FOR ALL 
USING (public.is_active_staff());

CREATE POLICY "Staff can read email logs" 
ON public.email_logs FOR SELECT 
USING (public.is_active_staff());

-- ====================================================================
-- 5. AUTOMATIC TRIGGERS & FUNCTIONS
-- ====================================================================

-- Function: Automatic updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_timestamp BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_staff_timestamp BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_bookings_timestamp BEFORE UPDATE ON public.call_bookings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_orders_timestamp BEFORE UPDATE ON public.customer_orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_gallery_timestamp BEFORE UPDATE ON public.gallery_products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_kb_timestamp BEFORE UPDATE ON public.knowledge_base FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function: New user profile creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, restaurant_name, owner_name, phone, city, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'Valued Restaurant Partner'),
    COALESCE(NEW.raw_user_meta_data->>'owner_name', 'Partner Owner'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'city', 'India'),
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ====================================================================
-- 6. SUPABASE STORAGE BUCKETS SETUP (Execute in Supabase SQL editor)
-- ====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('bottle-catalog', 'bottle-catalog', true),
  ('customer-crests', 'customer-crests', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Public read for bottle images
CREATE POLICY "Public read for bottle images"
ON storage.objects FOR SELECT
USING (bucket_id = 'bottle-catalog');

-- Storage Policy: Staff upload to bottle catalog
CREATE POLICY "Staff upload bottle images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'bottle-catalog' 
  AND public.is_active_staff()
);

-- Storage Policy: Customer crests isolation
CREATE POLICY "Customer crest access"
ON storage.objects FOR ALL
USING (
  bucket_id = 'customer-crests' 
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_active_staff())
);

