import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FindingRow {
  id: string
  client: string
  analysis_date: string | null
  seo_category: string | null
  audit_item: string | null
  initial_status: string | null
  priority: string | null
  notes: string | null
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

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPARE_WITH = ['Current Date', 'Last Month', 'Last Quarter', 'Last Year']
const SEO_AREAS    = ['All Categories', 'Technical SEO', 'Content', 'Local SEO', 'Listings', 'Reviews']
const OWNERS       = ['All Owners', 'Steven', 'Geraldine', 'Maria', 'John', 'Alex']

const CARD_CATEGORIES = [
  { key: 'Technical SEO',  label: 'Technical SEO'        },
  { key: 'Content',        label: 'Content Optimization' },
  { key: 'Local SEO',      label: 'Local SEO'            },
  { key: 'Listings',       label: 'Listings'             },
  { key: 'Reviews',        label: 'Reviews'              },
]

// ─── Score calculation from findings ─────────────────────────────────────────

function categoryScore(findings: FindingRow[], category: string): number {
  const rows = findings.filter(r => r.seo_category === category)
  if (rows.length === 0) return 0
  const yes = rows.filter(r => r.initial_status === 'Yes').length
  return Math.round((yes / rows.length) * 100)
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

type StatusType = 'Improved' | 'Completed' | 'Declined' | 'No Change' | 'Pending'

function StatusBadge({ status }: { status: StatusType }) {
  const cls: Record<StatusType, string> = {
    Improved:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    Completed:   'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    Declined:    'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    'No Change': 'bg-gray-100 text-gray-500 dark:bg-gray-500/15 dark:text-gray-400',
    Pending:     'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  }
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-medium ${cls[status]}`}>
      {status}
    </span>
  )
}

// ─── Derive comparison status from initial → current ─────────────────────────

function deriveStatus(initial: string, current: string): StatusType {
  if (current === '—' || current === '') return 'Pending'
  const iNum = parseFloat(initial)
  const cNum = parseFloat(current)
  if (!isNaN(iNum) && !isNaN(cNum)) {
    if (cNum > iNum) return 'Improved'
    if (cNum < iNum) return 'Declined'
    return 'No Change'
  }
  if (initial === 'Incomplete' && (current === 'Complete' || current === 'Yes')) return 'Completed'
  if (initial !== current && current !== '—') return 'Improved'
  return 'No Change'
}

function deriveChange(initial: string, current: string): { text: string; type: 'positive' | 'negative' | 'resolved' | 'neutral' } {
  if (current === '—' || current === '') return { text: '—', type: 'neutral' }
  const iNum = parseFloat(initial)
  const cNum = parseFloat(current)
  if (!isNaN(iNum) && !isNaN(cNum)) {
    const diff = cNum - iNum
    return { text: diff > 0 ? `+${diff}` : String(diff), type: diff >= 0 ? 'positive' : 'negative' }
  }
  if (initial === 'Incomplete' && current !== 'Incomplete') return { text: 'Resolved', type: 'resolved' }
  if (initial !== current) return { text: 'Updated', type: 'positive' }
  return { text: '—', type: 'neutral' }
}

// ─── Filter select ────────────────────────────────────────────────────────────

const FILTER_CLS =
  'w-full appearance-none rounded-lg border border-stroke bg-white ' +
  'pl-3 py-2 pr-8 text-sm text-black outline-none ' +
  'transition focus:border-[#1A72D9] focus:ring-1 focus:ring-[#1A72D9]/30 ' +
  'dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9] ' +
  'dark:focus:border-[#1A72D9]'

function FilterSelect({
  label, value, onChange, options, wide,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: string[]; wide?: boolean
}) {
  return (
    <div className={`flex flex-col gap-1 ${wide ? 'min-w-[200px]' : 'min-w-[140px]'}`}>
      <span className="text-xs font-semibold text-black dark:text-[#E2E5E9]">{label}</span>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)} className={FILTER_CLS}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
          <svg className="h-3.5 w-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ComparativeProps {
  selectedGscSite?: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Comparative({ selectedGscSite }: ComparativeProps) {
  const [baselines,        setBaselines]        = useState<Baseline[]>([])
  const [selectedBaseline, setSelectedBaseline] = useState('')
  const [compareWith,      setCompareWith]      = useState(COMPARE_WITH[0])
  const [seoAreaFilter,    setSeoAreaFilter]    = useState(SEO_AREAS[0])
  const [ownerFilter,      setOwnerFilter]      = useState(OWNERS[0])

  const [findings,        setFindings]        = useState<FindingRow[]>([])
  const [psiScore,        setPsiScore]        = useState<number | null>(null)
  const [loadingData,     setLoadingData]     = useState(false)
  const [loadingPsi,      setLoadingPsi]      = useState(false)
  const [hasRealData,     setHasRealData]     = useState(false)
  const [ahrefsSnapshots, setAhrefsSnapshots] = useState<AhrefsSnapshotRow[]>([])
  const [loadingAhrefs,   setLoadingAhrefs]   = useState(false)
  const [refreshKey,      setRefreshKey]      = useState(0)
  const [exporting,       setExporting]       = useState(false)

  const reportRef = useRef<HTMLDivElement>(null)

  // ── Load baselines on mount ───────────────────────────────────────────────
  useEffect(() => {
    async function loadBaselines() {
      const { data } = await supabase
        .from('seo_initial_findings')
        .select('client, analysis_date, created_at')
        .eq('is_draft', false)
        .order('created_at', { ascending: false })

      if (!data || data.length === 0) return

      setHasRealData(true)
      const seen = new Set<string>()
      const unique: Baseline[] = []
      data.forEach((row: { client: string; analysis_date: string | null; created_at: string }) => {
        const date = row.analysis_date ?? row.created_at.slice(0, 10)
        const key  = `${row.client}|${date}`
        if (!seen.has(key)) {
          seen.add(key)
          const d = new Date(date)
          const month = d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
          unique.push({ label: `${row.client} — ${month}`, client: row.client, date })
        }
      })
      setBaselines(unique)
      if (unique.length > 0) setSelectedBaseline(unique[0].label)
    }
    loadBaselines()
  }, [])

  // ── Load findings + Ahrefs snapshots when baseline changes ──────────────
  useEffect(() => {
    if (!selectedBaseline) return
    const bl = baselines.find(b => b.label === selectedBaseline)
    if (!bl) return

    async function loadFindings() {
      setLoadingData(true)
      const query = supabase
        .from('seo_initial_findings')
        .select('*')
        .eq('is_draft', false)
        .eq('client', bl!.client)
        .order('seo_category')

      if (bl!.date) query.eq('analysis_date', bl!.date)

      const { data } = await query
      if (data) setFindings(data as FindingRow[])
      setLoadingData(false)
    }

    async function loadAhrefsSnapshots() {
      setLoadingAhrefs(true)
      const { data } = await supabase
        .from('seo_ahrefs_snapshots')
        .select('*')
        .eq('client', bl!.client)
        .order('snapshot_date', { ascending: true })
      if (data) setAhrefsSnapshots(data as AhrefsSnapshotRow[])
      setLoadingAhrefs(false)
    }

    loadFindings()
    loadAhrefsSnapshots()
  }, [selectedBaseline, baselines, refreshKey])

  // ── Fetch PSI score when GSC site is available ────────────────────────────
  useEffect(() => {
    if (!selectedGscSite) return
    const rawUrl = selectedGscSite.startsWith('sc-domain:')
      ? `https://${selectedGscSite.replace('sc-domain:', '')}`
      : selectedGscSite

    setLoadingPsi(true)
    fetch(`/api/seo/pagespeed?url=${encodeURIComponent(rawUrl)}`)
      .then(r => r.json())
      .then(d => { if (typeof d.score === 'number') setPsiScore(d.score) })
      .catch(() => {})
      .finally(() => setLoadingPsi(false))
  }, [selectedGscSite, refreshKey])

  // ── Export the comparison report as a multi-page A4 PDF ───────────────────
  async function handleDownloadPdf() {
    if (!reportRef.current || exporting) return
    setExporting(true)
    try {
      const [h2cMod, jspdfMod] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2canvas = (h2cMod as any).default ?? h2cMod
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { jsPDF }   = jspdfMod as any

      const canvas = await html2canvas(reportRef.current, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
      })

      const PAD  = 10 // mm
      const pdf  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const cW   = pdf.internal.pageSize.getWidth()  - PAD * 2
      const cH   = pdf.internal.pageSize.getHeight() - PAD * 2
      const imgH = (canvas.height / canvas.width) * cW   // full image height in mm
      const pxPerMm = canvas.height / imgH

      let yMm = 0
      let firstPage = true
      while (yMm < imgH - 0.5) {
        const sliceMm = Math.min(cH, imgH - yMm)
        const slice   = document.createElement('canvas')
        slice.width   = canvas.width
        slice.height  = Math.max(1, Math.round(sliceMm * pxPerMm))
        const ctx     = slice.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, slice.width, slice.height)
        ctx.drawImage(canvas, 0, Math.round(yMm * pxPerMm), canvas.width, slice.height, 0, 0, slice.width, slice.height)

        if (!firstPage) pdf.addPage()
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', PAD, PAD, cW, sliceMm)
        firstPage = false
        yMm += sliceMm
      }

      const bl = baselines.find(b => b.label === selectedBaseline)
      pdf.save(`seo-comparison-${bl?.client ?? 'report'}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  const comparing = loadingData || loadingAhrefs || loadingPsi

  // ── Score cards ───────────────────────────────────────────────────────────
  const scoreCards = CARD_CATEGORIES.map(cat => {
    const initial = hasRealData ? categoryScore(findings, cat.key) : [62, 35, 48, 40, 70][CARD_CATEGORIES.indexOf(cat)]
    const current   = hasRealData
      ? (cat.key === 'Technical SEO' && psiScore !== null ? psiScore : initial)
      : [84, 68, 76, 72, 82][CARD_CATEGORIES.indexOf(cat)]
    const delta   = current - initial
    return { ...cat, initial, current, delta }
  })

  // ── Filtered table rows ───────────────────────────────────────────────────
  const tableRows = (hasRealData ? findings : FALLBACK_ROWS).filter(r => {
    const area = hasRealData ? (r as FindingRow).seo_category : (r as typeof FALLBACK_ROWS[0]).area
    if (seoAreaFilter !== 'All Categories' && area !== seoAreaFilter) return false
    return true
  })

  // ── Baseline options (merge real + fallback) ──────────────────────────────
  const baselineOptions = hasRealData
    ? baselines.map(b => b.label)
    : ['Initial Analysis — May 2025']

  return (
    <div className="space-y-6">

      {/* ══ CONTROLS CARD ══════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark px-6 py-6">
        <h3 className="text-lg font-bold text-black dark:text-[#E2E5E9]">Compare SEO Progress</h3>
        <p className="mt-0.5 mb-5 text-sm text-body dark:text-bodydark">
          Compare the client's initial SEO baseline against current or historical results.
        </p>

        <div className="flex flex-wrap gap-4 mb-5">
          <FilterSelect
            label="Baseline"
            value={selectedBaseline || (baselineOptions[0] ?? '')}
            onChange={setSelectedBaseline}
            options={baselineOptions}
            wide
          />
          <FilterSelect label="Compare With"      value={compareWith}   onChange={setCompareWith}   options={COMPARE_WITH} />
          <FilterSelect label="SEO Area"          value={seoAreaFilter} onChange={setSeoAreaFilter} options={SEO_AREAS}    />
          <FilterSelect label="Responsible Owner" value={ownerFilter}   onChange={setOwnerFilter}   options={OWNERS}       />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg border border-stroke px-4 py-2.5
                       text-sm font-medium text-black transition disabled:opacity-50
                       hover:border-[#1A72D9] hover:text-[#1A72D9]
                       dark:border-strokedark dark:text-[#E2E5E9]
                       dark:hover:border-[#1A72D9] dark:hover:text-[#1A72D9]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5
                       a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625
                       c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75
                       c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            {exporting ? 'Exporting…' : 'Download PDF'}
          </button>
          <button
            type="button"
            onClick={() => setRefreshKey(k => k + 1)}
            disabled={comparing}
            className="rounded-lg bg-[#1A72D9] px-5 py-2.5 text-sm font-semibold
                       text-white transition disabled:opacity-60
                       hover:bg-[#0F4FA8] active:scale-[0.98]"
          >
            {comparing ? 'Comparing…' : 'Generate Comparison'}
          </button>

          {/* PSI live indicator */}
          {selectedGscSite && (
            <span className={`ml-auto flex items-center gap-1.5 text-xs ${loadingPsi ? 'text-body dark:text-bodydark' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {loadingPsi
                ? <><svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Loading PageSpeed…</>
                : psiScore !== null
                  ? <><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live PageSpeed: {psiScore}/100</>
                  : null
              }
            </span>
          )}
        </div>
      </div>

      {/* ══ EXPORTABLE REPORT (captured by Download PDF) ═══════════════════ */}
      <div ref={reportRef} className="space-y-6">

      {/* ══ SCORE CARDS ════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {scoreCards.map((card) => (
          <div key={card.key}
               className="rounded-xl border border-stroke bg-white shadow-default
                          dark:border-strokedark dark:bg-boxdark px-4 py-5">
            <p className="mb-3 text-xs font-medium text-body dark:text-bodydark leading-snug">
              {card.label}
            </p>
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span className="text-xl font-bold text-black dark:text-[#E2E5E9] tabular-nums">
                {card.initial}%
              </span>
              <svg className="h-4 w-4 shrink-0 text-body dark:text-bodydark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              <span className={`text-xl font-bold tabular-nums ${
                card.key === 'Technical SEO' && loadingPsi
                  ? 'text-body dark:text-bodydark'
                  : 'text-black dark:text-[#E2E5E9]'
              }`}>
                {card.key === 'Technical SEO' && loadingPsi ? '…' : `${card.current}%`}
              </span>
            </div>
            {card.delta !== 0 && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold
                ${card.delta > 0
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                  : 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                }`}>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d={card.delta > 0
                          ? "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941"
                          : "M2.25 6L9 12.75l4.306-4.307a11.95 11.95 0 015.814 5.519l2.74 1.22m0 0l-5.94 2.281m5.94-2.28l-2.28-5.941"
                        } />
                </svg>
                {card.delta > 0 ? '+' : ''}{card.delta}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ══ AHREFS METRICS HISTORY ══════════════════════════════════════════ */}
      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6 py-5 dark:border-strokedark flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-black dark:text-[#E2E5E9]">Ahrefs Authority Metrics</h3>
            <p className="mt-0.5 text-sm text-body dark:text-bodydark">First snapshot vs latest — domain authority progress</p>
          </div>
          {ahrefsSnapshots.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {ahrefsSnapshots.length} snapshot{ahrefsSnapshots.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loadingAhrefs ? (
          <div className="px-6 py-10 text-center text-sm text-body dark:text-bodydark">Loading…</div>
        ) : ahrefsSnapshots.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-body dark:text-bodydark">No Ahrefs snapshots yet for this client.</p>
            <p className="mt-1 text-xs text-body dark:text-bodydark opacity-60">
              Go to Initial Status → Ahrefs Domain Snapshot to save the first baseline.
            </p>
          </div>
        ) : (() => {
          const first  = ahrefsSnapshots[0]
          const latest = ahrefsSnapshots[ahrefsSnapshots.length - 1]
          const isSame = first.id === latest.id

          const metrics: { label: string; key: keyof AhrefsSnapshotRow; color: string; lowerIsBetter?: boolean }[] = [
            { label: 'Domain Rating',    key: 'domain_rating',    color: 'text-orange-500' },
            { label: 'Ahrefs Rank',      key: 'ahrefs_rank',      color: 'text-[#1A72D9]', lowerIsBetter: true },
            { label: 'Organic Traffic',  key: 'organic_traffic',  color: 'text-emerald-500' },
            { label: 'Organic Keywords', key: 'organic_keywords', color: 'text-emerald-500' },
            { label: 'Backlinks',        key: 'backlinks',        color: 'text-purple-500' },
            { label: 'Ref. Domains',     key: 'referring_domains', color: 'text-purple-500' },
          ]

          return (
            <div className="px-6 py-5 space-y-5">
              <div className="flex flex-wrap items-center gap-4 text-xs text-body dark:text-bodydark">
                <span><span className="font-semibold text-black dark:text-[#E2E5E9]">Baseline:</span> {first.domain} · {first.snapshot_date}</span>
                {!isSame && <span><span className="font-semibold text-black dark:text-[#E2E5E9]">Latest:</span> {latest.snapshot_date}</span>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {metrics.map(m => {
                  const v0 = first[m.key] as number | null
                  const v1 = latest[m.key] as number | null
                  const delta = v0 !== null && v1 !== null ? v1 - v0 : null
                  const positive = delta !== null
                    ? (m.lowerIsBetter ? delta < 0 : delta > 0)
                    : null

                  return (
                    <div key={m.label}
                         className="rounded-lg border border-stroke bg-gray-50/50 px-3 py-3
                                    dark:border-strokedark dark:bg-black/10 text-center">
                      <p className="text-[10px] font-medium text-body dark:text-bodydark mb-1.5 leading-tight">{m.label}</p>
                      {isSame ? (
                        <p className={`text-base font-bold tabular-nums ${m.color}`}>
                          {v0 !== null ? Number(v0).toLocaleString() : '—'}
                        </p>
                      ) : (
                        <>
                          <div className="flex items-center justify-center gap-1.5 mb-1">
                            <span className="text-xs text-body dark:text-bodydark tabular-nums">
                              {v0 !== null ? Number(v0).toLocaleString() : '—'}
                            </span>
                            <svg className="h-3 w-3 text-body dark:text-bodydark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                            <span className={`text-base font-bold tabular-nums ${m.color}`}>
                              {v1 !== null ? Number(v1).toLocaleString() : '—'}
                            </span>
                          </div>
                          {delta !== null && (
                            <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold
                              ${positive
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                                : positive === false
                                  ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-500/15 dark:text-gray-400'
                              }`}>
                              {delta > 0 ? '+' : ''}{Number(delta).toLocaleString()}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {ahrefsSnapshots.length > 2 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-sm">
                    <thead>
                      <tr className="border-b border-stroke dark:border-strokedark">
                        {['Date', 'DR', 'Rank', 'Traffic', 'Keywords', 'Backlinks', 'Ref. Domains'].map(col => (
                          <th key={col} className="pb-3 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-body dark:text-bodydark whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stroke dark:divide-strokedark">
                      {ahrefsSnapshots.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                          <td className="py-2.5 pr-4 text-xs text-body dark:text-bodydark whitespace-nowrap">{s.snapshot_date}</td>
                          <td className="py-2.5 pr-4 font-bold text-orange-500 tabular-nums">{s.domain_rating ?? '—'}</td>
                          <td className="py-2.5 pr-4 text-body dark:text-bodydark tabular-nums">{s.ahrefs_rank?.toLocaleString() ?? '—'}</td>
                          <td className="py-2.5 pr-4 text-emerald-600 dark:text-emerald-400 tabular-nums">{s.organic_traffic?.toLocaleString() ?? '—'}</td>
                          <td className="py-2.5 pr-4 text-emerald-600 dark:text-emerald-400 tabular-nums">{s.organic_keywords?.toLocaleString() ?? '—'}</td>
                          <td className="py-2.5 pr-4 text-purple-500 tabular-nums">{s.backlinks?.toLocaleString() ?? '—'}</td>
                          <td className="py-2.5 pr-4 text-purple-500 tabular-nums">{s.referring_domains?.toLocaleString() ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* ══ FINDINGS TABLE ═════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6 py-5 dark:border-strokedark flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-lg font-bold text-black dark:text-[#E2E5E9]">Initial vs Current Findings</h3>
          {hasRealData && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live data from Supabase
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-stroke bg-gray-50/50 dark:border-strokedark dark:bg-black/10">
                {['SEO Area', 'Metric / Finding', 'Initial', 'Current', 'Change', 'Status'].map(col => (
                  <th key={col}
                      className="px-5 py-3 text-left text-[11px] font-semibold
                                 uppercase tracking-wider text-body dark:text-bodydark whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke dark:divide-strokedark">
              {loadingData && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-sm text-body dark:text-bodydark">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Loading findings…
                    </div>
                  </td>
                </tr>
              )}

              {!loadingData && hasRealData && (tableRows as FindingRow[]).map(row => {
                const currentVal = row.seo_category === 'Technical SEO' && psiScore !== null
                  ? String(psiScore)
                  : '—'
                const change = deriveChange(row.initial_status ?? '', currentVal)
                const status = deriveStatus(row.initial_status ?? '', currentVal)
                return (
                  <tr key={row.id}
                      className="transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                    <td className="px-5 py-4 text-sm font-bold text-black dark:text-[#E2E5E9] whitespace-nowrap">
                      {row.seo_category ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-body dark:text-bodydark">
                      {row.audit_item ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-body dark:text-bodydark">
                      {row.initial_status ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-black dark:text-[#E2E5E9]">
                      {currentVal}
                    </td>
                    <td className="px-5 py-4">
                      <ChangeText value={change.text} type={change.type} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={status} />
                    </td>
                  </tr>
                )
              })}

              {!loadingData && !hasRealData && (tableRows as typeof FALLBACK_ROWS).map(row => {
                const change = deriveChange(row.initial, row.current)
                const status = deriveStatus(row.initial, row.current)
                return (
                  <tr key={row.id}
                      className="transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                    <td className="px-5 py-4 text-sm font-bold text-black dark:text-[#E2E5E9] whitespace-nowrap">
                      {row.area}
                    </td>
                    <td className="px-5 py-4 text-sm text-body dark:text-bodydark">{row.metric}</td>
                    <td className="px-5 py-4 text-sm text-body dark:text-bodydark">{row.initial}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-black dark:text-[#E2E5E9]">{row.current}</td>
                    <td className="px-5 py-4"><ChangeText value={change.text} type={change.type} /></td>
                    <td className="px-5 py-4"><StatusBadge status={status} /></td>
                  </tr>
                )
              })}

              {!loadingData && hasRealData && findings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-sm text-body dark:text-bodydark">
                      No findings found for the selected baseline.
                    </p>
                    <p className="mt-1 text-xs text-body dark:text-bodydark opacity-60">
                      Go to the Initial Status tab and save your first finding.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      </div>{/* end exportable report */}

    </div>
  )
}

// ─── Change text cell ─────────────────────────────────────────────────────────

function ChangeText({ value, type }: { value: string; type: 'positive' | 'negative' | 'resolved' | 'neutral' }) {
  const cls = {
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-red-600 dark:text-red-400',
    resolved: 'text-blue-600 dark:text-blue-400',
    neutral:  'text-body dark:text-bodydark',
  }[type]
  return <span className={`text-sm font-medium ${cls}`}>{value}</span>
}

// ─── Fallback sample rows (shown when no Supabase data) ───────────────────────

const FALLBACK_ROWS = [
  { id: 1, area: 'Technical SEO', metric: 'PageSpeed Mobile',  initial: '58',       current: '74',      },
  { id: 2, area: 'Local SEO',     metric: 'Google Maps Ranking', initial: '#17',    current: '#8',      },
  { id: 3, area: 'GBP',           metric: 'Verification Status', initial: 'Incomplete', current: 'Complete' },
  { id: 4, area: 'Listings',      metric: 'NAP Consistency',   initial: 'Partial',  current: 'Improved' },
  { id: 5, area: 'Reviews',       metric: 'Google Reviews',    initial: '132',      current: '156'      },
]
