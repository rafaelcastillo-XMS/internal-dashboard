import path from "path"
import fs from "fs"
import { spawn, execFile, type ChildProcessWithoutNullStreams } from "child_process"
import { promisify } from "util"
import { config as loadDotenv } from "dotenv"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from "http"

loadDotenv({ path: path.resolve(__dirname, ".env") })

const execFileAsync = promisify(execFile)

type BridgeRequest = {
  id: string
  action: "refresh_auth" | "list_notebooks" | "query_notebook"
  payload?: Record<string, unknown>
}

type BridgeResponse = {
  id: string | null
  result: Record<string, unknown>
}

const NOTEBOOKLM_PYTHON_BIN = process.env.NOTEBOOKLM_PYTHON_BIN
  ?? "/Users/rafa/.local/share/notebooklm-mcp-server/bin/python"

function createNotebooklmBridge() {
  let processRef: ChildProcessWithoutNullStreams | null = null
  let buffer = ""
  const pending = new Map<string, {
    resolve: (value: Record<string, unknown>) => void
    reject: (reason?: unknown) => void
  }>()

  function ensureProcess() {
    if (processRef) return processRef

    processRef = spawn(
      NOTEBOOKLM_PYTHON_BIN,
      [path.resolve(__dirname, "scripts/notebooklm_bridge.py")],
      {
        cwd: __dirname,
        stdio: "pipe",
      },
    )

    processRef.stdout.setEncoding("utf8")
    processRef.stdout.on("data", (chunk: string) => {
      buffer += chunk

      while (buffer.includes("\n")) {
        const newlineIndex = buffer.indexOf("\n")
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)

        if (!line) continue

        try {
          const response = JSON.parse(line) as BridgeResponse
          const resolver = response.id ? pending.get(response.id) : undefined
          if (resolver) {
            pending.delete(response.id!)
            resolver.resolve(response.result)
          }
        } catch (error) {
          console.error("[notebooklm-bridge] invalid JSON from python bridge", error, line)
        }
      }
    })

    processRef.stderr.setEncoding("utf8")
    processRef.stderr.on("data", chunk => {
      console.error("[notebooklm-bridge]", chunk.toString())
    })

    processRef.on("exit", code => {
      const error = new Error(`NotebookLM bridge exited with code ${code ?? "unknown"}`)
      pending.forEach(({ reject }) => reject(error))
      pending.clear()
      processRef = null
      buffer = ""
    })

    return processRef
  }

  async function call(action: BridgeRequest["action"], payload: BridgeRequest["payload"] = {}) {
    const bridge = ensureProcess()
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
      pending.set(id, { resolve, reject })
    })

    bridge.stdin.write(`${JSON.stringify({ id, action, payload } satisfies BridgeRequest)}\n`)
    return promise
  }

  return { call }
}

const notebooklmBridge = createNotebooklmBridge()

async function readJsonBody(req: IncomingMessage) {
  const chunks: Uint8Array[] = []

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }

  if (chunks.length === 0) return {}

  const raw = Buffer.concat(chunks).toString("utf8")
  return raw ? JSON.parse(raw) : {}
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(payload))
}

function sendPdf(res: ServerResponse, filename: string, payload: Buffer) {
  res.statusCode = 200
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
  res.end(payload)
}

type GoogleTokenStatus = {
  connected: boolean
  email: string | null
  requiredEmail: string
  allowed: boolean
}

const GOOGLE_API_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/adwords",
]
const GOOGLE_REDIRECT_URI = "http://localhost:5173/api/auth/google/callback"
const GOOGLE_TOKEN_PATH = path.resolve(__dirname, "token.json")
const GOOGLE_CREDS_PATH = path.resolve(__dirname, "credentials.json")
function normalizeGoogleEmail(input: string) {
  const email = input.trim().toLowerCase()
  return email.endsWith("@xperienceusa") ? `${email}.com` : email
}

const REQUIRED_GOOGLE_EMAIL = normalizeGoogleEmail(process.env.GOOGLE_REQUIRED_EMAIL ?? "eva@xperienceusa.com")
const TOKEN_STATUS_CACHE_TTL_MS = 30_000
let tokenStatusCache: { at: number; status: GoogleTokenStatus } | null = null

