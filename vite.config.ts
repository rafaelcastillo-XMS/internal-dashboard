import path from "path"
import fs from "fs"
import { spawn, execFile, type ChildProcessWithoutNullStreams } from "child_process"
import { promisify } from "util"
import { config as loadDotenv } from "dotenv"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from "http"
import { getCompanySkillsCatalog } from "./server/companySkills.js"
import { optimizePromptWithOpenAI } from "./server/openaiPromptOptimizer.js"
import { getGbpReport, listGbpLocations } from "./server/gbpReport.js"
import { AhrefsApiError, getAhrefsSnapshot } from "./server/ahrefs.js"
import { MetaApiError, getAdCampaigns, getCampaignInsightsSeries, getFacebookPageSnapshot } from "./server/metaGraph.js"
import { handleNotionClientSyncRequest } from "./server/notionSync.js"
import {
  getGoogleAuthStatus, buildGoogleAuthStartUrl, completeGoogleAuthExchange,
  getGbpAuthStatus, buildGbpAuthStartUrl, completeGbpAuthExchange,
  decodeAuthReturnPath, appendAuthResult,
} from "./server/googleAuth.js"
import { buildMondayEmailMap, fetchMondayTasksForUser, fetchMondayTaskDetail } from "./server/mondayTasks.js"
import { askDashboardAi, getTaskInsight, getSemInsights, getSeoInsights, getSocialInsights } from "./server/aiInsights.js"
import { sanitizePdfFilename, exportPdfBuffer } from "./server/pdfExport.js"

loadDotenv({ path: path.resolve(__dirname, ".env") })
const localEnvPath = path.resolve(__dirname, ".env.local")
if (fs.existsSync(localEnvPath)) loadDotenv({ path: localEnvPath, override: true })

const execFileAsync = promisify(execFile)
const SEO_AUDIT_PROMPT_PATH = path.resolve(__dirname, "prompts", "seo-audit-history.md")

const DASHBOARD_SUPABASE_URL = "https://sjpvyxdyleebhqlmqscy.supabase.co"
const DASHBOARD_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcHZ5eGR5bGVlYmhxbG1xc2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzgxODksImV4cCI6MjA4ODc1NDE4OX0.ZvzbBm-L8Jt3FzhmmX3qd7_inwrupjQrfh9JWIlX1ng"

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

const auditResultStore = new Map<string, { html: string; receivedAt: number }>()

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
  res.setHeader("Content-Disposition", `attachment; filename="${sanitizePdfFilename(filename)}"`)
  res.end(payload)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const NUMERIC_RE = /^\d+$/

function isValidDate(v: string) { return DATE_RE.test(v) }
function isNumericId(v: string) { return NUMERIC_RE.test(v) }

const GOOGLE_REDIRECT_URI = "http://localhost:5173/api/auth/google/callback"
const GBP_REDIRECT_URI = "http://localhost:5173/api/auth/gbp/callback"
function normalizeGoogleEmail(input: string) {
  const email = input.trim().toLowerCase()
  return email.endsWith("@xperienceusa") ? `${email}.com` : email
}

const GBP_REQUIRED_EMAIL = normalizeGoogleEmail(process.env.GBP_REQUIRED_EMAIL ?? "xperiencemarketingsolutions@gmail.com")
const REQUIRED_GOOGLE_EMAIL = normalizeGoogleEmail(process.env.GOOGLE_REQUIRED_EMAIL ?? "")

