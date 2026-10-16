import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
import { summarizeOpenAiBudget, type OpenAiClientResult } from './useOpenAiBudgetReport'
const base: OpenAiClientResult = { clientId: 'holt', clientName: 'Holt', campaigns: [] }
const campaign = { id: 'c1', name: 'Campaign', status: 'active', budget: 10, spend: 0, impressions: 0, clicks: 0, cpc: 0, budgetPeriod: 'daily' as const }
describe('OpenAI budget reporting', () => {
  it('keeps missing data distinct from real zero spend', () => {
    expect(summarizeOpenAiBudget(base)).toMatchObject({ budget: null, spend: null })
    expect(summarizeOpenAiBudget({ ...base, campaigns: [campaign] })).toMatchObject({ budget: 10, budgetPeriod: 'daily', spend: 0 })
  })
  it('does not turn failed insights into zero spend', () => {
    expect(summarizeOpenAiBudget({ ...base, campaigns: [campaign], insightsError: 'Unavailable' })).toMatchObject({ budget: 10, spend: null })
  })
  it('does not add daily and lifetime budgets together', () => {
    expect(summarizeOpenAiBudget({ ...base, campaigns: [campaign, { ...campaign, id: 'c2', budgetPeriod: 'lifetime' }] })).toMatchObject({ budget: null, spend: 0 })
  })
})
