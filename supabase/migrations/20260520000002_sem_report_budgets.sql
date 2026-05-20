create table if not exists public.sem_report_budgets (
  id          bigint generated always as identity primary key,
  account_id  text    not null,
  report_type text    not null,
  budget      numeric not null default 0,
  updated_at  timestamptz not null default now(),
  constraint sem_report_budgets_uq unique (account_id, report_type)
);

alter table public.sem_report_budgets enable row level security;

create policy "Service role full access"
  on public.sem_report_budgets
  using (true)
  with check (true);
