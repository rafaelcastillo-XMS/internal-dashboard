import express from "express"
import { fileURLToPath } from "url"
import path from "path"
import fs from "fs"
import { getCompanySkillsCatalog } from "./server/companySkills.js"
import { optimizePromptWithOpenAI } from "./server/openaiPromptOptimizer.js"
import { getGbpReport, listGbpLocations } from "./server/gbpReport.js"
import { AhrefsApiError, getAhrefsSnapshot } from "./server/ahrefs.js"
import { MetaApiError, getAdCampaigns, getCampaignInsightsSeries, getFacebookPageSnapshot } from "./server/metaGraph.js"
import { registerGoogleAuthRoutes, registerGbpAuthRoutes } from "./server/googleAuth.js"
import { handleNotionClientSyncRequest, queryRelatedNotionData, queryNotionClientCovers, syncClientFromNotion } from "./server/notionSync.js"
import { buildMondayEmailMap, fetchMondayTasksForUser, fetchMondayTaskDetail } from "./server/mondayTasks.js"
import { askDashboardAi, getTaskInsight, getSemInsights, getSeoInsights, getSocialInsights } from "./server/aiInsights.js"
import { sanitizePdfFilename, exportPdfBuffer } from "./server/pdfExport.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEO_AUDIT_PROMPT_PATH = path.join(__dirname, 'prompts', 'seo-audit-history.md')
const app = express()
app.use(express.json())
const PORT = process.env.PORT ?? 3000

// ─── Security headers ─────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  next()
})

// ─── Supabase Edge Function proxy ────────────────────────────────────────────

const SUPABASE_URL      = "https://sjpvyxdyleebhqlmqscy.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcHZ5eGR5bGVlYmhxbG1xc2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzgxODksImV4cCI6MjA4ODc1NDE4OX0.ZvzbBm-L8Jt3FzhmmX3qd7_inwrupjQrfh9JWIlX1ng"

// ─── POST /api/notion/clients/:clientId/sync ────────────────────────────────
app.post("/api/notion/clients/:clientId/sync", async (req, res) => {
  await handleNotionClientSyncRequest(req, res, {
    clientId: req.params.clientId,
    notionApiKey: process.env.NOTION_API_KEY ?? "",
    notionDataSourceId: process.env.NOTION_DATA_SOURCE_ID ?? "",
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
  })
})

