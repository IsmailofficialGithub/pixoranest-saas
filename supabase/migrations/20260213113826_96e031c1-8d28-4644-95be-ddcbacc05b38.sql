
-- Create storage bucket for admin logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-logos', 'admin-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to admin logos
CREATE POLICY "Public read access for admin logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'admin-logos');

-- Allow authenticated admins to upload their own logos
CREATE POLICY "Admins can upload own logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'admin-logos'
  AND auth.role() = 'authenticated'
);

-- Allow admins to update their own logos
CREATE POLICY "Admins can update own logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'admin-logos'
  AND auth.role() = 'authenticated'
);

-- Allow admins to delete their own logos
CREATE POLICY "Admins can delete own logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'admin-logos'
  AND auth.role() = 'authenticated'
);
