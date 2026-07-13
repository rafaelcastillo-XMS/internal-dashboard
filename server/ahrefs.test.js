import { describe, expect, it, vi } from 'vitest'
import { AhrefsApiError, getAhrefsSnapshot, normalizeAhrefsTarget } from './ahrefs.js'

describe('normalizeAhrefsTarget', () => {
  it('normalizes Search Console properties and full URLs', () => {
    expect(normalizeAhrefsTarget('sc-domain:www.Example.com')).toBe('example.com')
    expect(normalizeAhrefsTarget('https://www.example.com/services/seo')).toBe('example.com')
  })

  it('rejects an empty target', () => {
    expect(normalizeAhrefsTarget('')).toBe('')
  })
})

describe('getAhrefsSnapshot', () => {
  it('maps the batch analysis response to the dashboard snapshot shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        targets: [{
          domain_rating: 52,
          ahrefs_rank: 1200,
          org_keywords: 340,
          org_traffic: 7200,
          backlinks: 880,
          refdomains: 96,
        }],
      }),
    })

    const snapshot = await getAhrefsSnapshot({ apiKey: 'test-key', target: 'https://example.com/path', fetchImpl })
    expect(snapshot).toMatchObject({
      domain: 'example.com',
      domain_rating: 52,
      ahrefs_rank: 1200,
      organic_keywords: 340,
      organic_traffic: 7200,
      backlinks: 880,
      referring_domains: 96,
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.ahrefs.com/v3/batch-analysis/batch-analysis',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('returns a safe authentication error without exposing the key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401 })

    await expect(getAhrefsSnapshot({ apiKey: 'secret-key', target: 'example.com', fetchImpl }))
      .rejects.toMatchObject({
        name: 'AhrefsApiError',
        upstreamStatus: 401,
        message: 'Ahrefs rejected the API key. Verify AHREFS_API_KEY.',
      })
  })

  it('reports a missing server-side key before making a request', async () => {
    await expect(getAhrefsSnapshot({ apiKey: '', target: 'example.com' }))
      .rejects.toBeInstanceOf(AhrefsApiError)
  })
})
