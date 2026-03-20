import { useRef } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'

// ─── Mock data ───────────────────────────────────────────────────────────────

const DAYS = Array.from({ length: 28 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (27 - i))
  return d.toISOString().split('T')[0]
})

// Community – Growth
const FOLLOWERS_SERIES  = [110,113,117,120,124,127,131,135,138,141,145,148,152,155,159,162,166,169,173,176,180,183,187,190,194,197,201,204]
const FANS_SERIES       = [720,723,726,727,729,731,733,736,738,740,742,744,746,748,750,752,754,756,759,761,763,765,767,769,771,773,775,777]
const REACH_SERIES      = [58,61,57,63,59,65,61,58,64,60,56,61,59,63,60,57,66,62,58,63,59,64,60,56,61,59,63,62]
const IMPRESSIONS_SERIES= [14,16,13,17,15,18,16,14,17,15,12,15,14,16,14,13,18,15,13,16,14,17,15,12,15,14,16,15]

// Community – Follower Balance
const GAINED_SERIES  = [3,4,3,5,4,6,4,3,5,4,2,4,3,5,3,2,7,4,2,5,3,5,4,2,4,3,5,4]
const LOST_SERIES    = [1,1,0,2,1,2,1,0,1,1,0,1,1,2,1,0,2,1,0,1,1,1,1,0,1,1,1,1]

// Community – Publications in Period
const PUBS_SERIES    = [4,5,3,6,4,7,5,4,6,4,3,5,4,6,5,3,8,5,3,6,4,6,5,3,5,4,6,5]
const PUBS_REACH     = [820,910,780,980,860,1040,920,800,1010,880,740,900,840,980,870,780,1100,950,810,980,870,1020,900,740,900,860,1010,950]

// Demographics
const COUNTRY_DATA = [
  { label: 'United States', value: 38, color: '#3B82F6' },
  { label: 'Colombia',      value: 22, color: '#10B981' },
  { label: 'India',         value: 12, color: '#F59E0B' },
  { label: 'Bangladesh',    value: 8,  color: '#EF4444' },
  { label: 'Pakistan',      value: 6,  color: '#8B5CF6' },
  { label: 'Puerto Rico',   value: 4,  color: '#EC4899' },
  { label: 'Portugal',      value: 3,  color: '#14B8A6' },
  { label: 'Others',        value: 7,  color: '#94A3B8' },
]

// Page Clicks
const CLICKS_SERIES = [0,2,0,3,1,4,2,0,3,1,0,2,1,3,1,0,5,2,0,3,1,3,2,0,2,1,3,2]
const PHONE_SERIES  = [58,63,55,66,60,68,63,57,65,61,54,62,59,65,61,55,70,63,57,65,60,66,62,54,62,59,65,63]
const DIR_SERIES    = [14,16,13,17,15,18,16,14,17,15,12,15,14,16,14,13,18,15,13,16,14,17,15,12,15,14,16,15]

// Posts – Summary
const POST_REACH_SERIES     = [690,760,650,820,720,880,780,670,850,740,620,750,700,820,730,650,920,800,680,820,730,860,760,620,750,710,840,800]
const POST_REACT_SERIES     = [4,5,4,6,5,7,5,4,6,5,3,5,4,6,5,3,7,5,4,6,4,6,5,3,5,4,6,5]
const POST_COMMENT_SERIES   = [4,5,3,5,4,6,5,4,5,4,3,4,4,5,4,3,6,5,3,5,4,5,4,3,4,4,5,5]
const POST_VIEWS_SERIES     = [92,101,88,108,96,114,103,90,110,97,84,99,93,107,97,87,119,104,90,108,96,113,100,84,99,94,109,104]
const POST_INTERACT_SERIES  = [14,16,13,17,15,18,16,14,17,15,12,15,14,16,15,12,19,15,13,16,14,17,15,12,14,14,16,15]

