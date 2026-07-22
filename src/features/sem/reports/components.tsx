import { useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Bold,
  Clock3,
  Download,
  Eye,
  ImagePlus,
  Italic,
  Layers3,
  Monitor,
  MoreVertical,
  Plus,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Tv,
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
  if (chart.deviceData) return <DevicePerformanceChart chart={chart} />
  if (chart.heatmapData) return <DayHourHeatmap chart={chart} />

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

const deviceVisuals = [
  { key: 'MOBILE', color: '#4285F4', Icon: Smartphone },
  { key: 'TABLET', color: '#EA4335', Icon: Tablet },
  { key: 'DESKTOP', color: '#F9AB00', Icon: Monitor },
  { key: 'CONNECTED_TV', color: '#34A853', Icon: Tv },
]

function DevicePerformanceChart({ chart }: { chart: ChartBlockData }) {
  const devices = chart.deviceData ?? []
  const metrics = [
    { key: 'cost' as const, label: 'Cost' },
    { key: 'clicks' as const, label: 'Clicks' },
    { key: 'conversions' as const, label: 'Conversions' },
  ]

  return (
    <div className="overflow-hidden rounded-lg border border-slate-400 bg-white shadow-[0_10px_24px_rgba(0,59,143,0.06)]">
      <div className="flex h-10 items-center gap-2 border-b border-[#D8E4F2] px-3 text-slate-600">
        <Monitor className="h-4 w-4" />
        <span className="text-xs font-semibold">Devices</span>
        <MoreVertical className="ml-auto h-4 w-4" />
      </div>
      <div className="p-3">
        <h3 className="text-xs font-semibold text-slate-700">Ad performance across devices</h3>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {deviceVisuals.map(({ key, color, Icon }) => {
            const device = devices.find((item) => item.key === key)
            return (
              <div key={key} className="flex min-h-5 min-w-0 items-center gap-1.5 text-[10px] leading-4 text-slate-500">
                <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                <span className="whitespace-nowrap">{device?.label ?? key}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-4 space-y-3">
          {metrics.map((metric) => {
            const total = devices.reduce((sum, device) => sum + device[metric.key], 0)
            return (
              <div key={metric.key}>
                <div className="flex items-center gap-2">
                  <div className="flex h-5 min-w-0 flex-1 overflow-hidden bg-slate-100">
                    {deviceVisuals.map(({ key, color }) => {
                      const value = devices.find((item) => item.key === key)?.[metric.key] ?? 0
                      const share = total > 0 ? (value / total) * 100 : 0
                      return <div key={key} style={{ width: `${share}%`, backgroundColor: color }} />
                    })}
                  </div>
                  <span className="w-[72px] shrink-0 text-[10px] font-medium leading-4 text-slate-600">{metric.label}</span>
                </div>
                <div className="mt-1 grid grid-cols-4 gap-2">
                  {deviceVisuals.map(({ key, color }) => {
                    const value = devices.find((item) => item.key === key)?.[metric.key] ?? 0
                    const share = total > 0 ? (value / total) * 100 : 0
                    return (
                      <span key={key} className="flex items-center gap-1 text-[9px] leading-4 tabular-nums text-slate-500">
                        <i className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: color }} />
                        {share.toFixed(1)}%
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DayHourHeatmap({ chart }: { chart: ChartBlockData }) {
  const heatmap = chart.heatmapData!
  const max = Math.max(...heatmap.values.flat(), 0)
  const dayInitials: Record<string, string> = {
    SUNDAY: 'S', MONDAY: 'M', TUESDAY: 'T', WEDNESDAY: 'W', THURSDAY: 'T', FRIDAY: 'F', SATURDAY: 'S',
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-400 bg-white shadow-[0_10px_24px_rgba(0,59,143,0.06)]">
      <div className="flex h-10 items-center gap-2 border-b border-[#D8E4F2] px-3 text-slate-600">
        <Clock3 className="h-4 w-4" />
        <span className="text-xs font-semibold">Day &amp; hour</span>
        <span className="ml-auto text-[10px]">Impressions</span>
        <MoreVertical className="h-4 w-4" />
      </div>
      <div className="p-3">
        <h3 className="text-xs font-semibold text-slate-700">Your performance by day of week and time of day</h3>
        <div className="mx-auto mt-4 grid max-w-[300px] grid-cols-3 border-b border-[#D8E4F2] text-center text-[10px] font-medium text-slate-500">
          <span className="pb-2">Day</span>
          <span className="border-b-2 border-[#4285F4] pb-2 font-semibold text-[#4285F4]">Day &amp; Hour</span>
          <span className="pb-2">Hour</span>
        </div>
        <div className="mt-3 overflow-hidden">
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: '14px repeat(24, minmax(0, 1fr))' }}>
            {heatmap.days.flatMap((day, dayIndex) => [
              <span key={`${day}-label`} className="flex h-3 items-center text-[9px] leading-3 text-slate-500">{dayInitials[day] ?? day.slice(0, 1)}</span>,
              ...heatmap.hours.map((hour, hourIndex) => {
                const value = heatmap.values[dayIndex]?.[hourIndex] ?? 0
                const intensity = max > 0 ? value / max : 0
                return (
                  <span
                    key={`${day}-${hour}`}
                    title={`${day}, ${hour}:00 — ${value.toLocaleString()} impressions`}
                    className="h-3"
                    style={{ backgroundColor: intensity > 0 ? `rgba(66, 133, 244, ${0.12 + intensity * 0.82})` : '#F8FAFC' }}
                  />
                )
              }),
            ])}
          </div>
          <div className="ml-[16px] mt-1 flex min-h-4 items-center justify-between text-[9px] leading-4 text-slate-500">
            <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>12AM</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function money(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function LsaKeyResultsPanel({ slide }: { slide: Slide }) {
  const data = slide.content.lsaKeyResults ?? {
    totalSpend: 0,
    chargedLeads: 0,
    adImpressions: 0,
    topImpressionRate: 0,
    absoluteTopImpressionRate: 0,
  }
  const lowerMetrics = [
    {
      label: 'Ad impressions',
      value: Math.round(data.adImpressions).toLocaleString('en-US'),
      description: 'The number of times your ad appeared in search results during the selected date range.',
    },
    {
      label: 'Top impression rate on Search',
      value: `${data.topImpressionRate.toFixed(2)}%`,
      description: 'The percentage of impressions shown above unpaid search results.',
    },
    {
      label: 'Absolute top impression rate on Search',
      value: `${data.absoluteTopImpressionRate.toFixed(2)}%`,
      description: 'The percentage of impressions shown as the very first ad in search results.',
    },
  ]

  return (
    <div className="overflow-hidden rounded-sm border border-slate-400 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
      <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-300">
        <div className="flex min-h-[175px] flex-col">
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Total lead spend</span><span className="font-semibold text-slate-700">All</span>
            </div>
            <p className="mt-1 text-3xl font-medium tabular-nums text-slate-800">{money(data.totalSpend)}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 flex-1 bg-[#8AB4F8]" />
              <span className="text-[10px] text-slate-500">{money(data.totalSpend)} spend</span>
            </div>
          </div>
          <div className="border-t border-slate-200 px-4 py-3 text-[10px] leading-4 text-slate-600">
            The amount spent on leads during the selected date range. This amount does not reflect pending credits.
          </div>
        </div>
        <div className="flex min-h-[175px] flex-col">
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Charged leads</span><span className="font-semibold text-slate-700">All</span>
            </div>
            <p className="mt-1 text-3xl font-medium tabular-nums text-slate-800">{Math.round(data.chargedLeads).toLocaleString('en-US')}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 flex-1 bg-[#8AB4F8]" />
              <span className="text-[10px] text-slate-500">{Math.round(data.chargedLeads)} charged leads</span>
            </div>
          </div>
          <div className="border-t border-slate-200 px-4 py-3 text-[10px] leading-4 text-slate-600">
            The number of leads charged during the selected date range.
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-slate-300">
        {lowerMetrics.map((metric) => (
          <div key={metric.label} className="min-h-[125px] p-4">
            <p className="text-[10px] text-slate-500">{metric.label}</p>
            <p className="mt-1 text-2xl font-medium tabular-nums text-slate-800">{metric.value}</p>
            <p className="mt-2 text-[9px] leading-4 text-slate-600">{metric.description}</p>
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

export function SearchAdPreviewCard({
  ad,
  onChange,
}: {
  ad: AdPerformanceCard
  onChange?: (patch: Partial<AdPerformanceCard>) => void
}) {
  const path = (ad.pathLabels ?? []).join(' › ')

  return (
    <div className="mx-auto flex h-full min-h-[350px] w-full max-w-[760px] flex-col px-6">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#1a73e8]">
        <span className="h-2.5 w-2.5 rounded-full bg-[#188038]" />
        <span>{ad.businessName}</span>
        {path ? <><span className="text-slate-400">›</span><span>{path}</span></> : null}
      </div>

      <div className="relative flex flex-1 flex-col rounded-t-[38px] rounded-b-none border-[5px] border-[#dadce0] bg-white px-5 pb-5 pt-8 shadow-[0_14px_35px_rgba(60,64,67,0.12)]">
        <span className="absolute left-1/2 top-2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[#dadce0] bg-white" />
        <div className="flex flex-1 flex-col rounded border border-[#dadce0] bg-[#f8f9fa] px-3 py-2">
          <div className="mb-2 flex items-center gap-1.5 border-b border-[#e2e5e9] pb-2 text-xs text-[#188038]">
            <span className="rounded-sm border border-[#188038] px-1 font-semibold leading-4">Ad</span>
            <span className="truncate">{ad.displayUrl}</span>
            {path ? <span className="truncate">› {path}</span> : null}
          </div>
          <textarea
            value={ad.headline}
            onChange={(event) => onChange?.({ headline: event.target.value })}
            rows={2}
            className="block w-full resize-none overflow-hidden bg-transparent text-[23px] font-normal leading-[1.2] text-[#1a0dab] outline-none"
            aria-label="Ad headline"
          />
          <textarea
            value={ad.description}
            onChange={(event) => onChange?.({ description: event.target.value })}
            rows={3}
            className="mt-2 block w-full resize-none overflow-hidden border-t border-[#e2e5e9] bg-transparent pt-2 text-base leading-6 text-[#5f6368] outline-none"
            aria-label="Ad description"
          />
          {(ad.pathLabels ?? []).length ? (
            <div className="mt-1 grid gap-1 text-sm text-[#1a0dab]">
              {(ad.pathLabels ?? []).map((label) => <span key={label}>{label}</span>)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function PmaxAdPreviewCard({
  ad,
  onChange,
}: {
  ad: AdPerformanceCard
  onChange?: (patch: Partial<AdPerformanceCard>) => void
}) {
  const initials = (ad.businessName || '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()

  return (
    <div className="flex h-full min-h-[350px] flex-col rounded-lg border border-[#5f6368] bg-white p-5 shadow-[0_10px_24px_rgba(60,64,67,0.08)]">
      <div className="flex items-center gap-3">
        {ad.logoSrc ? (
          <img crossOrigin="anonymous" src={ad.logoSrc} alt="" className="h-11 w-11 rounded-full border border-[#dadce0] object-contain" />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dadce0] bg-[#f8f9fa] text-xs font-bold text-[#5f6368]">{initials}</span>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-[#202124]">{ad.businessName}</p>
          <p className="truncate text-sm text-[#5f6368]">{ad.displayUrl}</p>
        </div>
      </div>

      <textarea
        value={ad.longHeadline || ad.headline}
        onChange={(event) => onChange?.({ longHeadline: event.target.value })}
        rows={2}
        className="mt-4 block w-full resize-none overflow-hidden bg-transparent text-[25px] leading-[1.2] text-[#0b57d0] outline-none"
        aria-label="Performance Max headline"
      />

      <div className="mt-3 flex min-h-0 flex-1 gap-4">
        <textarea
          value={ad.description}
          onChange={(event) => onChange?.({ description: event.target.value })}
          rows={5}
          className="block min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-base leading-6 text-[#5f6368] outline-none"
          aria-label="Performance Max description"
        />
        {ad.imageSrc ? (
          <img
            crossOrigin="anonymous"
            src={ad.imageSrc}
            alt="Performance Max creative"
            className="h-32 w-32 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="h-32 w-32 shrink-0 rounded-lg bg-[#f1f3f4]" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(ad.ctaLabels ?? []).slice(0, 3).map((label) => (
          <span key={label} className="rounded-full border border-[#dadce0] px-4 py-2 text-sm font-medium text-[#0b57d0]">{label}</span>
        ))}
      </div>
    </div>
  )
}

function sanitizeCustomHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'p', 'br', 'strong', 'b', 'em', 'i', 'span'],
    ALLOWED_ATTR: ['style'],
  })
}

function plainTextToHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

function CustomSlideEditor({
  slide,
  onChange,
}: {
  slide: Slide
  onChange: (slide: Slide) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const contentBlock = slide.content.textBlocks?.[0]
  const imageInputId = `custom-slide-image-${slide.id}`
  const initialHtml = slide.content.customHtml ?? plainTextToHtml(contentBlock?.value ?? '')

  const updateContent = (patch: Partial<SlideContent>) => {
    onChange({ ...slide, content: { ...slide.content, ...patch } })
  }

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || document.activeElement === editor) return
    const safeHtml = sanitizeCustomHtml(initialHtml)
    if (editor.innerHTML !== safeHtml) editor.innerHTML = safeHtml
  }, [initialHtml])

  const saveSelection = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.rangeCount) return
    const range = selection.getRangeAt(0)
    if (editor.contains(range.commonAncestorContainer)) savedRangeRef.current = range.cloneRange()
  }

  const restoreSelection = () => {
    const editor = editorRef.current
    const range = savedRangeRef.current
    if (!editor || !range) return false
    editor.focus()
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    return true
  }

  const persistEditor = () => {
    const editor = editorRef.current
    if (!editor) return
    const customHtml = sanitizeCustomHtml(editor.innerHTML)
    const value = editor.innerText
    updateContent({
      customHtml,
      textBlocks: contentBlock
        ? (slide.content.textBlocks ?? []).map((block) => block.id === contentBlock.id ? { ...block, value } : block)
        : slide.content.textBlocks,
    })
  }

  const applyCommand = (command: 'bold' | 'italic' | 'justifyLeft' | 'justifyCenter' | 'justifyRight') => {
    if (!restoreSelection()) return
    document.execCommand(command, false)
    saveSelection()
    persistEditor()
  }

  const applyFontSize = (fontSize: number) => {
    if (!restoreSelection()) return
    document.execCommand('fontSize', false, '7')
    editorRef.current?.querySelectorAll('font[size="7"]').forEach((font) => {
      const span = document.createElement('span')
      span.style.fontSize = `${fontSize}px`
      span.innerHTML = font.innerHTML
      font.replaceWith(span)
    })
    saveSelection()
    persistEditor()
  }

  const handleImageChange = (file?: File) => {
    if (!file) return
    readImageFile(file).then((customImageSrc) => {
      if (customImageSrc) updateContent({ customImageSrc })
    })
  }

  const toolbarButton = 'flex h-8 w-8 items-center justify-center rounded border border-[#D8E4F2] bg-white text-slate-500 transition hover:border-[#0057C2] hover:bg-[#EAF6FF] hover:text-[#0057C2]'

  return (
    <section className={`flex ${slideFrameClass} flex-col border border-[#D8E4F2] bg-white shadow-[0_20px_45px_rgba(0,59,143,0.12)]`}>
      <div className="h-3 shrink-0 bg-gradient-to-r from-[#003B8F] via-[#0057C2] to-[#00AEEF]" />
      <div className="flex min-h-0 flex-1 flex-col p-5">
        <div className="mb-4 border-b border-[#D8E4F2] pb-3">
          <AutoResizeSlideTitle value={slide.title} onChange={(title) => onChange({ ...slide, title })} />
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#D8E4F2] bg-[#F7FBFF] p-2" data-pdf-hide="true">
          <select
            defaultValue={20}
            onMouseDown={saveSelection}
            onChange={(event) => applyFontSize(Number(event.target.value))}
            className="h-8 rounded border border-[#D8E4F2] bg-white px-2 text-xs font-semibold text-[#062A63] outline-none"
            aria-label="Text size"
          >
            <option value={16}>Small</option>
            <option value={20}>Medium</option>
            <option value={24}>Large</option>
            <option value={30}>Extra large</option>
            <option value={36}>Title</option>
          </select>
          <button type="button" onMouseDown={(event) => { event.preventDefault(); applyCommand('bold') }} className={toolbarButton} aria-label="Bold selected text">
            <Bold className="h-4 w-4" />
          </button>
          <button type="button" onMouseDown={(event) => { event.preventDefault(); applyCommand('italic') }} className={toolbarButton} aria-label="Italic selected text">
            <Italic className="h-4 w-4" />
          </button>
          <span className="mx-1 h-5 w-px bg-[#D8E4F2]" />
          <button type="button" onMouseDown={(event) => { event.preventDefault(); applyCommand('justifyLeft') }} className={toolbarButton} aria-label="Align selected paragraph left">
            <AlignLeft className="h-4 w-4" />
          </button>
          <button type="button" onMouseDown={(event) => { event.preventDefault(); applyCommand('justifyCenter') }} className={toolbarButton} aria-label="Center selected paragraph">
            <AlignCenter className="h-4 w-4" />
          </button>
          <button type="button" onMouseDown={(event) => { event.preventDefault(); applyCommand('justifyRight') }} className={toolbarButton} aria-label="Align selected paragraph right">
            <AlignRight className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={persistEditor}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          onBlur={persistEditor}
          data-placeholder="Content"
          className="custom-slide-rich-text min-h-[100px] w-full flex-1 overflow-y-auto rounded-lg border border-[#D8E4F2] bg-white p-4 text-xl leading-relaxed text-[#062A63] outline-none transition focus:border-[#0057C2] empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
        />

        {slide.content.customImageSrc ? (
          <div className="relative mt-3 flex h-[230px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#D8E4F2] bg-[#F7FBFF]">
            <img src={slide.content.customImageSrc} alt="Custom slide" className="h-full w-full object-contain" />
            <div className="absolute right-3 top-3 flex gap-2" data-pdf-hide="true">
              <label htmlFor={imageInputId} className="inline-flex h-8 cursor-pointer items-center rounded-md bg-white px-3 text-xs font-bold text-[#0057C2] shadow">Replace</label>
              <button type="button" onClick={() => updateContent({ customImageSrc: undefined })} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white text-slate-500 shadow" aria-label="Remove image">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <label htmlFor={imageInputId} className="mt-3 inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#B9D8F4] text-sm font-semibold text-[#0057C2] hover:bg-[#F7FBFF]" data-pdf-hide="true">
            <ImagePlus className="h-4 w-4" />
            Add image
          </label>
        )}
        <input id={imageInputId} type="file" accept="image/*" onChange={(event) => handleImageChange(event.target.files?.[0])} className="sr-only" data-pdf-hide="true" />
      </div>
    </section>
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
  const searchAd = slide.content.ads?.find((ad) => ad.type === 'Search Ad')
  const pmaxAd = slide.content.ads?.find((ad) => ad.type === 'Performance Max')

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
        
          <div className="flex h-full w-full flex-col items-center justify-center gap-8 text-center">
            <textarea
              value={slide.content.finalMessage ?? ''}
              onChange={(event) => updateContent({ finalMessage: event.target.value })}
              rows={4}
              className="relative z-10 w-full max-w-3xl resize-none bg-transparent text-center text-5xl font-bold leading-tight text-white outline-none placeholder:text-white/50 max-md:text-3xl"
            />
            <div className="relative rounded-md px-4 py-3">
              <XMSLogo mode="dark" height={134} />
            </div>
          </div>

      </section>
    )
  }

  if (slide.type === 'google_ads_kpis') {
    const imageInputId = `google-ads-kpi-image-${slide.id}`

    const handleSupportingImageChange = (file?: File) => {
      if (!file) return
      readImageFile(file).then((supportingImageSrc) => {
        if (supportingImageSrc) updateContent({ supportingImageSrc })
      })
    }

    return (
      <section className={`flex ${slideFrameClass} flex-col border border-[#D8E4F2] bg-white shadow-[0_20px_45px_rgba(0,59,143,0.12)]`}>
        <div className="h-3 shrink-0 bg-gradient-to-r from-[#003B8F] via-[#0057C2] to-[#00AEEF]" />
        <div className="flex min-h-0 flex-1 flex-col p-5">
          <div className="mb-5 border-b border-[#D8E4F2] pb-4">
            <div className="min-w-0 flex-1">
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

            <div className="group relative mt-3 flex min-h-[100px] flex-1 items-center justify-center overflow-hidden rounded-lg border border-[#D8E4F2] bg-[#F7FBFF]">
              {slide.content.supportingImageSrc ? (
                <img
                  src={slide.content.supportingImageSrc}
                  alt="Supporting Google Ads performance"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <label htmlFor={imageInputId} className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 px-6 text-center text-[#0057C2] transition hover:bg-[#EAF6FF]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[#B9D8F4] bg-white">
                    <ImagePlus className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold">Add an image</span>
                </label>
              )}
              <input
                id={imageInputId}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  handleSupportingImageChange(event.target.files?.[0])
                  event.currentTarget.value = ''
                }}
                className="sr-only"
              />
              {slide.content.supportingImageSrc && (
                <div className="absolute right-2 top-2 flex gap-2">
                  <label htmlFor={imageInputId} className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-xs font-bold text-[#0057C2] shadow">
                    Replace
                  </label>
                  <button
                    type="button"
                    onClick={() => updateContent({ supportingImageSrc: undefined })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white text-slate-500 shadow transition hover:text-danger"
                    aria-label="Remove supporting image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3">
              <div className="w-full border-t border-[#D8E4F2] pt-3">
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

  if (slide.type === 'lsa_key_results') {
    return (
      <section className={`flex ${slideFrameClass} flex-col border border-[#D8E4F2] bg-white shadow-[0_20px_45px_rgba(0,59,143,0.12)]`}>
        <div className="h-3 shrink-0 bg-gradient-to-r from-[#003B8F] via-[#0057C2] to-[#00AEEF]" />
        <div className="flex min-h-0 flex-1 flex-col p-5">
          <div className="mb-4 border-b border-[#D8E4F2] pb-3">
            <AutoResizeSlideTitle value={slide.title} onChange={(title) => onChange({ ...slide, title })} />
          </div>
          <LsaKeyResultsPanel slide={slide} />
        </div>
      </section>
    )
  }

  if (slide.type === 'custom') {
    return <CustomSlideEditor slide={slide} onChange={onChange} />
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
          <div className="grid grid-cols-2 gap-4">
            {searchAd ? (
              <SearchAdPreviewCard
                ad={searchAd}
                onChange={(patch) => updateAd(searchAd.id, patch)}
              />
            ) : <div />}
            {pmaxAd ? (
              <PmaxAdPreviewCard
                ad={pmaxAd}
                onChange={(patch) => updateAd(pmaxAd.id, patch)}
              />
            ) : null}
          </div>
        ) : null}

        {slide.content.tables?.map((table) => (
          <ReportTable
            key={table.id}
            table={table}
            maxRows={slide.type === 'keywords' ? 7 : slide.type === 'search_terms' ? 9 : undefined}
            onCellChange={(rowIndex, key, value) => updateTableCell(table.id, rowIndex, key, value)}
          />
        ))}

        {slide.content.charts?.length ? (
          <div className={`grid grid-cols-1 gap-3 ${slide.type === 'devices_day_hour' ? 'xl:grid-cols-2' : 'xl:grid-cols-3'}`}>
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

        {slide.content.textBlocks?.map((block) => (
          slide.type === 'keywords' || slide.type === 'ads' || slide.type === 'search_terms' ? (
            <GoogleAdsSummaryBlock key={block.id} block={block} onChange={(value) => updateTextBlock('textBlocks', block.id, value)} />
          ) : (
            <EditableTextBlock key={block.id} block={block} onChange={(value) => updateTextBlock('textBlocks', block.id, value)} />
          )
        ))}

        {slide.content.noteBlocks?.length ? (
          <div className={slide.type === 'lsa_notes' ? 'grid grid-cols-2 gap-3' : 'space-y-4'}>
            {slide.content.noteBlocks.map((block) => (
              <EditableTextBlock key={block.id} block={block} minRows={3} onChange={(value) => updateTextBlock('noteBlocks', block.id, value)} />
            ))}
          </div>
        ) : null}
      </div>
      </div>
    </section>
  )
}
