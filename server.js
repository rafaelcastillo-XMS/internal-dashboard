import express from "express"
import { fileURLToPath } from "url"
import path from "path"
import fs from "fs"
import os from "os"
import { execFile } from "child_process"
import { promisify } from "util"
import Anthropic from "@anthropic-ai/sdk"
import { getCompanySkillsCatalog } from "./server/companySkills.js"
import { getGbpReport } from "./server/gbpReport.js"
import { AhrefsApiError, getAhrefsSnapshot } from "./server/ahrefs.js"
import { registerGoogleAuthRoutes, registerGbpAuthRoutes } from "./server/googleAuth.js"

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
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

// ─── Monday.com cache (5-min TTL per user) ────────────────────────────────────
const mondayTaskCache = new Map()
const MONDAY_CACHE_TTL_MS = 5 * 60 * 1000

function buildEmailMap() {
  const raw = process.env.MONDAY_EMAIL_MAP ?? ""
  return Object.fromEntries(
    raw.split(",").filter(s => s.includes(":")).map(s => {
      const [k, v] = s.split(":").map(e => e.trim())
      return [k, v]
    })
  )
}

async function mondayGraphQL(token, query, variables = {}) {
  const resp = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
      "API-Version": "2024-01",
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!resp.ok) throw new Error(`Monday API HTTP ${resp.status}`)
  const json = await resp.json()
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join("; "))
  return json.data
}

// ─── Supabase Edge Function proxy ────────────────────────────────────────────