function appendAuthResult(returnPath: string, authResult: string) {
  const separator = returnPath.includes("?") ? "&" : "?"
  return `${returnPath}${separator}auth=${authResult}`
}

function getClientCreds() {
  const raw = JSON.parse(fs.readFileSync(GOOGLE_CREDS_PATH, "utf-8"))
  const data = raw.installed || raw.web
  return { client_id: data.client_id as string, client_secret: data.client_secret as string }
}

function readStoredToken(): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(GOOGLE_TOKEN_PATH, "utf-8")) as Record<string, unknown>
  } catch {
    return null
  }
}

function writeStoredToken(token: Record<string, unknown>) {
  fs.writeFileSync(GOOGLE_TOKEN_PATH, JSON.stringify(token, null, 2))
}

async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  if (!accessToken) return null
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null
    const info = await response.json() as { email?: string }
    return typeof info.email === "string" ? info.email : null
  } catch {
    return null
  }
}

async function refreshGoogleAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  if (!refreshToken) return null
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    })
    if (!response.ok) return null
    const tokenData = await response.json() as { access_token?: string }
    return tokenData.access_token ?? null
  } catch {
    return null
  }
}

async function resolveTokenEmail(tokenJson: Record<string, unknown>) {
  const savedEmail = typeof tokenJson._connected_email === "string" ? tokenJson._connected_email : null
  if (savedEmail) return savedEmail

  const currentAccessToken = typeof tokenJson.token === "string" ? tokenJson.token : ""
  const currentTokenEmail = await fetchGoogleAccountEmail(currentAccessToken)
  if (currentTokenEmail) return currentTokenEmail

  const refreshToken = typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : ""
  if (!refreshToken) return null

  const fallbackCreds = getClientCreds()
  const clientId = typeof tokenJson.client_id === "string" ? tokenJson.client_id : fallbackCreds.client_id
  const clientSecret = typeof tokenJson.client_secret === "string" ? tokenJson.client_secret : fallbackCreds.client_secret
  const refreshedAccessToken = await refreshGoogleAccessToken(refreshToken, clientId, clientSecret)
  return refreshedAccessToken ? fetchGoogleAccountEmail(refreshedAccessToken) : null
}

async function readTokenStatus(force = false): Promise<GoogleTokenStatus> {
  if (!force && tokenStatusCache && Date.now() - tokenStatusCache.at < TOKEN_STATUS_CACHE_TTL_MS) {
    return tokenStatusCache.status
  }

  const disconnectedStatus: GoogleTokenStatus = {
    connected: false,
    email: null,
    requiredEmail: REQUIRED_GOOGLE_EMAIL,
    allowed: false,
  }

  try {
    const tokenJson = readStoredToken()
    if (!tokenJson) {
      tokenStatusCache = { at: Date.now(), status: disconnectedStatus }
      return disconnectedStatus
    }

    const refreshToken = typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : ""
    if (!refreshToken) {
      tokenStatusCache = { at: Date.now(), status: disconnectedStatus }
      return disconnectedStatus
    }

    const email = await resolveTokenEmail(tokenJson)
    if (email && tokenJson._connected_email !== email) {
      tokenJson._connected_email = email
      writeStoredToken(tokenJson)
    }

    const status: GoogleTokenStatus = {
      connected: true,
      email,
      requiredEmail: REQUIRED_GOOGLE_EMAIL,
      allowed: !!email && normalizeGoogleEmail(email) === REQUIRED_GOOGLE_EMAIL,
    }
    tokenStatusCache = { at: Date.now(), status }
    return status
  } catch {
    tokenStatusCache = { at: Date.now(), status: disconnectedStatus }
    return disconnectedStatus
  }
}

async function enforceRequiredGoogleAccount(
  res: ServerResponse,
  source: "SEO" | "SEM",
) {
  const status = await readTokenStatus()
  if (status.allowed) return true

  const detail = status.email
    ? `Connected account is ${status.email}.`
    : status.connected
      ? "Unable to verify connected Google account email."
      : "No Google account connected."

  sendJson(res, 403, {
    error: `${source} Intelligence requires Google account ${REQUIRED_GOOGLE_EMAIL}. ${detail}`,
    requiredEmail: REQUIRED_GOOGLE_EMAIL,
    connectedEmail: status.email,
    connected: status.connected,
    allowed: status.allowed,
  })
  return false
}

