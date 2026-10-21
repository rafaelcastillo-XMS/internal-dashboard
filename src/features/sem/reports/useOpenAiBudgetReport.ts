import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { reportRequest } from './reportLoading'
import { edgeFetch } from '@/lib/edgeFetch'

export interface OpenAiCampaign {
  id: string; name: string; status: string; budget: number; spend: number
  budgetPeriod?: 'daily' | 'lifetime'
  impressions: number; clicks: number; cpc: number
}
export interface OpenAiClientResult {
  clientId: string; clientName: string; campaigns: OpenAiCampaign[]
  error?: string; insightsError?: string | null
}

export function activeOpenAiCampaigns(result: OpenAiClientResult) {
  return result.campaigns.filter(c => ['active', 'enabled'].includes(c.status.trim().toLowerCase()))
}

export function summarizeOpenAiBudget(result: OpenAiClientResult) {
  if (result.error) return { budget: null, budgetPeriod: undefined, spend: null }
  const campaigns = activeOpenAiCampaigns(result)
  if (!campaigns.length) return { budget: 0, budgetPeriod: undefined, spend: 0 }
  const periods = new Set(campaigns.map(c => c.budgetPeriod))
  return {
    budget: periods.size === 1 ? campaigns.reduce((sum, c) => sum + c.budget, 0) : null,
    budgetPeriod: periods.size === 1 ? campaigns[0]?.budgetPeriod : undefined,
    spend: !result.insightsError ? campaigns.reduce((sum, c) => sum + c.spend, 0) : null,
  }
}

export function useOpenAiBudgetReport(from: string, to: string) {
  const [results, setResults] = useState<OpenAiClientResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const key = `${from}:${to}`
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    async function load() {
      setLoading(true); setError(null); setResults([])
      try {
        const secrets = await reportRequest(supabase.from('client_ad_secrets').select('client_id').eq('provider', 'openai_ads').abortSignal(controller.signal))
        if (secrets.error) throw secrets.error
        const ids = [...new Set((secrets.data ?? []).map(s => s.client_id))]
        if (!ids.length) return
        const clients = await reportRequest(supabase.from('clients').select('id, name').in('id', ids).eq('status', 'active').abortSignal(controller.signal))
        if (clients.error) throw clients.error
        const next = await Promise.all((clients.data ?? []).map(async (client): Promise<OpenAiClientResult> => {
          const identity = { clientId: client.id, clientName: client.name }
          try {
            const params = new URLSearchParams({ clientId: client.id, startDate: from, endDate: to })
            const bodyResult = await reportRequest((async () => {
              const res = await edgeFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-ads/campaigns?${params}`, { signal: controller.signal })
              const body = await res.json()
              if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`)
              if (!Array.isArray(body.campaigns)) throw new Error('Invalid campaigns response')
              return { ...identity, campaigns: [...new Map<string, OpenAiCampaign>(body.campaigns.map((c: OpenAiCampaign) => [c.id, c])).values()], insightsError: body.insightsError }
            })())
            return bodyResult
          } catch (e) { return { ...identity, campaigns: [], error: e instanceof Error ? e.message : String(e) } }
        }))
        if (!cancelled) setResults(next)
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) }
      finally { if (!cancelled) { setLoading(false); setLoadedKey(`${from}:${to}`); controller.abort() } }
    }
    void load()
    return () => { cancelled = true; controller.abort() }
  }, [from, to])
  return { results, loading: loading || loadedKey !== key, error }
}
