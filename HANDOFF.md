# Handoff — Dashboard XMS360

Internal notes for whoever picks up this repo next. Complements `README.md`
(setup/run commands) — this doc is gotchas, architecture decisions, and traps
that aren't obvious from reading the code cold. Verified against the repo on
2026-08-12.

## Stack

React + TypeScript + Vite + Tailwind + Supabase. Express (`server.js`) serves
the API in production; in dev the same routes are re-implemented as a Vite
plugin (`aiPlugin()` and others in `vite.config.ts`) — **any new API route
must be added in both places**, they don't share code.

## Data model

- `public.clients` (Supabase, project `sjpvyxdyleebhqlmqscy`) is the source of
  truth for clients: id slug, name, status, gsc_property, ga4_property_id,
  sem_account_id, notebooklm_*. Managed via the Clients view
  (`AllClients.tsx` / `ClientIntegrations.tsx`).
- SEO and SEM client selection are **intentionally not synced** — future plan
  is per-module user roles. Don't reintroduce a shared selector.
- Known gap: a client links to exactly one Ads account. Holt's Garage LSA
  account (`4101522507`) has no client record and is accessed directly from
  SEM — there's no clean place to attach a second Ads account per client yet.
- `sem_report_budgets` (ads_weekly / guarantee_weekly / ads_monthly) backs
  both `ClientIntegrations` and `SEMReportes` — same table, don't fork it.

## Social / Meta integration

Module: `/social`. Only `/social/facebook` reads live data (Meta Graph API
v21, System User token, non-expiring). Instagram/YouTube/`/social` root are
still mock.

- Blocked without a completed App Review + screencast: `read_insights`
  (reach, impressions, page views, demographics, follower deltas) and
  `pages_read_user_content` (like/comment/reaction counts). Don't try to
  backfill these with mock data — the UI uses `LockedCard` to say explicitly
  what's missing and why.
- Diagnostic tell: a metric that's **valid but permission-blocked** returns
  HTTP 200 with `data: []`. A metric that **doesn't exist** (or is deprecated
  in v21 — several old `page_*`/`post_*` metrics are) returns
  `(#100) The value must be a valid insights metric`.
- Page Insights needs a **Page Access Token**, not the System User token
  directly (`GET /{page-id}?fields=access_token`).
- The ad account (`act_3458336127615101`) is shared across every agency
  client — 238+ campaigns. Isolating one client's campaigns does NOT work by
  campaign name; filter ad sets by `promoted_object.page_id` against the
  client's `META_PAGE_ID`. Older traffic/landing campaigns predate this field
  and are excluded. Graph pagination caps at 100 — filter first, then fetch
  insights only for the surviving set (fetching insights during pagination
  roughly doubles request time).
- Business Suite's "weekly plan" has no API equivalent — confirmed by probing
  `weekly_plan`, `tasks`, `growth_plan`, `checklist`, `todos`,
  `recommendations`, all `Unknown path components`. It's UI-only.

## AI / LLM routes

Both `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are set in `.env` as of this
handoff. Two independent LLM integrations exist — don't conflate them:

- **Anthropic** (`claude-sonnet-4-6`): `/api/ai/ask`, `/api/ai/task-insight`,
  `/api/ai/sem-insights`, `/api/ai/seo-insights`, `/api/ai/social-insights`.
  Each route checks `process.env.ANTHROPIC_API_KEY` and 503s if absent, but
  that only checks the key exists — an empty credit balance still fails at
  call time with a 500.
- **OpenAI** (Responses API, `gpt-5.6` default via `OPENAI_MODEL`):
  `/api/ai/prompt-optimize` only, implemented in
  `server/openaiPromptOptimizer.js`, registered in both `server.js` and
  `vite.config.ts`. This is the Prompt Optimizer feature in the Prompts view
  — it rewrites a prompt into a structured `{summary, strengths,
  improvements, optimizedPrompt}` result.
- Separately, the **prompt audit** (five-pillar scoring: Role/Task/Context/
  Output format/Constraints) in `src/features/prompts/lib/promptAudit.ts` is
  deliberately regex-only, no LLM call. An earlier Claude-backed version of
  the audit was removed on purpose — don't re-add an LLM call there without
  checking with the team first.

## Code health (verified 2026-08-12)

- `npx tsc --noEmit -p tsconfig.app.json` — 0 errors.
- `npm test` — 39/39 passing, 8 files.
- `npx eslint .` — 0 errors, 25 warnings, all `react-hooks/exhaustive-deps`
  on `useCallback` deps that intentionally omit `state` (SEO pages) —
  pre-existing, not regressions.
- `git status` clean, no local uncommitted config drift.

## Deploy (Dokploy)

Auto-deploy on push to `main` of `rafaelcastillo-XMS/internal-dashboard`
(personal account, not the `XMS-Ai` org repo). Dokploy connects GitHub via a
**GitHub App installed per account** — if auto-deploy dies and repos vanish
from the project-creation selector, check
`github.com/settings/installations` → Dokploy on the personal account first,
not repo webhooks (this repo has none at the repo level). Two Git providers
now coexist in Dokploy (personal + org) after the org installation briefly
crowded out the personal one in July 2026. Transferring repos to the org
would still require org-admin access to fix the installation scope — the
current user is only a member there.

## Open items worth flagging to whoever's next

- Holt's LSA Ads account has no client record (see Data model above).
- Instagram/YouTube social screens are still mock — only Facebook is live.
- Meta App Review (for `read_insights` / `pages_read_user_content`) is not
  in progress as far as this handoff knows; check before promising those
  metrics to a client.