function notebooklmDevPlugin() {
  return {
    name: "notebooklm-dev-api",
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/notebooklm")) {
          next()
          return
        }

        try {
          if (req.url === "/api/notebooklm/notebooks" && req.method === "GET") {
            const result = await notebooklmBridge.call("list_notebooks", { max_results: 50 })
            sendJson(res, 200, result)
            return
          }

          if (req.url === "/api/notebooklm/query" && req.method === "POST") {
            const body = await readJsonBody(req) as {
              notebookId?: string
              query?: string
              conversationId?: string
            }

            const result = await notebooklmBridge.call("query_notebook", {
              notebook_id: body.notebookId,
              query: body.query,
              conversation_id: body.conversationId,
            })

            sendJson(res, 200, result)
            return
          }

          if (req.url === "/api/notebooklm/refresh-auth" && req.method === "POST") {
            const result = await notebooklmBridge.call("refresh_auth")
            sendJson(res, 200, result)
            return
          }

          sendJson(res, 404, { status: "error", error: "NotebookLM endpoint not found" })
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unexpected NotebookLM bridge error"
          sendJson(res, 500, { status: "error", error: message })
        }
      })
    },
  }
}

// ─── Google OAuth one-click auth ────────────────────────────────────────────
function googleAuthPlugin() {
  return {
    name: "google-auth",
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/auth/google/")) { next(); return }

        const url = new URL(req.url, "http://localhost")

        // ── Status ──────────────────────────────────────────────────────────
        if (url.pathname === "/api/auth/google/status") {
          sendJson(res, 200, await readTokenStatus(true))
          return
        }

        // ── Start OAuth flow ─────────────────────────────────────────────────
        if (url.pathname === "/api/auth/google/start") {
          const { client_id } = getClientCreds()
          // Encode return URL in the OAuth state param so callback knows where to redirect
          const returnPath = url.searchParams.get("return") || "/settings"
          const state = Buffer.from(JSON.stringify({ returnPath })).toString("base64url")
          const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
          authUrl.searchParams.set("client_id", client_id)
          authUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI)
          authUrl.searchParams.set("response_type", "code")
          authUrl.searchParams.set("scope", [...GOOGLE_API_SCOPES, "https://www.googleapis.com/auth/userinfo.email"].join(" "))
          authUrl.searchParams.set("access_type", "offline")
          authUrl.searchParams.set("prompt", "consent")
          authUrl.searchParams.set("state", state)
          res.writeHead(302, { Location: authUrl.toString() })
          res.end()
          return
        }

        // ── OAuth callback ───────────────────────────────────────────────────
        if (url.pathname === "/api/auth/google/callback") {
          const code = url.searchParams.get("code")
          const oauthError = url.searchParams.get("error")
          const stateParam = url.searchParams.get("state") || ""
          let returnPath = "/settings"
          try {
            const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString())
            if (typeof decoded.returnPath === "string") returnPath = decoded.returnPath
          } catch { /* use default */ }

          if (oauthError || !code) {
            console.error("[google-auth] callback error:", oauthError)
            res.writeHead(302, { Location: appendAuthResult(returnPath, "error") })
            res.end()
            return
          }

          try {
            const { client_id, client_secret } = getClientCreds()

            // Exchange code → tokens
            const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ code, client_id, client_secret, redirect_uri: GOOGLE_REDIRECT_URI, grant_type: "authorization_code" }).toString(),
            })
            const tokenData = await tokenResp.json() as Record<string, string>

            if (tokenData.error) {
              console.error("[google-auth] token exchange error:", tokenData)
              res.writeHead(302, { Location: appendAuthResult(returnPath, "error") })
              res.end()
              return
            }

            // Fetch connected account email
            const email = await fetchGoogleAccountEmail(tokenData.access_token ?? "")
            if (!email || normalizeGoogleEmail(email) !== REQUIRED_GOOGLE_EMAIL) {
              console.warn("[google-auth] rejected account:", email ?? "unknown")
              res.writeHead(302, { Location: appendAuthResult(returnPath, "wrong-account") })
              res.end()
              return
            }

            // Save token.json in google-auth (Python) format
            const tokenJson: Record<string, unknown> = {
              token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              token_uri: "https://oauth2.googleapis.com/token",
              client_id,
              client_secret,
              scopes: GOOGLE_API_SCOPES,
            }
            if (email) tokenJson._connected_email = email

            writeStoredToken(tokenJson)
            tokenStatusCache = null
            console.log("[google-auth] ✓ token.json saved for", email ?? "unknown user")

            res.writeHead(302, { Location: appendAuthResult(returnPath, "success") })
            res.end()
          } catch (err) {
            console.error("[google-auth]", err)
            res.writeHead(302, { Location: appendAuthResult(returnPath, "error") })
            res.end()
          }
          return
        }

        next()
      })
    },
  }
}

