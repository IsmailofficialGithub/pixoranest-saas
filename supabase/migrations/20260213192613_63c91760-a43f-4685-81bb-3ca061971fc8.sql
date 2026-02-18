
-- 1. Check usage limit function (sends notifications at 80% and 100%)
CREATE OR REPLACE FUNCTION public.check_usage_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_percentage NUMERIC;
  v_service_name TEXT;
  v_user_id UUID;
BEGIN
  IF NEW.usage_limit IS NULL OR NEW.usage_limit = 0 THEN
    RETURN NEW;
  END IF;

  v_percentage := (COALESCE(NEW.usage_consumed, 0)::NUMERIC / NEW.usage_limit::NUMERIC) * 100;

  IF OLD.usage_consumed IS NOT NULL AND NEW.usage_consumed <= OLD.usage_consumed THEN
    RETURN NEW;
  END IF;

  SELECT s.name INTO v_service_name FROM services s WHERE s.id = NEW.service_id;
  SELECT c.user_id INTO v_user_id FROM clients c WHERE c.id = NEW.client_id;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  IF v_percentage >= 80 AND v_percentage < 100 AND
     (OLD.usage_consumed IS NULL OR (OLD.usage_consumed::NUMERIC / NEW.usage_limit::NUMERIC) * 100 < 80) THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (v_user_id, 'Usage Alert',
      format('You''ve used %.0f%% of your %s limit (%s/%s).', v_percentage, v_service_name, NEW.usage_consumed, NEW.usage_limit),
      'warning', '/client/usage');
  END IF;

  IF v_percentage >= 100 AND
     (OLD.usage_consumed IS NULL OR (OLD.usage_consumed::NUMERIC / NEW.usage_limit::NUMERIC) * 100 < 100) THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (v_user_id, 'Usage Limit Reached',
      format('You''ve reached your %s limit (%s/%s). Service may be paused.', v_service_name, NEW.usage_consumed, NEW.usage_limit),
      'error', '/client/usage');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER check_usage_limit_trigger
  AFTER UPDATE OF usage_consumed ON client_services
  FOR EACH ROW
  EXECUTE FUNCTION check_usage_limit();

-- 2. Auto-create lead from qualified call
CREATE OR REPLACE FUNCTION public.auto_create_lead_from_call()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'answered' AND
     COALESCE(NEW.duration_seconds, 0) > 60 AND
     NEW.transcript IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM leads WHERE call_log_id = NEW.id) THEN
      INSERT INTO leads (client_id, call_log_id, phone, lead_source, lead_score, status, notes)
      VALUES (NEW.client_id, NEW.id, NEW.phone_number, 'telecaller', 50, 'new', NEW.ai_summary);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER auto_create_lead
  AFTER UPDATE OF status ON call_logs
  FOR EACH ROW
  WHEN (NEW.status = 'answered')
  EXECUTE FUNCTION auto_create_lead_from_call();

-- 3. Campaign status update on campaign_contacts change
CREATE OR REPLACE FUNCTION public.update_campaign_status_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_called INTEGER;
  v_answered INTEGER;
  v_total INTEGER;
  v_campaign_name TEXT;
  v_client_user_id UUID;
BEGIN
  SELECT COUNT(*) FILTER (WHERE call_status IS NOT NULL AND call_status != 'pending'),
         COUNT(*) FILTER (WHERE call_status IN ('answered', 'completed'))
  INTO v_called, v_answered
  FROM campaign_contacts WHERE campaign_id = NEW.campaign_id;

  SELECT total_contacts, campaign_name, c.user_id
  INTO v_total, v_campaign_name, v_client_user_id
  FROM voice_campaigns vc JOIN clients c ON c.id = vc.client_id
  WHERE vc.id = NEW.campaign_id;

  UPDATE voice_campaigns
  SET contacts_called = v_called, contacts_answered = v_answered,
      status = CASE WHEN v_called >= COALESCE(v_total, 0) THEN 'completed' ELSE status END,
      completed_at = CASE WHEN v_called >= COALESCE(v_total, 0) AND completed_at IS NULL THEN NOW() ELSE completed_at END,
      updated_at = NOW()
  WHERE id = NEW.campaign_id;

  IF v_called >= COALESCE(v_total, 0) AND v_client_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (v_client_user_id, 'Campaign Completed',
      format('Your campaign "%s" has finished. %s contacts called.', v_campaign_name, v_called),
      'success', '/client/voice-telecaller');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER campaign_status_update
  AFTER UPDATE OF call_status ON campaign_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_status_trigger();

-- 4. Audit log trigger
CREATE OR REPLACE FUNCTION public.audit_log_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER audit_client_services
  AFTER INSERT OR UPDATE OR DELETE ON client_services
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_voice_campaigns
  AFTER INSERT OR UPDATE OR DELETE ON voice_campaigns
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- 5. Cleanup old read notifications (callable via pg_cron or edge function)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications WHERE is_read = true AND read_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Reset monthly usage (callable via pg_cron or edge function)
CREATE OR REPLACE FUNCTION public.reset_usage_if_needed()
RETURNS void AS $$
BEGIN
  UPDATE client_services
  SET usage_consumed = 0, last_reset_at = NOW(), updated_at = NOW()
  WHERE reset_period = 'monthly'
    AND (last_reset_at IS NULL OR last_reset_at < DATE_TRUNC('month', NOW()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. updated_at triggers for tables that don't have them yet
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_call_logs_updated_at') THEN
    -- call_logs has no updated_at column, skip
    NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_client_services_updated_at') THEN
    CREATE TRIGGER update_client_services_updated_at BEFORE UPDATE ON client_services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_voice_campaigns_updated_at') THEN
    CREATE TRIGGER update_voice_campaigns_updated_at BEFORE UPDATE ON voice_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_social_media_posts_updated_at') THEN
    CREATE TRIGGER update_social_media_posts_updated_at BEFORE UPDATE ON social_media_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
