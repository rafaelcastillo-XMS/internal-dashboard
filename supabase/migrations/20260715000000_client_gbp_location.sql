-- Explicit Google Business Profile mapping used by the SEO Reports page.
-- A client has one selected GBP location. If multi-location reporting is needed
-- later, this can be promoted to a separate client_gbp_locations table.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS gbp_account_id text,
  ADD COLUMN IF NOT EXISTS gbp_location_id text,
  ADD COLUMN IF NOT EXISTS gbp_location_name text;

COMMENT ON COLUMN public.clients.gbp_account_id IS 'GBP resource name, e.g. accounts/123';
COMMENT ON COLUMN public.clients.gbp_location_id IS 'GBP resource name, e.g. locations/456';
COMMENT ON COLUMN public.clients.gbp_location_name IS 'Display name cached from Google Business Profile';
