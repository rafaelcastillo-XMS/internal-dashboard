const ADS_BASE = "https://api.ads.openai.com/v1"
const MICROS = 1_000_000

// OpenAI returns flat metric columns, with campaign_id only when requested.
export async function fetchAdsReport(token: string, range: {
  startDate?: string; endDate?: string; startTime?: string; endTime?: string
}, request: typeof fetch = fetch, now = new Date()) {
  async function get(path: string, params?: URLSearchParams) {
    const res = await request(`${ADS_BASE}${path}${params ? `?${params}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`OpenAI Ads ${path} ${res.status}: ${await res.text()}`)
    return res.json()
  }
  async function list(path: string, params: URLSearchParams) {
    const rows = []
    const cursors = new Set<string>()
    for (;;) {
      const page = await get(path, params)
      if (!Array.isArray(page.data)) throw new Error(`Invalid OpenAI Ads response for ${path}`)
      rows.push(...page.data)
      if (!page.has_more) return rows
      const cursor = page.last_id ?? page.data.at(-1)?.id
      if (!cursor || cursors.has(cursor)) throw new Error(`Invalid pagination for ${path}`)
      cursors.add(cursor)
      params.set("after", cursor)
    }
  }
  const rawCampaigns = await list("/campaigns", new URLSearchParams({ limit: "100" }))
  const metrics = new Map<string, { spend: number; impressions: number; clicks: number; cpc: number }>()
  let insightsError: string | null = null
  try {
    const p = new URLSearchParams({ aggregation_level: "campaign", time_granularity: "none", limit: "100" })
    for (const f of ["campaign.id", "campaign.impressions", "campaign.clicks", "campaign.spend", "campaign.cpc"]) p.append("fields[]", f)
    if (range.startDate && range.endDate) {
      const account = await get("/ad_account")
      const timezone = account.timezone || "America/New_York"
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
      const until = range.endDate > today ? today : range.endDate
      if (range.startDate > until) throw new Error("The reporting period is in the future")
      p.append("time_ranges[]", JSON.stringify({ type: "date_range", since: range.startDate, until, timezone }))
    } else if (range.startTime && range.endTime) {
      const start = Number(range.startTime)
      const end = Math.min(Number(range.endTime) + 1, Math.floor(now.getTime() / 1000))
      if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error("Invalid reporting period")
      p.append("time_ranges[]", JSON.stringify({ type: "unix_range", start: String(start), end: String(end) }))
    }
    const rows = await list("/ad_account/insights", p)
    for (const row of rows) {
      if (!row.campaign_id) throw new Error("OpenAI Ads insights are missing campaign_id")
      metrics.set(row.campaign_id, {
        spend: num(row.spend), impressions: num(row.impressions), clicks: num(row.clicks), cpc: num(row.cpc),
      })
    }
  } catch (e) {
    insightsError = e instanceof Error ? e.message : String(e)
  }
  const campaigns = rawCampaigns.map(c => {
    const daily = c.budget?.daily_spend_limit_micros
    return {
      id: c.id, name: c.name ?? c.id, status: c.status ?? "unknown",
      budget: num(daily ?? c.budget?.lifetime_spend_limit_micros) / MICROS,
      budgetPeriod: daily != null ? "daily" : "lifetime",
      ...(metrics.get(c.id) ?? { spend: 0, impressions: 0, clicks: 0, cpc: 0 }),
    }
  })
  return { campaigns, insightsError }
}
function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}
