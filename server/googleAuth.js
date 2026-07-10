/**
 * server/googleAuth.js
 * Google OAuth reconnect flow for PRODUCTION (server.js).
 * Same behavior as the dev flow in vite.config.ts: only GOOGLE_REQUIRED_EMAIL
 * may connect; the resulting token.json feeds every server-side Google call
 * (GSC, GA4, Ads, GBP) for all dashboard viewers.
 *
 * Requires in production env:
 *   PUBLIC_BASE_URL        e.g. https://dashboard.xperienceusa.com
 *   GOOGLE_REQUIRED_EMAIL  e.g. eva@xperienceusa.com
 * And the redirect URI `${PUBLIC_BASE_URL}/api/auth/google/callback`
 * registered in the GCP OAuth client's Authorized redirect URIs.
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOKEN_PATH = path.resolve(__dirname, "..", "token.json")
const CREDS_PATH = path.resolve(__dirname, "..", "credentials.json")

export const GOOGLE_API_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/business.manage",
]

function normalizeGoogleEmail(input) {
  const email = String(input).trim().toLowerCase()
  return email.endsWith("@xperienceusa") ? `${email}.com` : email
}

function isSafeReturnPath(v) {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//")
}

function appendAuthResult(returnPath, authResult) {
  const separator = returnPath.includes("?") ? "&" : "?"
  return `${returnPath}${separator}auth=${authResult}`
}

function getClientCreds() {
  const raw = JSON.parse(fs.readFileSync(CREDS_PATH, "utf-8"))
  const data = raw.installed || raw.web
  return { client_id: data.client_id, client_secret: data.client_secret }
}

function readStoredToken() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"))
  } catch {
    return null
  }
}

async function fetchGoogleAccountEmail(accessToken) {
  if (!accessToken) return null
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null
    const info = await response.json()
    return typeof info.email === "string" ? info.email : null
  } catch {
    return null
  }
}

async function refreshGoogleAccessToken(refreshToken, clientId, clientSecret) {
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
    const tokenData = await response.json()
    return tokenData.access_token ?? null
  } catch {
    return null
  }
}

const TOKEN_STATUS_CACHE_TTL_MS = 30_000
let tokenStatusCache = null

async function readTokenStatus(requiredEmail, force = false) {
  if (!force && tokenStatusCache && Date.now() - tokenStatusCache.at < TOKEN_STATUS_CACHE_TTL_MS) {
    return tokenStatusCache.status
  }

  const disconnected = { connected: false, email: null, requiredEmail, allowed: false }

  try {
    const tokenJson = readStoredToken()
    if (!tokenJson?.refresh_token) {
      tokenStatusCache = { at: Date.now(), status: disconnected }
      return disconnected
    }

    let email = typeof tokenJson._connected_email === "string" ? tokenJson._connected_email : null
    if (!email) {
      const creds = getClientCreds()
      const accessToken = await refreshGoogleAccessToken(
        tokenJson.refresh_token,
        tokenJson.client_id ?? creds.client_id,
        tokenJson.client_secret ?? creds.client_secret,
      )
      email = accessToken ? await fetchGoogleAccountEmail(accessToken) : null
    }

    const status = {
      connected: true,
      email,
      requiredEmail,
      allowed: !!email && normalizeGoogleEmail(email) === requiredEmail,
    }
    tokenStatusCache = { at: Date.now(), status }
    return status
  } catch {
    tokenStatusCache = { at: Date.now(), status: disconnected }
    return disconnected
  }
}

// ─── GBP-only token (separate Google account that owns the Business Profiles) ─
// Uses credentials-gbp.json if present (e.g. Steven's GCP client with approved
// GBP API quota), else falls back to the main credentials.json.

const GBP_TOKEN_PATH = path.resolve(__dirname, "..", "token-gbp.json")
const GBP_CREDS_PATH = path.resolve(__dirname, "..", "credentials-gbp.json")
const GBP_SCOPES = ["https://www.googleapis.com/auth/business.manage"]

function getGbpClientCreds() {
  const credsPath = fs.existsSync(GBP_CREDS_PATH) ? GBP_CREDS_PATH : CREDS_PATH
  const raw = JSON.parse(fs.readFileSync(credsPath, "utf-8"))
  const data = raw.installed || raw.web
  return { client_id: data.client_id, client_secret: data.client_secret }
}

export function registerGbpAuthRoutes(app) {
  const requiredEmail = (process.env.GBP_REQUIRED_EMAIL ?? "xperiencemarketingsolutions@gmail.com").trim().toLowerCase()
  const baseUrl = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "")
  const redirectUri = `${baseUrl}/api/auth/gbp/callback`

  app.get("/api/auth/gbp/status", async (_req, res) => {
    try {
      const tokenJson = JSON.parse(fs.readFileSync(GBP_TOKEN_PATH, "utf-8"))
      res.json({
        connected: !!tokenJson.refresh_token,
        email: tokenJson._connected_email ?? null,
        requiredEmail,
        allowed: (tokenJson._connected_email ?? "").toLowerCase() === requiredEmail,
      })
    } catch {
      res.json({ connected: false, email: null, requiredEmail, allowed: false })
    }
  })

  app.get("/api/auth/gbp/start", (req, res) => {
    try {
      const { client_id } = getGbpClientCreds()
      const rawReturn = typeof req.query.return === "string" ? req.query.return : "/settings"
      const returnPath = isSafeReturnPath(rawReturn) ? rawReturn : "/settings"
      const state = Buffer.from(JSON.stringify({ returnPath })).toString("base64url")

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
      authUrl.searchParams.set("client_id", client_id)
      authUrl.searchParams.set("redirect_uri", redirectUri)
      authUrl.searchParams.set("response_type", "code")
      authUrl.searchParams.set("scope", [...GBP_SCOPES, "https://www.googleapis.com/auth/userinfo.email"].join(" "))
      authUrl.searchParams.set("access_type", "offline")
      authUrl.searchParams.set("prompt", "consent")
      authUrl.searchParams.set("state", state)
      res.redirect(authUrl.toString())
    } catch (err) {
      console.error("[gbp-auth] start error:", err instanceof Error ? err.message : err)
      res.status(500).json({ error: "credentials file missing or invalid" })
    }
  })

  app.get("/api/auth/gbp/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : ""
    let returnPath = "/settings"
    try {
      const decoded = JSON.parse(Buffer.from(String(req.query.state ?? ""), "base64url").toString())
      if (isSafeReturnPath(decoded.returnPath)) returnPath = decoded.returnPath
    } catch { /* use default */ }

    if (req.query.error || !code) {
      console.error("[gbp-auth] callback error:", req.query.error)
      return res.redirect(appendAuthResult(returnPath, "error"))
    }

    try {
      const { client_id, client_secret } = getGbpClientCreds()

      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id, client_secret, redirect_uri: redirectUri, grant_type: "authorization_code" }).toString(),
      })
      const tokenData = await tokenResp.json()

      if (tokenData.error) {
        console.error("[gbp-auth] token exchange error:", tokenData)
        return res.redirect(appendAuthResult(returnPath, "error"))
      }

      const email = await fetchGoogleAccountEmail(tokenData.access_token ?? "")
      if (!email || email.toLowerCase() !== requiredEmail) {
        console.warn("[gbp-auth] rejected account:", email ?? "unknown")
        return res.redirect(appendAuthResult(returnPath, "wrong-account"))
      }

      fs.writeFileSync(GBP_TOKEN_PATH, JSON.stringify({
        token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_uri: "https://oauth2.googleapis.com/token",
        client_id,
        client_secret,
        scopes: GBP_SCOPES,
        _connected_email: email,
      }, null, 2))
      console.log("[gbp-auth] token-gbp.json saved for", email)

      res.redirect(appendAuthResult(returnPath, "success"))
    } catch (err) {
      console.error("[gbp-auth]", err)
      res.redirect(appendAuthResult(returnPath, "error"))
    }
  })
}

