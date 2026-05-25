-- seo_initial_findings: stores Initial Analysis form submissions
create table if not exists public.seo_initial_findings (
  id            bigint generated always as identity primary key,
  client        text        not null default '',
  analysis_date date,
  responsible_owner text,
  seo_category  text,
  audit_item    text,
  initial_status text,       -- Yes / No / Incomplete / Pending / N/A
  priority      text,        -- Low / Medium / High
  seo_impact    text,
  notes         text,
  recommendation text,
  evidence_url  text,
  is_draft      boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.seo_initial_findings enable row level security;

create policy "service role full access on seo_initial_findings"
  on public.seo_initial_findings for all
  to service_role using (true) with check (true);

create policy "anon select on seo_initial_findings"
  on public.seo_initial_findings for select
  to anon using (true);

create policy "anon insert on seo_initial_findings"
  on public.seo_initial_findings for insert
  to anon with check (true);

create policy "anon update on seo_initial_findings"
  on public.seo_initial_findings for update
  to anon using (true) with check (true);
