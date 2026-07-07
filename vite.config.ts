import path from "path"
import fs from "fs"
import os from "os"
import { spawn, execFile, type ChildProcessWithoutNullStreams } from "child_process"
import { promisify } from "util"
import { config as loadDotenv } from "dotenv"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import Anthropic from "@anthropic-ai/sdk"
import type { IncomingMessage, ServerResponse } from "http"
import { getCompanySkillsCatalog } from "./server/companySkills.js"

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
  const safeFilename = filename.replace(/["\r\n\\]/g, "").replace(/[^a-zA-Z0-9._\- ]/g, "_") || "report.pdf"
  res.statusCode = 200
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`)
  res.end(payload)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const NUMERIC_RE = /^\d+$/

function isValidDate(v: string) { return DATE_RE.test(v) }
function isNumericId(v: string) { return NUMERIC_RE.test(v) }
function isSafeReturnPath(v: string) { return v.startsWith("/") && !v.startsWith("//") }

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

const REQUIRED_GOOGLE_EMAIL = normalizeGoogleEmail(process.env.GOOGLE_REQUIRED_EMAIL ?? "")
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
  source: "SEO" | "SEM" | "Monday",
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
          const rawReturn = url.searchParams.get("return") || "/settings"
          const returnPath = isSafeReturnPath(rawReturn) ? rawReturn : "/settings"
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
            if (typeof decoded.returnPath === "string" && isSafeReturnPath(decoded.returnPath)) {
              returnPath = decoded.returnPath
            }
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

        // Ahrefs snapshot — uses its own API key, no Google auth needed
        if (req.url.startsWith("/api/seo/ahrefs-snapshot") && req.method === "GET") {
          const ahrefsApiKey = process.env.AHREFS_API_KEY ?? ""
          if (!ahrefsApiKey) {
            sendJson(res, 503, { error: "AHREFS_API_KEY is not configured in .env" })
            return
          }
          const { searchParams: sp } = new URL(req.url, "http://localhost")
          const target = sp.get("target") ?? ""
          if (!target) {
            sendJson(res, 400, { error: "target param is required" })
            return
          }
          const cleanTarget = target.replace(/^https?:\/\//, "").replace(/\/+$/, "").split("/")[0]
          const date = new Date().toISOString().slice(0, 10)
          try {
            const ahrefsRes = await fetch(
              `https://api.ahrefs.com/v3/site-explorer/overview?target=${encodeURIComponent(cleanTarget)}&date=${date}&mode=domain`,
              { headers: { Authorization: `Bearer ${ahrefsApiKey}` } }
            )
            if (!ahrefsRes.ok) {
              const errText = await ahrefsRes.text()
              console.error("[seo-api/ahrefs]", ahrefsRes.status, errText)
              sendJson(res, 502, { error: `Ahrefs API error: ${ahrefsRes.status}` })
              return
            }
            const d = await ahrefsRes.json() as Record<string, unknown>
            sendJson(res, 200, {
              domain:            cleanTarget,
              snapshot_date:     date,
              domain_rating:     d.domain_rating     ?? null,
              ahrefs_rank:       d.ahrefs_rank        ?? null,
              organic_keywords:  d.org_keywords       ?? d.organic_keywords  ?? null,
              organic_traffic:   d.org_traffic        ?? d.organic_traffic   ?? null,
              backlinks:         d.backlinks          ?? null,
              referring_domains: d.refdomains         ?? d.referring_domains ?? null,
            })
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Ahrefs request failed"
            console.error("[seo-api/ahrefs]", msg)
            sendJson(res, 500, { error: msg })
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
          const { landingPageUrl, screamingFrogSheetUrl } = body as { landingPageUrl?: string; screamingFrogSheetUrl?: string }
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
            const n8nRes = await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                "Landing Page Url": landingPageUrl,
                "Screaming Frog Google Sheet URL": screamingFrogSheetUrl,
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
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), ".pdf-export-"))
          const inputPath = path.join(tmpDir, "payload.json")
          const outputPath = path.join(tmpDir, "report.pdf")
          try {
            fs.writeFileSync(inputPath, JSON.stringify(body.payload, null, 2))

            await execFileAsync("python3", [path.join(toolsDir, "pdf_export.py"), "--input", inputPath, "--output", outputPath], {
              cwd: __dirname,
              timeout: 60_000,
            })

            const pdfBuffer = fs.readFileSync(outputPath)
            sendPdf(res, body.filename || "xms-report.pdf", pdfBuffer)
          } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
          }
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

        if (!(await enforceRequiredGoogleAccount(res, "Monday"))) return

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
          const bust = url.searchParams.get("bust") === "1"

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

            // Serve from cache if fresh (5 min TTL); skip when client requests a bust
            if (bust) mondayTaskCache.delete(user.id)
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

        // GET /api/monday/tasks/:taskId — item detail + updates
        if (/^\/api\/monday\/tasks\/\d+$/.test(url.pathname) && req.method === "GET") {
          const taskId = url.pathname.split("/").pop()!
          const mGQL = async (query: string, variables: Record<string, unknown> = {}) => {
            const r = await fetch("https://api.monday.com/v2", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: mondayToken, "API-Version": "2024-01" },
              body: JSON.stringify({ query, variables }),
            })
            if (!r.ok) throw new Error(`Monday API HTTP ${r.status}`)
            const j = await r.json() as { data?: unknown; errors?: { message: string }[] }
            if (j.errors?.length) throw new Error(j.errors.map((e: { message: string }) => e.message).join("; "))
            return j.data
          }
          try {
            const data = await mGQL(`
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
            `, { ids: [taskId] }) as {
              me?: { account?: { slug?: string } }
              items?: {
                id: string; name: string;
                board: { id: string; name: string };
                updates: { id: string; body: string; created_at: string; creator: { name: string; photo_thumb_small: string } }[]
              }[]
            }
            const item = data?.items?.[0] ?? null
            if (!item) { sendJson(res, 404, { error: "Task not found" }); return }
            const accountSlug = data?.me?.account?.slug ?? null
            const boardId = item.board?.id ?? null
            const mondayUrl = accountSlug && boardId
              ? `https://${accountSlug}.monday.com/boards/${boardId}/pulses/${item.id}`
              : null
            sendJson(res, 200, {
              id: item.id,
              boardId,
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
            sendJson(res, 500, { error: message })
          }
          return
        }

        next()
      })
    },
  }
}

