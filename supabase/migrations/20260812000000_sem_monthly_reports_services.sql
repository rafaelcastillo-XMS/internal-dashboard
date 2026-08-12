-- Which services a Monthly Report slide deck includes. Fixed at creation time —
-- the UI never exposes an edit control for these after the report is generated.
alter table public.sem_monthly_reports
  add column if not exists has_google_ads boolean not null default true,
  add column if not exists has_lsa        boolean not null default true;
