import { useState, useCallback, useEffect } from 'react'
import { CoreWebVitals }    from '@/features/seo/components/CoreWebVitals'
import { DashboardControls } from '@/features/seo/components/DashboardControls'
import { useSEODashboardState, SEO_API } from '@/features/seo/hooks/useSEODashboardState'
import { cacheGet, cacheSet } from '@/features/seo/lib/seoCache'

const THRESHOLDS = [
  { key: 'lcp', label: 'LCP', good: 2.5, poor: 4.0, format: (v: number) => `${v.toFixed(2)}s`, desc: 'Largest Contentful Paint' },
  { key: 'inp', label: 'INP', good: 200, poor: 500, format: (v: number) => `${Math.round(v)}ms`, desc: 'Interaction to Next Paint' },
  { key: 'cls', label: 'CLS', good: 0.1, poor: 0.25, format: (v: number) => v.toFixed(3), desc: 'Cumulative Layout Shift' },
  { key: 'fid', label: 'FID', good: 100, poor: 300, format: (v: number) => `${Math.round(v)}ms`, desc: 'First Input Delay (legacy)' },
]

function getStatus(value: number | null, good: number, poor: number) {
  if (value == null) return null
  if (value <= good) return 'good'
  if (value <= poor) return 'needs-improvement'
  return 'poor'
}

function ScoreCard({ label, value, status }: { label: string; value: string | null; status: string | null }) {
  const [bg, text] =
    status === 'good'              ? ['bg-meta-3/10 border-meta-3/20',  'text-meta-3']  :
    status === 'needs-improvement' ? ['bg-warning/10 border-warning/20', 'text-warning'] :
    status === 'poor'              ? ['bg-danger/10 border-danger/20',   'text-danger']  :
                                     ['bg-stroke/50 border-stroke',       'text-body dark:text-bodydark']
  return (
    <div className={`rounded-xl border px-5 py-4 ${bg}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark mb-1">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${text}`}>{value ?? '—'}</p>
      {status && <p className={`mt-1 text-xs font-semibold ${text}`}>{status === 'good' ? 'Good' : status === 'needs-improvement' ? 'Needs Work' : 'Poor'}</p>}
    </div>
  )
}

const EMPTY = { metrics: { lcp: null, inp: null, cls: null, fid: null }, mobile: { verdict: null, issues: [] }, auditedUrl: null }

export function SEOCoreWebVitals() {
  const state = useSEODashboardState()
  const [psi, setPsi] = useState(EMPTY)

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedGscSite) return
    const cacheKey = `cwv:${state.selectedGscSite}`
    if (!force) {
      const cached = cacheGet<{ data: typeof EMPTY; lastUpdated: string }>(cacheKey)
      if (cached) { setPsi({ ...EMPTY, ...cached.data }); state.setLastUpdated(new Date(cached.lastUpdated)); return }
    }
    state.setLoading(true)
    try {
      const params = new URLSearchParams({ url: state.selectedGscSite })
      const data = await fetch(`${SEO_API}/psi?${params}`).then((r) => r.json())
      if (data.error) { console.error('[CWV]', data.error); return }
      const updated = new Date()
      setPsi({ ...EMPTY, ...data })
      cacheSet(cacheKey, { data, lastUpdated: updated.toISOString() })
      state.setLastUpdated(updated)
    } catch (err) { console.error('[CWV]', err) } finally { state.setLoading(false) }
  }, [state.selectedGscSite])

  useEffect(() => { fetchData() }, [fetchData])

  const metrics = psi.metrics ?? {}

  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">
            Core Web Vitals
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-bold bg-[#F47C20]/20 text-[#F47C20] align-middle">PSI</span>
          </h1>
          <p className="text-sm text-body dark:text-bodydark">
            PageSpeed Insights · Mobile strategy · {state.lastUpdated ? `Updated ${state.lastUpdated.toLocaleTimeString()}` : 'Loading data…'}
          </p>
        </div>
        <DashboardControls {...state} showDateRange={false} onRefresh={() => fetchData(true)} pageTitle="Core-Web-Vitals" />
      </div>

      <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {THRESHOLDS.map(({ key, label, good, poor, format }) => {
          const val = (metrics as Record<string, number | null>)[key]
          return <ScoreCard key={key} label={label} value={val != null ? format(val) : null} status={getStatus(val, good, poor)} />
        })}
      </section>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-7">
          <CoreWebVitals metrics={metrics} mobile={psi.mobile} url={psi.auditedUrl} />
        </div>
        <div className="col-span-12 xl:col-span-5">
          <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark h-full">
            <div className="border-b border-stroke px-6 py-5 dark:border-strokedark">
              <h3 className="font-semibold text-black dark:text-white">Google CWV Thresholds</h3>
              <p className="mt-0.5 text-xs text-body dark:text-bodydark">Official passing criteria for Core Web Vitals</p>
            </div>
            <div className="divide-y divide-stroke px-6 dark:divide-strokedark">
              {THRESHOLDS.map(({ key, label, good, poor, format, desc }) => (
                <div key={key} className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold text-sm text-black dark:text-white">{label}</p>
                    <p className="text-xs text-body dark:text-bodydark mt-0.5">{desc}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs"><span className="text-meta-3 font-semibold">Good</span> <span className="text-body dark:text-bodydark">≤ {format(good)}</span></p>
                    <p className="text-xs"><span className="text-warning font-semibold">Needs Work</span> <span className="text-body dark:text-bodydark">≤ {format(poor)}</span></p>
                    <p className="text-xs"><span className="text-danger font-semibold">Poor</span> <span className="text-body dark:text-bodydark">&gt; {format(poor)}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
