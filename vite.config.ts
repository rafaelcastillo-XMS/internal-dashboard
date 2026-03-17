import path from "path"
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
  plugins: [react(), notebooklmDevPlugin(), seoDevPlugin(), semDevPlugin()],
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
