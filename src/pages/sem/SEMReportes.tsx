import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { generateWeeklyBudgetPdf, generateMonthlyBudgetPdf } from '@/features/sem/lib/generateReportsPdf'
import type { PdfWeeklyRow, PdfMonthlyRow } from '@/features/sem/lib/generateReportsPdf'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdsAccount { id: string; name: string; status: string }

interface BudgetRow { budget: number }

type BudgetStore = Record<string, BudgetRow>

interface GuaranteeAnalytics {
  spend: number
  leads: number
  cost_per_lead: number
  ad_impressions: number
  months: number
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const MONTHLY_BUDGET_KEY = 'sem_monthly_budgets'

const load = (key: string) => { try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} } }
const save = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ } }

function loadMonthlyStore():    Record<string,number> { return load(MONTHLY_BUDGET_KEY) }
function saveMonthlyStore(s: Record<string,number>) { save(MONTHLY_BUDGET_KEY, s) }

async function fetchSupabaseBudgets(reportType: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('sem_report_budgets')
    .select('account_id, budget')
    .eq('report_type', reportType)
  const map: Record<string, number> = {}
  for (const r of data ?? []) map[r.account_id] = Number(r.budget)
  return map
}

function upsertSupabaseBudget(accountId: string, reportType: string, budget: number) {
  supabase.from('sem_report_budgets')
    .upsert({ account_id: accountId, report_type: reportType, budget, updated_at: new Date().toISOString() }, { onConflict: 'account_id,report_type' })
    .then(() => {})
}

function defaultRow(): BudgetRow { return { budget: 0 } }

// ─── Date range helpers ───────────────────────────────────────────────────────

