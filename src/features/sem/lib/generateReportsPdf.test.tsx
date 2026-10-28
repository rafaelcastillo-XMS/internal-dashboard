import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildMonthlyReportTable, buildWeeklyReportTable, type WeeklyDisplayRow } from '../reports/budgetReportTables'
import { WeeklyGroupedTable } from '../reports/WeeklyGroupedTable'
import { MONTHLY_HEADERS, WEEKLY_HEADERS } from '../reports/reportTableHeaders'
import { generateMonthlyBudgetPdfBytes, generateWeeklyBudgetPdfBytes } from './generateReportsPdf'
import { renderBudgetTablePdf } from './renderBudgetTablePdf'

const dateLabel = 'Week Oct 12 – Oct 18, 2026'
const monthLabel = 'October 2026'
const clients = Array.from({ length: 18 }, (_, i) => ({ id: `client-${i}`, sem_account_id: `ads-${i}`, lsa_account_id: `lsa-${i}`, status: 'active', sem_enabled: true }))
const rows: WeeklyDisplayRow[] = clients.flatMap((c, i) => [
  { accountId: c.sem_account_id, name: `Client ${i + 1} - Residential and Commercial Garage Door Repair Services`, platform: 'Google Ads', status: 'ENABLED', budget: 2640, spend: 440, weeklySpend: [100, 150, 90, 100, 0] },
  { accountId: c.lsa_account_id, name: `Client ${i + 1} LSA`, platform: 'Google Guarantee', status: 'ENABLED', budget: 300, spend: 400, leads: 8, weeklySpend: [80, 120, 150, 50, 0] },
  { accountId: c.id, clientId: c.id, name: `Client ${i + 1}`, platform: 'OpenAI Ads', status: 'active', campaign: 'Emergency garage door repairs - regional awareness campaign with a long descriptive name', budget: 25, budgetPeriod: 'daily', spend: 0, weeklySpend: [0, 0, 0, 0, 0] },
])
const weekly = buildWeeklyReportTable(rows, clients, dateLabel)
const monthly = buildMonthlyReportTable(clients.map((c, i) => ({ id: c.id, name: rows[i * 3].name, items: [
  { accountId: `123-456-${String(i).padStart(4, '0')}`, platform: 'Google Ads', budget: 2640, spend: 440, refunded: 0, paidWith: "Client's CC" },
  { accountId: `987-654-${String(i).padStart(4, '0')}`, platform: 'Google Guarantee', budget: 300, spend: 400, refunded: 40, paidWith: 'XMS CC' },
  { accountId: c.id, platform: 'OpenAI Ads', budget: 25, budgetPeriod: 'daily', spend: 0, refunded: 0, paidWith: '' },
] })))

function pageText(doc: ReturnType<typeof renderBudgetTablePdf>) {
  // jsPDF's type says number[]; its runtime stores one command array per page.
  return (doc.internal.pages as unknown as string[][]).slice(1).map(page => page.join('\n'))
}

describe('Unified report PDF data', () => {
  it('shares actual weekly spend for all platforms with the dashboard and removes Spend and Remaining columns', () => {
    expect(weekly.headers).toEqual(WEEKLY_HEADERS)
    expect(weekly.groups).toHaveLength(18)
    expect(weekly.groups[0].rows.map(r => r.cells[2])).toEqual(['Google Ads', 'Google Guarantee', 'OpenAI Ads'])
    expect(weekly.groups[0].name).toBe(rows[0].name)
    expect(weekly.groups[0].rows[0].cells).toEqual(['', 'ads-0', 'Google Ads', '$2,640.00', '$100.00', '$150.00', '$90.00', '$100.00', '$0.00'])
    expect(weekly.groups[0].rows[1].cells).toEqual(['', 'lsa-0', 'Google Guarantee', '$300.00', '$80.00', '$120.00', '$150.00', '$50.00', '$0.00'])
    expect(weekly.headers).not.toContain('Spend')
    expect(weekly.headers).not.toContain('Remaining')
    expect(weekly.totals).toEqual([])
    const html = renderToStaticMarkup(<WeeklyGroupedTable table={weekly} />)
    for (const row of [...weekly.groups.flatMap(g => g.rows), ...weekly.totals]) {
      for (const cell of row.cells) expect(html).toContain(String(cell))
    }
  })
  it('matches Monthly columns and blanks, retaining credits and payment methods without a Status column', () => {
    expect(monthly.headers).toEqual(MONTHLY_HEADERS)
    expect(monthly.headers).not.toContain('Status')
    expect(monthly.groups[0].rows[1].cells.slice(5)).toEqual(['$40.00', 'XMS CC'])
    expect(monthly.groups[0].rows[2].cells).toEqual(['', '—', 'OpenAI Ads', '$25.00/day', '$0.00', '—', '—'])
    expect(monthly.summary).toContainEqual({ label: 'Expected credits refunded', value: '$720.00' })
    expect(monthly.summary).toContainEqual({ label: 'Google monthly budgets', value: '$52,920.00' })
    expect(monthly.summary).toContainEqual({ label: 'OpenAI daily budget', value: '$450.00' })
  })
  it('keeps unavailable spend explicit without adding a total row', () => {
    const table = buildWeeklyReportTable([
      { ...rows[0], spend: null, weeklySpend: undefined }, { ...rows[2], budgetPeriod: 'daily' }, { ...rows[2], campaign: 'Lifetime campaign', budgetPeriod: 'lifetime' },
    ], clients, dateLabel)
    expect(table.groups[0].rows[0].cells[4]).toBe('Unavailable')
    expect(table.totals).toEqual([])
    expect(table.summary.find(s => s.label.startsWith('Period spend'))?.value).toBe('Unavailable')
  })
})