function seoDevPlugin() {
  return {
    name: "seo-api",
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/seo/")) {
          next()
          return
        }
        if (!(await enforceRequiredGoogleAccount(res, "SEO"))) return

        const { searchParams } = new URL(req.url, "http://localhost")
        const toolsDir = path.resolve(__dirname, "tools")
        const psiApiKey = process.env.PSI_API_KEY ?? ""

        let script: string
        let args: string[]

        if (req.url.startsWith("/api/seo/properties")) {
          script = path.join(toolsDir, "list_properties.py")
          args = []
        } else if (req.url.startsWith("/api/seo/gsc")) {
          const siteUrl   = searchParams.get("siteUrl")   ?? ""
          const startDate = searchParams.get("startDate") ?? ""
          const endDate   = searchParams.get("endDate")   ?? ""
          if (!siteUrl || !startDate || !endDate) {
            sendJson(res, 400, { error: "siteUrl, startDate, and endDate are required" })
            return
          }
          script = path.join(toolsDir, "gsc_fetch.py")
          args = ["--site", siteUrl, "--start", startDate, "--end", endDate]
        } else if (req.url.startsWith("/api/seo/ga4")) {
          const propertyId = searchParams.get("propertyId") ?? ""
          const startDate  = searchParams.get("startDate")  ?? ""
          const endDate    = searchParams.get("endDate")    ?? ""
          if (!propertyId || !startDate || !endDate) {
            sendJson(res, 400, { error: "propertyId, startDate, and endDate are required" })
            return
          }
          script = path.join(toolsDir, "ga4_fetch.py")
          args = ["--property", propertyId, "--start", startDate, "--end", endDate]
        } else if (req.url.startsWith("/api/seo/psi")) {
          const rawUrl = searchParams.get("url") ?? ""
          if (!rawUrl) {
            sendJson(res, 400, { error: "url param is required" })
            return
          }
          const url = rawUrl.startsWith("sc-domain:")
            ? `https://${rawUrl.slice("sc-domain:".length)}/`
            : rawUrl
          script = path.join(toolsDir, "psi_fetch.py")
          args = ["--url", url]
        } else {
          next()
          return
        }

        try {
          const { stdout, stderr } = await execFileAsync(
            "python3",
            [script, ...args],
            { cwd: __dirname, timeout: 60_000, env: { ...process.env, PSI_API_KEY: psiApiKey } },
          )
          if (stderr) {
            const cleaned = stderr.replace(/.*FutureWarning[\s\S]*?warn\(.*\n?/g, "").trim()
            if (cleaned) console.warn("[seo-api]", cleaned)
          }
          sendJson(res, 200, JSON.parse(stdout))
        } catch (error) {
          const message = error instanceof Error ? error.message : "SEO API error"
          console.error("[seo-api]", message)
          sendJson(res, 500, { error: message })
        }
      })
    },
  }
}

