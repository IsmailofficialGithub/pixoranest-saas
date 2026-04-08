-- Create WhatsApp Templates table for local management
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.whatsapp_applications(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'MARKETING',
    language TEXT DEFAULT 'en',
    components JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'approved',
    created_by UUID REFERENCES auth.users(id)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_wa_templates_client ON public.whatsapp_templates(client_id);
CREATE INDEX IF NOT EXISTS idx_wa_templates_app ON public.whatsapp_templates(application_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_templates_name_app ON public.whatsapp_templates(application_id, name);

-- RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage all
CREATE POLICY "Admins can manage all whatsapp templates" ON public.whatsapp_templates
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Users can view and manage their own client's templates
CREATE POLICY "Users can manage their client's templates" ON public.whatsapp_templates
FOR ALL TO authenticated
USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.whatsapp_user_access WHERE application_id = whatsapp_templates.application_id AND user_id = auth.uid())
)
WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.whatsapp_user_access WHERE application_id = whatsapp_templates.application_id AND user_id = auth.uid())
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_wa_templates_updated_at
    BEFORE UPDATE ON public.whatsapp_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