describe('Unified PDF pagination and exports', () => {
  it.each([true, false])('repeats all table headers and period on every page (weekly=%s)', async isWeekly => {
    const table = isWeekly ? weekly : monthly
    const period = isWeekly ? dateLabel : monthLabel
    const doc = renderBudgetTablePdf({ table, title: isWeekly ? 'Weekly Budget Report' : 'Monthly Budget Report', period, weekly: isWeekly })
    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(isWeekly ? 420 : 297, 0)
    const pages = pageText(doc)
    for (const page of pages) {
      expect(page).toContain('(Platform)')
      if (!isWeekly) {
        expect(page).toContain('(Client)')
        expect(page).toContain('(Paid With)')
      } else {
        expect(page).toContain('(Client)')
        expect(page).toContain('(ID)')
        expect(page).toContain('(Budget)')
        expect(page).toContain('(Week 1)')
        expect(page).toContain('(Week 2)')
        expect(page).toContain('(Week 5)')
      }
      expect(page).toContain('2026')
      expect(page).toContain('Page ')
    }
    const bytes = isWeekly ? await generateWeeklyBudgetPdfBytes({ dateLabel, table }) : await generateMonthlyBudgetPdfBytes({ monthLabel, table })
    expect(Buffer.from(bytes.bytes).subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.filename).toContain('2026')
    if (process.env.REPORT_PDF_QA_DIR) {
      mkdirSync(process.env.REPORT_PDF_QA_DIR, { recursive: true })
      writeFileSync(join(process.env.REPORT_PDF_QA_DIR, isWeekly ? 'weekly.pdf' : 'monthly.pdf'), bytes.bytes)
    }
  })
  it('continues an oversized client group without losing campaign rows or totals', () => {
    const many = Array.from({ length: 65 }, (_, i) => ({ ...rows[2], campaign: `Campaign ${i + 1}` }))
    const table = buildWeeklyReportTable(many, clients, dateLabel)
    const doc = renderBudgetTablePdf({ table, title: 'Weekly Budget Report', period: dateLabel, weekly: true })
    const pages = pageText(doc)
    expect(pages.length).toBeGreaterThan(2)
    expect(pages.slice(1).some(page => page.includes('continued'))).toBe(true)
    expect(pages[pages.length - 1]).not.toContain('(Total)')
    if (process.env.REPORT_PDF_QA_DIR) writeFileSync(join(process.env.REPORT_PDF_QA_DIR, 'weekly-continuation.pdf'), new Uint8Array(doc.output('arraybuffer')))
  })
  it('omits removed campaign detail and handles empty reports', () => {
    const table = buildWeeklyReportTable([{ ...rows[2], campaign: 'Long campaign name '.repeat(800) }], clients, dateLabel)
    const doc = renderBudgetTablePdf({ table, title: 'Weekly Budget Report', period: dateLabel, weekly: true })
    expect(doc.getNumberOfPages()).toBe(1)
    expect(pageText(doc).join()).not.toContain('Long campaign name')
    const empty = renderBudgetTablePdf({ table: buildMonthlyReportTable([]), title: 'Monthly Budget Report', period: monthLabel, weekly: false })
    expect(pageText(empty).join()).toContain('No accounts found.')
  })
})
