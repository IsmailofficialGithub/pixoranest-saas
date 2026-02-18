
CREATE TABLE public.error_logs (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  meta JSONB,
  url TEXT,
  user_agent TEXT,
  user_id UUID,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_logs_level ON public.error_logs(level);
CREATE INDEX idx_error_logs_timestamp ON public.error_logs(timestamp);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access error_logs" ON public.error_logs
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "Service role can insert error_logs" ON public.error_logs
  FOR INSERT WITH CHECK (true);
