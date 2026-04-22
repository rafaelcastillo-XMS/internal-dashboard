import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

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

// ── Helpers ─────────────────────────────────────────────────────────────────

function dateDelta(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function periodDays(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

// ── /properties ─────────────────────────────────────────────────────────────

async function fetchProperties(token: string) {
  const auth = `Bearer ${token}`

  const [gscRes, ga4Res] = await Promise.all([
    fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: auth },
    }),
    fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", {
      headers: { Authorization: auth },
    }),
  ])

  const gscData = await gscRes.json()
  const ga4Data = await ga4Res.json()

  const gscSites = (gscData.siteEntry ?? []).map((s: Record<string, string>) => ({
    url: s.siteUrl,
    permissionLevel: s.permissionLevel ?? "unknown",
  }))

  const ga4Properties: { id: string; name: string; account: string }[] = []
  for (const acc of ga4Data.accountSummaries ?? []) {
    for (const prop of acc.propertySummaries ?? []) {
      ga4Properties.push({
        id: prop.property.replace("properties/", ""),
        name: prop.displayName,
        account: acc.displayName,
      })
    }
  }

  return { gscSites, ga4Properties }
}

// ── /gsc ────────────────────────────────────────────────────────────────────

async function fetchGSC(token: string, params: URLSearchParams) {
  const siteUrl = params.get("siteUrl") ?? ""
  const startDate = params.get("startDate") ?? ""
  const endDate = params.get("endDate") ?? ""

  if (!siteUrl || !startDate || !endDate) throw new Error("Missing required params: siteUrl, startDate, endDate")

  const auth = `Bearer ${token}`
  const days = periodDays(startDate, endDate)
  const prevEnd = dateDelta(startDate, -1)
  const prevStart = dateDelta(prevEnd, -(days - 1))

  const base = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`

  const [tsRes, tsPrevRes, qRes] = await Promise.all([
    fetch(base, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions: ["date"], rowLimit: 500, dataState: "final" }),
    }),
    fetch(base, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: prevStart, endDate: prevEnd, dimensions: ["date"], rowLimit: 500, dataState: "final" }),
    }),
    fetch(base, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions: ["query"], rowLimit: 50, dataState: "final" }),
    }),
  ])

  const [tsData, tsPrevData, qData] = await Promise.all([tsRes.json(), tsPrevRes.json(), qRes.json()])

  // deno-lint-ignore no-explicit-any
  const tsRows: any[] = (tsData.rows ?? []).sort((a: any, b: any) => a.keys[0].localeCompare(b.keys[0]))
  // deno-lint-ignore no-explicit-any
  const tsPrevRows: any[] = (tsPrevData.rows ?? []).sort((a: any, b: any) => a.keys[0].localeCompare(b.keys[0]))
  // deno-lint-ignore no-explicit-any
  const qRows: any[] = (qData.rows ?? []).sort((a: any, b: any) => b.clicks - a.clicks)

  const clicksTs = tsRows.map((r) => Math.round(r.clicks))
  const impressionsTs = tsRows.map((r) => Math.round(r.impressions))
  const dateLabels = tsRows.map((r) => r.keys[0])

  const totalClicks = clicksTs.reduce((s, v) => s + v, 0)
  const totalImpressions = impressionsTs.reduce((s, v) => s + v, 0)
  const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0

  const totalImp = tsRows.reduce((s, r) => s + r.impressions, 0)
  const avgPosition = totalImp > 0
    ? tsRows.reduce((s, r) => s + r.position * r.impressions, 0) / totalImp
    : 0

  const prevClicks = tsPrevRows.reduce((s, r) => s + Math.round(r.clicks), 0)
  const prevImpressions = tsPrevRows.reduce((s, r) => s + Math.round(r.impressions), 0)
  const prevImp = tsPrevRows.reduce((s, r) => s + r.impressions, 0)
  const prevPosition = prevImp > 0
    ? tsPrevRows.reduce((s, r) => s + r.position * r.impressions, 0) / prevImp
    : 0
  const prevCTR = prevImpressions > 0 ? prevClicks / prevImpressions : 0

  return {
    totalClicks,
    totalImpressions,
    avgCTR: Math.round(avgCTR * 1e6) / 1e6,
    avgPosition: Math.round(avgPosition * 10) / 10,
    clicksDelta: pctChange(totalClicks, prevClicks),
    ctrDelta: pctChange(avgCTR, prevCTR),
    positionDelta: pctChange(avgPosition, prevPosition),
    clicksSparkline: clicksTs.slice(-7),
    impressionsSparkline: impressionsTs.slice(-7),
    clicksTimeSeries: clicksTs,
    impressionsTimeSeries: impressionsTs,
    dateLabels,
    queries: qRows.map((r) => ({
      query: r.keys[0],
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      ctr: Math.round(r.ctr * 1e4) / 1e4,
      position: Math.round(r.position * 10) / 10,
    })),
  }
}

// ── /ga4 ─────────────────────────────────────────────────────────────────────

async function fetchGA4(token: string, params: URLSearchParams) {
  const propertyId = params.get("propertyId") ?? ""
  const startDate = params.get("startDate") ?? ""
  const endDate = params.get("endDate") ?? ""

  if (!propertyId || !startDate || !endDate) throw new Error("Missing required params: propertyId, startDate, endDate")

  const auth = `Bearer ${token}`
  const prop = `properties/${propertyId}`
  const days = periodDays(startDate, endDate)
  const prevEnd = dateDelta(startDate, -1)
  const prevStart = dateDelta(prevEnd, -(days - 1))
  const sparkStart = dateDelta(endDate, -6)

  const base = `https://analyticsdata.googleapis.com/v1beta/${prop}:runReport`

  const [aggRes, sparkRes, pagesRes, acqRes] = await Promise.all([
    fetch(base, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [
          { startDate, endDate },
          { startDate: prevStart, endDate: prevEnd },
        ],
        metrics: [
          { name: "sessions" },
          { name: "engagedSessions" },
          { name: "conversions" },
        ],
      }),
    }),
    fetch(base, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: sparkStart, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "sessions" },
          { name: "engagedSessions" },
          { name: "conversions" },
        ],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
    }),
    fetch(base, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "engagedSessions" },
          { name: "averageSessionDuration" },
          { name: "eventCount" },
          { name: "engagementRate" },
        ],
        orderBys: [{ metric: { metricName: "engagedSessions" }, desc: true }],
        limit: 10,
      }),
    }),
    fetch(base, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [
          { name: "sessions" },
          { name: "conversions" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 25,
      }),
    }),
  ])

  const [aggData, sparkData, pagesData, acqData] = await Promise.all([
    aggRes.json(), sparkRes.json(), pagesRes.json(), acqRes.json(),
  ])

  // deno-lint-ignore no-explicit-any
  const mv = (row: any, idx: number) => parseFloat(row?.metricValues?.[idx]?.value ?? "0")

  // Aggregate: GA4 returns rows ordered by dateRange when multiple ranges given and no dateRange dimension
  // Row 0 = first range, row 1 = second range
  const curRow = aggData.rows?.[0]
  const prvRow = aggData.rows?.[1]

  const curSessions = Math.round(mv(curRow, 0))
  const curEngaged = Math.round(mv(curRow, 1))
  const curConversions = Math.round(mv(curRow, 2))
  const prvSessions = Math.round(mv(prvRow, 0))
  const prvEngaged = Math.round(mv(prvRow, 1))
  const prvConversions = Math.round(mv(prvRow, 2))

  const curConvRate = curSessions > 0 ? Math.round((curConversions / curSessions) * 10000) / 100 : 0
  const prvConvRate = prvSessions > 0 ? Math.round((prvConversions / prvSessions) * 10000) / 100 : 0

  // deno-lint-ignore no-explicit-any
  const sparkRows: any[] = (sparkData.rows ?? []).sort((a: any, b: any) =>
    a.dimensionValues[0].value.localeCompare(b.dimensionValues[0].value)
  )
  const engagedSessionsSparkline = sparkRows.map((r) => Math.round(mv(r, 1)))
  const conversionSparkline = sparkRows.map((r) => {
    const sess = mv(r, 0); const conv = mv(r, 2)
    return sess > 0 ? Math.round((conv / sess) * 10000) / 100 : 0
  })

  // deno-lint-ignore no-explicit-any
  const topPages = (pagesData.rows ?? []).map((r: any) => ({
    page: r.dimensionValues[0].value,
    engagedSessions: Math.round(mv(r, 0)),
    avgEngageTime: Math.round(mv(r, 1) * 10) / 10,
    eventCount: Math.round(mv(r, 2)),
    engageRate: Math.round(mv(r, 3) * 1e4) / 1e4,
    sparkline: [],
  }))

  // deno-lint-ignore no-explicit-any
  const acquisitionSources = (acqData.rows ?? []).map((r: any) => {
    const sessions = Math.round(mv(r, 0))
    const conversions = Math.round(mv(r, 1))
    return {
      source: r.dimensionValues[0].value,
      medium: r.dimensionValues[1].value,
      sessions,
      conversions,
      convRate: sessions > 0 ? Math.round((conversions / sessions) * 1e4) / 1e4 : 0,
    }
  })

  return {
    engagedSessions: curEngaged,
    conversionRate: curConvRate,
    engagedSessionsDelta: pctChange(curEngaged, prvEngaged),
    conversionRateDelta: pctChange(curConvRate, prvConvRate),
    engagedSessionsSparkline,
    conversionSparkline,
    topPages,
    acquisitionSources,
  }
}