const SUPABASE_URL      = "https://sjpvyxdyleebhqlmqscy.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcHZ5eGR5bGVlYmhxbG1xc2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzgxODksImV4cCI6MjA4ODc1NDE4OX0.ZvzbBm-L8Jt3FzhmmX3qd7_inwrupjQrfh9JWIlX1ng"

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
  if (!mondayToken) return res.status(503).json({ error: "MONDAY_API_TOKEN is not configured" })
  const { taskId } = req.params
  if (!/^\d+$/.test(taskId)) return res.status(400).json({ error: "Invalid task ID" })
  try {
    const data = await mondayGraphQL(mondayToken, `
      query GetItemDetail($ids: [ID!]) {
        me { account { slug } }
        items(ids: $ids, newest_first: true) {
          id name
          board { id name }
          updates(limit: 5) {
            id body created_at
            creator { name photo_thumb_small }
          }
        }
      }
    `, { ids: [taskId] })
    const item = data?.items?.[0] ?? null
    if (!item) return res.status(404).json({ error: "Task not found" })
    const accountSlug = data?.me?.account?.slug ?? null
    const mondayUrl = accountSlug && item.board?.id
      ? `https://${accountSlug}.monday.com/boards/${item.board.id}/pulses/${item.id}`
      : null
    res.json({
      id: item.id,
      boardId: item.board?.id ?? null,
      boardName: item.board?.name ?? "Unknown Board",
      mondayUrl,
      updates: (item.updates ?? []).map(u => ({
        id: u.id, body: u.body, createdAt: u.created_at,
        creatorName: u.creator?.name ?? "Unknown",
        creatorAvatar: u.creator?.photo_thumb_small ?? null,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Monday API error"
    console.error("[monday-detail]", message)
    res.status(500).json({ error: message })
  }
})

// ─── GET /api/monday/tasks?email=... ─────────────────────────────────────────
app.get("/api/monday/tasks", async (req, res) => {
  const mondayToken = process.env.MONDAY_API_TOKEN ?? ""
  if (!mondayToken) {
    return res.status(503).json({ error: "MONDAY_API_TOKEN is not configured" })
  }

  // Only enforce secret when INTERNAL_API_SECRET is configured
  const internalSecret = process.env.INTERNAL_API_SECRET ?? ""
  const authHeader = req.headers["authorization"] ?? ""
  if (internalSecret && authHeader !== `Bearer ${internalSecret}`) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const emailMap = buildEmailMap()
  const sessionEmail = req.query.email ?? ""
  const mondayEmail = emailMap[sessionEmail] ?? sessionEmail
  const bust = req.query.bust === "1"

  try {
    const usersData = await mondayGraphQL(mondayToken, `
      query GetUsers($emails: [String]) {
        users(emails: $emails, limit: 1) {
          id name email photo_thumb_small
        }
      }
    `, { emails: mondayEmail ? [mondayEmail] : [] })

    const user = usersData?.users?.[0] ?? null
    if (!user) return res.json({ user: null, tasks: [] })

    // Serve from cache if fresh (skip cache when client requests a bust)
    if (bust) mondayTaskCache.delete(user.id)
    const cached = mondayTaskCache.get(user.id)
    if (cached && Date.now() - cached.at < MONDAY_CACHE_TTL_MS) {
      return res.json(cached.payload)
    }

    const itemsData = await mondayGraphQL(mondayToken, `
      query GetBoardItems {
        boards(limit: 50, state: active) {
          id name
          items_page(limit: 50) {
            items {
              id name state updated_at
              column_values {
                id text type
                ... on StatusValue { label index }
                ... on DateValue { date }
                ... on PeopleValue { persons_and_teams { id kind } }
              }
            }
          }
        }
      }
    `)

    const SUBITEMS_PREFIXES = ["subitems of", "subelementos de"]
    const isSubitemsBoard = name =>
      SUBITEMS_PREFIXES.some(p => name.toLowerCase().startsWith(p))

    const rawItems = (itemsData?.boards ?? [])
      .filter(board => !isSubitemsBoard(board.name))
      .flatMap(board =>
        (board.items_page?.items ?? [])
          .filter(item =>
            item.state !== "deleted" &&
            item.column_values.some(col =>
              col.type === "people" &&
              col.persons_and_teams?.some(
                p => p.kind === "person" && String(p.id) === String(user.id)
              )
            )
          )
          .map(item => ({ ...item, board: { id: board.id, name: board.name } }))
      )

    rawItems.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    const top20 = rawItems.slice(0, 20)

    const tasks = top20.map(item => {
      const byId = id => item.column_values.find(c => c.id === id)
      const byType = type => item.column_values.find(c => c.type === type)
      const statusCol = byId("status") ?? byType("status")
      const priorityCol = byId("priority") ?? byType("priority")
      const dueDateCol = byId("due_date") ?? byId("date") ?? byType("date")
      return {
        id: item.id,
        name: item.name,
        board: item.board?.name ?? "Unknown Board",
        status: statusCol?.label ?? statusCol?.text ?? "—",
        statusIndex: statusCol?.index ?? null,
        priority: priorityCol?.label ?? priorityCol?.text ?? null,
        priorityIndex: priorityCol?.index ?? null,
        dueDate: dueDateCol?.date ?? dueDateCol?.text ?? null,
        updatedAt: item.updated_at,
      }
    })

    const payload = {
      user: { id: user.id, name: user.name, email: user.email, avatar: user.photo_thumb_small },
      tasks,
    }
    mondayTaskCache.set(user.id, { at: Date.now(), payload })
    res.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Monday API error"
    console.error("[monday-api]", message)
    res.status(500).json({ error: message })
  }
})

// ─── POST /api/ai/ask ─────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

app.post("/api/ai/ask", async (req, res) => {
  const { query, context } = req.body ?? {}
  if (!query?.trim()) return res.status(400).json({ error: "query is required" })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "AI not configured" })

  const contextBlock = context ? `\n\nDashboard context:\n${JSON.stringify(context, null, 2)}` : ""

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are XMS AI, an assistant embedded in a marketing agency dashboard called XMS (Xperience Marketing Suite).
You help the team with tasks, campaigns, clients, SEM/SEO performance, and scheduling.
Respond in the same language the user writes in (Spanish or English).
Be concise and actionable — 2–4 sentences max unless a longer answer is clearly needed.
If you have dashboard context, use it to give specific answers. Never make up data you don't have.${contextBlock}`,
      messages: [{ role: "user", content: query }],
    })

    const text = message.content.find(b => b.type === "text")?.text ?? ""
    res.json({ response: text })
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI error"
    console.error("[ai-ask]", message)
    res.status(500).json({ error: message })
  }
})

