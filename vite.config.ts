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
  const API_SCOPES = [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/adwords",
  ]
  const REDIRECT_URI = "http://localhost:5173/api/auth/google/callback"
  const TOKEN_PATH = path.resolve(__dirname, "token.json")
  const CREDS_PATH = path.resolve(__dirname, "credentials.json")

  function getClientCreds() {
    const raw = JSON.parse(fs.readFileSync(CREDS_PATH, "utf-8"))
    const d = raw.installed || raw.web
    return { client_id: d.client_id as string, client_secret: d.client_secret as string }
  }

  function readTokenStatus(): { connected: boolean; email: string | null } {
    try {
      const t = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"))
      return { connected: !!t.refresh_token, email: (t._connected_email as string) || null }
    } catch {
      return { connected: false, email: null }
    }
  }

  return {
    name: "google-auth",
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/auth/google/")) { next(); return }

        const url = new URL(req.url, "http://localhost")

        // ── Status ──────────────────────────────────────────────────────────
        if (url.pathname === "/api/auth/google/status") {
          sendJson(res, 200, readTokenStatus())
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
          authUrl.searchParams.set("redirect_uri", REDIRECT_URI)
          authUrl.searchParams.set("response_type", "code")
          authUrl.searchParams.set("scope", [...API_SCOPES, "https://www.googleapis.com/auth/userinfo.email"].join(" "))
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
            res.writeHead(302, { Location: `${returnPath}?auth=error` })
            res.end()
            return
          }

          try {
            const { client_id, client_secret } = getClientCreds()

            // Exchange code → tokens
            const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ code, client_id, client_secret, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }).toString(),
            })
            const tokenData = await tokenResp.json() as Record<string, string>

            if (tokenData.error) {
              console.error("[google-auth] token exchange error:", tokenData)
              res.writeHead(302, { Location: `${returnPath}?auth=error` })
              res.end()
              return
            }

            // Fetch connected account email
            let email: string | null = null
            try {
              const infoResp = await fetch("https://www.googleapis.com/oauth2/v1/userinfo", {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
              })
              const info = await infoResp.json() as { email?: string }
              email = info.email ?? null
            } catch { /* non-critical */ }

            // Save token.json in google-auth (Python) format
            const tokenJson: Record<string, unknown> = {
              token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              token_uri: "https://oauth2.googleapis.com/token",
              client_id,
              client_secret,
              scopes: API_SCOPES,
            }
            if (email) tokenJson._connected_email = email

            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenJson, null, 2))
            console.log("[google-auth] ✓ token.json saved for", email ?? "unknown user")

            res.writeHead(302, { Location: `${returnPath}?auth=success` })
            res.end()
          } catch (err) {
            console.error("[google-auth]", err)
            res.writeHead(302, { Location: `${returnPath}?auth=error` })
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), notebooklmDevPlugin(), googleAuthPlugin(), seoDevPlugin(), semDevPlugin()],
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
