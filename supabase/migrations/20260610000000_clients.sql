-- Central clients table: one row per client with its fixed integration links
-- (GSC property, GA4 property, Google Ads account, NotebookLM notebook).
-- Replaces the hardcoded dummy client list + localStorage integration config.

CREATE TABLE IF NOT EXISTS public.clients (
  id text PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  gsc_property text,
  ga4_property_id text,
  sem_account_id text,
  notebooklm_enabled boolean NOT NULL DEFAULT false,
  notebooklm_id text,
  notebooklm_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clients"
  ON public.clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert clients"
  ON public.clients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients"
  ON public.clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete clients"
  ON public.clients FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS set_updated_at_clients ON public.clients;
CREATE TRIGGER set_updated_at_clients
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed: SEO clients with their fixed GSC + GA4 pair.
INSERT INTO public.clients (id, name, gsc_property, ga4_property_id) VALUES
  ('ac-now',                          'AC NOW',                                    'sc-domain:acnowllc.com',                      '268486686'),
  ('all-star-sunrooms',               'All Star Sunrooms',                         'sc-domain:allstarsunrooms.com',               '513603947'),
  ('american-yacht-restoration',      'American Yacht Restoration',                'sc-domain:americanyachtrestoration.com',      '479238439'),
  ('aquaseekers',                     'AquaSeekers',                               'sc-domain:aquaseekers.com',                   '324294566'),
  ('associated-coastal-ent',          'Associated Coastal ENT',                    'sc-domain:coastalent.org',                    '288031275'),
  ('atlantic-roofing-exteriors',      'Atlantic Roofing & Exteriors LLC',          'sc-domain:atlanticroofingfl.com',             '477319143'),
  ('carsons-cabinetry-design',        'Carsons Cabinetry & Design',                'sc-domain:carsonscabinetry.com',              '511125602'),
  ('choice-epoxy-coatings',           'Choice Epoxy Coatings',                     'sc-domain:choiceepoxycoating.com',            '462953816'),
  ('dr-christopher-slack',            'Dr. Christopher Slack',                     'sc-domain:drcslack.com',                      '289212855'),
  ('freedom-demolition-recycling',    'Freedom Demolition and Recycling',          'sc-domain:freedomdemolitionandrecycling.com', '251572968'),
  ('garcia-and-sons-construction',    'Garcia and Sons Construction LLC',          'sc-domain:garciaandsonsconstruct.com',        '289204695'),
  ('gb-tech-usa',                     'GB Tech USA',                               'sc-domain:gbtechusa.com',                     '305029771'),
  ('holts-garage',                    'Holt''s Reliable Garage Door Repair',       'sc-domain:holtsreliablegdr.com',              '322578396'),
  ('institute-health-wellness',       'Institute of Health & Wellness',            'sc-domain:institutehealthwellness.com',       '289195522'),
  ('ninos-corner',                    'Nino''s Corner',                            'sc-domain:ninoscornerpizzarestaurant.com',    '420674578'),
  ('oceans-pool-leak-detection',      'Oceans Pool Leak Detection',                'sc-domain:oceanspoolleakdetection.net',       '289248736'),
  ('premier-site-work',               'Premier Site Work LLC',                     'sc-domain:premiersitework.com',               '348755006'),
  ('rapid-roof-home-repairs',         'Rapid Roof & Home Repairs LLC',             'sc-domain:rapidroofco.com',                   '426515588'),
  ('surface-specialists-tc',          'Surface Specialists of the Treasure Coast', 'sc-domain:surfacespecialiststc.com',          '289248132'),
  ('trm-construction-management',     'TRM Construction Management',               'sc-domain:trmconstructionmanagement.com',     '426339356'),
  ('underwater-engineering-services', 'Underwater Engineering Services, Inc.',     'sc-domain:uesi.com',                          '256915838'),
  ('vammi-plumbing',                  'Vammi Plumbing',                            'sc-domain:vammiplumbing.com',                 '459939707'),
  ('vintage-venue',                   'Vintage Venue',                             'sc-domain:vintagevenuebeatrice.com',          '289259018'),
  ('xperience-ai-marketing',          'Xperience IA Marketing',                    'sc-domain:xperienceaimarketing.com',          '512126041'),
  ('xperience-marketing-solutions',   'Xperience Marketing Solutions',             'sc-domain:xperiencemarketingsolutions.com',   '287961891')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  gsc_property = EXCLUDED.gsc_property,
  ga4_property_id = EXCLUDED.ga4_property_id;

-- Carry over the NotebookLM integration that previously lived in localStorage defaults.
UPDATE public.clients
SET notebooklm_enabled = true,
    notebooklm_id = 'a1b92187-70ae-4ebf-a627-169a9ceda0ec',
    notebooklm_title = 'Holt''s Garage - CKB'
WHERE id = 'holts-garage' AND notebooklm_id IS NULL;

-- Link Google Ads accounts by normalized name, then add SEM-only accounts as clients.
DO $$
BEGIN
  IF to_regclass('public.sem_accounts') IS NOT NULL THEN
    UPDATE public.clients c
    SET sem_account_id = s.id
    FROM public.sem_accounts s
    WHERE c.sem_account_id IS NULL
      AND (
        regexp_replace(lower(s.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g')
        OR (length(regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g')) >= 6
            AND strpos(regexp_replace(lower(s.name), '[^a-z0-9]', '', 'g'), regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g')) > 0)
        OR (length(regexp_replace(lower(s.name), '[^a-z0-9]', '', 'g')) >= 6
            AND strpos(regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g'), regexp_replace(lower(s.name), '[^a-z0-9]', '', 'g')) > 0)
      );

    INSERT INTO public.clients (id, name, status, sem_account_id)
    SELECT
      trim(both '-' from regexp_replace(lower(s.name), '[^a-z0-9]+', '-', 'g')),
      s.name,
      'active',
      s.id
    FROM public.sem_accounts s
    WHERE s.status = 'ENABLED'
      AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.sem_account_id = s.id)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
