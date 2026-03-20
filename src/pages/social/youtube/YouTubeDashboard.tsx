import { useRef } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'

// ─── Mock data ───────────────────────────────────────────────────────────────

const DAYS = Array.from({ length: 28 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (27 - i))
  return d.toISOString().split('T')[0]
})

const SUBSCRIBERS_SERIES = [18,20,19,22,21,23,20,19,24,22,18,21,20,23,21,18,25,22,19,23,21,24,21,18,22,20,23,22]
const VIEWS_SERIES       = [1050,1150,980,1200,1080,1260,1140,1020,1230,1110,960,1140,1070,1200,1110,990,1260,1140,1020,1200,1080,1230,1110,960,1140,1070,1200,1140]
const LIKES_SERIES       = [52,59,50,63,56,67,60,54,65,58,49,59,55,63,57,50,68,60,54,63,56,66,57,49,59,55,63,60]
const COMMENTS_SERIES    = [12,15,11,16,13,18,15,12,17,14,10,15,13,16,14,11,19,15,12,16,13,17,14,10,15,13,16,15]
const SHARES_SERIES      = [28,32,27,35,30,38,33,28,36,31,25,32,29,34,31,26,39,33,28,35,30,36,31,25,32,29,34,33]
const GAINED_SERIES      = [22,25,21,28,24,30,26,21,29,25,19,25,23,28,24,20,32,26,21,28,24,29,25,19,25,23,28,26]
const LOST_SERIES        = [4,5,2,6,3,7,6,2,5,3,1,4,3,5,3,2,7,4,2,5,3,5,4,1,3,3,5,4]

const STATS = {
  subscribers:   5830,
  totalViews:    31200,
  positiveRate:  96.2,
  totalVideos:   22,
  gained:        320,
  lost:          48,
  avgViewsPerVideo: 1418,
  avgLikes:      71,
  avgComments:   14,
}

const MOCK_VIDEOS = [
  { id: 1, title: 'Full product review: Is it worth the price?',    date: '2026-03-12', views: 8700,  likes: 456,  dislikes: 18, comments: 89,  shares: 234 },
  { id: 2, title: '10 tips to get started — beginner guide',        date: '2026-03-08', views: 6200,  likes: 312,  dislikes: 9,  comments: 54,  shares: 178 },
  { id: 3, title: 'Behind the scenes: how we create our content',   date: '2026-03-04', views: 4900,  likes: 241,  dislikes: 12, comments: 43,  shares: 122 },
  { id: 4, title: 'Interview with our CEO — company vision 2026',   date: '2026-02-28', views: 3800,  likes: 189,  dislikes: 7,  comments: 35,  shares: 96  },
  { id: 5, title: 'Monthly recap: February highlights',             date: '2026-02-22', views: 2900,  likes: 145,  dislikes: 5,  comments: 28,  shares: 74  },
]

const MOCK_VISITED_VIDEOS = [
  { id: 1, title: 'Full product review: Is it worth the price?',    date: '2026-03-12', views: 8700,  likes: 456,  dislikes: 18, comments: 89,  shares: 234 },
  { id: 2, title: '10 tips to get started — beginner guide',        date: '2026-03-08', views: 6200,  likes: 312,  dislikes: 9,  comments: 54,  shares: 178 },
  { id: 3, title: 'Behind the scenes: how we create our content',   date: '2026-03-04', views: 4900,  likes: 241,  dislikes: 12, comments: 43,  shares: 122 },
]

