-- seo_initial_audit_items: per-item state of the Initial Analysis team workflow
-- (status, comments, evidence files) keyed by client + section + item
create table if not exists public.seo_initial_audit_items (
  id          bigint generated always as identity primary key,
  client      text        not null,
  section     text        not null,
  item        text        not null,
  status      text,                -- pass / fail / na (null = pending)
  comments    text,
  evidence    jsonb       not null default '[]'::jsonb,  -- [{name, path}]
  updated_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (client, section, item)
);

alter table public.seo_initial_audit_items enable row level security;

create policy "service role full access on seo_initial_audit_items"
  on public.seo_initial_audit_items for all
  to service_role using (true) with check (true);

create policy "anon select on seo_initial_audit_items"
  on public.seo_initial_audit_items for select
  to anon using (true);

create policy "anon insert on seo_initial_audit_items"
  on public.seo_initial_audit_items for insert
  to anon with check (true);

create policy "anon update on seo_initial_audit_items"
  on public.seo_initial_audit_items for update
  to anon using (true) with check (true);

create policy "authenticated all on seo_initial_audit_items"
  on public.seo_initial_audit_items for all
  to authenticated using (true) with check (true);

-- Evidence files bucket
insert into storage.buckets (id, name, public)
values ('audit-evidence', 'audit-evidence', true)
on conflict (id) do nothing;

create policy "Authenticated users can view audit evidence"
  on storage.objects for select
  to authenticated using (bucket_id = 'audit-evidence');

create policy "Authenticated users can upload audit evidence"
  on storage.objects for insert
  to authenticated with check (bucket_id = 'audit-evidence');

create policy "Authenticated users can delete audit evidence"
  on storage.objects for delete
  to authenticated using (bucket_id = 'audit-evidence');
