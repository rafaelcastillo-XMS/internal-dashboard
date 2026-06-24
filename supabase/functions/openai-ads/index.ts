import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ADS_BASE = "https://api.ads.openai.com/v1"
const MICROS = 1_000_000

// Read the per-client OpenAI Ads token using the service role (bypasses the
// write-only column privileges that block the browser from reading it).
async function getClientToken(clientId: string): Promise<string | null> {
  const base = Deno.env.get("SUPABASE_URL")!
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const res = await fetch(
    `${base}/rest/v1/client_ad_secrets?client_id=eq.${encodeURIComponent(clientId)}&provider=eq.openai_ads&select=token`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
  if (!res.ok) throw new Error(`secret lookup failed: ${res.status}`)
  const rows = await res.json()
  return rows?.[0]?.token ?? null
}

async function adsGet(path: string, token: string, params?: URLSearchParams) {
  const url = params ? `${ADS_BASE}${path}?${params}` : `${ADS_BASE}${path}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OpenAI Ads ${path} ${res.status}: ${t}`)
  }
  return await res.json()
}

function num(v: unknown): number {
  const n = parseFloat(String(v ?? 0))
  return isNaN(n) ? 0 : n
}

async function fetchCampaigns(clientId: string, startTime?: string, endTime?: string) {
  const token = await getClientToken(clientId)
  if (!token) throw new Error("No OpenAI Ads token configured for this client")

  // Campaigns: budget + status (no metrics on this endpoint)
  const campRes = await adsGet("/campaigns", token, new URLSearchParams({ limit: "100" }))
  // deno-lint-ignore no-explicit-any
  const rawCampaigns: any[] = campRes.data ?? campRes.campaigns ?? []

  // Insights: spend / impressions / clicks / cpc. Defensive — a failure here
  // still returns campaigns with budget and zeroed metrics plus an error note.
  const metrics: Record<string, { spend: number; impressions: number; clicks: number; cpc: number }> = {}
  let insightsError: string | null = null
  try {
    const p = new URLSearchParams({ aggregation_level: "campaign", time_granularity: "none" })
    for (const f of ["impressions", "clicks", "spend", "cpc"]) p.append("fields[]", f)
    if (startTime && endTime) {
      p.append("time_ranges[]", JSON.stringify({ start_time: Number(startTime), end_time: Number(endTime) }))
    }
    const insRes = await adsGet("/ad_account/insights", token, p)
    // deno-lint-ignore no-explicit-any
    const rows: any[] = insRes.data ?? insRes.insights ?? []
    for (const r of rows) {
      const cid = r.campaign_id ?? r.campaign?.id ?? r.id
      const m = r.metrics ?? r
      if (cid) {
        metrics[cid] = {
          spend: num(m.spend),
          impressions: num(m.impressions),
          clicks: num(m.clicks),
          cpc: num(m.cpc),
        }
      }
    }
  } catch (e) {
    insightsError = e instanceof Error ? e.message : String(e)
  }

  const campaigns = rawCampaigns.map((c) => {
    const m = metrics[c.id] ?? { spend: 0, impressions: 0, clicks: 0, cpc: 0 }
    return {
      id: c.id,
      name: c.name ?? c.id,
      status: c.status ?? "unknown",
      budget: num(c.budget?.lifetime_spend_limit_micros) / MICROS,
      spend: m.spend,
      impressions: m.impressions,
      clicks: m.clicks,
      cpc: m.cpc,
    }
  })

  return { campaigns, insightsError }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const url = new URL(req.url)
  const segment = url.pathname.split("/").pop()

  try {
    if (segment === "campaigns") {
      const clientId = url.searchParams.get("clientId") ?? ""
      if (!clientId) throw new Error("Missing clientId")
      const result = await fetchCampaigns(
        clientId,
        url.searchParams.get("startTime") ?? undefined,
        url.searchParams.get("endTime") ?? undefined,
      )
      return new Response(JSON.stringify(result), { headers: { ...CORS, "Content-Type": "application/json" } })
    }

    return new Response(JSON.stringify({ error: `Unknown endpoint: ${segment}` }), {
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
