import { useCallback, useEffect, useState } from 'react'
import { getDateRange } from './useSocialDashboardState'

export interface PageInfo {
    id: string
    name: string
    followers: number | null
    fans: number | null
    talkingAbout: number | null
    ratingCount: number | null
    category: string
    about: string
    link: string
    picture: string
}

export interface FbPost {
    id: string
    date: string
    type: string
    message: string
    permalink: string
    image: string
    shares: number
}

export interface Campaign {
    id: string
    name: string
    status: string
    objective: string
    spend: number
    impressions: number
    clicks: number
    reach: number
    ctr: number
    cpc: number
}

export interface FacebookData {
    page: PageInfo | null
    posts: FbPost[]
    campaigns: Campaign[]
    currency: string
    fetchedAt: string | null
}

const EMPTY: FacebookData = { page: null, posts: [], campaigns: [], currency: '', fetchedAt: null }

export function useFacebookData(days: number) {
    const [data, setData] = useState<FacebookData>(EMPTY)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        const { startDate, endDate } = getDateRange(days)
        const query = `since=${startDate}&until=${endDate}`

        // Campaigns fail independently of the page: no ad account assigned to the
        // System User yields zero campaigns, which must not blank out the page.
        const [pageRes, campaignRes] = await Promise.allSettled([
            fetch(`/api/social/facebook?${query}`).then(async r => {
                const body = await r.json()
                if (!r.ok) throw new Error(body.error ?? `Request failed (${r.status})`)
                return body
            }),
            fetch(`/api/social/campaigns?${query}`).then(async r => {
                const body = await r.json()
                if (!r.ok) throw new Error(body.error ?? `Request failed (${r.status})`)
                return body
            }),
        ])

        if (pageRes.status === 'rejected') {
            setError(pageRes.reason instanceof Error ? pageRes.reason.message : 'Failed to load Facebook data')
            setData(EMPTY)
            setLoading(false)
            return
        }

        setData({
            page: pageRes.value.page ?? null,
            posts: pageRes.value.posts ?? [],
            campaigns: campaignRes.status === 'fulfilled' ? campaignRes.value.campaigns ?? [] : [],
            currency: campaignRes.status === 'fulfilled' ? campaignRes.value.account?.currency ?? '' : '',
            fetchedAt: pageRes.value.fetchedAt ?? null,
        })
        setLoading(false)
    }, [days])

    useEffect(() => { load() }, [load])

    return { ...data, loading, error, reload: load }
}
