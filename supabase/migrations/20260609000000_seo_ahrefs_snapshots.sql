-- seo_ahrefs_snapshots: stores Ahrefs domain authority baselines/snapshots per client
create table if not exists public.seo_ahrefs_snapshots (
  id                bigint generated always as identity primary key,
  client            text        not null default '',
  domain            text        not null default '',
  snapshot_date     date,
  domain_rating     numeric,
  ahrefs_rank       bigint,
  organic_traffic   bigint,
  organic_keywords  bigint,
  backlinks         bigint,
  referring_domains bigint,
  notes             text,
  created_at        timestamptz not null default now()
);

alter table public.seo_ahrefs_snapshots enable row level security;

create policy "service role full access on seo_ahrefs_snapshots"
  on public.seo_ahrefs_snapshots for all
  to service_role using (true) with check (true);

create policy "anon select on seo_ahrefs_snapshots"
  on public.seo_ahrefs_snapshots for select
  to anon using (true);

create policy "anon insert on seo_ahrefs_snapshots"
  on public.seo_ahrefs_snapshots for insert
  to anon with check (true);

create policy "authenticated select on seo_ahrefs_snapshots"
  on public.seo_ahrefs_snapshots for select
  to authenticated using (true);

create policy "authenticated insert on seo_ahrefs_snapshots"
  on public.seo_ahrefs_snapshots for insert
  to authenticated with check (true);
