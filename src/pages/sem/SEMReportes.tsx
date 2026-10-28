import { useState, useEffect, useMemo, Fragment } from 'react'
import { Download, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateMonthlyBudgetPdf, generateMonthlyBudgetPdfBytes, generateOpenAiAdsPdf, generateWeeklyBudgetPdf, generateWeeklyBudgetPdfBytes } from '@/features/sem/lib/generateReportsPdf'
import type { PdfMonthlyRow, PdfOpenAiRow, PdfWeeklyRow } from '@/features/sem/lib/generateReportsPdf'
import { captureTableAsImage } from '@/features/sem/lib/tableToImage'

import { useOpenAiBudgetReport, summarizeOpenAiBudget, type OpenAiClientResult } from '@/features/sem/reports/useOpenAiBudgetReport'

import { buildWeeklyReportTable, buildMonthlyReportTable } from '@/features/sem/reports/budgetReportTables'
import { WeeklyGroupedTable, type WeeklyDisplayRow } from '@/features/sem/reports/WeeklyGroupedTable'
import { groupBudgetRows } from '@/features/sem/reports/groupBudgetRows'
import { reportRequest } from '@/features/sem/reports/reportLoading'
import { BudgetTableSkeleton } from '@/features/sem/reports/BudgetTableSkeleton'
import { MONTHLY_HEADERS, LSA_HEADERS, OPENAI_HEADERS } from '@/features/sem/reports/reportTableHeaders'
import { useBudgetReportData, type BudgetReportData } from '@/features/sem/reports/useBudgetReportData'
import { reportMonthWeeks, resolveReportBudget, weekSpend } from '@/features/sem/reports/budgetReportData'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdsAccount { id: string; name: string; status: string }

interface BudgetRow { budget: number }

type BudgetStore = Record<string, BudgetRow>

// ─── Date range helpers ───────────────────────────────────────────────────────

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

