export const SEO_GOOGLE_EMAIL = "xperiencemarketingsolutions@gmail.com"
const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
]

export class SeoConnectionError extends Error {
  constructor(public code: string, message: string, public status = 503) {
    super(message)
  }
}

// OAuth credentials stay in Supabase secrets. A redeploy, browser logout or
// expired access token must never switch SEO to the Google Ads account.
export function createSeoGoogleConnection({
  env,
  fetchImpl = fetch,
  wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  now = Date.now,
}: {
  env: (name: string) => string | undefined
  fetchImpl?: typeof fetch
  wait?: (ms: number) => Promise<unknown>
  now?: () => number
}) {
  let cached: { token: string; validUntil: number } | null = null
  let pending: Promise<string> | null = null

  async function request(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(10_000) })
        if (response.status !== 429 && response.status < 500) return response
        await response.body?.cancel()
      } catch { /* Retry temporary network failures without exposing credentials. */ }
      if (attempt < 2) await wait(250 * 2 ** attempt)
    }
    throw new SeoConnectionError("GOOGLE_TEMPORARILY_UNAVAILABLE", "Google is temporarily unavailable. Your saved SEO connection has been kept. Try again shortly.")
  }

  async function refresh(): Promise<string> {
    const refreshToken = env("SEO_REFRESH_TOKEN")
    const clientId = env("GOOGLE_CLIENT_ID")
    const clientSecret = env("GOOGLE_CLIENT_SECRET")
    if (!refreshToken || !clientId || !clientSecret) {
      throw new SeoConnectionError("SEO_NOT_CONFIGURED", `Connect ${SEO_GOOGLE_EMAIL} for Search Console and GA4.`)
    }
    const response = await request("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
    })
    const data = await response.json()
    if (!response.ok || !data.access_token) {
      if (data.error === "invalid_grant") {
        throw new SeoConnectionError("SEO_RECONNECT_REQUIRED", `Google requires a new authorization for ${SEO_GOOGLE_EMAIL}. Client property assignments are saved.`)
      }
      throw new SeoConnectionError("SEO_CONFIGURATION_ERROR", "The SEO Google connection needs administrator attention.")
    }
    if (typeof data.scope === "string" && !SCOPES.every(scope => data.scope.split(" ").includes(scope))) {
      throw new SeoConnectionError("SEO_RECONNECT_REQUIRED", "Authorize read access to both Search Console and Google Analytics.")
    }
    const identityResponse = await request("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    if (!identityResponse.ok) {
      throw new SeoConnectionError("SEO_RECONNECT_REQUIRED", "Google could not verify the SEO account. Reconnect the required Gmail account.")
    }
    const identity = await identityResponse.json()
    if (identity.email?.toLowerCase() !== SEO_GOOGLE_EMAIL || identity.verified_email !== true) {
      throw new SeoConnectionError("SEO_WRONG_ACCOUNT", `SEO only accepts ${SEO_GOOGLE_EMAIL}.`)
    }
    // Verify the grant at least once a minute when in use, and share concurrent
    // refreshes. Access tokens are never returned by the public status endpoint.
    cached = { token: data.access_token, validUntil: now() + Math.max(0, Math.min(60_000, (Number(data.expires_in) || 3600) * 1000 - 60_000)) }
    return cached.token
  }

  async function getAccessToken(): Promise<string> {
    if (cached && now() < cached.validUntil) return cached.token
    if (!pending) pending = refresh().finally(() => { pending = null })
    return pending
  }

  async function getStatus() {
    try {
      await getAccessToken()
      return { connected: true, email: SEO_GOOGLE_EMAIL, requiredEmail: SEO_GOOGLE_EMAIL, automaticRenewal: true, checkedAt: new Date(now()).toISOString(), code: null, message: "GSC and GA4 use the shared Gmail account. Access renews automatically." }
    } catch (error) {
      const known = error instanceof SeoConnectionError ? error : new SeoConnectionError("GOOGLE_TEMPORARILY_UNAVAILABLE", "Unable to check Google right now. Try again shortly.")
      return { connected: false, email: null, requiredEmail: SEO_GOOGLE_EMAIL, automaticRenewal: true, checkedAt: new Date(now()).toISOString(), code: known.code, message: known.message }
    }
  }

  return { getAccessToken, getStatus }
}
