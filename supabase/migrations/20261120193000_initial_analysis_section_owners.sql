-- Initial Analysis: each team member can only edit their own checklist sections.
-- The superadmin (Rafael, via private.can_delete_audit_evidence()) can edit everything.
-- Everyone logged in can still READ all sections.
-- Keep the section -> email map in sync with SECTIONS in
-- src/features/seo/lib/initialAnalysisChecklist.ts.

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
      select 1 from me where me.email = case p_section
        when 'content-review'            then 'juliana@xperienceusa.com'
        when 'google-accounts'           then 'juliana@xperienceusa.com'
        when 'reviews-reputation'        then 'juliana@xperienceusa.com'
        when 'gbp'                       then 'geraldine@xperienceusa.com'
        when 'offsite-seo'               then 'geraldine@xperienceusa.com'
        when 'backlinks-citations'       then 'geraldine@xperienceusa.com'
        when 'tech-seo'                  then 'steven@xperienceusa.com'
        when 'reviews-reputation-steven' then 'steven@xperienceusa.com'
        when 'youtube'                   then 'steven@xperienceusa.com'
        when 'keyword-ranking'           then 'leo@xperienceusa.com'
      end
    )
    -- Steven's "Access to Google Business Profile" is stored as this google-accounts row (see itemIdentity()).
    or (
      p_section = 'google-accounts' and p_item = 'Google Business Profile access'
      and exists (select 1 from me where me.email = 'steven@xperienceusa.com')
    );
$$;
revoke all on function private.can_edit_initial_audit_section(text, text) from public;
grant execute on function private.can_edit_initial_audit_section(text, text) to authenticated;

-- Restrictive policies narrow the existing broad "authenticated all" policy for writes only.
drop policy if exists "Initial audit owner insert guard" on public.seo_initial_audit_items;
create policy "Initial audit owner insert guard" on public.seo_initial_audit_items
  as restrictive for insert to authenticated
  with check ((select private.can_edit_initial_audit_section(section, item)));

drop policy if exists "Initial audit owner update guard" on public.seo_initial_audit_items;
create policy "Initial audit owner update guard" on public.seo_initial_audit_items
  as restrictive for update to authenticated
  using ((select private.can_edit_initial_audit_section(section, item)))
  with check ((select private.can_edit_initial_audit_section(section, item)));

drop policy if exists "Initial audit owner delete guard" on public.seo_initial_audit_items;
create policy "Initial audit owner delete guard" on public.seo_initial_audit_items
  as restrictive for delete to authenticated
  using ((select private.can_edit_initial_audit_section(section, item)));

-- Evidence uploads: path is <client>/<versionId>/<sectionKey>/<file>.
drop policy if exists "Audit evidence owner upload guard" on storage.objects;
create policy "Audit evidence owner upload guard" on storage.objects
  as restrictive for insert to authenticated
  with check (
    bucket_id <> 'audit-evidence'
    or (select private.can_edit_initial_audit_section((storage.foldername(name))[3]))
  );
