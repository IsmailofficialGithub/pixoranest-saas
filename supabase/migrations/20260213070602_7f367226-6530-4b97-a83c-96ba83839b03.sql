
-- Profiles indexes (mapped from users)
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);

-- User roles
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- Admins
CREATE INDEX idx_admins_created_by ON public.admins(created_by);
CREATE INDEX idx_admins_is_active ON public.admins(is_active);
CREATE INDEX idx_admins_user_id ON public.admins(user_id);

-- Clients
CREATE INDEX idx_clients_admin_id ON public.clients(admin_id);
CREATE INDEX idx_clients_is_active ON public.clients(is_active);
CREATE INDEX idx_clients_user_id ON public.clients(user_id);

-- Services
CREATE INDEX idx_services_category ON public.services(category);
CREATE INDEX idx_services_is_active ON public.services(is_active);

-- Service plans
CREATE INDEX idx_service_plans_service_id ON public.service_plans(service_id);

-- Admin pricing
CREATE INDEX idx_admin_pricing_admin_id ON public.admin_pricing(admin_id);
CREATE INDEX idx_admin_pricing_service_id ON public.admin_pricing(service_id);

-- Client services
CREATE INDEX idx_client_services_client_id ON public.client_services(client_id);
CREATE INDEX idx_client_services_service_id ON public.client_services(service_id);
CREATE INDEX idx_client_services_is_active ON public.client_services(is_active);

-- Workflow templates
CREATE INDEX idx_workflow_templates_service_id ON public.workflow_templates(service_id);

-- Client workflow instances
CREATE INDEX idx_client_workflow_instances_client_id ON public.client_workflow_instances(client_id);
CREATE INDEX idx_client_workflow_instances_service_id ON public.client_workflow_instances(service_id);
CREATE INDEX idx_client_workflow_instances_status ON public.client_workflow_instances(status);
CREATE INDEX idx_client_workflow_instances_is_active ON public.client_workflow_instances(is_active);

-- Call logs
CREATE INDEX idx_call_logs_client_id ON public.call_logs(client_id);
CREATE INDEX idx_call_logs_service_id ON public.call_logs(service_id);
CREATE INDEX idx_call_logs_executed_at ON public.call_logs(executed_at);
CREATE INDEX idx_call_logs_status ON public.call_logs(status);
CREATE INDEX idx_call_logs_phone_number ON public.call_logs(phone_number);

-- Voice campaigns
CREATE INDEX idx_voice_campaigns_client_id ON public.voice_campaigns(client_id);
CREATE INDEX idx_voice_campaigns_status ON public.voice_campaigns(status);

-- Campaign contacts
CREATE INDEX idx_campaign_contacts_campaign_id ON public.campaign_contacts(campaign_id);
CREATE INDEX idx_campaign_contacts_call_status ON public.campaign_contacts(call_status);

-- Leads
CREATE INDEX idx_leads_client_id ON public.leads(client_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_lead_score ON public.leads(lead_score);
CREATE INDEX idx_leads_created_at ON public.leads(created_at);

-- WhatsApp messages
CREATE INDEX idx_whatsapp_messages_client_id ON public.whatsapp_messages(client_id);
CREATE INDEX idx_whatsapp_messages_status ON public.whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_sent_at ON public.whatsapp_messages(sent_at);

-- WhatsApp campaigns
CREATE INDEX idx_whatsapp_campaigns_client_id ON public.whatsapp_campaigns(client_id);

-- Social media posts
CREATE INDEX idx_social_media_posts_client_id ON public.social_media_posts(client_id);
CREATE INDEX idx_social_media_posts_status ON public.social_media_posts(status);
CREATE INDEX idx_social_media_posts_scheduled_at ON public.social_media_posts(scheduled_at);

-- Workflow executions
CREATE INDEX idx_workflow_executions_workflow_instance_id ON public.workflow_executions(workflow_instance_id);
CREATE INDEX idx_workflow_executions_client_id ON public.workflow_executions(client_id);
CREATE INDEX idx_workflow_executions_status ON public.workflow_executions(status);

-- Usage tracking
CREATE INDEX idx_usage_tracking_client_id ON public.usage_tracking(client_id);
CREATE INDEX idx_usage_tracking_recorded_at ON public.usage_tracking(recorded_at);

-- Invoices
CREATE INDEX idx_invoices_admin_id ON public.invoices(admin_id);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);

-- Notifications
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);

-- Audit logs
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
