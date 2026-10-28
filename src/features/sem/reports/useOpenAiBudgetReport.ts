import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { reportRequest } from './reportLoading'
import { edgeFetch } from '@/lib/edgeFetch'
import type { ReportWeek } from './budgetReportData'

export interface OpenAiCampaign {
  id: string; name: string; status: string; budget: number; spend: number
  budgetPeriod?: 'daily' | 'lifetime'
  impressions: number; clicks: number; cpc: number
}
export interface OpenAiClientResult {
  clientId: string; clientName: string; campaigns: OpenAiCampaign[]
  error?: string; insightsError?: string | null
  pending?: boolean; weeklySpend?: (number | null)[]; weeklyPending?: boolean[]; weeklyErrors?: (string | null)[]
}

export function activeOpenAiCampaigns(result: OpenAiClientResult) {
  return result.campaigns.filter(c => ['active', 'enabled'].includes(c.status.trim().toLowerCase()))
}

export function summarizeOpenAiBudget(result: OpenAiClientResult) {
  if (result.error || result.pending) return { budget: null, budgetPeriod: undefined, spend: null }
  const campaigns = activeOpenAiCampaigns(result)
  if (!campaigns.length) return { budget: 0, budgetPeriod: undefined, spend: result.insightsError ? null : result.campaigns.reduce((sum, campaign) => sum + campaign.spend, 0) }
  const periods = new Set(campaigns.map(c => c.budgetPeriod))
  return {
    budget: periods.size === 1 ? campaigns.reduce((sum, c) => sum + c.budget, 0) : null,
    budgetPeriod: periods.size === 1 ? campaigns[0]?.budgetPeriod : undefined,
    spend: !result.insightsError ? result.campaigns.reduce((sum, c) => sum + c.spend, 0) : null,
  }
}

export function useOpenAiBudgetReport(from: string, to: string, weeks?: ReportWeek[]) {
  const [results, setResults] = useState<OpenAiClientResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const key = `${from}:${to}`
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [resultKey, setResultKey] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    async function load() {
      setLoading(true); setError(null); setResults([]); setResultKey(`${from}:${to}`)
      try {
        const secrets = await reportRequest(supabase.from('client_ad_secrets').select('client_id').eq('provider', 'openai_ads').abortSignal(controller.signal), 12000)
        if (secrets.error) throw secrets.error
        const ids = [...new Set((secrets.data ?? []).map(s => s.client_id))]
        if (!ids.length) return
        const clients = await reportRequest(supabase.from('clients').select('id, name').in('id', ids).eq('status', 'active').abortSignal(controller.signal), 12000)
        if (clients.error) throw clients.error
        if (!cancelled) setResults((clients.data ?? []).map(client => ({ clientId: client.id, clientName: client.name, campaigns: [], pending: true })))
        await Promise.all((clients.data ?? []).map(async (client): Promise<void> => {
          const identity = { clientId: client.id, clientName: client.name }
          try {
            const params = new URLSearchParams({ clientId: client.id, startDate: from, endDate: to })
            const bodyResult = await reportRequest((async () => {
              const res = await edgeFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-ads/campaigns?${params}`, { signal: controller.signal })
              const body = await res.json()
              if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`)
              if (!Array.isArray(body.campaigns)) throw new Error('Invalid campaigns response')
              return { ...identity, campaigns: [...new Map<string, OpenAiCampaign>(body.campaigns.map((c: OpenAiCampaign) => [c.id, c])).values()], insightsError: body.insightsError }
            })(), 25000)
            if (!cancelled) setResults(prev => prev.map(row => row.clientId === client.id ? { ...bodyResult, weeklySpend: weeks?.map(() => null), weeklyPending: weeks?.map(() => true) } : row))
            if (weeks) await Promise.all(weeks.map(async (week, index) => {
              let value: number | null = null, error: string | null = null
              try {
                if (week.from > toYmd(new Date())) value = 0
                else {
                  const params = new URLSearchParams({ clientId: client.id, startDate: week.from, endDate: week.to })
                  const body = await reportRequest((async () => {
                    const response = await edgeFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-ads/campaigns?${params}`, { signal: controller.signal })
                    const data = await response.json()
                    if (!response.ok || data.error || data.insightsError || !Array.isArray(data.campaigns)) throw new Error(data.error || data.insightsError || 'Invalid weekly spend response')
                    return data as { campaigns: OpenAiCampaign[] }
                  })(), 25000)
                  value = body.campaigns.reduce((sum, campaign) => sum + campaign.spend, 0)
                }
              } catch (e) { error = e instanceof Error ? e.message : String(e) }
              if (!cancelled) setResults(prev => prev.map(row => row.clientId === client.id ? {
                ...row, weeklySpend: weeks.map((_, i) => i === index ? value : row.weeklySpend?.[i] ?? null),
                weeklyPending: weeks.map((_, i) => i === index ? false : row.weeklyPending?.[i] ?? true),
                weeklyErrors: weeks.map((_, i) => i === index ? error : row.weeklyErrors?.[i] ?? null),
              } : row))
            }))
          } catch (e) { if (!cancelled) setResults(prev => prev.map(row => row.clientId === client.id ? { ...identity, campaigns: [], error: e instanceof Error ? e.message : String(e) } : row)) }
        }))
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) }
      finally { if (!cancelled) { setLoading(false); setLoadedKey(`${from}:${to}`); controller.abort() } }
    }
    void load()
    return () => { cancelled = true; controller.abort() }
  }, [from, to, weeks, revision])
  return { results: resultKey === key ? results : [], loading: loading || loadedKey !== key, error, retry: () => setRevision(value => value + 1) }
}

function toYmd(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
