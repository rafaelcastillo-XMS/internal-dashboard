import { PerformanceAssistant } from '@/components/ai/PerformanceAssistant'

interface GscData {
  totalClicks: number
  totalImpressions: number
  avgPosition: number
  queries?: { query: string; clicks: number; impressions: number; position: number; ctr: number }[]
}

interface Ga4Data {
  engagedSessions: number
  conversionRate: number
  topPages?: { page: string; sessions?: number }[]
}

interface Props {
  contextId: string
  dateRange: { startDate: string; endDate: string }
  disabled?: boolean
  clientName: string
  gscSite: string
  gsc: GscData
  ga4: Ga4Data
  psiScore?: number | null
}

export function SEOAIInsights({ contextId, dateRange, disabled, ...data }: Props) {
  return <PerformanceAssistant key={`${contextId}:${dateRange.startDate}:${dateRange.endDate}`} module="seo" identity={contextId} name={data.clientName || data.gscSite} dateRange={dateRange} disabled={disabled || !data.gscSite} context={{
    clientName: data.clientName, gscSite: data.gscSite, dateRange, psiScore: data.psiScore,
    gsc: { totalClicks: data.gsc.totalClicks, totalImpressions: data.gsc.totalImpressions, avgPosition: data.gsc.avgPosition, queries: data.gsc.queries?.slice(0, 8) },
    ga4: { engagedSessions: data.ga4.engagedSessions, conversionRate: data.ga4.conversionRate, topPages: data.ga4.topPages?.slice(0, 5) },
  }} />
}
