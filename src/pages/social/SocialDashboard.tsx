import { useRef } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { DashboardControls } from '@/features/social/components/DashboardControls'
import {
  useSocialDashboardState,
  PLATFORMS,
  formatDateLabel,
  type SocialPlatform,
} from '@/features/social/hooks/useSocialDashboardState'

// ─── Mock data (replace with real API calls later) ──────────────────────────

const MOCK_DAYS = Array.from({ length: 28 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (27 - i))
  return d.toISOString().split('T')[0]
})

interface PlatformMetrics {
  seguidores: number
  seguidoresDelta: number[]
  impresiones: number
  impresionesDelta: number[]
  alcance: number
  alcanceDelta: number[]
  interacciones: number
  interaccionesDelta: number[]
  visitasPerfil: number
  visitasPerfilDelta: number[]
}

const MOCK_METRICS: Record<SocialPlatform, PlatformMetrics> = {
  instagram: {
    seguidores: 12480, seguidoresDelta: [110,115,118,122,126,129,133,137,140,143,148,151,155,158,162,165,169,172,176,179,183,186,190,193,197,200,204,207],
    impresiones: 84320, impresionesDelta: [2800,3100,2700,3200,2900,3400,3100,2800,3300,3000,2600,3100,2900,3200,3000,2700,3400,3100,2800,3200,2900,3300,3000,2600,3100,2900,3200,3100],
    alcance: 45600, alcanceDelta: [1500,1700,1400,1800,1600,1900,1700,1500,1800,1600,1400,1700,1600,1800,1600,1500,1900,1700,1500,1800,1600,1800,1700,1400,1700,1600,1800,1700],
    interacciones: 3240, interaccionesDelta: [110,125,105,130,120,140,128,112,135,122,108,125,118,132,121,110,138,128,112,130,120,133,122,108,125,118,132,121],
    visitasPerfil: 8920, visitasPerfilDelta: [295,325,280,340,310,365,335,295,350,315,275,325,305,340,315,285,360,330,295,340,310,345,315,275,325,305,340,330],
  },
  youtube: {
    seguidores: 5830, seguidoresDelta: [18,20,19,22,21,23,20,19,24,22,18,21,20,23,21,18,25,22,19,23,21,24,21,18,22,20,23,22],
    impresiones: 31200, impresionesDelta: [1050,1150,980,1200,1080,1260,1140,1020,1230,1110,960,1140,1070,1200,1110,990,1260,1140,1020,1200,1080,1230,1110,960,1140,1070,1200,1140],
    alcance: 18400, alcanceDelta: [600,680,580,710,640,760,690,620,730,660,570,680,640,710,660,590,760,690,620,710,640,730,660,570,680,640,710,690],
    interacciones: 1560, interaccionesDelta: [52,59,50,63,56,67,60,54,65,58,49,59,55,63,57,50,68,60,54,63,56,66,57,49,59,55,63,60],
    visitasPerfil: 4200, visitasPerfilDelta: [138,155,132,165,148,176,158,142,170,153,129,155,145,165,152,131,176,158,142,165,148,171,152,129,155,145,165,158],
  },
  facebook: {
    seguidores: 8940, seguidoresDelta: [28,31,27,34,30,36,32,28,35,31,26,31,29,34,30,27,37,32,28,34,30,35,31,26,31,29,34,32],
    impresiones: 52100, impresionesDelta: [1720,1920,1680,2000,1800,2100,1900,1700,2030,1840,1600,1900,1780,2000,1840,1650,2100,1900,1700,2000,1800,2030,1840,1600,1900,1780,2000,1900],
    alcance: 28300, alcanceDelta: [930,1040,910,1080,975,1140,1030,920,1100,990,865,1030,965,1085,997,894,1140,1030,920,1085,975,1100,990,865,1030,965,1085,1030],
    interacciones: 2100, interaccionesDelta: [69,79,67,82,73,88,79,69,84,76,63,79,73,83,76,67,89,79,69,83,73,84,76,63,79,73,83,79],
    visitasPerfil: 6300, visitasPerfilDelta: [207,235,201,246,219,264,237,207,252,228,189,237,219,249,228,201,267,237,207,249,219,252,228,189,237,219,249,237],
  },
  tiktok: {
    seguidores: 22100, seguidoresDelta: [180,200,175,210,190,220,200,178,215,195,170,200,185,215,195,175,225,200,178,210,190,215,195,170,200,185,215,200],
    impresiones: 145000, impresionesDelta: [4800,5300,4600,5500,5000,5800,5300,4700,5600,5100,4500,5300,4900,5500,5100,4600,5800,5300,4700,5500,5000,5600,5100,4500,5300,4900,5500,5300],
    alcance: 89000, alcanceDelta: [2950,3270,2850,3410,3100,3590,3270,2910,3470,3150,2790,3270,3030,3410,3150,2850,3590,3270,2910,3410,3100,3470,3150,2790,3270,3030,3410,3270],
    interacciones: 8900, interaccionesDelta: [295,330,285,345,310,360,330,293,348,315,279,330,305,345,315,285,360,330,293,345,310,348,315,279,330,305,345,330],
    visitasPerfil: 15600, visitasPerfilDelta: [515,575,498,605,545,630,575,513,608,552,489,575,533,605,552,498,630,575,513,605,545,608,552,489,575,533,605,575],
  },
  linkedin: {
    seguidores: 3200, seguidoresDelta: [10,11,9,12,10,13,11,9,12,11,8,11,10,12,11,9,13,11,9,12,10,12,11,8,11,10,12,11],
    impresiones: 18900, impresionesDelta: [624,693,600,720,648,756,693,615,729,660,576,693,636,720,660,594,756,693,615,720,648,729,660,576,693,636,720,693],
    alcance: 12100, alcanceDelta: [400,443,384,461,415,484,443,394,467,422,369,443,407,461,422,380,484,443,394,461,415,467,422,369,443,407,461,443],
    interacciones: 890, interaccionesDelta: [29,32,27,34,30,36,32,28,35,31,26,32,29,34,31,27,37,32,28,34,30,35,31,26,32,29,34,32],
    visitasPerfil: 2800, visitasPerfilDelta: [92,102,89,108,97,113,102,90,110,99,86,102,94,108,99,88,113,102,90,108,97,110,99,86,102,94,108,102],
  },
}

