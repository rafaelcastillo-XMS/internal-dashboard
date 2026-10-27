import { groupBudgetRows, type BudgetPlatform } from './groupBudgetRows'
import { WEEKLY_HEADERS, MONTHLY_HEADERS } from './reportTableHeaders'
import type { MonthlyBudgetClient } from './monthlyBudgetAccounts'

export interface WeeklyDisplayRow {
  accountId: string; clientId?: string; name: string; platform: BudgetPlatform
  campaign?: string; status: string; budget: number | null; spend: number | null
  budgetPeriod?: 'daily' | 'lifetime'; leads?: number; note?: string
}
const money = (n: number | null) => n === null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export interface BudgetTableRow { key: string; cells: (string | number)[]; note?: string }
export interface BudgetTableGroup { id: string; name: string; rows: BudgetTableRow[] }
export interface BudgetReportTable {
  headers: string[]
  groups: BudgetTableGroup[]
  totals: BudgetTableRow[]
  summary: { label: string; value: string }[]
}

export function buildWeeklyReportTable(rows: WeeklyDisplayRow[], clients: MonthlyBudgetClient[], dateLabel: string): BudgetReportTable {
  void dateLabel // Kept in the public builder contract for existing report exporters.
  const groups = groupBudgetRows(rows, clients)
  const values = (r: WeeklyDisplayRow) => [
    r.platform,
    r.budget ? `${money(r.budget)}${r.budgetPeriod === 'daily' ? '/day' : r.budgetPeriod === 'lifetime' ? ' lifetime' : ''}` : '—',
    money(r.spend),
  ]
  return {
    headers: WEEKLY_HEADERS,
    groups: groups.map(g => ({ id: g.id, name: g.name, rows: g.items.map((r, i) => ({ key: `${g.id}:${r.accountId}:${r.platform}:${i}`, note: r.note, cells: ['', r.accountId, ...values(r)] })) })),
    totals: [],
    summary: financialSummary(rows),
  }
}

export interface MonthlyDisplayRow {
  accountId: string; platform: BudgetPlatform; budget: number | null; spend: number | null
  budgetPeriod?: 'daily' | 'lifetime'; refunded: number; paidWith: string
}

export function monthlyReportValues(row: MonthlyDisplayRow): (string | number)[] {
  const openai = row.platform === 'OpenAI Ads'
  return [openai ? '—' : row.accountId, row.platform,
    (row.budget ?? 0) > 0 ? `${money(row.budget)}${row.budgetPeriod === 'daily' ? '/day' : row.budgetPeriod === 'lifetime' ? ' lifetime' : ''}` : '—',
    money(row.spend), !openai && row.refunded > 0 ? money(row.refunded) : '—', !openai && row.paidWith ? row.paidWith : '—']
}

/** Input is the exact ordered client groups already selected by MonthlyReport. */
export function buildMonthlyReportTable(groups: { id: string; name: string; items: MonthlyDisplayRow[] }[]): BudgetReportTable {
  const rows = groups.flatMap(g => g.items)
  return {
    headers: MONTHLY_HEADERS,
    groups: groups.map(g => ({ id: g.id, name: g.name, rows: g.items.map((r, i) => ({ key: `${r.accountId}:${r.platform}:${i}`, cells: [i === 0 ? g.name : '', ...monthlyReportValues(r)] })) })),
    totals: [], // Monthly's dashboard has no footer; financial totals are in the PDF summary.
    summary: [...financialSummary(rows), { label: 'Expected credits refunded', value: money(rows.filter(r => r.platform !== 'OpenAI Ads').reduce((sum, r) => sum + r.refunded, 0)) }],
  }
}

function financialSummary(rows: { platform: BudgetPlatform; budget: number | null; spend: number | null; budgetPeriod?: 'daily' | 'lifetime' }[]) {
  const google = rows.filter(r => r.platform !== 'OpenAI Ads')
  const summary = [{ label: 'Google monthly budgets', value: money(google.reduce((sum, r) => sum + (r.budget ?? 0), 0)) },
    { label: 'Period spend - all platforms', value: rows.some(r => r.spend === null) ? 'Unavailable' : money(rows.reduce((sum, r) => sum + (r.spend ?? 0), 0)) }]
  // Daily and lifetime budgets must never be added to Google monthly budgets.
  for (const period of ['daily', 'lifetime'] as const) {
    const items = rows.filter(r => r.platform === 'OpenAI Ads' && r.budgetPeriod === period)
    if (items.length) summary.push({ label: `OpenAI ${period} budget`, value: money(items.reduce((sum, r) => sum + (r.budget ?? 0), 0)) })
  }
  return summary
}
