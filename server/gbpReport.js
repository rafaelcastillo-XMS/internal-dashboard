/**
 * server/gbpReport.js
 * Google Business Profile report data for the SEO dashboard GBP page.
 * Ported from Steven's "Google Business Profile Manager" backend (gbpApi.js):
 * same GBP endpoints (Account Management v1, Business Information v1,
 * Business Profile Performance v1, My Business v4 localPosts), adapted to
 * this dashboard's token.json OAuth credentials and GBPData response shape.
 *
 * Requires the Google token to include the business.manage scope —
 * reconnect Google from the dashboard after adding the scope.
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Prefer the dedicated GBP token (the gmail account that owns the Business
// Profiles, connected via /api/auth/gbp/start); fall back to the main token.
const GBP_TOKEN_PATH = path.resolve(__dirname, "..", "token-gbp.json")
const MAIN_TOKEN_PATH = path.resolve(__dirname, "..", "token.json")

const GBP_ACCOUNT_BASE = "https://mybusinessaccountmanagement.googleapis.com/v1"
const GBP_INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1"
const GBP_PERF_BASE = "https://businessprofileperformance.googleapis.com/v1"
const GBP_V4_BASE = "https://mybusiness.googleapis.com/v4"

// ─── OAuth ────────────────────────────────────────────────────────────────────

const cachedAccess = {} // per token file: { token, expiresAt }

async function refreshFromFile(tokenPath) {
  const cached = cachedAccess[tokenPath]
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token

  const stored = JSON.parse(fs.readFileSync(tokenPath, "utf-8"))
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: stored.refresh_token,
      client_id: stored.client_id,
      client_secret: stored.client_secret,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Google token refresh failed: ${JSON.stringify(data)}`)
  cachedAccess[tokenPath] = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 }
  return cachedAccess[tokenPath].token
}

// GBP calls: dedicated token if connected, else main token
function hasGbpToken() {
  try {
    return !!JSON.parse(fs.readFileSync(GBP_TOKEN_PATH, "utf-8")).refresh_token
  } catch {
    return false
  }
}

async function getGbpAccessToken() {
  return refreshFromFile(hasGbpToken() ? GBP_TOKEN_PATH : MAIN_TOKEN_PATH)
}

// GA4 / GSC calls: always the main (eva@) token
async function getAccessToken() {
  return refreshFromFile(MAIN_TOKEN_PATH)
}

async function gFetch(url) {
  const token = await getGbpAccessToken()
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json()
  if (!res.ok) {
    const msg = data?.error?.message ?? `HTTP ${res.status}`
    const err = new Error(`GBP API error (${res.status}): ${msg}`)
    err.status = res.status
    throw err
  }
  return data
}

// ─── Location discovery (cached — account listing is slow) ───────────────────

let locationsCache = null // { at, locations }
const LOCATIONS_TTL_MS = 10 * 60 * 1000

export async function listGbpLocations() {
  if (locationsCache && Date.now() - locationsCache.at < LOCATIONS_TTL_MS) return locationsCache.locations

  const accountsData = await gFetch(`${GBP_ACCOUNT_BASE}/accounts`)
  const accounts = accountsData.accounts ?? []

  const all = []
  for (const account of accounts) {
    let pageToken = null
    do {
      const params = new URLSearchParams({ readMask: "name,title,websiteUri" })
      if (pageToken) params.set("pageToken", pageToken)
      const data = await gFetch(`${GBP_INFO_BASE}/${account.name}/locations?${params}`)
      for (const loc of data.locations ?? []) {
        all.push({
          accountName: account.name,
          locationName: loc.name,
          title: loc.title ?? "",
          websiteUri: loc.websiteUri ?? "",
        })
      }
      pageToken = data.nextPageToken ?? null
    } while (pageToken)
  }

  locationsCache = { at: Date.now(), locations: all }
  return all
}

async function findLocationById(accountName, locationName) {
  if (!locationName) return null
  const locations = await listGbpLocations()
  const match = locations.find((location) =>
    location.locationName === locationName &&
    (!accountName || location.accountName === accountName)
  )
  if (!match) throw new Error(`GBP location ${locationName} is not available to the connected account`)
  return match
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtK(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}K`
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`
  return String(Math.round(n))
}

function monthLabel(d) {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
}

function dayLabel(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

function pctDelta(cur, prev) {
  if (!prev) return 0
  return Math.round(((cur - prev) / prev) * 1000) / 10
}

function monthsInRange(startDate, endDate) {
  const months = []
  const d = new Date(Date.UTC(new Date(startDate).getUTCFullYear(), new Date(startDate).getUTCMonth(), 1))
  const end = new Date(endDate)
  while (d <= end) {
    months.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, label: monthLabel(d) })
    d.setUTCMonth(d.getUTCMonth() + 1)
  }
  return months
}

// ─── GBP performance ─────────────────────────────────────────────────────────

const INTERACTION_METRICS = ["CALL_CLICKS", "BUSINESS_DIRECTION_REQUESTS", "WEBSITE_CLICKS", "BUSINESS_BOOKINGS"]
const IMPRESSION_METRICS = [
  { metric: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH", label: "Google Search – mobile", color: "#4285F4" },
  { metric: "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", label: "Google Search – desktop", color: "#FBBC05" },
  { metric: "BUSINESS_IMPRESSIONS_MOBILE_MAPS", label: "Google Maps – mobile", color: "#EA4335" },
  { metric: "BUSINESS_IMPRESSIONS_DESKTOP_MAPS", label: "Google Maps – desktop", color: "#34A853" },
]

async function fetchDailyMetric(locationPath, metric, startDate, endDate) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const params = new URLSearchParams({
    dailyMetric: metric,
    "dailyRange.startDate.year": start.getUTCFullYear(),
    "dailyRange.startDate.month": start.getUTCMonth() + 1,
    "dailyRange.startDate.day": start.getUTCDate(),
    "dailyRange.endDate.year": end.getUTCFullYear(),
    "dailyRange.endDate.month": end.getUTCMonth() + 1,
    "dailyRange.endDate.day": end.getUTCDate(),
  })
  try {
    const raw = await gFetch(`${GBP_PERF_BASE}/${locationPath}:getDailyMetricsTimeSeries?${params}`)
    return (raw.timeSeries?.datedValues ?? []).map((dv) => ({
      date: `${dv.date.year}-${String(dv.date.month).padStart(2, "0")}-${String(dv.date.day).padStart(2, "0")}`,
      value: parseInt(dv.value ?? "0", 10),
    }))
  } catch (err) {
    if (err.status === 403 || err.status === 401) throw err
    return [] // metric not enabled for this location (e.g. bookings)
  }
}

async function fetchGbpSections(location, startDate, endDate) {
  // Performance API wants bare "locations/{id}"
  const locId = location.locationName.split("/").pop()
  const locationPath = `locations/${locId}`

  const metricNames = [...INTERACTION_METRICS, ...IMPRESSION_METRICS.map((m) => m.metric)]
  const series = {}
  await Promise.all(
    metricNames.map(async (m) => { series[m] = await fetchDailyMetric(locationPath, m, startDate, endDate) })
  )

  // Interactions: monthly totals of calls + directions + website clicks + bookings
  const months = monthsInRange(startDate, endDate)
  const monthTotals = Object.fromEntries(months.map((m) => [m.key, 0]))
  let interactionsTotal = 0
  for (const metric of INTERACTION_METRICS) {
    for (const { date, value } of series[metric]) {
      const key = date.slice(0, 7)
      if (key in monthTotals) monthTotals[key] += value
      interactionsTotal += value
    }
  }

  // Profile views: totals per surface
  const breakdownRaw = IMPRESSION_METRICS.map(({ metric, label, color }) => ({
    label,
    color,
    value: series[metric].reduce((s, d) => s + d.value, 0),
  }))
  const viewsTotal = breakdownRaw.reduce((s, b) => s + b.value, 0)
  const breakdown = breakdownRaw
    .sort((a, b) => b.value - a.value)
    .map((b) => ({ ...b, pct: viewsTotal > 0 ? Math.round((b.value / viewsTotal) * 100) : 0 }))

  // Search keywords (monthly granularity API)
  let searches = { total: 0, keywords: [] }
  try {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const kwParams = new URLSearchParams({
      "monthlyRange.startMonth.year": start.getUTCFullYear(),
      "monthlyRange.startMonth.month": start.getUTCMonth() + 1,
      "monthlyRange.endMonth.year": end.getUTCFullYear(),
      "monthlyRange.endMonth.month": end.getUTCMonth() + 1,
      pageSize: 10,
    })
    const kwData = await gFetch(`${GBP_PERF_BASE}/${locationPath}/searchkeywords/impressions/monthly?${kwParams}`)
    const counts = kwData.searchKeywordsCounts ?? []
    searches = {
      total: counts.reduce((s, k) => s + (parseInt(k.insightsValue?.value ?? "0", 10) || 0), 0),
      keywords: counts.slice(0, 5).map((k) => ({
        term: k.searchKeyword,
        count: k.insightsValue?.value ?? `< ${k.insightsValue?.threshold ?? 15}`,
      })),
    }
  } catch (err) {
    if (err.status === 403 || err.status === 401) throw err
  }

  // Recent posts (v4 API needs the combined account/location path)
  const CTA_LABELS = {
    CALL: "Call now", LEARN_MORE: "Learn more", BOOK: "Book", ORDER: "Order online",
    SHOP: "Shop", SIGN_UP: "Sign up", GET_OFFER: "Get offer",
  }
  let posts = []
  try {
    const postsData = await gFetch(`${GBP_V4_BASE}/${location.accountName}/${location.locationName}/localPosts?pageSize=8`)
    posts = (postsData.localPosts ?? []).map((p) => {
      const summary = p.summary ?? ""
      const hashtags = (summary.match(/#[\w]+/g) ?? []).join(" ")
      return {
        date: new Date(p.createTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        content: summary.replace(/#[\w]+/g, "").replace(/[ \t]+\n/g, "\n").trim(),
        hashtags,
        cta: CTA_LABELS[p.callToAction?.actionType] ?? "",
      }
    }).slice(0, 4)
  } catch (err) {
    if (err.status === 403 || err.status === 401) throw err
  }

  return {
    interactions: { total: interactionsTotal, labels: months.map((m) => m.label), values: months.map((m) => monthTotals[m.key]) },
    profileViews: { total: viewsTotal, breakdown },
    searches,
    posts,
  }
}

// ─── GA4 sections ─────────────────────────────────────────────────────────────

async function ga4Report(propertyId, body) {
  const token = await getAccessToken()
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? `GA4 HTTP ${res.status}`)
  return data
}

function weeklyBuckets(dateRows, startDate, endDate, valueIdx = 0) {
  // dateRows: GA4 rows with dimension 'date' (YYYYMMDD); bucket into 7-day windows
  const byDate = new Map()
  for (const r of dateRows) {
    byDate.set(r.dimensionValues[0].value, parseFloat(r.metricValues[valueIdx]?.value ?? "0"))
  }
  const labels = []
  const values = []
  const cur = new Date(startDate)
  const end = new Date(endDate)
  while (cur <= end) {
    let sum = 0
    for (let i = 0; i < 7 && cur <= end; i++) {
      const key = cur.toISOString().slice(0, 10).replace(/-/g, "")
      sum += byDate.get(key) ?? 0
      if (i < 6) cur.setUTCDate(cur.getUTCDate() + 1)
    }
    labels.push(dayLabel(new Date(cur.getTime() - 6 * 86400000)))
    values.push(Math.round(sum))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return { labels, values }
}

async function fetchGa4Sections(propertyId, startDate, endDate) {
  const days = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1
  const prevEnd = new Date(new Date(startDate).getTime() - 86400000).toISOString().slice(0, 10)
  const prevStart = new Date(new Date(prevEnd).getTime() - (days - 1) * 86400000).toISOString().slice(0, 10)

  const [agg, curDates, prevDates, events, channels] = await Promise.all([
    ga4Report(propertyId, {
      dateRanges: [{ startDate, endDate }, { startDate: prevStart, endDate: prevEnd }],
      metrics: [{ name: "totalUsers" }, { name: "newUsers" }, { name: "eventCount" }, { name: "screenPageViews" }, { name: "conversions" }],
    }),
    ga4Report(propertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "totalUsers" }, { name: "newUsers" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 400,
    }),
    ga4Report(propertyId, {
      dateRanges: [{ startDate: prevStart, endDate: prevEnd }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "totalUsers" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 400,
    }),
    ga4Report(propertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "eventName" }, { name: "yearMonth" }],
      metrics: [{ name: "eventCount" }],
      limit: 1000,
    }),
    ga4Report(propertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }, { name: "yearMonth" }],
      metrics: [{ name: "totalUsers" }],
      limit: 1000,
    }),
  ])

  const mv = (row, i) => parseFloat(row?.metricValues?.[i]?.value ?? "0")
  const curRow = agg.rows?.[0]
  const prvRow = agg.rows?.[1]

  const ga4Summary = {
    metrics: [
      { label: "Users", value: fmtK(mv(curRow, 0)), delta: pctDelta(mv(curRow, 0), mv(prvRow, 0)) },
      { label: "New users", value: fmtK(mv(curRow, 1)), delta: pctDelta(mv(curRow, 1), mv(prvRow, 1)) },
      { label: "Event count", value: fmtK(mv(curRow, 2)), delta: pctDelta(mv(curRow, 2), mv(prvRow, 2)) },
      { label: "Views", value: fmtK(mv(curRow, 3)), delta: pctDelta(mv(curRow, 3), mv(prvRow, 3)) },
    ],
    ...(() => {
      const cur = weeklyBuckets(curDates.rows ?? [], startDate, endDate)
      const prev = weeklyBuckets(prevDates.rows ?? [], prevStart, prevEnd)
      return { labels: cur.labels, last90: cur.values, preceding: prev.values }
    })(),
  }

  // Group a (name, yearMonth) report into { labels, series: Total + top 5 names }
  function monthlySeries(rows, topN = 5) {
    const monthKeys = [...new Set(rows.map((r) => r.dimensionValues[1].value))].sort()
    const labels = monthKeys.map((ym) =>
      new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(4) - 1, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }))
    const byName = new Map()
    for (const r of rows) {
      const name = r.dimensionValues[0].value
      if (!byName.has(name)) byName.set(name, Object.fromEntries(monthKeys.map((k) => [k, 0])))
      byName.get(name)[r.dimensionValues[1].value] += mv(r, 0)
    }
    const ranked = [...byName.entries()]
      .map(([name, perMonth]) => ({ name, data: monthKeys.map((k) => Math.round(perMonth[k])), total: Object.values(perMonth).reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, topN)
    const totals = monthKeys.map((_, i) => ranked.reduce((s, r) => s + r.data[i], 0))
    return { labels, series: [{ name: "Total", data: totals }, ...ranked.map(({ name, data }) => ({ name, data }))] }
  }

  const newUsers = Math.round(mv(curRow, 1))
  const totalUsers = Math.round(mv(curRow, 0))
  const leadWeekly = weeklyBuckets(curDates.rows ?? [], startDate, endDate, 1)

  return {
    ga4Summary,
    eventsByName: monthlySeries(events.rows ?? []),
    usersByChannel: monthlySeries(channels.rows ?? []),
    leadsOverview: {
      newUsers,
      returningUsers: Math.max(totalUsers - newUsers, 0),
      qualifiedLeads: 0, // ponytail: no lead-qualification signal in GA4; wire a key event if one is defined
      converted: Math.round(mv(curRow, 4)),
      labels: leadWeekly.labels,
      values: leadWeekly.values,
    },
  }
}

// ─── GSC section ──────────────────────────────────────────────────────────────

async function fetchGscSection(site, startDate, endDate) {
  const token = await getAccessToken()
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions: ["date"], rowLimit: 500, dataState: "final" }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? `GSC HTTP ${res.status}`)

  const rows = (data.rows ?? []).sort((a, b) => a.keys[0].localeCompare(b.keys[0]))
  const clicks = rows.reduce((s, r) => s + r.clicks, 0)
  const impressions = rows.reduce((s, r) => s + r.impressions, 0)
  const position = impressions > 0 ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions : 0

  // Thin the series to ~10 points for the chart
  const step = Math.max(1, Math.floor(rows.length / 10))
  const sampled = rows.filter((_, i) => i % step === 0)

  return {
    clicks: fmtK(clicks),
    impressions: fmtK(impressions),
    ctr: impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : "0%",
    position: position.toFixed(1),
    labels: sampled.map((r) => { const d = new Date(r.keys[0]); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}` }),
    impressionSeries: sampled.map((r) => Math.round(r.impressions)),
    positionSeries: sampled.map((r) => Math.round(r.position * 10) / 10),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getGbpReport({ site, ga4, client, gbpAccount, gbpLocation, startDate, endDate }) {
  if (!gbpLocation || !startDate || !endDate) throw new Error("gbpLocation, startDate and endDate are required")

  // Reports use the exact GBP location explicitly assigned to the client.
  const location = await findLocationById(gbpAccount, gbpLocation)

  const [gbp, ga4Sections, gsc] = await Promise.all([
    fetchGbpSections(location, startDate, endDate),
    ga4 ? fetchGa4Sections(ga4, startDate, endDate).catch((error) => {
      console.warn("[gbp-report] GA4 unavailable:", error instanceof Error ? error.message : error)
      return null
    }) : Promise.resolve(null),
    site ? fetchGscSection(site, startDate, endDate).catch(() => null) : Promise.resolve(null),
  ])

  const EMPTY_GA4 = {
    ga4Summary: { metrics: [], labels: [], last90: [], preceding: [] },
    eventsByName: { labels: [], series: [] },
    usersByChannel: { labels: [], series: [] },
    leadsOverview: { newUsers: 0, returningUsers: 0, qualifiedLeads: 0, converted: 0, labels: [], values: [] },
  }
  const EMPTY_GSC = { clicks: "0", impressions: "0", ctr: "0%", position: "0", labels: [], impressionSeries: [], positionSeries: [] }

  return {
    ...gbp,
    ...(ga4Sections ?? EMPTY_GA4),
    gsc: gsc ?? EMPTY_GSC,
  }
}
