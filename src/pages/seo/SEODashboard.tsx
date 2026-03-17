import { useState, useEffect, useCallback } from 'react'
import { CardDataStats }      from '@/features/seo/components/CardDataStats'
import { ChartVisibility }    from '@/features/seo/components/ChartVisibility'
import { QueryRankingsTable } from '@/features/seo/components/QueryRankingsTable'
import { CoreWebVitals }      from '@/features/seo/components/CoreWebVitals'
import { useSEODashboardState, formatDateLabel, DATE_PRESETS, SEO_API } from '@/features/seo/hooks/useSEODashboardState'
import { cacheGet, cacheSet } from '@/features/seo/lib/seoCache'

const ClicksIcon = () => (
  <svg className="h-5 w-5 text-[#1A72D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
          d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
  </svg>
)
const PositionIcon = () => (
  <svg className="h-5 w-5 text-[#F47C20]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
          d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
  </svg>
)
const SessionsIcon = () => (
  <svg className="h-5 w-5 text-meta-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
)
const ConversionIcon = () => (
  <svg className="h-5 w-5 text-[#80CAEE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
  </svg>
)

const EMPTY_DATA = {
  gsc: { totalClicks: 0, totalImpressions: 0, avgPosition: 0, clicksDelta: null, positionDelta: null, clicksSparkline: [], impressionsSparkline: [], clicksTimeSeries: [], impressionsTimeSeries: [], dateLabels: [], queries: [] },
  ga4: { engagedSessions: 0, conversionRate: 0, engagedSessionsDelta: null, conversionRateDelta: null, engagedSessionsSparkline: [], conversionSparkline: [], topPages: [] },
  psi: { metrics: { lcp: null, inp: null, cls: null, fid: null }, mobile: { verdict: null, issues: [] }, auditedUrl: null },
}

