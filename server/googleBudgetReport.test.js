import { describe, expect, it, vi } from 'vitest'
import { fetchGoogleBudgetDaily, validateBudgetRange } from './googleBudgetReport.js'

const params = { accountId: '4101522507', platform: 'guarantee', startDate: '2026-10-01', endDate: '2026-10-31' }
describe('Google monthly and weekly source', () => {
  it('loads all pages, aggregates multiple campaigns per day, and retains exact micros for weekly grouping', async () => {
    const search = vi.fn().mockResolvedValueOnce({ results: [
      { segments: { date: '2026-10-07' }, metrics: { costMicros: '1234567' } },
      { segments: { date: '2026-10-07' }, metrics: { costMicros: '2345678' } },
    ], nextPageToken: 'next' }).mockResolvedValueOnce({ results: [{ segments: { date: '2026-10-08' }, metrics: { costMicros: '4000000' } }] })
    const report = await fetchGoogleBudgetDaily(params, search)
    expect(report.spend).toBe(7.58)
    expect(report.daily).toEqual([{ date: '2026-10-07', costMicros: 3580245, spend: 3.58 }, { date: '2026-10-08', costMicros: 4000000, spend: 4 }])
    expect(search.mock.calls[0][1]).toContain("= 'LOCAL_SERVICES'")
    expect(search.mock.calls[0][1]).not.toContain('REMOVED')
    expect(search.mock.calls[1][2]).toBe('next')
  })
  it('separates regular Ads from LSA and only returns zero after a successful query', async () => {
    const search = vi.fn().mockResolvedValue({ results: [] })
    expect((await fetchGoogleBudgetDaily({ ...params, platform: 'ads' }, search)).spend).toBe(0)
    expect(search.mock.calls[0][1]).toContain("!= 'LOCAL_SERVICES'")
    await expect(fetchGoogleBudgetDaily(params, vi.fn().mockRejectedValue(new Error('Access denied')))).rejects.toThrow('Access denied')
  })
  it.each([{ accountId: 'bad' }, { endDate: '2026-11-01' }, { startDate: '2026-02-30' }, { startDate: '2026-99-99' }, { platform: 'other' }])('rejects invalid ranges before fetching: %j', patch => {
    expect(() => validateBudgetRange({ ...params, ...patch })).toThrow('valid account')
  })
  it('rejects missing dates or invalid costs instead of fabricating spend', async () => {
    await expect(fetchGoogleBudgetDaily(params, vi.fn().mockResolvedValue({ results: [{ metrics: { costMicros: '100' } }] }))).rejects.toThrow('Invalid daily spend')
  })
})
