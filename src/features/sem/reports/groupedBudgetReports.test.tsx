import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { groupBudgetRows } from './groupBudgetRows'
import { WeeklyGroupedTable, type WeeklyDisplayRow } from './WeeklyGroupedTable'
import { BudgetTableSkeleton } from './BudgetTableSkeleton'
import { MONTHLY_HEADERS, WEEKLY_HEADERS } from './reportTableHeaders'
import { reportRequest } from './reportLoading'

const clients = [{ id: 'client', status: 'active', sem_enabled: true, sem_account_id: 'ads', lsa_account_id: 'lsa' }]
const rows: WeeklyDisplayRow[] = [
  { accountId: 'ads', name: 'Client', platform: 'Google Ads', status: 'ENABLED', budget: 2640, spend: 0 },
  { accountId: 'other', name: 'Other', platform: 'Google Ads', status: 'ENABLED', budget: 100, spend: null },
  { accountId: 'lsa', name: 'Client LSA', platform: 'Google Guarantee', status: 'ENABLED', budget: 200, spend: 50, leads: 2 },
  { accountId: 'client', clientId: 'client', name: 'Client', platform: 'OpenAI Ads', campaign: 'Campaign', status: 'active', budget: 20, budgetPeriod: 'daily', spend: 0 },
]
describe('Grouped budget reports', () => {
  it('keeps client order, merges dedicated LSA and OpenAI mappings, and preserves original values', () => {
    const groups = groupBudgetRows(rows, clients)
    expect(groups.map(g => g.name)).toEqual(['Client', 'Other'])
    expect(groups[0].items.map(r => r.platform)).toEqual(['Google Ads', 'Google Guarantee', 'OpenAI Ads'])
    expect(groups[0].items).toEqual([rows[0], rows[2], rows[3]])
    expect(rows[1].name).toBe('Other')
  })
  it('keeps the verified Holt Ads and LSA accounts in one client group without client rows', () => {
    const holtRows: WeeklyDisplayRow[] = [
      { accountId: '5028132994', name: 'Holt’s Reliable Garage Door & Repair', platform: 'Google Ads', status: 'ENABLED', budget: 1, spend: 0 },
      { accountId: '4101522507', name: "HOLT'S RELIABLE GARAGE DOOR REPAIR - LSA ACCOUNT", platform: 'Google Guarantee', status: 'ENABLED', budget: 1, spend: 0 },
    ]
    const grouped = groupBudgetRows(holtRows, [])
    expect(grouped).toHaveLength(1)
    expect(grouped[0]).toMatchObject({ id: 'holts-garage', name: "Holt's Reliable Garage Door Repair" })
    expect(grouped[0].items.map(row => row.platform)).toEqual(['Google Ads', 'Google Guarantee'])
  })
  it('shows account-name stripes and only the five requested columns', () => {
    const html = renderToStaticMarkup(<WeeklyGroupedTable rows={rows} clients={clients} dateLabel="Selected week" />)
    expect(WEEKLY_HEADERS).toEqual(['Client', 'ID', 'Platform', 'Budget', 'Spend'])
    for (const value of ['Client', 'Other', 'ads', 'lsa', 'Google Ads', 'Google Guarantee', 'OpenAI Ads', '$20.00/day', '$50.00', '$0.00']) expect(html).toContain(value)
    expect(html).not.toContain('Campaign</th>')
    expect(html).not.toContain('Remaining</th>')
    expect(html).toContain('bg-[#eef5ff]')
    expect(html).toContain('w-[38%]')
    expect(html).toContain('w-[14%]')
    expect(html).not.toContain('>Total</td>')
  })
  it('does not invent missing LSA metrics', () => {
    const html = renderToStaticMarkup(<WeeklyGroupedTable rows={[{ ...rows[2], spend: null, leads: undefined }]} clients={clients} dateLabel="Week" />)
    expect(html).not.toContain('>Total<')
    expect(html).not.toContain('$0.00')
    expect(html).not.toContain('0.0%')
  })
  it.each([MONTHLY_HEADERS, WEEKLY_HEADERS])('matches the skeleton columns to the report', (...headers) => {
    const html = renderToStaticMarkup(<BudgetTableSkeleton headers={headers} />)
    expect(html).toContain('aria-busy="true"')
    expect(html.match(/<th /g)).toHaveLength(headers.length)
    expect(html.match(/<td /g)).toHaveLength(headers.length * 6)
  })
})
describe('Report request completion', () => {
  afterEach(() => vi.useRealTimers())
  it('waits for slow providers while retaining successful results after a partial failure', async () => {
    let finish!: (value: string) => void
    const slow = new Promise<string>(resolve => { finish = resolve })
    let complete = false
    const all = Promise.allSettled([reportRequest(Promise.resolve('Google')), reportRequest(Promise.reject(new Error('LSA unavailable'))), reportRequest(slow)]).then(results => { complete = true; return results })
    await Promise.resolve()
    expect(complete).toBe(false)
    finish('OpenAI')
    expect((await all).map(r => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
  })
  it('releases a hung request within the timeout', async () => {
    vi.useFakeTimers()
    const request = reportRequest(new Promise(() => {}), 100)
    const assertion = expect(request).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(100)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })
})
