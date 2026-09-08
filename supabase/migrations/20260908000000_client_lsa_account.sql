-- Optional override for clients whose Local Services campaigns live in a
-- separate MCC account (e.g. Holt's "LSA ACCOUNT") instead of inside the
-- regular Google Ads account. Readers fall back to sem_account_id when null.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lsa_account_id text;

COMMENT ON COLUMN public.clients.lsa_account_id IS
  'Google Ads account holding this client''s LOCAL_SERVICES campaigns. Null means they live in sem_account_id.';

-- Rollback:
-- ALTER TABLE public.clients DROP COLUMN IF EXISTS lsa_account_id;
