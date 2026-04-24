import express from "express"
import { fileURLToPath } from "url"
import path from "path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
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

// ─── GET /api/monday/tasks?email=... ─────────────────────────────────────────
app.get("/api/monday/tasks", async (req, res) => {
  const mondayToken = process.env.MONDAY_API_TOKEN ?? ""
  if (!mondayToken) {
    return res.status(503).json({ error: "MONDAY_API_TOKEN is not configured" })
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
        boards(limit: 100, state: active) {
          id name
          items_page(limit: 20) {
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

// ─── Serve Vite build + SPA fallback ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, "dist")))

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"))
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
