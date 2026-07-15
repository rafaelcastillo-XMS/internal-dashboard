import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, FileText, FolderOpen, Plus, X } from 'lucide-react'
import { useSEMDashboardState } from '@/features/sem/hooks/useSEMDashboardState'
import {
  REPORT_MONTHS,
  createReportFromTemplate,
  createSeedReportsForClient,
  initialsForName,
} from '@/features/sem/reports/mockReports'
import { readStoredReports, upsertStoredReport, writeStoredReports } from '@/features/sem/reports/storage'
import { exportReportToPdf } from '@/features/sem/reports/exportReportPdf'
import {
  hydrateReportWithRealGoogleAdsData,
  reportNeedsGoogleAdsBreakdownHydration,
  reportNeedsGoogleAdsKeywordHydration,
  reportNeedsGoogleAdsKpiHydration,
  reportNeedsGoogleAdsSearchTermHydration,
  reportNeedsLsaKeyResultsHydration,
} from '@/features/sem/reports/reportData'
import {
  ChartBlock,
  KpiCard,
  LsaKeyResultsPanel,
  ReportActionsBar,
  ReportSidebar,
  ReportSlide,
} from '@/features/sem/reports/components'
import type { Report, ReportStatus, Slide } from '@/features/sem/reports/types'
import { fetchClientProfile } from '@/features/clients/profiles'
import { supabase } from '@/lib/supabase'

type AccountChoice = { value: string; label: string }

async function resolveClientLogo(identifier: string) {
  const byId = await supabase
    .from('clients')
    .select('id')
    .eq('id', identifier)
    .maybeSingle()
  if (byId.error) throw byId.error

  let dashboardClientId = byId.data?.id ?? ''
  if (!dashboardClientId) {
    const byAccount = await supabase
      .from('clients')
      .select('id')
      .eq('sem_account_id', identifier)
      .maybeSingle()
    if (byAccount.error) throw byAccount.error
    dashboardClientId = byAccount.data?.id ?? ''
  }

  if (!dashboardClientId) return ''
  return (await fetchClientProfile(dashboardClientId))?.logo_url ?? ''
}

