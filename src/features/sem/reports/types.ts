export type ReportStatus = 'Draft' | 'In Review' | 'Ready'

export type SlideType =
  | 'cover'
  | 'strategy'
  | 'custom'
  | 'google_ads_kpis'
  | 'keywords'
  | 'ads'
  | 'search_terms'
  | 'devices_day_hour'
  | 'lsa_key_results'
  | 'highlights'
  | 'lsa_notes'
  | 'next_steps'
  | 'thank_you'

export interface Report {
  id: string
  clientId: string
  clientName: string
  clientLogo: string
  month: string
  year: number
  status: ReportStatus
  slides: Slide[]
  createdAt: string
  updatedAt: string
}

export interface Slide {
  id: string
  type: SlideType
  title: string
  order: number
  content: SlideContent
  notes: string
}

export interface SlideContent {
  reportTitle?: string
  subtitle?: string
  dataSource?: ReportDataSource
  textBlocks?: TextBlock[]
  kpis?: KpiMetric[]
  tables?: ReportTableData[]
  ads?: AdPerformanceCard[]
  charts?: ChartBlockData[]
  highlights?: string[]
  noteBlocks?: TextBlock[]
  supportingImageSrc?: string
  lsaKeyResults?: LsaKeyResultsData
  finalMessage?: string
}

export interface LsaKeyResultsData {
  totalSpend: number
  chargedLeads: number
  adImpressions: number
  topImpressionRate: number
  absoluteTopImpressionRate: number
}

export interface ReportDataSource {
  source: 'mock' | 'google_ads_api' | 'supabase_sem_keywords' | 'lsa_api'
  connectionStatus: 'mock_not_connected' | 'connected' | 'empty' | 'error'
  clientId?: string
  accountId?: string
  rangeKey?: string
  integrationTarget?: string
  dateRange?: {
    start: string
    end: string
  }
  updatedAt?: string
  message?: string
}

export interface TextBlock {
  id: string
  label: string
  value: string
}

export interface KpiMetric {
  id: string
  label: string
  value: string
  comparison?: string
  trend?: 'up' | 'down' | 'flat'
}

export interface ReportTableColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

export interface ReportTableData {
  id: string
  title: string
  dataSource?: ReportDataSource
  columns: ReportTableColumn[]
  rows: Record<string, string>[]
}

export interface AdPerformanceCard {
  id: string
  type: 'Search Ad' | 'Performance Max'
  headline: string
  description: string
  status: string
  imageSrc?: string
  metrics: KpiMetric[]
}

export interface ChartBlockData {
  id: string
  title: string
  description?: string
  series: ChartSeriesPoint[]
  deviceData?: DevicePerformanceDatum[]
  heatmapData?: DayHourHeatmapData
}

export interface DevicePerformanceDatum {
  key: string
  label: string
  cost: number
  clicks: number
  conversions: number
}

export interface DayHourHeatmapData {
  metric: 'impressions'
  days: string[]
  hours: number[]
  values: number[][]
}

export interface ChartSeriesPoint {
  label: string
  value: number
  displayValue: string
  detail?: string
}
