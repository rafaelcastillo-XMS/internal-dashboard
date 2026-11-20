-- Close anonymous (no-login) access to dashboard tables.
-- The anon key ships in the frontend bundle, so any policy granted to `anon`
-- (or `public`, which includes anon) is readable/writable by anyone on the internet.
-- Every dashboard read/write runs with a logged-in session (`authenticated`);
-- edge functions that write SEM data use the service role, which bypasses RLS.
--
-- Not touched on purpose:
--   sem_clients, sem_planning_sessions -> owned by the separate SEM Planning project
--   leads (anon INSERT only)           -> public form insert, no read access
--   profiles, user_calendar_preferences -> already scoped to auth.uid()

-- ── SEO: drop anon policies (authenticated policies already exist) ──────────
drop policy if exists "anon insert on seo_ahrefs_snapshots" on public.seo_ahrefs_snapshots;
drop policy if exists "anon select on seo_ahrefs_snapshots" on public.seo_ahrefs_snapshots;
drop policy if exists "anon update on seo_ahrefs_snapshots" on public.seo_ahrefs_snapshots;

drop policy if exists "anon delete on seo_client_reports" on public.seo_client_reports;
drop policy if exists "anon insert on seo_client_reports" on public.seo_client_reports;
drop policy if exists "anon select on seo_client_reports" on public.seo_client_reports;

drop policy if exists "anon insert on seo_initial_audit_items" on public.seo_initial_audit_items;
drop policy if exists "anon select on seo_initial_audit_items" on public.seo_initial_audit_items;
drop policy if exists "anon update on seo_initial_audit_items" on public.seo_initial_audit_items;

drop policy if exists "anon select on seo_initial_findings" on public.seo_initial_findings;

drop policy if exists "anon delete on seo_onpage_audits" on public.seo_onpage_audits;
drop policy if exists "anon insert on seo_onpage_audits" on public.seo_onpage_audits;
drop policy if exists "anon select on seo_onpage_audits" on public.seo_onpage_audits;
drop policy if exists "anon update on seo_onpage_audits" on public.seo_onpage_audits;

-- ── SEM / Social: `public` role -> `authenticated` ──────────────────────────
alter policy "public read" on public.sem_accounts  to authenticated;
alter policy "public read" on public.sem_campaigns to authenticated;
alter policy "public read" on public.sem_keywords  to authenticated;

alter policy "Service role full access" on public.sem_ads_daily             to authenticated;
alter policy "Service role full access" on public.sem_guarantee_daily       to authenticated;
alter policy "Service role full access" on public.sem_monthly_cells         to authenticated;
alter policy "Service role full access" on public.sem_monthly_report_rows   to authenticated;
alter policy "Service role full access" on public.sem_monthly_report_values to authenticated;
alter policy "Service role full access" on public.sem_report_budgets        to authenticated;
alter policy "Service role full access" on public.social_weekly_goals       to authenticated;

-- ── cookie_consents: keep anon insert only (no reading/editing others' rows) ─
drop policy if exists "anon can read own consent"   on public.cookie_consents;
drop policy if exists "anon can update own consent" on public.cookie_consents;
