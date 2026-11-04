-- Per-client switch to hide OpenAI Ads from the SEM module (mirrors sem_enabled).
alter table public.clients
  add column if not exists openai_ads_enabled boolean not null default true;
