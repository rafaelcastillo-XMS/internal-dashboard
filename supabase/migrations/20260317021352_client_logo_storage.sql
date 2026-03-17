ALTER TABLE public.client_profiles
ADD COLUMN IF NOT EXISTS logo_storage_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('client-assets', 'client-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can view client assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'client-assets');

CREATE POLICY "Authenticated users can upload client assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-assets');

CREATE POLICY "Authenticated users can update client assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'client-assets')
  WITH CHECK (bucket_id = 'client-assets');

CREATE POLICY "Authenticated users can delete client assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'client-assets');
