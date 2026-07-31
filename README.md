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
- Client integrations for Notion, NotebookLM, and Google services
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

- This repository is private and intended for internal XMS use.
- Generated builds, local reports, PDF QA renders, secrets, and OAuth tokens are
  intentionally excluded from version control.
- Some integrations need separate provider credentials or access grants before
  their screens can return live data.
