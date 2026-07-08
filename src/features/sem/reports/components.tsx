import { useEffect, useRef } from 'react'
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Download,
  Eye,
  ImagePlus,
  Layers3,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { XMSLogo } from '@/components/ui/XMSLogo'
import type {
  AdPerformanceCard,
  ChartBlockData,
  KpiMetric,
  Report,
  ReportTableData,
  Slide,
  SlideContent,
  TextBlock,
} from './types'
import { reportTheme } from './reportTheme'

const coverTrustLogos = {
  guaranteed: '/sem-reports/google-guaranteed-logo.png',
  partner: '/sem-reports/google-partner-logo.png',
  ads: '/sem-reports/google-ads-logo.webp',
}

const googleAdsKpiOrder = ['impressions', 'clicks', 'cost', 'avg-cpc']
const sevenRowTableSlides = new Set<Slide['type']>(['keywords', 'search_terms'])
const slideFrameClass = 'mx-auto aspect-[1164/655] w-full max-w-[1164px] overflow-hidden rounded-lg'
const googleAdsKpiStyles: Record<string, {
  card: string
  label: string
  value: string
  comparison: string
}> = {
  impressions: {
    card: 'bg-[#1a73e7] text-white',
    label: 'text-white/80',
    value: 'text-white',
    comparison: 'text-white/85',
  },
  clicks: {
    card: 'bg-[#d92f25] text-white',
    label: 'text-white/80',
    value: 'text-white',
    comparison: 'text-white/85',
  },
  cost: {
    card: 'bg-[#f9ab02] text-black',
    label: 'text-black/65',
    value: 'text-black',
    comparison: 'text-black/70',
  },
  'avg-cpc': {
    card: 'bg-[#1f8e3f] text-white',
    label: 'text-white/80',
    value: 'text-white',
    comparison: 'text-white/85',
  },
}

function compactKpiValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return value
  if (/k$/i.test(trimmed)) return trimmed

  const hasCurrency = trimmed.includes('$')
  const numeric = Number(trimmed.replace(/[$,\s]/g, ''))
  if (!Number.isFinite(numeric)) return value

  const abs = Math.abs(numeric)
  const formatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  })
  const compact = abs >= 1000 ? `${formatter.format(numeric / 1000)}K` : formatter.format(numeric)

  return hasCurrency ? `$${compact}` : compact
}

function trendMeta(trend?: KpiMetric['trend']) {
  if (trend === 'up') return { icon: ArrowUpRight, className: 'text-[#0057C2] bg-[#EAF6FF]' }
  if (trend === 'down') return { icon: ArrowDownRight, className: 'text-[#00AEEF] bg-[#E8F9FF]' }
  return { icon: ArrowRight, className: 'text-slate-500 bg-slate-100' }
}

function fieldClass(extra = '') {
  return `w-full rounded-md border border-[#D8E4F2] bg-white px-3 py-2 text-sm text-[#062A63] outline-none transition focus:border-[#0057C2] ${extra}`
}

function AutoResizeSlideTitle({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={1}
      className="block w-full resize-none overflow-hidden bg-transparent text-2xl font-bold leading-tight text-[#003B8F] outline-none placeholder:text-[#003B8F]/50 max-md:text-xl"
    />
  )
}

export function ReportActionsBar({
  report,
  dirty,
  onBack,
  onSave,
  onPreview,
  onExportPdf,
}: {
  report: Report
  dirty: boolean
  onBack: () => void
  onSave: () => void
  onPreview: () => void
  onExportPdf: () => void
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-stroke bg-white/95 px-5 py-3 backdrop-blur dark:border-strokedark dark:bg-boxdark/95">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-stroke bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 dark:border-strokedark dark:bg-boxdark dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Back to reports
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Monthly SEM Report</p>
            <h1 className="truncate text-lg font-bold text-black dark:text-[#E2E5E9]">
              {report.clientName} - {report.month} {report.year}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
              Unsaved changes
            </span>
          )}
          <button onClick={onSave} className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3 text-sm font-semibold text-white transition hover:bg-slate-900">
            <Save className="h-4 w-4" />
            Save
          </button>
          <button onClick={onPreview} className="inline-flex h-9 items-center gap-2 rounded-md border border-stroke bg-white px-3 text-sm font-semibold text-black transition hover:border-slate-400 hover:bg-slate-100 dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9] dark:hover:bg-slate-800">
            <Eye className="h-4 w-4" />
            Preview
          </button>
          <button onClick={onExportPdf} className="inline-flex h-9 items-center gap-2 rounded-md border border-stroke bg-white px-3 text-sm font-semibold text-black transition hover:border-slate-400 hover:bg-slate-100 dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9] dark:hover:bg-slate-800">
            <Download className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>
    </div>
  )
}

