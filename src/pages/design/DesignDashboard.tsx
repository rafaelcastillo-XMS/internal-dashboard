import { useState, useEffect, useCallback, useRef } from 'react'
import { edgeFetch } from '@/lib/edgeFetch'
import { clients as staticClients } from '@/data/dummy'
import { supabase } from '@/lib/supabase'
import { mergeClientWithProfile } from '@/features/clients/profiles'
import type { ClientProfileRow } from '@/features/clients/profiles'
import { SEO_API } from '@/features/seo/hooks/useSEODashboardState'
import { exportPageToPdf } from '@/features/seo/lib/exportPdf'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PsiMetrics {
  lcp: number | null
  inp: number | null
  cls: number | null
  fid: number | null
  fcp?: number | null
  ttfb?: number | null
  [key: string]: number | null | undefined
}

interface PsiScores {
  performance?: number | null
  accessibility?: number | null
  bestPractices?: number | null
  seo?: number | null
}

interface PsiData {
  metrics: PsiMetrics
  mobile: { verdict: string | null; issues: string[] }
  scores?: PsiScores
  auditedUrl: string | null
}

const EMPTY_PSI: PsiData = {
  metrics: { lcp: null, inp: null, cls: null, fid: null },
  mobile: { verdict: null, issues: [] },
  auditedUrl: null,
}

const SELECTED_KEY = 'xms_design_selected'

// ─── Metric config ────────────────────────────────────────────────────────────

const CWV_METRICS = [
  {
    key: 'lcp', label: 'LCP', desc: 'Largest Contentful Paint',
    good: 2.5, poor: 4.0,
    format: (v: number) => `${v.toFixed(2)}s`,
    tip: 'Time for the largest visible element to load. Target: ≤ 2.5s',
  },
  {
    key: 'inp', label: 'INP', desc: 'Interaction to Next Paint',
    good: 200, poor: 500,
    format: (v: number) => `${Math.round(v)}ms`,
    tip: 'Responsiveness to user interactions. Target: ≤ 200ms',
  },
  {
    key: 'cls', label: 'CLS', desc: 'Cumulative Layout Shift',
    good: 0.1, poor: 0.25,
    format: (v: number) => v.toFixed(3),
    tip: 'Visual stability — how much elements shift. Target: ≤ 0.1',
  },
  {
    key: 'fid', label: 'FID', desc: 'First Input Delay',
    good: 100, poor: 300,
    format: (v: number) => `${Math.round(v)}ms`,
    tip: 'Delay before the browser responds to the first interaction. Target: ≤ 100ms',
  },
]

function getStatus(value: number | null, good: number, poor: number): 'good' | 'needs-improvement' | 'poor' | null {
  if (value == null) return null
  if (value <= good) return 'good'
  if (value <= poor) return 'needs-improvement'
  return 'poor'
}

function statusScore(s: ReturnType<typeof getStatus>): number {
  if (s === 'good') return 100
  if (s === 'needs-improvement') return 50
  if (s === 'poor') return 0
  return 0
}

