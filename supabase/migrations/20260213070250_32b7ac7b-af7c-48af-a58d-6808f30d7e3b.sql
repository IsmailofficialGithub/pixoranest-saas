
-- Create enums
CREATE TYPE public.execution_status AS ENUM ('running', 'success', 'error', 'waiting', 'cancelled');
CREATE TYPE public.execution_mode AS ENUM ('manual', 'webhook', 'scheduled', 'trigger');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.notification_type AS ENUM ('info', 'success', 'warning', 'error');

-- 18. Workflow executions
CREATE TABLE public.workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_instance_id UUID NOT NULL REFERENCES public.client_workflow_instances(id) ON DELETE CASCADE,
  n8n_execution_id TEXT,
  client_id UUID REFERENCES public.clients(id),
  service_id UUID REFERENCES public.services(id),
  status execution_status DEFAULT 'running',
  execution_mode execution_mode,
  input_data JSONB DEFAULT '{}'::jsonb,
  output_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  error_stack TEXT,
  duration_ms INTEGER,
  executed_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 19. Usage tracking
CREATE TABLE public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  usage_type TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_cost DECIMAL(10,4),
  total_cost DECIMAL(10,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- 20. Invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES public.admins(id),
  client_id UUID REFERENCES public.clients(id),
  invoice_number TEXT UNIQUE NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status invoice_status DEFAULT 'draft',
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 21. Invoice items
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 22. Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 23. Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type notification_type DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- WORKFLOW_EXECUTIONS RLS
CREATE POLICY "Super admins full access executions" ON public.workflow_executions FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins view their clients executions" ON public.workflow_executions FOR SELECT TO authenticated USING (client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user()));
CREATE POLICY "Clients view own executions" ON public.workflow_executions FOR SELECT TO authenticated USING (client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- USAGE_TRACKING RLS
CREATE POLICY "Super admins full access usage" ON public.usage_tracking FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins view their clients usage" ON public.usage_tracking FOR SELECT TO authenticated USING (client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user()));
CREATE POLICY "Clients view own usage" ON public.usage_tracking FOR SELECT TO authenticated USING (client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- INVOICES RLS
CREATE POLICY "Super admins full access invoices" ON public.invoices FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins view their invoices" ON public.invoices FOR SELECT TO authenticated USING (admin_id = public.get_admin_id_for_user());
CREATE POLICY "Admins create invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = public.get_admin_id_for_user());
CREATE POLICY "Admins update their invoices" ON public.invoices FOR UPDATE TO authenticated USING (admin_id = public.get_admin_id_for_user());
CREATE POLICY "Clients view own invoices" ON public.invoices FOR SELECT TO authenticated USING (client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- INVOICE_ITEMS RLS
CREATE POLICY "Super admins full access invoice items" ON public.invoice_items FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins view their invoice items" ON public.invoice_items FOR SELECT TO authenticated USING (
  invoice_id IN (SELECT id FROM public.invoices WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Admins manage their invoice items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') AND invoice_id IN (SELECT id FROM public.invoices WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Admins update their invoice items" ON public.invoice_items FOR UPDATE TO authenticated USING (
  invoice_id IN (SELECT id FROM public.invoices WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Clients view own invoice items" ON public.invoice_items FOR SELECT TO authenticated USING (
  invoice_id IN (SELECT id FROM public.invoices WHERE client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()))
);

-- AUDIT_LOGS RLS
CREATE POLICY "Super admins full access audit logs" ON public.audit_logs FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Users view own audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (user_id = auth.uid());

-- NOTIFICATIONS RLS
CREATE POLICY "Super admins full access notifications" ON public.notifications FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
