
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_client_id UUID,
  p_service_slug TEXT,
  p_amount INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE client_services
  SET 
    usage_consumed = COALESCE(usage_consumed, 0) + p_amount,
    updated_at = NOW()
  WHERE client_id = p_client_id
  AND service_id = (SELECT id FROM services WHERE slug = p_service_slug LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
