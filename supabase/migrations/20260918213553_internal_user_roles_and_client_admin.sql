-- Internal dashboard authorization and client administration hardening.
-- Clients are companies. Dashboard users are XMS team members only.

create schema if not exists private;
revoke all on schema private from public;

create table if not exists public.dashboard_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'user' check (role in ('superadmin', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_user_roles_xms_email_check
    check (lower(email) like '%@xperienceusa.com')
);

alter table public.dashboard_user_roles enable row level security;

grant select, insert, update, delete on public.dashboard_user_roles to authenticated;
revoke all on public.dashboard_user_roles from anon;

create or replace function private.is_dashboard_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.dashboard_user_roles r
      where r.user_id = (select auth.uid())
        and r.role = 'superadmin'
    );
$$;

revoke all on function private.is_dashboard_superadmin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_dashboard_superadmin() to authenticated;

drop policy if exists "Internal users can view their role" on public.dashboard_user_roles;
create policy "Internal users can view their role"
  on public.dashboard_user_roles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Superadmins can view all roles" on public.dashboard_user_roles;
create policy "Superadmins can view all roles"
  on public.dashboard_user_roles for select to authenticated
  using ((select private.is_dashboard_superadmin()));

drop policy if exists "Superadmins can insert roles" on public.dashboard_user_roles;
create policy "Superadmins can insert roles"
  on public.dashboard_user_roles for insert to authenticated
  with check (
    lower(email) like '%@xperienceusa.com'
    and (select private.is_dashboard_superadmin())
  );

drop policy if exists "Superadmins can update roles" on public.dashboard_user_roles;
create policy "Superadmins can update roles"
  on public.dashboard_user_roles for update to authenticated
  using ((select private.is_dashboard_superadmin()))
  with check (
    lower(email) like '%@xperienceusa.com'
    and (select private.is_dashboard_superadmin())
  );

drop policy if exists "Superadmins can delete roles" on public.dashboard_user_roles;
create policy "Superadmins can delete roles"
  on public.dashboard_user_roles for delete to authenticated
  using (
    user_id <> (select auth.uid())
    and (select private.is_dashboard_superadmin())
  );

insert into public.dashboard_user_roles (user_id, email, role)
select
  id,
  lower(email),
  case when lower(email) = 'rafael.castillo@xperienceusa.com' then 'superadmin' else 'user' end
from auth.users
where lower(email) like '%@xperienceusa.com'
on conflict (user_id) do update
set email = excluded.email,
    role = case
      when excluded.email = 'rafael.castillo@xperienceusa.com' then 'superadmin'
      else public.dashboard_user_roles.role
    end,
    updated_at = now();

create or replace function private.register_internal_dashboard_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(new.email) like '%@xperienceusa.com' then
    insert into public.dashboard_user_roles (user_id, email, role)
    values (
      new.id,
      lower(new.email),
      case when lower(new.email) = 'rafael.castillo@xperienceusa.com' then 'superadmin' else 'user' end
    )
    on conflict (user_id) do update
      set email = excluded.email,
          updated_at = now();
  else
    delete from public.dashboard_user_roles where user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.register_internal_dashboard_user() from public;

drop trigger if exists register_internal_dashboard_user on auth.users;
create trigger register_internal_dashboard_user
  after insert or update of email on auth.users
  for each row execute function private.register_internal_dashboard_user();

-- Every internal user can read clients. Only the superadmin can mutate them.
drop policy if exists "Authenticated users can view clients" on public.clients;
drop policy if exists "Authenticated users can insert clients" on public.clients;
drop policy if exists "Authenticated users can update clients" on public.clients;
drop policy if exists "Authenticated users can delete clients" on public.clients;

create policy "Internal users can view clients"
  on public.clients for select to authenticated
  using (
    exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid())
    )
  );

create policy "Superadmins can insert clients"
  on public.clients for insert to authenticated
  with check (
    exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'superadmin'
    )
  );

create policy "Superadmins can update clients"
  on public.clients for update to authenticated
  using (
    exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'superadmin'
    )
  )
  with check (
    exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'superadmin'
    )
  );

