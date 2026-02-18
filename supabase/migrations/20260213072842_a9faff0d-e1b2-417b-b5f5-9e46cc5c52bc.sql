
-- Insert 5 Services
INSERT INTO public.services (id, name, slug, description, category, base_pricing_model, base_price, features) VALUES
(
  '10000000-0000-0000-0000-000000000001',
  'Social Media Automation',
  'social-media-automation',
  'Schedule and manage posts across Facebook, Instagram, LinkedIn, Twitter with analytics.',
  'social_media',
  'monthly',
  499.00,
  '[{"name":"Multi-platform posting","description":"Post to all platforms simultaneously"},{"name":"Post scheduling","description":"Schedule posts for optimal times"},{"name":"Analytics dashboard","description":"Track engagement and reach"},{"name":"Auto-reply","description":"Automated responses to comments"}]'::jsonb
),
(
  '10000000-0000-0000-0000-000000000002',
  'WhatsApp Automation',
  'whatsapp-automation',
  'Send bulk WhatsApp messages, automated chatbot responses, and template management.',
  'messaging',
  'per_message',
  0.10,
  '[{"name":"Bulk messaging","description":"Send to thousands of contacts"},{"name":"AI Chatbot","description":"Automated customer support"},{"name":"Template management","description":"Pre-approved message templates"},{"name":"Delivery tracking","description":"Real-time message status"}]'::jsonb
),
(
  '10000000-0000-0000-0000-000000000003',
  'AI Voice Agent',
  'ai-voice-agent',
  'AI-powered voice assistant for lead nurturing, qualification with call recording and transcription.',
  'voice',
  'per_minute',
  2.00,
  '[{"name":"Lead qualification","description":"AI asks qualifying questions"},{"name":"Call recording","description":"All calls recorded and transcribed"},{"name":"Lead scoring","description":"Automatic scoring based on conversation"},{"name":"CRM integration","description":"Auto-sync leads to your CRM"}]'::jsonb
),
(
  '10000000-0000-0000-0000-000000000004',
  'AI Voice Receptionist',
  'ai-voice-receptionist',
  'Automated inbound call handling with IVR menu, call forwarding, and business hours management.',
  'voice',
  'per_minute',
  1.50,
  '[{"name":"IVR menu","description":"Custom voice menu options"},{"name":"Call forwarding","description":"Route calls to team members"},{"name":"Business hours","description":"Different handling for after-hours"},{"name":"Voicemail","description":"Automated voicemail system"}]'::jsonb
),
(
  '10000000-0000-0000-0000-000000000005',
  'AI Voice Telecaller',
  'ai-voice-telecaller',
  'Outbound calling campaigns with AI voice agents for sales, surveys, and customer outreach.',
  'voice',
  'per_call',
  5.00,
  '[{"name":"Bulk calling","description":"Call thousands automatically"},{"name":"Campaign tracking","description":"Monitor call success rates"},{"name":"Lead capture","description":"Capture interested leads automatically"},{"name":"Custom scripts","description":"Personalized call scripts with variables"}]'::jsonb
);

-- Insert service plans for Voice Telecaller
INSERT INTO public.service_plans (service_id, plan_name, plan_tier, usage_limit, price_per_unit, features_included) VALUES
('10000000-0000-0000-0000-000000000005', 'Basic Telecaller', 'basic', 100, 5.00, '[{"name":"100 calls per month"},{"name":"Basic call scripts"},{"name":"Call logs access"}]'::jsonb),
('10000000-0000-0000-0000-000000000005', 'Standard Telecaller', 'standard', 500, 4.50, '[{"name":"500 calls per month"},{"name":"Advanced call scripts"},{"name":"Lead capture"},{"name":"Call recordings"}]'::jsonb),
('10000000-0000-0000-0000-000000000005', 'Premium Telecaller', 'premium', 2000, 4.00, '[{"name":"2000 calls per month"},{"name":"Custom AI training"},{"name":"Lead scoring"},{"name":"CRM integration"}]'::jsonb);

-- Insert service plans for Voice Receptionist
INSERT INTO public.service_plans (service_id, plan_name, plan_tier, usage_limit, price_per_unit, features_included) VALUES
('10000000-0000-0000-0000-000000000004', 'Basic Receptionist', 'basic', 1000, 1.50, '[{"name":"1000 minutes per month"},{"name":"Basic IVR menu"},{"name":"Call forwarding"}]'::jsonb),
('10000000-0000-0000-0000-000000000004', 'Standard Receptionist', 'standard', 3000, 1.30, '[{"name":"3000 minutes per month"},{"name":"Advanced IVR menu"},{"name":"Business hours"},{"name":"Voicemail"}]'::jsonb);
