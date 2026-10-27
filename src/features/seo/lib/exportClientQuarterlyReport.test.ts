import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import { buildClientQuarterlyPdf, type QuarterlyReportData } from './exportClientQuarterlyReport'

const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

const DATA: QuarterlyReportData = {
  period: { startDate: '2026-07-29', endDate: '2026-10-27' },
  domain: 'example.com',
  totals: {
    clicks: '100', impressions: '1K', ctr: '10%', position: '8',
    prevClicks: '80', prevImpressions: '900', clicksDelta: 25, impressionsDelta: 11, positionDelta: 1,
    labels: ['Aug', 'Sep', 'Oct'], series: [20, 30, 50],
  },
  keywords: { top: [], newTerms: [], newCount: 0 },
  pages: { top: [], gainers: [], losers: [] },
  devices: [],
  countries: [],
  conversions: null,
  users: null,
}

describe('client quarterly report PDF', () => {
  it('embeds the optional GBP image without changing the report flow', () => {
    const withoutImage = buildClientQuarterlyPdf({ data: DATA, clientName: 'Example' }, jsPDF)
    const withImage = buildClientQuarterlyPdf(
      { data: DATA, clientName: 'Example' },
      jsPDF,
      { gbpImage: ONE_PIXEL_PNG },
    )

    expect(withImage.getNumberOfPages()).toBe(withoutImage.getNumberOfPages())
    expect(withImage.output('arraybuffer').byteLength).toBeGreaterThan(withoutImage.output('arraybuffer').byteLength)
  })
})
