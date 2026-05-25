import express from "express"
import { fileURLToPath } from "url"
import path from "path"
import Anthropic from "@anthropic-ai/sdk"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())
const PORT = process.env.PORT ?? 3000

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
    const edgeUrl = `${SUPABASE_URL}/functions/v1/sem/search-terms?accountId=${accountId}&startDate=${startDate}&endDate=${endDate}`
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

    // Serve from cache if fresh
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

// ── SEO: PageSpeed Insights ──────────────────────────────────────────────────
app.get('/api/seo/pagespeed', async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url is required' })
  try {
    const key = process.env.PSI_API_KEY
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

// ─── Serve Vite build + SPA fallback ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, "dist")))

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"))
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
