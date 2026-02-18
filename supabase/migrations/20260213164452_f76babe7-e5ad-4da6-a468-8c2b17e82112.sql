
-- Add notification_preferences and website columns to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}';

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS website text;
