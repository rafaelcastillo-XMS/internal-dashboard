import { describe, expect, it } from 'vitest'
import { mapReportRequests, reportMonthWeeks, resolveReportBudget, weekSpend } from './budgetReportData'
import { buildWeeklyReportTable } from './budgetReportTables'

const client = { id: 'holts-garage', sem_account_id: '5028132994', lsa_account_id: '4101522507', status: 'active', sem_enabled: true }
describe('Budget report accuracy', () => {
  it('resolves Holt LSA budget from its linked Ads integration, with explicit LSA overrides taking precedence', () => {
    const budgets = [{ account_id: '5028132994', report_type: 'guarantee_monthly', budget: 10858 }]
    expect(resolveReportBudget('4101522507', 'Google Guarantee', [client], budgets)).toBe(10858)
    expect(resolveReportBudget('4101522507', 'Google Guarantee', [client], [...budgets, { account_id: '4101522507', report_type: 'guarantee_monthly', budget: 0 }])).toBe(0)
    expect(resolveReportBudget('4101522507', 'Google Ads', [client], budgets)).toBeNull()
  })
  it('splits the complete month into 1–7, 8–14, 15–21, 22–28 and 29–end, including leap days', () => {
    expect(reportMonthWeeks(2026, 9).map(week => [week.from.slice(-2), week.to.slice(-2)])).toEqual([['01', '07'], ['08', '14'], ['15', '21'], ['22', '28'], ['29', '31']])
    expect(reportMonthWeeks(2026, 1)).toHaveLength(4)
    expect(reportMonthWeeks(2024, 1)[4]).toMatchObject({ from: '2024-02-29', to: '2024-02-29' })
  })
  it('uses actual daily costs for every week and keeps missing responses distinct from verified zero spend', () => {
    const weeks = reportMonthWeeks(2026, 9)
    const data = { fetchedAt: '', spend: 110, daily: [
      { date: '2026-10-01', spend: 10 }, { date: '2026-10-07', spend: 20 },
      { date: '2026-10-08', spend: 30 }, { date: '2026-10-28', spend: 40 }, { date: '2026-10-31', spend: 10 },
    ] }
    const values = weekSpend(data, weeks)
    expect(values).toEqual([30, 30, 0, 40, 10])
    expect(values.reduce<number>((sum, value) => sum + (value ?? 0), 0)).toBe(data.spend)
    expect(weekSpend(undefined, weeks)).toEqual([null, null, null, null, null])
  })
  it('starts the next account as soon as a slot is free without waiting for a slow batch', async () => {
    const started: number[] = [], finished: number[] = []
    let finishSlow!: () => void
    const slow = new Promise<void>(resolve => { finishSlow = resolve })
    const run = mapReportRequests([1, 2, 3], 2, async item => {
      started.push(item)
      if (item === 1) await slow
      finished.push(item)
    })
    await Promise.resolve(); await Promise.resolve()
    expect(started).toEqual([1, 2, 3])
    expect(finished).toEqual([2, 3])
    finishSlow(); await run
    expect(finished).toEqual([2, 3, 1])
  })
  it('keeps completed weekly amounts visible while another account is still loading', () => {
    const table = buildWeeklyReportTable([
      { accountId: '5028132994', name: 'Holt', platform: 'Google Ads', status: 'ENABLED', budget: 10150, spend: 100, weeklySpend: [50, 50, 0, 0, 0] },
      { accountId: '4101522507', name: 'Holt LSA', platform: 'Google Guarantee', status: 'ENABLED', budget: 10858, spend: null, loading: true },
    ], [client], 'October 2026', reportMonthWeeks(2026, 9))
    expect(table.groups[0].rows[0].cells[4]).toBe('$50.00')
    expect(table.groups[0].rows[1].cells[4]).toBe('Loading…')
    expect(table.headers).not.toContain('Spend')
    expect(table.headers).not.toContain('Remaining')
    expect(buildWeeklyReportTable([], [], 'February 2026', reportMonthWeeks(2026, 1)).headers).toHaveLength(8)
  })
})