function EditableCell({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
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
    <button onClick={start} disabled={disabled} title="Click to edit"
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

// ─── Weekly / Monthly period tabs ─────────────────────────────────────────────

type ReportPeriod = 'weekly' | 'monthly'

// ─── Monthly Report (by client) ───────────────────────────────────────────────

const PAYMENT_SOURCES = ["Client's CC", 'XMS CC'] as const

type MonthlyPlatform = 'Google Ads' | 'Google Guarantee' | 'OpenAI Ads'
interface MonthlyItem { platform: MonthlyPlatform; budget: number | null; spend: number | null; budgetPeriod?: 'daily' | 'lifetime'; clientId?: string; note?: string }

interface MonthlyCell { refunded: number; paid_with: string }

const fmtAccountId = (id: string) =>
  /^\d{10}$/.test(id) ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id

export function MonthlyReport({ report, openai, month, year, onChangePeriod }: {
  report: BudgetReportData
  openai: ReturnType<typeof useOpenAiBudgetReport>
  month: number
  year: number
  onChangePeriod: (year: number, month: number) => void
}) {
  const { clients, eligible: selectedAccounts } = report
  const accentColor = '#16a34a'
  const setMonth = (value: number) => onChangePeriod(year, value)
  const setYear = (value: number) => onChangePeriod(value, month)
  const [storedCells, setCells] = useState<Record<string, MonthlyCell>>({})
  const [loading, setLoading] = useState(true)
  const [cellsReady, setCellsReady] = useState('')
  const cells = cellsReady === `${year}:${month}` ? storedCells : {}
  const [paymentRevision, setPaymentRevision] = useState(0)
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>({})
  const [exporting, setExporting] = useState(false)
  const [preparingEmail, setPreparingEmail] = useState(false)
  const [emailPayload, setEmailPayload] = useState<EmailReportPayload | null>(null)
  const reportMetadataError = (source: string, error: unknown) => setMetadataErrors(prev => ({ ...prev, [source]: error instanceof Error ? error.message : String(error) }))

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    setLoading(true); setCells({})
    setMetadataErrors({})
    reportRequest(supabase.from('sem_monthly_cells').select('account_id, platform, refunded, paid_with').eq('year', year).eq('month_index', month).abortSignal(controller.signal), 12000)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        if (cancelled) return
        const next: Record<string, MonthlyCell> = {}
        for (const row of data ?? []) next[`${row.account_id}:${row.platform}`] = { refunded: Number(row.refunded), paid_with: row.paid_with ?? '' }
        setCells(next)
      }).catch(error => { if (!cancelled) reportMetadataError('Payments', error) })
      .finally(() => { if (!cancelled) { setLoading(false); setCellsReady(`${year}:${month}`); controller.abort() } })
    return () => { cancelled = true; controller.abort() }
  }, [year, month, paymentRevision])

  const adsSpend: Record<string, number | null> = {}
  const ggSpend: Record<string, number | null> = {}
  const adsBudget: Record<string, number | null> = {}
  const ggBudget: Record<string, number | null> = {}
  for (const { account, googleAds, googleGuarantee } of selectedAccounts) {
    if (googleAds) {
      adsSpend[account.id] = report.stateFor(account.id, 'ads').data?.spend ?? null
      adsBudget[account.id] = resolveReportBudget(account.id, 'Google Ads', clients, report.budgets)
    }
    if (googleGuarantee) {
      ggSpend[account.id] = report.stateFor(account.id, 'guarantee').data?.spend ?? null
      ggBudget[account.id] = resolveReportBudget(account.id, 'Google Guarantee', clients, report.budgets)
    }
  }
  const spendErrors = report.errors
  const reportLoading = report.metadataLoading && !selectedAccounts.length && !openai.results.length

  const patchCell = (accountId: string, platform: MonthlyPlatform, patch: Partial<MonthlyCell>) => {
    if (loading || cellsReady !== `${year}:${month}` || metadataErrors.Payments) return
    const key = `${accountId}:${platform}`
    const current: MonthlyCell = cells[key] ?? { refunded: 0, paid_with: '' }
    const merged: MonthlyCell = { ...current, ...patch }
    setCells(prev => ({ ...prev, [key]: merged }))
    supabase.from('sem_monthly_cells')
      .upsert(
        { account_id: accountId, platform, year, month_index: month, refunded: merged.refunded, paid_with: merged.paid_with, updated_at: new Date().toISOString() },
        { onConflict: 'account_id,platform,year,month_index' },
      )
      .then(({ error }) => { if (error) reportMetadataError('Payments', new Error(error.message)) })
  }

  // Use activation and explicit LSA mappings before building table/export rows.
  const accountGroups = selectedAccounts
    .map(({ account: acct, googleAds, googleGuarantee }) => {
      const items: MonthlyItem[] = []
      if (googleAds) items.push({ platform: 'Google Ads', budget: adsBudget[acct.id] ?? null, spend: adsSpend[acct.id] ?? null })
      if (googleGuarantee) items.push({ platform: 'Google Guarantee', budget: ggBudget[acct.id] ?? null, spend: ggSpend[acct.id] ?? null })
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
  const monthlyExportBlocked = report.loading || loading || cellsReady !== `${year}:${month}` || openai.loading || Object.values(metadataErrors).some(Boolean) || spendErrors.length > 0 || !!openai.error || openai.results.some(r => summarizeOpenAiBudget(r).spend === null)

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
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-body dark:text-bodydark">
        <p>{report.loading || openai.loading ? 'Loading spend — completed accounts remain visible.' : 'Monthly spend from the same daily data used by the weekly report.'}</p>
        <button type="button" onClick={() => { report.retry(); openai.retry(); setPaymentRevision(value => value + 1) }} className="font-semibold text-[#16a34a]">Refresh data</button>
      </div>
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
            {Array.from({ length: new Date().getFullYear() - 2024 + 2 }, (_, i) => 2024 + i).map(y => <option key={y} value={y}>{y}</option>)}
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
      {openai.results.filter(r => !r.pending && summarizeOpenAiBudget(r).spend === null).map(r => <p key={r.clientId} role="alert" className="mb-3 text-sm text-red-500">{r.clientName}: {r.error ?? r.insightsError}</p>)}
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
                        className={idx === 0 ? 'bg-[#eef5ff] hover:bg-[#e4efff] dark:bg-[#17233a] dark:hover:bg-[#20304d]' : 'hover:bg-gray-2 dark:hover:bg-meta-4'}>
                        <td className="max-w-[220px] truncate px-5 py-4 font-semibold text-black dark:text-[#E2E5E9]" title={acct.name}>
                          {display[0]}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{display[1]}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-black dark:text-[#E2E5E9]">{it.platform}</td>
                        <td className="px-5 py-4 tabular-nums text-black dark:text-[#E2E5E9]">
                          {(it.budget ?? 0) > 0 ? display[3] : <span className="opacity-40 text-body dark:text-bodydark">—</span>}
                        </td>
                        <td className="px-5 py-4 tabular-nums font-semibold text-black dark:text-[#E2E5E9]">
                          {it.spend !== null ? display[4]
                            : (it.platform === 'OpenAI Ads' ? openai.results.find(row => row.clientId === it.clientId)?.pending : report.stateFor(it.acct.id, it.platform === 'Google Ads' ? 'ads' : 'guarantee').status === 'loading')
                              ? <span className="inline-flex items-center gap-2 text-xs font-normal text-body dark:text-bodydark"><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />Loading…</span>
                              : <span className="text-xs font-normal text-red-500">Unavailable · Retry</span>}
                        </td>
                        <td className="px-5 py-4">{it.platform === 'OpenAI Ads' ? <span className="opacity-40">—</span> : <EditableCell disabled={loading || cellsReady !== `${year}:${month}` || !!metadataErrors.Payments} value={cell?.refunded ?? 0} onChange={v => patchCell(it.acct.id, it.platform, { refunded: v })} />}</td>
                        <td className="px-5 py-4">
                          {it.platform === 'OpenAI Ads' ? <span className="opacity-40">—</span> : <select disabled={loading || cellsReady !== `${year}:${month}` || !!metadataErrors.Payments} value={cell?.paid_with ?? ''} onChange={e => patchCell(it.acct.id, it.platform, { paid_with: e.target.value })} className={selectCls}>
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
  const [period, setPeriod] = useState<ReportPeriod>('weekly')
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const weeks = useMemo(() => reportMonthWeeks(year, month), [year, month])
  const report = useBudgetReportData(year, month)
  const openai = useOpenAiBudgetReport(report.startDate, report.endDate, weeks)
  const { clients: budgetClients, eligible } = report
  const weekDateLabel = `${MONTH_NAMES[month]} ${year} · Weekly spend`

  const groupedWeeklyRows: WeeklyDisplayRow[] = eligible.flatMap(({ account, googleAds, googleGuarantee }) =>
    (['Google Ads', 'Google Guarantee'] as const).filter(platform => platform === 'Google Ads' ? googleAds : googleGuarantee).map(platform => {
      const state = report.stateFor(account.id, platform === 'Google Ads' ? 'ads' : 'guarantee')
      return { accountId: account.id, name: account.name, status: account.status, platform,
        budget: resolveReportBudget(account.id, platform, budgetClients, report.budgets),
        spend: state.data?.spend ?? null, weeklySpend: weekSpend(state.data, weeks), loading: state.status === 'loading',
        note: state.error,
      }
    }))
  for (const result of openai.results) {
    const summary = summarizeOpenAiBudget(result)
    groupedWeeklyRows.push({ accountId: result.clientId, clientId: result.clientId, name: result.clientName, platform: 'OpenAI Ads', status: 'active',
      budget: summary.budget, budgetPeriod: summary.budgetPeriod, spend: summary.spend,
      weeklySpend: result.weeklySpend, weeklyPending: result.weeklyPending, loading: result.pending,
      note: result.error || result.insightsError || result.weeklyErrors?.filter(Boolean).join('; ') || undefined,
    })
  }

  const weeklyAdsRows: PdfWeeklyRow[] = groupedWeeklyRows.filter(row => row.platform === 'Google Ads').map(row => ({ status: row.status, accountName: row.name, budget: row.budget ?? 0, cost: row.spend ?? 0 }))
  const weeklyGuaranteeRows: PdfWeeklyRow[] = groupedWeeklyRows.filter(row => row.platform === 'Google Guarantee').map(row => ({ status: row.status, accountName: row.name, budget: row.budget ?? 0, cost: row.spend ?? 0 }))
  const weeklyOpenaiRows: PdfOpenAiRow[] = groupedWeeklyRows.filter(row => row.platform === 'OpenAI Ads').map(row => ({ clientName: row.name, campaignName: 'All campaigns', status: 'active', budget: row.budget ?? 0, budgetPeriod: row.budgetPeriod, spend: row.spend ?? 0, cpc: 0, impressions: 0 }))
  const weeklyLoading = report.loading || openai.loading
  const weeklyTable = buildWeeklyReportTable(groupedWeeklyRows, budgetClients, weekDateLabel, weeks)
  const weeklyErrors = [...report.errors, ...(openai.error ? [openai.error] : []), ...openai.results.flatMap(row => [row.error, row.insightsError, ...(row.weeklyErrors ?? [])].filter((error): error is string => !!error).map(error => `${row.clientName}: ${error}`))]
  const weeklyExportBlocked = weeklyLoading || weeklyErrors.length > 0 || groupedWeeklyRows.some(row => row.spend === null || row.weeklySpend?.some(value => value === null))

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

      <div hidden={period !== 'monthly'}>
        <MonthlyReport report={report} openai={openai} month={month} year={year} onChangePeriod={(nextYear, nextMonth) => { setYear(nextYear); setMonth(nextMonth) }} />
      </div>
      <div hidden={period !== 'weekly'}>
          <SendEmailModal payload={weeklyEmailPayload} onClose={() => setWeeklyEmailPayload(null)} />
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-body dark:text-bodydark" htmlFor="weekly-report-month">Month</label>
              <select id="weekly-report-month" value={month} onChange={event => setMonth(Number(event.target.value))} className="h-9 rounded-lg border border-stroke bg-white px-3 text-sm dark:border-strokedark dark:bg-boxdark dark:text-white">{MONTH_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}</select>
              <select aria-label="Weekly report year" value={year} onChange={event => setYear(Number(event.target.value))} className="h-9 rounded-lg border border-stroke bg-white px-3 text-sm dark:border-strokedark dark:bg-boxdark dark:text-white">{Array.from({ length: new Date().getFullYear() - 2024 + 2 }, (_, index) => 2024 + index).map(value => <option key={value} value={value}>{value}</option>)}</select>
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

          {weeklyErrors.length > 0 && <div role="alert" className="mb-3 text-sm text-red-500">{weeklyErrors.map((error, index) => <p key={index}>{error}</p>)}</div>}
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-body dark:text-bodydark">
            <p>{weeklyLoading ? 'Loading spend — each account appears as soon as it is ready.' : 'Actual spend by week: days 1–7, 8–14, 15–21, 22–28 and 29–end of month.'}</p>
            <button type="button" onClick={() => { report.retry(); openai.retry() }} className="shrink-0 font-semibold text-[#16a34a]">Refresh data</button>
          </div>
          {report.metadataLoading && !groupedWeeklyRows.length ? <BudgetTableSkeleton headers={weeklyTable.headers} /> : <WeeklyGroupedTable table={weeklyTable} />}
      </div>
    </div>
  )
}
