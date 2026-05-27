-- Daily Google Ads metrics per account
create table if not exists public.sem_ads_daily (
  id           bigint generated always as identity primary key,
  account_id   text        not null,
  date         date        not null,
  spend        numeric     not null default 0,
  clicks       integer     not null default 0,
  conversions  numeric     not null default 0,
  impressions  bigint      not null default 0,
  interactions bigint      not null default 0,
  updated_at   timestamptz not null default now(),
  constraint sem_ads_daily_uq unique (account_id, date)
);

alter table public.sem_ads_daily enable row level security;
create policy "Service role full access" on public.sem_ads_daily using (true) with check (true);

-- Daily Google Guarantee (LSA) metrics per account
create table if not exists public.sem_guarantee_daily (
  id             bigint generated always as identity primary key,
  account_id     text        not null,
  date           date        not null,
  spend          numeric     not null default 0,
  leads          integer     not null default 0,
  ad_impressions bigint      not null default 0,
  updated_at     timestamptz not null default now(),
  constraint sem_guarantee_daily_uq unique (account_id, date)
);

alter table public.sem_guarantee_daily enable row level security;
create policy "Service role full access" on public.sem_guarantee_daily using (true) with check (true);
