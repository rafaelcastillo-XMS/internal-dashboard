-- Daily reconciliation of sem_accounts against the live Google Ads MCC roster.
-- Calls the `sem` edge function /sync endpoint once a day at 06:00 UTC.
-- Account rosters change rarely, so daily is sufficient and keeps API/cron load minimal.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any prior schedule before re-creating.
select cron.unschedule('sem-accounts-sync')
where exists (select 1 from cron.job where jobname = 'sem-accounts-sync');

select cron.schedule(
  'sem-accounts-sync',
  '0 6 * * *',
  $$
  select net.http_post(
    url     := 'https://sjpvyxdyleebhqlmqscy.supabase.co/functions/v1/sem/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- anon key (public, also shipped to the browser) — only used to pass verify_jwt
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcHZ5eGR5bGVlYmhxbG1xc2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzgxODksImV4cCI6MjA4ODc1NDE4OX0.ZvzbBm-L8Jt3FzhmmX3qd7_inwrupjQrfh9JWIlX1ng'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
  $$
);
