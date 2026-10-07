-- Internal users can detect saved credentials without reading the token column.
alter table public.client_ad_secrets enable row level security;
revoke select on public.client_ad_secrets from anon, authenticated;
revoke select (token) on public.client_ad_secrets from anon, authenticated;
grant select (client_id, provider, updated_at) on public.client_ad_secrets to authenticated;
drop policy if exists "Internal users can view ad connection metadata" on public.client_ad_secrets;
create policy "Internal users can view ad connection metadata"
  on public.client_ad_secrets for select to authenticated
  using (exists (
    select 1 from public.dashboard_user_roles r
    where r.user_id = (select auth.uid())
  ));
