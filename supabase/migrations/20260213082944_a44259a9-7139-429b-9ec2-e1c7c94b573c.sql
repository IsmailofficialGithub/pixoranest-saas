
-- Create storage bucket for service icons
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-icons', 'service-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to service-icons
CREATE POLICY "Authenticated users can upload service icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'service-icons' AND auth.role() = 'authenticated');

-- Allow public read access
CREATE POLICY "Public read access for service icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-icons');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update service icons"
ON storage.objects FOR UPDATE
USING (bucket_id = 'service-icons' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete service icons
CREATE POLICY "Authenticated users can delete service icons"
ON storage.objects FOR DELETE
USING (bucket_id = 'service-icons' AND auth.role() = 'authenticated');