const COMPETITORS = [
  { name: 'Google',   videoViews: 39200, subscribers: 14000000, videos: 22, likes: 879.5, dislikes: 0, comments: 69.9 },
  { name: 'YouTube',  videoViews: 0,     subscribers: 0,        videos: 0,  likes: 0,     dislikes: 0, comments: 0    },
  { name: 'TED Talks',videoViews: 18500, subscribers: 19200000, videos: 45, likes: 643.2, dislikes: 0, comments: 112  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

const isDark = () => document.documentElement.classList.contains('dark')

function areaOptions(id: string, colors: string[], labels: string[], names: string[]): ApexOptions {
  const dark = isDark()
  return {
    chart: { id, type: 'area', toolbar: { show: false }, animations: { enabled: false }, background: 'transparent' },
    colors,
    stroke: { curve: 'smooth', width: 2.5 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.2, opacityTo: 0.01, stops: [0, 100] } },
    legend: { show: names.length > 1, position: 'top', fontSize: '11px', labels: { colors: dark ? '#94a3b8' : '#64748b' } },
    grid: { borderColor: dark ? '#334155' : '#f1f5f9', strokeDashArray: 3, xaxis: { lines: { show: false } }, padding: { top: 0, right: 8, bottom: 0, left: 8 } },
    xaxis: {
      categories: labels, tickAmount: 6,
      labels: { show: true, style: { fontSize: '10px', colors: '#94a3b8' }, formatter: (v: string) => { const d = new Date(v); return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}` } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { labels: { style: { fontSize: '10px', colors: '#94a3b8' }, formatter: (v: number) => fmt(v) } },
    tooltip: { theme: dark ? 'dark' : 'light', y: { formatter: (v: number) => fmt(v) } },
    dataLabels: { enabled: false },
    markers: { size: 0 },
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
        <h3 className="font-semibold text-black dark:text-white">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function VideoTable({ videos }: { videos: typeof MOCK_VIDEOS }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stroke dark:border-strokedark">
            {['Video', 'Date', 'Views', 'Likes', 'Dislikes', 'Comments', 'Shares'].map(h => (
              <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke dark:divide-strokedark">
          {videos.map(v => (
            <tr key={v.id} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
              <td className="max-w-[260px] truncate py-3.5 pr-4 font-medium text-black dark:text-white" title={v.title}>{v.title}</td>
              <td className="whitespace-nowrap py-3.5 px-4 text-body dark:text-bodydark">
                {new Date(v.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td className="py-3.5 px-4 tabular-nums font-semibold text-black dark:text-white">{fmt(v.views)}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{fmt(v.likes)}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{v.dislikes}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{v.comments}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{v.shares}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const NAV = [
  { id: 'community',       label: 'Community'       },
  { id: 'published',       label: 'Published Videos' },
  { id: 'visited',         label: 'Videos with Views' },
  { id: 'competitors',     label: 'Competitors'     },
]

export function YouTubeDashboard() {
  const communityRef   = useRef<HTMLDivElement>(null)
  const publishedRef   = useRef<HTMLDivElement>(null)
  const visitedRef     = useRef<HTMLDivElement>(null)
  const competitorsRef = useRef<HTMLDivElement>(null)

  const refs: Record<string, React.RefObject<HTMLDivElement | null>> = {
    community: communityRef, published: publishedRef,
    visited: visitedRef, competitors: competitorsRef,
  }

  function scrollTo(id: string) {
    refs[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="mx-auto max-w-screen-2xl p-6">

      {/* ── Anchor nav ── */}
      <div className="mb-6 flex items-center gap-1 border-b border-stroke dark:border-strokedark">
        {NAV.map(n => (
          <button key={n.id} onClick={() => scrollTo(n.id)}
            className="border-b-2 border-transparent pb-3 px-4 text-sm font-semibold
                       text-body hover:border-[#FF0000] hover:text-[#FF0000]
                       dark:text-bodydark transition-colors">
            {n.label}
          </button>
        ))}
      </div>

      <div className="space-y-10">

        {/* ════════ COMMUNITY ════════ */}
        <div ref={communityRef} className="scroll-mt-6 space-y-6">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Community</h2>

          <SectionCard title="Growth">
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Subscribers"  value={fmt(STATS.subscribers)}  color="#3B82F6" />
              <MetricPill label="Total Views"  value={fmt(STATS.totalViews)}   color="#10B981" />
              <MetricPill label="Positive Rate" value={`${STATS.positiveRate}%`} color="#F59E0B" />
              <MetricPill label="Videos"       value={fmt(STATS.totalVideos)}  color="#FF0000" />
            </div>
            <ReactApexChart
              options={areaOptions('yt-growth', ['#3B82F6', '#10B981'], DAYS, ['Subscribers', 'Views'])}
              series={[
                { name: 'Subscribers', data: SUBSCRIBERS_SERIES },
                { name: 'Views',       data: VIEWS_SERIES.map(v => Math.round(v / 50)) },
              ]}
              type="area" height={160}
            />
          </SectionCard>

          <SectionCard title="Subscriber Balance">
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Gained"  value={`+${STATS.gained}`}  color="#10B981" />
              <MetricPill label="Lost"    value={`-${STATS.lost}`}    color="#EF4444" />
              <MetricPill label="Videos"  value={fmt(STATS.totalVideos)} color="#FF0000" />
            </div>
            <ReactApexChart
              options={areaOptions('yt-balance', ['#10B981', '#EF4444'], DAYS, ['Gained', 'Lost'])}
              series={[
                { name: 'Gained', data: GAINED_SERIES },
                { name: 'Lost',   data: LOST_SERIES   },
              ]}
              type="area" height={160}
            />
          </SectionCard>
        </div>

        {/* ════════ PUBLISHED VIDEOS ════════ */}
        <div ref={publishedRef} className="scroll-mt-6 space-y-6">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Published Videos</h2>

          <SectionCard title="Performance">
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Views"     value={fmt(STATS.totalViews)}          color="#10B981" />
              <MetricPill label="Likes"     value={fmt(STATS.avgLikes * STATS.totalVideos)}    color="#3B82F6" />
              <MetricPill label="Dislikes"  value="48"                             color="#EF4444" />
              <MetricPill label="Comments"  value={fmt(STATS.avgComments * STATS.totalVideos)} color="#8B5CF6" />
              <MetricPill label="Shares"    value={fmt(728)}                       color="#F59E0B" />
              <MetricPill label="Videos"    value={fmt(STATS.totalVideos)}         color="#FF0000" />
            </div>
            <ReactApexChart
              options={areaOptions('yt-published', ['#10B981', '#3B82F6', '#8B5CF6'], DAYS, ['Views', 'Likes', 'Comments'])}
              series={[
                { name: 'Views',    data: VIEWS_SERIES.map(v => Math.round(v / 10)) },
                { name: 'Likes',    data: LIKES_SERIES    },
                { name: 'Comments', data: COMMENTS_SERIES },
              ]}
              type="area" height={160}
            />
          </SectionCard>

          <SectionCard title="Video List">
            <VideoTable videos={MOCK_VIDEOS} />
          </SectionCard>
        </div>

        {/* ════════ VIDEOS WITH VIEWS ════════ */}
        <div ref={visitedRef} className="scroll-mt-6 space-y-6">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Videos with Views</h2>

          <SectionCard title="Performance">
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Views"    value={fmt(19800)} color="#10B981" />
              <MetricPill label="Likes"    value={fmt(1009)}  color="#3B82F6" />
              <MetricPill label="Dislikes" value="39"         color="#EF4444" />
              <MetricPill label="Comments" value={fmt(186)}   color="#8B5CF6" />
              <MetricPill label="Shares"   value={fmt(534)}   color="#F59E0B" />
            </div>
            <ReactApexChart
              options={areaOptions('yt-visited', ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'], DAYS, ['Views', 'Likes', 'Comments', 'Shares'])}
              series={[
                { name: 'Views',    data: VIEWS_SERIES.map(v => Math.round(v / 15)) },
                { name: 'Likes',    data: LIKES_SERIES.map(v => Math.round(v * 0.7)) },
                { name: 'Comments', data: COMMENTS_SERIES.map(v => Math.round(v * 0.7)) },
                { name: 'Shares',   data: SHARES_SERIES.map(v => Math.round(v * 0.7)) },
              ]}
              type="area" height={160}
            />
          </SectionCard>

          <SectionCard title="Video List">
            <VideoTable videos={MOCK_VISITED_VIDEOS} />
          </SectionCard>
        </div>

        {/* ════════ COMPETITORS ════════ */}
        <div ref={competitorsRef} className="scroll-mt-6 space-y-6">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Competitors</h2>

          <SectionCard title="Competitor List">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stroke dark:border-strokedark">
                    {['Competitor', 'Video Views', 'Subscribers', 'Videos', 'Likes', 'Dislikes', 'Comments'].map(h => (
                      <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark first:pl-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke dark:divide-strokedark">
                  {COMPETITORS.map(c => (
                    <tr key={c.name} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                      <td className="py-3.5 pr-4 font-semibold text-black dark:text-white first:pl-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 text-xs font-bold text-red-600">
                            {c.name.charAt(0)}
                          </span>
                          {c.name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 tabular-nums font-semibold text-black dark:text-white">{c.videoViews > 0 ? fmt(c.videoViews) : '0'}</td>
                      <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{c.subscribers > 0 ? fmt(c.subscribers) : '0'}</td>
                      <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{c.videos}</td>
                      <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{c.likes > 0 ? c.likes.toFixed(1) : '0'}</td>
                      <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{c.dislikes}</td>
                      <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{c.comments > 0 ? c.comments.toFixed(1) : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

      </div>
    </div>
  )
}
