import { describe, it, expect, vi } from 'vitest'
import { fetchBudgetSpend } from './budgetSpend'
const params = (platform = 'ads') => new URLSearchParams({ accountId: '5028132994', platform, startDate: '2026-10-01', endDate: '2026-10-31' })
describe('Monthly Google budget spend', () => {
  it('sums all pages in micros, rounds once and separates Ads from LSA', async () => {
    const search = vi.fn().mockResolvedValueOnce({ results: [{ metrics: { costMicros: '1234567' } }], nextPageToken: 'next' }).mockResolvedValueOnce({ results: [{ metrics: { costMicros: '2345678' } }] })
    expect((await fetchBudgetSpend(params(), search)).spend).toBe(3.58)
    expect(search.mock.calls[0][1]).toContain("!= 'LOCAL_SERVICES'")
    expect(search.mock.calls[0][1]).not.toContain('REMOVED')
    expect(search.mock.calls[1][2]).toBe('next')
  })
  it('queries LSA separately and treats a successful empty result as zero', async () => {
    const search = vi.fn().mockResolvedValue({ results: [] })
    expect((await fetchBudgetSpend(params('guarantee'), search)).spend).toBe(0)
    expect(search.mock.calls[0][1]).toContain("= 'LOCAL_SERVICES'")
  })
  it('propagates API errors instead of inventing zero spend', async () => {
    await expect(fetchBudgetSpend(params(), vi.fn().mockRejectedValue(new Error('Unavailable')))).rejects.toThrow('Unavailable')
  })
  it('rejects invalid parameters before querying', async () => {
    const search = vi.fn()
    await expect(fetchBudgetSpend(params('other'), search)).rejects.toThrow('Invalid')
    expect(search).not.toHaveBeenCalled()
  })
})