// Posts – Reels
const REEL_REACH_SERIES     = [210,240,195,265,230,285,250,210,275,240,195,240,225,265,240,205,300,260,215,265,235,275,245,195,240,225,265,255]
const REEL_REACT_SERIES     = [2,3,2,3,2,4,3,2,3,2,1,2,2,3,2,2,4,3,2,3,2,3,2,1,2,2,3,3]
const REEL_COMMENT_SERIES   = [1,2,1,2,1,2,2,1,2,1,1,1,1,2,1,1,3,2,1,2,1,2,2,1,1,1,2,2]
const REEL_INTERACT_SERIES  = [5,6,4,7,5,8,6,4,7,5,3,6,5,7,5,4,8,6,4,7,5,7,5,3,5,5,6,6]
const REEL_SHARES_SERIES    = [1,2,1,2,1,2,1,1,2,1,0,1,1,2,1,1,2,1,1,2,1,2,1,0,1,1,2,1]

const STATS = {
  followers: 204, fans: 777, reach: 62, impressions: 15,
  dailyFollowers: 0.04, viewsPerFan: 2.14, pubsPerDay: 0.61, pubsPerWeek: 4.25,
  gained: 4, lost: 1, totalPubs: 527, orgPubs: 9,
  websiteClicks: 0, phoneCalls: 60, directions: 17,
  postReach: 7140, postReactions: 5, postComments: 5, postViews: 99, postAll: 15,
  interReactions: 5, interComments: 0, interShares: 15,
  dailyReactions: 0.18, reactionsPerPost: 0.33,
  dailyComments: 0, commentsPerPost: 0, sharesPerPost: 0,
  reelEngagement: '1.2%', reelReach: 3500, reelViews: 6000, reelShares: 2,
}

const MOCK_POSTS = [
  { id: 1, type: 'Image', date: '2026-03-15', reach: 1240, views: 1890, reactions: 8, likes: 7, comments: 3, clicks: 12, shares: 2 },
  { id: 2, type: 'Image', date: '2026-03-12', reach: 980,  views: 1430, reactions: 5, likes: 5, comments: 1, clicks: 8,  shares: 1 },
  { id: 3, type: 'Video', date: '2026-03-08', reach: 1560, views: 2340, reactions: 12, likes: 11, comments: 5, clicks: 21, shares: 4 },
  { id: 4, type: 'Image', date: '2026-03-04', reach: 720,  views: 1050, reactions: 3, likes: 3, comments: 0, clicks: 5,  shares: 0 },
  { id: 5, type: 'Link',  date: '2026-02-28', reach: 840,  views: 1200, reactions: 4, likes: 4, comments: 2, clicks: 18, shares: 3 },
]

const MOCK_REELS = [
  { id: 1, title: 'Behind the scenes of our latest campaign', date: '2026-03-10', reach: 4200, views: 6800, reactions: 31, comments: 8, shares: 5 },
  { id: 2, title: 'Quick tips for social media marketing',    date: '2026-03-01', reach: 3100, views: 4900, reactions: 22, comments: 5, shares: 3 },
]