// Aggregate across selected platforms
function aggregateMetrics(platforms: SocialPlatform[]) {
  const initial = {
    seguidores: 0, seguidoresDelta: Array(28).fill(0) as number[],
    impresiones: 0, impresionesDelta: Array(28).fill(0) as number[],
    alcance: 0, alcanceDelta: Array(28).fill(0) as number[],
    interacciones: 0, interaccionesDelta: Array(28).fill(0) as number[],
    visitasPerfil: 0, visitasPerfilDelta: Array(28).fill(0) as number[],
  }
  return platforms.reduce((acc, p) => {
    const m = MOCK_METRICS[p]
    return {
      seguidores: acc.seguidores + m.seguidores,
      seguidoresDelta: acc.seguidoresDelta.map((v, i) => v + m.seguidoresDelta[i]),
      impresiones: acc.impresiones + m.impresiones,
      impresionesDelta: acc.impresionesDelta.map((v, i) => v + m.impresionesDelta[i]),
      alcance: acc.alcance + m.alcance,
      alcanceDelta: acc.alcanceDelta.map((v, i) => v + m.alcanceDelta[i]),
      interacciones: acc.interacciones + m.interacciones,
      interaccionesDelta: acc.interaccionesDelta.map((v, i) => v + m.interaccionesDelta[i]),
      visitasPerfil: acc.visitasPerfil + m.visitasPerfil,
      visitasPerfilDelta: acc.visitasPerfilDelta.map((v, i) => v + m.visitasPerfilDelta[i]),
    }
  }, initial)
}

