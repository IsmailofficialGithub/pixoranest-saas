-- Update AI Voice Telecaller pricing model from per_call to per_minute
UPDATE services 
SET 
  base_pricing_model = 'per_minute',
  base_price = 2.00,
  description = 'Outbound calling campaigns with AI voice agents for sales, surveys, and customer outreach. Billed per minute of talk time.',
  updated_at = now()
WHERE slug = 'ai-voice-telecaller';
