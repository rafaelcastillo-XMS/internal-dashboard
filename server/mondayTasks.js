import { createHash } from 'node:crypto'

/**
 * server/mondayTasks.js
 * Shared Monday.com task-fetching logic, used by both the production
 * server (server.js) and the Vite dev middleware (vite.config.ts).
 */

function statusErr(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

export function normalizeMondayLabel(label) {
  return (label ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
}

export function buildMondayEmailMap(raw) {
  return Object.fromEntries(
    (raw ?? "").split(",").filter(s => s.includes(":")).map(s => {
      const [k, v] = s.split(":").map(e => e.trim())
      return [k, v]
    })
  )
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function mondayGraphQL(token, query, variables = {}) {
  for (let attempt = 0; ; attempt++) {
    let resp
    try {
      resp = await fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token, "API-Version": "2026-07" },
        body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(15000),
      })
    } catch (error) {
      if (attempt >= 2) throw statusErr(502, `Monday connection failed: ${error.name}`)
      await wait(500 * 2 ** attempt)
      continue
    }
    const json = await resp.json().catch(() => null)
    const errors = json?.errors ?? []
    if (resp.ok && !errors.length && json?.data) return json.data
    const transient = resp.status === 429 || resp.status >= 500 || errors.some(e =>
      ['API_TEMPORARILY_BLOCKED', 'COMPLEXITY_BUDGET_EXHAUSTED', 'maxConcurrencyExceeded', 'Rate Limit Exceeded'].includes(e.extensions?.code))
    const retrySeconds = Number(resp.headers.get('retry-after') ?? errors[0]?.extensions?.retry_in_seconds ?? 0)
    if (transient && attempt < 2 && retrySeconds <= 10) {
      await wait(Math.max(retrySeconds * 1000, 500 * 2 ** attempt))
      continue
    }
    const error = statusErr(transient ? 503 : 502, `Monday API: ${errors.map(e => e.message).join('; ') || `HTTP ${resp.status}`}`)
    error.requestId = json?.extensions?.request_id
    throw error
  }
}

// The browser authenticates with its dashboard session, never a server secret.
export async function resolveMondayEmail({ authorization, email, internalSecret, supabaseUrl, supabaseAnonKey }) {
  if (internalSecret && authorization === `Bearer ${internalSecret}` && email) return email
  if (!/^Bearer \S+$/.test(authorization ?? '')) throw statusErr(401, 'A dashboard session is required')
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, Authorization: authorization }, signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw statusErr(response.status >= 500 ? 503 : 401, 'Unable to validate dashboard session')
  const user = await response.json()
  if (!user.email) throw statusErr(401, 'The dashboard session has no email')
  return user.email
}

const COMPLETED_STATUSES = [
  "done", "complete", "completed", "hecho", "hecha",
  "completado", "completada", "finalizado", "finalizada",
  "terminado", "terminada", "listo", "lista",
]

const SUBITEMS_PREFIXES = ["subitems of", "subelementos de"]
const isSubitemsBoard = name => SUBITEMS_PREFIXES.some(p => name.toLowerCase().startsWith(p))

const mondayTaskCache = new Map()
const MONDAY_CACHE_TTL_MS = 5 * 60 * 1000

const pendingTasks = new Map()
export async function fetchMondayTasksForUser({ mondayToken, sessionEmail, bust = false }) {
  if (!mondayToken) throw statusErr(503, "MONDAY_API_TOKEN is not configured")
  if (!sessionEmail) throw statusErr(401, 'A dashboard email is required')
  const cacheKey = createHash('sha256').update(mondayToken).update(sessionEmail.toLowerCase()).digest('hex')
  const cached = mondayTaskCache.get(cacheKey)
  if (!bust && cached && Date.now() - cached.at < MONDAY_CACHE_TTL_MS) return cached.payload
  if (pendingTasks.has(cacheKey)) return pendingTasks.get(cacheKey)
  const pending = loadMondayTasks({ mondayToken, sessionEmail }).then(payload => {
    mondayTaskCache.set(cacheKey, { at: Date.now(), payload })
    return payload
  }).finally(() => pendingTasks.delete(cacheKey))
  pendingTasks.set(cacheKey, pending)
  return pending
}