export function ReportSidebar({
  slides,
  activeSlideId,
  onSelect,
  onAddSlide,
  onMoveSlide,
}: {
  slides: Slide[]
  activeSlideId: string
  onSelect: (id: string) => void
  onAddSlide: () => void
  onMoveSlide: (id: string, direction: -1 | 1) => void
}) {
  const orderedSlides = slides.slice().sort((a, b) => a.order - b.order)

  return (
    <aside className="flex h-full flex-col border-r border-stroke bg-white dark:border-strokedark dark:bg-boxdark">
      <div className="border-b border-stroke px-4 py-4 dark:border-strokedark">
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-bold text-black dark:text-[#E2E5E9]">Slides</h2>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
        <ul className="space-y-1.5">
          {orderedSlides
            .map((slide, index) => {
              const active = activeSlideId === slide.id
              return (
                <li key={slide.id}>
                  <div
                    className={`group flex w-full items-stretch overflow-hidden rounded-md transition ${
                      active
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-[var(--sidebar-item-text)] hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <button
                      onClick={() => onSelect(slide.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5 text-left"
                    >
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {slide.order}
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate text-sm font-semibold ${active ? 'text-white' : 'text-black dark:text-[#E2E5E9]'}`}>
                          {slide.title}
                        </span>
                        <span className={`mt-0.5 block text-[11px] ${active ? 'text-white/75' : 'text-slate-500'}`}>
                          {slide.type.replace(/_/g, ' ')}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-col justify-center gap-1 pr-2">
                      <button
                        onClick={() => onMoveSlide(slide.id, -1)}
                        disabled={index === 0}
                        aria-label="Move slide up"
                        title="Move slide up"
                        className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                          active ? 'text-white/80 hover:bg-white/15 hover:text-white disabled:text-white/25' : 'text-slate-500 hover:bg-white hover:text-slate-900 disabled:text-slate-300'
                        } disabled:cursor-not-allowed`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onMoveSlide(slide.id, 1)}
                        disabled={index === orderedSlides.length - 1}
                        aria-label="Move slide down"
                        title="Move slide down"
                        className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                          active ? 'text-white/80 hover:bg-white/15 hover:text-white disabled:text-white/25' : 'text-slate-500 hover:bg-white hover:text-slate-900 disabled:text-slate-300'
                        } disabled:cursor-not-allowed`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
        </ul>
      </div>
      <div className="border-t border-stroke p-3 dark:border-strokedark">
        <button
          onClick={onAddSlide}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-800 px-3 text-sm font-bold text-white transition hover:bg-slate-900"
        >
          <Plus className="h-4 w-4" />
          Add slide
        </button>
      </div>
    </aside>
  )
}

export function KpiCard({
  metric,
  onChange,
}: {
  metric: KpiMetric
  onChange?: (patch: Partial<KpiMetric>) => void
}) {
  const meta = trendMeta(metric.trend)
  const TrendIcon = meta.icon
  return (
    <div className="rounded-lg border border-[#D8E4F2] bg-white p-4 shadow-[0_12px_30px_rgba(0,59,143,0.08)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <input
          value={metric.label}
          readOnly={!onChange}
          onChange={(event) => onChange?.({ label: event.target.value })}
          className="min-w-0 flex-1 bg-transparent text-xs font-bold uppercase tracking-[0.14em] text-slate-500 outline-none"
        />
        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.className}`}>
          <TrendIcon className="h-4 w-4" />
        </span>
      </div>
      <input
        value={metric.value}
        readOnly={!onChange}
        onChange={(event) => onChange?.({ value: event.target.value })}
        className="w-full bg-transparent text-2xl font-bold tabular-nums text-[#062A63] outline-none"
      />
      <input
        value={metric.comparison ?? ''}
        readOnly={!onChange}
        onChange={(event) => onChange?.({ comparison: event.target.value })}
        placeholder="Comparison"
        className="mt-1 w-full bg-transparent text-xs font-medium text-[#0057C2] outline-none"
      />
    </div>
  )
}

function GoogleAdsKpiCard({
  metric,
  onChange,
}: {
  metric: KpiMetric
  onChange: (patch: Partial<KpiMetric>) => void
}) {
  const style = googleAdsKpiStyles[metric.id] ?? googleAdsKpiStyles.impressions

  return (
    <div className={`min-h-[128px] p-4 shadow-[0_12px_30px_rgba(0,59,143,0.12)] ${style.card}`}>
      <input
        value={metric.label}
        onChange={(event) => onChange({ label: event.target.value })}
        className={`w-full bg-transparent text-xs font-bold uppercase tracking-[0.14em] outline-none ${style.label}`}
      />
      <input
        value={compactKpiValue(metric.value)}
        onChange={(event) => onChange({ value: event.target.value })}
        className={`mt-4 w-full bg-transparent text-4xl font-semibold tabular-nums outline-none ${style.value}`}
      />
      <input
        value={metric.comparison ?? ''}
        onChange={(event) => onChange({ comparison: event.target.value })}
        placeholder="Comparison"
        className={`mt-2 w-full bg-transparent text-xs font-semibold outline-none placeholder:opacity-70 ${style.comparison}`}
      />
    </div>
  )
}

function GoogleAdsSummaryBlock({
  block,
  onChange,
}: {
  block: TextBlock
  onChange: (value: string) => void
}) {
  return (
    <textarea
      value={block.value}
      onChange={(event) => onChange(event.target.value)}
      rows={3}
      className="w-full resize-none bg-transparent px-0 py-1 text-[13px] leading-6 text-[#062A63] outline-none"
    />
  )
}

export function EditableTextBlock({
  block,
  onChange,
  minRows = 4,
}: {
  block: TextBlock
  onChange: (value: string) => void
  minRows?: number
}) {
  return (
    <div className="rounded-lg border border-[#D8E4F2] bg-white p-3 shadow-[0_10px_24px_rgba(0,59,143,0.06)]">
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-[#0057C2]">
        {block.label}
      </label>
      <textarea
        value={block.value}
        onChange={(event) => onChange(event.target.value)}
        rows={minRows}
        className={fieldClass('resize-y leading-6')}
      />
    </div>
  )
}

export function ReportTable({
  table,
  onCellChange,
  maxRows,
}: {
  table: ReportTableData
  onCellChange: (rowIndex: number, key: string, value: string) => void
  maxRows?: number
}) {
  const visibleRows = typeof maxRows === 'number' ? table.rows.slice(0, maxRows) : table.rows

  return (
    <div className="overflow-hidden rounded-lg border border-[#D8E4F2] bg-white shadow-[0_10px_24px_rgba(0,59,143,0.06)]">
      <div className="border-b border-[#D8E4F2] px-3 py-2">
        <h3 className="text-sm font-semibold text-[#062A63]">{table.title}</h3>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="bg-[#EAF6FF] text-left text-[10px] font-bold uppercase tracking-[0.08em] text-[#003B8F]">
              {table.columns.map((column) => (
                <th key={column.key} className={`px-2 py-2 ${column.align === 'right' ? 'text-right' : ''}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8E4F2]">
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={table.columns.length} className="px-4 py-6 text-center text-sm font-medium text-slate-500">
                  {table.dataSource?.message ?? 'No rows available for this report table.'}
                </td>
              </tr>
            )}
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-[#F7FBFF]">
                {table.columns.map((column) => (
                  <td key={column.key} className="px-1.5 py-1 align-top">
                    <input
                      value={row[column.key] ?? ''}
                      onChange={(event) => onCellChange(rowIndex, column.key, event.target.value)}
                      className={`w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs text-[#062A63] outline-none transition focus:border-[#0057C2] focus:bg-white ${
                        column.align === 'right' ? 'text-right tabular-nums' : ''
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ChartBlock({ chart }: { chart: ChartBlockData }) {
  const max = Math.max(...chart.series.map((point) => point.value), 1)
  return (
    <div className="rounded-lg border border-[#D8E4F2] bg-white p-4 shadow-[0_10px_24px_rgba(0,59,143,0.06)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#062A63]">{chart.title}</h3>
          {chart.description && <p className="mt-0.5 text-xs text-slate-500">{chart.description}</p>}
        </div>
      </div>
      <div className="space-y-3">
        {chart.series.map((point) => (
          <div key={point.label} className="grid min-w-0 grid-cols-[minmax(52px,74px)_minmax(0,1fr)_minmax(52px,66px)] items-center gap-2">
            <span className="min-w-0 break-words text-xs font-semibold leading-tight text-slate-600">{point.label}</span>
            <div className="min-w-0 h-2.5 overflow-hidden rounded-full bg-[#EAF6FF]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#0057C2] to-[#00AEEF]" style={{ width: `${Math.max(4, (point.value / max) * 100)}%` }} />
            </div>
            <div className="min-w-0 text-right">
              <p className="text-xs font-bold tabular-nums text-[#062A63]">{point.displayValue}</p>
              {point.detail && <p className="break-words text-[10px] leading-tight text-slate-500">{point.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const source = typeof reader.result === 'string' ? reader.result : ''
      if (!source || file.type === 'image/svg+xml') {
        resolve(source)
        return
      }

      const image = new Image()
      image.onload = () => {
        const maxSide = 1400
        const scale = Math.min(1, maxSide / image.naturalWidth, maxSide / image.naturalHeight)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) {
          resolve(source)
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.86))
      }
      image.onerror = () => resolve(source)
      image.src = source
    }
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

function AdCard({
  ad,
  onChange,
}: {
  ad: AdPerformanceCard
  onChange: (patch: Partial<AdPerformanceCard>) => void
}) {
  const inputId = `ad-image-${ad.id}`

  const handleImageChange = (file?: File) => {
    if (!file) return
    readImageFile(file).then((imageSrc) => {
      if (imageSrc) onChange({ imageSrc })
    })
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#D8E4F2] bg-white shadow-[0_10px_24px_rgba(0,59,143,0.06)]">
      <div className="relative aspect-[4/3] bg-[#F7FBFF]">
        {ad.imageSrc ? (
          <img src={ad.imageSrc} alt={ad.headline || ad.type} className="h-full w-full object-contain" />
        ) : (
          <label htmlFor={inputId} className="flex h-full cursor-pointer flex-col items-center justify-center gap-3 px-6 text-center text-[#0057C2] transition hover:bg-[#EAF6FF]">
            <span className="flex h-12 w-12 items-center justify-center rounded-md border border-[#B9D8F4] bg-white">
              <ImagePlus className="h-6 w-6" />
            </span>
            <span className="text-sm font-bold">Add ad image</span>
          </label>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          onChange={(event) => handleImageChange(event.target.files?.[0])}
          className="sr-only"
        />
        {ad.imageSrc && (
          <div className="absolute right-3 top-3 flex gap-2">
            <label htmlFor={inputId} className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-xs font-bold text-[#0057C2] shadow">
              Replace
            </label>
            <button
              type="button"
              onClick={() => onChange({ imageSrc: '' })}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white text-slate-500 shadow transition hover:text-danger"
              aria-label="Remove ad image"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div className="border-t border-[#D8E4F2] p-4">
        <textarea
          value={ad.description}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={4}
          className="w-full resize-y bg-transparent text-sm leading-7 text-[#062A63] outline-none placeholder:text-slate-400"
          placeholder="Write ad notes here..."
        />
      </div>
    </div>
  )
}

export function ReportSlide({
  report,
  slide,
  onChange,
}: {
  report: Report
  slide: Slide
  onChange: (slide: Slide) => void
}) {
  const updateContent = (patch: Partial<SlideContent>) => {
    onChange({ ...slide, content: { ...slide.content, ...patch } })
  }

  const updateTextBlock = (key: 'textBlocks' | 'noteBlocks', id: string, value: string) => {
    const blocks = slide.content[key] ?? []
    updateContent({ [key]: blocks.map((block) => (block.id === id ? { ...block, value } : block)) })
  }

  const updateKpi = (id: string, patch: Partial<KpiMetric>) => {
    updateContent({
      kpis: (slide.content.kpis ?? []).map((metric) => (metric.id === id ? { ...metric, ...patch } : metric)),
    })
  }

  const updateTableCell = (tableId: string, rowIndex: number, key: string, value: string) => {
    updateContent({
      tables: (slide.content.tables ?? []).map((table) => {
        if (table.id !== tableId) return table
        return {
          ...table,
          rows: table.rows.map((row, index) => (index === rowIndex ? { ...row, [key]: value } : row)),
        }
      }),
    })
  }

  const updateAd = (id: string, patch: Partial<AdPerformanceCard>) => {
    updateContent({
      ads: (slide.content.ads ?? []).map((ad) => (ad.id === id ? { ...ad, ...patch } : ad)),
    })
  }

  const updateHighlight = (index: number, value: string) => {
    const next = [...(slide.content.highlights ?? [])]
    next[index] = value
    updateContent({ highlights: next })
  }

  const removeHighlight = (index: number) => {
    updateContent({ highlights: (slide.content.highlights ?? []).filter((_, itemIndex) => itemIndex !== index) })
  }

  const addHighlight = () => {
    updateContent({ highlights: [...(slide.content.highlights ?? []), 'New highlight'] })
  }

  const googleAdsKpis = googleAdsKpiOrder
    .map((id) => (slide.content.kpis ?? []).find((metric) => metric.id === id))
    .filter((metric): metric is KpiMetric => Boolean(metric))

  if (slide.type === 'cover') {
    return (
      <section
        className={`relative ${slideFrameClass} border border-[#0B67D1] text-white shadow-[0_24px_60px_rgba(0,59,143,0.25)]`}
        style={{
          background:
            `linear-gradient(135deg, ${reportTheme.darkBlue} 0%, ${reportTheme.primaryBlue} 48%, ${reportTheme.lightBlue} 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />

        <div className="relative z-10 grid h-full grid-cols-[minmax(0,1fr)_310px] max-lg:grid-cols-[minmax(0,1fr)_270px] max-md:grid-cols-1">
          <div className="flex min-w-0 flex-col justify-between p-10 max-md:p-7">
            <header className="flex items-start justify-between gap-6">
              <div className="flex min-w-0 items-center gap-3">
                {report.clientLogo ? (
                  <img src={report.clientLogo} alt={`${report.clientName} logo`} className="h-14 max-w-[180px] rounded-md bg-white object-contain p-2 shadow-lg" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-white/30 bg-white/15 text-lg font-black text-white shadow-lg backdrop-blur">
                    {report.clientName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">Prepared for</p>
                  <p className="mt-1 max-w-[360px] truncate text-lg font-semibold text-white">{report.clientName}</p>
                </div>
              </div>
            </header>

            <div className="max-w-3xl">
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.24em] text-[#BFEFFF]">Monthly SEM Performance Report</p>
              <div>
                <input
                  value={slide.content.reportTitle ?? ''}
                  onChange={(event) => updateContent({ reportTitle: event.target.value })}
                  className="w-full bg-transparent text-5xl font-bold leading-tight text-white outline-none placeholder:text-white/50 max-lg:text-5xl max-md:text-4xl"
                />
                <input
                  value={slide.content.subtitle ?? ''}
                  onChange={(event) => updateContent({ subtitle: event.target.value })}
                  className="mt-6 w-full bg-transparent text-4xl font-bold text-[#BFEFFF] outline-none placeholder:text-white/50 max-md:text-2xl"
                />
              </div>
            </div>

            <div className="h-12" />
          </div>

          <aside className="flex h-full flex-col bg-white px-4 py-10 text-[#062A63] shadow-[-18px_0_45px_rgba(0,36,90,0.16)] max-md:px-6 max-md:py-7">
            <div className="flex justify-center">
              <XMSLogo mode="light" height={76} className="max-w-[260px]" />
            </div>
            <div className="mt-auto space-y-6 max-md:mt-8">
              <div className="flex justify-center">
                <img src={coverTrustLogos.guaranteed} alt="Google Guaranteed" className="h-30 w-full max-w-[192px] object-contain" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="flex justify-center">
                  <img src={coverTrustLogos.partner} alt="Google Partner" className="h-30 w-full max-w-[128px] object-contain" />
                </div>
                <div className="flex justify-center">
                  <img src={coverTrustLogos.ads} alt="Google Ads" className="h-30 w-full max-w-[128px] object-contain" />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    )
  }

  if (slide.type === 'thank_you') {
    return (
      <section
        className={`relative flex ${slideFrameClass} items-center justify-center border border-[#0B67D1] p-10 text-center text-white shadow-[0_24px_60px_rgba(0,59,143,0.22)]`}
        style={{
          background:
            `linear-gradient(135deg, ${reportTheme.darkBlue} 0%, ${reportTheme.primaryBlue} 58%, ${reportTheme.lightBlue} 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="absolute right-8 top-8 rounded-md bg-white/10 px-4 py-3 backdrop-blur">
          <XMSLogo mode="dark" height={34} />
        </div>
        <textarea
          value={slide.content.finalMessage ?? ''}
          onChange={(event) => updateContent({ finalMessage: event.target.value })}
          rows={4}
          className="relative z-10 w-full max-w-3xl resize-none bg-transparent text-center text-4xl font-bold leading-tight text-white outline-none placeholder:text-white/50 max-md:text-3xl"
        />
      </section>
    )
  }

  if (slide.type === 'google_ads_kpis') {
    return (
      <section className={`flex ${slideFrameClass} flex-col border border-[#D8E4F2] bg-white shadow-[0_20px_45px_rgba(0,59,143,0.12)]`}>
        <div className="h-3 shrink-0 bg-gradient-to-r from-[#003B8F] via-[#0057C2] to-[#00AEEF]" />
        <div className="flex min-h-0 flex-1 flex-col p-5">
          <div className="mb-5 border-b border-[#D8E4F2] pb-4">
            <div className="min-w-0">
              <AutoResizeSlideTitle
                value={slide.title}
                onChange={(title) => onChange({ ...slide, title })}
              />
            </div>
          </div>

          <div className="flex flex-1 flex-col">
            <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 xl:grid-cols-4">
              {googleAdsKpis.map((metric) => (
                <GoogleAdsKpiCard key={metric.id} metric={metric} onChange={(patch) => updateKpi(metric.id, patch)} />
              ))}
            </div>

            <div className="mt-8 flex flex-1 items-end border-t border-[#D8E4F2] pt-5">
              <div className="w-full">
                {slide.content.textBlocks?.map((block) => (
                  <GoogleAdsSummaryBlock key={block.id} block={block} onChange={(value) => updateTextBlock('textBlocks', block.id, value)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={`flex ${slideFrameClass} flex-col border border-[#D8E4F2] bg-white shadow-[0_20px_45px_rgba(0,59,143,0.12)]`}>
      <div className="h-3 shrink-0 bg-gradient-to-r from-[#003B8F] via-[#0057C2] to-[#00AEEF]" />
      <div className="min-h-0 flex-1 p-5">
      <div className="mb-4 border-b border-[#D8E4F2] pb-3">
        <div className="min-w-0">
          <AutoResizeSlideTitle
            value={slide.title}
            onChange={(title) => onChange({ ...slide, title })}
          />
        </div>
      </div>

      <div className="space-y-4">
        {slide.content.kpis?.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {slide.content.kpis.map((metric) => (
              <KpiCard key={metric.id} metric={metric} onChange={(patch) => updateKpi(metric.id, patch)} />
            ))}
          </div>
        ) : null}

        {slide.content.ads?.length ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {slide.content.ads.slice(0, 2).map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                onChange={(patch) => updateAd(ad.id, patch)}
              />
            ))}
          </div>
        ) : null}

        {slide.content.tables?.map((table) => (
          <ReportTable
            key={table.id}
            table={table}
            maxRows={sevenRowTableSlides.has(slide.type) ? 7 : undefined}
            onCellChange={(rowIndex, key, value) => updateTableCell(table.id, rowIndex, key, value)}
          />
        ))}

        {slide.content.charts?.length ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {slide.content.charts.map((chart) => (
              <ChartBlock key={chart.id} chart={chart} />
            ))}
          </div>
        ) : null}

        {slide.content.highlights?.length ? (
          <div className="rounded-lg border border-[#D8E4F2] bg-white p-4 shadow-[0_10px_24px_rgba(0,59,143,0.06)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-[#062A63]">Monthly Highlights</h3>
              <button onClick={addHighlight} className="inline-flex h-8 items-center gap-2 rounded-md border border-[#D8E4F2] px-2.5 text-xs font-semibold text-[#0057C2] hover:bg-[#EAF6FF]">
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            <div className="space-y-2">
              {slide.content.highlights.map((highlight, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    value={highlight}
                    onChange={(event) => updateHighlight(index, event.target.value)}
                    className={fieldClass()}
                  />
                  <button
                    onClick={() => removeHighlight(index)}
                    aria-label="Remove highlight"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#D8E4F2] text-slate-500 transition hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {slide.type !== 'ads' && slide.content.textBlocks?.map((block) => (
          slide.type === 'keywords' || slide.type === 'ads' || slide.type === 'search_terms' ? (
            <GoogleAdsSummaryBlock key={block.id} block={block} onChange={(value) => updateTextBlock('textBlocks', block.id, value)} />
          ) : (
            <EditableTextBlock key={block.id} block={block} onChange={(value) => updateTextBlock('textBlocks', block.id, value)} />
          )
        ))}

        {slide.content.noteBlocks?.map((block) => (
          <EditableTextBlock key={block.id} block={block} minRows={3} onChange={(value) => updateTextBlock('noteBlocks', block.id, value)} />
        ))}
      </div>
      </div>
    </section>
  )
}
