
-- Fix security definer view by setting it to invoker
ALTER VIEW public.campaign_stats SET (security_invoker = on);
