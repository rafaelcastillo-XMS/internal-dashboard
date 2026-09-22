// Administrator recovery: authorize the fixed SEO account, validate its read
// permissions, then replace only SEO_REFRESH_TOKEN in Supabase secrets.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import http from "node:http"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const project = "sjpvyxdyleebhqlmqscy"
const email = "xperiencemarketingsolutions@gmail.com"
const credentials = JSON.parse(fs.readFileSync(path.join(root, "credentials.json"), "utf8")).installed
if (!credentials) throw new Error("This local recovery flow requires the installed OAuth client in credentials.json.")
const digest = value => crypto.createHash("sha256").update(value).digest("hex")
const secrets = JSON.parse(execFileSync("supabase", ["secrets", "list", "--project-ref", project, "-o", "json"], { encoding: "utf8", cwd: root }))
if (secrets.find(s => s.name === "GOOGLE_CLIENT_ID")?.value !== digest(credentials.client_id) || secrets.find(s => s.name === "GOOGLE_CLIENT_SECRET")?.value !== digest(credentials.client_secret)) {
  throw new Error("Local Google client credentials do not match the deployed SEO client. No credentials were changed.")
}

const state = crypto.randomBytes(32).toString("hex")
const verifier = crypto.randomBytes(48).toString("base64url")
const scopes = ["https://www.googleapis.com/auth/webmasters.readonly", "https://www.googleapis.com/auth/analytics.readonly", "https://www.googleapis.com/auth/userinfo.email"]
let redirectUri
let authorizationUrl
let exchanging = false

async function google(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
  const data = await response.json()
  if (!response.ok) throw new Error(`Google rejected the request (${response.status}). Retry authorization and check permissions.`)
  return data
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri)
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Referrer-Policy", "no-referrer")
  if (url.pathname === "/") { res.writeHead(302, { Location: authorizationUrl }); res.end(); return }
  if (url.pathname !== "/callback") { res.writeHead(404); res.end(); return }
  if (url.searchParams.get("state") !== state || !url.searchParams.get("code") || exchanging) {
    res.writeHead(400); res.end("Authorization incomplete. Reopen the connection link."); return
  }
  exchanging = true
  let temporaryDirectory
  try {
    const token = await google("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: url.searchParams.get("code"), client_id: credentials.client_id, client_secret: credentials.client_secret, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: verifier }),
    })
    if (!token.refresh_token || !scopes.slice(0, 2).every(scope => (token.scope ?? "").split(" ").includes(scope))) throw new Error("Authorize offline read access to both GSC and GA4.")
    const headers = { Authorization: `Bearer ${token.access_token}` }
    const identity = await google("https://www.googleapis.com/oauth2/v2/userinfo", { headers })
    if (identity.email?.toLowerCase() !== email || identity.verified_email !== true) throw new Error(`Use ${email}.`)
    await Promise.all([
      google("https://www.googleapis.com/webmasters/v3/sites", { headers }),
      google("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", { headers }),
    ])
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "seo-google-"))
    fs.chmodSync(temporaryDirectory, 0o700)
    const secretFile = path.join(temporaryDirectory, "secret.env")
    fs.writeFileSync(secretFile, `SEO_REFRESH_TOKEN=${token.refresh_token}\n`, { mode: 0o600 })
    execFileSync("supabase", ["secrets", "set", "--env-file", secretFile, "--project-ref", project], { cwd: root, stdio: ["ignore", "ignore", "ignore"] })
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.end("<h2>SEO Gmail connected</h2><p>Return to the dashboard and check the SEO connection. Allow up to one minute for the new authorization to take effect.</p>")
    console.log(`Connected ${email}. SEO_REFRESH_TOKEN updated; client property assignments retained.`)
    clearTimeout(timeout)
    server.close()
  } catch (error) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" })
    res.end(error instanceof Error && !('stderr' in error) ? error.message : "Could not save the SEO authorization. Check the administrator's Supabase CLI access and retry.")
    exchanging = false
  } finally {
    if (temporaryDirectory) fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  }
})
server.listen(0, "127.0.0.1", () => {
  const { port } = server.address()
  redirectUri = `http://127.0.0.1:${port}/callback`
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  auth.search = new URLSearchParams({ client_id: credentials.client_id, redirect_uri: redirectUri, response_type: "code", scope: scopes.join(" "), access_type: "offline", prompt: "consent", login_hint: email, state, code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString()
  authorizationUrl = auth.href
  console.log(`Open http://127.0.0.1:${port} on this computer and authorize ${email}.`)
})
const timeout = setTimeout(() => { console.error("Authorization timed out. Run the command again."); server.close(); process.exitCode = 1 }, 15 * 60_000)
