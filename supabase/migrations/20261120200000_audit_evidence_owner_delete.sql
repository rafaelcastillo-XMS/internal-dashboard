-- Initial Analysis evidence: section owners can delete their own attachments
-- (previously superadmin only). The superadmin still deletes everywhere, since
-- private.can_edit_initial_audit_section() already includes the superadmin.
-- Storage path: <client>/<versionId>/<sectionKey>/<file>.

drop policy if exists "Audit evidence owner deletion guard" on storage.objects;
create policy "Audit evidence owner deletion guard" on storage.objects
  as restrictive for delete to anon, authenticated
  using (bucket_id <> 'audit-evidence' or (select private.can_edit_initial_audit_section((storage.foldername(name))[3])));

drop policy if exists "Audit evidence owner replacement guard" on storage.objects;
create policy "Audit evidence owner replacement guard" on storage.objects
  as restrictive for update to anon, authenticated
  using (bucket_id <> 'audit-evidence' or (select private.can_edit_initial_audit_section((storage.foldername(name))[3])))
  with check (bucket_id <> 'audit-evidence' or (select private.can_edit_initial_audit_section((storage.foldername(name))[3])));

drop policy if exists "Audit evidence owner can delete" on storage.objects;
create policy "Audit evidence owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'audit-evidence' and (select private.can_edit_initial_audit_section((storage.foldername(name))[3])));

-- Evidence-list guard: same rule, keyed on the row's own section/item.
create or replace function private.protect_audit_evidence_references()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.evidence <> '[]'::jsonb and not private.can_edit_initial_audit_section(old.section, old.item) then
      raise exception 'Only the section owner or the superadmin can remove audit evidence' using errcode = '42501';
    end if;
    return old;
  end if;
  if (new.evidence is null or not (new.evidence @> old.evidence)
      or new.client is distinct from old.client
      or new.section is distinct from old.section or new.item is distinct from old.item)
    and old.evidence <> '[]'::jsonb and not private.can_edit_initial_audit_section(old.section, old.item) then
    raise exception 'Only the section owner or the superadmin can remove audit evidence' using errcode = '42501';
  end if;
  return new;
end;
$$;
