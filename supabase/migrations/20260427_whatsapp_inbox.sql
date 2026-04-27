-- Migration to support WhatsApp Inbox and Real-time messaging
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS direction VARCHAR(10) DEFAULT 'outbound',
ADD COLUMN IF NOT EXISTS sender_name TEXT,
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Update whatsapp_applications to support phone_number_id lookup
ALTER TABLE public.whatsapp_applications 
ADD COLUMN IF NOT EXISTS phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wa_apps_phone_id ON public.whatsapp_applications(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_wa_apps_client ON public.whatsapp_applications(client_id);

-- Create AI Chatbots table for personality and settings
CREATE TABLE IF NOT EXISTS public.ai_chatbots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    system_prompt TEXT,
    temperature DECIMAL DEFAULT 0.7,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(client_id)
);

-- RLS for ai_chatbots
ALTER TABLE public.ai_chatbots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view their client's AI settings" ON public.ai_chatbots;
    DROP POLICY IF EXISTS "Users can update their client's AI settings" ON public.ai_chatbots;
END $$;

CREATE POLICY "Users can view their client's AI settings" ON public.ai_chatbots
FOR SELECT TO authenticated
USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "Users can update their client's AI settings" ON public.ai_chatbots
FOR UPDATE TO authenticated
USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Create WhatsApp Chats table to track conversations
CREATE TABLE IF NOT EXISTS public.whatsapp_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.whatsapp_applications(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    contact_name TEXT,
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    unread_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'New Lead',
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(application_id, phone_number)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_wa_chats_client ON public.whatsapp_chats(client_id);
CREATE INDEX IF NOT EXISTS idx_wa_chats_app ON public.whatsapp_chats(application_id);
CREATE INDEX IF NOT EXISTS idx_wa_chats_phone ON public.whatsapp_chats(phone_number);

-- RLS for whatsapp_chats
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors on retry
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view their client's chats" ON public.whatsapp_chats;
    DROP POLICY IF EXISTS "Users can update their client's chats" ON public.whatsapp_chats;
END $$;

CREATE POLICY "Users can view their client's chats" ON public.whatsapp_chats
FOR SELECT TO authenticated
USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.whatsapp_user_access WHERE application_id = whatsapp_chats.application_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "Users can update their client's chats" ON public.whatsapp_chats
FOR UPDATE TO authenticated
USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.whatsapp_user_access WHERE application_id = whatsapp_chats.application_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Trigger to update whatsapp_chats when a message is inserted
CREATE OR REPLACE FUNCTION public.handle_whatsapp_message_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.whatsapp_chats (
        client_id, 
        application_id, 
        phone_number, 
        contact_name, 
        last_message, 
        last_message_at, 
        unread_count
    )
    VALUES (
        NEW.client_id, 
        NEW.application_id, 
        NEW.phone_number, 
        COALESCE(NEW.sender_name, NEW.phone_number), 
        NEW.message_content, 
        NEW.sent_at, 
        CASE WHEN NEW.direction = 'inbound' THEN 1 ELSE 0 END
    )
    ON CONFLICT (application_id, phone_number) DO UPDATE SET
        last_message = EXCLUDED.last_message,
        last_message_at = EXCLUDED.last_message_at,
        unread_count = CASE 
            WHEN NEW.direction = 'inbound' THEN whatsapp_chats.unread_count + 1 
            ELSE whatsapp_chats.unread_count 
        END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_whatsapp_message_insert ON public.whatsapp_messages;
CREATE TRIGGER tr_whatsapp_message_insert
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_whatsapp_message_insert();
