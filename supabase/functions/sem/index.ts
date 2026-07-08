import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MICROS = 1_000_000
const ADS_VERSION = "v24"

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

// ── /breakdowns ──────────────────────────────────────────────────────────────

function mapBreakdownRow(row: any, key: string | number, label?: string) {
  const m = row.metrics ?? {}
  return {
    key,
    label,
    impressions: Math.round(Number(m.impressions ?? 0)),
    clicks: Math.round(Number(m.clicks ?? 0)),
    cost: safeFloat(m.costMicros, MICROS),
    conversions: safeFloat(m.conversions),
  }
}

function aggregateBreakdownRows(rows: Array<{
  key: string | number
  label?: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
}>) {
  const grouped = new Map<string, {
    key: string | number
    label?: string
    impressions: number
    clicks: number
    cost: number
    conversions: number
  }>()

  rows.forEach((row) => {
    const mapKey = String(row.key)
    const current = grouped.get(mapKey) ?? {
      key: row.key,
      label: row.label,
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
    }
    current.impressions += row.impressions
    current.clicks += row.clicks
    current.cost = Math.round((current.cost + row.cost) * 100) / 100
    current.conversions = Math.round((current.conversions + row.conversions) * 100) / 100
    grouped.set(mapKey, current)
  })

  return Array.from(grouped.values())
}

async function fetchBreakdowns(token: string, params: URLSearchParams) {
  const accountId = (params.get("accountId") ?? "").replace(/-/g, "")
  const startDate = params.get("startDate") ?? ""
  const endDate = params.get("endDate") ?? ""

  if (!accountId || !startDate || !endDate) throw new Error("Missing required params: accountId, startDate, endDate")

  const baseWhere = `
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
  `

  const deviceQuery = `
    SELECT
      segments.device,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    ${baseWhere}
  `

  const dayQuery = `
    SELECT
      segments.day_of_week,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    ${baseWhere}
  `

  const hourQuery = `
    SELECT
      segments.hour,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    ${baseWhere}
  `

  const [deviceData, dayData, hourData] = await Promise.all([
    adsSearch(token, accountId, deviceQuery).catch(() => ({ results: [] })),
    adsSearch(token, accountId, dayQuery).catch(() => ({ results: [] })),
    adsSearch(token, accountId, hourQuery).catch(() => ({ results: [] })),
  ])

  // deno-lint-ignore no-explicit-any
  const devices = aggregateBreakdownRows((deviceData.results ?? []).map((row: any) => mapBreakdownRow(row, row.segments?.device ?? "UNKNOWN")))
  // deno-lint-ignore no-explicit-any
  const days = aggregateBreakdownRows((dayData.results ?? []).map((row: any) => mapBreakdownRow(row, row.segments?.dayOfWeek ?? "UNKNOWN")))
  // deno-lint-ignore no-explicit-any
  const hours = aggregateBreakdownRows((hourData.results ?? []).map((row: any) => mapBreakdownRow(row, Number(row.segments?.hour ?? 0))))

  return { devices, days, hours, dateRange: { start: startDate, end: endDate } }
}

// ── /search-terms ─────────────────────────────────────────────────────────────

async function fetchSearchTerms(token: string, params: URLSearchParams) {
  const accountId = (params.get("accountId") ?? "").replace(/-/g, "")
  const startDate = params.get("startDate") ?? ""
  const endDate   = params.get("endDate")   ?? ""

  if (!accountId || !startDate || !endDate) throw new Error("Missing required params: accountId, startDate, endDate")

  const query = `
    SELECT
      search_term_view.search_term,
      campaign.name,
      ad_group.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions
    FROM search_term_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 100
  `

  const data = await adsSearch(token, accountId, query)

  // deno-lint-ignore no-explicit-any
  const searchTerms = (data.results ?? []).map((row: any) => ({
    search_term:   row.searchTermView?.searchTerm ?? "",
    campaign_name: row.campaign?.name ?? "",
    ad_group_name: row.adGroup?.name ?? "",
    impressions:   Math.round(Number(row.metrics?.impressions ?? 0)),
    clicks:        Math.round(Number(row.metrics?.clicks ?? 0)),
    cost:          safeFloat(row.metrics?.costMicros, MICROS),
    ctr:           safeFloat(Number(row.metrics?.ctr ?? 0) * 100),
    avg_cpc:       safeFloat(row.metrics?.averageCpc, MICROS),
    conversions:   safeFloat(row.metrics?.conversions),
  }))

  return { searchTerms, dateRange: { start: startDate, end: endDate } }
}

// ── /sync ──────────────────────────────────────────────────────────────────────
// Reconciles the sem_accounts table against the live Google Ads MCC roster.
// Live accounts are upserted; accounts no longer returned by the MCC are
// soft-deleted (status = 'REMOVED') so history rows and selections are preserved.

async function syncAccounts(token: string) {
  const { accounts } = await fetchAccounts(token)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const now = new Date().toISOString()
  const rows = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    timezone: a.timezone,
    status: a.status,
    synced_at: now,
  }))

  if (rows.length > 0) {
    const { error } = await supabase.from("sem_accounts").upsert(rows, { onConflict: "id" })
    if (error) throw new Error(`Upsert failed: ${error.message}`)
  }

  // Soft-delete accounts present in the table but absent from the live MCC.
  // Guard: never reconcile against an empty roster (would wipe every account).
  const liveIds = accounts.map((a) => a.id)
  if (liveIds.length === 0) return { synced: 0, removed: 0, removedIds: [], syncedAt: now }

  const { data: stale, error: selErr } = await supabase
    .from("sem_accounts")
    .select("id")
    .not("id", "in", `(${liveIds.map((id) => `"${id}"`).join(",")})`)
    .neq("status", "REMOVED")
  if (selErr) throw new Error(`Select stale failed: ${selErr.message}`)

  const removedIds = (stale ?? []).map((r: { id: string }) => r.id)
  if (removedIds.length > 0) {
    const { error } = await supabase
      .from("sem_accounts")
      .update({ status: "REMOVED", synced_at: now })
      .in("id", removedIds)
    if (error) throw new Error(`Soft-delete failed: ${error.message}`)
  }

  return { synced: rows.length, removed: removedIds.length, removedIds, syncedAt: now }
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const url = new URL(req.url)
  const segment = url.pathname.split("/").pop() // 'accounts', 'performance', 'breakdowns', 'search-terms'

  try {
    const token = await getAccessToken()
    let result

    if (segment === "accounts") {
      result = await fetchAccounts(token)
    } else if (segment === "sync") {
      result = await syncAccounts(token)
    } else if (segment === "performance") {
      result = await fetchPerformance(token, url.searchParams)
    } else if (segment === "breakdowns") {
      result = await fetchBreakdowns(token, url.searchParams)
    } else if (segment === "search-terms") {
      result = await fetchSearchTerms(token, url.searchParams)
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
