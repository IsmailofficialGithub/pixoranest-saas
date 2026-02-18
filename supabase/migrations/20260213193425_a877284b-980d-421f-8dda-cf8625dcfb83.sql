
-- View for campaign statistics
CREATE OR REPLACE VIEW public.campaign_stats AS
SELECT 
  vc.id AS campaign_id,
  vc.campaign_name,
  vc.client_id,
  vc.status,
  vc.total_contacts,
  vc.contacts_called,
  vc.contacts_answered,
  vc.created_at,
  vc.started_at,
  vc.completed_at,
  COUNT(cl.id) AS calls_made,
  COUNT(CASE WHEN cl.status = 'answered' THEN 1 END) AS calls_answered_logs,
  COUNT(CASE WHEN cl.status = 'failed' THEN 1 END) AS calls_failed,
  COALESCE(AVG(cl.duration_seconds), 0) AS avg_duration,
  COUNT(l.id) AS leads_generated
FROM voice_campaigns vc
LEFT JOIN call_logs cl ON cl.caller_id = vc.id::text
LEFT JOIN leads l ON l.campaign_id = vc.id
GROUP BY vc.id;

-- Add any missing composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_call_logs_client_status ON public.call_logs(client_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_client_score ON public.leads(client_id, lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_client_service ON public.usage_tracking(client_id, service_id);
