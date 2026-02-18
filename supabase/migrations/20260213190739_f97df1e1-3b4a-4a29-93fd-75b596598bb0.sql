
-- Create new storage buckets (admin-logos already exists)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('social-media-uploads', 'social-media-uploads', true),
  ('whatsapp-media', 'whatsapp-media', true),
  ('call-recordings', 'call-recordings', false),
  ('voicemails', 'voicemails', false),
  ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for social-media-uploads
CREATE POLICY "Clients can upload social media files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'social-media-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view social media uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'social-media-uploads');

CREATE POLICY "Clients can delete their social uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'social-media-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for whatsapp-media
CREATE POLICY "Clients can upload WhatsApp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their WhatsApp media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for call-recordings (private)
CREATE POLICY "Users can view their call recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'call-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Service role can upload call recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'call-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for voicemails (private)
CREATE POLICY "Users can view their voicemails"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voicemails'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Service role can upload voicemails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voicemails'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for documents
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