async function enforceRequiredGoogleAccount(
  res: ServerResponse,
  source: "SEO" | "SEM" | "Monday",
) {
  const status = await getGoogleAuthStatus(REQUIRED_GOOGLE_EMAIL)
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

function notionDevPlugin() {
  return {
    name: "notion-client-sync-dev-api",
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url ?? "/", "http://localhost").pathname
        const match = /^\/api\/notion\/clients\/([^/]+)\/sync$/.exec(pathname)
        if (!match) {
          next()
          return
        }

        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" })
          return
        }

        await handleNotionClientSyncRequest(req, res, {
          clientId: decodeURIComponent(match[1]),
          notionApiKey: process.env.NOTION_API_KEY ?? "",
          notionDataSourceId: process.env.NOTION_DATA_SOURCE_ID ?? "",
          supabaseUrl: DASHBOARD_SUPABASE_URL,
          supabaseAnonKey: DASHBOARD_SUPABASE_ANON_KEY,
        })
      })
    },
  }
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
        if (!req.url?.startsWith("/api/auth/google/") && !req.url?.startsWith("/api/auth/gbp/")) { next(); return }

        const url = new URL(req.url, "http://localhost")

        // ── Dedicated Google Business Profile OAuth account ───────────────
        if (url.pathname === "/api/auth/gbp/status") {
          sendJson(res, 200, getGbpAuthStatus(GBP_REQUIRED_EMAIL))
          return
        }

        if (url.pathname === "/api/auth/gbp/start") {
          const rawReturn = url.searchParams.get("return") || "/settings"
          res.writeHead(302, { Location: buildGbpAuthStartUrl({ redirectUri: GBP_REDIRECT_URI, returnPath: rawReturn }) })
          res.end()
          return
        }

        if (url.pathname === "/api/auth/gbp/callback") {
          const code = url.searchParams.get("code")
          const returnPath = decodeAuthReturnPath(url.searchParams.get("state"))

          if (url.searchParams.get("error") || !code) {
            res.writeHead(302, { Location: appendAuthResult(returnPath, "error") })
            res.end()
            return
          }

          try {
            const result = await completeGbpAuthExchange({ code, redirectUri: GBP_REDIRECT_URI, requiredEmail: GBP_REQUIRED_EMAIL })
            res.writeHead(302, { Location: appendAuthResult(returnPath, result.ok ? "success" : result.reason) })
            res.end()
          } catch (error) {
            console.error("[gbp-auth]", error)
            res.writeHead(302, { Location: appendAuthResult(returnPath, "error") })
            res.end()
          }
          return
        }

        // ── Status ──────────────────────────────────────────────────────────
        if (url.pathname === "/api/auth/google/status") {
          sendJson(res, 200, await getGoogleAuthStatus(REQUIRED_GOOGLE_EMAIL, true))
          return
        }

        // ── Start OAuth flow ─────────────────────────────────────────────────
        if (url.pathname === "/api/auth/google/start") {
          // Encode return URL in the OAuth state param so callback knows where to redirect
          const rawReturn = url.searchParams.get("return") || "/settings"
          res.writeHead(302, { Location: buildGoogleAuthStartUrl({ redirectUri: GOOGLE_REDIRECT_URI, returnPath: rawReturn }) })
          res.end()
          return
        }

        // ── OAuth callback ───────────────────────────────────────────────────
        if (url.pathname === "/api/auth/google/callback") {
          const code = url.searchParams.get("code")
          const oauthError = url.searchParams.get("error")
          const returnPath = decodeAuthReturnPath(url.searchParams.get("state"))

          if (oauthError || !code) {
            console.error("[google-auth] callback error:", oauthError)
            res.writeHead(302, { Location: appendAuthResult(returnPath, "error") })
            res.end()
            return
          }

          try {
            const result = await completeGoogleAuthExchange({ code, redirectUri: GOOGLE_REDIRECT_URI, requiredEmail: REQUIRED_GOOGLE_EMAIL })
            res.writeHead(302, { Location: appendAuthResult(returnPath, result.ok ? "success" : result.reason) })
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

        // N8N callback — validate shared secret before accepting
        if (req.url === "/api/seo/onpage-audit/result" && req.method === "POST") {
          const callbackSecret = process.env.N8N_CALLBACK_SECRET ?? ""
          const authHeader = req.headers["authorization"] ?? ""
          if (!callbackSecret || authHeader !== `Bearer ${callbackSecret}`) {
            sendJson(res, 401, { error: "Unauthorized" })
            return
          }
          const body = await readJsonBody(req)
          const { url, html } = body as { url?: string; html?: string }
          if (!url || !html) {
            sendJson(res, 400, { error: "url and html are required" })
            return
          }
          auditResultStore.set(url, { html, receivedAt: Date.now() })
          sendJson(res, 200, { success: true })
          return
        }

        // Google Business Profile report
        if (req.url.startsWith("/api/seo/gbp/locations") && req.method === "GET") {
          try {
            sendJson(res, 200, { locations: await listGbpLocations() })
          } catch (error) {
            const message = error instanceof Error ? error.message : "GBP locations failed"
            sendJson(res, 500, { error: message })
          }
          return
        }

        if (req.url.startsWith("/api/seo/gbp") && req.method === "GET") {
          const { searchParams: sp } = new URL(req.url, "http://localhost")
          try {
            const data = await getGbpReport({
              site: sp.get("site") ?? "",
              ga4: sp.get("ga4") ?? "",
              client: sp.get("client") ?? "",
              gbpAccount: sp.get("gbpAccount") ?? "",
              gbpLocation: sp.get("gbpLocation") ?? "",
              startDate: sp.get("startDate") ?? "",
              endDate: sp.get("endDate") ?? "",
            })
            sendJson(res, 200, data)
          } catch (error) {
            const message = error instanceof Error ? error.message : "GBP report failed"
            console.error("[seo-api/gbp]", message)
            sendJson(res, 500, { error: message })
          }
          return
        }

        // Ahrefs snapshot — uses its own API key, no Google auth needed
        if (req.url.startsWith("/api/seo/ahrefs-snapshot") && req.method === "GET") {
          const { searchParams: sp } = new URL(req.url, "http://localhost")
          const target = sp.get("target") ?? ""
          try {
            const snapshot = await getAhrefsSnapshot({
              apiKey: process.env.AHREFS_API_KEY ?? "",
              target,
            })
            sendJson(res, 200, snapshot)
          } catch (error) {
            const message = error instanceof Error ? error.message : "Ahrefs request failed"
            const status = error instanceof AhrefsApiError ? error.upstreamStatus : 500
            console.error("[seo-api/ahrefs]", status, message)
            sendJson(res, status >= 400 && status < 600 ? status : 502, { error: message })
          }
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
          if (!isValidDate(startDate) || !isValidDate(endDate)) {
            sendJson(res, 400, { error: "startDate and endDate must be YYYY-MM-DD" })
            return
          }
          const normalizedSite = siteUrl.startsWith("sc-domain:")
            ? siteUrl
            : (() => { try { const u = new URL(siteUrl); return ["http:","https:"].includes(u.protocol) ? siteUrl : null } catch { return null } })()
          if (!normalizedSite) {
            sendJson(res, 400, { error: "siteUrl must be a valid http/https URL or sc-domain: property" })
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
          if (!isNumericId(propertyId)) {
            sendJson(res, 400, { error: "propertyId must be numeric" })
            return
          }
          if (!isValidDate(startDate) || !isValidDate(endDate)) {
            sendJson(res, 400, { error: "startDate and endDate must be YYYY-MM-DD" })
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
          const parsedUrl = (() => { try { return new URL(rawUrl.startsWith("sc-domain:") ? `https://${rawUrl.slice("sc-domain:".length)}/` : rawUrl) } catch { return null } })()
          if (!parsedUrl || !["http:", "https:"].includes(parsedUrl.protocol)) {
            sendJson(res, 400, { error: "url must be a valid http/https URL" })
            return
          }
          script = path.join(toolsDir, "psi_fetch.py")
          args = ["--url", parsedUrl.href]
        } else if (req.url.startsWith("/api/seo/onpage-audit/result") && req.method === "GET") {
          const url = searchParams.get("url") ?? ""
          if (!url) {
            sendJson(res, 400, { error: "url param required" })
            return
          }
          const entry = auditResultStore.get(url)
          if (!entry) {
            sendJson(res, 200, { ready: false })
          } else {
            sendJson(res, 200, { ready: true, html: entry.html, receivedAt: entry.receivedAt })
          }
          return
        } else if (req.url.startsWith("/api/seo/onpage-audit") && req.method === "POST") {
          const webhookUrl = process.env.N8N_ONPAGE_AUDIT_WEBHOOK ?? ""
          if (!webhookUrl) {
            sendJson(res, 503, { error: "N8N_ONPAGE_AUDIT_WEBHOOK is not configured in .env" })
            return
          }
          const body = await readJsonBody(req)
          const { landingPageUrl, screamingFrogSheetUrl, client } = body as { landingPageUrl?: string; screamingFrogSheetUrl?: string; client?: string }
          if (!landingPageUrl || !screamingFrogSheetUrl) {
            sendJson(res, 400, { error: "landingPageUrl and screamingFrogSheetUrl are required" })
            return
          }
          const parsedLanding = (() => { try { return new URL(landingPageUrl) } catch { return null } })()
          const parsedSheet   = (() => { try { return new URL(screamingFrogSheetUrl) } catch { return null } })()
          if (!parsedLanding || parsedLanding.protocol !== "https:") {
            sendJson(res, 400, { error: "landingPageUrl must be a valid https URL" })
            return
          }
          if (!parsedSheet || parsedSheet.protocol !== "https:") {
            sendJson(res, 400, { error: "screamingFrogSheetUrl must be a valid https URL" })
            return
          }
          try {
            // Read on every run so manual prompt edits take effect without rebuilding.
            const scoringPrompt = fs.readFileSync(SEO_AUDIT_PROMPT_PATH, "utf8").trim()
            const n8nRes = await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                "Landing Page Url": landingPageUrl,
                "Screaming Frog Google Sheet URL": screamingFrogSheetUrl,
                "Client Name": client?.trim() ?? "",
                "XMS Website Health Score Prompt": scoringPrompt,
                "Scoring Prompt File": "prompts/seo-audit-history.md",
              }),
            })
            if (!n8nRes.ok) {
              sendJson(res, 502, { error: `N8N webhook returned ${n8nRes.status}` })
              return
            }
            sendJson(res, 200, { success: true })
          } catch (err) {
            const message = err instanceof Error ? err.message : "N8N request failed"
            console.error("[seo-api/onpage-audit]", message)
            sendJson(res, 500, { error: message })
          }
          return
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
          if (!isNumericId(customerId.replace(/-/g, ""))) {
            sendJson(res, 400, { error: "customerId must be numeric" })
            return
          }
          if (!isValidDate(start) || !isValidDate(end)) {
            sendJson(res, 400, { error: "start and end must be YYYY-MM-DD" })
            return
          }
          script = path.join(toolsDir, "ads_fetch.py")
          args   = ["--customer-id", customerId, "--start", start, "--end", end]
        } else if (req.url.startsWith("/api/sem/search-terms")) {
          // Proxy to Supabase Edge Function (credentials live as Supabase secrets)
          const accountId = searchParams.get("accountId") ?? ""
          const startDate = searchParams.get("startDate") ?? ""
          const endDate   = searchParams.get("endDate")   ?? ""
          if (!accountId || !startDate || !endDate) {
            sendJson(res, 400, { error: "accountId, startDate, and endDate are required" })
            return
          }
          const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcHZ5eGR5bGVlYmhxbG1xc2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzgxODksImV4cCI6MjA4ODc1NDE4OX0.ZvzbBm-L8Jt3FzhmmX3qd7_inwrupjQrfh9JWIlX1ng"
          try {
            const upstream = await fetch(
              `https://sjpvyxdyleebhqlmqscy.supabase.co/functions/v1/sem/search-terms?accountId=${accountId}&startDate=${startDate}&endDate=${endDate}`,
              { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" } }
            )
            const data = await upstream.json()
            sendJson(res, upstream.status, data)
          } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : "Search terms error" })
          }
          return
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

