import { edgeFetch } from '@/lib/edgeFetch'
import { useState, useCallback, useEffect } from 'react'
import { CardDataStats }    from '@/features/seo/components/CardDataStats'
import { DashboardControls } from '@/features/seo/components/DashboardControls'
import { useSEODashboardState, DATE_PRESETS, SEO_API } from '@/features/seo/hooks/useSEODashboardState'
import { cacheGet, cacheSet } from '@/features/seo/lib/seoCache'

interface SourceRow { source: string; medium: string; sessions?: number; conversions?: number; convRate?: number }

const TrafficIcon = () => (
  <svg className="h-5 w-5 text-[#1A72D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
)
const ConversionIcon = () => (
  <svg className="h-5 w-5 text-meta-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75" />
  </svg>
)
const RateIcon = () => (
  <svg className="h-5 w-5 text-[#F47C20]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
  </svg>
)
const SourceIcon = () => (
  <svg className="h-5 w-5 text-[#80CAEE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" />
  </svg>
)

const MEDIUM_COLORS: Record<string, string> = {
  organic: 'bg-meta-3/10 text-meta-3',
  cpc:     'bg-[#1A72D9]/10 text-[#1A72D9]',
  email:   'bg-[#F47C20]/10 text-[#F47C20]',
  social:  'bg-[#80CAEE]/10 text-[#80CAEE]',
  referral:'bg-warning/10 text-warning',
}
function mediumBadge(medium: string) {
  return MEDIUM_COLORS[(medium || '').toLowerCase()] || 'bg-stroke text-body dark:bg-strokedark dark:text-bodydark'
}

function AcquisitionTable({ sources }: { sources: SourceRow[] }) {
  const [sortKey, setSortKey] = useState('sessions')
  const [sortAsc, setSortAsc] = useState(false)

  function handleSort(key: string) {
    if (key === sortKey) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sorted = [...sources].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortKey] ?? 0
    const bv = (b as unknown as Record<string, unknown>)[sortKey] ?? 0
    if (typeof av === 'string') return sortAsc ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string)
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  function ColHeader({ label, col, align = 'right' }: { label: string; col: string; align?: string }) {
    const active = col === sortKey
    return (
      <th onClick={() => handleSort(col)}
          className={`cursor-pointer select-none px-4 py-3 text-${align} text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark hover:text-black transition-colors`}>
        <span className="inline-flex items-center gap-1">{label} <span className={`text-[10px] ${active ? 'opacity-100' : 'opacity-30'}`}>{active ? (sortAsc ? '↑' : '↓') : '↕'}</span></span>
      </th>
    )
  }

  return (
    <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="border-b border-stroke px-6 py-5 dark:border-strokedark">
        <h3 className="text-lg font-semibold text-black dark:text-white">Traffic Acquisition Sources</h3>
        <p className="mt-0.5 text-sm text-body dark:text-bodydark">Google Analytics 4 · {sources.length} source / medium combinations</p>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 z-10 bg-gray dark:bg-meta-4">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark w-8">#</th>
              <ColHeader label="Source" col="source" align="left" />
              <ColHeader label="Medium" col="medium" align="left" />
              <ColHeader label="Sessions" col="sessions" />
              <ColHeader label="Conversions" col="conversions" />
              <ColHeader label="Conv. Rate" col="convRate" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke dark:divide-strokedark">
            {sorted.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-body dark:text-bodydark">No data available.</td></tr>
            ) : sorted.map((row, i) => {
              const convRate = row.convRate ?? 0
              return (
                <tr key={`${row.source}-${row.medium}-${i}`} className="group transition-colors hover:bg-gray-2 dark:hover:bg-meta-4">
                  <td className="px-4 py-3.5 text-xs text-body dark:text-bodydark tabular-nums">{i + 1}</td>
                  <td className="px-4 py-3.5"><span className="font-medium text-black dark:text-white">{row.source || '(direct)'}</span></td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${mediumBadge(row.medium)}`}>{row.medium || 'none'}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-black dark:text-white">{(row.sessions ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-body dark:text-bodydark">{(row.conversions ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`tabular-nums font-semibold text-sm ${convRate >= 0.05 ? 'text-meta-3' : convRate >= 0.02 ? 'text-[#1A72D9]' : 'text-body dark:text-bodydark'}`}>
                      {(convRate * 100).toFixed(2)}%
                    </span>
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

const EMPTY = { engagedSessions: 0, conversionRate: 0, engagedSessionsDelta: null, conversionRateDelta: null, engagedSessionsSparkline: [], conversionSparkline: [], topPages: [], acquisitionSources: [] }

export function SEOTraffic() {
  const state = useSEODashboardState()
  const [ga4, setGa4] = useState(EMPTY)

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedGa4Id) return
    const cacheKey = `traffic:${state.selectedGa4Id}:${state.dateRange.startDate}:${state.dateRange.endDate}`
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
    } catch (err) { console.error('[Traffic]', err) } finally { state.setLoading(false) }
  }, [state.selectedGa4Id, state.dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const totalSessions    = ga4.acquisitionSources.reduce((acc: number, s: SourceRow) => acc + (s.sessions ?? 0), 0)
  const totalConversions = ga4.acquisitionSources.reduce((acc: number, s: SourceRow) => acc + (s.conversions ?? 0), 0)
  const overallConvRate  = totalSessions > 0 ? totalConversions / totalSessions : 0

  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Traffic Quality</h1>
          <p className="text-sm text-body dark:text-bodydark">
            Acquisition sources &amp; conversion performance · {state.lastUpdated ? `Updated ${state.lastUpdated.toLocaleTimeString()}` : 'Loading data…'}
          </p>
        </div>
        <DashboardControls {...state} showGsc={false} onRefresh={() => fetchData(true)} pageTitle="Traffic-Quality" />
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardDataStats title="Total Sessions" value={totalSessions.toLocaleString()} delta={ga4.engagedSessionsDelta}
          deltaLabel={`vs prior ${DATE_PRESETS[state.selectedPreset].days} days`} sparklineData={ga4.engagedSessionsSparkline}
          sparklineColor="#1A72D9" icon={<TrafficIcon />} iconBg="bg-[#1A72D9]/10" source="GA4" />
        <CardDataStats title="Total Conversions" value={totalConversions.toLocaleString()} delta={ga4.conversionRateDelta}
          deltaLabel={`vs prior ${DATE_PRESETS[state.selectedPreset].days} days`} sparklineData={ga4.conversionSparkline}
          sparklineColor="#10B981" icon={<ConversionIcon />} iconBg="bg-meta-3/10" source="GA4" />
        <CardDataStats title="Overall Conv. Rate" value={overallConvRate > 0 ? `${(overallConvRate * 100).toFixed(2)}%` : '—'}
          delta={null} deltaLabel="sessions → conversions" sparklineData={[]} sparklineColor="#F47C20"
          icon={<RateIcon />} iconBg="bg-[#F47C20]/10" source="GA4" />
        <CardDataStats title="Active Channels" value={ga4.acquisitionSources.length.toLocaleString()}
          delta={null} deltaLabel="source/medium pairs" sparklineData={[]} sparklineColor="#80CAEE"
          icon={<SourceIcon />} iconBg="bg-[#80CAEE]/10" source="GA4" />
      </section>

      <AcquisitionTable sources={ga4.acquisitionSources} />
    </div>
  )
}
