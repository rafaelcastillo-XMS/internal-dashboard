import { describe, expect, it, vi } from 'vitest'
import type { Report } from './types'
import { monthlyReportRowToReport, reportToMonthlyReportRow } from './storage'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const report: Report = {
  id: '2786993252-july-2026-1',
  clientId: '2786993252',
  clientName: 'All Star Sunrooms',
  clientLogo: 'https://example.com/logo.png',
  month: 'July',
  year: 2026,
  status: 'Draft',
  slides: [
    { id: 'cover', type: 'cover', title: 'Cover', order: 2, notes: '', content: { subtitle: 'July 2026' } },
    { id: 'custom', type: 'custom', title: 'New Slide', order: 3, notes: '', content: { customHtml: '<strong>Saved</strong>' } },
  ],
  createdAt: '2026-07-01T12:00:00.000Z',
  updatedAt: '2026-07-22T12:00:00.000Z',
}

describe('monthly report Supabase mapping', () => {
  it('maps the complete editable report to the database row', () => {
    expect(reportToMonthlyReportRow(report)).toMatchObject({
      id: report.id,
      account_id: report.clientId,
      client_name: report.clientName,
      client_logo: report.clientLogo,
      month: 'July',
      year: 2026,
      status: 'Draft',
      slides: [
        { id: 'cover', order: 1 },
        { id: 'custom', order: 2, content: { customHtml: '<strong>Saved</strong>' } },
      ],
    })
  })

  it('restores a Supabase row as a normalized editable report', () => {
    const restored = monthlyReportRowToReport({
      id: report.id,
      account_id: report.clientId,
      client_name: report.clientName,
      client_logo: report.clientLogo,
      month: report.month,
      year: report.year,
      status: report.status,
      slides: report.slides,
      created_at: report.createdAt,
      updated_at: report.updatedAt,
    })

    expect(restored).toMatchObject({
      id: report.id,
      clientId: '2786993252',
      clientName: 'All Star Sunrooms',
      slides: [
        { id: 'cover', order: 1 },
        { id: 'custom', order: 2, content: { customHtml: '<strong>Saved</strong>' } },
      ],
      updatedAt: report.updatedAt,
    })
  })
})