function formatUpdated(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusClass(status: ReportStatus) {
  if (status === 'Ready') return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
  if (status === 'In Review') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
}

function readCachedAccountName(accountId: string) {
  try {
    const cached = JSON.parse(sessionStorage.getItem('xms_sem_accounts') ?? '[]') as { id: string; name: string }[]
    return cached.find((account) => account.id === accountId)?.name ?? ''
  } catch {
    return ''
  }
}

function currentYearOptions() {
  const year = new Date().getFullYear()
  return [year - 1, year, year + 1]
}

function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(status)}`}>
      {status}
    </span>
  )
}

function CreateReportPanel({
  clientOptions,
  defaultClientId,
  onCreate,
}: {
  clientOptions: AccountChoice[]
  defaultClientId: string
  onCreate: (clientId: string, month: string, year: number) => Promise<void>
}) {
  const today = new Date()
  const [clientId, setClientId] = useState(defaultClientId)
  const [month, setMonth] = useState(REPORT_MONTHS[today.getMonth()])
  const [year, setYear] = useState(today.getFullYear())
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    setClientId(defaultClientId)
  }, [defaultClientId])

  return (
    <div className="rounded-lg border border-stroke bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-strokedark dark:bg-boxdark">
      <div className="mb-4 flex items-center gap-2">
        <Plus className="h-4 w-4 text-slate-500" />
        <h2 className="font-bold text-black dark:text-[#E2E5E9]">Create New Report</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,1fr)_180px_140px_auto] lg:items-end">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-body dark:text-bodydark">Client</span>
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="h-10 w-full rounded-md border border-stroke bg-white px-3 text-sm font-semibold text-black outline-none focus:border-slate-500 dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]"
          >
            {clientOptions.map((client) => (
              <option key={client.value} value={client.value}>{client.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-body dark:text-bodydark">Month</span>
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="h-10 w-full rounded-md border border-stroke bg-white px-3 text-sm font-semibold text-black outline-none focus:border-slate-500 dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]"
          >
            {REPORT_MONTHS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-body dark:text-bodydark">Year</span>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="h-10 w-full rounded-md border border-stroke bg-white px-3 text-sm font-semibold text-black outline-none focus:border-slate-500 dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]"
          >
            {currentYearOptions().map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <button
          onClick={async () => {
            setGenerating(true)
            try {
              await onCreate(clientId, month, year)
            } finally {
              setGenerating(false)
            }
          }}
          disabled={generating}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-800 px-4 text-sm font-bold text-white transition hover:bg-slate-900 disabled:opacity-60"
        >
          <FileText className="h-4 w-4" />
          {generating ? 'Loading Ads data...' : 'Generate Report'}
        </button>
      </div>
    </div>
  )
}

function ReportsListPage({
  reports,
  clientOptions,
  currentClient,
  onCreate,
  onOpenReport,
}: {
  reports: Report[]
  clientOptions: AccountChoice[]
  currentClient: AccountChoice
  onCreate: (clientId: string, month: string, year: number) => Promise<void>
  onOpenReport: (report: Report) => void
}) {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">
            Reports
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-bold bg-slate-100 text-slate-700 align-middle dark:bg-slate-800 dark:text-slate-200">
              SEM Intelligence
            </span>
          </h1>
          <p className="mt-1 text-sm text-body dark:text-bodydark">
            Monthly Google Ads & LSA reports for <span className="font-semibold text-black dark:text-[#E2E5E9]">{currentClient.label}</span>.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen((open) => !open)}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-800 px-4 text-sm font-bold text-white transition hover:bg-slate-900"
        >
          <Plus className="h-4 w-4" />
          Create New Report
        </button>
      </div>

      {createOpen && (
        <div className="mb-6">
          <CreateReportPanel
            clientOptions={clientOptions}
            defaultClientId={currentClient.value}
            onCreate={onCreate}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-stroke bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-5 py-4 dark:border-strokedark">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-slate-500" />
            <h2 className="font-bold text-black dark:text-[#E2E5E9]">Monthly Reports</h2>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <th className="px-5 py-3">Client name</th>
                <th className="px-5 py-3">Month</th>
                <th className="px-5 py-3">Year</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last updated</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke dark:divide-strokedark">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {report.clientLogo ? (
                        <img src={report.clientLogo} alt={`${report.clientName} logo`} className="h-9 w-9 rounded-md object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-800 text-xs font-black text-white">
                          {initialsForName(report.clientName)}
                        </span>
                      )}
                      <span className="font-semibold text-black dark:text-[#E2E5E9]">{report.clientName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-body dark:text-bodydark">{report.month}</td>
                  <td className="px-5 py-4 text-body dark:text-bodydark">{report.year}</td>
                  <td className="px-5 py-4"><ReportStatusBadge status={report.status} /></td>
                  <td className="px-5 py-4 text-body dark:text-bodydark">{formatUpdated(report.updatedAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => onOpenReport(report)}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-stroke bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 dark:border-strokedark dark:bg-boxdark dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Open Report
                    </button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-body dark:text-bodydark">
                    No reports yet for this client.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PreviewModal({ report, onClose }: { report: Report; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] bg-black/50 p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-[1220px] flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-boxdark">
        <div className="flex items-center justify-between gap-4 border-b border-stroke px-5 py-4 dark:border-strokedark">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Report Preview</p>
            <h2 className="text-lg font-bold text-black dark:text-[#E2E5E9]">{report.clientName} - {report.month} {report.year}</h2>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md border border-stroke text-slate-500 transition hover:border-slate-400 hover:bg-slate-100 dark:border-strokedark dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-100 p-5 custom-scrollbar dark:bg-boxdark-2">
          <div className="space-y-4">
            {report.slides
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((slide) => (
                <article key={slide.id} className="mx-auto aspect-[1164/655] w-full max-w-[1164px] overflow-hidden rounded-lg border border-[#D8E4F2] bg-white shadow-[0_16px_40px_rgba(0,59,143,0.10)]">
                  <div className="h-2 bg-gradient-to-r from-[#003B8F] via-[#0057C2] to-[#00AEEF]" />
                  <div className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0057C2]">Slide {slide.order}</p>
                      <h3 className="mt-1 text-xl font-bold text-[#003B8F]">{slide.title}</h3>
                    </div>
                    <span className="rounded-md bg-[#EAF6FF] px-2 py-1 text-xs font-semibold text-[#0057C2]">
                      {slide.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {slide.type === 'cover' && (
                    <div className="rounded-lg bg-gradient-to-br from-[#003B8F] via-[#0057C2] to-[#00AEEF] p-8 text-white">
                      <p className="text-4xl font-black">{slide.content.reportTitle}</p>
                      <p className="mt-3 text-xl font-bold text-[#BFEFFF]">{report.month} {report.year}</p>
                      <p className="mt-6 text-2xl font-bold text-white/85">{report.clientName}</p>
                    </div>
                  )}
                  {slide.type === 'lsa_key_results' && <LsaKeyResultsPanel slide={slide} />}
                  {slide.type !== 'lsa_key_results' && slide.content.kpis?.length ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {slide.content.kpis.map((metric) => <KpiCard key={metric.id} metric={metric} />)}
                    </div>
                  ) : null}
                  {slide.type === 'google_ads_kpis' && slide.content.supportingImageSrc ? (
                    <div className="mt-3 flex max-h-[210px] items-center justify-center overflow-hidden bg-[#F7FBFF]">
                      <img
                        src={slide.content.supportingImageSrc}
                        alt="Supporting Google Ads performance"
                        className="max-h-[210px] max-w-full object-contain"
                      />
                    </div>
                  ) : null}
                  {slide.content.charts?.length ? (
                    <div className={`mt-4 grid grid-cols-1 gap-3 ${slide.type === 'devices_day_hour' ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
                      {slide.content.charts.map((chart) => <ChartBlock key={chart.id} chart={chart} />)}
                    </div>
                  ) : null}
                  {slide.content.tables?.map((table) => (
                    <div key={table.id} className="mt-4 overflow-hidden rounded-lg border border-[#D8E4F2]">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-[#EAF6FF] text-xs uppercase text-[#003B8F]">
                          <tr>{table.columns.map((column) => <th key={column.key} className="px-3 py-2 text-left">{column.label}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-[#D8E4F2]">
                          {table.rows.slice(0, slide.type === 'keywords' ? 7 : slide.type === 'search_terms' ? 9 : table.rows.length).map((row, index) => (
                            <tr key={index}>
                              {table.columns.map((column) => <td key={column.key} className="px-3 py-2 text-slate-600">{row[column.key]}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  {slide.content.ads?.length ? (
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      {slide.content.ads.slice(0, 2).map((ad) => (
                        <div key={ad.id} className="overflow-hidden rounded-lg border border-[#D8E4F2] bg-white">
                          <div className="aspect-[4/3] bg-[#F7FBFF]">
                            {ad.imageSrc ? (
                              <img src={ad.imageSrc} alt={ad.headline || ad.type} className="h-full w-full object-contain" />
                            ) : (
                              <div className="flex h-full items-center justify-center px-4 text-center text-sm font-semibold text-slate-500">
                                No ad image attached
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <p className="whitespace-pre-wrap text-sm leading-6 text-[#062A63]">{ad.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {slide.content.highlights?.length ? (
                    <ul className="mt-4 grid gap-2">
                      {slide.content.highlights.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm font-medium text-slate-600">
                          <CheckCircle2 className="h-4 w-4 text-[#0057C2]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {[...(slide.type === 'ads' || slide.type === 'lsa_key_results' ? [] : slide.content.textBlocks ?? []), ...(slide.content.noteBlocks ?? [])].map((block) => (
                    <div key={block.id} className={slide.type === 'google_ads_kpis' ? 'mt-3 border-t border-[#D8E4F2] pt-3' : 'mt-4 rounded-lg border border-[#D8E4F2] bg-[#F7FBFF] p-4'}>
                      {slide.type === 'ads' || slide.type === 'search_terms' || slide.type === 'keywords' ? null : (
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0057C2]">{block.label}</p>
                      )}
                      <p className={`${slide.type === 'ads' || slide.type === 'search_terms' || slide.type === 'keywords' ? '' : 'mt-2 '}whitespace-pre-wrap text-sm leading-6 text-[#062A63]`}>{block.value}</p>
                    </div>
                  ))}
                  {slide.content.finalMessage && (
                    <p className="py-8 text-center text-3xl font-bold text-[#062A63]">{slide.content.finalMessage}</p>
                  )}
                  </div>
                </article>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function renumberSlides(slides: Slide[]) {
  return slides
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((slide, index) => ({ ...slide, order: index + 1 }))
}

function assignSlideOrder(slides: Slide[]) {
  return slides.map((slide, index) => ({ ...slide, order: index + 1 }))
}

function createCustomSlide(order: number): Slide {
  const id = `custom-slide-${Date.now()}`
  return {
    id,
    type: 'custom',
    title: 'New Slide',
    order,
    notes: '',
    content: {
      textBlocks: [
        {
          id: `${id}-content`,
          label: 'Content',
          value: 'Write slide content here.',
        },
      ],
    },
  }
}

function ReportEditorView({
  sourceReport,
  onPersist,
  onBack,
}: {
  sourceReport: Report
  onPersist: (report: Report) => void
  onBack: () => void
}) {
  const [draft, setDraft] = useState(sourceReport)
  const [activeSlideId, setActiveSlideId] = useState(sourceReport.slides[0]?.id ?? '')
  const [dirty, setDirty] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [googleAdsDataLoading, setGoogleAdsDataLoading] = useState(false)

  useEffect(() => {
    setDraft(sourceReport)
    setActiveSlideId(sourceReport.slides[0]?.id ?? '')
    setDirty(false)
  }, [sourceReport])

  useEffect(() => {
    const needsKpis = reportNeedsGoogleAdsKpiHydration(sourceReport)
    const needsKeywords = reportNeedsGoogleAdsKeywordHydration(sourceReport)
    const needsBreakdowns = reportNeedsGoogleAdsBreakdownHydration(sourceReport)
    const needsSearchTerms = reportNeedsGoogleAdsSearchTermHydration(sourceReport)
    const needsLsa = reportNeedsLsaKeyResultsHydration(sourceReport)
    if (!needsKpis && !needsKeywords && !needsBreakdowns && !needsSearchTerms && !needsLsa) return
    let cancelled = false

    setGoogleAdsDataLoading(true)
    hydrateReportWithRealGoogleAdsData(sourceReport)
      .then((hydratedReport) => {
        if (cancelled) return
        const saved = { ...hydratedReport, updatedAt: new Date().toISOString() }
        setDraft(saved)
        onPersist(saved)
        setDirty(false)
      })
      .finally(() => {
        if (!cancelled) setGoogleAdsDataLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sourceReport, onPersist])

  const sortedSlides = useMemo(() => draft.slides.slice().sort((a, b) => a.order - b.order), [draft.slides])
  const activeSlide = sortedSlides.find((slide) => slide.id === activeSlideId) ?? sortedSlides[0]

  const updateSlide = (slide: Slide) => {
    setDraft((current) => ({
      ...current,
      slides: current.slides.map((item) => (item.id === slide.id ? slide : item)),
    }))
    setDirty(true)
  }

  const saveReport = () => {
    const saved = { ...draft, updatedAt: new Date().toISOString() }
    setDraft(saved)
    onPersist(saved)
    setDirty(false)
  }

  const addSlide = () => {
    const orderedSlides = renumberSlides(draft.slides)
    const slide = createCustomSlide(orderedSlides.length + 1)
    setDraft((current) => ({
      ...current,
      slides: [...renumberSlides(current.slides), slide],
    }))
    setActiveSlideId(slide.id)
    setDirty(true)
  }

  const moveSlide = (slideId: string, direction: -1 | 1) => {
    setDraft((current) => {
      const orderedSlides = renumberSlides(current.slides)
      const currentIndex = orderedSlides.findIndex((slide) => slide.id === slideId)
      const targetIndex = currentIndex + direction
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedSlides.length) return current

      const nextSlides = orderedSlides.slice()
      const currentSlide = nextSlides[currentIndex]
      nextSlides[currentIndex] = nextSlides[targetIndex]
      nextSlides[targetIndex] = currentSlide
      return {
        ...current,
        slides: assignSlideOrder(nextSlides),
      }
    })
    setActiveSlideId(slideId)
    setDirty(true)
  }

  if (!activeSlide) {
    return (
      <div className="mx-auto max-w-screen-xl p-6">
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <ArrowLeft className="h-4 w-4" />
          Back to reports
        </button>
        <div className="rounded-lg border border-stroke bg-white p-8 text-center text-body dark:border-strokedark dark:bg-boxdark dark:text-bodydark">
          This report has no slides.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-100 dark:bg-boxdark-2">
      <ReportActionsBar
        report={draft}
        dirty={dirty}
        onBack={onBack}
        onSave={saveReport}
        onPreview={() => setPreviewOpen(true)}
        onExportPdf={() => exportReportToPdf(draft)}
      />
      <div className="grid min-h-[calc(100vh-122px)] grid-cols-[280px_minmax(0,1fr)] max-xl:grid-cols-1">
        <div className="max-xl:hidden">
          <ReportSidebar
            slides={sortedSlides}
            activeSlideId={activeSlide.id}
            onSelect={setActiveSlideId}
            onAddSlide={addSlide}
            onMoveSlide={moveSlide}
          />
        </div>
        <main className="flex min-w-0 flex-col items-center p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 xl:hidden">
            <select
              value={activeSlide.id}
              onChange={(event) => setActiveSlideId(event.target.value)}
              className="h-10 min-w-[260px] rounded-md border border-stroke bg-white px-3 text-sm font-semibold text-black outline-none focus:border-slate-500 dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]"
            >
              {sortedSlides.map((slide) => (
                <option key={slide.id} value={slide.id}>Slide {slide.order} - {slide.title}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={() => moveSlide(activeSlide.id, -1)}
                disabled={activeSlide.order === 1}
                aria-label="Move slide up"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stroke bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-strokedark dark:bg-boxdark dark:text-slate-200"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => moveSlide(activeSlide.id, 1)}
                disabled={activeSlide.order === sortedSlides.length}
                aria-label="Move slide down"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stroke bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-strokedark dark:bg-boxdark dark:text-slate-200"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                onClick={addSlide}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-800 px-3 text-sm font-bold text-white transition hover:bg-slate-900"
              >
                <Plus className="h-4 w-4" />
                Add slide
              </button>
            </div>
          </div>
          {googleAdsDataLoading && (
            <div className="mx-auto mb-4 w-full max-w-[1164px] rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm dark:border-strokedark dark:bg-boxdark dark:text-slate-200">
              Loading real Google Ads report data...
            </div>
          )}
          <ReportSlide report={draft} slide={activeSlide} onChange={updateSlide} />
        </main>
      </div>
      {previewOpen && <PreviewModal report={draft} onClose={() => setPreviewOpen(false)} />}
    </div>
  )
}

export function SEMAccountReport() {
  const navigate = useNavigate()
  const { clientId, reportId } = useParams<{ clientId?: string; reportId?: string }>()
  const semState = useSEMDashboardState()
  const [reports, setReports] = useState<Report[]>(() => readStoredReports())
  const [clientLogo, setClientLogo] = useState<string | null>(null)

  const routeClientId = clientId ? decodeURIComponent(clientId) : ''
  const fallbackClientId = semState.selectedAccountId || semState.accountOptions[0]?.value || 'sample-sem-client'
  const effectiveClientId = routeClientId || fallbackClientId
  const currentAccount = semState.accounts.find((account) => account.id === effectiveClientId)
  const cachedName = readCachedAccountName(effectiveClientId)
  const currentClient: AccountChoice = {
    value: effectiveClientId,
    label: currentAccount?.name || cachedName || (effectiveClientId === 'sample-sem-client' ? 'Sample SEM Client' : effectiveClientId),
  }
  const currentClientValue = currentClient.value
  const currentClientLabel = currentClient.label

  useEffect(() => {
    let active = true
    setClientLogo(null)
    resolveClientLogo(effectiveClientId)
      .then(logo => { if (active) setClientLogo(logo) })
      .catch(() => { if (active) setClientLogo('') })
    return () => { active = false }
  }, [effectiveClientId])

  useEffect(() => {
    if (!clientLogo) return
    setReports(current => {
      let changed = false
      const next = current.map(report => {
        if (report.clientId !== effectiveClientId || report.clientLogo === clientLogo) return report
        changed = true
        return { ...report, clientLogo, updatedAt: new Date().toISOString() }
      })
      if (changed) writeStoredReports(next)
      return changed ? next : current
    })
  }, [clientLogo, effectiveClientId])

  const clientOptions = useMemo(() => {
    const options = semState.accountOptions.length > 0
      ? semState.accountOptions
      : [{ value: currentClientValue, label: currentClientLabel }]
    if (options.some((option) => option.value === currentClientValue)) return options
    return [{ value: currentClientValue, label: currentClientLabel }, ...options]
  }, [semState.accountOptions, currentClientValue, currentClientLabel])

  useEffect(() => {
    if (!effectiveClientId || !currentClient.label || clientLogo === null) return
    setReports((current) => {
      if (current.some((report) => report.clientId === effectiveClientId)) return current
      const seeded = createSeedReportsForClient({ id: effectiveClientId, name: currentClient.label, logo: clientLogo })
      const next = [...seeded, ...current]
      writeStoredReports(next)
      return next
    })
  }, [effectiveClientId, currentClient.label, clientLogo])

  const sortedReports = useMemo(() => {
    return reports
      .filter((report) => report.clientId === effectiveClientId)
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [reports, effectiveClientId])

  const activeReport = reportId ? reports.find((report) => report.id === reportId) : null

  const persistReport = useCallback((report: Report) => {
    const next = upsertStoredReport(report)
    setReports(next)
  }, [])

  const handleCreate = async (selectedClientId: string, month: string, year: number) => {
    const option = clientOptions.find((item) => item.value === selectedClientId)
    const resolvedLogo = selectedClientId === effectiveClientId && clientLogo !== null
      ? clientLogo
      : await resolveClientLogo(selectedClientId).catch(() => '')
    const baseReport = createReportFromTemplate({
      clientId: selectedClientId,
      clientName: option?.label || selectedClientId,
      clientLogo: resolvedLogo,
      month,
      year,
    })
    const report = {
      ...(await hydrateReportWithRealGoogleAdsData(baseReport)),
      updatedAt: new Date().toISOString(),
    }
    const next = upsertStoredReport(report)
    setReports(next)
    navigate(`/sem/clients/${encodeURIComponent(report.clientId)}/reports/${report.id}`)
  }

  const openReport = (report: Report) => {
    navigate(`/sem/clients/${encodeURIComponent(report.clientId)}/reports/${report.id}`)
  }

  if (reportId) {
    if (!activeReport) {
      return (
        <div className="mx-auto max-w-screen-xl p-6">
          <button onClick={() => navigate('/sem/reports')} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <ArrowLeft className="h-4 w-4" />
            Back to reports
          </button>
          <div className="rounded-lg border border-stroke bg-white p-8 text-center dark:border-strokedark dark:bg-boxdark">
            <FileText className="mx-auto mb-3 h-8 w-8 text-body dark:text-bodydark" />
            <h1 className="text-lg font-bold text-black dark:text-[#E2E5E9]">Report not found</h1>
            <p className="mt-1 text-sm text-body dark:text-bodydark">The requested report is not available in the local mock report store.</p>
          </div>
        </div>
      )
    }

    return (
      <ReportEditorView
        sourceReport={activeReport}
        onPersist={persistReport}
        onBack={() => navigate(`/sem/clients/${encodeURIComponent(activeReport.clientId)}/reports`)}
      />
    )
  }

  return (
    <ReportsListPage
      reports={sortedReports}
      clientOptions={clientOptions}
      currentClient={currentClient}
      onCreate={handleCreate}
      onOpenReport={openReport}
    />
  )
}
