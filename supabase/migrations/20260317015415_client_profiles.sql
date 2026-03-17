CREATE TABLE IF NOT EXISTS public.client_profiles (
  client_id text PRIMARY KEY,
  logo_url text,
  poc_owner_name text,
  level_of_service text,
  industry text,
  location text,
  phone text,
  email text,
  website text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client profiles"
  ON public.client_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert client profiles"
  ON public.client_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update client profiles"
  ON public.client_profiles
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete client profiles"
  ON public.client_profiles
  FOR DELETE
  TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS set_updated_at_client_profiles ON public.client_profiles;
CREATE TRIGGER set_updated_at_client_profiles
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.client_profiles (
  client_id,
  logo_url,
  poc_owner_name,
  level_of_service,
  industry,
  location,
  phone,
  email,
  website
)
VALUES (
  'holts-garage',
  'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=400&q=80',
  'Eric Holt & Rafael',
  'Pilot Integration',
  'Automotive Repair & Service',
  'Austin, USA',
  '+1 512 555 0197',
  'eric@holtsgarage.com',
  'https://holtsgarage.com'
)
ON CONFLICT (client_id) DO UPDATE
SET
  logo_url = EXCLUDED.logo_url,
  poc_owner_name = EXCLUDED.poc_owner_name,
  level_of_service = EXCLUDED.level_of_service,
  industry = EXCLUDED.industry,
  location = EXCLUDED.location,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  website = EXCLUDED.website;
