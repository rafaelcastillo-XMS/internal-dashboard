export interface GbpReportInput {
  site: string
  ga4?: string
  startDate: string
  endDate: string
}

export function getGbpReport(input: GbpReportInput): Promise<Record<string, unknown>>