function getDefaultDateRange(): { from: string; to: string } {
  const today = new Date()
  const from  = new Date(today.getFullYear(), today.getMonth(), 1)
  const fmt   = (d: Date) => d.toISOString().split('T')[0]
  return { from: fmt(from), to: fmt(today) }
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const ALL_MONTHS  = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtNum = (n: number, dec = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const parseCurrency = (v: string) => parseFloat(v.replace(/[$,]/g, '')) || 0

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

// ─── DateRangePicker ──────────────────────────────────────────────────────────

function DateRangePicker({
  from, to, onChange, accentColor = '#16a34a',
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  accentColor?: string
}) {
  const today = new Date().toISOString().split('T')[0]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <svg className="h-4 w-4 shrink-0" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
      <span className="text-xs text-body dark:text-bodydark">From</span>
      <input
        type="date" value={from} max={to}
        onChange={e => onChange(e.target.value, to)}
        className="h-9 rounded-lg border border-stroke bg-white px-3 text-sm font-medium text-black outline-none transition focus:border-[#16a34a] dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]"
      />
      <span className="text-xs text-body dark:text-bodydark">To</span>
      <input
        type="date" value={to} min={from} max={today}
        onChange={e => onChange(from, e.target.value)}
        className="h-9 rounded-lg border border-stroke bg-white px-3 text-sm font-medium text-black outline-none transition focus:border-[#16a34a] dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]"
      />
    </div>
  )
}

// ─── BudgetTableSection ───────────────────────────────────────────────────────

function BudgetTableSection({
  accounts, budgets, costByAccount = {}, onUpdate, pendingCost = false,
}: {
  accounts: AdsAccount[]
  budgets: BudgetStore
  costByAccount?: Record<string, number>
  onUpdate: (id: string, value: number) => void
  pendingCost?: boolean
}) {
  const get = (id: string) => budgets[id] ?? defaultRow()
  const rem = (id: string) => {
    const b = get(id); const cost = costByAccount[id] ?? 0
    return !pendingCost && b.budget > 0 ? b.budget - cost : null
  }

  const totals = accounts.reduce((acc, a) => {
    const b = get(a.id); const cost = costByAccount[a.id] ?? 0; const r = rem(a.id)
    return {
      budget: acc.budget + b.budget,
      cost:   acc.cost   + cost,
      wk1:    r !== null ? acc.wk1 + r / 22 : acc.wk1,
      wk2:    r !== null ? acc.wk2 + r / 12 : acc.wk2,
      wk3:    r !== null ? acc.wk3 + r / 6  : acc.wk3,
      lc:     r !== null ? acc.lc  + r / 2  : acc.lc,
    }
  }, { budget: 0, cost: 0, wk1: 0, wk2: 0, wk3: 0, lc: 0 })

  return (
    <div className="overflow-x-auto rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4">
            {['Status', 'Account Name', 'Budget', 'Period Spend', 'Remaining', 'First Week', 'Second Week', 'Third Week', 'Last Check 29th'].map(h => (
              <th key={h} className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke dark:divide-strokedark">
          {accounts.length === 0 ? (
            <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-body dark:text-bodydark">No accounts found.</td></tr>
          ) : accounts.map(a => {
            const b         = get(a.id)
            const cost      = costByAccount[a.id] ?? 0
            const remaining = rem(a.id)
            const remNeg    = remaining !== null && remaining < 0
            return (
              <tr key={a.id} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                <td className="px-5 py-4"><StatusBadge status={a.status} /></td>
                <td className="max-w-[200px] truncate px-5 py-4 font-semibold text-black dark:text-[#E2E5E9]" title={a.name}>{a.name}</td>
                <td className="px-5 py-4"><EditableCell value={b.budget} onChange={v => onUpdate(a.id, v)} /></td>
                <td className="px-5 py-4 tabular-nums font-medium text-red-500">
                  {pendingCost
                    ? <span className="text-xs italic text-body/50 dark:text-bodydark/50">Loading…</span>
                    : cost > 0 ? fmtCurrency(cost) : <span className="opacity-40 text-body dark:text-bodydark">—</span>
                  }
                </td>
                <td className={`px-5 py-4 tabular-nums font-semibold ${remNeg ? 'text-red-500' : remaining !== null ? 'text-meta-3' : 'text-body dark:text-bodydark'}`}>
                  {remaining !== null ? fmtCurrency(remaining) : <span className="opacity-40">—</span>}
                </td>
                <td className="px-5 py-4 tabular-nums text-black dark:text-[#E2E5E9]">
                  {remaining !== null ? fmtCurrency(remaining / 22) : <span className="opacity-40 text-body dark:text-bodydark">—</span>}
                </td>
                <td className="px-5 py-4 tabular-nums text-black dark:text-[#E2E5E9]">
                  {remaining !== null ? fmtCurrency(remaining / 12) : <span className="opacity-40 text-body dark:text-bodydark">—</span>}
                </td>
                <td className="px-5 py-4 tabular-nums text-black dark:text-[#E2E5E9]">
                  {remaining !== null ? fmtCurrency(remaining / 6) : <span className="opacity-40 text-body dark:text-bodydark">—</span>}
                </td>
                <td className="px-5 py-4 tabular-nums text-black dark:text-[#E2E5E9]">
                  {remaining !== null ? fmtCurrency(remaining / 2) : <span className="opacity-40 text-body dark:text-bodydark">—</span>}
                </td>
              </tr>
            )
          })}
          {accounts.length > 0 && (
            <tr className="border-t-2 border-[#16a34a]/30 bg-[#eef7f2] dark:bg-[#1a382e]">
              <td className="px-5 py-4" />
              <td className="px-5 py-4 text-xs font-bold uppercase text-[#16a34a]">Totals</td>
              <td className="px-5 py-4 tabular-nums font-bold text-[#16a34a]">{totals.budget > 0 ? fmtCurrency(totals.budget) : '—'}</td>
              <td className="px-5 py-4 tabular-nums font-bold text-red-500">
                {pendingCost ? <span className="text-xs italic text-body/50">Loading…</span> : totals.cost > 0 ? fmtCurrency(totals.cost) : '—'}
              </td>
              <td className="px-5 py-4 tabular-nums font-bold text-[#16a34a]">
                {!pendingCost && totals.budget > 0 ? fmtCurrency(totals.budget - totals.cost) : '—'}
              </td>
              <td className="px-5 py-4 tabular-nums font-bold text-[#16a34a]">{totals.wk1 > 0 ? fmtCurrency(totals.wk1) : '—'}</td>
              <td className="px-5 py-4 tabular-nums font-bold text-[#16a34a]">{totals.wk2 > 0 ? fmtCurrency(totals.wk2) : '—'}</td>
              <td className="px-5 py-4 tabular-nums font-bold text-[#16a34a]">{totals.wk3 > 0 ? fmtCurrency(totals.wk3) : '—'}</td>
              <td className="px-5 py-4 tabular-nums font-bold text-[#16a34a]">{totals.lc  > 0 ? fmtCurrency(totals.lc)  : '—'}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── GuaranteeAnalyticsCards ──────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode; accent: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm dark:bg-boxdark ${accent}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-body dark:text-bodydark">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stroke/50 dark:bg-white/10">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold tabular-nums text-black dark:text-[#E2E5E9]">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-body dark:text-bodydark">{sub}</p>}
    </div>
  )
}

function GuaranteeAnalyticsCards({ accounts }: { accounts: AdsAccount[] }) {
  const [accountId, setAccountId] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [data, setData] = useState<GuaranteeAnalytics | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      const enabled = accounts.find(a => a.status === 'ENABLED') ?? accounts[0]
      setAccountId(enabled.id)
    }
  }, [accounts, accountId])

  const fetchAnalytics = useCallback(async (id: string, yr: string) => {
    setLoading(true)
    try {
      const { data: rows, error } = await supabase
        .from('sem_yearly_guarantee')
        .select('spend, leads, cost_per_lead, ad_impressions')
        .eq('account_id', id)
        .eq('year', Number(yr))
        .gt('spend', 0)
      if (error || !rows || rows.length === 0) { setData(null); return }
      const n = rows.length
      const agg = rows.reduce((acc, r) => ({
        spend:          acc.spend + r.spend,
        leads:          acc.leads + r.leads,
        cost_per_lead:  0,
        ad_impressions: acc.ad_impressions + r.ad_impressions,
        months:         n,
      }), { spend: 0, leads: 0, cost_per_lead: 0, ad_impressions: 0, months: 0 })
      agg.cost_per_lead = agg.leads > 0 ? agg.spend / agg.leads : 0
      setData(agg)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (accountId) fetchAnalytics(accountId, year) }, [accountId, year, fetchAnalytics])

  const selectedAccount = accounts.find(a => a.id === accountId)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-black dark:text-[#E2E5E9]">
            <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
            Google Guarantee Analytics
          </h3>
          <p className="mt-0.5 text-xs text-body dark:text-bodydark">
            {data ? `${data.months} month${data.months !== 1 ? 's' : ''} with data · ${year}` : `No data · ${year}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={accountId} onChange={e => setAccountId(e.target.value)}
            className="h-8 max-w-[220px] truncate rounded-lg border border-stroke bg-white px-3 text-xs font-medium outline-none hover:border-[#3b82f6] focus:border-[#3b82f6] dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={year} onChange={e => setYear(e.target.value)}
            className="h-8 rounded-lg border border-stroke bg-white px-3 text-xs font-medium outline-none hover:border-[#3b82f6] focus:border-[#3b82f6] dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
            {['2024','2025','2026'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {loading && (
            <svg className="h-4 w-4 animate-spin text-[#3b82f6]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
      </div>

      {!data && !loading ? (
        <div className="rounded-xl border border-stroke bg-white px-6 py-8 text-center dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body dark:text-bodydark">
            No Google Guarantee data for <strong>{selectedAccount?.name ?? 'this account'}</strong> in {year}.
          </p>
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            label="Total Lead Spend"
            value={fmtCurrency(data.spend)}
            sub={`${data.months} month${data.months !== 1 ? 's' : ''} · ${year}`}
            accent="border-[#16a34a]/20"
            icon={
              <svg className="h-4 w-4 text-[#16a34a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
              </svg>
            }
          />
          <KpiCard
            label="Charged Leads"
            value={fmtNum(data.leads)}
            sub={`${year} year-to-date`}
            accent="border-[#3b82f6]/20"
            icon={
              <svg className="h-4 w-4 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            }
          />
          <KpiCard
            label="Cost per Lead"
            value={data.leads > 0 ? fmtCurrency(data.cost_per_lead) : '—'}
            sub="Avg across all months"
            accent="border-[#f59e0b]/20"
            icon={
              <svg className="h-4 w-4 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            }
          />
          <KpiCard
            label="Ad Impressions"
            value={fmtNum(data.ad_impressions)}
            sub="Total impressions served"
            accent="border-[#8b5cf6]/20"
            icon={
              <svg className="h-4 w-4 text-[#8b5cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
        </div>
      ) : null}
    </div>
  )
}

// ─── Send Email Modal ─────────────────────────────────────────────────────────

type EmailReportPayload =
  | { kind: 'weekly';  dateLabel: string; adsRows: PdfWeeklyRow[]; guaranteeRows: PdfWeeklyRow[] }
  | { kind: 'monthly'; monthLabel: string; rows: PdfMonthlyRow[] }

function buildWeeklyText(dateLabel: string, adsRows: PdfWeeklyRow[], guaranteeRows: PdfWeeklyRow[]): string {
  const lines: string[] = []
  const fmt = (n: number) => n > 0 ? fmtCurrency(n) : '—'

  lines.push(`Google Ads Budget Report — ${dateLabel}`)
  lines.push('')

  if (adsRows.length > 0) {
    lines.push('GOOGLE ADS — BUDGET REPORT')
    lines.push('Account Name | Budget | Period Spend | Remaining | % Used')
    lines.push('-'.repeat(80))
    adsRows.forEach(r => {
      const remaining = r.budget > 0 ? r.budget - r.cost : 0
      const pct = r.budget > 0 ? `${((r.cost / r.budget) * 100).toFixed(1)}%` : '—'
      lines.push([r.accountName, fmt(r.budget), fmt(r.cost), fmtCurrency(remaining), pct].join(' | '))
    })
    lines.push('')
  }

  if (guaranteeRows.length > 0) {
    lines.push('GOOGLE GUARANTEE — BUDGET REPORT')
    lines.push('Account Name | Budget | Period Spend | Remaining | % Used')
    lines.push('-'.repeat(70))
    guaranteeRows.forEach(r => {
      const remaining = r.budget > 0 ? r.budget - r.cost : 0
      const pct = r.budget > 0 ? `${((r.cost / r.budget) * 100).toFixed(1)}%` : '—'
      lines.push([r.accountName, fmt(r.budget), fmt(r.cost), fmtCurrency(remaining), pct].join(' | '))
    })
  }

  return lines.join('\n')
}

function buildMonthlyText(monthLabel: string, rows: PdfMonthlyRow[]): string {
  const lines: string[] = []
  const fmt = (n: number) => n > 0 ? fmtCurrency(n) : '—'
  lines.push(`Budget Overview — ${monthLabel}`)
  lines.push('')
  lines.push('Account Name | Monthly Budget | Spend (GA) | Remaining')
  lines.push('-'.repeat(70))
  rows.forEach(r => {
    const rem = r.budget > 0 ? r.budget - r.spend : 0
    lines.push([r.accountName, fmt(r.budget), fmt(r.spend), r.budget > 0 ? fmtCurrency(rem) : '—'].join(' | '))
  })
  return lines.join('\n')
}

function SendEmailModal({ payload, onClose }: { payload: EmailReportPayload | null; onClose: () => void }) {
  const [email, setEmail]         = useState('')
  const [scheduled, setScheduled] = useState('')
  const [note, setNote]           = useState('')
  const [sent, setSent]           = useState(false)

  useEffect(() => { if (!payload) { setEmail(''); setScheduled(''); setNote(''); setSent(false) } }, [payload])

  if (!payload) return null

  const reportText = payload.kind === 'weekly'
    ? buildWeeklyText(payload.dateLabel, payload.adsRows, payload.guaranteeRows)
    : buildMonthlyText(payload.monthLabel, payload.rows)

  const label = payload.kind === 'weekly' ? payload.dateLabel : payload.monthLabel

  const handleSend = () => {
    const subject = scheduled
      ? `Budget Report — ${label} (scheduled ${new Date(scheduled).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})`
      : `Budget Report — ${label}`
    const body = [reportText, note ? `\n\nNote:\n${note}` : ''].join('')
    window.open(`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
    setSent(true)
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
            <p className="text-sm font-semibold text-[#15803d] dark:text-[#4ade80]">Email client opened</p>
            <p className="mt-1 text-xs text-body dark:text-bodydark">The report was pre-filled in your email client. Review and send.</p>
            {scheduled && (
              <p className="mt-2 text-[11px] text-body/70 dark:text-bodydark/70">
                Reminder set for {new Date(scheduled).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
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
              <label className="mb-1.5 block text-xs font-semibold text-black dark:text-[#E2E5E9]">
                Schedule Date & Time <span className="font-normal text-body dark:text-bodydark">(optional)</span>
              </label>
              <input type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)}
                className="w-full rounded-lg border border-stroke bg-transparent px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-[#16a34a] dark:border-strokedark dark:text-[#E2E5E9] dark:focus:border-[#16a34a]" />
              {scheduled && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#16a34a]">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Scheduled — the date will appear in the email subject
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-black dark:text-[#E2E5E9]">
                Note <span className="font-normal text-body dark:text-bodydark">(optional)</span>
              </label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Any message to add to the email…"
                className="w-full resize-none rounded-lg border border-stroke bg-transparent px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-[#16a34a] dark:border-strokedark dark:text-[#E2E5E9] dark:focus:border-[#16a34a]" />
            </div>
            <div className="rounded-lg border border-stroke bg-gray-2 px-3.5 py-3 dark:border-strokedark dark:bg-meta-4">
              <p className="text-[11px] text-body dark:text-bodydark">
                <span className="font-semibold text-black dark:text-[#E2E5E9]">Report included:</span> the table data will be pasted in the email body, ready to send from your email client.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-body hover:text-black dark:text-bodydark dark:hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSend} disabled={!email.includes('@')}
                className="flex items-center gap-2 rounded-lg bg-[#16a34a] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#15803d] disabled:opacity-50 disabled:cursor-not-allowed">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                {scheduled ? 'Schedule & Open Email' : 'Open in Email Client'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Google Ads Budget Report Tab ─────────────────────────────────────────────

function AdsReport({ accounts }: { accounts: AdsAccount[] }) {
  const { from: defaultFrom, to: defaultTo } = getDefaultDateRange()
  const [fromDate, setFromDate]             = useState(defaultFrom)
  const [toDate, setToDate]                 = useState(defaultTo)
  const [adsBudgets, setAdsBudgets]         = useState<BudgetStore>({})
  const [loadingBudgets, setLoadingBudgets] = useState(true)
  const [costByAccount, setCostByAccount]   = useState<Record<string, number>>({})
  const [loadingCost, setLoadingCost]       = useState(false)
  const [exporting, setExporting]           = useState(false)
  const [emailPayload, setEmailPayload]     = useState<EmailReportPayload | null>(null)

  useEffect(() => {
    if (!accounts.length) return
    setLoadingBudgets(true)
    fetchSupabaseBudgets('ads_weekly').then(map => {
      const next: BudgetStore = {}
      for (const a of accounts) next[a.id] = { budget: map[a.id] ?? 0 }
      setAdsBudgets(next)
    }).finally(() => setLoadingBudgets(false))
  }, [accounts])

  const fetchSpend = useCallback(async (from: string, to: string) => {
    if (!accounts.length) return
    setLoadingCost(true)
    try {
      const { data } = await supabase
        .from('sem_ads_daily')
        .select('account_id, spend')
        .in('account_id', accounts.map(a => a.id))
        .gte('date', from)
        .lte('date', to)
      const map: Record<string, number> = {}
      for (const r of data ?? []) map[r.account_id] = (map[r.account_id] ?? 0) + Number(r.spend)
      setCostByAccount(map)
    } finally { setLoadingCost(false) }
  }, [accounts])

  useEffect(() => { if (accounts.length) fetchSpend(fromDate, toDate) }, [accounts, fromDate, toDate, fetchSpend])

  const updateAds = (id: string, value: number) => {
    setAdsBudgets(prev => {
      const next = { ...prev, [id]: { budget: value } }
      upsertSupabaseBudget(id, 'ads_weekly', value)
      return next
    })
  }

  const buildRows = (): PdfWeeklyRow[] => accounts.map(a => ({
    status: a.status,
    accountName: a.name,
    budget: adsBudgets[a.id]?.budget ?? 0,
    cost: costByAccount[a.id] ?? 0,
  }))

  const dateLabel = `${fromDate} – ${toDate}`

  async function handleExport() {
    setExporting(true)
    try { await generateWeeklyBudgetPdf({ dateLabel, adsRows: buildRows(), guaranteeRows: [] }) }
    finally { setExporting(false) }
  }

  return (
    <div>
      <SendEmailModal payload={emailPayload} onClose={() => setEmailPayload(null)} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DateRangePicker from={fromDate} to={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} />
          {loadingCost && (
            <svg className="h-4 w-4 animate-spin text-[#16a34a]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setEmailPayload({ kind: 'weekly', dateLabel, adsRows: buildRows(), guaranteeRows: [] })}
            className="flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black shadow-card
                       transition-colors hover:border-[#16a34a] hover:text-[#16a34a]
                       dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Send by Email
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black shadow-card
                       transition-colors hover:border-[#16a34a] hover:text-[#16a34a] disabled:opacity-60
                       dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>
      {loadingBudgets
        ? <div className="flex items-center gap-2 py-8 text-sm text-body dark:text-bodydark"><svg className="h-4 w-4 animate-spin text-[#16a34a]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Loading budgets…</div>
        : <BudgetTableSection accounts={accounts} budgets={adsBudgets} costByAccount={costByAccount} onUpdate={updateAds} pendingCost={loadingCost} />
      }
    </div>
  )
}

// ─── Google Guarantee Report Tab ──────────────────────────────────────────────

function GuaranteeReport({ accounts }: { accounts: AdsAccount[] }) {
  const { from: defaultFrom, to: defaultTo } = getDefaultDateRange()
  const [fromDate, setFromDate]             = useState(defaultFrom)
  const [toDate, setToDate]                 = useState(defaultTo)
  const [ggBudgets, setGgBudgets]           = useState<BudgetStore>({})
  const [loadingBudgets, setLoadingBudgets] = useState(true)
  const [ggPeriod, setGgPeriod]             = useState<Record<string, { spend: number; leads: number }>>({})
  const [loadingPeriod, setLoadingPeriod]   = useState(false)

  useEffect(() => {
    if (!accounts.length) return
    setLoadingBudgets(true)
    fetchSupabaseBudgets('guarantee_weekly').then(map => {
      const next: BudgetStore = {}
      for (const a of accounts) next[a.id] = { budget: map[a.id] ?? 0 }
      setGgBudgets(next)
    }).finally(() => setLoadingBudgets(false))
  }, [accounts])

  const fetchPeriod = useCallback(async (from: string, to: string) => {
    if (!accounts.length) return
    setLoadingPeriod(true)
    try {
      const { data } = await supabase
        .from('sem_guarantee_daily')
        .select('account_id, spend, leads')
        .in('account_id', accounts.map(a => a.id))
        .gte('date', from)
        .lte('date', to)
      const map: Record<string, { spend: number; leads: number }> = {}
      for (const r of data ?? []) {
        map[r.account_id] = {
          spend: (map[r.account_id]?.spend ?? 0) + Number(r.spend),
          leads: (map[r.account_id]?.leads ?? 0) + Number(r.leads),
        }
      }
      setGgPeriod(map)
    } finally { setLoadingPeriod(false) }
  }, [accounts])

  useEffect(() => { if (accounts.length) fetchPeriod(fromDate, toDate) }, [accounts, fromDate, toDate, fetchPeriod])

  const updateGg = (id: string, value: number) => {
    setGgBudgets(prev => {
      const next = { ...prev, [id]: { budget: value } }
      upsertSupabaseBudget(id, 'guarantee_weekly', value)
      return next
    })
  }

  const totalBudget = accounts.reduce((s, a) => s + (ggBudgets[a.id]?.budget ?? 0), 0)
  const totalSpend  = accounts.reduce((s, a) => s + (ggPeriod[a.id]?.spend ?? 0), 0)
  const totalLeads  = accounts.reduce((s, a) => s + (ggPeriod[a.id]?.leads ?? 0), 0)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DateRangePicker from={fromDate} to={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} accentColor="#3b82f6" />
          {loadingPeriod && (
            <svg className="h-4 w-4 animate-spin text-[#3b82f6]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
      </div>

      {loadingBudgets && <div className="flex items-center gap-2 py-4 text-sm text-body dark:text-bodydark"><svg className="h-4 w-4 animate-spin text-[#3b82f6]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Loading budgets…</div>}
      <div className="overflow-x-auto rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4">
              {['Status', 'Account Name', 'Budget', 'Period Spend', 'Leads', 'Cost / Lead', 'Remaining', '% Used'].map(h => (
                <th key={h} className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke dark:divide-strokedark">
            {accounts.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-body dark:text-bodydark">No accounts found.</td></tr>
            ) : accounts.map(a => {
              const budget    = ggBudgets[a.id]?.budget ?? 0
              const period    = ggPeriod[a.id]
              const spend     = period?.spend ?? 0
              const leads     = period?.leads ?? 0
              const cpl       = leads > 0 ? spend / leads : 0
              const remaining = budget > 0 ? budget - spend : null
              const pct       = budget > 0 && spend > 0 ? (spend / budget) * 100 : null
              const remNeg    = remaining !== null && remaining < 0
              return (
                <tr key={a.id} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                  <td className="px-5 py-4"><StatusBadge status={a.status} /></td>
                  <td className="max-w-[200px] truncate px-5 py-4 font-semibold text-black dark:text-[#E2E5E9]" title={a.name}>{a.name}</td>
                  <td className="px-5 py-4"><EditableCell value={budget} onChange={v => updateGg(a.id, v)} /></td>
                  <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">
                    {loadingPeriod ? <span className="text-xs italic opacity-50">Loading…</span> : spend > 0 ? fmtCurrency(spend) : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">
                    {loadingPeriod ? <span className="text-xs italic opacity-50">Loading…</span> : leads > 0 ? fmtNum(leads) : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">
                    {cpl > 0 ? fmtCurrency(cpl) : <span className="opacity-40">—</span>}
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
            {accounts.length > 0 && (
              <tr className="border-t-2 border-[#3b82f6]/30 bg-[#eff6ff] dark:bg-[#1e3a5f]/30">
                <td className="px-5 py-4" />
                <td className="px-5 py-4 text-xs font-bold uppercase text-[#3b82f6]">Totals</td>
                <td className="px-5 py-4 tabular-nums font-bold text-[#3b82f6]">{totalBudget > 0 ? fmtCurrency(totalBudget) : '—'}</td>
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

      <div className="mt-10 border-t border-stroke pt-8 dark:border-strokedark">
        <GuaranteeAnalyticsCards accounts={accounts} />
      </div>
    </div>
  )
}

// ─── Monthly Overview Tab ─────────────────────────────────────────────────────

function MonthlyBudgetOverview({ accounts }: { accounts: AdsAccount[] }) {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear())
  const [monthlySpend,  setMonthlySpend]  = useState<Record<string, number>>({})
  const [loadingMonth,  setLoadingMonth]  = useState(false)
  const [budgets, setBudgets]             = useState<Record<string, number>>(loadMonthlyStore)
  const [exporting, setExporting]         = useState(false)
  const [emailPayload, setEmailPayload]   = useState<EmailReportPayload | null>(null)

  useEffect(() => {
    if (!accounts.length) return
    fetchSupabaseBudgets('ads_monthly').then(map => {
      if (!Object.keys(map).length) return
      setBudgets(prev => { const next = { ...prev, ...map }; saveMonthlyStore(next); return next })
    })
  }, [accounts])

  const fetchMonthly = useCallback(async (month: number, year: number) => {
    setLoadingMonth(true)
    try {
      const { data, error } = await supabase
        .from('sem_yearly_ads')
        .select('account_id, spend')
        .eq('year', year)
        .eq('month', ALL_MONTHS[month])
      if (error) return
      const map: Record<string, number> = {}
      for (const r of data ?? []) map[r.account_id] = r.spend
      setMonthlySpend(map)
    } finally { setLoadingMonth(false) }
  }, [])

  useEffect(() => { fetchMonthly(selectedMonth, selectedYear) }, [selectedMonth, selectedYear, fetchMonthly])

  const updateBudget = (id: string, v: number) => {
    setBudgets(prev => { const next = { ...prev, [id]: v }; saveMonthlyStore(next); return next })
    upsertSupabaseBudget(id, 'ads_monthly', v)
  }

  const buildMonthlyRows = () => accounts.map(a => ({
    status: a.status, accountName: a.name, budget: budgets[a.id] ?? 0, spend: monthlySpend[a.id] ?? 0,
  }))

  async function handleExport() {
    setExporting(true)
    const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`
    try { await generateMonthlyBudgetPdf({ monthLabel, rows: buildMonthlyRows() }) }
    finally { setExporting(false) }
  }

  const totalBudget = accounts.reduce((s, a) => s + (budgets[a.id] ?? 0), 0)
  const totalSpend  = accounts.reduce((s, a) => s + (monthlySpend[a.id] ?? 0), 0)

  return (
    <div>
      <SendEmailModal payload={emailPayload} onClose={() => setEmailPayload(null)} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
            className="h-9 rounded-lg border border-stroke bg-white px-3 text-sm font-medium outline-none
                       focus:border-[#16a34a] dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
            {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="h-9 rounded-lg border border-stroke bg-white px-3 text-sm font-medium outline-none
                       focus:border-[#16a34a] dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {loadingMonth && (
            <svg className="h-4 w-4 animate-spin text-[#16a34a]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setEmailPayload({ kind: 'monthly', monthLabel: `${MONTH_NAMES[selectedMonth]} ${selectedYear}`, rows: buildMonthlyRows() })}
            className="flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black shadow-card
                       transition-colors hover:border-[#16a34a] hover:text-[#16a34a]
                       dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Send by Email
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black shadow-card
                       transition-colors hover:border-[#16a34a] hover:text-[#16a34a] disabled:opacity-60
                       dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4">
              {['Status', 'Account Name', 'Monthly Budget', 'Spend (GA)', 'Remaining', '% Used'].map(h => (
                <th key={h} className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke dark:divide-strokedark">
            {accounts.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-body dark:text-bodydark">No accounts found.</td></tr>
            ) : accounts.map(a => {
              const spend = monthlySpend[a.id] ?? 0
              const budget = budgets[a.id] ?? 0
              const remaining = budget > 0 ? budget - spend : null
              const pct = budget > 0 ? (spend / budget) * 100 : null
              const remNeg = remaining !== null && remaining < 0
              return (
                <tr key={a.id} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                  <td className="px-5 py-4"><StatusBadge status={a.status} /></td>
                  <td className="max-w-[200px] truncate px-5 py-4 font-semibold text-black dark:text-[#E2E5E9]" title={a.name}>{a.name}</td>
                  <td className="px-5 py-4"><EditableCell value={budget} onChange={v => updateBudget(a.id, v)} /></td>
                  <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{spend > 0 ? fmtCurrency(spend) : <span className="opacity-40">—</span>}</td>
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
            {accounts.length > 0 && (
              <tr className="border-t-2 border-[#16a34a]/30 bg-[#eef7f2] dark:bg-[#1a382e]">
                <td className="px-5 py-4" />
                <td className="px-5 py-4 text-xs font-bold uppercase text-[#16a34a]">Totals</td>
                <td className="px-5 py-4 tabular-nums font-bold text-[#16a34a]">{totalBudget > 0 ? fmtCurrency(totalBudget) : '—'}</td>
                <td className="px-5 py-4 tabular-nums font-bold text-[#16a34a]">{totalSpend > 0 ? fmtCurrency(totalSpend) : '—'}</td>
                <td className="px-5 py-4 tabular-nums font-bold text-[#16a34a]">{totalBudget > 0 ? fmtCurrency(totalBudget - totalSpend) : '—'}</td>
                <td className="px-5 py-4 tabular-nums font-bold text-[#16a34a]">
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

// ─── Main Page ────────────────────────────────────────────────────────────────

type ReportTab = 'ads' | 'guarantee' | 'monthly'

export function SEMReportes() {
  const [activeTab, setActiveTab]         = useState<ReportTab>('ads')
  const [accounts, setAccounts]           = useState<AdsAccount[]>([])
  const [adsAccountIds, setAdsAccountIds] = useState<Set<string>>(new Set())
  const [ggAccountIds, setGgAccountIds]   = useState<Set<string>>(new Set())
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const year = new Date().getFullYear()
        const [acctRes, adsRes, ggRes] = await Promise.all([
          supabase.from('sem_accounts').select('id, name, status').order('name'),
          supabase.from('sem_yearly_ads').select('account_id').eq('year', year),
          supabase.from('sem_yearly_guarantee').select('account_id').eq('year', year),
        ])
        setAccounts(acctRes.data ?? [])
        setAdsAccountIds(new Set((adsRes.data ?? []).map(r => r.account_id)))
        setGgAccountIds(new Set((ggRes.data ?? []).map(r => r.account_id)))
      } finally { setLoading(false) }
    })()
  }, [])

  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">
          Reports
          <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-bold bg-[#16a34a]/20 text-[#16a34a] align-middle">
            SEM Intelligence
          </span>
        </h1>
        <p className="mt-1 text-sm text-body dark:text-bodydark">
          Budget tracking and performance reports for all Google Ads accounts. Export to PDF for client delivery.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex w-fit gap-1 rounded-xl border border-stroke bg-gray-2 p-1 dark:border-strokedark dark:bg-meta-4">
        {([
          { id: 'ads',       label: 'Google Ads Budget Report' },
          { id: 'guarantee', label: 'Google Guarantee Report' },
          { id: 'monthly',   label: 'OpenAI Ads' },
        ] as { id: ReportTab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-150
              ${activeTab === t.id
                ? 'bg-white text-black shadow-sm dark:bg-boxdark dark:text-[#E2E5E9]'
                : 'text-body hover:text-black dark:text-bodydark dark:hover:text-white'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-body dark:text-bodydark">
          <svg className="h-4 w-4 animate-spin text-[#16a34a]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading accounts…
        </div>
      ) : (
        <>
          {activeTab === 'ads'       && <AdsReport accounts={accounts.filter(a => adsAccountIds.has(a.id))} />}
          {activeTab === 'guarantee' && <GuaranteeReport accounts={accounts.filter(a => ggAccountIds.has(a.id))} />}
          {activeTab === 'monthly'   && <MonthlyBudgetOverview accounts={accounts.filter(a => adsAccountIds.has(a.id))} />}
        </>
      )}
    </div>
  )
}
