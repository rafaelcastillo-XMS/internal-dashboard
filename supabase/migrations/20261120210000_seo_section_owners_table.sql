-- Single source of truth for Initial Analysis section owners.
-- Both the DB guard (private.can_edit_initial_audit_section) and the frontend read this table.
-- To reassign a section, edit its row here; no deploy needed.

create table if not exists public.seo_section_owners (
  section text primary key,
  email   text not null check (email = lower(email))
);

insert into public.seo_section_owners (section, email) values
  ('content-review',            'juliana@xperienceusa.com'),
  ('google-accounts',           'juliana@xperienceusa.com'),
  ('reviews-reputation',        'juliana@xperienceusa.com'),
  ('gbp',                       'geraldine@xperienceusa.com'),
  ('offsite-seo',               'geraldine@xperienceusa.com'),
  ('backlinks-citations',       'geraldine@xperienceusa.com'),
  ('tech-seo',                  'steven@xperienceusa.com'),
  ('reviews-reputation-steven', 'steven@xperienceusa.com'),
  ('youtube',                   'steven@xperienceusa.com'),
  ('keyword-ranking',           'leo@xperienceusa.com')
on conflict (section) do nothing;

alter table public.seo_section_owners enable row level security;
revoke all on public.seo_section_owners from anon;
grant select on public.seo_section_owners to authenticated;
grant insert, update, delete on public.seo_section_owners to authenticated;

drop policy if exists "Logged-in users can read section owners" on public.seo_section_owners;
create policy "Logged-in users can read section owners" on public.seo_section_owners
  for select to authenticated using (true);

drop policy if exists "Superadmin manages section owners" on public.seo_section_owners;
create policy "Superadmin manages section owners" on public.seo_section_owners
  for all to authenticated
  using ((select private.can_delete_audit_evidence()))
  with check ((select private.can_delete_audit_evidence()));

create or replace function private.can_edit_initial_audit_section(p_section text, p_item text default null)
returns boolean language sql stable security definer set search_path = ''
as $$
  with me as (
    select lower(u.email) as email
    from auth.users u
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  )
  select (select private.can_delete_audit_evidence())
    or exists (
      select 1 from me join public.seo_section_owners o on o.email = me.email
      where o.section = p_section
    )
    -- Steven's "Access to Google Business Profile" is stored as this google-accounts row (see itemIdentity()),
    -- so the owner of his reviews section can edit it too.
    or (
      p_section = 'google-accounts' and p_item = 'Google Business Profile access'
      and exists (
        select 1 from me join public.seo_section_owners o on o.email = me.email
        where o.section = 'reviews-reputation-steven'
      )
    );
$$;
