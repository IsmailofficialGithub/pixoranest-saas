
-- Create enums
CREATE TYPE public.wa_message_type AS ENUM ('text', 'template', 'image', 'video', 'document', 'audio');
CREATE TYPE public.wa_message_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');
CREATE TYPE public.wa_campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'completed', 'cancelled');
CREATE TYPE public.social_platform AS ENUM ('facebook', 'instagram', 'linkedin', 'twitter', 'all');
CREATE TYPE public.social_post_type AS ENUM ('text', 'image', 'video', 'carousel', 'story');
CREATE TYPE public.social_post_status AS ENUM ('draft', 'scheduled', 'publishing', 'posted', 'failed');

-- 15. WhatsApp messages
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workflow_instance_id UUID REFERENCES public.client_workflow_instances(id),
  campaign_id UUID,
  phone_number TEXT NOT NULL,
  message_type wa_message_type DEFAULT 'text',
  message_content TEXT NOT NULL,
  template_name TEXT,
  media_url TEXT,
  status wa_message_status DEFAULT 'queued',
  error_message TEXT,
  cost DECIMAL(10,4) DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

-- 16. WhatsApp campaigns
CREATE TABLE public.whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  total_contacts INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  status wa_campaign_status DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 17. Social media posts
CREATE TABLE public.social_media_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workflow_instance_id UUID REFERENCES public.client_workflow_instances(id),
  platform social_platform NOT NULL,
  post_type social_post_type,
  content TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  hashtags TEXT[] DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  status social_post_status DEFAULT 'draft',
  platform_post_ids JSONB DEFAULT '{}'::jsonb,
  engagement_stats JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at trigger
CREATE TRIGGER update_social_media_posts_updated_at BEFORE UPDATE ON public.social_media_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;

-- WHATSAPP_MESSAGES RLS
CREATE POLICY "Super admins full access wa messages" ON public.whatsapp_messages FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins view their clients wa messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user()));
CREATE POLICY "Clients view own wa messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- WHATSAPP_CAMPAIGNS RLS
CREATE POLICY "Super admins full access wa campaigns" ON public.whatsapp_campaigns FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins view their clients wa campaigns" ON public.whatsapp_campaigns FOR SELECT TO authenticated USING (client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user()));
CREATE POLICY "Admins manage their clients wa campaigns" ON public.whatsapp_campaigns FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user()));
CREATE POLICY "Admins update their clients wa campaigns" ON public.whatsapp_campaigns FOR UPDATE TO authenticated USING (client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user()));
CREATE POLICY "Clients view own wa campaigns" ON public.whatsapp_campaigns FOR SELECT TO authenticated USING (client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- SOCIAL_MEDIA_POSTS RLS
CREATE POLICY "Super admins full access social posts" ON public.social_media_posts FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins view their clients social posts" ON public.social_media_posts FOR SELECT TO authenticated USING (client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user()));
CREATE POLICY "Admins manage their clients social posts" ON public.social_media_posts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user()));
CREATE POLICY "Admins update their clients social posts" ON public.social_media_posts FOR UPDATE TO authenticated USING (client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user()));
CREATE POLICY "Clients view own social posts" ON public.social_media_posts FOR SELECT TO authenticated USING (client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY "Clients manage own social posts" ON public.social_media_posts FOR INSERT TO authenticated WITH CHECK (client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY "Clients update own social posts" ON public.social_media_posts FOR UPDATE TO authenticated USING (client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()));
