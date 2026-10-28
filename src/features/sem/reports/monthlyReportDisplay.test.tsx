import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MonthlyReport } from '@/pages/sem/SEMReportes'
import type { BudgetReportData } from './useBudgetReportData'
import type { useOpenAiBudgetReport } from './useOpenAiBudgetReport'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

describe('Holt monthly LSA display', () => {
  it('shows the linked integration budget and real spend at full opacity even while other accounts load', () => {
    const client = { id: 'holts-garage', status: 'active', sem_enabled: true, sem_account_id: '5028132994', lsa_account_id: '4101522507' }
    const ads = { id: '5028132994', name: 'Holt', status: 'ENABLED' }, lsa = { id: '4101522507', name: 'Holt LSA', status: 'ENABLED' }
    const report: BudgetReportData = {
      accounts: [ads, lsa], clients: [client], budgets: [{ account_id: ads.id, report_type: 'guarantee_monthly', budget: 10858 }],
      eligible: [{ account: ads, googleAds: true, googleGuarantee: false }, { account: lsa, googleAds: false, googleGuarantee: true }],
      metadataLoading: false, metadataErrors: [], loading: true, errors: [], retry: vi.fn(), startDate: '2026-10-01', endDate: '2026-10-31',
      stateFor: id => id === lsa.id ? { status: 'ready', data: { spend: 9558.56, daily: [], fetchedAt: '2026-10-28T22:00:00Z' } } : { status: 'loading' },
    }
    const openai: ReturnType<typeof useOpenAiBudgetReport> = { results: [], loading: false, error: null, retry: vi.fn() }
    const html = renderToStaticMarkup(<MonthlyReport report={report} openai={openai} year={2026} month={9} onChangePeriod={vi.fn()} />)
    const lsaRow = html.match(/<tr[^>]*>[^]*?Google Guarantee[^]*?<\/tr>/)?.[0]
    expect(lsaRow).toBeDefined()
    expect(lsaRow).toContain('$10,858.00')
    expect(lsaRow).toContain('$9,558.56')
    expect(html).not.toContain('aria-busy="true"')
    expect(html.match(/<tr[^>]*class="[^"]*opacity-40/g)).toBeNull()
    expect(html).toContain('Loading…')
  })
})
