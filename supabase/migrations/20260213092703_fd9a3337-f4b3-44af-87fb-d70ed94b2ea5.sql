
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage platform settings"
ON public.platform_settings FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Seed default settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('platform_name', 'AI Services Platform'),
  ('support_email', 'support@platform.com'),
  ('support_phone', '+91 1234567890'),
  ('primary_brand_color', '#3B82F6'),
  ('default_currency', 'INR'),
  ('timezone', 'Asia/Kolkata'),
  ('date_format', 'DD/MM/YYYY'),
  ('notification_config', '{"new_client_registered":true,"service_assigned":true,"workflow_activated":true,"usage_limit_80":true,"usage_limit_exceeded":true,"campaign_completed":true,"new_lead_captured":true,"invoice_generated":true}'),
  ('security_min_password_length', '8'),
  ('security_require_uppercase', 'true'),
  ('security_require_numbers', 'true'),
  ('security_require_special', 'true'),
  ('session_timeout', '8'),
  ('webhook_secret', encode(gen_random_bytes(32), 'hex'));

CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
