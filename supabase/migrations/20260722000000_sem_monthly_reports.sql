-- Persistent Monthly Reports slide decks.
-- This table is intentionally separate from sem_monthly_report_rows/values,
-- which belong to the SEM budget report.

create table if not exists public.sem_monthly_reports (
  id          text primary key,
  account_id  text        not null,
  client_name text        not null,
  client_logo text        not null default '',
  month       text        not null,
  year        integer     not null,
  status      text        not null default 'Draft'
                          check (status in ('Draft', 'In Review', 'Ready')),
  slides      jsonb       not null default '[]'::jsonb
                          check (jsonb_typeof(slides) = 'array'),
  created_by  uuid        default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists sem_monthly_reports_account_updated_idx
  on public.sem_monthly_reports (account_id, updated_at desc);

create index if not exists sem_monthly_reports_period_idx
  on public.sem_monthly_reports (account_id, year desc, month);

alter table public.sem_monthly_reports enable row level security;

revoke all on table public.sem_monthly_reports from anon;
grant select, insert, update, delete on table public.sem_monthly_reports to authenticated;
grant all on table public.sem_monthly_reports to service_role;

create policy "Authenticated users can view SEM monthly reports"
  on public.sem_monthly_reports for select
  to authenticated using (true);

create policy "Authenticated users can create SEM monthly reports"
  on public.sem_monthly_reports for insert
  to authenticated with check (true);

create policy "Authenticated users can update SEM monthly reports"
  on public.sem_monthly_reports for update
  to authenticated using (true) with check (true);

create policy "Authenticated users can delete SEM monthly reports"
  on public.sem_monthly_reports for delete
  to authenticated using (true);

drop trigger if exists set_updated_at_sem_monthly_reports on public.sem_monthly_reports;
create trigger set_updated_at_sem_monthly_reports
  before update on public.sem_monthly_reports
  for each row execute function public.handle_updated_at();
