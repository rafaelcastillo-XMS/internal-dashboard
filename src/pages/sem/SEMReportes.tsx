import { useState, useEffect, useMemo, Fragment } from 'react'
import { Download, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { edgeFetch } from '@/lib/edgeFetch'
import { generateMonthlyBudgetPdf, generateMonthlyBudgetPdfBytes, generateOpenAiAdsPdf, generateWeeklyBudgetPdf, generateWeeklyBudgetPdfBytes } from '@/features/sem/lib/generateReportsPdf'
import type { PdfMonthlyRow, PdfOpenAiRow, PdfWeeklyRow } from '@/features/sem/lib/generateReportsPdf'
import { captureTableAsImage } from '@/features/sem/lib/tableToImage'
import { selectMonthlyBudgetAccounts, type MonthlyBudgetClient } from '@/features/sem/reports/monthlyBudgetAccounts'

import { useOpenAiBudgetReport, summarizeOpenAiBudget, type OpenAiClientResult } from '@/features/sem/reports/useOpenAiBudgetReport'

import { buildWeeklyReportTable, buildMonthlyReportTable } from '@/features/sem/reports/budgetReportTables'
import { WeeklyGroupedTable, type WeeklyDisplayRow } from '@/features/sem/reports/WeeklyGroupedTable'
import { groupBudgetRows } from '@/features/sem/reports/groupBudgetRows'
import { reportRequest } from '@/features/sem/reports/reportLoading'
import { BudgetTableSkeleton } from '@/features/sem/reports/BudgetTableSkeleton'
import { MONTHLY_HEADERS, WEEKLY_HEADERS, LSA_HEADERS, OPENAI_HEADERS } from '@/features/sem/reports/reportTableHeaders'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdsAccount { id: string; name: string; status: string }

interface BudgetRow { budget: number }

type BudgetStore = Record<string, BudgetRow>

// ─── Storage ──────────────────────────────────────────────────────────────────

async function fetchSupabaseBudgets(reportType: string): Promise<Record<string, number>> {
  const { data, error } = await reportRequest(supabase
    .from('sem_report_budgets')
    .select('account_id, budget')
    .eq('report_type', reportType))
  if (error) throw error
  const map: Record<string, number> = {}
  for (const r of data ?? []) map[r.account_id] = Number(r.budget)
  return map
}

// ─── Date range helpers ───────────────────────────────────────────────────────

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Weeks run Monday – Sunday
function getCurrentWeekRange(): { from: string; to: string } {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { from: toYMD(start), to: toYMD(end) }
}

function shiftWeek(from: string, days: number): { from: string; to: string } {
  const start = new Date(from + 'T00:00:00')
  start.setDate(start.getDate() + days)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { from: toYMD(start), to: toYMD(end) }
}

const fmtWeekDay = (ymd: string) =>
  new Date(ymd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const weekLabel = (from: string, to: string) =>
  `${fmtWeekDay(from)} – ${fmtWeekDay(to)}, ${new Date(to + 'T00:00:00').getFullYear()}`

// Weeks of the calendar grid for a given month (each week runs Monday – Sunday)
function monthWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1)
  const d = new Date(first)
  d.setDate(1 - ((first.getDay() + 6) % 7))
  const weeks: Date[][] = []
  do {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) { week.push(new Date(d)); d.setDate(d.getDate() + 1) }
    weeks.push(week)
  } while (d.getMonth() === month && d.getFullYear() === year)
  return weeks
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtNum = (n: number, dec = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })


// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const active = status === 'ENABLED'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold
      ${active ? 'bg-meta-3/10 text-meta-3' : 'bg-stroke/50 text-body dark:text-bodydark'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-meta-3' : 'bg-body'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

const parseCurrency = (v: string) => parseFloat(v.replace(/[$,]/g, '')) || 0

// ─── EditableCell ─────────────────────────────────────────────────────────────

function EditableCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  const start = () => { setRaw(value === 0 ? '' : value.toFixed(2)); setEditing(true) }
  const commit = (r: string) => { onChange(parseCurrency(r)); setEditing(false) }

  if (editing) return (
    <input autoFocus type="text" value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') commit(raw) }}
      className="w-24 rounded border border-[#16a34a] bg-white px-2 py-1 text-xs tabular-nums outline-none dark:bg-boxdark dark:text-[#E2E5E9]"
    />
  )
  return (
    <button onClick={start} title="Click to edit"
      className="group flex items-center gap-1 rounded px-1 py-0.5 text-left tabular-nums hover:bg-[#16a34a]/10 transition-colors text-xs font-medium text-black dark:text-[#E2E5E9]"
    >
      {value > 0
        ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : <span className="text-body dark:text-bodydark opacity-40">—</span>
      }
      <svg className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 text-[#16a34a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </button>
  )
}

// ─── WeekPicker ───────────────────────────────────────────────────────────────

function WeekPicker({
  from, to, onChange, accentColor = '#16a34a',
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  accentColor?: string
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => {
    const d = new Date(from + 'T00:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const isCurrentWeek = getCurrentWeekRange().from === from
  const todayYMD = toYMD(new Date())
  const move = (days: number) => { const r = shiftWeek(from, days); onChange(r.from, r.to) }
  const openCalendar = () => {
    const d = new Date(from + 'T00:00:00')
    setView({ year: d.getFullYear(), month: d.getMonth() })
    setOpen(o => !o)
  }
  const moveView = (delta: number) => setView(v => {
    const d = new Date(v.year, v.month + delta, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <svg className="h-4 w-4 shrink-0" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
      <span className="text-xs text-body dark:text-bodydark">Week</span>
      <div className="flex h-9 items-center gap-1 rounded-lg border border-stroke bg-white px-1 dark:border-strokedark dark:bg-boxdark">
        <button onClick={() => move(-7)} aria-label="Previous week"
          className="rounded-md p-1 text-body transition-colors hover:bg-gray-2 hover:text-black dark:text-bodydark dark:hover:bg-meta-4 dark:hover:text-white">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button onClick={openCalendar}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium tabular-nums text-black transition-colors hover:bg-gray-2 dark:text-[#E2E5E9] dark:hover:bg-meta-4">
          {weekLabel(from, to)}
          <svg className={`h-3 w-3 text-body transition-transform dark:text-bodydark ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        <button onClick={() => move(7)} disabled={isCurrentWeek} aria-label="Next week"
          className="rounded-md p-1 text-body transition-colors hover:bg-gray-2 hover:text-black disabled:cursor-not-allowed disabled:opacity-30 dark:text-bodydark dark:hover:bg-meta-4 dark:hover:text-white">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
      {!isCurrentWeek && (
        <button onClick={() => { const r = getCurrentWeekRange(); onChange(r.from, r.to) }}
          className="text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: accentColor }}>
          Current week
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-stroke bg-white p-3 shadow-2xl dark:border-strokedark dark:bg-boxdark">
            <div className="mb-2 flex items-center justify-between">
              <button onClick={() => moveView(-1)} aria-label="Previous month"
                className="rounded-md p-1 text-body transition-colors hover:bg-gray-2 hover:text-black dark:text-bodydark dark:hover:bg-meta-4 dark:hover:text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-black dark:text-[#E2E5E9]">
                {MONTH_NAMES[view.month]} {view.year}
              </span>
              <button onClick={() => moveView(1)} aria-label="Next month"
                className="rounded-md p-1 text-body transition-colors hover:bg-gray-2 hover:text-black dark:text-bodydark dark:hover:bg-meta-4 dark:hover:text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
            <div className="mb-1 flex px-1">
              {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
                <span key={d} className="flex-1 text-center text-[10px] font-semibold uppercase text-body dark:text-bodydark">{d}</span>
              ))}
            </div>
            <div className="space-y-0.5">
              {monthWeeks(view.year, view.month).map(week => {
                const wkFrom    = toYMD(week[0])
                const selected  = wkFrom === from
                const future    = wkFrom > todayYMD
                return (
                  <button key={wkFrom} disabled={future}
                    onClick={() => { onChange(wkFrom, toYMD(week[6])); setOpen(false) }}
                    className={`flex w-full rounded-lg px-1 transition-colors
                      ${selected ? 'text-white' : 'hover:bg-gray-2 dark:hover:bg-meta-4'}
                      disabled:cursor-not-allowed disabled:opacity-30`}
                    style={selected ? { backgroundColor: accentColor } : undefined}
                    title={`Week ${weekLabel(wkFrom, toYMD(week[6]))}`}
                  >
                    {week.map(d => (
                      <span key={d.getDate() + '-' + d.getMonth()}
                        className={`flex-1 py-1.5 text-center text-xs tabular-nums
                          ${selected ? '' : d.getMonth() !== view.month ? 'text-body/40 dark:text-bodydark/40' : 'text-black dark:text-[#E2E5E9]'}
                          ${!selected && toYMD(d) === todayYMD ? 'font-bold' : ''}`}
                      >
                        {d.getDate()}
                      </span>
                    ))}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 border-t border-stroke pt-2 text-center text-[10px] text-body dark:border-strokedark dark:text-bodydark">
              Click a row to select that week (Mon – Sun)
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Weekly / Monthly period tabs ─────────────────────────────────────────────

type ReportPeriod = 'weekly' | 'monthly'

// ─── Monthly Report (by client) ───────────────────────────────────────────────

const PAYMENT_SOURCES = ["Client's CC", 'XMS CC'] as const

type MonthlyPlatform = 'Google Ads' | 'Google Guarantee' | 'OpenAI Ads'
interface MonthlyItem { platform: MonthlyPlatform; budget: number | null; spend: number | null; budgetPeriod?: 'daily' | 'lifetime'; clientId?: string; note?: string }

interface MonthlyCell { refunded: number; paid_with: string }

const fmtAccountId = (id: string) =>
  /^\d{10}$/.test(id) ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id

function MonthlyReport({ accounts, clients, accentColor = '#16a34a' }: { accounts: AdsAccount[]; clients: MonthlyBudgetClient[]; accentColor?: string }) {
  const now = new Date()
  const [month, setMonth]         = useState(now.getMonth())
  const [year, setYear]           = useState(now.getFullYear())
  const [adsIds, setAdsIds]       = useState<Set<string>>(new Set())
  const [ggIds, setGgIds]         = useState<Set<string>>(new Set())
  const [adsSpend, setAdsSpend]   = useState<Record<string, number>>({})
  const [ggSpend, setGgSpend]     = useState<Record<string, number>>({})
  const [adsBudget, setAdsBudget] = useState<Record<string, number>>({})
  const [ggBudget, setGgBudget]   = useState<Record<string, number>>({})
  const [cells, setCells]         = useState<Record<string, MonthlyCell>>({})
  const [loading, setLoading]     = useState(true)
  const [exporting, setExporting] = useState(false)
  const [preparingEmail, setPreparingEmail] = useState(false)
  const [emailPayload, setEmailPayload] = useState<EmailReportPayload | null>(null)

  const [loadingSpend, setLoadingSpend] = useState(false)
  const [spendErrors, setSpendErrors] = useState<string[]>([])
  const selectedAccounts = useMemo(() => selectMonthlyBudgetAccounts(accounts, clients, adsIds, ggIds), [accounts, clients, adsIds, ggIds])

  const openai = useOpenAiBudgetReport(toYMD(new Date(year, month, 1)), toYMD(new Date(year, month + 1, 0)))

  const [budgetReady, setBudgetReady] = useState(false)
  const [yearReady, setYearReady] = useState<number | null>(null)
  const [cellsReady, setCellsReady] = useState('')
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>({})
  const reportMetadataError = (source: string, error: unknown) => setMetadataErrors(prev => ({ ...prev, [source]: error instanceof Error ? error.message : String(error) }))

  useEffect(() => {
    let cancelled = false
    reportRequest(supabase.from('sem_report_budgets').select('account_id, report_type, budget').in('report_type', ['ads_monthly', 'guarantee_monthly']))
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        if (cancelled) return
        const a: Record<string, number> = {}, g: Record<string, number> = {}
        for (const r of data ?? []) (r.report_type === 'ads_monthly' ? a : g)[r.account_id] = Number(r.budget)
        setAdsBudget(a); setGgBudget(g)
      }).catch(error => { if (!cancelled) reportMetadataError('Budgets', error) })
      .finally(() => { if (!cancelled) setBudgetReady(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setMetadataErrors(prev => ({ ...prev, Accounts: '' }))
    Promise.allSettled([
      reportRequest(supabase.from('sem_yearly_ads').select('account_id').eq('year', year)),
      reportRequest(supabase.from('sem_yearly_guarantee').select('account_id').eq('year', year)),
    ]).then(results => {
      if (cancelled) return
      results.forEach((result, index) => {
        const response = result.status === 'fulfilled' ? result.value : null
        if (result.status === 'rejected' || response?.error) reportMetadataError('Accounts', result.status === 'rejected' ? result.reason : new Error(response!.error!.message))
        ;(index === 0 ? setAdsIds : setGgIds)(new Set((response?.data ?? []).map(r => r.account_id)))
      })
      setYearReady(year)
    })
    return () => { cancelled = true }
  }, [year])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setCells({})
    setMetadataErrors(prev => ({ ...prev, Payments: '' }))
    reportRequest(supabase.from('sem_monthly_cells').select('account_id, platform, refunded, paid_with').eq('year', year).eq('month_index', month))
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        if (cancelled) return
        const next: Record<string, MonthlyCell> = {}
        for (const row of data ?? []) next[`${row.account_id}:${row.platform}`] = { refunded: Number(row.refunded), paid_with: row.paid_with ?? '' }
        setCells(next)
      }).catch(error => { if (!cancelled) reportMetadataError('Payments', error) })
      .finally(() => { if (!cancelled) { setLoading(false); setCellsReady(`${year}:${month}`) } })
    return () => { cancelled = true }
  }, [year, month])

  const [spendReady, setSpendReady] = useState('')
  const spendKey = `${year}:${month}:${selectedAccounts.map(r => `${r.account.id}-${r.googleAds}-${r.googleGuarantee}`).join(',')}`
  const reportLoading = loading || !budgetReady || yearReady !== year || cellsReady !== `${year}:${month}` || loadingSpend || spendReady !== spendKey || openai.loading

  // Annual import tables are not a current spend source. Query each platform
  // for the selected calendar month; cancellation prevents stale-month results.
  useEffect(() => {
    if (yearReady !== year) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)
    let cancelled = false
    setAdsSpend({}); setGgSpend({}); setSpendErrors([]); setLoadingSpend(true)
    const requests = selectedAccounts.flatMap(({ account, googleAds, googleGuarantee }) => [
      ...(googleAds ? [{ account, platform: 'ads' }] : []),
      ...(googleGuarantee ? [{ account, platform: 'guarantee' }] : []),
    ])
    async function load() {
      for (let i = 0; i < requests.length && !cancelled; i += 3) {
        await Promise.all(requests.slice(i, i + 3).map(async ({ account, platform }) => {
          try {
            const params = new URLSearchParams({ accountId: account.id, platform, startDate: toYMD(new Date(year, month, 1)), endDate: toYMD(new Date(year, month + 1, 0)) })
            const response = await edgeFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sem/budget-spend?${params}`, { signal: controller.signal })
            const body = await response.json()
            if (!response.ok || body.error) throw new Error(body.error ?? `HTTP ${response.status}`)
            if (!Number.isFinite(body.spend)) throw new Error('Invalid spend response')
            if (!cancelled) (platform === 'ads' ? setAdsSpend : setGgSpend)(prev => ({ ...prev, [account.id]: body.spend }))
          } catch (error) {
            if (!cancelled) setSpendErrors(prev => [...prev, `${account.name} (${platform}): ${error instanceof Error ? error.message : String(error)}`])
          }
        }))
      }
      if (!cancelled) { setLoadingSpend(false); setSpendReady(spendKey) }
      clearTimeout(timeout)
    }
    void load()
    return () => { cancelled = true; clearTimeout(timeout); controller.abort() }
  }, [selectedAccounts, year, month, yearReady, spendKey])

  const patchCell = (accountId: string, platform: MonthlyPlatform, patch: Partial<MonthlyCell>) => {
    const key = `${accountId}:${platform}`
    const current: MonthlyCell = cells[key] ?? { refunded: 0, paid_with: '' }
    const merged: MonthlyCell = { ...current, ...patch }
    setCells(prev => ({ ...prev, [key]: merged }))
    supabase.from('sem_monthly_cells')
      .upsert(
        { account_id: accountId, platform, year, month_index: month, refunded: merged.refunded, paid_with: merged.paid_with, updated_at: new Date().toISOString() },
        { onConflict: 'account_id,platform,year,month_index' },
      )
      .then(() => {})
  }

  // Use activation and explicit LSA mappings before building table/export rows.
  const accountGroups = selectedAccounts
    .map(({ account: acct, googleAds, googleGuarantee }) => {
      const items: MonthlyItem[] = []
      if (googleAds) items.push({ platform: 'Google Ads', budget: adsBudget[acct.id] ?? 0, spend: adsSpend[acct.id] ?? null })
      if (googleGuarantee) items.push({ platform: 'Google Guarantee', budget: ggBudget[acct.id] ?? 0, spend: ggSpend[acct.id] ?? null })
      return { acct, items }
    })
    .filter(g => g.items.length > 0)

  for (const result of openai.results) {
    const client = clients.find(c => c.id === result.clientId)
    const summary = summarizeOpenAiBudget(result)
    const item: MonthlyItem = { platform: 'OpenAI Ads', ...summary, clientId: result.clientId, note: summary.spend === null ? result.error ?? result.insightsError ?? undefined : undefined }
    const group = accountGroups.find(g => g.acct.id === client?.sem_account_id)
    if (group) group.items.push(item)
    else accountGroups.push({ acct: { id: result.clientId, name: result.clientName, status: 'ENABLED' }, items: [item] })
  }

  const groups = groupBudgetRows(accountGroups.flatMap(({ acct, items }) => items.map(item => ({ ...item, accountId: acct.id, name: acct.name, acct }))), clients)
    .map(group => ({ acct: { ...group.items[0].acct, name: group.name }, items: group.items }))

  const monthLabel = `${MONTH_NAMES[month]} ${year}`
  const buildMonthlyRows = (): PdfMonthlyRow[] =>
    groups.flatMap(({ acct, items }) => items.map(it => {
      const cell = cells[`${it.acct.id}:${it.platform}`]
      return {
        status: it.acct.status,
        accountName: acct.name,
        accountId: it.clientId ?? fmtAccountId(it.acct.id),
        budgetPeriod: it.budgetPeriod,
        platform: it.platform,
        budget: it.budget,
        spend: it.spend,
        refunded: cell?.refunded ?? 0,
        paidWith: cell?.paid_with ?? '',
      }
    }))

  const monthlyTable = buildMonthlyReportTable(groups.map(({ acct, items }) => ({
    id: acct.id, name: acct.name,
    items: items.map(it => ({ accountId: fmtAccountId(it.acct.id), platform: it.platform, budget: it.budget, budgetPeriod: it.budgetPeriod, spend: it.spend,
      refunded: cells[`${it.acct.id}:${it.platform}`]?.refunded ?? 0, paidWith: cells[`${it.acct.id}:${it.platform}`]?.paid_with ?? '' })),
  })))
  const monthlyExportBlocked = reportLoading || Object.values(metadataErrors).some(Boolean) || spendErrors.length > 0 || !!openai.error || openai.results.some(r => summarizeOpenAiBudget(r).spend === null)

  async function handleExportMonthly() {
    if (monthlyExportBlocked) return
    setExporting(true)
    try { await generateMonthlyBudgetPdf({ monthLabel, table: monthlyTable }) }
    finally { setExporting(false) }
  }

  async function handleOpenEmailModal() {
    if (monthlyExportBlocked) return
    setPreparingEmail(true)
    try {
      const rows = buildMonthlyRows()
      const emailRows = monthlyTable.groups.flatMap(group => group.rows.map((row, rowIndex) => ({
        cells: row.cells.map(String),
        background: rowIndex === 0 ? '#eef5ff' : '#ffffff',
      })))
      const [monthlyImage, pdf] = await Promise.all([
        captureTableAsImage({
          title: 'Monthly Budget Report',
          headers: monthlyTable.headers,
          rows: emailRows.map(row => row.cells),
          rowBackgrounds: emailRows.map(row => row.background),
        }),
        generateMonthlyBudgetPdfBytes({ monthLabel, table: monthlyTable }),
      ])
      setEmailPayload({
        kind: 'monthly',
        monthLabel,
        rows,
        images: [{ label: 'Monthly Budget Report', ...monthlyImage }],
        pdfBase64: uint8ToBase64(pdf.bytes),
        pdfFilename: pdf.filename,
      })
    } finally {
      setPreparingEmail(false)
    }
  }

  const selectCls = 'h-7 rounded-lg border border-stroke bg-white px-2 text-xs font-medium text-black outline-none dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]'

  return (
    <div>
      <SendEmailModal payload={emailPayload} onClose={() => setEmailPayload(null)} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <svg aria-hidden="true" className="h-4 w-4 shrink-0" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <label htmlFor="monthly-report-month" className="text-xs text-body dark:text-bodydark">Month</label>
          <select id="monthly-report-month" value={month} onChange={e => setMonth(Number(e.target.value))}
            className="h-9 rounded-lg border border-stroke bg-white px-3 text-sm font-medium outline-none dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
            {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="h-9 rounded-lg border border-stroke bg-white px-3 text-sm font-medium outline-none dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {loading && (
            <svg className="h-4 w-4 animate-spin" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleOpenEmailModal} disabled={preparingEmail || monthlyExportBlocked}
            className="flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black shadow-card
                       transition-colors hover:border-[#16a34a] hover:text-[#16a34a] disabled:opacity-60
                       dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
            <Mail className="h-4 w-4" />
            {preparingEmail ? 'Preparing…' : 'Send by Email'}
          </button>
          <button onClick={handleExportMonthly} disabled={exporting || monthlyExportBlocked}
            className="flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black shadow-card
                       transition-colors hover:border-[#16a34a] hover:text-[#16a34a] disabled:opacity-60
                       dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {Object.entries(metadataErrors).filter(([, error]) => error).map(([source, error]) => <p key={source} role="alert" className="mb-3 text-sm text-red-500">{source}: {error}</p>)}
      {spendErrors.length > 0 && <div role="alert" className="mb-3 text-sm text-red-500">{spendErrors.map(message => <p key={message}>{message}</p>)}</div>}
      {openai.results.filter(r => summarizeOpenAiBudget(r).spend === null).map(r => <p key={r.clientId} role="alert" className="mb-3 text-sm text-red-500">{r.clientName}: {r.error ?? r.insightsError}</p>)}
      {openai.error && <p role="alert" className="mb-3 text-sm text-red-500">{openai.error}</p>}
      {reportLoading ? <BudgetTableSkeleton /> : <div className="overflow-x-auto rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4">
              {MONTHLY_HEADERS.map((h, i) => (
                <th key={i} className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke dark:divide-strokedark">
            {groups.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-body dark:text-bodydark">
                  {loading ? 'Loading…' : 'No accounts with report data for this year.'}
                </td>
              </tr>
            )}
            {groups.map(({ acct, items }, groupIndex) => {
              return (
                <Fragment key={acct.id}>
                  {items.map((it, idx) => {
                    const display = monthlyTable.groups[groupIndex].rows[idx].cells
                    const cell = cells[`${it.acct.id}:${it.platform}`]
                    return (
                      <tr key={`${it.acct.id}:${it.platform}`} title={(it.budget ?? 0) > 0 ? it.note : `No ${it.platform} budget set for this client`}
                        className={`transition-opacity ${idx === 0 ? 'bg-[#eef5ff] hover:bg-[#e4efff] dark:bg-[#17233a] dark:hover:bg-[#20304d]' : 'hover:bg-gray-2 dark:hover:bg-meta-4'} ${(it.budget ?? 0) > 0 ? '' : 'opacity-40'}`}>
                        <td className="max-w-[220px] truncate px-5 py-4 font-semibold text-black dark:text-[#E2E5E9]" title={acct.name}>
                          {display[0]}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{display[1]}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-black dark:text-[#E2E5E9]">{it.platform}</td>
                        <td className="px-5 py-4 tabular-nums text-black dark:text-[#E2E5E9]">
                          {(it.budget ?? 0) > 0 ? display[3] : <span className="opacity-40 text-body dark:text-bodydark">—</span>}
                        </td>
                        <td className="px-5 py-4 tabular-nums font-semibold text-black dark:text-[#E2E5E9]">
                          {(it.platform === 'OpenAI Ads' ? openai.loading : loadingSpend)
                            ? <span className="text-xs italic font-normal text-body/50 dark:text-bodydark/50">Loading…</span>
                            : it.spend !== null ? display[4] : <span className="opacity-40 font-normal text-body dark:text-bodydark">—</span>}
                        </td>
                        <td className="px-5 py-4">{it.platform === 'OpenAI Ads' ? <span className="opacity-40">—</span> : <EditableCell value={cell?.refunded ?? 0} onChange={v => patchCell(it.acct.id, it.platform, { refunded: v })} />}</td>
                        <td className="px-5 py-4">
                          {it.platform === 'OpenAI Ads' ? <span className="opacity-40">—</span> : <select value={cell?.paid_with ?? ''} onChange={e => patchCell(it.acct.id, it.platform, { paid_with: e.target.value })} className={selectCls}>
                            <option value="">—</option>
                            {PAYMENT_SOURCES.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>}
      <p className="mt-3 text-[11px] text-body dark:text-bodydark">
        Spend is pulled directly from Google Ads / Google Guarantee for the selected month. Budget comes from the client integration cards (Monthly Report budgets). Expected credits refunded and “Paid With” are entered here per month.
      </p>
    </div>
  )
}

// ─── Send Email Modal ─────────────────────────────────────────────────────────

type EmailReportPayload =
  | {
      kind: 'weekly'
      dateLabel: string
      adsRows: PdfWeeklyRow[]
      guaranteeRows: PdfWeeklyRow[]
      openaiRows: PdfOpenAiRow[]
      images: { label: string; dataUrl: string; width: number; height: number }[]
      pdfBase64: string
      pdfFilename: string
    }
  | {
      kind: 'monthly'
      monthLabel: string
      rows: PdfMonthlyRow[]
      images: { label: string; dataUrl: string; width: number; height: number }[]
      pdfBase64: string
      pdfFilename: string
    }

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

// The wording adapts to the report period — "reporte mensual" for a whole
// month, "reporte semanal" for a date range — instead of one fixed sentence.
function buildEmailBodyTemplate(payload: EmailReportPayload): string {
  const intro = 'Hola team,'
  const closing = 'Los presupuestos están actualizados y se hicieron los ajustes en las cuentas que lo requerían. Más detalles en la Master List de SEM clients.'

  if (payload.kind === 'monthly') {
    return `${intro}\n\nLes comparto el reporte de presupuesto mensual correspondiente a ${payload.monthLabel}. ${closing}`
  }
  return `${intro}\n\nLes comparto el reporte de presupuesto semanal correspondiente al periodo ${payload.dateLabel}. ${closing}`
}

function buildEmailTitle(payload: EmailReportPayload): string {
  if (payload.kind === 'monthly') return `Reporte de Presupuesto Mensual — ${payload.monthLabel}`
  return `Reporte de Presupuesto Semanal — ${payload.dateLabel}`
}

function SendEmailModal({ payload, onClose }: { payload: EmailReportPayload | null; onClose: () => void }) {
  const [email, setEmail]         = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
  const [sent, setSent]           = useState(false)
  const [sending, setSending]     = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    setEmail(''); setSent(false); setSendError(null); setSending(false)
    if (payload) setBodyDraft(buildEmailBodyTemplate(payload))
  }, [payload])

  if (!payload) return null

  const label = payload.kind === 'monthly' ? payload.monthLabel : payload.dateLabel
  const subjectPrefix = payload.kind === 'monthly' ? 'Monthly Budget Report' : 'Weekly Budget Report'
  const subject = `${subjectPrefix} — ${label}`
  const attachedNote = payload.kind === 'monthly'
    ? 'Combined Google Ads + Google Guarantee + OpenAI Ads budget table (embedded as one image below the message) and the Monthly Budget PDF.'
    : `Combined Google Ads + Google Guarantee${payload.openaiRows.length > 0 ? ' + OpenAI Ads' : ''} budget table (embedded as one image below the message) and the Weekly Budget PDF.`

  const handleSend = async () => {
    setSending(true)
    setSendError(null)
    try {
      const { error } = await supabase.functions.invoke('send-report-email', {
        body: {
          to: email,
          subject,
          title: buildEmailTitle(payload),
          bodyText: bodyDraft,
          images: payload.images,
          pdfBase64: payload.pdfBase64,
          pdfFilename: payload.pdfFilename,
        },
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      // supabase-js collapses a non-2xx function response into a generic
      // FunctionsHttpError — the real `{error: "..."}` body from our
      // function lives on `error.context` (the raw Response), not `.message`.
      let message = err instanceof Error ? err.message : 'Failed to send email'
      const context = (err as { context?: Response })?.context
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json()
          if (body?.error) message = body.error
        } catch { /* not JSON — keep the generic message */ }
      }
      setSendError(message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-stroke bg-white p-6 shadow-2xl dark:border-strokedark dark:bg-boxdark">

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#16a34a]/10">
              <svg className="h-4.5 w-4.5 text-[#16a34a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-black dark:text-[#E2E5E9]">Send Report by Email</h2>
              <p className="text-[11px] text-body dark:text-bodydark">{label}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-body hover:bg-gray-2 hover:text-black dark:text-bodydark dark:hover:bg-meta-4 dark:hover:text-white transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {sent ? (
          <div className="rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] px-5 py-6 text-center dark:bg-[#14532d]/20 dark:border-[#16a34a]/30">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#16a34a]/15">
              <svg className="h-5 w-5 text-[#16a34a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#15803d] dark:text-[#4ade80]">Email sent</p>
            <p className="mt-1 text-xs text-body dark:text-bodydark">Sent to {email} from eva@xperienceusa.com.</p>
            <button onClick={onClose} className="mt-4 rounded-lg bg-[#16a34a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#15803d] transition-colors">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-black dark:text-[#E2E5E9]">Recipient Email <span className="text-red-400">*</span></label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@example.com"
                className="w-full rounded-lg border border-stroke bg-transparent px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-[#16a34a] dark:border-strokedark dark:text-[#E2E5E9] dark:focus:border-[#16a34a]" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-black dark:text-[#E2E5E9]">Message</label>
              <textarea value={bodyDraft} onChange={e => setBodyDraft(e.target.value)} rows={5}
                className="w-full resize-none rounded-lg border border-stroke bg-transparent px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-[#16a34a] dark:border-strokedark dark:text-[#E2E5E9] dark:focus:border-[#16a34a]" />
            </div>
            <div className="rounded-lg border border-stroke bg-gray-2 px-3.5 py-3 dark:border-strokedark dark:bg-meta-4">
              <p className="text-[11px] text-body dark:text-bodydark">
                <span className="font-semibold text-black dark:text-[#E2E5E9]">Attached:</span> {attachedNote}
              </p>
            </div>
            {sendError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">{sendError}</p>
            )}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-body hover:text-black dark:text-bodydark dark:hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSend} disabled={!email.includes('@') || sending}
                className="flex items-center gap-2 rounded-lg bg-[#16a34a] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#15803d] disabled:opacity-50 disabled:cursor-not-allowed">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                {sending ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Google Guarantee Report Tab ──────────────────────────────────────────────

export function GuaranteeReport({
  accounts, dateLabel, budgets, loadingBudgets, period, loadingPeriod,
}: {
  accounts: AdsAccount[]
  dateLabel: string
  budgets: BudgetStore
  loadingBudgets: boolean
  period: Record<string, { spend: number; leads: number }>
  loadingPeriod: boolean
}) {
  const ggBudgets = budgets
  const ggPeriod = period
  const [exporting, setExporting] = useState(false)

  const totalBudget = accounts.reduce((s, a) => s + (ggBudgets[a.id]?.budget ?? 0), 0)
  const totalSpend  = accounts.reduce((s, a) => s + (ggPeriod[a.id]?.spend ?? 0), 0)
  const totalLeads  = accounts.reduce((s, a) => s + (ggPeriod[a.id]?.leads ?? 0), 0)

  async function handleExport() {
    setExporting(true)
    try { await generateWeeklyBudgetPdf({ dateLabel, table: buildWeeklyReportTable(accounts.map(a => ({ accountId: a.id, name: a.name, status: a.status, platform: 'Google Guarantee', budget: ggBudgets[a.id]?.budget ?? 0, spend: ggPeriod[a.id]?.spend ?? null, leads: ggPeriod[a.id]?.leads })), [], dateLabel) }) }
    finally { setExporting(false) }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
        {loadingPeriod && (
          <svg className="h-4 w-4 animate-spin text-[#3b82f6]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        <button onClick={handleExport} disabled={exporting || loadingBudgets || loadingPeriod || accounts.some(a => !ggPeriod[a.id])}
          className="flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black shadow-card
                     transition-colors hover:border-[#3b82f6] hover:text-[#3b82f6] disabled:opacity-60
                     dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {loadingBudgets && <div className="flex items-center gap-2 py-4 text-sm text-body dark:text-bodydark"><svg className="h-4 w-4 animate-spin text-[#3b82f6]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Loading budgets…</div>}
      <div className="overflow-x-auto rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4">
              {LSA_HEADERS.map(h => (
                <th key={h} className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke dark:divide-strokedark">
            {accounts.length === 0 ? (
              <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-body dark:text-bodydark">No accounts found.</td></tr>
            ) : accounts.map(a => {
              const budget    = ggBudgets[a.id]?.budget ?? 0
              const period    = ggPeriod[a.id]
              const spend     = period?.spend ?? 0
              const leads     = period?.leads ?? 0
              const cpl       = leads > 0 ? spend / leads : 0
              const remaining = period && !loadingPeriod && budget > 0 ? budget - spend : null
              const pct       = period && !loadingPeriod && budget > 0 ? (spend / budget) * 100 : null
              const remNeg    = remaining !== null && remaining < 0
              return (
                <tr key={a.id} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                  <td className="px-5 py-4"><StatusBadge status={a.status} /></td>
                  <td className="max-w-[200px] truncate px-5 py-4 font-semibold text-black dark:text-[#E2E5E9]" title={a.name}>{a.name}</td>
                  <td className="px-5 py-4 tabular-nums text-black dark:text-[#E2E5E9]">
                    {budget > 0 ? fmtCurrency(budget) : <span className="opacity-40 text-body dark:text-bodydark">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-body dark:text-bodydark">{dateLabel}</td>
                  <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">
                    {loadingPeriod ? <span className="text-xs italic opacity-50">Loading…</span> : period ? fmtCurrency(spend) : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">
                    {loadingPeriod ? <span className="text-xs italic opacity-50">Loading…</span> : period ? fmtNum(leads) : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">
                    {!loadingPeriod && period && leads > 0 ? fmtCurrency(cpl) : <span className="opacity-40">—</span>}
                  </td>
                  <td className={`px-5 py-4 tabular-nums font-semibold ${remNeg ? 'text-red-500' : remaining !== null ? 'text-meta-3' : 'text-body dark:text-bodydark'}`}>
                    {remaining !== null ? fmtCurrency(remaining) : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    {pct !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-stroke dark:bg-strokedark">
                          <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-400' : 'bg-meta-3'}`}
                               style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className={`text-xs font-semibold tabular-nums ${pct > 90 ? 'text-red-500' : pct > 70 ? 'text-yellow-500' : 'text-meta-3'}`}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    ) : <span className="opacity-40 text-body dark:text-bodydark">—</span>}
                  </td>
                </tr>
              )
            })}
            {accounts.length > 0 && !loadingPeriod && accounts.every(a => ggPeriod[a.id]) && (
              <tr className="border-t-2 border-[#3b82f6]/30 bg-[#eff6ff] dark:bg-[#1e3a5f]/30">
                <td className="px-5 py-4" />
                <td className="px-5 py-4 text-xs font-bold uppercase text-[#3b82f6]">Totals</td>
                <td className="px-5 py-4 tabular-nums font-bold text-[#3b82f6]">{totalBudget > 0 ? fmtCurrency(totalBudget) : '—'}</td>
                <td className="px-5 py-4 text-xs">{dateLabel}</td>
                <td className="px-5 py-4 tabular-nums font-bold text-[#3b82f6]">{totalSpend > 0 ? fmtCurrency(totalSpend) : '—'}</td>
                <td className="px-5 py-4 tabular-nums font-bold text-[#3b82f6]">{totalLeads > 0 ? fmtNum(totalLeads) : '—'}</td>
                <td className="px-5 py-4 tabular-nums font-bold text-[#3b82f6]">{totalLeads > 0 ? fmtCurrency(totalSpend / totalLeads) : '—'}</td>
                <td className="px-5 py-4 tabular-nums font-bold text-[#3b82f6]">{totalBudget > 0 ? fmtCurrency(totalBudget - totalSpend) : '—'}</td>
                <td className="px-5 py-4 tabular-nums font-bold text-[#3b82f6]">
                  {totalBudget > 0 ? `${((totalSpend / totalBudget) * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


    </div>
  )
}

// ─── OpenAI Ads Tab ───────────────────────────────────────────────────────────

export function OpenAiAdsReport({
  dateLabel, results, loading, error,
}: {
  dateLabel: string
  results: OpenAiClientResult[]
  loading: boolean
  error: string | null
}) {
  const [exporting, setExporting] = useState(false)

  const allCampaigns = results.flatMap(r => r.campaigns)
  const totals = {
    budget:      allCampaigns.reduce((s, c) => s + c.budget, 0),
    spend:       allCampaigns.reduce((s, c) => s + c.spend, 0),
    clicks:      allCampaigns.reduce((s, c) => s + c.clicks, 0),
    impressions: allCampaigns.reduce((s, c) => s + c.impressions, 0),
  }

  const buildOpenAiRows = (): PdfOpenAiRow[] => results.flatMap(r => r.campaigns.map(c => ({
    clientName: r.clientName,
    campaignName: c.name,
    status: c.status,
    budget: c.budget,
    budgetPeriod: c.budgetPeriod,
    spend: c.spend,
    cpc: c.cpc,
    impressions: c.impressions,
  })))

  async function handleExport() {
    setExporting(true)
    try { await generateOpenAiAdsPdf({ dateLabel, rows: buildOpenAiRows() }) }
    finally { setExporting(false) }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        {loading && (
          <svg className="h-4 w-4 animate-spin text-[#16a34a]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        <button onClick={handleExport} disabled={exporting || loading || !!error || results.some(r => !!r.error || !!r.insightsError)}
          className="flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black shadow-card
                     transition-colors hover:border-[#16a34a] hover:text-[#16a34a] disabled:opacity-60
                     dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stroke bg-white px-6 py-16 text-center dark:border-strokedark dark:bg-boxdark">
          <p className="text-base font-semibold text-black dark:text-[#E2E5E9]">No OpenAI Ads accounts connected</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-body dark:text-bodydark">
            Add an OpenAI Ads API token in a client's integration card to see their campaigns here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4">
                {OPENAI_HEADERS.map(h => (
                  <th key={h} className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke dark:divide-strokedark">
              {results.map(r => (
                <Fragment key={r.clientId}>
                  {r.error ? (
                    <tr>
                      <td className="px-5 py-4 font-semibold text-black dark:text-[#E2E5E9]">{r.clientName}</td>
                      <td colSpan={3} className="px-5 py-4 text-xs text-red-500">{r.error}</td>
                    </tr>
                  ) : r.campaigns.length === 0 ? (
                    <tr>
                      <td className="px-5 py-4 font-semibold text-black dark:text-[#E2E5E9]">{r.clientName}</td>
                      <td colSpan={3} className="px-5 py-4 text-xs text-body dark:text-bodydark opacity-60">No campaigns.</td>
                    </tr>
                  ) : r.campaigns.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                      <td className="max-w-[200px] truncate px-5 py-4 font-semibold text-black dark:text-[#E2E5E9]" title={r.clientName}>
                        {idx === 0 ? r.clientName : ''}
                      </td>
                      <td className="max-w-[220px] truncate px-5 py-4 text-black dark:text-[#E2E5E9]" title={c.name}>{c.name}</td>
                      <td className="px-5 py-4 tabular-nums text-black dark:text-[#E2E5E9]">{c.budget > 0 ? `${fmtCurrency(c.budget)}${c.budgetPeriod === "daily" ? "/day" : " lifetime"}` : <span className="opacity-40 text-body dark:text-bodydark">—</span>}</td>
                      <td className="px-5 py-4 tabular-nums font-medium text-red-500">{r.insightsError ? "Unavailable" : fmtCurrency(c.spend)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {allCampaigns.length > 0 && (
                <tr className="border-t-2 border-[#16a34a]/30 bg-[#eef7f2] dark:bg-[#1a382e]">
                  <td className="px-5 py-4 text-xs font-bold uppercase text-[#16a34a]" colSpan={2}>Totals</td>
                  <td className="px-5 py-4 tabular-nums font-bold text-[#16a34a]">{totals.budget > 0 && allCampaigns.every(c => c.budgetPeriod === allCampaigns[0]?.budgetPeriod) ? `${fmtCurrency(totals.budget)}${allCampaigns[0]?.budgetPeriod === 'daily' ? '/day' : ' lifetime'}` : '—'}</td>
                  <td className="px-5 py-4 tabular-nums font-bold text-red-500">{results.some(r => r.error || r.insightsError) ? 'Unavailable' : fmtCurrency(totals.spend)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {results.some(r => r.insightsError) && (
        <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">
          Performance metrics could not be loaded. Totals and exports may be incomplete.
          {results.filter(r => r.insightsError).map(r => <span key={r.clientId} className="block">{r.clientName}: {r.insightsError}</span>)}
        </p>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SEMReportes() {
  const [period, setPeriod]               = useState<ReportPeriod>('weekly')
  const [accounts, setAccounts]           = useState<AdsAccount[]>([])
  const [budgetClients, setBudgetClients] = useState<MonthlyBudgetClient[]>([])
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [adsAccountIds, setAdsAccountIds] = useState<Set<string>>(new Set())
  const [ggAccountIds, setGgAccountIds]   = useState<Set<string>>(new Set())
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const year = new Date().getFullYear()
        const [acctRes, adsRes, ggRes, clientsRes] = await reportRequest(Promise.all([
          supabase.from('sem_accounts').select('id, name, status').order('name'),
          supabase.from('sem_yearly_ads').select('account_id').eq('year', year),
          supabase.from('sem_yearly_guarantee').select('account_id').eq('year', year),
          supabase.from('clients').select('id, status, sem_account_id, lsa_account_id, sem_enabled'),
        ]))
        for (const result of [acctRes, adsRes, ggRes, clientsRes]) {
          if (result.error) throw new Error(result.error.message)
        }
        setBudgetClients(clientsRes.data ?? [])
        // Accounts whose linked client has Google Ads disabled are hidden from all reports
        const disabled = new Set(
          (clientsRes.data ?? [])
            .filter(c => c.sem_enabled === false && c.sem_account_id)
            .map(c => c.sem_account_id as string),
        )
        setAccounts((acctRes.data ?? []).filter(a => !disabled.has(a.id)))
        setAdsAccountIds(new Set((adsRes.data ?? []).map(r => r.account_id)))
        setGgAccountIds(new Set((ggRes.data ?? []).map(r => r.account_id)))
      } catch (error) {
        setAccountsError(error instanceof Error ? error.message : 'Unable to load report accounts')
      } finally { setLoading(false) }
    })()
  }, [])

  // ── Shared weekly date range + per-platform budget/spend data ──────────────
  // All platforms share one week for the grouped table and combined exports.
  const { from: defaultWeekFrom, to: defaultWeekTo } = getCurrentWeekRange()
  const [weekFrom, setWeekFrom] = useState(defaultWeekFrom)
  const [weekTo, setWeekTo]     = useState(defaultWeekTo)

  const eligible = useMemo(() => selectMonthlyBudgetAccounts(accounts, budgetClients, adsAccountIds, ggAccountIds), [accounts, budgetClients, adsAccountIds, ggAccountIds])
  const adsAccounts = useMemo(() => eligible.filter(r => r.googleAds).map(r => r.account), [eligible])
  const ggAccounts = useMemo(() => eligible.filter(r => r.googleGuarantee).map(r => r.account), [eligible])

  const weeklyKey = `${weekFrom}:${weekTo}:${adsAccounts.map(a => a.id).join(',')}:${ggAccounts.map(a => a.id).join(',')}`
  const [adsReady, setAdsReady] = useState('')
  const [ggReady, setGgReady] = useState('')
  const [weeklyError, setWeeklyError] = useState<string | null>(null)
  const [adsBudgets, setAdsBudgets]             = useState<BudgetStore>({})
  const [loadingAdsBudgets, setLoadingAdsBudgets] = useState(true)
  const [adsCost, setAdsCost]                   = useState<Record<string, number>>({})
  const [loadingAdsCost, setLoadingAdsCost]     = useState(false)

  useEffect(() => {
    if (!adsAccounts.length) { setLoadingAdsBudgets(false); return }
    setLoadingAdsBudgets(true)
    fetchSupabaseBudgets('ads_monthly').then(map => {
      const next: BudgetStore = {}
      for (const a of adsAccounts) next[a.id] = { budget: map[a.id] ?? 0 }
      setAdsBudgets(next)
    }).catch(e => setWeeklyError(e.message)).finally(() => setLoadingAdsBudgets(false))
  }, [adsAccounts])

  useEffect(() => {
    let cancelled = false
    setLoadingAdsCost(true); setAdsCost({}); setWeeklyError(null)
    async function load() {
      try {
        if (!adsAccounts.length) return
        const { data, error } = await reportRequest(supabase.from('sem_ads_daily').select('account_id, spend').in('account_id', adsAccounts.map(a => a.id)).gte('date', weekFrom).lte('date', weekTo))
        if (error) throw error
        const map: Record<string, number> = {}
        for (const row of data ?? []) map[row.account_id] = (map[row.account_id] ?? 0) + Number(row.spend)
        if (!cancelled) setAdsCost(map)
      } catch (e) { if (!cancelled) setWeeklyError(e instanceof Error ? e.message : String(e)) }
      finally { if (!cancelled) { setLoadingAdsCost(false); setAdsReady(weeklyKey) } }
    }
    void load()
    return () => { cancelled = true }
  }, [adsAccounts, weekFrom, weekTo, weeklyKey])

  const [ggBudgets, setGgBudgets]               = useState<BudgetStore>({})
  const [loadingGgBudgets, setLoadingGgBudgets] = useState(true)
  const [ggPeriod, setGgPeriod]                 = useState<Record<string, { spend: number; leads: number }>>({})
  const [loadingGgPeriod, setLoadingGgPeriod]   = useState(false)

  useEffect(() => {
    if (!ggAccounts.length) { setLoadingGgBudgets(false); return }
    setLoadingGgBudgets(true)
    fetchSupabaseBudgets('guarantee_monthly').then(map => {
      const next: BudgetStore = {}
      for (const a of ggAccounts) next[a.id] = { budget: map[a.id] ?? 0 }
      setGgBudgets(next)
    }).catch(e => setWeeklyError(e.message)).finally(() => setLoadingGgBudgets(false))
  }, [ggAccounts])

  const [ggErrors, setGgErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    const timeout = setTimeout(() => controller.abort(), 45000)
    setGgPeriod({}); setGgErrors({}); setLoadingGgPeriod(true)
    Promise.all(ggAccounts.map(async account => {
      try {
        const params = new URLSearchParams({ accountId: account.id, startDate: weekFrom, endDate: weekTo })
        const res = await edgeFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sem/lsa-performance?${params}`, { signal: controller.signal })
        const body = await res.json()
        if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`)
        if (!Number.isFinite(body.totalSpend) || !Number.isFinite(body.chargedLeads)) throw new Error('Invalid LSA metrics')
        if (!cancelled) setGgPeriod(prev => ({ ...prev, [account.id]: { spend: body.totalSpend, leads: body.chargedLeads } }))
      } catch (e) {
        if (!cancelled) setGgErrors(prev => ({ ...prev, [account.id]: e instanceof Error ? e.message : String(e) }))
      }
    })).finally(() => { clearTimeout(timeout); if (!cancelled) { setLoadingGgPeriod(false); setGgReady(weeklyKey) } })
    return () => { cancelled = true; clearTimeout(timeout); controller.abort() }
  }, [ggAccounts, weekFrom, weekTo, weeklyKey])

  // OpenAI shares the same week range as Ads/Guarantee so all three can be
  // combined into a single weekly report, the same way the Ads+Guarantee
  // combine already works.
  const { results: openaiResults, loading: loadingOpenai, error: openaiError } = useOpenAiBudgetReport(weekFrom, weekTo)

  const weekDateLabel = `Week ${weekLabel(weekFrom, weekTo)}`

  const weeklyAdsRows: PdfWeeklyRow[] = adsAccounts.map(a => ({
    status: a.status,
    accountName: a.name,
    budget: adsBudgets[a.id]?.budget ?? 0,
    cost: adsCost[a.id] ?? 0,
  }))

  const weeklyGuaranteeRows: PdfWeeklyRow[] = ggAccounts.map(a => ({
    status: a.status,
    accountName: a.name,
    budget: ggBudgets[a.id]?.budget ?? 0,
    cost: ggPeriod[a.id]?.spend ?? 0,
    leads: ggPeriod[a.id]?.leads,
  }))

  const weeklyOpenaiRows: PdfOpenAiRow[] = openaiResults.map(result => {
    const summary = summarizeOpenAiBudget(result)
    return {
      clientName: result.clientName,
      campaignName: 'All active campaigns',
      status: 'active',
      budget: summary.budget ?? 0,
      budgetPeriod: summary.budgetPeriod,
      spend: summary.spend ?? 0,
      cpc: 0,
      impressions: 0,
    }
  })

  const groupedWeeklyRows: WeeklyDisplayRow[] = eligible.flatMap(({ account, googleAds, googleGuarantee }) => [
    ...(googleAds ? [{ accountId: account.id, name: account.name, status: account.status, platform: 'Google Ads' as const, budget: adsBudgets[account.id]?.budget ?? 0, spend: adsCost[account.id] ?? null }] : []),
    ...(googleGuarantee ? [{ accountId: account.id, name: account.name, status: account.status, platform: 'Google Guarantee' as const, budget: ggBudgets[account.id]?.budget ?? 0, spend: ggPeriod[account.id]?.spend ?? null, leads: ggPeriod[account.id]?.leads }] : []),
  ])
  for (const result of openaiResults) {
    const summary = summarizeOpenAiBudget(result)
    groupedWeeklyRows.push({ accountId: result.clientId, clientId: result.clientId, name: result.clientName, platform: 'OpenAI Ads', status: 'active', budget: summary.budget, budgetPeriod: summary.budgetPeriod, spend: summary.spend, note: summary.spend === null ? result.error ?? result.insightsError ?? undefined : undefined })
  }
  const weeklyLoading = adsReady !== weeklyKey || ggReady !== weeklyKey || loading || loadingAdsBudgets || loadingGgBudgets || loadingAdsCost || loadingGgPeriod || loadingOpenai

  const weeklyTable = buildWeeklyReportTable(groupedWeeklyRows, budgetClients, weekDateLabel)
  const weeklyExportBlocked = weeklyLoading || !!weeklyError || !!accountsError || !!openaiError || Object.keys(ggErrors).length > 0 || openaiResults.some(r => summarizeOpenAiBudget(r).spend === null)

  const [exportingWeekly, setExportingWeekly] = useState(false)
  const [preparingWeeklyEmail, setPreparingWeeklyEmail] = useState(false)
  const [weeklyEmailPayload, setWeeklyEmailPayload]     = useState<EmailReportPayload | null>(null)

  async function handleExportWeekly() {
    if (weeklyExportBlocked) return
    setExportingWeekly(true)
    try {
      await generateWeeklyBudgetPdf({ dateLabel: weekDateLabel, table: weeklyTable })
    } finally { setExportingWeekly(false) }
  }

  async function handleOpenWeeklyEmailModal() {
    if (weeklyExportBlocked) return
    setPreparingWeeklyEmail(true)
    try {
      const emailRows = weeklyTable.groups.flatMap(group => [
        { cells: [group.name, ...Array(weeklyTable.headers.length - 1).fill('')], background: '#eef5ff' },
        ...group.rows.map(row => ({ cells: row.cells.map(String), background: '#ffffff' })),
      ])
      emailRows.push(...weeklyTable.totals.map(row => ({ cells: row.cells.map(String), background: '#eef7f2' })))
      const [weeklyImage, pdf] = await Promise.all([
        captureTableAsImage({
          title: 'Weekly Budget Report',
          headers: weeklyTable.headers,
          rows: emailRows.map(row => row.cells),
          rowBackgrounds: emailRows.map(row => row.background),
        }),
        generateWeeklyBudgetPdfBytes({ dateLabel: weekDateLabel, table: weeklyTable }),
      ])
      setWeeklyEmailPayload({
        kind: 'weekly',
        dateLabel: weekDateLabel,
        adsRows: weeklyAdsRows,
        guaranteeRows: weeklyGuaranteeRows,
        openaiRows: weeklyOpenaiRows,
        images: [{ label: 'Weekly Budget Report', ...weeklyImage }],
        pdfBase64: uint8ToBase64(pdf.bytes),
        pdfFilename: pdf.filename,
      })
    } finally {
      setPreparingWeeklyEmail(false)
    }
  }

  return (
    <div className="mx-auto max-w-screen-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">
          Monthly Budget
          <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-bold bg-[#16a34a]/20 text-[#16a34a] align-middle">
            SEM Intelligence
          </span>
        </h1>
        <p className="mt-1 text-sm text-body dark:text-bodydark">
          Budget and spend for every client account, organized by week and by month.
        </p>
      </div>

      {/* Period tabs: Weekly / Monthly */}
      <div className="mb-6 flex w-fit gap-1 rounded-xl border border-stroke bg-gray-2 p-1 dark:border-strokedark dark:bg-meta-4">
        {([
          { id: 'weekly',  label: 'Weekly Report' },
          { id: 'monthly', label: 'Monthly Report' },
        ] as { id: ReportPeriod; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setPeriod(t.id)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-150
              ${period === t.id
                ? 'bg-white text-black shadow-sm dark:bg-boxdark dark:text-[#E2E5E9]'
                : 'text-body hover:text-black dark:text-bodydark dark:hover:text-white'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {period === 'monthly' ? (
        accountsError ? <p role="alert" className="text-sm text-red-500">Unable to load Monthly Budget accounts: {accountsError}</p> : loading ? <BudgetTableSkeleton /> : <MonthlyReport accounts={accounts} clients={budgetClients} />
      ) : (
        <>
          <SendEmailModal payload={weeklyEmailPayload} onClose={() => setWeeklyEmailPayload(null)} />
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <WeekPicker from={weekFrom} to={weekTo} onChange={(f, t) => { setWeekFrom(f); setWeekTo(t) }} />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleOpenWeeklyEmailModal} disabled={preparingWeeklyEmail || weeklyExportBlocked}
                className="flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black shadow-card
                           transition-colors hover:border-[#16a34a] hover:text-[#16a34a] disabled:opacity-60
                           dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
                <Mail className="h-4 w-4" />
                {preparingWeeklyEmail ? 'Preparing…' : 'Send by Email'}
              </button>
              <button onClick={handleExportWeekly} disabled={exportingWeekly || weeklyExportBlocked}
                className="flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black shadow-card
                           transition-colors hover:border-[#16a34a] hover:text-[#16a34a] disabled:opacity-60
                           dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
                <Download className="h-4 w-4" />
                {exportingWeekly ? 'Exporting…' : 'Export PDF'}
              </button>
            </div>
          </div>

          {weeklyError && <p role="alert" className="mb-3 text-sm text-red-500">{weeklyError}</p>}
          {openaiError && <p role="alert" className="mb-3 text-sm text-red-500">{openaiError}</p>}
          {openaiResults.filter(r => summarizeOpenAiBudget(r).spend === null).map(r => <p key={r.clientId} role="alert" className="mb-3 text-sm text-red-500">{r.clientName}: {r.error ?? r.insightsError}</p>)}
          {Object.entries(ggErrors).map(([id, error]) => <p key={id} role="alert" className="mb-3 text-sm text-red-500">{ggAccounts.find(a => a.id === id)?.name}: {error}</p>)}
          {accountsError ? <p role="alert" className="text-sm text-red-500">{accountsError}</p> : weeklyLoading ? <BudgetTableSkeleton headers={WEEKLY_HEADERS} /> : (
            <WeeklyGroupedTable table={weeklyTable} />
          )}
        </>
      )}
    </div>
  )
}
