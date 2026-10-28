import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const reports = new Map()
const pending = new Map()
const TTL = 2 * 60 * 1000
let access = null
let refreshing = null

async function accessToken() {
  if (access && access.expiresAt > Date.now() + 60000) return access.token
  if (refreshing) return refreshing
  refreshing = (async () => {
    // Ads always uses the main MCC identity, never the separate GBP identity.
    let stored = {}, credentials = {}
    try { stored = JSON.parse(readFileSync(new URL('token.json', root), 'utf8')) } catch { /* Environment credentials may be configured instead. */ }
    try { const raw = JSON.parse(readFileSync(new URL('credentials.json', root), 'utf8')); credentials = raw.installed || raw.web || {} } catch { /* Use the stored or environment credentials. */ }
    const refreshToken = stored.refresh_token || process.env.GOOGLE_REFRESH_TOKEN
    const clientId = stored.client_id || credentials.client_id || process.env.GOOGLE_CLIENT_ID
    const clientSecret = stored.client_secret || credentials.client_secret || process.env.GOOGLE_CLIENT_SECRET
    if (!refreshToken || !clientId || !clientSecret) throw new Error('Google Ads connection is not configured')
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
      signal: AbortSignal.timeout(10000),
    })
    const body = await response.json()
    if (!response.ok || !body.access_token) throw new Error('Unable to refresh the Google Ads connection')
    access = { token: body.access_token, expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000 }
    return access.token
  })().finally(() => { refreshing = null })
  return refreshing
}

export function validateBudgetRange({ accountId, platform, startDate, endDate }) {
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (!/^\d{10}$/.test(accountId || '') || !['ads', 'guarantee'].includes(platform) || !validDate(startDate) || !validDate(endDate) || startDate > endDate || startDate.slice(0, 7) !== endDate.slice(0, 7)) {
    throw Object.assign(new Error('A valid account, platform and date range within one month are required'), { statusCode: 400 })
  }
}

export async function fetchGoogleBudgetDaily({ accountId, platform, startDate, endDate }, search) {
  validateBudgetRange({ accountId, platform, startDate, endDate })
  const query = `SELECT segments.date, metrics.cost_micros FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    AND campaign.advertising_channel_type ${platform === 'guarantee' ? '=' : '!='} 'LOCAL_SERVICES'
    ORDER BY segments.date`
  const dailyMicros = new Map()
  let cursor
  const cursors = new Set()
  do {
    const page = await search(accountId, query, cursor)
    if (page.results !== undefined && !Array.isArray(page.results)) throw new Error('Invalid Google Ads spend response')
    for (const row of page.results || []) {
      const date = row.segments?.date
      const cost = Number(row.metrics?.costMicros)
      if (!date || date < startDate || date > endDate || !Number.isFinite(cost)) throw new Error('Invalid daily spend returned by Google Ads')
      dailyMicros.set(date, (dailyMicros.get(date) || 0) + cost)
    }
    cursor = page.nextPageToken
    if (cursor && cursors.has(cursor)) throw new Error('Invalid Google Ads pagination')
    if (cursor) cursors.add(cursor)
  } while (cursor)
  const micros = [...dailyMicros.values()].reduce((sum, value) => sum + value, 0)
  return {
    accountId, platform, dateRange: { start: startDate, end: endDate },
    spend: Math.round(micros / 10000) / 100,
    daily: [...dailyMicros].map(([date, costMicros]) => ({ date, costMicros, spend: Math.round(costMicros / 10000) / 100 })),
    fetchedAt: new Date().toISOString(), source: 'google_ads_api',
  }
}

export async function getGoogleBudgetReport(params) {
  validateBudgetRange(params)
  const key = `${params.accountId}:${params.platform}:${params.startDate}:${params.endDate}`
  const saved = reports.get(key)
  if (saved && Date.now() - saved.at < TTL && !params.refresh) return saved.value
  if (pending.has(key)) return pending.get(key)
  const run = (async () => {
    const token = await accessToken()
    const developerToken = process.env.ADS_DEVELOPER_TOKEN
    const mcc = (process.env.ADS_MCC_ID || '').replace(/-/g, '')
    if (!developerToken || !/^\d{10}$/.test(mcc)) throw new Error('Google Ads MCC connection is not configured')
    const result = await fetchGoogleBudgetDaily(params, async (accountId, query, pageToken) => {
      const response = await fetch(`https://googleads.googleapis.com/v24/customers/${accountId}/googleAds:search`, {
        method: 'POST', signal: AbortSignal.timeout(12000),
        headers: { Authorization: `Bearer ${token}`, 'developer-token': developerToken, 'login-customer-id': mcc, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, ...(pageToken ? { pageToken } : {}) }),
      })
      const body = await response.json()
      if (!response.ok || body.error) {
        if (response.status === 401) access = null
        throw new Error(body.error?.message || `Google Ads spend request failed (${response.status})`)
      }
      return body
    })
    if (reports.size >= 256) reports.delete(reports.keys().next().value)
    reports.set(key, { at: Date.now(), value: result })
    return result
  })().finally(() => pending.delete(key))
  pending.set(key, run)
  return run
}
