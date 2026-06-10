-- seo_onpage_audits: history of On-Page SEO audit runs per client (n8n workflow results)
create table if not exists public.seo_onpage_audits (
  id                 bigint generated always as identity primary key,
  client             text        not null default '',
  landing_page_url   text        not null,
  screaming_frog_url text,
  status             text        not null default 'running',  -- running / completed / error
  audit_html         text,
  error_message      text,
  created_at         timestamptz not null default now(),
  completed_at       timestamptz
);

create index if not exists seo_onpage_audits_client_idx
  on public.seo_onpage_audits (client, created_at desc);

alter table public.seo_onpage_audits enable row level security;

create policy "service role full access on seo_onpage_audits"
  on public.seo_onpage_audits for all
  to service_role using (true) with check (true);

create policy "anon select on seo_onpage_audits"
  on public.seo_onpage_audits for select
  to anon using (true);

create policy "anon insert on seo_onpage_audits"
  on public.seo_onpage_audits for insert
  to anon with check (true);

create policy "anon update on seo_onpage_audits"
  on public.seo_onpage_audits for update
  to anon using (true) with check (true);

create policy "authenticated select on seo_onpage_audits"
  on public.seo_onpage_audits for select
  to authenticated using (true);

create policy "authenticated insert on seo_onpage_audits"
  on public.seo_onpage_audits for insert
  to authenticated with check (true);

create policy "authenticated update on seo_onpage_audits"
  on public.seo_onpage_audits for update
  to authenticated using (true) with check (true);
