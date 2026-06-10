-- Monthly SEM budget report: rows are managed manually (client + platform + account),
-- spend comes from sem_yearly_ads / sem_yearly_guarantee, OpenAI Ads spend is manual.

create table if not exists public.sem_monthly_report_rows (
  id             bigint generated always as identity primary key,
  client_name    text    not null,
  account_id     text,
  platform       text    not null default 'Google Ads',
  budget         numeric not null default 0,
  payment_source text    not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.sem_monthly_report_rows enable row level security;

create policy "Service role full access"
  on public.sem_monthly_report_rows
  using (true)
  with check (true);

-- Per-month editable values for a report row (refunded credits, manual spend for OpenAI Ads)
create table if not exists public.sem_monthly_report_values (
  id           bigint generated always as identity primary key,
  row_id       bigint  not null references public.sem_monthly_report_rows(id) on delete cascade,
  year         integer not null,
  month_index  integer not null,
  refunded     numeric not null default 0,
  manual_spend numeric,
  updated_at   timestamptz not null default now(),
  constraint sem_monthly_report_values_uq unique (row_id, year, month_index)
);

alter table public.sem_monthly_report_values enable row level security;

create policy "Service role full access"
  on public.sem_monthly_report_values
  using (true)
  with check (true);
