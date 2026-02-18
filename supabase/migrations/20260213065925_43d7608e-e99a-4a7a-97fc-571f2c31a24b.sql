
-- Create enums for voice services
CREATE TYPE public.call_type AS ENUM ('inbound', 'outbound');
CREATE TYPE public.call_status AS ENUM ('initiated', 'ringing', 'answered', 'busy', 'no_answer', 'failed', 'completed');
CREATE TYPE public.campaign_type AS ENUM ('telecaller', 'receptionist', 'voice_agent');
CREATE TYPE public.campaign_status AS ENUM ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled');
CREATE TYPE public.contact_call_status AS ENUM ('pending', 'calling', 'answered', 'busy', 'failed', 'completed');
CREATE TYPE public.lead_source AS ENUM ('voice_agent', 'telecaller', 'receptionist', 'manual');
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');

-- 11. Call logs table
CREATE TABLE public.call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  workflow_instance_id UUID REFERENCES public.client_workflow_instances(id),
  call_type call_type,
  phone_number TEXT NOT NULL,
  caller_id TEXT,
  duration_seconds INTEGER DEFAULT 0,
  status call_status DEFAULT 'initiated',
  recording_url TEXT,
  transcript TEXT,
  ai_summary TEXT,
  cost DECIMAL(10,4) DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  executed_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 12. Voice campaigns table
CREATE TABLE public.voice_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  campaign_type campaign_type,
  script TEXT,
  total_contacts INTEGER DEFAULT 0,
  contacts_called INTEGER DEFAULT 0,
  contacts_answered INTEGER DEFAULT 0,
  status campaign_status DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Campaign contacts table
CREATE TABLE public.campaign_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES public.voice_campaigns(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  contact_data JSONB DEFAULT '{}'::jsonb,
  call_status contact_call_status,
  call_log_id UUID REFERENCES public.call_logs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  call_log_id UUID REFERENCES public.call_logs(id),
  campaign_id UUID REFERENCES public.voice_campaigns(id),
  lead_source lead_source,
  name TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  company TEXT,
  designation TEXT,
  interest_level INTEGER,
  lead_score INTEGER,
  status lead_status DEFAULT 'new',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  follow_up_date DATE,
  assigned_to TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT interest_level_range CHECK (interest_level >= 1 AND interest_level <= 10),
  CONSTRAINT lead_score_range CHECK (lead_score >= 0 AND lead_score <= 100)
);

-- Updated_at triggers
CREATE TRIGGER update_voice_campaigns_updated_at BEFORE UPDATE ON public.voice_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- CALL_LOGS RLS
CREATE POLICY "Super admins can manage all call logs" ON public.call_logs FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins can view their clients call logs" ON public.call_logs FOR SELECT TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Clients can view own call logs" ON public.call_logs FOR SELECT TO authenticated USING (
  client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- VOICE_CAMPAIGNS RLS
CREATE POLICY "Super admins can manage all campaigns" ON public.voice_campaigns FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins can view their clients campaigns" ON public.voice_campaigns FOR SELECT TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Admins can manage their clients campaigns" ON public.voice_campaigns FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') AND client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Admins can update their clients campaigns" ON public.voice_campaigns FOR UPDATE TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Clients can view own campaigns" ON public.voice_campaigns FOR SELECT TO authenticated USING (
  client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- CAMPAIGN_CONTACTS RLS
CREATE POLICY "Super admins can manage all contacts" ON public.campaign_contacts FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins can view their clients campaign contacts" ON public.campaign_contacts FOR SELECT TO authenticated USING (
  campaign_id IN (SELECT vc.id FROM public.voice_campaigns vc JOIN public.clients c ON vc.client_id = c.id WHERE c.admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Admins can manage their clients campaign contacts" ON public.campaign_contacts FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') AND campaign_id IN (SELECT vc.id FROM public.voice_campaigns vc JOIN public.clients c ON vc.client_id = c.id WHERE c.admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Clients can view own campaign contacts" ON public.campaign_contacts FOR SELECT TO authenticated USING (
  campaign_id IN (SELECT id FROM public.voice_campaigns WHERE client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()))
);

-- LEADS RLS
CREATE POLICY "Super admins can manage all leads" ON public.leads FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins can view their clients leads" ON public.leads FOR SELECT TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Admins can manage their clients leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') AND client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Admins can update their clients leads" ON public.leads FOR UPDATE TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user())
);
CREATE POLICY "Clients can view own leads" ON public.leads FOR SELECT TO authenticated USING (
  client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY "Clients can manage own leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (
  client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY "Clients can update own leads" ON public.leads FOR UPDATE TO authenticated USING (
  client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
