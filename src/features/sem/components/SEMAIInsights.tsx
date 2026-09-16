import { PerformanceAssistant } from '@/components/ai/PerformanceAssistant'

interface Props {
  contextId: string
  dateRange: { startDate: string; endDate: string }
  disabled?: boolean
  accountName: string
  summary: {
    impressions: number
    clicks: number
    ctr: number
    avg_cpc: number
    cost: number
    conversions: number
    cost_per_conversion: number
  }
  campaigns: {
    name: string
    impressions: number
    clicks: number
    ctr: number
    avg_cpc: number
    cost: number
    conversions: number
  }[]
}

export function SEMAIInsights({ contextId, dateRange, disabled, ...data }: Props) {
  return <PerformanceAssistant key={`${contextId}:${dateRange.startDate}:${dateRange.endDate}`} module="sem" identity={contextId} name={data.accountName} dateRange={dateRange} disabled={disabled || !data.accountName} context={{ ...data, campaigns: data.campaigns.slice(0, 8), dateRange }} />
}
