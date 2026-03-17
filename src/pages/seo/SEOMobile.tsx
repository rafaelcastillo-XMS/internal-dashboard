import { useState, useCallback, useEffect } from 'react'
import { DashboardControls } from '@/features/seo/components/DashboardControls'
import { useSEODashboardState, SEO_API } from '@/features/seo/hooks/useSEODashboardState'
import { cacheGet, cacheSet } from '@/features/seo/lib/seoCache'

const MOBILE_BEST_PRACTICES = [
  'Viewport meta tag configured correctly',
  'Text is legible without zooming',
  'Touch targets are sized appropriately (≥ 48×48px)',
  'Content does not overflow the viewport',
  'Links are not too close together',
  'No horizontal scrolling required',
  'Plugins (Flash, Java) are not used',
]

function verdictConfig(verdict: string | null) {
  if (verdict === 'PASS')    return { label: 'Passing',      bg: 'bg-meta-3/10',  border: 'border-meta-3/20',  text: 'text-meta-3',  dot: 'bg-meta-3'  }
  if (verdict === 'PARTIAL') return { label: 'Partial',      bg: 'bg-warning/10', border: 'border-warning/20', text: 'text-warning', dot: 'bg-warning' }
  if (verdict === 'FAIL')    return { label: 'Issues Found', bg: 'bg-danger/10',  border: 'border-danger/20',  text: 'text-danger',  dot: 'bg-danger'  }
  return { label: 'Unknown', bg: 'bg-stroke/50', border: 'border-stroke', text: 'text-body dark:text-bodydark', dot: 'bg-body' }
}

const EMPTY = { metrics: { lcp: null, inp: null, cls: null, fid: null }, mobile: { verdict: null, issues: [] }, auditedUrl: null }

export function SEOMobile() {
  const state = useSEODashboardState()
  const [psi, setPsi] = useState(EMPTY)

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedGscSite) return
    const cacheKey = `mobile:${state.selectedGscSite}`
    if (!force) {
      const cached = cacheGet<{ data: typeof EMPTY; lastUpdated: string }>(cacheKey)
      if (cached) { setPsi({ ...EMPTY, ...cached.data }); state.setLastUpdated(new Date(cached.lastUpdated)); return }
    }
    state.setLoading(true)
    try {
      const params = new URLSearchParams({ url: state.selectedGscSite })
      const data = await fetch(`${SEO_API}/psi?${params}`).then((r) => r.json())
      if (data.error) { console.error('[Mobile]', data.error); return }
      const updated = new Date()
      setPsi({ ...EMPTY, ...data })
      cacheSet(cacheKey, { data, lastUpdated: updated.toISOString() })
      state.setLastUpdated(updated)
    } catch (err) { console.error('[Mobile]', err) } finally { state.setLoading(false) }
  }, [state.selectedGscSite])

  useEffect(() => { fetchData() }, [fetchData])

  const mobile  = psi.mobile  ?? { verdict: null, issues: [] }
  const verdict = verdictConfig(mobile.verdict)
  const issues  = mobile.issues ?? []

  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Mobile Usability</h1>
          <p className="text-sm text-body dark:text-bodydark">
            Google Search Console · Mobile-friendliness audit · {state.lastUpdated ? `Updated ${state.lastUpdated.toLocaleTimeString()}` : 'Loading data…'}
          </p>
        </div>
        <DashboardControls {...state} showDateRange={false} onRefresh={() => fetchData(true)} pageTitle="Mobile-Usability" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: verdict + issues */}
        <div className="col-span-12 xl:col-span-5 space-y-4">
          <div className={`rounded-xl border px-6 py-6 ${verdict.bg} ${verdict.border}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <svg className={`h-6 w-6 ${verdict.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">Mobile Verdict</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${verdict.dot}`} />
                  <span className={`text-xl font-bold ${verdict.text}`}>{verdict.label}</span>
                </div>
              </div>
            </div>
            {psi.auditedUrl && (
              <p className="truncate rounded bg-black/10 px-3 py-1.5 font-mono text-[11px] text-body dark:text-bodydark" title={psi.auditedUrl}>{psi.auditedUrl}</p>
            )}
            {!mobile.verdict && <p className="text-sm text-body dark:text-bodydark mt-2">Select a GSC property and click Refresh to run the audit.</p>}
          </div>

          <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-black dark:text-white">Detected Issues</h3>
                {issues.length > 0
                  ? <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">{issues.length} issue{issues.length !== 1 ? 's' : ''}</span>
                  : <span className="rounded-full bg-meta-3/10 px-2 py-0.5 text-xs font-bold text-meta-3">None</span>}
              </div>
            </div>
            <div className="px-6 py-4">
              {issues.length === 0 ? (
                <div className="flex items-center gap-3 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-meta-3/10">
                    <svg className="h-4 w-4 text-meta-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  </span>
                  <p className="text-sm text-body dark:text-bodydark">{mobile.verdict ? 'No mobile usability issues detected.' : 'Run audit to see results.'}</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {issues.map((issue: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 rounded-lg bg-danger/5 px-3 py-2.5 dark:bg-danger/10">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger/20">
                        <svg className="h-3 w-3 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </span>
                      <span className="text-sm text-black dark:text-white">{issue}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right: best practices */}
        <div className="col-span-12 xl:col-span-7">
          <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark h-full">
            <div className="border-b border-stroke px-6 py-5 dark:border-strokedark">
              <h3 className="font-semibold text-black dark:text-white">Mobile Best Practices</h3>
              <p className="mt-0.5 text-xs text-body dark:text-bodydark">Google's mobile usability requirements for search ranking</p>
            </div>
            <div className="divide-y divide-stroke px-6 dark:divide-strokedark">
              {MOBILE_BEST_PRACTICES.map((bp, i) => {
                const isIssue = issues.some((iss: string) => iss.toLowerCase().includes(bp.toLowerCase().split(' ').slice(0, 3).join(' ')))
                return (
                  <div key={i} className="flex items-center gap-4 py-4">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                      ${isIssue ? 'bg-danger/10' : mobile.verdict ? 'bg-meta-3/10' : 'bg-stroke/50 dark:bg-strokedark'}`}>
                      {isIssue ? (
                        <svg className="h-3.5 w-3.5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      ) : (
                        <svg className={`h-3.5 w-3.5 ${mobile.verdict ? 'text-meta-3' : 'text-body dark:text-bodydark'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      )}
                    </span>
                    <p className={`text-sm ${isIssue ? 'text-danger' : 'text-black dark:text-white'}`}>{bp}</p>
                    {isIssue && <span className="ml-auto shrink-0 rounded px-2 py-0.5 text-[11px] font-bold bg-danger/10 text-danger">Issue</span>}
                  </div>
                )
              })}
            </div>
            <div className="border-t border-stroke px-6 py-4 dark:border-strokedark">
              <div className="flex items-start gap-3 rounded-lg bg-[#1A72D9]/5 px-4 py-3 border border-[#1A72D9]/10">
                <svg className="h-4 w-4 text-[#1A72D9] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <p className="text-xs text-body dark:text-bodydark">
                  Mobile usability issues can negatively impact your site's ranking in Google Search. Fix all detected issues to maintain search visibility on mobile devices.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
