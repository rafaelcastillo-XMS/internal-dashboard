export interface QuarterlyReportInput {
  site: string
  ga4?: string
  startDate: string
  endDate: string
}

export function getQuarterlyReportData(input: QuarterlyReportInput): Promise<Record<string, unknown>>