export function SEODashboard() {
  const state = useSEODashboardState()
  const [data, setData] = useState(EMPTY_DATA)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    setIsDark(document.documentElement.classList.contains('dark'))
    return () => observer.disconnect()
  }, [])

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedGscSite && !state.selectedGa4Id) return
    const cacheKey = `dashboard:${state.selectedGscSite}:${state.selectedGa4Id}:${state.dateRange.startDate}:${state.dateRange.endDate}`
    if (!force) {
      const cached = cacheGet<{ data: typeof EMPTY_DATA; lastUpdated: string }>(cacheKey)
      if (cached) { setData(cached.data); state.setLastUpdated(new Date(cached.lastUpdated)); return }
    }
    state.setLoading(true)
    try {
      const base = { startDate: state.dateRange.startDate, endDate: state.dateRange.endDate }

      const [gscData, ga4Data, psiData] = await Promise.all([
        state.selectedGscSite
          ? fetch(`${SEO_API}/gsc?${new URLSearchParams({ ...base, siteUrl: state.selectedGscSite })}`).then((r) => r.json())
          : Promise.resolve(EMPTY_DATA.gsc),
        state.selectedGa4Id
          ? fetch(`${SEO_API}/ga4?${new URLSearchParams({ ...base, propertyId: state.selectedGa4Id })}`).then((r) => r.json())
          : Promise.resolve(EMPTY_DATA.ga4),
        state.selectedGscSite
          ? fetch(`${SEO_API}/psi?${new URLSearchParams({ url: state.selectedGscSite })}`).then((r) => r.json())
          : Promise.resolve(EMPTY_DATA.psi),
      ])

      const updated = new Date()
      const newData = { gsc: { ...EMPTY_DATA.gsc, ...gscData }, ga4: { ...EMPTY_DATA.ga4, ...ga4Data }, psi: { ...EMPTY_DATA.psi, ...psiData } }
      setData(newData)
      cacheSet(cacheKey, { data: newData, lastUpdated: updated.toISOString() })
      state.setLastUpdated(updated)
    } catch (err) {
      console.error('[SEO Dashboard] fetch failed:', err)
    } finally {
      state.setLoading(false)
    }
  }, [state.dateRange, state.selectedGscSite, state.selectedGa4Id])

  useEffect(() => { fetchData() }, [fetchData])

  const dateRangeLabel = formatDateLabel(state.dateRange.startDate, state.dateRange.endDate)

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">SEO Intelligence Dashboard</h1>
          <p className="text-sm text-body dark:text-bodydark">
            Xperience Ai Marketing Solutions ·{' '}
            {state.lastUpdated ? `Updated ${state.lastUpdated.toLocaleTimeString()}` : 'Loading data…'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-body dark:text-bodydark">GSC</span>
            <select value={state.selectedGscSite} onChange={(e) => state.setSelectedGscSite(e.target.value)}
                    disabled={state.gscOptions.length === 0}
                    className="rounded-lg border border-stroke bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-black
                               focus:border-[#1A72D9] focus:outline-none disabled:opacity-50
                               dark:border-strokedark dark:bg-boxdark dark:text-white max-w-[220px]">
              <option value="">{state.gscOptions.length === 0 ? 'Loading…' : 'Select property…'}</option>
              {state.gscOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-body dark:text-bodydark">GA4</span>
            <select value={state.selectedGa4Id} onChange={(e) => state.setSelectedGa4Id(e.target.value)}
                    disabled={state.ga4Options.length === 0}
                    className="rounded-lg border border-stroke bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-black
                               focus:border-[#1A72D9] focus:outline-none disabled:opacity-50
                               dark:border-strokedark dark:bg-boxdark dark:text-white max-w-[220px]">
              <option value="">{state.ga4Options.length === 0 ? 'Loading…' : 'Select property…'}</option>
              {state.ga4Options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-stroke bg-white p-1 shadow-card dark:border-strokedark dark:bg-boxdark">
            {DATE_PRESETS.map((preset, idx) => (
              <button key={preset.days} onClick={() => state.handlePresetChange(idx)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all
                        ${state.selectedPreset === idx ? 'bg-[#1A72D9] text-white shadow-sm' : 'text-body hover:text-black dark:text-bodydark dark:hover:text-white'}`}>
                {preset.label}
              </button>
            ))}
          </div>
          <button onClick={() => fetchData(true)} disabled={state.loading}
                  className="flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium
                             shadow-card hover:border-[#1A72D9] hover:text-[#1A72D9] disabled:opacity-60
                             dark:border-strokedark dark:bg-boxdark dark:text-white">
            <svg className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardDataStats title="Total Clicks" value={data.gsc.totalClicks.toLocaleString()}
          delta={data.gsc.clicksDelta} deltaLabel={`vs prior ${DATE_PRESETS[state.selectedPreset].days} days`}
          sparklineData={data.gsc.clicksSparkline} sparklineColor="#1A72D9"
          icon={<ClicksIcon />} iconBg="bg-[#1A72D9]/10" source="GSC" />
        <CardDataStats title="Avg. Position"
          value={data.gsc.avgPosition > 0 ? `#${data.gsc.avgPosition.toFixed(1)}` : '—'}
          delta={data.gsc.positionDelta} deltaLabel={`vs prior ${DATE_PRESETS[state.selectedPreset].days} days`}
          sparklineData={data.gsc.impressionsSparkline} sparklineColor="#F47C20" invertScale
          icon={<PositionIcon />} iconBg="bg-[#F47C20]/10" source="GSC" />
        <CardDataStats title="Engaged Sessions" value={data.ga4.engagedSessions.toLocaleString()}
          delta={data.ga4.engagedSessionsDelta} deltaLabel={`vs prior ${DATE_PRESETS[state.selectedPreset].days} days`}
          sparklineData={data.ga4.engagedSessionsSparkline} sparklineColor="#10B981"
          icon={<SessionsIcon />} iconBg="bg-meta-3/10" source="GA4" />
        <CardDataStats title="Conversion Rate"
          value={data.ga4.conversionRate > 0 ? `${data.ga4.conversionRate.toFixed(2)}%` : '—'}
          delta={data.ga4.conversionRateDelta} deltaLabel={`vs prior ${DATE_PRESETS[state.selectedPreset].days} days`}
          sparklineData={data.ga4.conversionSparkline} sparklineColor="#80CAEE"
          icon={<ConversionIcon />} iconBg="bg-[#80CAEE]/10" source="GA4" />
      </section>

      {/* Chart + CWV */}
      <section className="mb-6 grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-8">
          <ChartVisibility impressions={data.gsc.impressionsTimeSeries} clicks={data.gsc.clicksTimeSeries}
            labels={data.gsc.dateLabels} isDark={isDark} dateRangeLabel={dateRangeLabel} />
        </div>
        <div className="col-span-12 xl:col-span-4">
          <CoreWebVitals metrics={data.psi.metrics} mobile={data.psi.mobile} url={data.psi.auditedUrl} />
        </div>
      </section>

      {/* Query table */}
      <section>
        <QueryRankingsTable rows={data.gsc.queries} pageSize={15} />
      </section>

      {/* Footer */}
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-stroke pt-4 dark:border-strokedark">
        <p className="text-xs text-body dark:text-bodydark">
          Data range: <span className="font-medium text-black dark:text-white">{dateRangeLabel}</span>
        </p>
        <div className="flex items-center gap-4 text-xs text-body dark:text-bodydark">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#1A72D9]" />Google Search Console</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-meta-3" />Google Analytics 4</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#F47C20]" />PageSpeed Insights</span>
        </div>
      </footer>
    </div>
  )
}
