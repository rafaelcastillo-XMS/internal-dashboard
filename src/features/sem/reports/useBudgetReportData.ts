import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { reportRequest } from './reportLoading'
import { selectMonthlyBudgetAccounts, type MonthlyBudgetClient } from './monthlyBudgetAccounts'
import { mapReportRequests, spendKey, ymd, type ReportAccount, type ReportBudget, type ReportSpend, type SpendState } from './budgetReportData'

export function useBudgetReportData(year: number, month: number) {
  const [accounts, setAccounts] = useState<ReportAccount[]>([])
  const [clients, setClients] = useState<MonthlyBudgetClient[]>([])
  const [budgets, setBudgets] = useState<ReportBudget[]>([])
  const [adsIds, setAdsIds] = useState(new Set<string>())
  const [lsaIds, setLsaIds] = useState(new Set<string>())
  const [metadataLoading, setMetadataLoading] = useState(true)
  const [metadataErrors, setMetadataErrors] = useState<string[]>([])
  const [spend, setSpend] = useState<Record<string, SpendState>>({})
  const [loadedRange, setLoadedRange] = useState('')
  const [revision, setRevision] = useState(0)
  const cache = useRef(new Map<string, ReportSpend>())
  const startDate = ymd(new Date(year, month, 1))
  const endDate = ymd(new Date(year, month + 1, 0))
  const range = `${startDate}:${endDate}`

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    setMetadataLoading(true); setMetadataErrors([])
    const read = async <T,>(request: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, source: string, save: (rows: T[]) => void) => {
      try {
        const result = await reportRequest(request, 12000)
        if (result.error) throw new Error(result.error.message)
        if (!cancelled) save(result.data ?? [])
      } catch (error) {
        if (!cancelled) setMetadataErrors(prev => [...prev, `${source}: ${error instanceof Error ? error.message : String(error)}`])
      }
    }
    void Promise.all([
      read(supabase.from('sem_accounts').select('id, name, status').order('name').abortSignal(controller.signal), 'Accounts', setAccounts),
      read(supabase.from('clients').select('id, status, sem_account_id, lsa_account_id, sem_enabled').abortSignal(controller.signal), 'Clients', setClients),
      read(supabase.from('sem_report_budgets').select('account_id, report_type, budget').in('report_type', ['ads_monthly', 'guarantee_monthly']).abortSignal(controller.signal), 'Budgets', setBudgets),
      read(supabase.from('sem_yearly_ads').select('account_id').eq('year', year).abortSignal(controller.signal), 'Ads accounts', rows => setAdsIds(new Set(rows.map(r => r.account_id)))),
      read(supabase.from('sem_yearly_guarantee').select('account_id').eq('year', year).abortSignal(controller.signal), 'LSA accounts', rows => setLsaIds(new Set(rows.map(r => r.account_id)))),
    ]).finally(() => { if (!cancelled) { setMetadataLoading(false); controller.abort() } })
    return () => { cancelled = true; controller.abort() }
  }, [year, revision])

  const eligible = useMemo(() => selectMonthlyBudgetAccounts(accounts, clients, adsIds, lsaIds), [accounts, clients, adsIds, lsaIds])

  useEffect(() => {
    if (metadataLoading) return
    const controller = new AbortController()
    let cancelled = false
    const jobs = eligible.flatMap(({ account, googleAds, googleGuarantee }) => [
      ...(googleAds ? [{ accountId: account.id, platform: 'ads' }] : []),
      ...(googleGuarantee ? [{ accountId: account.id, platform: 'guarantee' }] : []),
    ])
    const next: Record<string, SpendState> = {}
    for (const job of jobs) {
      const cached = cache.current.get(`${range}:${spendKey(job.accountId, job.platform)}`)
      next[spendKey(job.accountId, job.platform)] = cached && Date.now() - Date.parse(cached.fetchedAt) < 120000 && !revision
        ? { status: 'ready', data: cached } : { status: 'loading' }
    }
    setSpend(next); setLoadedRange(range)
    void mapReportRequests(jobs, 4, async job => {
      const key = spendKey(job.accountId, job.platform)
      if (next[key].status === 'ready' || cancelled) return
      try {
        const params = new URLSearchParams({ ...job, startDate, endDate, ...(revision ? { refresh: '1' } : {}) })
        const data = await reportRequest((async () => {
          const response = await fetch(`/api/sem/budget-report?${params}`, { signal: controller.signal })
          const body = await response.json()
          if (!response.ok || body.error) throw new Error(body.error || `Spend request failed (${response.status})`)
          if (!Number.isFinite(body.spend) || !Array.isArray(body.daily) || !body.fetchedAt) throw new Error('Invalid spend response')
          return body as ReportSpend
        })(), 25000)
        if (!cancelled) {
          cache.current.set(`${range}:${key}`, data)
          setSpend(prev => ({ ...prev, [key]: { status: 'ready', data } }))
        }
      } catch (error) {
        if (!cancelled) setSpend(prev => ({ ...prev, [key]: { status: 'error', error: error instanceof Error ? error.message : String(error) } }))
      }
    }).finally(() => controller.abort())
    return () => { cancelled = true; controller.abort() }
  }, [eligible, metadataLoading, startDate, endDate, range, revision])

  const stateFor = (id: string, platform: string): SpendState => loadedRange === range ? spend[spendKey(id, platform)] ?? { status: 'loading' } : { status: 'loading' }
  const loading = metadataLoading || loadedRange !== range || Object.values(spend).some(state => state.status === 'loading')
  const errors = [...metadataErrors, ...Object.entries(spend).filter(([, state]) => state.status === 'error').map(([key, state]) => `${accounts.find(a => key.startsWith(`${a.id}:`))?.name || key}: ${state.error}`)]
  const retry = useCallback(() => { cache.current.clear(); setRevision(value => value + 1) }, [])
  return { accounts, clients, budgets, eligible, metadataLoading, metadataErrors, loading, errors, stateFor, retry, startDate, endDate }
}

export type BudgetReportData = ReturnType<typeof useBudgetReportData>
