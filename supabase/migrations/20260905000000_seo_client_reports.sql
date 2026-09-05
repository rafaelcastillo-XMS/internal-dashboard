-- seo_client_reports: history of generated client-facing SEO quarterly reports
create table if not exists public.seo_client_reports (
  id            bigint generated always as identity primary key,
  client_id     text        not null default '',
  client_name   text        not null default '',
  title         text        not null default '',
  start_date    date,
  end_date      date,
  storage_path  text        not null,
  created_at    timestamptz not null default now()
);

create index if not exists seo_client_reports_client_idx
  on public.seo_client_reports (client_id, created_at desc);

alter table public.seo_client_reports enable row level security;

create policy "service role full access on seo_client_reports"
  on public.seo_client_reports for all
  to service_role using (true) with check (true);

create policy "anon select on seo_client_reports"
  on public.seo_client_reports for select
  to anon using (true);

create policy "anon insert on seo_client_reports"
  on public.seo_client_reports for insert
  to anon with check (true);

create policy "anon delete on seo_client_reports"
  on public.seo_client_reports for delete
  to anon using (true);

create policy "authenticated select on seo_client_reports"
  on public.seo_client_reports for select
  to authenticated using (true);

create policy "authenticated insert on seo_client_reports"
  on public.seo_client_reports for insert
  to authenticated with check (true);

create policy "authenticated delete on seo_client_reports"
  on public.seo_client_reports for delete
  to authenticated using (true);

insert into storage.buckets (id, name, public)
values ('seo-reports', 'seo-reports', true)
on conflict (id) do nothing;

create policy "Authenticated users can view seo reports"
  on storage.objects for select
  to authenticated using (bucket_id = 'seo-reports');

create policy "Authenticated users can upload seo reports"
  on storage.objects for insert
  to authenticated with check (bucket_id = 'seo-reports');

create policy "Authenticated users can delete seo reports"
  on storage.objects for delete
  to authenticated using (bucket_id = 'seo-reports');