function socialDevPlugin() {
  return {
    name: "social-api",
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/social/") || req.method !== "GET") {
          next()
          return
        }

        const { pathname, searchParams } = new URL(req.url, "http://localhost")
        const since = searchParams.get("since") ?? ""
        const until = searchParams.get("until") ?? ""
        if ((since && !isValidDate(since)) || (until && !isValidDate(until))) {
          sendJson(res, 400, { error: "since and until must be YYYY-MM-DD" })
          return
        }

        if (pathname === "/api/social/campaigns") {
          try {
            sendJson(res, 200, await getAdCampaigns({
              accessToken: process.env.META_ACCESS_TOKEN ?? "",
              pageId:      process.env.META_PAGE_ID      ?? "",
              since,
              until,
            }))
          } catch (error) {
            const message = error instanceof Error ? error.message : "Meta Ads API error"
            const status  = error instanceof MetaApiError ? error.upstreamStatus : 500
            console.error("[social-api/campaigns]", status, message)
            sendJson(res, status >= 400 && status < 600 ? status : 502, { error: message })
          }
          return
        }

        const insightsMatch = pathname.match(/^\/api\/social\/campaigns\/([^/]+)\/insights$/)
        if (insightsMatch) {
          try {
            sendJson(res, 200, await getCampaignInsightsSeries({
              accessToken: process.env.META_ACCESS_TOKEN ?? "",
              campaignId: decodeURIComponent(insightsMatch[1]),
              since,
              until,
            }))
          } catch (error) {
            const message = error instanceof Error ? error.message : "Meta Ads API error"
            const status  = error instanceof MetaApiError ? error.upstreamStatus : 500
            console.error("[social-api/campaign-insights]", status, message)
            sendJson(res, status >= 400 && status < 600 ? status : 502, { error: message })
          }
          return
        }

        if (pathname !== "/api/social/facebook") {
          next()
          return
        }

        try {
          const snapshot = await getFacebookPageSnapshot({
            accessToken: process.env.META_ACCESS_TOKEN ?? "",
            pageId:      process.env.META_PAGE_ID      ?? "",
            since,
            until,
          })
          sendJson(res, 200, snapshot)
        } catch (error) {
          const message = error instanceof Error ? error.message : "Meta Graph API error"
          const status  = error instanceof MetaApiError ? error.upstreamStatus : 500
          console.error("[social-api/facebook]", status, message)
          sendJson(res, status >= 400 && status < 600 ? status : 502, { error: message })
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

          const pdfBuffer = await exportPdfBuffer(body.payload)
          sendPdf(res, body.filename || "xms-report.pdf", pdfBuffer)
        } catch (error) {
          const message = error instanceof Error ? error.message : "PDF export error"
          console.error("[pdf-export]", message)
          sendJson(res, 500, { error: message })
        }
      })
    },
  }
}