app.get("/api/notion/clients/:clientId/related", async (req, res) => {
  try {
    const auth = req.headers.authorization ?? ""
    if (!/^Bearer\s+\S+/i.test(auth)) return res.status(401).json({ error: "A valid dashboard session is required." })
    const clientId = req.params.clientId
    const clientResponse = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(clientId)}&select=id,name`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth },
    })
    const clients = await clientResponse.json()
    if (!clientResponse.ok || !clients[0]) return res.status(clientResponse.ok ? 404 : 502).json({ error: "Client not found." })
    const result = await queryRelatedNotionData({
      clientId,
      clientName: clients[0].name,
      notionApiKey: process.env.NOTION_API_KEY ?? "",
      notionDataSourceId: process.env.NOTION_DATA_SOURCE_ID ?? "",
    })
    res.setHeader("Cache-Control", "no-store")
    return res.json(result)
  } catch (error) {
    const statusCode = error?.statusCode ?? 500
    const message = error instanceof Error ? error.message : "Unable to load related Notion data."
    console.error("[notion-related]", message)
    return res.status(statusCode).json({ error: message })
  }
})

app.get("/api/notion/clients/covers", async (req, res) => {
  try {
    const auth = req.headers.authorization ?? ""
    if (!/^Bearer\s+\S+/i.test(auth)) return res.status(401).json({ error: "A valid dashboard session is required." })
    const clientsResponse = await fetch(`${SUPABASE_URL}/rest/v1/clients?select=id,name`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth } })
    const clients = await clientsResponse.json()
    if (!clientsResponse.ok) return res.status(502).json({ error: "Unable to load dashboard clients." })
    const covers = await queryNotionClientCovers({ clients, notionApiKey: process.env.NOTION_API_KEY ?? "", notionDataSourceId: process.env.NOTION_DATA_SOURCE_ID ?? "" })
    res.setHeader("Cache-Control", "no-store")
    return res.json({ covers })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Notion covers."
    console.error("[notion-covers]", message)
    return res.status(error?.statusCode ?? 500).json({ error: message })
  }
})

app.post("/api/notion/clients/sync-all", async (req, res) => {
  try {
    const auth = req.headers.authorization ?? ""
    if (!/^Bearer\s+\S+/i.test(auth)) return res.status(401).json({ error: "A valid dashboard session is required." })
    const response = await fetch(`${SUPABASE_URL}/rest/v1/clients?select=id`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth } })
    const clients = await response.json()
    if (!response.ok) return res.status(502).json({ error: "Unable to load dashboard clients." })
    const results = []
    for (const client of clients) {
      try {
        results.push(await syncClientFromNotion({ clientId: client.id, authorization: auth, notionApiKey: process.env.NOTION_API_KEY ?? "", notionDataSourceId: process.env.NOTION_DATA_SOURCE_ID ?? "", supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY }))
      } catch (error) {
        results.push({ clientId: client.id, error: error instanceof Error ? error.message : "Synchronization failed." })
      }
    }
    return res.json({ success: true, results })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to synchronize clients." })
  }
})

// ─── GET /api/sem/search-terms?accountId=...&startDate=...&endDate=... ────────
app.get("/api/sem/search-terms", async (req, res) => {
  const accountId = req.query.accountId ?? ""
  const startDate = req.query.startDate ?? ""
  const endDate   = req.query.endDate   ?? ""

  if (!accountId || !startDate || !endDate) {
    return res.status(400).json({ error: "accountId, startDate, and endDate are required" })
  }

  try {
    const edgeUrl = `${SUPABASE_URL}/functions/v1/sem/search-terms?accountId=${encodeURIComponent(accountId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
    const upstream = await fetch(edgeUrl, {
      headers: {
        apikey:        SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
    })
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search terms error"
    console.error("[sem-search-terms]", message)
    res.status(500).json({ error: message })
  }
})

// ─── GET /api/monday/tasks/:taskId ───────────────────────────────────────────
app.get("/api/monday/tasks/:taskId", async (req, res) => {
  const mondayToken = process.env.MONDAY_API_TOKEN ?? ""
  try {
    res.json(await fetchMondayTaskDetail({ mondayToken, taskId: req.params.taskId }))
  } catch (err) {
    const message = err instanceof Error ? err.message : "Monday API error"
    console.error("[monday-detail]", message)
    res.status(err?.statusCode ?? 500).json({ error: message })
  }
})

// ─── GET /api/monday/tasks?email=... ─────────────────────────────────────────
app.get("/api/monday/tasks", async (req, res) => {
  const mondayToken = process.env.MONDAY_API_TOKEN ?? ""

  // Only enforce secret when INTERNAL_API_SECRET is configured
  const internalSecret = process.env.INTERNAL_API_SECRET ?? ""
  const authHeader = req.headers["authorization"] ?? ""
  if (internalSecret && authHeader !== `Bearer ${internalSecret}`) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const emailMap = buildMondayEmailMap(process.env.MONDAY_EMAIL_MAP)
  const sessionEmail = req.query.email ?? ""
  const mondayEmail = emailMap[sessionEmail] ?? sessionEmail
  const bust = req.query.bust === "1"

  try {
    res.json(await fetchMondayTasksForUser({ mondayToken, sessionEmail: mondayEmail, bust }))
  } catch (err) {
    const message = err instanceof Error ? err.message : "Monday API error"
    console.error("[monday-api]", message)
    res.status(err?.statusCode ?? 500).json({ error: message })
  }
})

// ─── POST /api/ai/ask ─────────────────────────────────────────────────────────
app.post("/api/ai/ask", async (req, res) => {
  try {
    res.json(await askDashboardAi(req.body ?? {}))
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI error"
    console.error("[ai-ask]", message)
    res.status(err?.statusCode ?? 500).json({ error: message })
  }
})

// ─── POST /api/ai/prompt-optimize ────────────────────────────────────────────
app.post("/api/ai/prompt-optimize", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : ""
  if (!prompt) return res.status(400).json({ error: "prompt is required" })

  try {
    const result = await optimizePromptWithOpenAI(prompt.slice(0, 12_000))
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI prompt optimization failed"
    console.error("[ai-prompt-optimize]", message)
    res.status(err?.statusCode ?? 502).json({ error: message })
  }
})

// ─── POST /api/ai/task-insight ───────────────────────────────────────────────
app.post("/api/ai/task-insight", async (req, res) => {
  try {
    res.json(await getTaskInsight(req.body ?? {}))
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI error"
    console.error("[ai-task-insight]", message)
    res.status(err?.statusCode ?? 500).json({ error: message })
  }
})

// ─── POST /api/ai/sem-insights ───────────────────────────────────────────────
app.post("/api/ai/sem-insights", async (req, res) => {
  try {
    res.json(await getSemInsights(req.body ?? {}))
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI error"
    console.error("[ai-sem-insights]", message)
    res.status(err?.statusCode ?? 500).json({ error: message })
  }
})

// ─── POST /api/ai/seo-insights ───────────────────────────────────────────────
app.post("/api/ai/seo-insights", async (req, res) => {
  try {
    res.json(await getSeoInsights(req.body ?? {}))
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI error"
    console.error("[ai-seo-insights]", message)
    res.status(err?.statusCode ?? 500).json({ error: message })
  }
})

// ─── POST /api/ai/social-insights ────────────────────────────────────────────
app.post("/api/ai/social-insights", async (req, res) => {
  try {
    res.json(await getSocialInsights(req.body ?? {}))
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI error"
    console.error("[ai-social-insights]", message)
    res.status(err?.statusCode ?? 500).json({ error: message })
  }
})

// ─── SEO: On-Page Audit (n8n webhook + result store) ─────────────────────────
const auditResultStore = new Map()

// N8N posts the finished HTML report here
app.post('/api/seo/onpage-audit/result', async (req, res) => {
  const callbackSecret = process.env.N8N_CALLBACK_SECRET ?? ''
  const authHeader = req.headers['authorization'] ?? ''
  if (!callbackSecret || authHeader !== `Bearer ${callbackSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const { url, html } = req.body ?? {}
  if (!url || !html) {
    return res.status(400).json({ error: 'url and html are required' })
  }
  auditResultStore.set(url, { html, receivedAt: Date.now() })
  res.json({ success: true })
})

// Frontend polls this until ready
app.get('/api/seo/onpage-audit/result', (req, res) => {
  const url = req.query.url ?? ''
  if (!url) return res.status(400).json({ error: 'url param required' })
  const entry = auditResultStore.get(url)
  if (!entry) return res.json({ ready: false })
  res.json({ ready: true, html: entry.html, receivedAt: entry.receivedAt })
})

// Frontend submits audit request — we forward to n8n
app.post('/api/seo/onpage-audit', async (req, res) => {
  const webhookUrl = process.env.N8N_ONPAGE_AUDIT_WEBHOOK ?? ''
  if (!webhookUrl) {
    return res.status(503).json({ error: 'N8N_ONPAGE_AUDIT_WEBHOOK is not configured' })
  }
  const { landingPageUrl, screamingFrogSheetUrl, client } = req.body ?? {}
  if (!landingPageUrl || !screamingFrogSheetUrl) {
    return res.status(400).json({ error: 'landingPageUrl and screamingFrogSheetUrl are required' })
  }
  let parsedLanding, parsedSheet
  try { parsedLanding = new URL(landingPageUrl) } catch { return res.status(400).json({ error: 'landingPageUrl must be a valid URL' }) }
  try { parsedSheet   = new URL(screamingFrogSheetUrl) } catch { return res.status(400).json({ error: 'screamingFrogSheetUrl must be a valid URL' }) }
  if (parsedLanding.protocol !== 'https:') return res.status(400).json({ error: 'landingPageUrl must use https' })
  if (parsedSheet.protocol   !== 'https:') return res.status(400).json({ error: 'screamingFrogSheetUrl must use https' })

  try {
    // Read on every run so manual prompt edits take effect without rebuilding.
    const scoringPrompt = fs.readFileSync(SEO_AUDIT_PROMPT_PATH, 'utf8').trim()
    const n8nRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'Landing Page Url': landingPageUrl,
        'Screaming Frog Google Sheet URL': screamingFrogSheetUrl,
        'Client Name': typeof client === 'string' ? client.trim() : '',
        'XMS Website Health Score Prompt': scoringPrompt,
        'Scoring Prompt File': 'prompts/seo-audit-history.md',
      }),
    })
    if (!n8nRes.ok) return res.status(502).json({ error: `N8N webhook returned ${n8nRes.status}` })
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'N8N request failed'
    console.error('[seo-api/onpage-audit]', message)
    res.status(500).json({ error: message })
  }
})

// ── SEO: PageSpeed Insights ──────────────────────────────────────────────────
app.get('/api/seo/pagespeed', async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url is required' })
  const key = process.env.PSI_API_KEY
  if (!key) return res.status(503).json({ error: 'PSI_API_KEY is not configured' })
  try {
    const psiRes = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${key}`
    )
    const data = await psiRes.json()
    if (!psiRes.ok) return res.status(502).json({ error: data.error?.message ?? 'PSI error' })
    const score = Math.round((data.lighthouseResult?.categories?.performance?.score ?? 0) * 100)
    res.json({ score, url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── SEO: Ahrefs Domain Snapshot ──────────────────────────────────────────────
app.get('/api/seo/ahrefs-snapshot', async (req, res) => {
  try {
    const snapshot = await getAhrefsSnapshot({
      apiKey: process.env.AHREFS_API_KEY ?? '',
      target: req.query.target,
    })
    res.json(snapshot)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ahrefs request failed'
    const status = error instanceof AhrefsApiError ? error.upstreamStatus : 500
    console.error('[seo/ahrefs]', status, message)
    res.status(status >= 400 && status < 600 ? status : 502).json({ error: message })
  }
})

// ── Social: Facebook Page snapshot (Meta Graph API) ──────────────────────────
app.get('/api/social/facebook', async (req, res) => {
  try {
    const snapshot = await getFacebookPageSnapshot({
      accessToken: process.env.META_ACCESS_TOKEN ?? '',
      pageId:      process.env.META_PAGE_ID      ?? '',
      since: typeof req.query.since === 'string' ? req.query.since : '',
      until: typeof req.query.until === 'string' ? req.query.until : '',
    })
    res.json(snapshot)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Meta Graph API error'
    const status = error instanceof MetaApiError ? error.upstreamStatus : 500
    console.error('[social/facebook]', status, message)
    res.status(status >= 400 && status < 600 ? status : 502).json({ error: message })
  }
})

// ── Social: Meta ad campaigns ────────────────────────────────────────────────
app.get('/api/social/campaigns', async (req, res) => {
  try {
    const result = await getAdCampaigns({
      accessToken: process.env.META_ACCESS_TOKEN ?? '',
      pageId:      process.env.META_PAGE_ID      ?? '',
      since: typeof req.query.since === 'string' ? req.query.since : '',
      until: typeof req.query.until === 'string' ? req.query.until : '',
    })
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Meta Ads API error'
    const status = error instanceof MetaApiError ? error.upstreamStatus : 500
    console.error('[social/campaigns]', status, message)
    res.status(status >= 400 && status < 600 ? status : 502).json({ error: message })
  }
})

// ── Social: daily breakdown for one campaign (detail modal charts) ──────────
app.get('/api/social/campaigns/:campaignId/insights', async (req, res) => {
  try {
    const result = await getCampaignInsightsSeries({
      accessToken: process.env.META_ACCESS_TOKEN ?? '',
      campaignId: req.params.campaignId,
      since: typeof req.query.since === 'string' ? req.query.since : '',
      until: typeof req.query.until === 'string' ? req.query.until : '',
    })
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Meta Ads API error'
    const status = error instanceof MetaApiError ? error.upstreamStatus : 500
    console.error('[social/campaign-insights]', status, message)
    res.status(status >= 400 && status < 600 ? status : 502).json({ error: message })
  }
})

// ── Google OAuth reconnect (status / start / callback) ───────────────────────
registerGoogleAuthRoutes(app)
registerGbpAuthRoutes(app)

// ── SEO: Google Business Profile report ──────────────────────────────────────
app.get('/api/seo/gbp/locations', async (_req, res) => {
  try {
    res.json({ locations: await listGbpLocations() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GBP locations failed'
    console.error('[seo/gbp/locations]', message)
    res.status(500).json({ error: message })
  }
})

app.get('/api/seo/gbp', async (req, res) => {
  try {
    const data = await getGbpReport({
      site: req.query.site,
      ga4: req.query.ga4,
      client: req.query.client,
      gbpAccount: req.query.gbpAccount,
      gbpLocation: req.query.gbpLocation,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    })
    res.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GBP report failed'
    console.error('[seo/gbp]', message)
    res.status(500).json({ error: message })
  }
})

// ── PDF export (ReportLab via tools/pdf_export.py) ───────────────────────────
app.post('/api/export/pdf', async (req, res) => {
  const { filename, payload } = req.body ?? {}
  if (!payload) return res.status(400).json({ error: 'payload is required' })

  try {
    const pdfBuffer = await exportPdfBuffer(payload)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizePdfFilename(filename)}"`)
    res.end(pdfBuffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF export error'
    console.error('[pdf-export]', message)
    res.status(500).json({ error: message })
  }
})

// ── Company Skills catalog ───────────────────────────────────────────────────
app.get('/api/company-skills', async (req, res) => {
  try {
    const refresh = req.query.refresh === '1'
    const catalog = await getCompanySkillsCatalog({ refresh })
    res.json(catalog)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Company skills request failed'
    console.error('[company-skills]', message)
    res.status(500).json({ error: message })
  }
})

// ─── Serve Vite build + SPA fallback ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, "dist")))

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"))
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