// ─── POST /api/ai/task-insight ───────────────────────────────────────────────
app.post("/api/ai/task-insight", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "AI not configured" })
  const { task, updates } = req.body ?? {}
  if (!task?.name) return res.status(400).json({ error: "task is required" })

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })
  const updatesText = updates?.length
    ? updates.map(u =>
        `[${new Date(u.createdAt).toLocaleDateString()}] ${u.creatorName}: ${u.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`
      ).join("\n")
    : "No updates yet."

  const userPrompt = `Task: "${task.name}"
Status: ${task.status}
Priority: ${task.priority ?? "Not set"}
Due date: ${task.dueDate ?? "Not set"}
Board: ${task.board}
Today: ${today}

Recent updates/comments:
${updatesText}

Based on this task context, what should I do RIGHT NOW to move this forward? Give me 2–4 immediate next steps.`

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: `You are XMS AI, embedded in a marketing agency dashboard. You analyze task details and give concise, actionable next-step recommendations.
Respond in the same language as the task content (Spanish or English).
Format: 2–4 bullet points using "·" as the bullet character. Each point = one clear immediate action.
No intro sentence, no conclusion. Just the actions. Keep each bullet under 20 words.`,
      messages: [{ role: "user", content: userPrompt }],
    })
    const text = message.content.find(b => b.type === "text")?.text ?? ""
    res.json({ insight: text })
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI error"
    console.error("[ai-task-insight]", message)
    res.status(500).json({ error: message })
  }
})

// ─── POST /api/ai/sem-insights ───────────────────────────────────────────────
app.post("/api/ai/sem-insights", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "AI not configured" })
  const { accountName, summary, campaigns } = req.body ?? {}
  if (!accountName) return res.status(400).json({ error: "accountName is required" })

  const campaignText = (campaigns ?? []).slice(0, 8).map(c =>
    `• ${c.name}: ${Number(c.impressions).toLocaleString()} impressions, ${c.clicks} clicks, ${Number(c.ctr).toFixed(2)}% CTR, $${Number(c.avg_cpc).toFixed(2)} CPC, $${Number(c.cost).toFixed(2)} spend, ${c.conversions} conversions`
  ).join("\n") || "No campaign data available"

  const userPrompt = `Account: ${accountName}

Performance Summary:
• Impressions: ${Number(summary?.impressions ?? 0).toLocaleString()}
• Clicks: ${Number(summary?.clicks ?? 0).toLocaleString()}
• CTR: ${Number(summary?.ctr ?? 0).toFixed(2)}%
• Avg CPC: $${Number(summary?.avg_cpc ?? 0).toFixed(2)}
• Total Spend: $${Number(summary?.cost ?? 0).toFixed(2)}
• Conversions: ${summary?.conversions ?? 0}
• Cost per Conversion: ${summary?.conversions > 0 ? "$" + Number(summary.cost_per_conversion).toFixed(2) : "N/A"}

Top Campaigns by Spend:
${campaignText}

Provide 2-3 specific, data-driven action items per timeframe. Reference actual numbers from the data. Return ONLY valid JSON (no markdown, no explanation):
{
  "short_term": [{"action": "...", "impact": "high|medium|low"}],
  "medium_term": [{"action": "...", "impact": "high|medium|low"}],
  "long_term": [{"action": "...", "impact": "high|medium|low"}]
}`

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a senior Google Ads strategist with 10+ years of agency experience. Analyze SEM performance data and provide specific, data-driven action items for each timeframe:
SHORT-TERM (7-14 days): immediate bid adjustments, budget reallocation, pausing underperformers.
MEDIUM-TERM (30-60 days): A/B tests, audience refinements, ad copy experiments, keyword expansion.
LONG-TERM (3-6 months): account restructuring, automation setup, campaign type diversification.
Each action must cite specific metrics from the provided data. Always respond in English.
Return ONLY the JSON object. No markdown, no code fences, no explanation.`,
      messages: [{ role: "user", content: userPrompt }],
    })
    const text = message.content.find(b => b.type === "text")?.text ?? "{}"
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const insights = JSON.parse(clean)
    res.json(insights)
  } catch (err) {
    console.error("[ai-sem-insights]", err)
    res.status(500).json({ error: err instanceof Error ? err.message : "AI error" })
  }
})

// ─── POST /api/ai/seo-insights ───────────────────────────────────────────────
app.post("/api/ai/seo-insights", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "AI not configured" })
  const { clientName, gscSite, gsc, ga4, psiScore } = req.body ?? {}
  if (!gscSite) return res.status(400).json({ error: "gscSite is required" })

  const displayName = clientName || gscSite.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const topQueries = (gsc?.queries ?? []).slice(0, 8).map(q =>
    `• "${q.query}": ${q.clicks} clicks, ${q.impressions} impr, pos ${Number(q.position).toFixed(1)}, ${Number(q.ctr * 100).toFixed(1)}% CTR`
  ).join("\n") || "No query data"
  const topPages = (ga4?.topPages ?? []).slice(0, 5).map(p =>
    `• ${p.page}${p.sessions ? `: ${p.sessions} sessions` : ""}`
  ).join("\n") || "No page data"

  const userPrompt = `Website: ${displayName} (${gscSite})