function semDevPlugin() {
  return {
    name: "sem-api",
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/sem/")) {
          next()
          return
        }
        if (!(await enforceRequiredGoogleAccount(res, "SEM"))) return

        const { searchParams } = new URL(req.url, "http://localhost")
        const toolsDir         = path.resolve(__dirname, "tools")
        const adsDeveloperToken = process.env.ADS_DEVELOPER_TOKEN ?? ""
        const adsMccId          = process.env.ADS_MCC_ID          ?? ""

        let script: string
        let args: string[]

        if (req.url.startsWith("/api/sem/accounts")) {
          script = path.join(toolsDir, "ads_list_accounts.py")
          args   = []
        } else if (req.url.startsWith("/api/sem/performance")) {
          const customerId = searchParams.get("customerId") ?? ""
          const start      = searchParams.get("start")      ?? ""
          const end        = searchParams.get("end")        ?? ""
          if (!customerId || !start || !end) {
            sendJson(res, 400, { error: "customerId, start, and end are required" })
            return
          }
          script = path.join(toolsDir, "ads_fetch.py")
          args   = ["--customer-id", customerId, "--start", start, "--end", end]
        } else {
          next()
          return
        }

        try {
          const { stdout, stderr } = await execFileAsync(
            "python3",
            [script, ...args],
            {
              cwd: __dirname,
              timeout: 60_000,
              env: {
                ...process.env,
                ADS_DEVELOPER_TOKEN: adsDeveloperToken,
                ADS_MCC_ID:          adsMccId,
              },
            },
          )
          if (stderr) {
            const cleaned = stderr.replace(/.*FutureWarning[\s\S]*?warn\(.*\n?/g, "").trim()
            if (cleaned) console.warn("[sem-api]", cleaned)
          }
          sendJson(res, 200, JSON.parse(stdout))
        } catch (error) {
          const message = error instanceof Error ? error.message : "SEM API error"
          console.error("[sem-api]", message)
          sendJson(res, 500, { error: message })
        }
      })
    },
  }
}

function pdfExportDevPlugin() {
  return {
    name: "pdf-export-api",
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/api/export/pdf") {
          next()
          return
        }

        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" })
          return
        }

        try {
          const body = await readJsonBody(req) as {
            filename?: string
            payload?: Record<string, unknown>
          }

          if (!body.payload) {
            sendJson(res, 400, { error: "payload is required" })
            return
          }

          const toolsDir = path.resolve(__dirname, "tools")
          const tmpDir = fs.mkdtempSync(path.join(process.cwd(), ".pdf-export-"))
          const inputPath = path.join(tmpDir, "payload.json")
          const outputPath = path.join(tmpDir, "report.pdf")
          fs.writeFileSync(inputPath, JSON.stringify(body.payload, null, 2))

          await execFileAsync("python3", [path.join(toolsDir, "pdf_export.py"), "--input", inputPath, "--output", outputPath], {
            cwd: __dirname,
            timeout: 60_000,
          })

          const pdfBuffer = fs.readFileSync(outputPath)
          sendPdf(res, body.filename || "xms-report.pdf", pdfBuffer)
          fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch (error) {
          const message = error instanceof Error ? error.message : "PDF export error"
          console.error("[pdf-export]", message)
          sendJson(res, 500, { error: message })
        }
      })
    },
  }
}

// ─── Monday.com tasks cache (5-minute TTL per user) ──────────────────────────
const mondayTaskCache = new Map<string, { at: number; payload: unknown }>()
const MONDAY_CACHE_TTL_MS = 5 * 60 * 1000