function aiPlugin() {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  return {
    name: "ai-api",
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        const isAsk           = req.url === "/api/ai/ask"              && req.method === "POST"
        const isInsight       = req.url === "/api/ai/task-insight"     && req.method === "POST"
        const isSemInsight    = req.url === "/api/ai/sem-insights"     && req.method === "POST"
        const isSeoInsight    = req.url === "/api/ai/seo-insights"     && req.method === "POST"
        const isSocialInsight = req.url === "/api/ai/social-insights"  && req.method === "POST"
        if (!isAsk && !isInsight && !isSemInsight && !isSeoInsight && !isSocialInsight) { next(); return }

        if (!process.env.ANTHROPIC_API_KEY) {
          sendJson(res, 503, { error: "ANTHROPIC_API_KEY not configured in .env" })
          return
        }

        try {
          const body = await readJsonBody(req) as Record<string, unknown>

          // ── /api/ai/task-insight ──────────────────────────────────────────
          if (isInsight) {
            const task    = body.task    as Record<string, string> | undefined
            const updates = body.updates as Array<Record<string, string>> | undefined
            if (!task?.name) { sendJson(res, 400, { error: "task is required" }); return }

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

            const msg = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 512,
              system: `You are XMS AI, embedded in a marketing agency dashboard. Analyze task details and give concise, actionable next-step recommendations.
Respond in the same language as the task content (Spanish or English).
Format: 2–4 bullet points using "·" as the bullet character. Each point = one clear immediate action.
No intro sentence, no conclusion. Just the actions. Keep each bullet under 20 words.`,
              messages: [{ role: "user", content: userPrompt }],
            })
            const text = msg.content.find(b => b.type === "text")?.text ?? ""
            sendJson(res, 200, { insight: text })
            return
          }

          // ── /api/ai/sem-insights ─────────────────────────────────────────
          if (isSemInsight) {
            const { accountName, summary, campaigns } = body as {
              accountName?: string
              summary?: Record<string, number>
              campaigns?: Record<string, unknown>[]
            }
            if (!accountName) { sendJson(res, 400, { error: "accountName is required" }); return }

            const campaignText = (campaigns ?? []).slice(0, 8).map(c =>
              `• ${c.name}: ${Number(c.impressions).toLocaleString()} impr, ${c.clicks} clicks, ${Number(c.ctr).toFixed(2)}% CTR, $${Number(c.avg_cpc).toFixed(2)} CPC, $${Number(c.cost).toFixed(2)} spend, ${c.conversions} conv`
            ).join("\n") || "No campaign data available"

            const userPrompt = `Account: ${accountName}

Performance Summary:
• Impressions: ${Number(summary?.impressions ?? 0).toLocaleString()}
• Clicks: ${Number(summary?.clicks ?? 0).toLocaleString()}
• CTR: ${Number(summary?.ctr ?? 0).toFixed(2)}%
• Avg CPC: $${Number(summary?.avg_cpc ?? 0).toFixed(2)}
• Total Spend: $${Number(summary?.cost ?? 0).toFixed(2)}
• Conversions: ${summary?.conversions ?? 0}
• Cost per Conversion: ${(summary?.conversions ?? 0) > 0 ? "$" + Number(summary?.cost_per_conversion ?? 0).toFixed(2) : "N/A"}

Top Campaigns by Spend:
${campaignText}

Provide 2-3 specific, data-driven action items per timeframe. Reference actual numbers from the data. Return ONLY valid JSON (no markdown, no explanation):
{"short_term":[{"action":"...","impact":"high|medium|low"}],"medium_term":[{"action":"...","impact":"high|medium|low"}],"long_term":[{"action":"...","impact":"high|medium|low"}]}`

            const semMsg = await anthropic.messages.create({
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
            const semText = semMsg.content.find(b => b.type === "text")?.text ?? "{}"
            const cleaned = semText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
            sendJson(res, 200, JSON.parse(cleaned))
            return
          }

          // ── /api/ai/social-insights ──────────────────────────────────────
          if (isSocialInsight) {
            const { accountName, platforms, metrics, posts } = body as {
              accountName?: string; platforms?: string[]
              metrics?: Record<string, number>; posts?: Record<string, unknown>[]
            }
            if (!platforms?.length) { sendJson(res, 400, { error: "platforms is required" }); return }

            const engagementRate = (metrics?.impresiones ?? 0) > 0
              ? (((metrics?.interacciones ?? 0) / (metrics?.impresiones ?? 1)) * 100).toFixed(2)
              : "0.00"
            const topPosts = (posts ?? []).slice(0, 8).map(p =>
              `• [${p.platform}] ${p.type} — "${p.title}": ${Number(p.impresiones).toLocaleString()} impr, ${p.interacciones} interactions`
            ).join("\n") || "No post data"

            const socialPrompt = `Account: ${accountName || "Social Media Account"}
Active platforms: ${platforms.join(", ")}
Followers: ${Number(metrics?.seguidores ?? 0).toLocaleString()}
Impressions: ${Number(metrics?.impresiones ?? 0).toLocaleString()}
Reach: ${Number(metrics?.alcance ?? 0).toLocaleString()}
Interactions: ${Number(metrics?.interacciones ?? 0).toLocaleString()}
Engagement Rate: ${engagementRate}%
Profile Visits: ${Number(metrics?.visitasPerfil ?? 0).toLocaleString()}

Top posts:
${topPosts}

Return ONLY valid JSON: {"short_term":[{"action":"...","impact":"high|medium|low"}],"medium_term":[...],"long_term":[]}`

            const socialMsg = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 1024,
              system: `You are a senior social media strategist. Analyze performance data and provide 2-3 specific, data-driven action items per timeframe:
SHORT-TERM (7-14 days): posting frequency, content format optimization, best times to post, engagement tactics.
MEDIUM-TERM (30-60 days): content calendar, A/B testing, cross-platform repurposing, hashtag strategy.
LONG-TERM (3-6 months): audience growth, brand voice, influencer collabs, platform-specific strategy.
Cite specific numbers and platform names. Always respond in English.
Return ONLY the JSON object. No markdown, no code fences.`,
              messages: [{ role: "user", content: socialPrompt }],
            })
            const socialText = socialMsg.content.find(b => b.type === "text")?.text ?? "{}"
            const socialClean = socialText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
            sendJson(res, 200, JSON.parse(socialClean))
            return
          }

          // ── /api/ai/seo-insights ─────────────────────────────────────────
          if (isSeoInsight) {
            const { clientName, gscSite, gsc, ga4, psiScore } = body as {
              clientName?: string; gscSite?: string
              gsc?: Record<string, unknown>; ga4?: Record<string, unknown>; psiScore?: number | null
            }
            if (!gscSite) { sendJson(res, 400, { error: "gscSite is required" }); return }

            const displayName = clientName || String(gscSite).replace(/^https?:\/\//, "").replace(/\/$/, "")
            const queries = (gsc?.queries as Record<string, unknown>[] | undefined ?? []).slice(0, 8)
            const topQueries = queries.map(q =>
              `• "${q.query}": ${q.clicks} clicks, ${q.impressions} impr, pos ${Number(q.position).toFixed(1)}, ${Number(Number(q.ctr) * 100).toFixed(1)}% CTR`
            ).join("\n") || "No query data"
            const pages = (ga4?.topPages as Record<string, unknown>[] | undefined ?? []).slice(0, 5)
            const topPages = pages.map(p => `• ${p.page}${p.sessions ? `: ${p.sessions} sessions` : ""}`).join("\n") || "No page data"

            const userPrompt = `Website: ${displayName} (${gscSite})

Google Search Console:
• Total Clicks: ${Number(gsc?.totalClicks ?? 0).toLocaleString()}
• Total Impressions: ${Number(gsc?.totalImpressions ?? 0).toLocaleString()}
• Avg. Position: ${Number(gsc?.avgPosition ?? 0).toFixed(1)}

Top Queries:
${topQueries}

Google Analytics 4:
• Engaged Sessions: ${Number(ga4?.engagedSessions ?? 0).toLocaleString()}
• Conversion Rate: ${Number(ga4?.conversionRate ?? 0).toFixed(2)}%

Top Pages:
${topPages}

${psiScore != null ? `PageSpeed Score (mobile): ${psiScore}/100` : ""}

Return ONLY valid JSON: {"short_term":[{"action":"...","impact":"high|medium|low"}],"medium_term":[...],"long_term":[]}`

            const seoMsg = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 1024,
              system: `You are a senior SEO strategist. Analyze organic search data and provide 2-3 specific, data-driven action items per timeframe:
SHORT-TERM (7-14 days): meta descriptions for high-impression/low-CTR queries, internal linking, quick fixes.
MEDIUM-TERM (30-60 days): content for near-first-page keywords, structured data, page speed.
LONG-TERM (3-6 months): authority building, content clusters, Core Web Vitals, site architecture.
Cite specific query names and numbers. Always respond in English.
Return ONLY the JSON object. No markdown, no code fences, no explanation.`,
              messages: [{ role: "user", content: userPrompt }],
            })
            const seoText = seoMsg.content.find(b => b.type === "text")?.text ?? "{}"
            const seoClean = seoText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
            sendJson(res, 200, JSON.parse(seoClean))
            return
          }

          // ── /api/ai/ask ───────────────────────────────────────────────────
          const { query, context } = body as { query?: string; context?: unknown }
          if (!query?.trim()) {
            sendJson(res, 400, { error: "query is required" })
            return
          }

          let contextBlock = ""
          if (context) {
            const ctx = context as Record<string, unknown>
            const parts: string[] = []
            if (ctx.today) parts.push(`Today is: ${ctx.today}`)
            if (ctx.currentPage) parts.push(`User is currently on page: ${ctx.currentPage}`)
            if (Array.isArray(ctx.tasks) && ctx.tasks.length > 0) {
              const taskLines = ctx.tasks.map((t: Record<string, unknown>) =>
                `- [${t.status ?? "—"}] ${t.name} (board: ${t.board}, priority: ${t.priority ?? "none"}, due: ${t.dueDate ?? "no date"})`
              ).join("\n")
              parts.push(`User's current tasks from Monday.com:\n${taskLines}`)
            } else if (Array.isArray(ctx.tasks)) {
              parts.push("User has no tasks assigned in Monday.com right now.")
            }
            if (parts.length) contextBlock = `\n\n---\n${parts.join("\n\n")}\n---`
          }

          const message = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            system: `You are XMS AI, an assistant embedded in a marketing agency dashboard called XMS (Xperience Marketing Suite).
You help the team with tasks, campaigns, clients, SEM/SEO performance, and scheduling.
Respond in the same language the user writes in (Spanish or English).

Formatting rules (strictly follow these):
- Never use markdown tables, headers (###), or horizontal rules.
- Use plain short sentences or simple bullet points with "·" as the bullet character.
- Keep responses to 3–6 lines max. Be direct and conversational.
- If listing tasks, write each on its own line like: "· Task name — due May 13"
- No bold overuse — only bold 1–2 key words at most per response.

Use the dashboard context below to give specific, data-driven answers. Never invent data you don't have.${contextBlock}`,
            messages: [{ role: "user", content: query }],
          })

          const text = message.content.find(b => b.type === "text")?.text ?? ""
          sendJson(res, 200, { response: text })
        } catch (err) {
          const message = err instanceof Error ? err.message : "AI error"
          console.error("[ai-ask]", message)
          sendJson(res, 500, { error: message })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), notebooklmDevPlugin(), googleAuthPlugin(), seoDevPlugin(), semDevPlugin(), pdfExportDevPlugin(), companySkillsPlugin(), mondayPlugin(), aiPlugin()],
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