export function registerGoogleAuthRoutes(app) {
  const requiredEmail = normalizeGoogleEmail(process.env.GOOGLE_REQUIRED_EMAIL ?? "")
  const baseUrl = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "")
  const redirectUri = `${baseUrl}/api/auth/google/callback`

  app.get("/api/auth/google/status", async (_req, res) => {
    res.json(await readTokenStatus(requiredEmail, true))
  })

  app.get("/api/auth/google/start", (req, res) => {
    try {
      const { client_id } = getClientCreds()
      const rawReturn = typeof req.query.return === "string" ? req.query.return : "/settings"
      const returnPath = isSafeReturnPath(rawReturn) ? rawReturn : "/settings"
      const state = Buffer.from(JSON.stringify({ returnPath })).toString("base64url")

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
      authUrl.searchParams.set("client_id", client_id)
      authUrl.searchParams.set("redirect_uri", redirectUri)
      authUrl.searchParams.set("response_type", "code")
      authUrl.searchParams.set("scope", [...GOOGLE_API_SCOPES, "https://www.googleapis.com/auth/userinfo.email"].join(" "))
      authUrl.searchParams.set("access_type", "offline")
      authUrl.searchParams.set("prompt", "consent")
      authUrl.searchParams.set("state", state)
      res.redirect(authUrl.toString())
    } catch (err) {
      console.error("[google-auth] start error:", err instanceof Error ? err.message : err)
      res.status(500).json({ error: "credentials.json missing or invalid" })
    }
  })

  app.get("/api/auth/google/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : ""
    const oauthError = req.query.error
    let returnPath = "/settings"
    try {
      const decoded = JSON.parse(Buffer.from(String(req.query.state ?? ""), "base64url").toString())
      if (isSafeReturnPath(decoded.returnPath)) returnPath = decoded.returnPath
    } catch { /* use default */ }

    if (oauthError || !code) {
      console.error("[google-auth] callback error:", oauthError)
      return res.redirect(appendAuthResult(returnPath, "error"))
    }

    try {
      const { client_id, client_secret } = getClientCreds()

      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id, client_secret, redirect_uri: redirectUri, grant_type: "authorization_code" }).toString(),
      })
      const tokenData = await tokenResp.json()

      if (tokenData.error) {
        console.error("[google-auth] token exchange error:", tokenData)
        return res.redirect(appendAuthResult(returnPath, "error"))
      }

      const email = await fetchGoogleAccountEmail(tokenData.access_token ?? "")
      if (!email || normalizeGoogleEmail(email) !== requiredEmail) {
        console.warn("[google-auth] rejected account:", email ?? "unknown")
        return res.redirect(appendAuthResult(returnPath, "wrong-account"))
      }

      const tokenJson = {
        token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_uri: "https://oauth2.googleapis.com/token",
        client_id,
        client_secret,
        scopes: GOOGLE_API_SCOPES,
        _connected_email: email,
      }
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenJson, null, 2))
      tokenStatusCache = null
      console.log("[google-auth] token.json saved for", email)

      res.redirect(appendAuthResult(returnPath, "success"))
    } catch (err) {
      console.error("[google-auth]", err)
      res.redirect(appendAuthResult(returnPath, "error"))
    }
  })
}
