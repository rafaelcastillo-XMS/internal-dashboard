begin;

create table public.seo_initial_analysis_versions (
  id          bigint generated always as identity primary key,
  client      text        not null,
  title       text        not null check (char_length(btrim(title)) between 1 and 80),
  position    integer     not null default 0 check (position >= 0),
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, client),
  unique (client, position)
);

alter table public.seo_initial_analysis_versions enable row level security;

revoke all on table public.seo_initial_analysis_versions from anon, authenticated;
grant select, insert, update on table public.seo_initial_analysis_versions to authenticated;
grant select, insert, update, delete on table public.seo_initial_analysis_versions to service_role;
grant usage, select on sequence public.seo_initial_analysis_versions_id_seq to authenticated, service_role;

create policy "authenticated select on seo initial analysis versions"
  on public.seo_initial_analysis_versions for select
  to authenticated using (true);

create policy "authenticated insert on seo initial analysis versions"
  on public.seo_initial_analysis_versions for insert
  to authenticated with check (true);

create policy "authenticated update on seo initial analysis versions"
  on public.seo_initial_analysis_versions for update
  to authenticated using (true) with check (true);

-- Preserve every existing checklist as the first version for its client.
insert into public.seo_initial_analysis_versions (client, title, position)
select distinct client, 'Initial Analysis', 0
from public.seo_initial_audit_items
on conflict (client, position) do nothing;

alter table public.seo_initial_audit_items
  add column analysis_version_id bigint;

update public.seo_initial_audit_items item
set analysis_version_id = version.id
from public.seo_initial_analysis_versions version
where version.client = item.client and version.position = 0;

alter table public.seo_initial_audit_items
  alter column analysis_version_id set not null,
  add constraint seo_initial_audit_items_analysis_version_client_fkey
    foreign key (analysis_version_id, client)
    references public.seo_initial_analysis_versions(id, client)
    on delete restrict;

alter table public.seo_initial_audit_items
  drop constraint seo_initial_audit_items_client_section_item_key;

alter table public.seo_initial_audit_items
  add constraint seo_initial_audit_items_version_section_item_key
    unique (analysis_version_id, section, item);

create index seo_initial_audit_items_client_version_idx
  on public.seo_initial_audit_items (client, analysis_version_id);

commit;