function companySkillsPlugin() {
  return {
    name: "company-skills-api",
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/company-skills")) {
          next()
          return
        }

        if (req.method !== "GET") {
          sendJson(res, 405, { error: "Method not allowed" })
          return
        }

        try {
          const url = new URL(req.url, "http://localhost")
          const catalog = await getCompanySkillsCatalog({ refresh: url.searchParams.get("refresh") === "1" })
          sendJson(res, 200, catalog)
        } catch (error) {
          const message = error instanceof Error ? error.message : "Company skills request failed"
          console.error("[company-skills]", message)
          sendJson(res, 500, { error: message })
        }
      })
    },
  }
}

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

        if (!(await enforceRequiredGoogleAccount(res, "Monday"))) return

        // GET /api/monday/tasks?email=...
        if (url.pathname === "/api/monday/tasks" && req.method === "GET") {
          const emailMap = buildMondayEmailMap(process.env.MONDAY_EMAIL_MAP)
          const sessionEmail = url.searchParams.get("email") ?? ""
          const mondayEmail = emailMap[sessionEmail] ?? sessionEmail
          const bust = url.searchParams.get("bust") === "1"

          try {
            sendJson(res, 200, await fetchMondayTasksForUser({ mondayToken, sessionEmail: mondayEmail, bust }))
          } catch (err) {
            const message = err instanceof Error ? err.message : "Monday API error"
            console.error("[monday-api]", message)
            sendJson(res, (err as { statusCode?: number })?.statusCode ?? 500, { error: message })
          }
          return
        }

        // GET /api/monday/tasks/:taskId — item detail + updates
        if (/^\/api\/monday\/tasks\/\d+$/.test(url.pathname) && req.method === "GET") {
          const taskId = url.pathname.split("/").pop()!
          try {
            sendJson(res, 200, await fetchMondayTaskDetail({ mondayToken, taskId }))
          } catch (err) {
            const message = err instanceof Error ? err.message : "Monday API error"
            console.error("[monday-detail]", message)
            sendJson(res, (err as { statusCode?: number })?.statusCode ?? 500, { error: message })
          }
          return
        }

        next()
      })
    },
  }
}

