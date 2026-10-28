import type { MonthlyBudgetClient } from './monthlyBudgetAccounts'

export interface ReportAccount { id: string; name: string; status: string }
export interface ReportBudget { account_id: string; report_type: string; budget: number }
export interface ReportWeek { label: string; from: string; to: string }
export interface ReportSpend {
  spend: number
  daily: { date: string; spend: number; costMicros?: number }[]
  fetchedAt: string
}
export type SpendState = { status: 'loading' | 'ready' | 'error'; data?: ReportSpend; error?: string }
export const spendKey = (id: string, platform: string) => `${id}:${platform}`
export const ymd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function reportMonthWeeks(year: number, month: number): ReportWeek[] {
  const last = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: Math.ceil(last / 7) }, (_, index) => ({
    label: `Week ${index + 1}`,
    from: ymd(new Date(year, month, index * 7 + 1)),
    to: ymd(new Date(year, month, Math.min(index * 7 + 7, last))),
  }))
}

export function weekSpend(data: ReportSpend | undefined, weeks: ReportWeek[]): (number | null)[] {
  return weeks.map(week => {
    if (!data) return null
    const micros = data.daily.filter(row => row.date >= week.from && row.date <= week.to)
      .reduce((sum, row) => sum + (row.costMicros ?? Math.round(row.spend * 1000000)), 0)
    return Math.round(micros / 10000) / 100
  })
}

// Integrations currently stores both platform budgets under sem_account_id.
// A dedicated LSA override wins; otherwise follow the linked client's Ads ID.
export function resolveReportBudget(accountId: string, platform: 'Google Ads' | 'Google Guarantee', clients: MonthlyBudgetClient[], budgets: ReportBudget[]): number | null {
  const type = platform === 'Google Ads' ? 'ads_monthly' : 'guarantee_monthly'
  const direct = budgets.find(row => row.account_id === accountId && row.report_type === type)
  if (direct) return Number(direct.budget)
  const client = clients.find(client => client.lsa_account_id === accountId)
  const linked = platform === 'Google Guarantee' && client?.sem_account_id
    ? budgets.find(row => row.account_id === client.sem_account_id && row.report_type === type)
    : undefined
  return linked ? Number(linked.budget) : null
}

export async function mapReportRequests<T>(items: T[], concurrency: number, run: (item: T) => Promise<void>) {
  let index = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) await run(items[index++])
  }))
}
