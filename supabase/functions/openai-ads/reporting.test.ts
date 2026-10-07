import { describe, it, expect } from 'vitest'
import { fetchAdsReport } from './reporting'

const campaign = { id: 'cmp_1', name: 'Residential Garage Door Repair', status: 'active', budget: { daily_spend_limit_micros: 30000000 } }
const metric = { campaign_id: 'cmp_1', spend: 40.36, impressions: 625, clicks: 7, cpc: 5.77 }
const now = new Date('2026-10-07T17:00:00Z')
function mockApi(failInsights = false) {
  const urls: URL[] = []
  const request = (async (input: string | URL | Request) => {
    const url = new URL(String(input)); urls.push(url)
    if (url.pathname.endsWith('/ad_account')) return Response.json({ timezone: 'America/New_York' })
    if (url.pathname.endsWith('/campaigns')) return Response.json({ data: [campaign], has_more: false })
    if (failInsights) return new Response('Invalid time_ranges', { status: 400 })
    const p = url.searchParams
    expect(p.getAll('fields[]')).toContain('campaign.id')
    const range = JSON.parse(p.get('time_ranges[]')!)
    expect(['date_range', 'unix_range']).toContain(range.type)
    return Response.json({ data: [metric], has_more: false })
  }) as typeof fetch
  return { request, urls }
}
describe('OpenAI Ads reporting', () => {
  it('joins real Insights flat columns to campaigns and reads daily budgets', async () => {
    const api = mockApi()
    const report = await fetchAdsReport('test', { startDate: '2026-09-30', endDate: '2026-10-06' }, api.request, now)
    expect(report.insightsError).toBeNull()
    expect(report.campaigns[0]).toMatchObject({ budget: 30, budgetPeriod: 'daily', spend: 40.36, clicks: 7, impressions: 625, cpc: 5.77 })
  })
  it('clamps future dates to today in the account timezone', async () => {
    const api = mockApi()
    await fetchAdsReport('test', { startDate: '2026-10-05', endDate: '2026-10-11' }, api.request, now)
    const range = JSON.parse(api.urls.at(-1)!.searchParams.get('time_ranges[]')!)
    expect(range).toEqual({ type: 'date_range', since: '2026-10-05', until: '2026-10-07', timezone: 'America/New_York' })
  })
  it('keeps the deployed frontend compatible with inclusive Unix end dates', async () => {
    const api = mockApi()
    await fetchAdsReport('test', { startTime: String(Date.parse('2026-09-30T04:00:00Z') / 1000), endTime: String(Date.parse('2026-10-07T03:59:59Z') / 1000) }, api.request, now)
    expect(JSON.parse(api.urls.at(-1)!.searchParams.get('time_ranges[]')!)).toEqual({ type: 'unix_range', start: String(Date.parse('2026-09-30T04:00:00Z') / 1000), end: String(Date.parse('2026-10-07T04:00:00Z') / 1000) })
  })
  it('returns an explicit error when metrics are unavailable', async () => {
    const api = mockApi(true)
    const report = await fetchAdsReport('test', { startDate: '2026-09-30', endDate: '2026-10-06' }, api.request, now)
    expect(report.campaigns[0].budget).toBe(30)
    expect(report.insightsError).toContain('400')
  })
  it('loads every campaign and insight page', async () => {
    const request = (async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/ad_account')) return Response.json({ timezone: 'America/New_York' })
      const second = url.searchParams.has('after')
      const data = url.pathname.endsWith('/campaigns')
        ? [{ ...campaign, id: second ? 'cmp_2' : 'cmp_1' }]
        : [{ ...metric, campaign_id: second ? 'cmp_2' : 'cmp_1' }]
      return Response.json({ data, has_more: !second, last_id: 'cursor_1' })
    }) as typeof fetch
    const result = await fetchAdsReport('test', { startDate: '2026-09-30', endDate: '2026-10-06' }, request, now)
    expect(result.campaigns).toHaveLength(2)
    expect(result.campaigns.map(c => c.spend)).toEqual([40.36, 40.36])
    expect(result.insightsError).toBeNull()
  })
})
