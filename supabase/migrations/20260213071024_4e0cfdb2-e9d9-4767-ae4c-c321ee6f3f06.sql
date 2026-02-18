
-- Only adding triggers for tables that have updated_at but were missing triggers.
-- Already exist: profiles, admins, clients, services, admin_pricing, client_services,
-- workflow_templates, client_workflow_instances, client_workflow_credentials,
-- voice_campaigns, leads, social_media_posts

-- These were missing:
CREATE TRIGGER update_whatsapp_campaigns_updated_at BEFORE UPDATE ON public.whatsapp_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
