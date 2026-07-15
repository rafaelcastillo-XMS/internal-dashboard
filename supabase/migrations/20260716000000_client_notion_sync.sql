-- Notion synchronization metadata for existing dashboard clients.
-- Logos continue to live in client_profiles/client-assets and SEM budgets keep
-- using sem_report_budgets, so existing readers and fallbacks remain intact.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS notion_page_id text,
  ADD COLUMN IF NOT EXISTS notion_last_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS clients_notion_page_id_uq
  ON public.clients (notion_page_id)
  WHERE notion_page_id IS NOT NULL;

COMMENT ON COLUMN public.clients.notion_page_id IS
  'Notion page ID linked to this dashboard client for deterministic synchronization.';

COMMENT ON COLUMN public.clients.notion_last_synced_at IS
  'Timestamp of the latest successful Notion-to-Supabase synchronization.';

-- Rollback (only if the integration is intentionally removed):
-- DROP INDEX IF EXISTS public.clients_notion_page_id_uq;
-- ALTER TABLE public.clients DROP COLUMN IF EXISTS notion_last_synced_at;
-- ALTER TABLE public.clients DROP COLUMN IF EXISTS notion_page_id;
