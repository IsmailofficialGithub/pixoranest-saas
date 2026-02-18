
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'client');

-- Create company_size enum
CREATE TYPE public.company_size AS ENUM ('1-10', '11-50', '51-200', '201-500', '500+');

-- Create service_category enum
CREATE TYPE public.service_category AS ENUM ('voice', 'messaging', 'social_media');

-- Create pricing_model enum
CREATE TYPE public.pricing_model AS ENUM ('per_minute', 'per_call', 'per_message', 'monthly');

-- Create plan_tier enum
CREATE TYPE public.plan_tier AS ENUM ('basic', 'standard', 'premium', 'enterprise');

-- 1. Profiles table (replaces custom users table - auth is handled by Supabase Auth)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- 3. Admins table (resellers)
CREATE TABLE public.admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_website TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  secondary_color TEXT DEFAULT '#10B981',
  custom_domain TEXT,
  commission_rate DECIMAL(5,2) DEFAULT 20.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_clients INTEGER DEFAULT 0,
  monthly_revenue DECIMAL(10,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.admins(id),
  company_name TEXT NOT NULL,
  industry TEXT,
  company_size company_size,
  allow_admin_raw_access BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  onboarded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  category service_category NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  base_pricing_model pricing_model NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  setup_instructions TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Service plans table
CREATE TABLE public.service_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  plan_tier plan_tier,
  usage_limit INTEGER,
  price_per_unit DECIMAL(10,2),
  monthly_price DECIMAL(10,2),
  features_included JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON public.admins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer function to check roles (bypasses RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if current user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
$$;

-- Helper: get admin_id for current user
CREATE OR REPLACE FUNCTION public.get_admin_id_for_user()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.admins WHERE user_id = auth.uid()
$$;

-- Helper: get admin_id for a client user
CREATE OR REPLACE FUNCTION public.get_client_admin_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT admin_id FROM public.clients WHERE user_id = auth.uid()
$$;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_plans ENABLE ROW LEVEL SECURITY;

-- ===== RLS POLICIES =====

-- PROFILES
CREATE POLICY "Super admins can do everything with profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view their clients profiles" ON public.profiles FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') AND user_id IN (
    SELECT c.user_id FROM public.clients c WHERE c.admin_id = public.get_admin_id_for_user()
  )
);

-- USER_ROLES
CREATE POLICY "Super admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ADMINS
CREATE POLICY "Super admins can manage all admins" ON public.admins FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins can view own record" ON public.admins FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can update own record" ON public.admins FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- CLIENTS
CREATE POLICY "Super admins can manage all clients" ON public.clients FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins can view their clients" ON public.clients FOR SELECT TO authenticated USING (admin_id = public.get_admin_id_for_user());
CREATE POLICY "Admins can create clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') AND admin_id = public.get_admin_id_for_user()
);
CREATE POLICY "Admins can update their clients" ON public.clients FOR UPDATE TO authenticated USING (admin_id = public.get_admin_id_for_user()) WITH CHECK (admin_id = public.get_admin_id_for_user());
CREATE POLICY "Clients can view own record" ON public.clients FOR SELECT TO authenticated USING (user_id = auth.uid());

-- SERVICES
CREATE POLICY "Anyone authenticated can view active services" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage services" ON public.services FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- SERVICE_PLANS
CREATE POLICY "Anyone authenticated can view active plans" ON public.service_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage plans" ON public.service_plans FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
