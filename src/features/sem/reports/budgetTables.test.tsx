import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
import { GuaranteeReport, OpenAiAdsReport } from '@/pages/sem/SEMReportes'
const accounts = [{ id: 'lsa', name: 'Holt LSA', status: 'ENABLED' }]
describe('Weekly budget tables', () => {
  it('renders the selected LSA period, real zero metrics and 0% used without the annual cards', () => {
    const html = renderToStaticMarkup(<GuaranteeReport accounts={accounts} dateLabel="Oct 12 – Oct 18" budgets={{ lsa: { budget: 100 } }} loadingBudgets={false} period={{ lsa: { spend: 0, leads: 0 } }} loadingPeriod={false} />)
    expect(html).toContain('Oct 12 – Oct 18')
    expect(html).toContain('$0.00')
    expect(html).toContain('0.0%')
    expect(html).not.toContain('<select')
  })
  it('does not invent LSA metrics or totals when no response exists', () => {
    const html = renderToStaticMarkup(<GuaranteeReport accounts={accounts} dateLabel="Week" budgets={{ lsa: { budget: 100 } }} loadingBudgets={false} period={{}} loadingPeriod={false} />)
    expect(html).not.toContain('0.0%')
    expect(html).not.toContain('Totals')
    expect(html).toContain('disabled')
  })
  it('limits OpenAI metrics to Budget and Spend and displays zero spend', () => {
    const html = renderToStaticMarkup(<OpenAiAdsReport dateLabel="Week" loading={false} error={null} results={[{ clientId: 'holt', clientName: 'Holt', campaigns: [{ id: 'c', name: 'Campaign', status: 'active', budget: 30, budgetPeriod: 'daily', spend: 0, impressions: 100, clicks: 2, cpc: 4 }] }]} />)
    expect(html).toContain('$30.00/day')
    expect(html).toContain('$0.00')
    for (const metric of ['CPC', 'Clicks', 'Impressions', '>Status<']) expect(html).not.toContain(metric)
  })
})
