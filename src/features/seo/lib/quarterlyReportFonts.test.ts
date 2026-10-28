import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('quarterly report font assets', () => {
  it('loads the three bundled assets once and shares the result across exports', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([65, 66, 67]).buffer })
    vi.stubGlobal('fetch', fetch)
    const { loadQuarterlyReportFonts } = await import('./quarterlyReportFonts')
    const [first, second] = await Promise.all([loadQuarterlyReportFonts(), loadQuarterlyReportFonts()])
    expect(first).toEqual({ regular: 'QUJD', bold: 'QUJD', display: 'QUJD' })
    expect(second).toBe(first)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('permits fallback export after a failed asset request and retries on the next export', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetch)
    const { loadQuarterlyReportFonts } = await import('./quarterlyReportFonts')
    expect(await loadQuarterlyReportFonts()).toBeUndefined()
    fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([65]).buffer })
    expect(await loadQuarterlyReportFonts()).toEqual({ regular: 'QQ==', bold: 'QQ==', display: 'QQ==' })
    expect(fetch).toHaveBeenCalledTimes(6)
  })
})
