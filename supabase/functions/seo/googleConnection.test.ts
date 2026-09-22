import { describe, expect, it, vi } from "vitest"
import { createSeoGoogleConnection, SEO_GOOGLE_EMAIL } from "./googleConnection"

const scopes = "https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly"
const env = (name: string) => ({ SEO_REFRESH_TOKEN: "seo-only-secret", GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret", GOOGLE_REFRESH_TOKEN: "ads-must-not-be-used" }[name])
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
const token = () => json({ access_token: "short-lived-secret", expires_in: 3600, scope: scopes })
const identity = () => json({ email: SEO_GOOGLE_EMAIL, verified_email: true })

describe("persistent SEO Gmail connection", () => {
  it("never falls back to the Ads credential if the SEO grant is missing", async () => {
    const fetchImpl = vi.fn()
    const connection = createSeoGoogleConnection({ env: name => name === "SEO_REFRESH_TOKEN" ? undefined : env(name), fetchImpl })
    expect(await connection.getStatus()).toMatchObject({ connected: false, code: "SEO_NOT_CONFIGURED" })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("verifies Gmail, shares simultaneous refreshes, and renews without user interaction", async () => {
    let now = 0
    const fetchImpl = vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(identity()).mockResolvedValueOnce(token()).mockResolvedValueOnce(identity())
    const connection = createSeoGoogleConnection({ env, fetchImpl, now: () => now })
    await Promise.all([connection.getAccessToken(), connection.getAccessToken()])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const body = fetchImpl.mock.calls[0][1].body as URLSearchParams
    expect(body.get("refresh_token")).toBe("seo-only-secret")
    const status = await connection.getStatus()
    expect(status).toMatchObject({ connected: true, email: SEO_GOOGLE_EMAIL, automaticRenewal: true })
    expect(JSON.stringify(status)).not.toContain("secret")
    now = 61_000
    await connection.getAccessToken()
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it("rejects a valid token from another account", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ email: "eva@xperienceusa.com", verified_email: true }))
    expect(await createSeoGoogleConnection({ env, fetchImpl }).getStatus()).toMatchObject({ connected: false, code: "SEO_WRONG_ACCOUNT" })
  })

  it("reports revocation without retrying or exposing provider responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ error: "invalid_grant", error_description: "sensitive diagnostic" }, 400))
    const status = await createSeoGoogleConnection({ env, fetchImpl }).getStatus()
    expect(status).toMatchObject({ connected: false, code: "SEO_RECONNECT_REQUIRED" })
    expect(JSON.stringify(status)).not.toContain("sensitive")
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("recovers from temporary Google failure without asking for another consent", async () => {
    const wait = vi.fn().mockResolvedValue(undefined)
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(token()).mockResolvedValueOnce(identity())
    expect(await createSeoGoogleConnection({ env, fetchImpl, wait }).getStatus()).toMatchObject({ connected: true })
    expect(wait).toHaveBeenCalledTimes(1)
  })

  it("distinguishes prolonged outages from revoked authorization and bounds retries", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("Network unavailable"))
    const status = await createSeoGoogleConnection({ env, fetchImpl, wait: async () => {} }).getStatus()
    expect(status.code).toBe("GOOGLE_TEMPORARILY_UNAVAILABLE")
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it("requires both GSC and GA4 permissions", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({ access_token: "secret", scope: "https://www.googleapis.com/auth/analytics.readonly" }))
    expect(await createSeoGoogleConnection({ env, fetchImpl }).getStatus()).toMatchObject({ connected: false, code: "SEO_RECONNECT_REQUIRED" })
  })
})
