import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Download,
  Gauge,
  GitCompareArrows,
  Info,
  Link2,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface FindingRow {
  id: string
  client: string
  analysis_date: string | null
  seo_category: string | null
  initial_status: string | null
  created_at: string
}

interface Baseline {
  label: string
  client: string
  date: string
}

interface AhrefsSnapshotRow {
  id: string
  client: string
  domain: string
  snapshot_date: string
  domain_rating: number | null
  ahrefs_rank: number | null
  organic_traffic: number | null
  organic_keywords: number | null
  backlinks: number | null
  referring_domains: number | null
  created_at: string
}

interface ComparativeProps {
  selectedGscSite?: string
  clientName?: string
}

type MetricKey = keyof Pick<
  AhrefsSnapshotRow,
  'domain_rating' | 'ahrefs_rank' | 'organic_traffic' | 'organic_keywords' | 'backlinks' | 'referring_domains'
>

type MetricDefinition = {
  label: string
  key: MetricKey
  lowerIsBetter?: boolean
}

const AUTHORITY_METRICS: MetricDefinition[] = [
  { label: 'Domain Rating', key: 'domain_rating' },
  { label: 'Ahrefs Rank', key: 'ahrefs_rank', lowerIsBetter: true },
]

const VISIBILITY_METRICS: MetricDefinition[] = [
  { label: 'Organic Traffic', key: 'organic_traffic' },
  { label: 'Organic Keywords', key: 'organic_keywords' },
]

const LINK_METRICS: MetricDefinition[] = [
  { label: 'Backlinks', key: 'backlinks' },
  { label: 'Referring Domains', key: 'referring_domains' },
]

function categoryScore(findings: FindingRow[], category: string): number | null {
  const rows = findings.filter(row => row.seo_category === category)
  if (rows.length === 0) return null
  const completed = rows.filter(row => row.initial_status === 'Yes').length
  return Math.round((completed / rows.length) * 100)
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMetric(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function metricDelta(
  start: number | null | undefined,
  end: number | null | undefined,
  lowerIsBetter = false,
) {
  if (start === null || start === undefined || end === null || end === undefined) {
    return { label: 'No data', improved: null as boolean | null }
  }

  const difference = end - start
  const improved = difference === 0 ? null : lowerIsBetter ? difference < 0 : difference > 0
  if (difference === 0) return { label: 'No change', improved }

  const prefix = difference > 0 ? '+' : ''
  return { label: `${prefix}${difference.toLocaleString()}`, improved }
}

function SnapshotSelect({
  marker,
  title,
  tone,
  value,
  snapshots,
  onChange,
}: {
  marker: 'A' | 'B'
  title: string
  tone: 'rose' | 'amber'
  value: string
  snapshots: AhrefsSnapshotRow[]
  onChange: (value: string) => void
}) {
  const selected = snapshots.find(snapshot => snapshot.id === value)
  const badgeClass = tone === 'rose'
    ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300'
    : 'bg-amber-50 text-amber-500 dark:bg-amber-500/15 dark:text-amber-300'

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${badgeClass}`}>
          {marker}
        </span>
        <span className="text-xs font-bold tracking-[0.08em] text-black dark:text-[#E2E5E9]">{title}</span>
      </div>

      <label className="relative flex min-h-14 items-center rounded-xl border border-stroke bg-white pl-11 pr-9 transition focus-within:border-[#2B7FFF] focus-within:ring-2 focus-within:ring-[#2B7FFF]/10 dark:border-strokedark dark:bg-boxdark">
        <CalendarDays className="absolute left-3.5 h-4 w-4 text-body dark:text-bodydark" />
        <select
          value={value}
          onChange={event => onChange(event.target.value)}
          disabled={snapshots.length === 0}
          className="absolute inset-0 z-10 w-full cursor-pointer appearance-none bg-transparent px-11 pr-10 text-transparent outline-none disabled:cursor-not-allowed [&>option]:text-black"
          aria-label={title}
        >
          {snapshots.length === 0 ? (
            <option value="">No snapshots available</option>
          ) : snapshots.map(snapshot => (
            <option key={snapshot.id} value={snapshot.id}>{formatDate(snapshot.snapshot_date)}</option>
          ))}
        </select>
        <div className="min-w-0 py-2">
          <p className="truncate text-xs font-semibold text-black dark:text-[#E2E5E9]">
            {selected ? formatDate(selected.snapshot_date) : 'No snapshot available'}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-body dark:text-bodydark">
            {selected ? `${selected.domain} · DR ${formatMetric(selected.domain_rating)}` : 'Run an Ahrefs audit to create one'}
          </p>
        </div>
        <svg className="absolute right-3.5 h-3.5 w-3.5 text-body dark:text-bodydark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </label>
    </div>
  )
}

function SummaryMetric({
  title,
  start,
  end,
  lowerIsBetter,
  accent,
  icon,
}: {
  title: string
  start: number | null | undefined
  end: number | null | undefined
  lowerIsBetter?: boolean
  accent: 'emerald' | 'blue' | 'slate'
  icon: React.ReactNode
}) {
  const delta = metricDelta(start, end, lowerIsBetter)
  const borderClass = {
    emerald: 'border-emerald-200 dark:border-emerald-700/60',
    blue: 'border-blue-200 dark:border-blue-700/60',
    slate: 'border-stroke dark:border-strokedark',
  }[accent]
  const badgeClass = delta.improved === true
    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
    : delta.improved === false
      ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300'

  return (
    <div className={`rounded-xl border bg-white p-4 dark:bg-boxdark ${borderClass}`}>
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-black dark:text-[#E2E5E9]">
        {icon}
        {title}
      </div>
      <div className="flex items-center gap-3">
        <div>
          <span className="mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-50 text-[10px] font-bold text-rose-500 dark:bg-rose-500/15">A</span>
          <p className="text-xl font-bold tabular-nums text-body dark:text-bodydark">{formatMetric(start)}</p>
        </div>
        <ArrowRight className="mt-5 h-4 w-4 text-body dark:text-bodydark" />
        <div>
          <span className="mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-50 text-[10px] font-bold text-amber-500 dark:bg-amber-500/15">B</span>
          <p className="text-xl font-bold tabular-nums text-black dark:text-[#E2E5E9]">{formatMetric(end)}</p>
        </div>
      </div>
      <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${badgeClass}`}>
        {delta.label}
      </span>
    </div>
  )
}