create policy "Superadmins can delete clients"
  on public.clients for delete to authenticated
  using (
    exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'superadmin'
    )
  );

-- Client profiles and logos are also client configuration.
drop policy if exists "Authenticated users can view client profiles" on public.client_profiles;
drop policy if exists "Authenticated users can insert client profiles" on public.client_profiles;
drop policy if exists "Authenticated users can update client profiles" on public.client_profiles;
drop policy if exists "Authenticated users can delete client profiles" on public.client_profiles;

create policy "Internal users can view client profiles"
  on public.client_profiles for select to authenticated
  using (
    exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid())
    )
  );

create policy "Superadmins can insert client profiles"
  on public.client_profiles for insert to authenticated
  with check (
    exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'superadmin'
    )
  );

create policy "Superadmins can update client profiles"
  on public.client_profiles for update to authenticated
  using (
    exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'superadmin'
    )
  )
  with check (
    exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'superadmin'
    )
  );

create policy "Superadmins can delete client profiles"
  on public.client_profiles for delete to authenticated
  using (
    exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'superadmin'
    )
  );

drop policy if exists "Authenticated users can view client assets" on storage.objects;
drop policy if exists "Authenticated users can upload client assets" on storage.objects;
drop policy if exists "Authenticated users can update client assets" on storage.objects;
drop policy if exists "Authenticated users can delete client assets" on storage.objects;

create policy "Internal users can view client assets"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'client-assets'
    and exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid())
    )
  );

create policy "Superadmins can upload client assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'client-assets'
    and exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'superadmin'
    )
  );

create policy "Superadmins can update client assets"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'client-assets'
    and exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'superadmin'
    )
  )
  with check (
    bucket_id = 'client-assets'
    and exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'superadmin'
    )
  );

create policy "Superadmins can delete client assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'client-assets'
    and exists (
      select 1 from public.dashboard_user_roles r
      where r.user_id = (select auth.uid()) and r.role = 'superadmin'
    )
  );

-- Keep the existing secret-writing implementation, but put it behind an
-- invoker-rights role check in the exposed public schema.
alter function public.set_client_ad_token(text, text, text) set schema private;
alter function private.set_client_ad_token(text, text, text) rename to set_client_ad_token_internal;
revoke all on function private.set_client_ad_token_internal(text, text, text) from public;
grant usage on schema private to authenticated;
grant execute on function private.set_client_ad_token_internal(text, text, text) to authenticated;

create function public.set_client_ad_token(
  p_client_id text,
  p_provider text,
  p_token text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.dashboard_user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'superadmin'
  ) then
    raise exception 'Only the dashboard superadmin can update client tokens'
      using errcode = '42501';
  end if;

  perform private.set_client_ad_token_internal(p_client_id, p_provider, p_token);
end;
$$;

revoke all on function public.set_client_ad_token(text, text, text) from public;
grant execute on function public.set_client_ad_token(text, text, text) to authenticated;

-- Merge the duplicate XMS client into the fully configured client.
insert into public.social_weekly_goals (client_id, metric, target, updated_at)
select 'xperience-ai-marketing', metric, target, updated_at
from public.social_weekly_goals
where client_id = 'xms-ai'
on conflict (client_id, metric) do update
set target = excluded.target,
    updated_at = greatest(public.social_weekly_goals.updated_at, excluded.updated_at);

delete from public.social_weekly_goals where client_id = 'xms-ai';
update public.seo_client_reports
set client_id = 'xperience-ai-marketing'
where client_id = 'xms-ai';
delete from public.client_profiles where client_id = 'xms-ai';
delete from public.clients where id = 'xms-ai';

-- A Google property/account can belong to only one dashboard client.
create unique index if not exists clients_gsc_property_uq
  on public.clients (gsc_property) where gsc_property is not null;
create unique index if not exists clients_ga4_property_id_uq
  on public.clients (ga4_property_id) where ga4_property_id is not null;
create unique index if not exists clients_sem_account_id_uq
  on public.clients (sem_account_id) where sem_account_id is not null;
