import { useEffect, useRef, useState, useCallback } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import { Lock, ExternalLink } from 'lucide-react'
import { DATE_PRESETS, getDateRange } from '@/features/social/hooks/useSocialDashboardState'

// ─── Types (mirror server/metaGraph.d.ts) ────────────────────────────────────

interface PageInfo {
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

interface FbPost {
  id: string
  date: string
  type: string
  message: string
  permalink: string
  image: string
  shares: number
}

interface Snapshot {
  page: PageInfo
  posts: FbPost[]
  gatedMetrics: { reason: string; permissions: string[]; metrics: string[] }
  fetchedAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

const isDark = () => document.documentElement.classList.contains('dark')

const FB = '#1877F2'

// Posts per day across the selected window — the only time series derivable
// without read_insights.
function postsPerDay(posts: FbPost[], days: number) {
  const buckets = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    buckets.set(d.toISOString().split('T')[0], 0)
  }
  for (const post of posts) {
    const key = post.date.split('T')[0]
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return { labels: [...buckets.keys()], values: [...buckets.values()] }
}

function barOptions(id: string, color: string, labels: string[]): ApexOptions {
  const dark = isDark()
  return {
    chart: { id, type: 'bar', toolbar: { show: false }, animations: { enabled: false }, background: 'transparent' },
    colors: [color],
    plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
    dataLabels: { enabled: false },
    grid: { borderColor: dark ? '#334155' : '#f1f5f9', strokeDashArray: 3, xaxis: { lines: { show: false } } },
    xaxis: {
      categories: labels, tickAmount: 6,
      labels: { style: { fontSize: '10px', colors: '#94a3b8' }, formatter: (v: string) => { const d = new Date(v); return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}` } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { labels: { style: { fontSize: '10px', colors: '#94a3b8' }, formatter: (v: number) => String(Math.round(v)) } },
    tooltip: { theme: dark ? 'dark' : 'light' },
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="w-36 rounded-xl px-4 py-3 text-left"
         style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}>
      <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="mt-0.5 text-[11px] font-medium" style={{ color: `${color}99` }}>{label}</p>
    </div>
  )
}

function SmallStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stroke bg-white px-4 py-3 dark:border-strokedark dark:bg-boxdark">
      <p className="text-xl font-bold tabular-nums text-black dark:text-[#E2E5E9]">{value}</p>
      <p className="mt-0.5 text-[11px] text-body dark:text-bodydark">{label}</p>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
        <h3 className="font-semibold text-black dark:text-[#E2E5E9]">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

// Metrics Meta will not return until the app clears App Review. Shown as an
// explicit locked state rather than placeholder numbers.
function LockedCard({ title, metrics, permission }: { title: string; metrics: string[]; permission: string }) {
  return (
    <div className="rounded-xl border border-dashed border-stroke bg-white/60 px-6 py-5 dark:border-strokedark dark:bg-boxdark/60">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-body dark:text-bodydark" />
        <div className="min-w-0">
          <p className="font-semibold text-black dark:text-[#E2E5E9]">{title}</p>
          <p className="mt-1 text-sm text-body dark:text-bodydark">
            {metrics.join(' · ')}
          </p>
          <p className="mt-2 text-xs text-body dark:text-bodydark">
            Requires the <code className="rounded bg-stroke/50 px-1 py-0.5 font-mono text-[11px] dark:bg-strokedark">{permission}</code> permission — pending Meta App Review.
          </p>
        </div>
      </div>
    </div>
  )
}

function PostTable({ posts }: { posts: FbPost[] }) {
  if (posts.length === 0) {
    return <p className="py-8 text-center text-sm text-body dark:text-bodydark">No posts published in this period.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stroke dark:border-strokedark">
            {['Date', 'Type', 'Post', 'Shares', ''].map(h => (
              <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke dark:divide-strokedark">
          {posts.map(p => (
            <tr key={p.id} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
              <td className="whitespace-nowrap py-3.5 pr-4 text-body dark:text-bodydark">
                {new Date(p.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td className="py-3.5 px-4">
                <span className="rounded px-2 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: `${FB}18`, color: FB }}>
                  {p.type}
                </span>
              </td>
              <td className="max-w-[420px] py-3.5 px-4">
                <div className="flex items-center gap-3">
                  {p.image && <img src={p.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />}
                  <span className="truncate text-black dark:text-[#E2E5E9]" title={p.message}>
                    {p.message || <span className="opacity-50">(no caption)</span>}
                  </span>
                </div>
              </td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{p.shares || '—'}</td>
              <td className="py-3.5 px-4">
                {p.permalink && (
                  <a href={p.permalink} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: FB }}>
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const NAV = [
  { id: 'community', label: 'Community' },
  { id: 'posts',     label: 'Posts'     },
  { id: 'locked',    label: 'Locked'    },
]

export function FacebookDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [preset, setPreset]     = useState(1)

  const communityRef = useRef<HTMLDivElement>(null)
  const postsRef     = useRef<HTMLDivElement>(null)
  const lockedRef    = useRef<HTMLDivElement>(null)

  const refs: Record<string, React.RefObject<HTMLDivElement | null>> = {
    community: communityRef, posts: postsRef, locked: lockedRef,
  }

  const days = DATE_PRESETS[preset].days

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { startDate, endDate } = getDateRange(days)
      const res  = await fetch(`/api/social/facebook?since=${startDate}&until=${endDate}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
      setSnapshot(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Facebook data')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  function scrollTo(id: string) {
    refs[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const page   = snapshot?.page
  const posts  = snapshot?.posts ?? []
  const series = postsPerDay(posts, days)

  return (
    <div className="mx-auto max-w-screen-2xl p-6">

      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {page?.picture && <img src={page.picture} alt="" className="h-11 w-11 rounded-full" />}
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">
              {page?.name ?? 'Facebook'}
            </h1>
            <p className="text-sm text-body dark:text-bodydark">
              {page?.category ?? 'Meta Graph API'}
              {snapshot && ` · Updated ${new Date(snapshot.fetchedAt).toLocaleTimeString()}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-stroke bg-white p-1 shadow-card dark:border-strokedark dark:bg-boxdark">
            {DATE_PRESETS.map((p, idx) => (
              <button key={p.days} onClick={() => setPreset(idx)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${preset === idx ? 'text-white shadow-sm' : 'text-body hover:text-black dark:text-bodydark dark:hover:text-white'}`}
                style={preset === idx ? { backgroundColor: FB } : undefined}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black shadow-card transition-colors hover:border-[#1877F2] hover:text-[#1877F2] disabled:opacity-60 dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-900/30 dark:bg-red-900/10">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ── Anchor nav ── */}
      <div className="mb-6 flex items-center gap-1 border-b border-stroke dark:border-strokedark">
        {NAV.map(n => (
          <button key={n.id} onClick={() => scrollTo(n.id)}
            className="border-b-2 border-transparent pb-3 px-4 text-sm font-semibold
                       text-body hover:border-[#1877F2] hover:text-[#1877F2]
                       dark:text-bodydark transition-colors">
            {n.label}
          </button>
        ))}
      </div>

      <div className="space-y-10">

        {/* ════════ COMMUNITY ════════ */}
        <div ref={communityRef} className="scroll-mt-6 space-y-6">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Community</h2>

          <SectionCard title="Audience">
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Followers"     value={page?.followers != null ? fmt(page.followers) : '—'} color="#3B82F6" />
              <MetricPill label="Page Fans"     value={page?.fans != null ? fmt(page.fans) : '—'}           color="#10B981" />
              <MetricPill label="Talking About" value={page?.talkingAbout != null ? fmt(page.talkingAbout) : '—'} color="#F59E0B" />
              <MetricPill label="Ratings"       value={page?.ratingCount != null ? fmt(page.ratingCount) : '—'}   color={FB} />
            </div>
            {page?.link && (
              <a href={page.link} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline" style={{ color: FB }}>
                Open Page on Facebook <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </SectionCard>

          <SectionCard title={`Publishing Activity — last ${days} days`}>
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Posts" value={String(posts.length)} color={FB} />
              <MetricPill label="Shares" value={String(posts.reduce((sum, p) => sum + p.shares, 0))} color="#10B981" />
            </div>
            <ReactApexChart
              options={barOptions('fb-pubs', FB, series.labels)}
              series={[{ name: 'Posts', data: series.values }]}
              type="bar" height={160}
            />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <SmallStatCard label="Posts / day"  value={(posts.length / days).toFixed(2)} />
              <SmallStatCard label="Posts / week" value={(posts.length / days * 7).toFixed(2)} />
              <SmallStatCard label="Days active"  value={String(series.values.filter(v => v > 0).length)} />
            </div>
          </SectionCard>
        </div>

        {/* ════════ POSTS ════════ */}
        <div ref={postsRef} className="scroll-mt-6 space-y-6">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Posts in Period</h2>
          <SectionCard title="Post List">
            {loading && !snapshot
              ? <p className="py-8 text-center text-sm text-body dark:text-bodydark">Loading posts…</p>
              : <PostTable posts={posts} />}
          </SectionCard>
        </div>

        {/* ════════ LOCKED ════════ */}
        <div ref={lockedRef} className="scroll-mt-6 space-y-4">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Pending Meta App Review</h2>
          <p className="text-sm text-body dark:text-bodydark">
            Meta gates these behind App Review with a screencast. They stay empty rather than showing estimates.
          </p>
          <LockedCard title="Reach &amp; Impressions"  metrics={['Reach', 'Impressions', 'Page views', 'Daily follower balance']} permission="read_insights" />
          <LockedCard title="Engagement counts"        metrics={['Likes', 'Comments', 'Reactions by type']}                      permission="pages_read_user_content" />
          <LockedCard title="Demographics"             metrics={['Country', 'City', 'Age', 'Gender']}                            permission="read_insights" />
          <LockedCard title="Page clicks"              metrics={['Website clicks', 'Phone calls', 'Directions']}                 permission="read_insights" />
        </div>

      </div>
    </div>
  )
}
