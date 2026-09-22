# Dashboard XMS360

Internal operations dashboard for XMS teams. It centralizes clients, tasks,
calendar activity, reporting, integrations, and workspace information in one
authenticated application.

## Main modules

- Supabase authentication, user profiles, and client records
- Monday.com task views and team assignments
- Google Calendar activity
- SEM dashboards, campaigns, keywords, search terms, LSA data, and editable
  monthly reports stored in Supabase
- SEO dashboards, Ahrefs/PageSpeed data, GBP reporting, on-page audits, and
  quarterly PDF exports
- Social dashboards for Facebook, Instagram, and YouTube. The Facebook screen
  reads live page and post data from the Meta Graph API; reach, impressions and
  engagement counts stay locked until the Meta app clears App Review
- Client integrations for Notion and Google services
- Internal AI assistance powered by Anthropic

## SEO audit scoring prompt

The scoring instructions sent to the SEO audit workflow live in
`prompts/seo-audit-history.md`. The server reads this file on every new audit,
so manual edits apply to the next run without rebuilding the dashboard.

## Local development

Requirements:

- Node.js 20
- npm
- Python 3 when running the Google Ads, Analytics, Search Console, or PDF tools

```bash
npm install
cp .env.example .env
npm run dev
```

The Vite development server exposes the frontend and local API middleware. Fill
only the variables required for the integrations you intend to use; never commit
the resulting `.env`, OAuth tokens, or service-account files.

## Quality checks

```bash
npm test
npm run lint
npm run build
```

The test suite covers server integrations, client profiles, and SEM report data,
slides, and persistence.

## Production

Production runs the compiled Vite app behind the Express server:

```bash
cp .env.production.example .env.production
docker compose up --build
```

Google OAuth credential and token files are mounted by `docker-compose.yml` and
must exist on the host. Supabase Edge Functions and migrations live under
`supabase/`; deploy them through the project's normal Supabase workflow.

## Repository notes

### SEO Gmail connection

The `seo` Edge Function uses only `SEO_REFRESH_TOKEN` in Supabase secrets and
verifies `xperiencemarketingsolutions@gmail.com` before accessing GSC or GA4.
It never falls back to the Google Ads token. Short-lived access tokens refresh
automatically; temporary refresh failures are retried. Google can still revoke
the grant. The OAuth consent application must be **In production**: external
apps in **Testing** can issue refresh tokens that expire after seven days.
Check Google Cloud → Google Auth Platform → Audience for project
`absolute-range-136623`. Publishing status cannot be inferred from a working
access token.

Settings and client SEO integrations check `/functions/v1/seo/connection`,
including on focus and every five minutes while open. SEO pages show a warning
when that check fails. This is an in-app check, not an unattended alert service.

If Google requires authorization again, an administrator on a trusted computer
with this checkout, its ignored `credentials.json`, and Supabase CLI access runs:

```bash
npm run connect:seo
```

Open the printed loopback link on the same computer. Authorize the fixed Gmail
account with read permissions for both APIs. The helper verifies the identity,
permissions and OAuth client, then updates only `SEO_REFRESH_TOKEN`. Temporary
secret files are removed. Client property links remain saved; allow one minute
before checking the connection again. Never put Google tokens in chat, frontend
environment variables, or Git. This helper reconnects the Edge SEO service;
server-side GBP/quarterly-report OAuth remains separately configured.

- This repository is private and intended for internal XMS use.
- Generated builds, local reports, PDF QA renders, secrets, and OAuth tokens are
  intentionally excluded from version control.
- Some integrations need separate provider credentials or access grants before
  their screens can return live data.
