
-- Create enums for new tables
CREATE TYPE public.reset_period AS ENUM ('daily', 'weekly', 'monthly', 'never');
CREATE TYPE public.workflow_status AS ENUM ('pending', 'configured', 'active', 'error', 'suspended');
CREATE TYPE public.credential_status AS ENUM ('pending', 'configured', 'expired', 'invalid');

-- 6. Admin pricing table
CREATE TABLE public.admin_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  markup_percentage DECIMAL(5,2) DEFAULT 0,
  custom_price_per_unit DECIMAL(10,2),
  is_custom_pricing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (admin_id, service_id)
);

-- 7. Client services table
CREATE TABLE public.client_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.service_plans(id),
  is_active BOOLEAN DEFAULT true,
  usage_limit INTEGER NOT NULL DEFAULT 0,
  usage_consumed INTEGER DEFAULT 0,
  reset_period reset_period DEFAULT 'monthly',
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES public.admins(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, service_id)
);

-- 8. Workflow templates table
CREATE TABLE public.workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  n8n_template_workflow_id TEXT UNIQUE,
  template_description TEXT,
  required_credentials TEXT[] DEFAULT '{}',
  credential_instructions JSONB DEFAULT '{}'::jsonb,
  default_config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  version TEXT DEFAULT '1.0',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Client workflow instances table
CREATE TABLE public.client_workflow_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  workflow_template_id UUID REFERENCES public.workflow_templates(id),
  n8n_workflow_id TEXT UNIQUE NOT NULL,
  workflow_name TEXT NOT NULL,
  webhook_url TEXT,
  test_webhook_url TEXT,
  is_active BOOLEAN DEFAULT false,
  status workflow_status DEFAULT 'pending',
  custom_config JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  last_executed_at TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, service_id)
);

-- 10. Client workflow credentials table
CREATE TABLE public.client_workflow_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_workflow_instance_id UUID NOT NULL REFERENCES public.client_workflow_instances(id) ON DELETE CASCADE,
  credential_name TEXT NOT NULL,
  credential_type TEXT NOT NULL,
  n8n_credential_id TEXT,
  credential_status credential_status DEFAULT 'pending',
  configured_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apply updated_at triggers
CREATE TRIGGER update_admin_pricing_updated_at BEFORE UPDATE ON public.admin_pricing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_services_updated_at BEFORE UPDATE ON public.client_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workflow_templates_updated_at BEFORE UPDATE ON public.workflow_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_workflow_instances_updated_at BEFORE UPDATE ON public.client_workflow_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_workflow_credentials_updated_at BEFORE UPDATE ON public.client_workflow_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.admin_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_workflow_credentials ENABLE ROW LEVEL SECURITY;

-- ADMIN_PRICING RLS
CREATE POLICY "Super admins can manage all admin pricing" ON public.admin_pricing FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins can view own pricing" ON public.admin_pricing FOR SELECT TO authenticated USING (admin_id = public.get_admin_id_for_user());
CREATE POLICY "Admins can manage own pricing" ON public.admin_pricing FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = public.get_admin_id_for_user());
CREATE POLICY "Admins can update own pricing" ON public.admin_pricing FOR UPDATE TO authenticated USING (admin_id = public.get_admin_id_for_user()) WITH CHECK (admin_id = public.get_admin_id_for_user());

-- CLIENT_SERVICES RLS
CREATE POLICY "Super admins can manage all client services" ON public.client_services FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins can view their clients services" ON public.client_services FOR SELECT TO authenticated USING (
  assigned_by = public.get_admin_id_for_user() OR client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Admins can assign services to their clients" ON public.client_services FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') AND client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Admins can update their clients services" ON public.client_services FOR UPDATE TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Clients can view own services" ON public.client_services FOR SELECT TO authenticated USING (
  client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- WORKFLOW_TEMPLATES RLS
CREATE POLICY "Anyone authenticated can view active templates" ON public.workflow_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage templates" ON public.workflow_templates FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- CLIENT_WORKFLOW_INSTANCES RLS
CREATE POLICY "Super admins can manage all workflow instances" ON public.client_workflow_instances FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins can view their clients workflow instances" ON public.client_workflow_instances FOR SELECT TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Admins can manage their clients workflow instances" ON public.client_workflow_instances FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') AND client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Admins can update their clients workflow instances" ON public.client_workflow_instances FOR UPDATE TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Clients can view own workflow instances" ON public.client_workflow_instances FOR SELECT TO authenticated USING (
  client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- CLIENT_WORKFLOW_CREDENTIALS RLS
CREATE POLICY "Super admins can manage all credentials" ON public.client_workflow_credentials FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins can view their clients credentials" ON public.client_workflow_credentials FOR SELECT TO authenticated USING (
  client_workflow_instance_id IN (
    SELECT cwi.id FROM public.client_workflow_instances cwi
    JOIN public.clients c ON cwi.client_id = c.id
    WHERE c.admin_id = public.get_admin_id_for_user()
  )
);
CREATE POLICY "Admins can manage their clients credentials" ON public.client_workflow_credentials FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') AND client_workflow_instance_id IN (
    SELECT cwi.id FROM public.client_workflow_instances cwi
    JOIN public.clients c ON cwi.client_id = c.id
    WHERE c.admin_id = public.get_admin_id_for_user()
  )
);
CREATE POLICY "Admins can update their clients credentials" ON public.client_workflow_credentials FOR UPDATE TO authenticated USING (
  client_workflow_instance_id IN (
    SELECT cwi.id FROM public.client_workflow_instances cwi
    JOIN public.clients c ON cwi.client_id = c.id
    WHERE c.admin_id = public.get_admin_id_for_user()
  )
);
CREATE POLICY "Clients can view own credentials" ON public.client_workflow_credentials FOR SELECT TO authenticated USING (
  client_workflow_instance_id IN (
    SELECT id FROM public.client_workflow_instances WHERE client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);