function aiPlugin() {
  return {
    name: "ai-api",
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        const isAsk           = req.url === "/api/ai/ask"              && req.method === "POST"
        const isInsight       = req.url === "/api/ai/task-insight"     && req.method === "POST"
        const isSemInsight    = req.url === "/api/ai/sem-insights"     && req.method === "POST"
        const isSeoInsight    = req.url === "/api/ai/seo-insights"     && req.method === "POST"
        const isSocialInsight = req.url === "/api/ai/social-insights"  && req.method === "POST"
        const isPromptOptimize = req.url === "/api/ai/prompt-optimize"  && req.method === "POST"
        if (!isAsk && !isInsight && !isSemInsight && !isSeoInsight && !isSocialInsight && !isPromptOptimize) { next(); return }

        if (isPromptOptimize) {
          try {
            const body = await readJsonBody(req) as Record<string, unknown>
            const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
            if (!prompt) { sendJson(res, 400, { error: "prompt is required" }); return }
            const result = await optimizePromptWithOpenAI(prompt.slice(0, 12_000))
            sendJson(res, 200, result)
          } catch (err) {
            const message = err instanceof Error ? err.message : "OpenAI prompt optimization failed"
            console.error("[ai-prompt-optimize]", message)
            sendJson(res, (err as { statusCode?: number })?.statusCode ?? 502, { error: message })
          }
          return
        }

        const body = await readJsonBody(req) as Record<string, unknown>
        let tag = "ai-ask"
        let run: () => Promise<unknown> = () => askDashboardAi(body as never)
        if (isInsight)       { tag = "ai-task-insight";    run = () => getTaskInsight(body as never) }
        else if (isSemInsight)    { tag = "ai-sem-insights";    run = () => getSemInsights(body as never) }
        else if (isSocialInsight) { tag = "ai-social-insights"; run = () => getSocialInsights(body as never) }
        else if (isSeoInsight)    { tag = "ai-seo-insights";    run = () => getSeoInsights(body as never) }

        try {
          sendJson(res, 200, await run())
        } catch (err) {
          const message = err instanceof Error ? err.message : "AI error"
          console.error(`[${tag}]`, message)
          sendJson(res, (err as { statusCode?: number })?.statusCode ?? 500, { error: message })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), notionDevPlugin(), notebooklmDevPlugin(), googleAuthPlugin(), seoDevPlugin(), semDevPlugin(), socialDevPlugin(), pdfExportDevPlugin(), companySkillsPlugin(), mondayPlugin(), aiPlugin()],
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
