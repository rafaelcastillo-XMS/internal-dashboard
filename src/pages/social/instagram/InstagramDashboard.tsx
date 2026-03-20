import { useRef } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'

// ─── Mock data ───────────────────────────────────────────────────────────────

const DAYS = Array.from({ length: 28 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (27 - i))
  return d.toISOString().split('T')[0]
})

const FOLLOWERS_SERIES   = [110,115,118,122,126,129,133,137,140,143,148,151,155,158,162,165,169,172,176,179,183,186,190,193,197,200,204,207]
const IMPRESSIONS_SERIES = [2800,3100,2700,3200,2900,3400,3100,2800,3300,3000,2600,3100,2900,3200,3000,2700,3400,3100,2800,3200,2900,3300,3000,2600,3100,2900,3200,3100]
const REACH_SERIES       = [1500,1700,1400,1800,1600,1900,1700,1500,1800,1600,1400,1700,1600,1800,1600,1500,1900,1700,1500,1800,1600,1800,1700,1400,1700,1600,1800,1700]
const PROFILE_VIEWS_SERIES = [295,325,280,340,310,365,335,295,350,315,275,325,305,340,315,285,360,330,295,340,310,345,315,275,325,305,340,330]

const STATS = {
  followers: 12480, following: 843, totalContent: 312,
  dailyFollowers: 7.4, followersPerPost: 40.2, postsPerDay: 0.8, postsPerWeek: 5.6,
}

const GENDER_DATA = [
  { label: 'Men',     value: 54, color: '#3B82F6' },
  { label: 'Women',   value: 40, color: '#EC4899' },
  { label: 'Unknown', value: 6,  color: '#94A3B8' },
]

const AGE_DATA = {
  categories: ['13-17','18-24','25-34','35-44','45-54','55-64','65+'],
  values: [1.2, 14.8, 52.3, 18.7, 7.4, 3.8, 1.8],
}

const COUNTRY_DATA = [
  { label: 'Colombia',      value: 62, color: '#3B82F6' },
  { label: 'United States', value: 14, color: '#10B981' },
  { label: 'Spain',         value: 8,  color: '#F59E0B' },
  { label: 'Mexico',        value: 6,  color: '#EF4444' },
  { label: 'Argentina',     value: 4,  color: '#8B5CF6' },
  { label: 'Other',         value: 6,  color: '#94A3B8' },
]

