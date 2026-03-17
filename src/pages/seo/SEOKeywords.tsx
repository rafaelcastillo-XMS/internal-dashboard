import { useState, useEffect, useCallback } from 'react'
import { CardDataStats }      from '@/features/seo/components/CardDataStats'
import { QueryRankingsTable } from '@/features/seo/components/QueryRankingsTable'
import type { QueryRow }      from '@/features/seo/components/QueryRankingsTable'
import { DashboardControls }  from '@/features/seo/components/DashboardControls'
import { useSEODashboardState, DATE_PRESETS, SEO_API } from '@/features/seo/hooks/useSEODashboardState'
import { cacheGet, cacheSet } from '@/features/seo/lib/seoCache'

const KeywordIcon = () => (
  <svg className="h-5 w-5 text-[#1A72D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const TopRankIcon = () => (
  <svg className="h-5 w-5 text-meta-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497" />
  </svg>
)
const CTRIcon = () => (
  <svg className="h-5 w-5 text-[#F47C20]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
  </svg>
)
const ClicksIcon = () => (
  <svg className="h-5 w-5 text-[#80CAEE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
  </svg>
)

const EMPTY: { totalClicks: number; totalImpressions: number; avgCTR: number; avgPosition: number; ctrDelta: number | null; clicksSparkline: number[]; queries: QueryRow[] } = { totalClicks: 0, totalImpressions: 0, avgCTR: 0, avgPosition: 0, ctrDelta: null, clicksSparkline: [], queries: [] }

export function SEOKeywords() {
  const state = useSEODashboardState()
  const [gsc, setGsc] = useState(EMPTY)

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedGscSite) return
    const cacheKey = `keywords:${state.selectedGscSite}:${state.dateRange.startDate}:${state.dateRange.endDate}`
    if (!force) {
      const cached = cacheGet<{ data: typeof EMPTY; lastUpdated: string }>(cacheKey)
      if (cached) { setGsc({ ...EMPTY, ...cached.data }); state.setLastUpdated(new Date(cached.lastUpdated)); return }
    }
    state.setLoading(true)
    try {
      const params = new URLSearchParams({ siteUrl: state.selectedGscSite, startDate: state.dateRange.startDate, endDate: state.dateRange.endDate })
      const data = await fetch(`${SEO_API}/gsc?${params}`).then((r) => r.json())
      const updated = new Date()
      setGsc({ ...EMPTY, ...data })
      cacheSet(cacheKey, { data, lastUpdated: updated.toISOString() })
      state.setLastUpdated(updated)
    } catch (err) { console.error('[Keywords]', err) } finally { state.setLoading(false) }
  }, [state.selectedGscSite, state.dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const quickWins = gsc.queries.filter((q) => q.position >= 4 && q.position <= 10).length
  const top3Count = gsc.queries.filter((q) => q.position <= 3).length

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">
            Keyword Intelligence
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-bold bg-[#1A72D9]/20 text-[#1A72D9] align-middle">GSC</span>
          </h1>
          <p className="text-sm text-body dark:text-bodydark">
            Query rankings &amp; click-through rates · {state.lastUpdated ? `Updated ${state.lastUpdated.toLocaleTimeString()}` : 'Loading data…'}
          </p>
        </div>
        <DashboardControls {...state} onRefresh={() => fetchData(true)} pageTitle="Keyword-Intelligence" />
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardDataStats title="Total Queries" value={gsc.queries.length.toLocaleString()} delta={null}
          deltaLabel="keywords tracked" sparklineData={[]} sparklineColor="#1A72D9"
          icon={<KeywordIcon />} iconBg="bg-[#1A72D9]/10" source="GSC" />
        <CardDataStats title="Top 3 Positions" value={top3Count.toLocaleString()} delta={null}
          deltaLabel="queries ranking #1–3" sparklineData={[]} sparklineColor="#10B981"
          icon={<TopRankIcon />} iconBg="bg-meta-3/10" source="GSC" />
        <CardDataStats title="Quick-Win Queries" value={quickWins.toLocaleString()} delta={null}
          deltaLabel="ranking position 4–10" sparklineData={[]} sparklineColor="#F47C20"
          icon={<CTRIcon />} iconBg="bg-[#F47C20]/10" source="GSC" />
        <CardDataStats title="Avg. CTR"
          value={gsc.avgCTR > 0 ? `${(gsc.avgCTR * 100).toFixed(2)}%` : '—'}
          delta={gsc.ctrDelta} deltaLabel={`vs prior ${DATE_PRESETS[state.selectedPreset].days} days`}
          sparklineData={gsc.clicksSparkline} sparklineColor="#80CAEE"
          icon={<ClicksIcon />} iconBg="bg-[#80CAEE]/10" source="GSC" />
      </section>

      <QueryRankingsTable rows={gsc.queries} pageSize={25} />
    </div>
  )
}