async function loadMondayTasks({ mondayToken, sessionEmail }) {
  if (!mondayToken) throw statusErr(503, "MONDAY_API_TOKEN is not configured")

  const usersData = await mondayGraphQL(mondayToken, `
    query GetUsers($emails: [String!]) {
      users(emails: $emails, limit: 1) {
        id name email photo_thumb_small
      }
    }
  `, { emails: sessionEmail ? [sessionEmail] : [] })

  const user = usersData?.users?.[0] ?? null
  if (!user) return { user: null, tasks: [] }

  // Discover boards cheaply, excluding subitem boards before fetching items.
  // A single 100-board item query can time out before Monday returns any data.
  const roster = await mondayGraphQL(mondayToken, `query { boards(limit: 100, state: active) { id name } }`)
  const boardIds = (roster?.boards ?? []).filter(board => !isSubitemsBoard(board.name)).map(board => board.id)
  const batches = []
  for (let i = 0; i < boardIds.length; i += 8) batches.push(boardIds.slice(i, i + 8))
  const boards = []
  // At most two item queries in flight; repeated dashboard requests share this work.
  for (let i = 0; i < batches.length; i += 2) {
    const results = await Promise.all(batches.slice(i, i + 2).map(ids => mondayGraphQL(mondayToken, `
      query GetBoardItems($ids: [ID!]) {
        boards(ids: $ids, limit: 8, state: active) {
          id name
          items_page(limit: 100, query_params: { order_by: [{ column_id: "__last_updated__", direction: desc }] }) {
            items {
              id name state updated_at
              column_values {
                id text type
                column { title }
                ... on StatusValue { label index }
                ... on DateValue { date }
                ... on PeopleValue { persons_and_teams { id kind } }
              }
            }
          }
        }
      }
    `, { ids })))
    for (const result of results) boards.push(...(result.boards ?? []))
  }
  const itemsData = { boards }

  const rawItems = (itemsData?.boards ?? [])
    .filter(board => !isSubitemsBoard(board.name))
    .flatMap(board =>
      (board.items_page?.items ?? [])
        .filter(item =>
          item.state !== "deleted" &&
          item.column_values.some(col =>
            col.type === "people" &&
            col.persons_and_teams?.some(p => p.kind === "person" && String(p.id) === String(user.id))
          )
        )
        .map(item => ({ ...item, board: { id: board.id, name: board.name } }))
    )

  rawItems.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  const tasks = rawItems.map(item => {
    const byId = id => item.column_values.find(c => c.id === id)
    const byType = type => item.column_values.find(c => c.type === type)
    // Monday reuses the "status" column type for status, priority, and plain
    // category tags (department, service, etc.), and the "status" column id
    // is only a convention some boards follow — several boards here rename
    // or repurpose it. The column *title* is the one thing a human keeps
    // meaningful, so match on that instead of id/type.
    const byTitle = titles => item.column_values.find(c => titles.includes(normalizeMondayLabel(c.column?.title ?? "")))
    const statusCol = byTitle(["status", "estado"]) ?? byId("status") ?? byType("status")
    const priorityCol = byTitle(["priority", "priori", "prioridad"]) ?? byId("priority")
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
  }).filter(task => !COMPLETED_STATUSES.includes(normalizeMondayLabel(task.status))).slice(0, 20)

  const payload = {
    user: { id: user.id, name: user.name, email: user.email, avatar: user.photo_thumb_small },
    tasks,
  }
  return payload
}

export async function fetchMondayTaskDetail({ mondayToken, taskId }) {
  if (!mondayToken) throw statusErr(503, "MONDAY_API_TOKEN is not configured")
  if (!/^\d+$/.test(taskId)) throw statusErr(400, "Invalid task ID")

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
  if (!item) throw statusErr(404, "Task not found")

  const accountSlug = data?.me?.account?.slug ?? null
  const boardId = item.board?.id ?? null
  const mondayUrl = accountSlug && boardId
    ? `https://${accountSlug}.monday.com/boards/${boardId}/pulses/${item.id}`
    : null

  return {
    id: item.id,
    boardId,
    boardName: item.board?.name ?? "Unknown Board",
    mondayUrl,
    updates: (item.updates ?? []).map(u => ({
      id: u.id, body: u.body, createdAt: u.created_at,
      creatorName: u.creator?.name ?? "Unknown",
      creatorAvatar: u.creator?.photo_thumb_small ?? null,
    })),
  }
}