Google Search Console (selected period):
• Total Clicks: ${Number(gsc?.totalClicks ?? 0).toLocaleString()}
• Total Impressions: ${Number(gsc?.totalImpressions ?? 0).toLocaleString()}
• Avg. Position: ${Number(gsc?.avgPosition ?? 0).toFixed(1)}
• Click-through Rate: ${gsc?.totalImpressions > 0 ? ((gsc.totalClicks / gsc.totalImpressions) * 100).toFixed(2) : "0.00"}%

Top Queries:
${topQueries}

Google Analytics 4:
• Engaged Sessions: ${Number(ga4?.engagedSessions ?? 0).toLocaleString()}
• Conversion Rate: ${Number(ga4?.conversionRate ?? 0).toFixed(2)}%

Top Pages:
${topPages}

${psiScore != null ? `PageSpeed Score (mobile): ${psiScore}/100` : ""}

Provide 2-3 specific, data-driven SEO action items per timeframe. Reference actual numbers from the data. Return ONLY valid JSON (no markdown, no explanation):
{"short_term":[{"action":"...","impact":"high|medium|low"}],"medium_term":[{"action":"...","impact":"high|medium|low"}],"long_term":[{"action":"...","impact":"high|medium|low"}]}`

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a senior SEO strategist with 10+ years of agency experience. Analyze organic search performance data and provide specific, data-driven action items for each timeframe:
SHORT-TERM (7-14 days): quick wins — meta descriptions for high-impression/low-CTR queries, internal linking, fixing crawl issues.
MEDIUM-TERM (30-60 days): content optimization for near-first-page keywords, structured data, page speed fixes, content gaps.
LONG-TERM (3-6 months): authority building, content cluster strategy, technical architecture, Core Web Vitals.
Each action must cite specific numbers or query names from the data. Always respond in English.
Return ONLY the JSON object. No markdown, no code fences, no explanation.`,
      messages: [{ role: "user", content: userPrompt }],
    })
    const text = message.content.find(b => b.type === "text")?.text ?? "{}"
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    res.json(JSON.parse(clean))
  } catch (err) {
    console.error("[ai-seo-insights]", err)
    res.status(500).json({ error: err instanceof Error ? err.message : "AI error" })
  }
})