// ─── Monday.com tasks plugin ──────────────────────────────────────────────────
function mondayPlugin() {
  return {
    name: "monday-api",
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/monday/")) { next(); return }

        const mondayToken = process.env.MONDAY_API_TOKEN ?? ""
        if (!mondayToken) {
          sendJson(res, 503, { error: "MONDAY_API_TOKEN is not configured" })
          return
        }

        const url = new URL(req.url, "http://localhost")

        // GET /api/monday/tasks?email=...
        if (url.pathname === "/api/monday/tasks" && req.method === "GET") {
          // Build email mapping (MONDAY_EMAIL_MAP=supabase@x.com:monday@x.com,...)
          const emailMapRaw = process.env.MONDAY_EMAIL_MAP ?? ""
          const emailMap: Record<string, string> = Object.fromEntries(
            emailMapRaw.split(",").filter(s => s.includes(":")).map(s => {
              const [k, v] = s.split(":").map(e => e.trim())
              return [k, v]
            })
          )
          const sessionEmail = url.searchParams.get("email") ?? ""
          const mondayEmail = emailMap[sessionEmail] ?? sessionEmail

          async function mondayGraphQL(query: string, variables: Record<string, unknown> = {}) {
            const resp = await fetch("https://api.monday.com/v2", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: mondayToken,
                "API-Version": "2024-01",
              },
              body: JSON.stringify({ query, variables }),
            })
            if (!resp.ok) throw new Error(`Monday API HTTP ${resp.status}`)
            const json = await resp.json() as { data?: unknown; errors?: { message: string }[] }
            if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join("; "))
            return json.data
          }

          try {
            // 1. Find the Monday user by (possibly remapped) email
            const usersData = await mondayGraphQL(`
              query GetUsers($emails: [String]) {
                users(emails: $emails, limit: 1) {
                  id name email photo_thumb_small
                }
              }
            `, { emails: mondayEmail ? [mondayEmail] : [] }) as { users?: { id: string; name: string; email: string; photo_thumb_small: string }[] }

            const user = usersData?.users?.[0] ?? null
            if (!user) {
              sendJson(res, 200, { user: null, tasks: [] })
              return
            }

            // Serve from cache if fresh (5 min TTL)
            const cached = mondayTaskCache.get(user.id)
            if (cached && Date.now() - cached.at < MONDAY_CACHE_TTL_MS) {
              sendJson(res, 200, cached.payload)
              return
            }

            // 2. Fetch recent items from task boards (skip subitems boards).
            //    Small per-board limit — we only need the 20 most recent overall.
            const itemsData = await mondayGraphQL(`
              query GetBoardItems {
                boards(limit: 100, state: active) {
                  id
                  name
                  items_page(limit: 20) {
                    items {
                      id
                      name
                      state
                      updated_at
                      column_values {
                        id
                        text
                        type
                        ... on StatusValue { label index }
                        ... on DateValue { date }
                        ... on PeopleValue { persons_and_teams { id kind } }
                      }
                    }
                  }
                }
              }
            `) as {
              boards?: {
                id: string
                name: string
                items_page: {
                  items: {
                    id: string
                    name: string
                    state: string
                    updated_at: string
                    column_values: { id: string; text: string; type: string; label?: string; index?: number; date?: string; persons_and_teams?: { id: string; kind: string }[] }[]
                  }[]
                }
              }[]
            }

            const SUBITEMS_PREFIXES = ["subitems of", "subelementos de"]
            const isSubitemsBoard = (name: string) =>
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
                        p => p.kind === "person" && String(p.id) === String(user.id),
                      ),
                    ),
                  )
                  .map(item => ({ ...item, board: { id: board.id, name: board.name } }))
              )

            // Sort by most recently updated, keep top 20
            rawItems.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            const top20 = rawItems.slice(0, 20)

            const tasks = top20.map(item => {
              const byId = (id: string) => item.column_values.find(c => c.id === id)
              const byType = (type: string) => item.column_values.find(c => c.type === type)

              const statusCol = byId("status") ?? byType("status")
              const priorityCol = byId("priority") ?? byType("priority")
              const dueDateCol = byId("due_date") ?? byId("date") ?? byType("date")

              return {
                id: item.id,
                name: item.name,
                board: item.board?.name ?? "Unknown Board",
                status: (statusCol as { label?: string })?.label ?? statusCol?.text ?? "—",
                statusIndex: (statusCol as { index?: number })?.index ?? null,
                priority: (priorityCol as { label?: string })?.label ?? priorityCol?.text ?? null,
                priorityIndex: (priorityCol as { index?: number })?.index ?? null,
                dueDate: (dueDateCol as { date?: string })?.date ?? dueDateCol?.text ?? null,
                updatedAt: item.updated_at,
              }
            })

            const payload = { user: { id: user.id, name: user.name, email: user.email, avatar: user.photo_thumb_small }, tasks }
            mondayTaskCache.set(user.id, { at: Date.now(), payload })
            sendJson(res, 200, payload)
          } catch (err) {
            const message = err instanceof Error ? err.message : "Monday API error"
            console.error("[monday-api]", message)
            sendJson(res, 500, { error: message })
          }
          return
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), notebooklmDevPlugin(), googleAuthPlugin(), seoDevPlugin(), semDevPlugin(), pdfExportDevPlugin(), mondayPlugin()],
  server: {},
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return
          if (id.includes("framer-motion")) return "motion"
          if (id.includes("@supabase")) return "supabase"
          if (id.includes("@radix-ui")) return "radix"
          if (id.includes("react-router")) return "router"
          if (id.includes("react")) return "react-vendor"
          if (id.includes("lucide-react")) return "icons"
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
