-- Create social_media_brands table
CREATE TABLE IF NOT EXISTS public.social_media_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add brand_id to social_media_posts
ALTER TABLE public.social_media_posts 
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.social_media_brands(id) ON DELETE SET NULL;

-- Add RLS policies for social_media_brands
ALTER TABLE public.social_media_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access social brands" ON public.social_media_brands FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins view their clients social brands" ON public.social_media_brands FOR SELECT TO authenticated USING (client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user()));
CREATE POLICY "Admins manage their clients social brands" ON public.social_media_brands FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user()));
CREATE POLICY "Admins update their clients social brands" ON public.social_media_brands FOR UPDATE TO authenticated USING (client_id IN (SELECT id FROM public.clients WHERE admin_id = public.get_admin_id_for_user()));
CREATE POLICY "Clients view own social brands" ON public.social_media_brands FOR SELECT TO authenticated USING (client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY "Clients manage own social brands" ON public.social_media_brands FOR INSERT TO authenticated WITH CHECK (client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY "Clients update own social brands" ON public.social_media_brands FOR UPDATE TO authenticated USING (client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE social_media_brands;
