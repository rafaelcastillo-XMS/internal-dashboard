import { edgeFetch } from '@/lib/edgeFetch'
import { useState, useCallback, useEffect } from 'react'
import { CardDataStats }    from '@/features/seo/components/CardDataStats'
import { DashboardControls } from '@/features/seo/components/DashboardControls'
import { useSEODashboardState, DATE_PRESETS, SEO_API } from '@/features/seo/hooks/useSEODashboardState'
import { cacheGet, cacheSet } from '@/features/seo/lib/seoCache'

interface PageRow {
  page: string; engagedSessions?: number; avgEngageTime?: number; eventCount?: number; engageRate?: number
}

const SessionsIcon = () => (
  <svg className="h-5 w-5 text-meta-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
)
const TimeIcon = () => (
  <svg className="h-5 w-5 text-[#1A72D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const EventIcon = () => (
  <svg className="h-5 w-5 text-[#F47C20]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
)
const EngageRateIcon = () => (
  <svg className="h-5 w-5 text-[#80CAEE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
)

function fmtDuration(seconds: number) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function EngagementTable({ pages }: { pages: PageRow[] }) {
  const [sortKey, setSortKey] = useState('engagedSessions')
  const [sortAsc, setSortAsc] = useState(false)
  const [filter, setFilter] = useState('')

  function handleSort(key: string) {
    if (key === sortKey) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const filtered = filter ? pages.filter((p) => p.page.toLowerCase().includes(filter.toLowerCase())) : pages
  const sorted = [...filtered].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortKey] as number ?? 0
    const bv = (b as unknown as Record<string, unknown>)[sortKey] as number ?? 0
    return sortAsc ? av - bv : bv - av
  })

  function ColHeader({ label, col }: { label: string; col: string }) {
    const active = col === sortKey
    return (
      <th onClick={() => handleSort(col)}
          className="cursor-pointer select-none px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark hover:text-black dark:hover:text-white transition-colors">
        <span className="inline-flex items-center gap-1">
          {label}
          <span className={`text-[10px] ${active ? 'opacity-100' : 'opacity-30'}`}>{active ? (sortAsc ? '↑' : '↓') : '↕'}</span>
        </span>
      </th>
    )
  }

  return (
    <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke px-6 py-5 dark:border-strokedark">
        <div>
          <h3 className="text-lg font-semibold text-black dark:text-white">Top Pages — Engagement</h3>
          <p className="mt-0.5 text-sm text-body dark:text-bodydark">Google Analytics 4 · {filtered.length} pages</p>
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body dark:text-bodydark">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input type="text" placeholder="Filter pages…" value={filter} onChange={(e) => setFilter(e.target.value)}
                 className="w-48 rounded-lg border border-stroke bg-transparent py-2 pl-9 pr-4 text-sm text-black outline-none focus:border-[#1A72D9] dark:border-strokedark dark:bg-[#1d2a39] dark:text-white" />
        </div>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="sticky top-0 z-10 bg-gray dark:bg-meta-4">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark w-8">#</th>
              <th onClick={() => handleSort('page')} className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark hover:text-black">
                <span className="inline-flex items-center gap-1">Page <span className="text-[10px] opacity-30">↕</span></span>
              </th>
              <ColHeader label="Engaged Sessions" col="engagedSessions" />
              <ColHeader label="Avg. Engage Time" col="avgEngageTime" />
              <ColHeader label="Events" col="eventCount" />
              <ColHeader label="Engagement Rate" col="engageRate" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke dark:divide-strokedark">
            {sorted.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-body dark:text-bodydark">{filter ? 'No pages match.' : 'No data available.'}</td></tr>
            ) : sorted.map((row, i) => {
              const rate = row.engageRate ?? 0
              const rateColor = rate >= 0.6 ? 'text-meta-3' : rate >= 0.4 ? 'text-[#1A72D9]' : 'text-warning'
              return (
                <tr key={row.page} className="group transition-colors hover:bg-gray-2 dark:hover:bg-meta-4">
                  <td className="px-4 py-3.5 text-xs text-body dark:text-bodydark tabular-nums">{i + 1}</td>
                  <td className="max-w-[300px] px-4 py-3.5">
                    <span className="block truncate font-medium text-black dark:text-white group-hover:text-[#1A72D9] transition-colors" title={row.page}>{row.page}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-black dark:text-white">{(row.engagedSessions ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-body dark:text-bodydark">{fmtDuration(row.avgEngageTime ?? 0)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-body dark:text-bodydark">{(row.eventCount ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`tabular-nums font-semibold text-sm ${rateColor}`}>{(rate * 100).toFixed(1)}%</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const EMPTY = { engagedSessions: 0, conversionRate: 0, engagedSessionsDelta: null, conversionRateDelta: null, engagedSessionsSparkline: [], conversionSparkline: [], topPages: [] }

export function SEOEngagement() {
  const state = useSEODashboardState()
  const [ga4, setGa4] = useState(EMPTY)

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedGa4Id) return
    const cacheKey = `engagement:${state.selectedGa4Id}:${state.dateRange.startDate}:${state.dateRange.endDate}`
    if (!force) {
      const cached = cacheGet<{ data: typeof EMPTY; lastUpdated: string }>(cacheKey)
      if (cached) { setGa4({ ...EMPTY, ...cached.data }); state.setLastUpdated(new Date(cached.lastUpdated)); return }
    }
    state.setLoading(true)
    try {
      const params = new URLSearchParams({ propertyId: state.selectedGa4Id, startDate: state.dateRange.startDate, endDate: state.dateRange.endDate })
      const data = await edgeFetch(`${SEO_API}/ga4?${params}`).then((r) => r.json())
      const updated = new Date()
      setGa4({ ...EMPTY, ...data })
      cacheSet(cacheKey, { data, lastUpdated: updated.toISOString() })
      state.setLastUpdated(updated)
    } catch (err) { console.error('[Engagement]', err) } finally { state.setLoading(false) }
  }, [state.selectedGa4Id, state.dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const totalEvents = ga4.topPages.reduce((acc: number, p: PageRow) => acc + (p.eventCount ?? 0), 0)
  const avgEngageRate = ga4.topPages.length > 0
    ? ga4.topPages.reduce((acc: number, p: PageRow) => acc + (p.engageRate ?? 0), 0) / ga4.topPages.length : 0

  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">GA4 Engagement</h1>
          <p className="text-sm text-body dark:text-bodydark">
            Page-level engagement metrics · {state.lastUpdated ? `Updated ${state.lastUpdated.toLocaleTimeString()}` : 'Loading data…'}
          </p>
        </div>
        <DashboardControls {...state} showGsc={false} onRefresh={() => fetchData(true)} pageTitle="GA4-Engagement" />
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardDataStats title="Engaged Sessions" value={(ga4.engagedSessions ?? 0).toLocaleString()} delta={ga4.engagedSessionsDelta}
          deltaLabel={`vs prior ${DATE_PRESETS[state.selectedPreset].days} days`} sparklineData={ga4.engagedSessionsSparkline}
          sparklineColor="#10B981" icon={<SessionsIcon />} iconBg="bg-meta-3/10" source="GA4" />
        <CardDataStats title="Avg. Engagement Rate" value={avgEngageRate > 0 ? `${(avgEngageRate * 100).toFixed(1)}%` : '—'}
          delta={null} deltaLabel="across top pages" sparklineData={[]} sparklineColor="#1A72D9"
          icon={<EngageRateIcon />} iconBg="bg-[#80CAEE]/10" source="GA4" />
        <CardDataStats title="Total Events" value={totalEvents.toLocaleString()} delta={null}
          deltaLabel="across top pages" sparklineData={[]} sparklineColor="#F47C20"
          icon={<EventIcon />} iconBg="bg-[#F47C20]/10" source="GA4" />
        <CardDataStats title="Pages Tracked" value={ga4.topPages.length.toLocaleString()} delta={null}
          deltaLabel="in selected period" sparklineData={[]} sparklineColor="#1A72D9"
          icon={<TimeIcon />} iconBg="bg-[#1A72D9]/10" source="GA4" />
      </section>

      <EngagementTable pages={ga4.topPages} />
    </div>
  )
}
