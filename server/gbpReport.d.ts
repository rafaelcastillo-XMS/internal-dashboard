export interface GbpReportInput {
  site: string
  ga4?: string
  client?: string
  gbpAccount?: string
  gbpLocation: string
  startDate: string
  endDate: string
}

export function getGbpReport(input: GbpReportInput): Promise<Record<string, unknown>>

export interface GbpLocationOption {
  accountName: string
  locationName: string
  title: string
  websiteUri: string
}

export function listGbpLocations(): Promise<GbpLocationOption[]>
