import { useState, useEffect, useCallback } from 'react'
import { CardDataStats }    from '@/features/seo/components/CardDataStats'
import { ChartVisibility }  from '@/features/seo/components/ChartVisibility'
import { DashboardControls } from '@/features/seo/components/DashboardControls'
import { useSEODashboardState, formatDateLabel, DATE_PRESETS, SEO_API } from '@/features/seo/hooks/useSEODashboardState'
import { cacheGet, cacheSet } from '@/features/seo/lib/seoCache'

const ImpressionsIcon = () => (
  <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const ClicksIcon = () => (
  <svg className="h-5 w-5 text-[#1A72D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
  </svg>
)
const CTRIcon = () => (
  <svg className="h-5 w-5 text-meta-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
  </svg>
)
const PositionIcon = () => (
  <svg className="h-5 w-5 text-[#F47C20]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
  </svg>
)

const EMPTY = { totalClicks: 0, totalImpressions: 0, avgCTR: 0, avgPosition: 0, clicksDelta: null, impressionsDelta: null, ctrDelta: null, positionDelta: null, clicksSparkline: [], impressionsSparkline: [], clicksTimeSeries: [], impressionsTimeSeries: [], dateLabels: [], queries: [] }

export function SEOVisibility() {
  const state = useSEODashboardState()
  const [gsc, setGsc] = useState(EMPTY)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    setIsDark(document.documentElement.classList.contains('dark'))
    return () => obs.disconnect()
  }, [])

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedGscSite) return
    const cacheKey = `visibility:${state.selectedGscSite}:${state.dateRange.startDate}:${state.dateRange.endDate}`
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
    } catch (err) { console.error('[Visibility]', err) } finally { state.setLoading(false) }
  }, [state.selectedGscSite, state.dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">GSC Visibility</h1>
          <p className="text-sm text-body dark:text-bodydark">
            Search impressions &amp; clicks · {state.lastUpdated ? `Updated ${state.lastUpdated.toLocaleTimeString()}` : 'Loading data…'}
          </p>
        </div>
        <DashboardControls {...state} onRefresh={() => fetchData(true)} pageTitle="GSC-Visibility" />
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardDataStats title="Total Clicks" value={gsc.totalClicks.toLocaleString()} delta={gsc.clicksDelta}
          deltaLabel={`vs prior ${DATE_PRESETS[state.selectedPreset].days} days`} sparklineData={gsc.clicksSparkline}
          sparklineColor="#1A72D9" icon={<ClicksIcon />} iconBg="bg-[#1A72D9]/10" source="GSC" />
        <CardDataStats title="Total Impressions" value={gsc.totalImpressions.toLocaleString()} delta={gsc.impressionsDelta}
          deltaLabel={`vs prior ${DATE_PRESETS[state.selectedPreset].days} days`} sparklineData={gsc.impressionsSparkline}
          sparklineColor="#3B82F6" icon={<ImpressionsIcon />} iconBg="bg-blue-500/10" source="GSC" />
        <CardDataStats title="Avg. CTR" value={gsc.avgCTR > 0 ? `${(gsc.avgCTR * 100).toFixed(2)}%` : '—'}
          delta={gsc.ctrDelta} deltaLabel={`vs prior ${DATE_PRESETS[state.selectedPreset].days} days`}
          sparklineData={[]} sparklineColor="#10B981" icon={<CTRIcon />} iconBg="bg-meta-3/10" source="GSC" />
        <CardDataStats title="Avg. Position" value={gsc.avgPosition > 0 ? `#${gsc.avgPosition.toFixed(1)}` : '—'}
          delta={gsc.positionDelta} deltaLabel={`vs prior ${DATE_PRESETS[state.selectedPreset].days} days`}
          sparklineData={[]} sparklineColor="#F47C20" invertScale icon={<PositionIcon />} iconBg="bg-[#F47C20]/10" source="GSC" />
      </section>

      <ChartVisibility impressions={gsc.impressionsTimeSeries} clicks={gsc.clicksTimeSeries}
        labels={gsc.dateLabels} isDark={isDark} dateRangeLabel={formatDateLabel(state.dateRange.startDate, state.dateRange.endDate)} />
    </div>
  )
}
