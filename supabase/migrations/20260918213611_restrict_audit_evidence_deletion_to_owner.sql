-- Run after internal dashboard roles are configured. No client data is deleted.
begin;

do $$
begin
  if to_regclass('public.dashboard_user_roles') is null then
    raise exception 'dashboard_user_roles is missing. Configure internal roles before applying this migration.';
  end if;
  if not exists (
    select 1 from public.dashboard_user_roles r join auth.users u on u.id = r.user_id
    where r.role = 'superadmin' and lower(u.email) = 'rafael.castillo@xperienceusa.com'
      and u.email_confirmed_at is not null
  ) then
    raise exception 'The verified Rafael account must have the superadmin role before applying this migration.';
  end if;
end;
$$;

create schema if not exists private;
create or replace function private.can_delete_audit_evidence()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.dashboard_user_roles r join auth.users u on u.id = r.user_id
    where u.id = (select auth.uid()) and r.role = 'superadmin'
      and lower(u.email) = 'rafael.castillo@xperienceusa.com'
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function private.can_delete_audit_evidence() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.can_delete_audit_evidence() to anon, authenticated;

-- Restrictive policies also constrain any pre-existing broad permissive policies.
drop policy if exists "Audit evidence owner deletion guard" on storage.objects;
create policy "Audit evidence owner deletion guard" on storage.objects
  as restrictive for delete to anon, authenticated
  using (bucket_id <> 'audit-evidence' or (select private.can_delete_audit_evidence()));

drop policy if exists "Audit evidence owner replacement guard" on storage.objects;
create policy "Audit evidence owner replacement guard" on storage.objects
  as restrictive for update to anon, authenticated
  using (bucket_id <> 'audit-evidence' or (select private.can_delete_audit_evidence()))
  with check (bucket_id <> 'audit-evidence' or (select private.can_delete_audit_evidence()));

drop policy if exists "Audit evidence owner can delete" on storage.objects;
create policy "Audit evidence owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'audit-evidence' and (select private.can_delete_audit_evidence()));

-- Prevent bypassing Storage protection by erasing the evidence list or its row.
create or replace function private.protect_audit_evidence_references()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.evidence <> '[]'::jsonb and not private.can_delete_audit_evidence() then
      raise exception 'Only the authorized superadmin can remove audit evidence' using errcode = '42501';
    end if;
    return old;
  end if;
  if (new.evidence is null or not (new.evidence @> old.evidence)
      or new.client is distinct from old.client
      or new.section is distinct from old.section or new.item is distinct from old.item)
    and old.evidence <> '[]'::jsonb and not private.can_delete_audit_evidence() then
    raise exception 'Only the authorized superadmin can remove audit evidence' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_audit_evidence_references() from public;
drop trigger if exists protect_audit_evidence_references on public.seo_initial_audit_items;
create trigger protect_audit_evidence_references
  before update or delete on public.seo_initial_audit_items
  for each row execute function private.protect_audit_evidence_references();

commit;