// Mock posts
const MOCK_POSTS = [
  { id: 1, platform: 'instagram' as SocialPlatform, type: 'Image',   title: 'Spring 2026 new collection launch',           date: '2026-03-15', impresiones: 12400, alcance: 8200,  interacciones: 634,  guardados: 189, clicks: 423  },
  { id: 2, platform: 'tiktok'    as SocialPlatform, type: 'Video',   title: 'How to use our product? Full tutorial',       date: '2026-03-14', impresiones: 45200, alcance: 32100, interacciones: 2890, guardados: 0,   clicks: 1230 },
  { id: 3, platform: 'instagram' as SocialPlatform, type: 'Reel',    title: 'Behind the scenes of our photo shoot',        date: '2026-03-13', impresiones: 18900, alcance: 12300, interacciones: 1120, guardados: 340, clicks: 678  },
  { id: 4, platform: 'youtube'   as SocialPlatform, type: 'Video',   title: 'Full review: Is it worth the price?',         date: '2026-03-12', impresiones: 8700,  alcance: 6400,  interacciones: 456,  guardados: 0,   clicks: 312  },
  { id: 5, platform: 'facebook'  as SocialPlatform, type: 'Image',   title: 'Special offer: 30% off this weekend',         date: '2026-03-11', impresiones: 9200,  alcance: 7100,  interacciones: 389,  guardados: 0,   clicks: 567  },
  { id: 6, platform: 'linkedin'  as SocialPlatform, type: 'Article', title: 'How we grew 40% in 6 months',                 date: '2026-03-10', impresiones: 4300,  alcance: 3200,  interacciones: 210,  guardados: 0,   clicks: 145  },
  { id: 7, platform: 'tiktok'    as SocialPlatform, type: 'Video',   title: 'Fashion trends you need to know about',       date: '2026-03-09', impresiones: 62100, alcance: 48200, interacciones: 4230, guardados: 0,   clicks: 1890 },
  { id: 8, platform: 'instagram' as SocialPlatform, type: 'Carousel','title': '10 tips to improve your daily routine',     date: '2026-03-08', impresiones: 15600, alcance: 10800, interacciones: 890,  guardados: 420, clicks: 534  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('es-ES')
}

function platformColor(id: SocialPlatform): string {
  return PLATFORMS.find((p) => p.id === id)?.color ?? '#8B5CF6'
}

function platformLabel(id: SocialPlatform): string {
  return PLATFORMS.find((p) => p.id === id)?.label ?? id
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PlatformDot({ id }: { id: SocialPlatform }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
      style={{ backgroundColor: platformColor(id) }}
    />
  )
}

function MetricSection({
  title, value, data, labels, color, id
}: {
  title: string
  value: number
  data: number[]
  labels: string[]
  color: string
  id: string
}) {
  const isDark = document.documentElement.classList.contains('dark')

  const options: ApexOptions = {
    chart: {
      id,
      type: 'area',
      sparkline: { enabled: false },
      toolbar: { show: false },
      animations: { enabled: false },
      background: 'transparent',
    },
    colors: [color],
    stroke: { curve: 'smooth', width: 2.5 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.3,
        opacityTo: 0.02,
        stops: [0, 100],
      },
    },
    grid: {
      borderColor: isDark ? '#334155' : '#f1f5f9',
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { top: 0, right: 8, bottom: 0, left: 8 },
    },
    xaxis: {
      categories: labels,
      tickAmount: 6,
      labels: {
        show: true,
        style: { fontSize: '10px', colors: isDark ? '#94a3b8' : '#94a3b8' },
        formatter: (val: string) => {
          const d = new Date(val)
          return `${d.getDate()} ${d.toLocaleString('es', { month: 'short' })}`
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { fontSize: '10px', colors: isDark ? '#94a3b8' : '#94a3b8' },
        formatter: (val: number) => fmt(val),
      },
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      x: {
        formatter: (_, { dataPointIndex }) => {
          const d = new Date(labels[dataPointIndex])
          return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        }
      },
      y: { formatter: (val: number) => fmt(val) },
    },
    dataLabels: { enabled: false },
    markers: { size: 0 },
  }

  const series = [{ name: title, data }]

  return (
    <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-sm font-semibold text-body dark:text-bodydark">{title}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-black dark:text-white">{fmt(value)}</p>
        </div>
        <span
          className="mt-0.5 h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      {/* Chart */}
      <div className="-mb-2">
        <ReactApexChart options={options} series={series} type="area" height={120} />
      </div>
    </div>
  )
}

function PostTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    'Image':    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Video':    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Reel':     'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    'Carousel': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'Article':  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[type] ?? 'bg-stroke/50 text-body'}`}>
      {type}
    </span>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function SocialDashboard() {
  const state = useSocialDashboardState()
  const cuentaRef = useRef<HTMLDivElement>(null)
  const postsRef  = useRef<HTMLDivElement>(null)
  const isDark = document.documentElement.classList.contains('dark')

  const metrics = aggregateMetrics(state.selectedPlatforms)

  const filteredPosts = MOCK_POSTS.filter((p) =>
    state.selectedPlatforms.includes(p.platform)
  )

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <SkeletonTheme
      baseColor={isDark ? '#1e293b' : '#f1f5f9'}
      highlightColor={isDark ? '#334155' : '#e2e8f0'}
      borderRadius={8}
    >
      <div className="mx-auto max-w-screen-2xl p-6">

        {/* ── Header ── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">
              Social Media
              <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-bold bg-[#8B5CF6]/20 text-[#8B5CF6] align-middle">
                Intelligence
              </span>
            </h1>
            <p className="text-sm text-body dark:text-bodydark">
              Social Media APIs ·{' '}
              {state.lastUpdated ? `Updated ${state.lastUpdated.toLocaleTimeString()}` : 'All platforms · Live data'}
            </p>
          </div>
          <DashboardControls
            {...state}
            onRefresh={() => { /* real fetch will go here */ }}
            pageTitle="Social-Intelligence"
          />
        </div>

        {/* ── Tab nav (scroll anchors) ── */}
        <div className="mb-6 flex items-center gap-1 border-b border-stroke dark:border-strokedark">
          <button
            onClick={() => scrollTo(cuentaRef)}
            className="border-b-2 border-[#8B5CF6] pb-3 px-4 text-sm font-semibold text-[#8B5CF6]"
          >
            ACCOUNT
          </button>
          <button
            onClick={() => scrollTo(postsRef)}
            className="border-b-2 border-transparent pb-3 px-4 text-sm font-semibold text-body hover:text-black dark:text-bodydark dark:hover:text-white transition-colors"
          >
            POSTS
          </button>
        </div>

        {/* ── No platforms selected warning ── */}
        {state.selectedPlatforms.length === 0 && (
          <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4 dark:border-yellow-900/30 dark:bg-yellow-900/10">
            <p className="text-sm text-yellow-800 dark:text-yellow-400">
              Select at least one platform to view metrics.
            </p>
          </div>
        )}

        {/* ════════════════ ACCOUNT SECTION ════════════════ */}
        <div ref={cuentaRef} className="scroll-mt-6">

          {state.selectedPlatforms.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              <MetricSection
                id="chart-followers"
                title="Followers"
                value={metrics.seguidores}
                data={metrics.seguidoresDelta}
                labels={MOCK_DAYS}
                color="#8B5CF6"
              />
              <MetricSection
                id="chart-impressions"
                title="Impressions"
                value={metrics.impresiones}
                data={metrics.impresionesDelta}
                labels={MOCK_DAYS}
                color="#3B82F6"
              />
              <MetricSection
                id="chart-reach"
                title="Reach"
                value={metrics.alcance}
                data={metrics.alcanceDelta}
                labels={MOCK_DAYS}
                color="#10B981"
              />
              <MetricSection
                id="chart-interactions"
                title="Interactions"
                value={metrics.interacciones}
                data={metrics.interaccionesDelta}
                labels={MOCK_DAYS}
                color="#F59E0B"
              />
              <MetricSection
                id="chart-profile-visits"
                title="Profile Visits"
                value={metrics.visitasPerfil}
                data={metrics.visitasPerfilDelta}
                labels={MOCK_DAYS}
                color="#EF4444"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-xl border border-stroke bg-white px-5 py-5 dark:border-strokedark dark:bg-boxdark">
                  <Skeleton width={100} height={12} className="mb-2" />
                  <Skeleton width={70} height={32} className="mb-4" />
                  <Skeleton height={80} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Platform breakdown table ── */}
        {state.selectedPlatforms.length > 1 && (
          <div className="mt-6 rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="border-b border-stroke px-6 py-5 dark:border-strokedark">
              <h3 className="font-semibold text-black dark:text-white">Platform Breakdown</h3>
              <p className="mt-0.5 text-xs text-body dark:text-bodydark">Metrics comparison by social network</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stroke dark:border-strokedark">
                    {['Platform', 'Followers', 'Impressions', 'Reach', 'Interactions', 'Profile Visits'].map((h) => (
                      <th key={h} className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke dark:divide-strokedark">
                  {state.selectedPlatforms.map((pid) => {
                    const m = MOCK_METRICS[pid]
                    return (
                      <tr key={pid} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <PlatformDot id={pid} />
                            <span className="font-semibold text-black dark:text-white">{platformLabel(pid)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 tabular-nums text-black dark:text-white font-semibold">{fmt(m.seguidores)}</td>
                        <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(m.impresiones)}</td>
                        <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(m.alcance)}</td>
                        <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(m.interacciones)}</td>
                        <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(m.visitasPerfil)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════ POSTS SECTION ════════════════ */}
        <div ref={postsRef} className="mt-10 scroll-mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-black dark:text-white">Posts</h2>
              <p className="text-sm text-body dark:text-bodydark">Published content performance</p>
            </div>
            {filteredPosts.length > 0 && (
              <span className="rounded-full bg-stroke/50 px-2.5 py-1 text-xs font-semibold text-body dark:text-bodydark dark:bg-strokedark">
                {filteredPosts.length} posts
              </span>
            )}
          </div>

          <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            {filteredPosts.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-body dark:text-bodydark">
                  {state.selectedPlatforms.length === 0
                    ? 'Select a platform to view posts.'
                    : 'No posts found for the selected period.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stroke dark:border-strokedark">
                      {['Platform', 'Type', 'Post', 'Date', 'Impressions', 'Reach', 'Interactions', 'Saved', 'Clicks'].map((h) => (
                        <th key={h} className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke dark:divide-strokedark">
                    {filteredPosts.map((post) => (
                      <tr key={post.id} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <PlatformDot id={post.platform} />
                            <span className="text-xs font-medium text-body dark:text-bodydark">
                              {platformLabel(post.platform)}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <PostTypeBadge type={post.type} />
                        </td>
                        <td className="max-w-[240px] truncate px-5 py-4 font-medium text-black dark:text-white" title={post.title}>
                          {post.title}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-body dark:text-bodydark">
                          {new Date(post.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(post.impresiones)}</td>
                        <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(post.alcance)}</td>
                        <td className="px-5 py-4 tabular-nums font-semibold text-black dark:text-white">{fmt(post.interacciones)}</td>
                        <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">
                          {post.guardados > 0 ? fmt(post.guardados) : '—'}
                        </td>
                        <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(post.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </SkeletonTheme>
  )
}