function computeScore(metrics: PsiMetrics): number | null {
  const results = CWV_METRICS.map(m => {
    const v = (metrics as Record<string, number | null>)[m.key]
    return getStatus(v, m.good, m.poor)
  })
  if (results.every(r => r === null)) return null
  const valid = results.filter(r => r !== null)
  return Math.round(valid.reduce((s, r) => s + statusScore(r), 0) / valid.length)
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function statusColors(s: ReturnType<typeof getStatus>) {
  if (s === 'good')              return { bg: 'bg-meta-3/10 border-meta-3/20',  text: 'text-meta-3',  dot: 'bg-meta-3',   label: 'Good' }
  if (s === 'needs-improvement') return { bg: 'bg-warning/10 border-warning/20', text: 'text-warning', dot: 'bg-warning',  label: 'Needs Work' }
  if (s === 'poor')              return { bg: 'bg-danger/10 border-danger/20',   text: 'text-danger',  dot: 'bg-danger',   label: 'Poor' }
  return { bg: 'bg-stroke/30 border-stroke', text: 'text-body dark:text-bodydark', dot: 'bg-body', label: '—' }
}

function scoreColor(score: number): string {
  if (score >= 90) return '#16a34a'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, label, size = 96 }: { score: number | null; label: string; size?: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const pct = score != null ? score / 100 : 0
  const color = score != null ? scoreColor(score) : '#e5e7eb'
  const offset = circ - pct * circ

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" className="dark:stroke-white/10" />
        {score != null && (
          <circle
            cx="48" cy="48" r={r}
            fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        )}
        <text x="48" y="48" textAnchor="middle" dominantBaseline="central"
          fill={score != null ? color : '#9ca3af'}
          style={{ fontSize: score != null ? 18 : 14, fontWeight: 700, fontFamily: 'inherit' }}>
          {score != null ? score : '—'}
        </text>
      </svg>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-body dark:text-bodydark">{label}</span>
    </div>
  )
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ value, metrics }: {
  metricKey?: string
  value: number | null
  metrics: typeof CWV_METRICS[number]
}) {
  const status = getStatus(value, metrics.good, metrics.poor)
  const { bg, text, dot, label } = statusColors(status)

  return (
    <div className={`rounded-xl border p-5 ${bg}`}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">{metrics.label}</p>
          <p className="mt-0.5 text-[11px] text-body/70 dark:text-bodydark/70">{metrics.desc}</p>
        </div>
        {status && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${text} ${bg} border`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            {label}
          </span>
        )}
      </div>
      <p className={`text-3xl font-bold tabular-nums ${value != null ? text : 'text-body dark:text-bodydark'}`}>
        {value != null ? metrics.format(value) : '—'}
      </p>
      <p className="mt-2 text-[11px] text-body/60 dark:text-bodydark/60">{metrics.tip}</p>
    </div>
  )
}

// ─── Category Score Card ──────────────────────────────────────────────────────

function CategoryCard({ label, score, icon }: { label: string; score: number | null; icon: React.ReactNode }) {
  const color = score != null ? scoreColor(score) : undefined
  return (
    <div className="flex items-center gap-3 rounded-xl border border-stroke bg-white p-4 shadow-sm dark:border-strokedark dark:bg-boxdark">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stroke/50 dark:bg-white/10">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-body dark:text-bodydark">{label}</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums" style={{ color: color ?? '#9ca3af' }}>
          {score != null ? score : '—'}
          {score != null && <span className="ml-0.5 text-sm font-normal opacity-60">/100</span>}
        </p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DesignDashboard() {
  // Client list
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string; website: string }[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    try { return JSON.parse(sessionStorage.getItem(SELECTED_KEY) || 'null')?.id || '' } catch { return '' }
  })

  // PSI state
  const [url, setUrl] = useState('')
  const [psi, setPsi] = useState<PsiData>(EMPTY_PSI)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCount = useRef(0)

  // Load client list: merge dummy clients with Supabase profiles
  useEffect(() => {
    ;(async () => {
      try {
        const { data: profiles } = await supabase.from('client_profiles').select('*')
        const profileMap = new Map<string, ClientProfileRow>()
        for (const p of profiles ?? []) profileMap.set(p.client_id, p)

        const merged = staticClients
          .filter(c => c.status === 'active')
          .map(c => mergeClientWithProfile(c, profileMap.get(c.id)))
          .filter(c => c.website)
          .map(c => ({ id: c.id, name: c.name, website: c.website }))

        setClientOptions(merged)
        if (!selectedClientId && merged.length > 0) {
          setSelectedClientId(merged[0].id)
        }
      } catch {
        const fallback = staticClients
          .filter(c => c.status === 'active' && c.website)
          .map(c => ({ id: c.id, name: c.name, website: c.website }))
        setClientOptions(fallback)
        if (!selectedClientId && fallback.length > 0) setSelectedClientId(fallback[0].id)
      }
    })()
  }, [])

  // Sync URL when client changes
  useEffect(() => {
    const client = clientOptions.find(c => c.id === selectedClientId)
    if (client) {
      setUrl(client.website)
      sessionStorage.setItem(SELECTED_KEY, JSON.stringify({ id: client.id, name: client.name }))
      window.dispatchEvent(new CustomEvent('design:client-changed', { detail: { name: client.name } }))
      setPsi(EMPTY_PSI)
      setLastUpdated(null)
      setError(null)
    }
  }, [selectedClientId, clientOptions])

  const runAnalysis = useCallback(async (targetUrl = url) => {
    if (!targetUrl) return
    setLoading(true)
    setError(null)
    const thisRun = ++fetchCount.current
    try {
      const params = new URLSearchParams({ url: targetUrl })
      const res = await edgeFetch(`${SEO_API}/psi?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (thisRun !== fetchCount.current) return
      if (data.error) throw new Error(data.error)
      setPsi({ ...EMPTY_PSI, ...data })
      setLastUpdated(new Date())
    } catch (err) {
      if (thisRun !== fetchCount.current) return
      setError((err as Error).message || 'Failed to fetch PageSpeed data')
    } finally {
      if (thisRun === fetchCount.current) setLoading(false)
    }
  }, [url])

  // Auto-run when URL is ready
  useEffect(() => {
    if (url) runAnalysis(url)
  }, [url])

  const score = psi.scores?.performance != null
    ? Math.round(psi.scores.performance * 100)
    : computeScore(psi.metrics)

  const hasData = psi.auditedUrl != null

  async function handleExport() {
    setExporting(true)
    const client = clientOptions.find(c => c.id === selectedClientId)
    try {
      await exportPageToPdf('Design-PSI', {
        subtitle: `PageSpeed Insights · ${client?.name ?? url}`,
        tables: [{
          title: 'Core Web Vitals',
          columns: ['Metric', 'Value', 'Status', 'Description'],
          rows: CWV_METRICS.map(m => {
            const v = (psi.metrics as Record<string, number | null>)[m.key]
            const s = getStatus(v, m.good, m.poor)
            return [m.label, v != null ? m.format(v) : '—', s ?? '—', m.desc]
          }),
        }],
      })
    } finally { setExporting(false) }
  }

  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">
            Design Intelligence
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-bold bg-[#7C3AED]/20 text-[#7C3AED] align-middle">
              PSI
            </span>
          </h1>
          <p className="text-sm text-body dark:text-bodydark">
            Google PageSpeed Insights · Web performance & usability analysis
            {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Client selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-body dark:text-bodydark whitespace-nowrap">Client</span>
            <div className="relative">
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                disabled={clientOptions.length === 0}
                className="appearance-none rounded-lg border border-stroke bg-white
                           py-1.5 pl-3 pr-8 text-xs font-medium text-black shadow-card
                           transition-colors hover:border-[#7C3AED] focus:border-[#7C3AED]
                           focus:outline-none disabled:opacity-50
                           dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9] max-w-[200px] truncate"
              >
                <option value="">{clientOptions.length === 0 ? 'Loading…' : 'Select client…'}</option>
                {clientOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                <svg className="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </span>
            </div>
          </div>

          {/* Analyze button */}
          <button
            onClick={() => runAnalysis()}
            disabled={loading || !url}
            className="flex items-center gap-2 rounded-lg border border-stroke bg-white
                       px-4 py-2 text-sm font-medium text-black shadow-card
                       transition-colors hover:border-[#7C3AED] hover:text-[#7C3AED]
                       disabled:opacity-60 dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]"
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={loading
                ? "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                : "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
              } />
            </svg>
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>

          {/* Export PDF */}
          {hasData && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 rounded-lg border border-stroke bg-white
                         px-4 py-2 text-sm font-medium text-black shadow-card
                         transition-colors hover:border-[#7C3AED] hover:text-[#7C3AED]
                         disabled:opacity-60 dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {exporting ? 'Exporting…' : 'Export PDF'}
            </button>
          )}
        </div>
      </div>

      {/* URL bar */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-stroke bg-white px-4 py-2.5 shadow-sm dark:border-strokedark dark:bg-boxdark">
          <svg className="h-4 w-4 shrink-0 text-[#7C3AED]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runAnalysis() }}
            placeholder="https://example.com"
            className="flex-1 bg-transparent text-sm text-black outline-none placeholder:text-body/50 dark:text-[#E2E5E9]"
          />
          {loading && (
            <svg className="h-4 w-4 shrink-0 animate-spin text-[#7C3AED]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
        {psi.auditedUrl && psi.auditedUrl !== url && (
          <p className="text-[11px] text-body dark:text-bodydark">
            Audited: <span className="font-medium">{psi.auditedUrl}</span>
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !hasData && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-stroke/30 dark:bg-white/5" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-xl bg-stroke/30 dark:bg-white/5" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasData && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7C3AED]/10">
            <svg className="h-8 w-8 text-[#7C3AED]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-black dark:text-[#E2E5E9]">No analysis yet</h3>
          <p className="mt-1 text-sm text-body dark:text-bodydark">
            Select a client and click <strong>Analyze</strong> to run PageSpeed Insights
          </p>
        </div>
      )}

      {/* Results */}
      {hasData && (
        <div className="space-y-6">

          {/* Score + Category overview */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* Performance ring */}
            <div className="flex items-center justify-center rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark lg:col-span-1">
              <div className="text-center">
                <ScoreRing score={score} label="Performance" size={112} />
                <p className="mt-3 text-xs text-body dark:text-bodydark">
                  {score != null
                    ? score >= 90 ? 'Excellent performance'
                    : score >= 50 ? 'Needs improvement'
                    : 'Poor performance'
                    : 'Insufficient data'}
                </p>
              </div>
            </div>

            {/* Category scores */}
            <div className="grid grid-cols-2 gap-3 lg:col-span-4 lg:grid-cols-4">
              <CategoryCard
                label="Performance"
                score={psi.scores?.performance != null ? Math.round(psi.scores.performance * 100) : score}
                icon={<svg className="h-5 w-5 text-[#7C3AED]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>}
              />
              <CategoryCard
                label="Accessibility"
                score={psi.scores?.accessibility != null ? Math.round(psi.scores.accessibility * 100) : null}
                icon={<svg className="h-5 w-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>}
              />
              <CategoryCard
                label="Best Practices"
                score={psi.scores?.bestPractices != null ? Math.round(psi.scores.bestPractices * 100) : null}
                icon={<svg className="h-5 w-5 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <CategoryCard
                label="SEO"
                score={psi.scores?.seo != null ? Math.round(psi.scores.seo * 100) : null}
                icon={<svg className="h-5 w-5 text-[#16a34a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" /></svg>}
              />
            </div>
          </div>

          {/* Core Web Vitals */}
          <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="border-b border-stroke px-6 py-5 dark:border-strokedark">
              <h3 className="font-semibold text-black dark:text-[#E2E5E9]">Core Web Vitals</h3>
              <p className="mt-0.5 text-xs text-body dark:text-bodydark">
                Google ranking signals · Mobile strategy · {psi.auditedUrl ?? url}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
              {CWV_METRICS.map(m => (
                <MetricCard
                  key={m.key}
                  metricKey={m.key}
                  value={(psi.metrics as Record<string, number | null>)[m.key]}
                  metrics={m}
                />
              ))}
            </div>
          </div>

          {/* Mobile Usability + Thresholds */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Mobile Usability */}
            <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="border-b border-stroke px-6 py-5 dark:border-strokedark">
                <h3 className="font-semibold text-black dark:text-[#E2E5E9]">Mobile Usability</h3>
                <p className="mt-0.5 text-xs text-body dark:text-bodydark">Google mobile-friendly assessment</p>
              </div>
              <div className="p-6">
                {psi.mobile.verdict ? (
                  <>
                    <div className={`mb-4 flex items-center gap-3 rounded-lg px-4 py-3
                      ${psi.mobile.verdict === 'PASS'
                        ? 'bg-meta-3/10 border border-meta-3/20'
                        : 'bg-danger/10 border border-danger/20'}`}>
                      <svg className={`h-5 w-5 shrink-0 ${psi.mobile.verdict === 'PASS' ? 'text-meta-3' : 'text-danger'}`}
                           fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {psi.mobile.verdict === 'PASS'
                          ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          : <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        }
                      </svg>
                      <div>
                        <p className={`text-sm font-semibold ${psi.mobile.verdict === 'PASS' ? 'text-meta-3' : 'text-danger'}`}>
                          {psi.mobile.verdict === 'PASS' ? 'Mobile Friendly' : 'Mobile Issues Detected'}
                        </p>
                        <p className="text-xs text-body dark:text-bodydark">
                          {psi.mobile.verdict === 'PASS'
                            ? 'Page passes Google mobile-friendliness checks'
                            : `${psi.mobile.issues?.length ?? 0} issue${(psi.mobile.issues?.length ?? 0) !== 1 ? 's' : ''} found`}
                        </p>
                      </div>
                    </div>
                    {psi.mobile.issues && psi.mobile.issues.length > 0 && (
                      <ul className="space-y-2">
                        {psi.mobile.issues.map((issue, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            <span className="text-body dark:text-bodydark">{issue}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-body dark:text-bodydark italic opacity-60">No mobile usability data available</p>
                )}
              </div>
            </div>

            {/* CWV Thresholds reference */}
            <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="border-b border-stroke px-6 py-5 dark:border-strokedark">
                <h3 className="font-semibold text-black dark:text-[#E2E5E9]">Google CWV Thresholds</h3>
                <p className="mt-0.5 text-xs text-body dark:text-bodydark">Official passing criteria for Core Web Vitals</p>
              </div>
              <div className="divide-y divide-stroke px-6 dark:divide-strokedark">
                {CWV_METRICS.map(({ key, label, good, poor, format, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3.5">
                    <div>
                      <p className="text-sm font-semibold text-black dark:text-[#E2E5E9]">{label}</p>
                      <p className="text-xs text-body dark:text-bodydark">{desc}</p>
                    </div>
                    <div className="text-right space-y-0.5">
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
      )}
    </div>
  )
}