// ── /psi ─────────────────────────────────────────────────────────────────────

async function fetchPSI(params: URLSearchParams) {
  const url = params.get("url") ?? ""
  if (!url) throw new Error("Missing required param: url")

  const apiKey = Deno.env.get("PSI_API_KEY") ?? ""
  const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${new URLSearchParams({
    url,
    strategy: "mobile",
    key: apiKey,
  })}`

  const res = await fetch(psiUrl)
  const data = await res.json()

  // deno-lint-ignore no-explicit-any
  function parseMetric(key: string): number | null {
    for (const field of ["loadingExperience", "originLoadingExperience"]) {
      const v = (data as any)?.[field]?.metrics?.[key]?.percentile
      if (v != null) return v
    }
    return null
  }

  // deno-lint-ignore no-explicit-any
  function parseMobileVerdict(): { verdict: string | null; issues: string[] } {
    try {
      const result = (data as any).lighthouseResult
      const score: number = result.categories.performance.score
      const verdict = score >= 0.9 ? "PASS" : score >= 0.5 ? "PARTIAL" : "FAIL"
      const audits = result.audits ?? {}
      const issues = Object.values(audits)
        // deno-lint-ignore no-explicit-any
        .filter((v: any) => v.score != null && v.score < 0.9 && v.details?.type !== "opportunity")
        // deno-lint-ignore no-explicit-any
        .slice(0, 5).map((v: any) => v.title)
      return { verdict, issues }
    } catch {
      return { verdict: null, issues: [] }
    }
  }

  const lcpRaw = parseMetric("LARGEST_CONTENTFUL_PAINT_MS")
  const inpRaw = parseMetric("INTERACTION_TO_NEXT_PAINT")
  const clsRaw = parseMetric("CUMULATIVE_LAYOUT_SHIFT_SCORE")
  const fidRaw = parseMetric("FIRST_INPUT_DELAY_MS")

  return {
    metrics: {
      lcp: lcpRaw != null ? Math.round(lcpRaw / 10) / 100 : null,
      inp: inpRaw,
      cls: clsRaw != null ? Math.round(clsRaw / 100 * 1000) / 1000 : null,
      fid: fidRaw,
    },
    mobile: parseMobileVerdict(),
    auditedUrl: url,
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const url = new URL(req.url)
  const segment = url.pathname.split("/").pop() // 'properties', 'gsc', 'ga4', 'psi'

  try {
    let result
    if (segment === "properties") {
      const token = await getAccessToken()
      result = await fetchProperties(token)
    } else if (segment === "gsc") {
      const token = await getAccessToken()
      result = await fetchGSC(token, url.searchParams)
    } else if (segment === "ga4") {
      const token = await getAccessToken()
      result = await fetchGA4(token, url.searchParams)
    } else if (segment === "psi") {
      result = await fetchPSI(url.searchParams)
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
