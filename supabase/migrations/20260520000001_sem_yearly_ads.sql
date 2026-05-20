create table if not exists public.sem_yearly_ads (
  id            bigint generated always as identity primary key,
  account_id    text        not null,
  year          integer     not null,
  month         text        not null,
  month_index   integer     not null,
  service       text        not null default 'Google Ads',
  spend         numeric     not null default 0,
  clicks        integer     not null default 0,
  conversions   numeric     not null default 0,
  impressions   bigint      not null default 0,
  ctr           numeric     not null default 0,
  avg_cpc       numeric     not null default 0,
  interactions  bigint      not null default 0,
  opt_score     numeric     not null default 0,
  updated_at    timestamptz not null default now(),
  constraint sem_yearly_ads_uq unique (account_id, year, month)
);

alter table public.sem_yearly_ads enable row level security;

create policy "Service role full access"
  on public.sem_yearly_ads
  using (true)
  with check (true);
