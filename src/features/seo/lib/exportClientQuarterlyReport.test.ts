import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { jsPDF } from 'jspdf'
import { buildClientQuarterlyPdf, type QuarterlyReportData } from './exportClientQuarterlyReport'
import { QuarterlyReportLayout, REPORT } from './quarterlyReportDesign'

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

  it('embeds the local typefaces and keeps the original figures and conditional conversions', () => {
    const font = (name: string) => readFileSync(new URL(`../assets/fonts/${name}`, import.meta.url)).toString('base64')
    class InspectedPdf extends jsPDF {
      constructor() {
        super({ unit: 'mm', format: 'a4' })
        vi.spyOn(this as jsPDF, 'text')
      }
    }
    const pdf = buildClientQuarterlyPdf({ data: { ...DATA, conversions: { current: 7, previous: 5, delta: 40 } }, clientName: 'Example' }, InspectedPdf, {
      fonts: { regular: font('Lato-Regular.ttf'), bold: font('Lato-Bold.ttf'), display: font('DMSerifDisplay-Regular.ttf') },
    })
    const content = vi.mocked(pdf.text).mock.calls.map(call => call[0]).flat().join(' ')
    expect(content).toContain('100 organic clicks')
    expect(content).toContain('Conversions generated from SEO')
    expect(content).toContain('40% vs. previous quarter')
    expect(pdf.getFontList()).toMatchObject({ ReportSans: ['normal', 'bold'], ReportDisplay: ['normal'] })
    expect(pdf.getNumberOfPages()).toBe(13)
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(20000)
  })

  it('paginates long table content without dropping text or drawing over the footer', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const layout = new QuarterlyReportLayout(pdf, 'May 2026 to July 2026', 'Example')
    const text = vi.spyOn(pdf, 'text')
    const y = layout.page('Top keywords', '03 / CONTENT & AUDIENCE')
    const longTerm = `${'long search phrase '.repeat(300)}FINAL-KEYWORD`
    const end = layout.table(['SEARCH TERM', 'CLICKS'], [[longTerm, '12'], ['LAST-ROW', '5']], [131, 35], y)
    expect(pdf.getNumberOfPages()).toBeGreaterThan(2)
    expect(end).toBeLessThanOrEqual(REPORT.bottom + 10)
    const content = text.mock.calls.map(call => call[0]).flat().join(' ')
    expect(content).toContain('FINAL-KEYWORD')
    expect(content).toContain('LAST-ROW')
    expect(content.match(/SEARCH TERM/g)?.length).toBeGreaterThan(1)
    for (const call of text.mock.calls) {
      const lines = Array.isArray(call[0]) ? call[0].length : 1
      expect(Number(call[2]) + (lines - 1) * 4.7628).toBeLessThan(276)
    }
  })

  it('renders a useful local-presence state when a supplied image cannot be decoded', () => {
    const pdf = buildClientQuarterlyPdf({ data: DATA, clientName: 'Example' }, jsPDF, { gbpImage: 'data:image/png;base64,invalid' })
    expect(pdf.getNumberOfPages()).toBe(12)
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(1000)
  })

  it('places up to three GBP images on separate pages and caps larger input arrays', () => {
    const options = { data: DATA, clientName: 'Example' }
    const baseline = buildClientQuarterlyPdf(options, jsPDF)
    const three = buildClientQuarterlyPdf(options, jsPDF, { gbpImages: [ONE_PIXEL_PNG, ONE_PIXEL_PNG, ONE_PIXEL_PNG] })
    const four = buildClientQuarterlyPdf(options, jsPDF, { gbpImages: [ONE_PIXEL_PNG, ONE_PIXEL_PNG, ONE_PIXEL_PNG, ONE_PIXEL_PNG] })
    expect(three.getNumberOfPages()).toBe(baseline.getNumberOfPages() + 2)
    expect(four.getNumberOfPages()).toBe(three.getNumberOfPages())
    expect(three.output('arraybuffer').byteLength).toBeGreaterThan(baseline.output('arraybuffer').byteLength)
  })

  it('skips unreadable images without losing valid evidence or adding blank pages', () => {
    const options = { data: DATA, clientName: 'Example' }
    const mixed = buildClientQuarterlyPdf(options, jsPDF, { gbpImages: ['invalid', ONE_PIXEL_PNG, ONE_PIXEL_PNG] })
    const valid = buildClientQuarterlyPdf(options, jsPDF, { gbpImages: [ONE_PIXEL_PNG, ONE_PIXEL_PNG] })
    expect(mixed.getNumberOfPages()).toBe(valid.getNumberOfPages())
  })
})