const CITY_DATA = [
  { city: 'Cartagena, Bolívar',              pct: '28.04%' },
  { city: 'Bogotá, Distrito Especial',       pct: '11.91%' },
  { city: 'Santiago de Cali, Valle del Cauca', pct: '8.44%' },
  { city: 'Barranquilla, Atlántico',         pct: '4.47%' },
  { city: 'Medellín, Antioquia',             pct: '3.72%' },
  { city: 'Bucaramanga, Santander',          pct: '2.91%' },
  { city: 'Pereira, Risaralda',              pct: '2.14%' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

const isDark = () => document.documentElement.classList.contains('dark')

function areaOptions(id: string, color: string, labels: string[]): ApexOptions {
  const dark = isDark()
  return {
    chart: { id, type: 'area', toolbar: { show: false }, animations: { enabled: false }, background: 'transparent' },
    colors: [color],
    stroke: { curve: 'smooth', width: 2.5 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.02, stops: [0, 100] } },
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
    <div
      className="w-36 rounded-xl px-4 py-3 text-left"
      style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
    >
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

function DonutChart({ data, title }: { data: { label: string; value: number; color: string }[]; title: string }) {
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
    <div className="flex items-center gap-6">
      <div className="shrink-0">
        <ReactApexChart options={options} series={data.map(d => d.value)} type="donut" width={180} height={180} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark mb-1">{title}</p>
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-sm text-black dark:text-white">{d.label}</span>
            <span className="ml-2 text-sm font-semibold tabular-nums text-body dark:text-bodydark">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgeChart() {
  const dark = isDark()
  const options: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, background: 'transparent', animations: { enabled: false } },
    colors: ['#3B82F6'],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
    dataLabels: { enabled: false },
    xaxis: { categories: AGE_DATA.categories, labels: { style: { fontSize: '11px', colors: '#94a3b8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { fontSize: '10px', colors: '#94a3b8' }, formatter: (v: number) => `${v}%` } },
    grid: { borderColor: dark ? '#334155' : '#f1f5f9', strokeDashArray: 3, xaxis: { lines: { show: false } } },
    tooltip: { theme: dark ? 'dark' : 'light', y: { formatter: (v: number) => `${v}%` } },
  }
  return <ReactApexChart options={options} series={[{ name: 'Followers', data: AGE_DATA.values }]} type="bar" height={200} />
}

// ─── Main component ───────────────────────────────────────────────────────────

const NAV = [
  { id: 'community',    label: 'Community'    },
  { id: 'demographics', label: 'Demographics' },
  { id: 'account',      label: 'Account'      },
]

export function InstagramDashboard() {
  const communityRef    = useRef<HTMLDivElement>(null)
  const demographicsRef = useRef<HTMLDivElement>(null)
  const accountRef      = useRef<HTMLDivElement>(null)

  const refs: Record<string, React.RefObject<HTMLDivElement | null>> = {
    community: communityRef, demographics: demographicsRef, account: accountRef,
  }

  function scrollTo(id: string) {
    refs[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="mx-auto max-w-screen-2xl p-6">

      {/* ── Anchor nav ── */}
      <div className="mb-6 flex items-center gap-1 border-b border-stroke dark:border-strokedark">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => scrollTo(n.id)}
            className="border-b-2 border-transparent pb-3 px-4 text-sm font-semibold
                       text-body hover:border-[#E1306C] hover:text-[#E1306C]
                       dark:text-bodydark transition-colors"
          >
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
            <div className="mb-5 flex items-start gap-3">
              <MetricPill label="Followers"     value={fmt(STATS.followers)}    color="#E1306C" />
              <MetricPill label="Following"     value={fmt(STATS.following)}    color="#10B981" />
              <MetricPill label="Total Content" value={fmt(STATS.totalContent)} color="#F59E0B" />
            </div>
            <ReactApexChart
              options={areaOptions('ig-growth', '#E1306C', DAYS)}
              series={[{ name: 'Followers', data: FOLLOWERS_SERIES }]}
              type="area" height={160}
            />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <SmallStatCard label="Followers"          value={fmt(STATS.followers)} />
              <SmallStatCard label="Daily Followers"    value={STATS.dailyFollowers.toFixed(1)} />
              <SmallStatCard label="Followers / Post"   value={STATS.followersPerPost.toFixed(1)} />
              <SmallStatCard label="Following"          value={fmt(STATS.following)} />
              <SmallStatCard label="Posts / Day"        value={STATS.postsPerDay.toFixed(1)} />
              <SmallStatCard label="Posts / Week"       value={STATS.postsPerWeek.toFixed(1)} />
            </div>
          </SectionCard>

          {/* Follower Balance */}
          <SectionCard title="Follower Balance">
            <div className="mb-5 flex items-start gap-3">
              <MetricPill label="Net Followers" value="+207" color="#10B981" />
            </div>
            <ReactApexChart
              options={areaOptions('ig-balance', '#10B981', DAYS)}
              series={[{ name: 'Net Followers', data: FOLLOWERS_SERIES.map(v => Math.round(v * 0.12)) }]}
              type="area" height={160}
            />
          </SectionCard>
        </div>

        {/* ════════ DEMOGRAPHICS ════════ */}
        <div ref={demographicsRef} className="scroll-mt-6 space-y-6">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Demographics</h2>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard title="Gender">
              <DonutChart data={GENDER_DATA} title="Distribution" />
            </SectionCard>
            <SectionCard title="Age">
              <AgeChart />
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard title="Followers by Country">
              <DonutChart data={COUNTRY_DATA} title="Top countries" />
            </SectionCard>
            <SectionCard title="Followers by City">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stroke dark:border-strokedark">
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">City</th>
                      <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke dark:divide-strokedark">
                    {CITY_DATA.map((row) => (
                      <tr key={row.city} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                        <td className="py-3 text-black dark:text-white">{row.city}</td>
                        <td className="py-3 text-right tabular-nums font-semibold text-body dark:text-bodydark">{row.pct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>

        {/* ════════ ACCOUNT ════════ */}
        <div ref={accountRef} className="scroll-mt-6 space-y-6">
          <h2 className="text-base font-bold uppercase tracking-wider text-body dark:text-bodydark">Account</h2>

          <SectionCard title="Profile">
            <div className="mb-5 flex items-start gap-3">
              <MetricPill label="Profile Views"  value={fmt(8920)}  color="#3B82F6" />
              <MetricPill label="Reach"          value={fmt(45600)} color="#8B5CF6" />
              <MetricPill label="Total Content"  value={fmt(STATS.totalContent)} color="#F59E0B" />
            </div>
            <ReactApexChart
              options={areaOptions('ig-profile', '#3B82F6', DAYS)}
              series={[{ name: 'Profile Views', data: PROFILE_VIEWS_SERIES }]}
              type="area" height={160}
            />
          </SectionCard>

          <SectionCard title="Reach">
            <div className="mb-5 flex items-start gap-3">
              <MetricPill label="Impressions" value={fmt(84320)} color="#E1306C" />
              <MetricPill label="Reach"       value={fmt(45600)} color="#10B981" />
            </div>
            <ReactApexChart
              options={{
                ...areaOptions('ig-reach', '#10B981', DAYS),
                colors: ['#E1306C', '#10B981'],
              }}
              series={[
                { name: 'Impressions', data: IMPRESSIONS_SERIES },
                { name: 'Reach',       data: REACH_SERIES },
              ]}
              type="area" height={160}
            />
          </SectionCard>
        </div>

      </div>
    </div>
  )
}
