import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MICROS = 1_000_000
const ADS_VERSION = "v17"

// ── Google OAuth ────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: Deno.env.get("GOOGLE_REFRESH_TOKEN")!,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`)
  return data.access_token
}

// ── Google Ads REST helpers ──────────────────────────────────────────────────

function adsHeaders(token: string) {
  const mccId = (Deno.env.get("ADS_MCC_ID") ?? "").replace(/-/g, "")
  return {
    Authorization: `Bearer ${token}`,
    "developer-token": Deno.env.get("ADS_DEVELOPER_TOKEN") ?? "",
    "login-customer-id": mccId,
    "Content-Type": "application/json",
  }
}

async function adsSearch(token: string, customerId: string, query: string) {
  const mccId = (Deno.env.get("ADS_MCC_ID") ?? "").replace(/-/g, "")
  const url = `https://googleads.googleapis.com/${ADS_VERSION}/customers/${customerId}/googleAds:search`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "developer-token": Deno.env.get("ADS_DEVELOPER_TOKEN") ?? "",
      "login-customer-id": mccId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Ads API error ${res.status}: ${err}`)
  }
  return await res.json()
}

function safeFloat(v: unknown, divisor = 1): number {
  const n = parseFloat(String(v ?? 0))
  if (isNaN(n) || divisor === 0) return 0
  return Math.round((n / divisor) * 100) / 100
}

// ── /accounts ────────────────────────────────────────────────────────────────

async function fetchAccounts(token: string) {
  const mccId = (Deno.env.get("ADS_MCC_ID") ?? "").replace(/-/g, "")
  if (!mccId) throw new Error("ADS_MCC_ID not configured")

  const query = `
    SELECT
      customer_client.client_customer,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.status,
      customer_client.level,
      customer_client.manager
    FROM customer_client
    WHERE customer_client.level = 1
      AND customer_client.manager = false
  `

  const data = await adsSearch(token, mccId, query)

  // deno-lint-ignore no-explicit-any
  const accounts = (data.results ?? []).map((row: any) => {
    const cc = row.customerClient
    const cid = (cc.clientCustomer ?? "").replace("customers/", "")
    return {
      id: cid,
      name: cc.descriptiveName || `Account ${cid}`,
      currency: cc.currencyCode ?? "",
      timezone: cc.timeZone ?? "",
      status: cc.status ?? "UNKNOWN",
    }
  })

  accounts.sort((a: { name: string }, b: { name: string }) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))

  return { accounts }
}

// ── /performance ─────────────────────────────────────────────────────────────

async function fetchPerformance(token: string, params: URLSearchParams) {
  const accountId = (params.get("accountId") ?? "").replace(/-/g, "")
  const startDate = params.get("startDate") ?? ""
  const endDate = params.get("endDate") ?? ""

  if (!accountId || !startDate || !endDate) throw new Error("Missing required params: accountId, startDate, endDate")

  const campaignQuery = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions,
      metrics.cost_per_conversion
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 100
  `

  const keywordQuery = `
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.quality_info.quality_score,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions
    FROM keyword_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND ad_group_criterion.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 100
  `

  const [campaignData, keywordData] = await Promise.all([
    adsSearch(token, accountId, campaignQuery).catch(() => ({ results: [] })),
    adsSearch(token, accountId, keywordQuery).catch(() => ({ results: [] })),
  ])

  // deno-lint-ignore no-explicit-any
  const campaigns = (campaignData.results ?? []).map((row: any) => {
    const c = row.campaign
    const m = row.metrics
    return {
      id: String(c.id ?? ""),
      name: c.name ?? "",
      status: c.status ?? "UNKNOWN",
      impressions: Math.round(Number(m.impressions ?? 0)),
      clicks: Math.round(Number(m.clicks ?? 0)),
      cost: safeFloat(m.costMicros, MICROS),
      ctr: safeFloat(Number(m.ctr ?? 0) * 100),
      avg_cpc: safeFloat(m.averageCpc, MICROS),
      conversions: safeFloat(m.conversions),
      cost_per_conversion: safeFloat(m.costPerConversion, MICROS),
    }
  })

  // deno-lint-ignore no-explicit-any
  const keywords = (keywordData.results ?? []).map((row: any) => {
    const kw = row.adGroupCriterion
    const m = row.metrics
    const qs = kw?.qualityInfo?.qualityScore
    return {
      text: kw?.keyword?.text ?? "",
      match_type: kw?.keyword?.matchType ?? "UNKNOWN",
      quality_score: qs != null ? Math.round(Number(qs)) : null,
      impressions: Math.round(Number(m.impressions ?? 0)),
      clicks: Math.round(Number(m.clicks ?? 0)),
      cost: safeFloat(m.costMicros, MICROS),
      ctr: safeFloat(Number(m.ctr ?? 0) * 100),
      avg_cpc: safeFloat(m.averageCpc, MICROS),
      conversions: safeFloat(m.conversions),
    }
  })

  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0)
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0)
  const totalCost = Math.round(campaigns.reduce((s, c) => s + c.cost, 0) * 100) / 100
  const totalConversions = Math.round(campaigns.reduce((s, c) => s + c.conversions, 0) * 10) / 10
  const ctr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0
  const avgCpc = totalClicks > 0 ? Math.round((totalCost / totalClicks) * 100) / 100 : 0
  const costPerConv = totalConversions > 0 ? Math.round((totalCost / totalConversions) * 100) / 100 : 0

  return {
    summary: {
      impressions: totalImpressions,
      clicks: totalClicks,
      cost: totalCost,
      ctr,
      avg_cpc: avgCpc,
      conversions: totalConversions,
      cost_per_conversion: costPerConv,
    },
    campaigns,
    keywords,
    dateRange: { start: startDate, end: endDate },
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const url = new URL(req.url)
  const segment = url.pathname.split("/").pop() // 'accounts', 'performance'

  try {
    const token = await getAccessToken()
    let result

    if (segment === "accounts") {
      result = await fetchAccounts(token)
    } else if (segment === "performance") {
      result = await fetchPerformance(token, url.searchParams)
    } else {
      return new Response(JSON.stringify({ error: `Unknown endpoint: ${segment}` }), {
        status: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify(result), {
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
