-- Add WhatsApp Bot Access Control and API support

-- 1. Create a table for WhatsApp Bot Access
CREATE TABLE IF NOT EXISTS public.whatsapp_user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.whatsapp_applications(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, application_id)
);

-- 2. Add columns to whatsapp_applications to support API-based bots
ALTER TABLE public.whatsapp_applications 
ADD COLUMN IF NOT EXISTS provider_type VARCHAR(20) DEFAULT 'baileys' 
CHECK (provider_type IN ('baileys', 'api'));

ALTER TABLE public.whatsapp_applications 
ADD COLUMN IF NOT EXISTS api_config JSONB DEFAULT '{}'::jsonb;

-- 3. Ensure whatsapp_messages table exists in public schema (if missing) 
-- Based on types.ts, it should have these columns:
-- id, client_id, campaign_id, phone_number, message_content, message_type, status, sent_at, delivered_at, read_at, error_message, media_url, template_name, cost, metadata, workflow_instance_id

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_messages') THEN
        CREATE TABLE public.whatsapp_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
            campaign_id UUID, -- Optional link to campaign
            application_id UUID REFERENCES public.whatsapp_applications(id) ON DELETE CASCADE, -- Link to specific bot
            phone_number VARCHAR(20) NOT NULL,
            message_content TEXT NOT NULL,
            message_type VARCHAR(20) DEFAULT 'text',
            status VARCHAR(20) DEFAULT 'queued',
            sent_at TIMESTAMPTZ DEFAULT NOW(),
            delivered_at TIMESTAMPTZ,
            read_at TIMESTAMPTZ,
            error_message TEXT,
            media_url TEXT,
            template_name TEXT,
            cost NUMERIC(10, 4) DEFAULT 0,
            metadata JSONB DEFAULT '{}'::jsonb,
            workflow_instance_id UUID
        );
        CREATE INDEX idx_wa_msgs_client ON public.whatsapp_messages(client_id);
        CREATE INDEX idx_wa_msgs_app ON public.whatsapp_messages(application_id);
        CREATE INDEX idx_wa_msgs_status ON public.whatsapp_messages(status);
        CREATE INDEX idx_wa_msgs_phone ON public.whatsapp_messages(phone_number);
    ELSE
        -- If it exists, add the application_id column if it's missing
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name = 'application_id') THEN
            ALTER TABLE public.whatsapp_messages ADD COLUMN application_id UUID REFERENCES public.whatsapp_applications(id) ON DELETE CASCADE;
            CREATE INDEX idx_wa_msgs_app ON public.whatsapp_messages(application_id);
        END IF;
    END IF;
END $$;

-- 4. Set RLS for whatsapp_user_access
ALTER TABLE public.whatsapp_user_access ENABLE ROW LEVEL SECURITY;

-- Admins can manage all access
CREATE POLICY "Admins can manage all whatsapp access" ON public.whatsapp_user_access
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Users can view their own access
CREATE POLICY "Users can view their whatsapp access" ON public.whatsapp_user_access
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 5. Update whatsapp_applications RLS to allow accessed users to view
CREATE POLICY "Accessed users can view whatsapp application" ON public.whatsapp_applications
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.whatsapp_user_access WHERE application_id = id AND user_id = auth.uid())
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 6. Update whatsapp_messages RLS to allow accessed users to view messages for their bots
CREATE POLICY "Accessed users can view messages of their bot" ON public.whatsapp_messages
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.whatsapp_user_access WHERE application_id = public.whatsapp_messages.application_id AND user_id = auth.uid())
  OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 7. Add Comment to whatsapp_applications for visibility
COMMENT ON TABLE public.whatsapp_applications IS 'Stores WhatsApp application configurations, support for both Baileys and external API bots';