const COMPETITORS = [
  { name: 'Coca-Cola', followers: 108000000, likes: 0, comments: 0, shares: 0 },
  { name: 'Nike',      followers: 37000000,  likes: 0, comments: 0, shares: 0 },
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
    yaxis: { labels: { style: { fontSize: '10px', colors: '#94a3b8' }, formatter: (v: number) => fmt(v) } },
    tooltip: { theme: dark ? 'dark' : 'light', y: { formatter: (v: number) => fmt(v) } },
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const FB = '#1877F2'

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
      <p className="text-xl font-bold tabular-nums text-black dark:text-white">{value}</p>
      <p className="mt-0.5 text-[11px] text-body dark:text-bodydark">{label}</p>
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

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const dark = isDark()
  const options: ApexOptions = {
    chart: { type: 'donut', background: 'transparent', animations: { enabled: false } },
    colors: data.map(d => d.color),
    labels: data.map(d => d.label),
    legend: { show: false },
    plotOptions: { pie: { donut: { size: '65%' } } },
    dataLabels: { enabled: false },
    tooltip: { theme: dark ? 'dark' : 'light', y: { formatter: (v: number) => `${v}%` } },
    stroke: { width: 0 },
  }
  return (
    <div className="flex items-start gap-6">
      <div className="shrink-0">
        <ReactApexChart options={options} series={data.map(d => d.value)} type="donut" width={180} height={180} />
      </div>
      <div className="flex flex-col gap-2 pt-2">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-sm text-black dark:text-white">{d.label}</span>
            <span className="ml-auto pl-4 text-sm font-semibold tabular-nums text-body dark:text-bodydark">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PostTable({ posts }: { posts: typeof MOCK_POSTS }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stroke dark:border-strokedark">
            {['Date', 'Type', 'Reach', 'Views', 'Reactions', 'Likes', 'Comments', 'Clicks', 'Shares'].map(h => (
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
              <td className="py-3.5 px-4 tabular-nums font-semibold text-black dark:text-white">{fmt(p.reach)}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{fmt(p.views)}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{p.reactions}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{p.likes}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{p.comments}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{p.clicks}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{p.shares}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReelTable({ reels }: { reels: typeof MOCK_REELS }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stroke dark:border-strokedark">
            {['Reel', 'Date', 'Reach', 'Views', 'Reactions', 'Comments', 'Shares'].map(h => (
              <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke dark:divide-strokedark">
          {reels.map(r => (
            <tr key={r.id} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
              <td className="max-w-[260px] truncate py-3.5 pr-4 font-medium text-black dark:text-white" title={r.title}>{r.title}</td>
              <td className="whitespace-nowrap py-3.5 px-4 text-body dark:text-bodydark">
                {new Date(r.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td className="py-3.5 px-4 tabular-nums font-semibold text-black dark:text-white">{fmt(r.reach)}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{fmt(r.views)}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{r.reactions}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{r.comments}</td>
              <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{r.shares}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const NAV = [
  { id: 'community',    label: 'Community'    },
  { id: 'demographics', label: 'Demographics' },
  { id: 'page-clicks',  label: 'Page Clicks'  },
  { id: 'posts',        label: 'Posts'        },
  { id: 'reels',        label: 'Reels'        },
  { id: 'competitors',  label: 'Competitors'  },
]

export function FacebookDashboard() {
  const communityRef    = useRef<HTMLDivElement>(null)
  const demographicsRef = useRef<HTMLDivElement>(null)
  const pageClicksRef   = useRef<HTMLDivElement>(null)
  const postsRef        = useRef<HTMLDivElement>(null)
  const reelsRef        = useRef<HTMLDivElement>(null)
  const competitorsRef  = useRef<HTMLDivElement>(null)

  const refs: Record<string, React.RefObject<HTMLDivElement | null>> = {
    community: communityRef, demographics: demographicsRef,
    'page-clicks': pageClicksRef, posts: postsRef,
    reels: reelsRef, competitors: competitorsRef,
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

          {/* Growth */}
          <SectionCard title="Growth">
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Followers"   value={fmt(STATS.followers)}   color="#3B82F6" />
              <MetricPill label="Page Fans"   value={fmt(STATS.fans)}        color="#10B981" />
              <MetricPill label="Reach"       value={`${STATS.reach}K`}      color="#F59E0B" />
              <MetricPill label="Impressions" value={`${STATS.impressions}K`} color={FB} />
            </div>
            <ReactApexChart
              options={areaOptions('fb-growth', ['#3B82F6', '#10B981'], DAYS, ['Followers', 'Fans'])}
              series={[
                { name: 'Followers', data: FOLLOWERS_SERIES },
                { name: 'Fans',      data: FANS_SERIES },
              ]}
              type="area" height={160}
            />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SmallStatCard label="Avg daily followers" value={STATS.dailyFollowers.toFixed(2)} />
              <SmallStatCard label="Views per fan"       value={STATS.viewsPerFan.toFixed(2)} />
              <SmallStatCard label="Publications / day"  value={STATS.pubsPerDay.toFixed(2)} />
              <SmallStatCard label="Publications / week" value={STATS.pubsPerWeek.toFixed(2)} />
            </div>
          </SectionCard>

          {/* Follower Balance */}
          <SectionCard title="Follower Balance">
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Gained" value={fmt(STATS.gained)} color="#10B981" />
              <MetricPill label="Lost"   value={fmt(STATS.lost)}   color="#EF4444" />
              <MetricPill label="Net"    value={`+${STATS.gained - STATS.lost}`} color="#3B82F6" />
            </div>
            <ReactApexChart
              options={areaOptions('fb-balance', ['#10B981', '#EF4444'], DAYS, ['Gained', 'Lost'])}
              series={[
                { name: 'Gained', data: GAINED_SERIES },
                { name: 'Lost',   data: LOST_SERIES },
              ]}
              type="area" height={140}
            />
          </SectionCard>

          {/* Publications in Period */}
          <SectionCard title="Publications in Period">
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Total Posts" value={fmt(STATS.totalPubs)} color={FB} />
              <MetricPill label="Organic"     value={fmt(STATS.orgPubs)}   color="#10B981" />
            </div>
            <ReactApexChart
              options={areaOptions('fb-pubs', [FB, '#10B981'], DAYS, ['Posts', 'Reach'])}
              series={[
                { name: 'Posts', data: PUBS_SERIES },
                { name: 'Reach', data: PUBS_REACH.map(v => Math.round(v / 100)) },
              ]}
              type="area" height={140}
            />
          </SectionCard>
        </div>

        {/* ════════ DEMOGRAPHICS ════════ */}
        <div ref={demographicsRef} className="scroll-mt-6 space-y-6">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Demographics</h2>

          <SectionCard title="Followers by Country">
            <DonutChart data={COUNTRY_DATA} />
          </SectionCard>
        </div>

        {/* ════════ PAGE CLICKS ════════ */}
        <div ref={pageClicksRef} className="scroll-mt-6 space-y-6">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Page Clicks</h2>

          <SectionCard title="Clicks">
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Website Clicks" value={fmt(STATS.websiteClicks)} color="#94A3B8" />
              <MetricPill label="Phone Calls"    value={fmt(STATS.phoneCalls)}    color="#10B981" />
              <MetricPill label="Directions"     value={fmt(STATS.directions)}    color="#F59E0B" />
            </div>
            <ReactApexChart
              options={barOptions('fb-clicks', FB, DAYS)}
              series={[{ name: 'Total Clicks', data: CLICKS_SERIES.map((c, i) => c + PHONE_SERIES[i] + DIR_SERIES[i]) }]}
              type="bar" height={160}
            />
          </SectionCard>
        </div>

        {/* ════════ POSTS ════════ */}
        <div ref={postsRef} className="scroll-mt-6 space-y-6">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Posts in Period</h2>

          {/* Summary */}
          <SectionCard title="Summary">
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Reach"      value={fmt(STATS.postReach)}     color={FB} />
              <MetricPill label="Reactions"  value={fmt(STATS.postReactions)} color="#EC4899" />
              <MetricPill label="Comments"   value={fmt(STATS.postComments)}  color="#F59E0B" />
              <MetricPill label="Views"      value={fmt(STATS.postViews)}     color="#10B981" />
              <MetricPill label="All"        value={fmt(STATS.postAll)}       color="#8B5CF6" />
            </div>
            <ReactApexChart
              options={areaOptions('fb-posts-summary', [FB, '#EC4899', '#10B981'], DAYS, ['Reach', 'Reactions', 'Views'])}
              series={[
                { name: 'Reach',     data: POST_REACH_SERIES.map(v => Math.round(v / 100)) },
                { name: 'Reactions', data: POST_REACT_SERIES },
                { name: 'Views',     data: POST_VIEWS_SERIES },
              ]}
              type="area" height={160}
            />
          </SectionCard>

          {/* Interactions */}
          <SectionCard title="Interactions">
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Reactions" value={fmt(STATS.interReactions)} color="#EC4899" />
              <MetricPill label="Comments"  value={fmt(STATS.interComments)}  color="#F59E0B" />
              <MetricPill label="Shares"    value={fmt(STATS.interShares)}    color="#10B981" />
            </div>
            <ReactApexChart
              options={areaOptions('fb-posts-interact', ['#EC4899', '#F59E0B', '#10B981'], DAYS, ['Reactions', 'Comments', 'Shares'])}
              series={[
                { name: 'Reactions', data: POST_REACT_SERIES },
                { name: 'Comments',  data: POST_COMMENT_SERIES },
                { name: 'Shares',    data: POST_INTERACT_SERIES },
              ]}
              type="area" height={140}
            />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SmallStatCard label="Daily reactions"       value={STATS.dailyReactions.toFixed(2)} />
              <SmallStatCard label="Reactions / post"      value={STATS.reactionsPerPost.toFixed(2)} />
              <SmallStatCard label="Daily comments"        value={STATS.dailyComments.toString()} />
              <SmallStatCard label="Comments / post"       value={STATS.commentsPerPost.toString()} />
            </div>
          </SectionCard>

          {/* Content types + Visibility */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <SectionCard title="Content Types">
              <DonutChart data={[
                { label: 'Image', value: 72, color: FB },
                { label: 'Video', value: 18, color: '#10B981' },
                { label: 'Link',  value: 10, color: '#F59E0B' },
              ]} />
            </SectionCard>
            <SectionCard title="Visibility">
              <DonutChart data={[
                { label: 'Organic',  value: 57, color: '#10B981' },
                { label: 'Paid',     value: 43, color: FB },
              ]} />
            </SectionCard>
          </div>

          {/* Posts list */}
          <SectionCard title="Post List">
            <PostTable posts={MOCK_POSTS} />
          </SectionCard>
        </div>

        {/* ════════ REELS ════════ */}
        <div ref={reelsRef} className="scroll-mt-6 space-y-6">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Reels in Period</h2>

          {/* Reels Summary */}
          <SectionCard title="Summary">
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Engagement" value={STATS.reelEngagement}   color={FB} />
              <MetricPill label="Reach"      value={fmt(STATS.reelReach)}   color="#10B981" />
              <MetricPill label="Views"      value={fmt(STATS.reelViews)}   color="#F59E0B" />
              <MetricPill label="Shares"     value={fmt(STATS.reelShares)}  color="#8B5CF6" />
            </div>
            <ReactApexChart
              options={areaOptions('fb-reels-summary', [FB, '#10B981', '#F59E0B'], DAYS, ['Reach', 'Views', 'Shares'])}
              series={[
                { name: 'Reach',  data: REEL_REACH_SERIES.map(v => Math.round(v / 100)) },
                { name: 'Views',  data: REEL_INTERACT_SERIES },
                { name: 'Shares', data: REEL_SHARES_SERIES },
              ]}
              type="area" height={160}
            />
          </SectionCard>

          {/* Reels Interactions */}
          <SectionCard title="Interactions">
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <MetricPill label="Reactions" value={fmt(STATS.interReactions)} color="#EC4899" />
              <MetricPill label="Comments"  value="5"                          color="#F59E0B" />
              <MetricPill label="Shares"    value={fmt(STATS.reelShares)}      color="#10B981" />
            </div>
            <ReactApexChart
              options={barOptions('fb-reels-interact', '#EC4899', DAYS)}
              series={[{ name: 'Reactions', data: REEL_REACT_SERIES }]}
              type="bar" height={140}
            />
          </SectionCard>

          {/* Reels list */}
          <SectionCard title="Reel List">
            <ReelTable reels={MOCK_REELS} />
          </SectionCard>
        </div>

        {/* ════════ COMPETITORS ════════ */}
        <div ref={competitorsRef} className="scroll-mt-6 space-y-6">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Competitors</h2>

          <SectionCard title="Competitor List">
            {/* Upgrade notice */}
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-400/20 dark:bg-amber-400/10">
              <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Upgrade your plan to add up to <strong>100 competitors</strong> and unlock detailed benchmarks.
              </p>
              <button className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: FB }}>
                Upgrade
              </button>
            </div>

            {/* Competitors table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stroke dark:border-strokedark">
                    {['Competitor', 'Followers', 'Likes', 'Comments', 'Shares'].map(h => (
                      <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark first:pl-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke dark:divide-strokedark">
                  {COMPETITORS.map(c => (
                    <tr key={c.name} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                      <td className="py-3.5 pr-4 first:pl-0">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{ backgroundColor: FB }}>
                            {c.name[0]}
                          </span>
                          <span className="font-medium text-black dark:text-white">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 tabular-nums font-semibold text-black dark:text-white">{fmt(c.followers)}</td>
                      <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{c.likes || '—'}</td>
                      <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{c.comments || '—'}</td>
                      <td className="py-3.5 px-4 tabular-nums text-body dark:text-bodydark">{c.shares || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Empty state if no competitors added */}
            <div className="mt-8 flex flex-col items-center justify-center py-10 text-body dark:text-bodydark">
              <svg className="mb-3 h-12 w-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.804 15.803z" />
              </svg>
              <p className="text-sm font-medium">No competitors found</p>
              <p className="mt-1 text-xs opacity-60">Add competitors to start tracking their performance</p>
            </div>
          </SectionCard>
        </div>

      </div>
    </div>
  )
}
