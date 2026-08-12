import { useEffect, useState } from 'react'
import { getDateRange } from './useSocialDashboardState'

export interface CampaignInsightsPoint {
    date: string
    spend: number
    impressions: number
    clicks: number
    ctr: number
    cpc: number
    reach: number
}

// Fetched only when a campaign's detail modal is open — the daily breakdown
// is one Graph API call per open campaign, not per row in the table.
export function useCampaignInsightsSeries(campaignId: string | null, days: number) {
    const [series, setSeries] = useState<CampaignInsightsPoint[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!campaignId) { setSeries([]); setError(''); return }
        let active = true
        setLoading(true)
        setError('')

        const { startDate, endDate } = getDateRange(days)
        fetch(`/api/social/campaigns/${encodeURIComponent(campaignId)}/insights?since=${startDate}&until=${endDate}`)
            .then(async r => {
                const body = await r.json()
                if (!r.ok) throw new Error(body.error ?? `Request failed (${r.status})`)
                if (active) setSeries(body.series ?? [])
            })
            .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Failed to load campaign history') })
            .finally(() => { if (active) setLoading(false) })

        return () => { active = false }
    }, [campaignId, days])

    return { series, loading, error }
}
