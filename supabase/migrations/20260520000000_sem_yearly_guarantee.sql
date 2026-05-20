create table if not exists public.sem_yearly_guarantee (
  id            bigint generated always as identity primary key,
  account_id    text        not null,
  year          integer     not null,
  month         text        not null,
  month_index   integer     not null,
  service       text        not null default 'Google Guarantee',
  spend         numeric     not null default 0,
  leads         integer     not null default 0,
  cost_per_lead numeric     not null default 0,
  ad_impressions bigint     not null default 0,
  top_imp_rate   numeric    not null default 0,
  abs_top_imp_rate numeric  not null default 0,
  created_at    timestamptz not null default now(),
  constraint sem_yearly_guarantee_uq unique (account_id, year, month)
);

alter table public.sem_yearly_guarantee enable row level security;

create policy "Service role full access"
  on public.sem_yearly_guarantee
  using (true)
  with check (true);