function MilestoneMetric({
  metric,
  baseline,
  comparison,
}: {
  metric: MetricDefinition
  baseline?: AhrefsSnapshotRow
  comparison?: AhrefsSnapshotRow
}) {
  const start = baseline?.[metric.key] as number | null | undefined
  const end = comparison?.[metric.key] as number | null | undefined
  const delta = metricDelta(start, end, metric.lowerIsBetter)

  return (
    <div className="min-w-[150px]">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-black dark:text-[#E2E5E9]">{metric.label}</p>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-50 text-[9px] font-bold text-rose-500 dark:bg-rose-500/15">A</span>
        <span className="tabular-nums text-body dark:text-bodydark">{formatMetric(start)}</span>
        <ArrowRight className="h-3.5 w-3.5 text-body dark:text-bodydark" />
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-50 text-[9px] font-bold text-amber-500 dark:bg-amber-500/15">B</span>
        <span className={`font-semibold tabular-nums ${
          delta.improved === true
            ? 'text-[#2B7FFF]'
            : delta.improved === false
              ? 'text-rose-500'
              : 'text-black dark:text-[#E2E5E9]'
        }`}>
          {formatMetric(end)}
        </span>
      </div>
    </div>
  )
}

function MilestoneBlock({
  block,
  title,
  description,
  icon,
  metrics,
  baseline,
  comparison,
}: {
  block: string
  title: string
  description: string
  icon: React.ReactNode
  metrics: MetricDefinition[]
  baseline?: AhrefsSnapshotRow
  comparison?: AhrefsSnapshotRow
}) {
  return (
    <section className="rounded-xl border border-stroke bg-white p-5 shadow-sm dark:border-strokedark dark:bg-boxdark">
      <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-body dark:text-bodydark">{block}</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-black dark:text-[#E2E5E9]">{icon}</span>
        <h3 className="text-base font-semibold text-black dark:text-[#E2E5E9]">{title}</h3>
      </div>
      <p className="mt-3 max-w-4xl text-sm leading-relaxed text-body dark:text-bodydark">{description}</p>
      <div className="mt-4 border-t border-stroke pt-4 dark:border-strokedark">
        <div className="flex flex-wrap gap-x-9 gap-y-4">
          {metrics.map(metric => (
            <MilestoneMetric
              key={metric.key}
              metric={metric}
              baseline={baseline}
              comparison={comparison}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export function Comparative({ selectedGscSite, clientName }: ComparativeProps) {
  const [baselines, setBaselines] = useState<Baseline[]>([])
  const [selectedBaseline, setSelectedBaseline] = useState('')
  const [findings, setFindings] = useState<FindingRow[]>([])
  const [snapshots, setSnapshots] = useState<AhrefsSnapshotRow[]>([])
  const [snapshotAId, setSnapshotAId] = useState('')
  const [snapshotBId, setSnapshotBId] = useState('')
  const [psiScore, setPsiScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadBaselines() {
      let query = supabase
        .from('seo_initial_findings')
        .select('client, analysis_date, created_at')
        .eq('is_draft', false)
        .order('created_at', { ascending: true })

      if (clientName) query = query.eq('client', clientName)
      const { data } = await query
      if (!data?.length) {
        setBaselines([])
        setSelectedBaseline('')
        return
      }

      const seen = new Set<string>()
      const unique: Baseline[] = []
      data.forEach((row: { client: string; analysis_date: string | null; created_at: string }) => {
        const date = row.analysis_date ?? row.created_at.slice(0, 10)
        const key = `${row.client}|${date}`
        if (seen.has(key)) return
        seen.add(key)
        unique.push({ label: `${row.client} — ${formatDate(date)}`, client: row.client, date })
      })
      setBaselines(unique)
      setSelectedBaseline(unique[0]?.label ?? '')
    }

    void loadBaselines()
  }, [clientName])

  useEffect(() => {
    const baseline = baselines.find(item => item.label === selectedBaseline)
    const activeClient = clientName || baseline?.client
    if (!activeClient) {
      setFindings([])
      setSnapshots([])
      return
    }

    async function loadComparisonData() {
      setLoading(true)
      const findingsQuery = supabase
        .from('seo_initial_findings')
        .select('*')
        .eq('is_draft', false)
        .eq('client', activeClient!)

      if (baseline?.date) findingsQuery.eq('analysis_date', baseline.date)

      const [findingsResult, snapshotsResult] = await Promise.all([
        findingsQuery,
        supabase
          .from('seo_ahrefs_snapshots')
          .select('*')
          .eq('client', activeClient!)
          .order('snapshot_date', { ascending: true }),
      ])

      setFindings((findingsResult.data ?? []) as FindingRow[])
      const nextSnapshots = (snapshotsResult.data ?? []) as AhrefsSnapshotRow[]
      setSnapshots(nextSnapshots)
      setSnapshotAId(current => nextSnapshots.some(item => item.id === current) ? current : nextSnapshots[0]?.id ?? '')
      setSnapshotBId(current => nextSnapshots.some(item => item.id === current)
        ? current
        : nextSnapshots[nextSnapshots.length - 1]?.id ?? '')
      setLoading(false)
    }

    void loadComparisonData()
  }, [baselines, clientName, refreshKey, selectedBaseline])

  useEffect(() => {
    if (!selectedGscSite) {
      setPsiScore(null)
      return
    }
    const url = selectedGscSite.startsWith('sc-domain:')
      ? `https://${selectedGscSite.replace('sc-domain:', '')}`
      : selectedGscSite

    fetch(`/api/seo/pagespeed?url=${encodeURIComponent(url)}`)
      .then(response => response.json())
      .then(data => setPsiScore(typeof data.score === 'number' ? data.score : null))
      .catch(() => setPsiScore(null))
  }, [refreshKey, selectedGscSite])

  const snapshotA = snapshots.find(snapshot => snapshot.id === snapshotAId)
  const snapshotB = snapshots.find(snapshot => snapshot.id === snapshotBId)
  const hasValidComparison = Boolean(
    snapshotA && snapshotB && snapshotA.snapshot_date !== snapshotB.snapshot_date,
  )
  const comparisonSnapshot = hasValidComparison ? snapshotB : undefined
  const technicalBaseline = categoryScore(findings, 'Technical SEO')

  const trend = useMemo(() => {
    if (!snapshotA || !comparisonSnapshot) return { title: 'Create two Ahrefs snapshots to compare SEO progress', description: 'Run the audit at two different points in time to unlock an evidence-based comparison.' }

    const metrics = [...AUTHORITY_METRICS, ...VISIBILITY_METRICS, ...LINK_METRICS]
    const outcomes = metrics.map(metric => {
      const start = snapshotA[metric.key] as number | null
      const end = comparisonSnapshot[metric.key] as number | null
      return metricDelta(start, end, metric.lowerIsBetter).improved
    }).filter(value => value !== null)
    const improvements = outcomes.filter(Boolean).length
    const declines = outcomes.length - improvements
    const direction = improvements > declines ? 'positive SEO momentum' : improvements < declines ? 'areas that need attention' : 'stable SEO performance'

    return {
      title: `${clientName || snapshotA.client} shows ${direction}`,
      description: improvements > declines
        ? `${improvements} tracked metrics improved between the selected snapshots. Organic visibility and authority signals should be reviewed together to prioritize the next growth opportunities.`
        : `The selected snapshots show ${declines} metrics that declined or remained under pressure. Focus the next audit cycle on the milestone blocks below.`,
    }
  }, [clientName, comparisonSnapshot, snapshotA])

  async function handleDownloadPdf() {
    if (!reportRef.current || exporting || !hasValidComparison) return
    setExporting(true)
    try {
      const [h2cMod, jspdfMod] = await Promise.all([import('html2canvas'), import('jspdf')])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2canvas = (h2cMod as any).default ?? h2cMod
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { jsPDF } = jspdfMod as any
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
      const padding = 10
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const contentWidth = pdf.internal.pageSize.getWidth() - padding * 2
      const contentHeight = pdf.internal.pageSize.getHeight() - padding * 2
      const imageHeight = (canvas.height / canvas.width) * contentWidth
      const pixelsPerMm = canvas.height / imageHeight
      let y = 0
      let firstPage = true

      while (y < imageHeight - 0.5) {
        const sliceHeightMm = Math.min(contentHeight, imageHeight - y)
        const slice = document.createElement('canvas')
        slice.width = canvas.width
        slice.height = Math.max(1, Math.round(sliceHeightMm * pixelsPerMm))
        const context = slice.getContext('2d')!
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, slice.width, slice.height)
        context.drawImage(canvas, 0, Math.round(y * pixelsPerMm), canvas.width, slice.height, 0, 0, slice.width, slice.height)
        if (!firstPage) pdf.addPage()
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', padding, padding, contentWidth, sliceHeightMm)
        firstPage = false
        y += sliceHeightMm
      }

      pdf.save(`seo-comparison-${clientName || snapshotA?.client || 'report'}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-body dark:text-bodydark">Select snapshots to compare</p>
        <div className="rounded-xl border border-stroke bg-white p-5 shadow-sm dark:border-strokedark dark:bg-boxdark">
          <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-end">
            <SnapshotSelect marker="A" title="Baseline Snapshot" tone="rose" value={snapshotAId} snapshots={snapshots} onChange={setSnapshotAId} />
            <span className="mx-auto mb-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500 dark:bg-slate-700/70 dark:text-slate-300">Vs</span>
            <SnapshotSelect marker="B" title="Comparison Snapshot" tone="amber" value={snapshotBId} snapshots={snapshots} onChange={setSnapshotBId} />
            <button
              type="button"
              onClick={() => setRefreshKey(key => key + 1)}
              disabled={loading}
              className="mb-0.5 inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2B7FFF] px-5 text-sm font-semibold text-white transition hover:bg-[#1765D8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GitCompareArrows className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
              {loading ? 'Comparing…' : 'Compare'}
            </button>
          </div>
        </div>
      </div>

      {!loading && !hasValidComparison && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2B7FFF]" />
          <div>
            <p className="text-sm font-semibold">Two different snapshots are required</p>
            <p className="mt-1 text-xs leading-relaxed text-blue-800/80 dark:text-blue-200/80">
              {snapshots.length === 0
                ? 'Run the Ahrefs audit to create the first snapshot. Run it again on a later date to measure progress.'
                : 'There is only one saved snapshot for this client. Create another snapshot on a later date before exporting a comparison.'}
            </p>
          </div>
        </div>
      )}

      <div ref={reportRef} className="space-y-5">
        <section className="rounded-xl border border-stroke bg-white p-5 shadow-sm dark:border-strokedark dark:bg-boxdark">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2B7FFF]">Summary comparison</p>
          <h2 className="mt-3 text-xl font-semibold leading-tight text-black dark:text-[#E2E5E9] md:text-2xl">{trend.title}</h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-body dark:text-bodydark">{trend.description}</p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <SummaryMetric
              title="Domain Rating Evolution"
              start={snapshotA?.domain_rating}
              end={comparisonSnapshot?.domain_rating}
              accent="emerald"
              icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            />
            <SummaryMetric
              title="Organic Traffic Growth"
              start={snapshotA?.organic_traffic}
              end={comparisonSnapshot?.organic_traffic}
              accent="blue"
              icon={<Search className="h-4 w-4 text-[#2B7FFF]" />}
            />
            <SummaryMetric
              title="Ahrefs Rank Change"
              start={snapshotA?.ahrefs_rank}
              end={comparisonSnapshot?.ahrefs_rank}
              lowerIsBetter
              accent="slate"
              icon={snapshotA && comparisonSnapshot && (comparisonSnapshot.ahrefs_rank ?? Infinity) < (snapshotA.ahrefs_rank ?? Infinity)
                ? <TrendingUp className="h-4 w-4 text-emerald-500" />
                : <TrendingDown className="h-4 w-4 text-slate-400" />}
            />
          </div>
        </section>

        <div>
          <h2 className="mb-3 text-lg font-semibold text-black dark:text-[#E2E5E9]">Optimization Milestones</h2>
          <div className="space-y-4">
            <MilestoneBlock
              block="Block A · Authority & Trust"
              title="Domain Authority Progress"
              description="Review how the website's authority changed between snapshots. A stronger Domain Rating and a lower Ahrefs Rank indicate a more competitive backlink profile."
              icon={<ShieldCheck className="h-5 w-5" />}
              metrics={AUTHORITY_METRICS}
              baseline={snapshotA}
              comparison={comparisonSnapshot}
            />
            <MilestoneBlock
              block="Block B · Organic Search Visibility"
              title="Search Visibility & Demand Capture"
              description="Organic traffic and ranking keywords show whether the site is reaching more potential customers through unpaid search results."
              icon={<Search className="h-5 w-5" />}
              metrics={VISIBILITY_METRICS}
              baseline={snapshotA}
              comparison={comparisonSnapshot}
            />
            <MilestoneBlock
              block="Block C · Link Profile"
              title="Backlinks & Referring Domains"
              description="Link growth should be supported by a healthy increase in unique referring domains, not only a larger raw backlink count."
              icon={<Link2 className="h-5 w-5" />}
              metrics={LINK_METRICS}
              baseline={snapshotA}
              comparison={comparisonSnapshot}
            />

            {(technicalBaseline !== null || psiScore !== null) && (
              <section className="rounded-xl border border-stroke bg-white p-5 shadow-sm dark:border-strokedark dark:bg-boxdark">
                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-body dark:text-bodydark">Live Technical Context</p>
                <div className="mt-3 flex items-center gap-3">
                  <Gauge className="h-5 w-5 text-black dark:text-[#E2E5E9]" />
                  <h3 className="text-base font-semibold text-black dark:text-[#E2E5E9]">Technical Health</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-body dark:text-bodydark">PageSpeed is loaded live and shown alongside the saved initial technical checklist score.</p>
                <div className="mt-4 flex flex-wrap gap-8 border-t border-stroke pt-4 dark:border-strokedark">
                  <div><p className="text-[11px] font-semibold text-black dark:text-[#E2E5E9]">Initial Technical Checklist</p><p className="mt-1 text-xl font-bold">{technicalBaseline === null ? '—' : `${technicalBaseline}%`}</p></div>
                  <div><p className="text-[11px] font-semibold text-black dark:text-[#E2E5E9]">Live PageSpeed</p><p className="mt-1 text-xl font-bold text-[#2B7FFF]">{psiScore === null ? '—' : `${psiScore}/100`}</p></div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-stroke bg-white p-4 shadow-sm dark:border-strokedark dark:bg-boxdark sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
          <div>
            <p className="text-sm font-semibold text-black dark:text-[#E2E5E9]">Ready to present the progress?</p>
            <p className="mt-1 text-xs text-body dark:text-bodydark">Export a client-ready comparison focused on measurable SEO value.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={exporting || !hasValidComparison}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#2B7FFF] px-4 text-sm font-semibold text-white transition hover:bg-[#1765D8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Download Comparison'}
        </button>
      </div>
    </div>
  )
}
