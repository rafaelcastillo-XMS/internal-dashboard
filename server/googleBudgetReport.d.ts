export interface GoogleBudgetReport {
  accountId: string
  platform: 'ads' | 'guarantee'
  dateRange: { start: string; end: string }
  spend: number
  daily: { date: string; costMicros: number; spend: number }[]
  fetchedAt: string
  source: string
}
export function getGoogleBudgetReport(params: { accountId: string; platform: string; startDate: string; endDate: string; refresh?: boolean }): Promise<GoogleBudgetReport>