// ─── POST /api/ai/social-insights ────────────────────────────────────────────
app.post("/api/ai/social-insights", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "AI not configured" })
  const { accountName, platforms, metrics, posts } = req.body ?? {}
  if (!platforms?.length) return res.status(400).json({ error: "platforms is required" })

  const platformList = platforms.join(", ")
  const engagementRate = metrics?.impresiones > 0
    ? ((metrics.interacciones / metrics.impresiones) * 100).toFixed(2)
    : "0.00"

  const topPosts = (posts ?? []).slice(0, 8).map(p =>
    `• [${p.platform}] ${p.type} — "${p.title}": ${Number(p.impresiones).toLocaleString()} impr, ${Number(p.alcance).toLocaleString()} reach, ${p.interacciones} interactions`
  ).join("\n") || "No post data available"

  const userPrompt = `Account: ${accountName || "Social Media Account"}
Active platforms: ${platformList}

Aggregated metrics:
• Followers: ${Number(metrics?.seguidores ?? 0).toLocaleString()}
• Impressions: ${Number(metrics?.impresiones ?? 0).toLocaleString()}
• Reach: ${Number(metrics?.alcance ?? 0).toLocaleString()}
• Interactions: ${Number(metrics?.interacciones ?? 0).toLocaleString()}
• Engagement Rate: ${engagementRate}%
• Profile Visits: ${Number(metrics?.visitasPerfil ?? 0).toLocaleString()}

Top performing posts:
${topPosts}

Return ONLY valid JSON: {"short_term":[{"action":"...","impact":"high|medium|low"}],"medium_term":[...],"long_term":[]}`

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a senior social media strategist with 10+ years of agency experience. Analyze social media performance data and provide specific, data-driven action items for each timeframe:
SHORT-TERM (7-14 days): posting frequency adjustments, content format optimization, best time to post, engagement tactics.
MEDIUM-TERM (30-60 days): content calendar strategy, A/B testing formats, cross-platform repurposing, hashtag strategy.
LONG-TERM (3-6 months): audience growth strategy, brand voice consistency, influencer collaborations, platform-specific growth.
Each action must cite specific numbers or platform names from the data. Always respond in English.
Return ONLY the JSON object. No markdown, no code fences, no explanation.`,
      messages: [{ role: "user", content: userPrompt }],
    })
    const text = message.content.find(b => b.type === "text")?.text ?? "{}"
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    res.json(JSON.parse(clean))
  } catch (err) {
    console.error("[ai-social-insights]", err)
    res.status(500).json({ error: err instanceof Error ? err.message : "AI error" })
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
  const { landingPageUrl, screamingFrogSheetUrl } = req.body ?? {}
  if (!landingPageUrl || !screamingFrogSheetUrl) {
    return res.status(400).json({ error: 'landingPageUrl and screamingFrogSheetUrl are required' })
  }
  let parsedLanding, parsedSheet
  try { parsedLanding = new URL(landingPageUrl) } catch { return res.status(400).json({ error: 'landingPageUrl must be a valid URL' }) }
  try { parsedSheet   = new URL(screamingFrogSheetUrl) } catch { return res.status(400).json({ error: 'screamingFrogSheetUrl must be a valid URL' }) }
  if (parsedLanding.protocol !== 'https:') return res.status(400).json({ error: 'landingPageUrl must use https' })
  if (parsedSheet.protocol   !== 'https:') return res.status(400).json({ error: 'screamingFrogSheetUrl must use https' })

  try {
    const n8nRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'Landing Page Url': landingPageUrl,
        'Screaming Frog Google Sheet URL': screamingFrogSheetUrl,
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

// ── Google OAuth reconnect (status / start / callback) ───────────────────────
registerGoogleAuthRoutes(app)
registerGbpAuthRoutes(app)

// ── SEO: Google Business Profile report ──────────────────────────────────────
app.get('/api/seo/gbp', async (req, res) => {
  try {
    const data = await getGbpReport({
      site: req.query.site,
      ga4: req.query.ga4,
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

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '.pdf-export-'))
  const inputPath = path.join(tmpDir, 'payload.json')
  const outputPath = path.join(tmpDir, 'report.pdf')
  try {
    fs.writeFileSync(inputPath, JSON.stringify(payload))
    await execFileAsync('python3', [path.join(__dirname, 'tools', 'pdf_export.py'), '--input', inputPath, '--output', outputPath], {
      cwd: __dirname,
      timeout: 60_000,
    })
    const pdfBuffer = fs.readFileSync(outputPath)
    const safeFilename = String(filename ?? 'xms-report.pdf')
      .replace(/["\r\n\\]/g, '').replace(/[^a-zA-Z0-9._\- ]/g, '_') || 'report.pdf'
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
    res.end(pdfBuffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF export error'
    console.error('[pdf-export]', message)
    res.status(500).json({ error: message })
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
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
