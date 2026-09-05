/**
 * server/quarterlyReport.js
 * Data for the client-facing SEO quarterly report: GSC totals/keywords/pages/
 * device/country breakdowns (current vs. previous period) plus GA4 users and
 * conversions. Reuses the OAuth token and GA4 helper from gbpReport.js.
 */

import { getAccessToken, ga4Report, fmtK, pctDelta } from "./gbpReport.js"

async function gscQuery(site, body) {
  const token = await getAccessToken()
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ dataState: "final", ...body }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? `GSC HTTP ${res.status}`)
  return data.rows ?? []
}

function summarize(rows) {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0)
  const impressions = rows.reduce((s, r) => s + r.impressions, 0)
  const position = impressions > 0 ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions : 0
  return { clicks, impressions, ctr: impressions > 0 ? (clicks / impressions) * 100 : 0, position }
}

async function gscTotals(site, startDate, endDate, prevStart, prevEnd) {
  const [curRows, prevRows] = await Promise.all([
    gscQuery(site, { startDate, endDate, dimensions: ["date"], rowLimit: 500 }),
    gscQuery(site, { startDate: prevStart, endDate: prevEnd, dimensions: ["date"], rowLimit: 500 }),
  ])
  const cur = summarize(curRows)
  const prev = summarize(prevRows)
  const sorted = [...curRows].sort((a, b) => a.keys[0].localeCompare(b.keys[0]))
  const step = Math.max(1, Math.floor(sorted.length / 12))
  const sampled = sorted.filter((_, i) => i % step === 0)

  return {
    clicks: fmtK(cur.clicks), impressions: fmtK(cur.impressions),
    ctr: `${cur.ctr.toFixed(1)}%`, position: cur.position.toFixed(1),
    prevClicks: fmtK(prev.clicks), prevImpressions: fmtK(prev.impressions),
    clicksDelta: pctDelta(cur.clicks, prev.clicks),
    impressionsDelta: pctDelta(cur.impressions, prev.impressions),
    positionDelta: Math.round((prev.position - cur.position) * 10) / 10, // positive = improved (lower is better)
    labels: sampled.map((r) => { const d = new Date(r.keys[0]); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}` }),
    series: sampled.map((r) => r.clicks),
  }
}

async function keywordComparison(site, startDate, endDate, prevStart, prevEnd) {
  const [curRows, prevRows] = await Promise.all([
    gscQuery(site, { startDate, endDate, dimensions: ["query"], rowLimit: 20 }),
    gscQuery(site, { startDate: prevStart, endDate: prevEnd, dimensions: ["query"], rowLimit: 500 }),
  ])
  const prevMap = new Map(prevRows.map((r) => [r.keys[0], r]))
  const top = curRows.map((r) => {
    const prev = prevMap.get(r.keys[0])
    return {
      term: r.keys[0],
      clicks: r.clicks,
      position: Math.round(r.position * 10) / 10,
      prevPosition: prev ? Math.round(prev.position * 10) / 10 : null,
      isNew: !prev,
    }
  })
  return {
    top: top.slice(0, 12),
    newTerms: top.filter((k) => k.isNew).slice(0, 8).map((k) => k.term),
    newCount: top.filter((k) => k.isNew).length,
  }
}

async function pageComparison(site, startDate, endDate, prevStart, prevEnd, domain) {
  const [curRows, prevRows] = await Promise.all([
    gscQuery(site, { startDate, endDate, dimensions: ["page"], rowLimit: 20 }),
    gscQuery(site, { startDate: prevStart, endDate: prevEnd, dimensions: ["page"], rowLimit: 500 }),
  ])
  const prevMap = new Map(prevRows.map((r) => [r.keys[0], r.clicks]))
  const withDelta = curRows.map((r) => {
    const prevClicks = prevMap.get(r.keys[0]) ?? 0
    return { page: r.keys[0].replace(/^https?:\/\/[^/]+/, "") || "/", clicks: r.clicks, prevClicks, delta: r.clicks - prevClicks }
  })
  return {
    top: [...withDelta].sort((a, b) => b.clicks - a.clicks).slice(0, 8),
    gainers: [...withDelta].filter((p) => p.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5),
    losers: [...withDelta].filter((p) => p.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5),
  }
}

async function deviceBreakdown(site, startDate, endDate) {
  const rows = await gscQuery(site, { startDate, endDate, dimensions: ["device"], rowLimit: 10 })
  const total = rows.reduce((s, r) => s + r.clicks, 0)
  return rows
    .sort((a, b) => b.clicks - a.clicks)
    .map((r) => ({ device: r.keys[0], clicks: r.clicks, pct: total > 0 ? Math.round((r.clicks / total) * 100) : 0 }))
}

async function countryBreakdown(site, startDate, endDate) {
  const rows = await gscQuery(site, { startDate, endDate, dimensions: ["country"], rowLimit: 15 })
  return rows.sort((a, b) => b.clicks - a.clicks).slice(0, 6)
    .map((r) => ({ country: r.keys[0].toUpperCase(), clicks: r.clicks, impressions: r.impressions }))
}

async function ga4Totals(propertyId, startDate, endDate, prevStart, prevEnd) {
  const agg = await ga4Report(propertyId, {
    dateRanges: [{ startDate, endDate }, { startDate: prevStart, endDate: prevEnd }],
    metrics: [{ name: "totalUsers" }, { name: "conversions" }],
  })
  const mv = (row, i) => parseFloat(row?.metricValues?.[i]?.value ?? "0")
  const cur = agg.rows?.[0]
  const prev = agg.rows?.[1]
  return {
    users: { current: Math.round(mv(cur, 0)), previous: Math.round(mv(prev, 0)), delta: pctDelta(mv(cur, 0), mv(prev, 0)) },
    conversions: { current: Math.round(mv(cur, 1)), previous: Math.round(mv(prev, 1)), delta: pctDelta(mv(cur, 1), mv(prev, 1)) },
  }
}

export async function getQuarterlyReportData({ site, ga4, startDate, endDate }) {
  if (!site || !startDate || !endDate) throw new Error("site, startDate and endDate are required")

  const days = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1
  const prevEnd = new Date(new Date(startDate).getTime() - 86400000).toISOString().slice(0, 10)
  const prevStart = new Date(new Date(prevEnd).getTime() - (days - 1) * 86400000).toISOString().slice(0, 10)
  const domain = site.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "")

  const [totals, keywords, pages, devices, countries, ga4Data] = await Promise.all([
    gscTotals(site, startDate, endDate, prevStart, prevEnd),
    keywordComparison(site, startDate, endDate, prevStart, prevEnd),
    pageComparison(site, startDate, endDate, prevStart, prevEnd, domain),
    deviceBreakdown(site, startDate, endDate),
    countryBreakdown(site, startDate, endDate),
    ga4 ? ga4Totals(ga4, startDate, endDate, prevStart, prevEnd).catch(() => null) : Promise.resolve(null),
  ])

  return {
    period: { startDate, endDate, prevStart, prevEnd },
    domain,
    totals, keywords, pages, devices, countries,
    conversions: ga4Data?.conversions ?? null,
    users: ga4Data?.users ?? null,
  }
}
