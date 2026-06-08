import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import { edgeFetch } from '@/lib/edgeFetch'
import { SEO_API } from '../hooks/useSEODashboardState'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GBPData {
  interactions:   { total: number; labels: string[]; values: number[] }
  profileViews:   { total: number; breakdown: { label: string; value: number; pct: number; color: string }[] }
  searches:       { total: number; keywords: { term: string; count: string }[] }
  posts:          { date: string; content: string; hashtags: string; cta: string }[]
  ga4Summary:     { metrics: { label: string; value: string; delta: number }[]; labels: string[]; last90: number[]; preceding: number[] }
  eventsByName:   { labels: string[]; series: { name: string; data: number[] }[] }
  leadsOverview:  { newUsers: number; returningUsers: number; qualifiedLeads: number; converted: number; labels: string[]; values: number[] }
  usersByChannel: { labels: string[]; series: { name: string; data: number[] }[] }
  gsc:            { clicks: string; impressions: string; ctr: string; position: string; labels: string[]; impressionSeries: number[]; positionSeries: number[] }
}

// ─── Sample / fallback data ───────────────────────────────────────────────────

const SAMPLE: GBPData = {
  interactions: {
    total:  585,
    labels: ['Jul 2024', 'Aug 2024', 'Sep 2024', 'Oct 2024', 'Nov 2024', 'Dec 2024'],
    values: [200, 90, 155, 75, 65, 30],
  },
  profileViews: {
    total: 1516,
    breakdown: [
      { label: 'Google Search – mobile',  value: 776, pct: 51, color: '#4285F4' },
      { label: 'Google Search – desktop', value: 357, pct: 24, color: '#FBBC05' },
      { label: 'Google Maps – mobile',    value: 251, pct: 17, color: '#EA4335' },
      { label: 'Google Maps – desktop',   value: 132, pct:  9, color: '#34A853' },
    ],
  },
  searches: {
    total: 21,
    keywords: [
      { term: 'roofers greenville nc',                                   count: '21'   },
      { term: 'advance construction',                                    count: '< 15' },
      { term: 'advanced building & roofing',                             count: '< 15' },
      { term: 'advanced building & roofing, 6113 nc-43, greenville, n…', count: '< 15' },
      { term: 'advanced building and roofing',                           count: '< 15' },
    ],
  },
  posts: [
    {
      date:     'Apr 20, 2026',
      content:  'Your home deserves the best care!\n\nWe love hearing from our happy homeowners. From emergency AC repairs to spring HVAC maintenance, our goal is to keep your property in peak condition.',
      hashtags: '#HomeMainenance #HVACCare #ACNow #5StarService',
      cta:      'Call now',
    },
    {
      date:     'Apr 6, 2026',
      content:  "We'll hop right to it: We hope all of you had a wonderful Easter, filled with meaningful moments, time with loved ones — and maybe a chocolate egg or two!\n\nRemember that spring is the perfect time to check in on your HVAC system.",
      hashtags: '',
      cta:      'Call now',
    },
  ],
  ga4Summary: {
    metrics: [
      { label: 'Users',       value: '1.2K', delta: 56.1 },
      { label: 'New users',   value: '1.2K', delta: 57.7 },
      { label: 'Event count', value: '7K',   delta: 47.4 },
      { label: 'Views',       value: '2.3K', delta: 43.5 },
    ],
    labels:    ['Jun 1','Jun 8','Jun 15','Jun 22','Jul 1','Jul 8','Jul 15','Jul 22','Aug 1','Aug 8','Aug 15','Aug 22'],
    last90:    [400, 2000, 550, 400, 700, 600, 700, 600, 650, 550, 450, 400],
    preceding: [450,  550, 600, 650, 700, 600, 700, 650, 600, 550, 500, 450],
  },
  eventsByName: {
    labels: ['Feb', 'Mar', 'Apr', 'May'],
    series: [
      { name: 'Total',           data: [1400, 2600, 2000, 400] },
      { name: 'page_view',       data: [ 600, 1000,  850, 200] },
      { name: 'session_start',   data: [ 450,  800,  600, 150] },
      { name: 'user_engagement', data: [ 350,  700,  500, 120] },
      { name: 'first_visit',     data: [ 250,  500,  350,  80] },
      { name: 'scroll',          data: [ 150,  300,  200,  60] },
    ],
  },
  leadsOverview: {
    newUsers: 967, returningUsers: 90, qualifiedLeads: 0, converted: 0,
    labels: ['Feb 1','Mar 1','Mar 15','Apr 1','Apr 15','May 1','May 15','May 25'],
    values: [50, 80, 135, 100, 155, 130, 80, 45],
  },
  usersByChannel: {
    labels: ['Feb', 'Mar', 'Apr', 'May'],
    series: [
      { name: 'Total',          data: [300, 500, 420, 75] },
      { name: 'Direct',         data: [150, 320, 240, 40] },
      { name: 'Organic Search', data: [130, 190, 165, 30] },
      { name: 'Organic Social', data: [ 10,  15,  12,  3] },
      { name: 'Referral',       data: [  8,   5,  10,  2] },
      { name: 'Unassigned',     data: [  2,   3,   2,  0] },
    ],
  },
  gsc: {
    clicks: '4.87K', impressions: '123K', ctr: '4%', position: '9.3',
    labels:          ['2/5','2/15','2/25','3/7','3/17','3/27','4/6','4/16','4/26'],
    impressionSeries:[1200, 1800, 1600, 2300, 1700, 2000, 1900, 1200, 1400],
    positionSeries:  [10, 9, 9.5, 8.5, 9, 9.2, 9.8, 10, 9.5],
  },
}

// ─── Chart helpers ────────────────────────────────────────────────────────────

const TEXT = (d: boolean) => d ? '#AEB7C0' : '#64748B'
const GRID = (d: boolean) => d ? '#2E3A47' : '#E2E8F0'

function areaOpts(labels: string[], color: string, isDark: boolean): ApexOptions {
  return {
    chart:      { type: 'area', background: 'transparent', toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: true, speed: 600 } },
    colors:     [color],
    stroke:     { curve: 'smooth', width: 2.5 },
    fill:       { type: 'gradient', gradient: { shade: isDark ? 'dark' : 'light', type: 'vertical', shadeIntensity: 0.3, opacityFrom: 0.2, opacityTo: 0, stops: [0, 100] } },
    xaxis:      { categories: labels, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: TEXT(isDark), fontSize: '11px' } } },
    yaxis:      { labels: { style: { colors: TEXT(isDark), fontSize: '11px' } } },
    grid:       { borderColor: GRID(isDark), strokeDashArray: 4, xaxis: { lines: { show: false } } },
    dataLabels: { enabled: false },
    tooltip:    { theme: isDark ? 'dark' : 'light' },
    markers:    { size: 4, strokeWidth: 2, strokeColors: [color], fillColors: ['#fff'], hover: { size: 6 } } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

function multiLineOpts(labels: string[], isDark: boolean): ApexOptions {
  return {
    chart:      { type: 'line', background: 'transparent', toolbar: { show: false }, zoom: { enabled: false } },
    colors:     ['#1d9bf0', '#4285F4', '#34A853', '#FBBC05', '#334155', '#EA4335'],
    stroke:     { curve: 'smooth', width: 2, dashArray: [6, 0, 0, 0, 0, 0] },
    xaxis:      { categories: labels, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: TEXT(isDark), fontSize: '11px' } } },
    yaxis:      { labels: { style: { colors: TEXT(isDark), fontSize: '11px' }, formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(Math.round(v)) } },
    grid:       { borderColor: GRID(isDark), strokeDashArray: 4, xaxis: { lines: { show: false } } },
    legend:     { position: 'bottom', horizontalAlign: 'center', labels: { colors: TEXT(isDark) }, markers: { size: 5 }, itemMargin: { horizontal: 10, vertical: 4 } },
    dataLabels: { enabled: false },
    tooltip:    { theme: isDark ? 'dark' : 'light', shared: true, intersect: false },
    markers:    { size: 3, hover: { size: 5 } } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

function summaryLineOpts(labels: string[], isDark: boolean): ApexOptions {
  return {
    chart:      { type: 'line', background: 'transparent', toolbar: { show: false }, zoom: { enabled: false } },
    colors:     ['#4285F4', '#94A3B8'],
    stroke:     { curve: 'smooth', width: [2.5, 1.5], dashArray: [0, 5] },
    xaxis:      { categories: labels, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: TEXT(isDark), fontSize: '10px' } } },
    yaxis:      { labels: { style: { colors: TEXT(isDark), fontSize: '10px' }, formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(Math.round(v)) } },
    grid:       { borderColor: GRID(isDark), strokeDashArray: 4, xaxis: { lines: { show: false } } },
    legend:     { position: 'bottom', horizontalAlign: 'center', labels: { colors: TEXT(isDark) }, markers: { size: 5 } },
    dataLabels: { enabled: false },
    tooltip:    { theme: isDark ? 'dark' : 'light', shared: true, intersect: false },
    markers:    { size: 3, hover: { size: 5 } } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

function donutOpts(breakdown: GBPData['profileViews']['breakdown'], isDark: boolean): ApexOptions {
  return {
    chart:       { type: 'donut', background: 'transparent', animations: { enabled: false } },
    colors:      breakdown.map(v => v.color),
    labels:      breakdown.map(v => v.label),
    legend:      { show: false },
    dataLabels:  { enabled: false },
    stroke:      { width: 2 },
    tooltip:     { theme: isDark ? 'dark' : 'light' },
    plotOptions: { pie: { donut: { size: '65%' } } },
  }
}

function gscOpts(labels: string[], isDark: boolean): ApexOptions {
  return {
    chart:      { type: 'line', background: 'transparent', toolbar: { show: false }, zoom: { enabled: false } },
    colors:     ['#7C3AED', '#F47C20'],
    stroke:     { curve: 'smooth', width: [2, 2] },
    xaxis:      { categories: labels, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: TEXT(isDark), fontSize: '10px' } } },
    yaxis:      [
      { title: { text: 'Impressions', style: { color: '#7C3AED', fontWeight: 600, fontSize: '11px' } }, labels: { style: { colors: TEXT(isDark), fontSize: '10px' } } },
      { opposite: true, title: { text: 'Position', style: { color: '#F47C20', fontWeight: 600, fontSize: '11px' } }, min: 0, max: 15, reversed: true, labels: { style: { colors: TEXT(isDark), fontSize: '10px' } } },
    ],
    grid:       { borderColor: GRID(isDark), strokeDashArray: 4, xaxis: { lines: { show: false } } },
    legend:     { position: 'bottom', horizontalAlign: 'center', labels: { colors: TEXT(isDark) }, markers: { size: 5 } },
    dataLabels: { enabled: false },
    tooltip:    { theme: isDark ? 'dark' : 'light', shared: true, intersect: false },
    markers:    { size: 3, hover: { size: 5 } } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ color, icon, title }: { color: string; icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <h2 className="text-lg font-bold text-black dark:text-[#E2E5E9]">{title}</h2>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface GBPReportProps {
  selectedGscSite: string
  selectedGa4Id:   string
  dateRange:       { startDate: string; endDate: string }
  clientLabel?:    string
}

export interface GBPReportHandle {
  triggerDownload: () => Promise<void>
}

// ─── Main component ───────────────────────────────────────────────────────────

export const GBPReport = forwardRef<GBPReportHandle, GBPReportProps>(function GBPReport(
  { selectedGscSite, selectedGa4Id, dateRange, clientLabel },
  ref,
) {
  const reportRef           = useRef<HTMLDivElement>(null)
  const [, setExp] = useState(false)
  const [loading, setLoad]  = useState(false)
  const [isSample, setSample] = useState(false)
  const [data, setData]     = useState<GBPData | null>(null)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    setIsDark(document.documentElement.classList.contains('dark'))
    return () => obs.disconnect()
  }, [])

  useImperativeHandle(ref, () => ({ triggerDownload: handleDownloadPDF }), [])

  const fetchData = useCallback(async () => {
    if (!selectedGscSite) return
    setLoad(true)
    setSample(false)
    try {
      const params = new URLSearchParams({
        site:      selectedGscSite,
        ga4:       selectedGa4Id,
        startDate: dateRange.startDate,
        endDate:   dateRange.endDate,
      })
      const res  = await edgeFetch(`${SEO_API}/gbp?${params}`)
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`)
      setData(json as GBPData)
    } catch {
      // API not connected yet — show sample data
      setData(SAMPLE)
      setSample(true)
    } finally {
      setLoad(false)
    }
  }, [selectedGscSite, selectedGa4Id, dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDownloadPDF() {
    if (!reportRef.current) return
    setExp(true)
    try {
      const [h2cMod, jspdfMod] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2canvas = (h2cMod as any).default ?? h2cMod
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { jsPDF }   = jspdfMod as any

      const PAD = 16 // mm padding on all sides
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = pdf.internal.pageSize.getHeight()
      const cW   = pdfW - PAD * 2
      const cH   = pdfH - PAD * 2

      // ── 1. Render header element off-screen ──────────────────────────
      const clientName = clientLabel || (selectedGscSite ? selectedGscSite.replace(/^https?:\/\//, '').replace(/\/$/, '') : '')
      const dateStr    = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

      const hEl = document.createElement('div')
      hEl.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;background:#ffffff;padding:44px 60px 36px;box-sizing:border-box;font-family:Inter,system-ui,sans-serif;'
      hEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
          <img src="/XMS LOGO - WHITE BACKGROUND.png" style="height:52px;object-fit:contain;" crossorigin="anonymous" />
          <span style="font-size:11px;color:#94a3b8;font-weight:500;letter-spacing:0.02em;">${dateStr}</span>
        </div>
        <div style="border-top:2.5px solid #1A72D9;padding-top:22px;">
          <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 10px;letter-spacing:-0.4px;line-height:1.2;">
            Google Business Profile Report
          </h1>
          <p style="font-size:12.5px;color:#64748b;margin:0;line-height:1.75;max-width:580px;">
            This report summarizes your Google Business Profile performance, Google Analytics activity, and Search Console visibility for the selected period. Use these insights to evaluate your local SEO presence and digital marketing effectiveness.
          </p>
          ${clientName ? `<div style="margin-top:16px;display:inline-flex;align-items:center;background:#EEF4FF;border:1.5px solid #C7D9FF;border-radius:8px;padding:6px 16px;"><span style="font-size:12px;color:#1A72D9;font-weight:600;">${clientName}</span></div>` : ''}
        </div>
      `
      document.body.appendChild(hEl)
      const hCanvas = await html2canvas(hEl, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
      document.body.removeChild(hEl)

      // ── 2. Capture report content (white bg, no dark mode) ───────────
      const rCanvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })

      // ── 3. Scale to PDF content width ────────────────────────────────
      const hNatW  = hCanvas.width  / 2
      const hNatH  = hCanvas.height / 2
      const rNatW  = rCanvas.width  / 2
      const rNatH  = rCanvas.height / 2
      const hMmH   = (hNatH / hNatW) * cW        // header height in mm
      const rMmH   = (rNatH / rNatW) * cW        // full report height in mm
      const rPxPerMm = (rNatH / rMmH)            // report natural px per mm

      // ── 4. Canvas slicer ─────────────────────────────────────────────
      function sliceCanvas(src: HTMLCanvasElement, yMm: number, heightMm: number): string {
        const yPx   = Math.round(yMm * rPxPerMm * 2)
        const hPx   = Math.round(Math.min(heightMm * rPxPerMm * 2, src.height - yPx))
        const c     = document.createElement('canvas')
        c.width     = src.width
        c.height    = Math.max(hPx, 1)
        const ctx   = c.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, c.width, c.height)
        ctx.drawImage(src, 0, yPx, src.width, hPx, 0, 0, src.width, hPx)
        return c.toDataURL('image/jpeg', 0.92)
      }

      // ── 5. Page 1: header + first report slice ───────────────────────
      pdf.addImage(hCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', PAD, PAD, cW, hMmH)

      const gapMm          = 8
      const firstSliceMm   = cH - hMmH - gapMm
      let   reportYMm      = 0

      if (firstSliceMm > 15 && rMmH > 0) {
        const actualFirstMm = Math.min(firstSliceMm, rMmH)
        pdf.addImage(sliceCanvas(rCanvas, 0, actualFirstMm), 'JPEG', PAD, PAD + hMmH + gapMm, cW, actualFirstMm)
        reportYMm = actualFirstMm
      }

      // ── 6. Remaining pages ───────────────────────────────────────────
      while (reportYMm < rMmH) {
        pdf.addPage()
        const pageH = Math.min(cH, rMmH - reportYMm)
        pdf.addImage(sliceCanvas(rCanvas, reportYMm, pageH), 'JPEG', PAD, PAD, cW, pageH)
        reportYMm += pageH
      }

      pdf.save(`GBP-Report-${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      setExp(false)
    }
  }

  // ── No site selected ──────────────────────────────────────────────────────
  if (!selectedGscSite) {
    return (
      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark px-8 py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#4285F4]/10 border border-[#4285F4]/20">
          <svg className="h-7 w-7 text-[#4285F4]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-black dark:text-[#E2E5E9] mb-1">
          Select a client to generate the report
        </h3>
        <p className="text-sm text-body dark:text-bodydark max-w-xs mx-auto">
          Use the GSC selector above to choose a client — their Google Business Profile data will appear here.
        </p>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark px-8 py-20 text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-stroke border-t-[#4285F4]" />
        <p className="text-sm text-body dark:text-bodydark">Loading GBP data…</p>
      </div>
    )
  }

  const d = data

  return (
    <div>
      {/* ── Sample data banner ──────────────────────────────────────────── */}
      {isSample && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/8 px-4 py-3.5">
          <svg className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Sample Data</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5 leading-relaxed">
              Google Business Profile integration is not yet connected for this client. The layout below shows a sample report — connect GBP to display real data.
            </p>
          </div>
        </div>
      )}

      {/* ── Report ─────────────────────────────────────────────────────── */}
      <div ref={reportRef} className="space-y-6">

        {/* ═══════ SECTION 1: Google Business Profile ═══════════════════ */}
        <SectionHeader
          color="#4285F4"
          title="Google Business Profile"
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          }
        />

        {/* Business Profile Interactions */}
        <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="px-6 pt-6 pb-1">
            <p className="text-4xl font-bold text-black dark:text-[#E2E5E9] tabular-nums">
              {d.interactions.total.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-body dark:text-bodydark">Business Profile interactions</p>
          </div>
          <ReactApexChart
            options={areaOpts(d.interactions.labels, '#4285F4', isDark)}
            series={[{ name: 'Interactions', data: d.interactions.values }]}
            type="area"
            height={220}
          />
        </div>

        {/* People Viewed + Searches */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
            <div className="flex items-start gap-2 mb-4">
              <svg className="h-5 w-5 text-body dark:text-bodydark mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <p className="text-3xl font-bold text-black dark:text-[#E2E5E9] tabular-nums">
                  {d.profileViews.total.toLocaleString()}
                </p>
                <p className="text-sm text-body dark:text-bodydark leading-snug">
                  People viewed your Business Profile
                </p>
              </div>
            </div>
            <p className="text-xs font-semibold text-black dark:text-[#E2E5E9] mb-0.5">Platform and device breakdown</p>
            <p className="text-[11px] text-body dark:text-bodydark mb-4 leading-relaxed">
              Platform and devices that people used to find your profile
            </p>
            <div className="flex items-center gap-4">
              <div className="shrink-0" style={{ width: 120, height: 120 }}>
                <ReactApexChart
                  options={donutOpts(d.profileViews.breakdown, isDark)}
                  series={d.profileViews.breakdown.map(v => v.value)}
                  type="donut"
                  width={120}
                  height={120}
                />
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                {d.profileViews.breakdown.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-body dark:text-bodydark truncate">{item.label}</span>
                    </div>
                    <span className="font-medium text-black dark:text-[#E2E5E9] shrink-0">
                      {item.value.toLocaleString()} · {item.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
            <div className="flex items-start gap-2 mb-4">
              <svg className="h-5 w-5 text-body dark:text-bodydark mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <div>
                <p className="text-3xl font-bold text-black dark:text-[#E2E5E9] tabular-nums">
                  {d.searches.total}
                </p>
                <p className="text-sm text-body dark:text-bodydark leading-snug">
                  Searches showed your Business Profile in the search results
                </p>
              </div>
            </div>
            <p className="text-xs font-semibold text-black dark:text-[#E2E5E9] mb-0.5">Searches breakdown</p>
            <p className="text-[11px] text-body dark:text-bodydark mb-4 leading-relaxed">
              Search terms that showed your Business Profile in the search results
            </p>
            <div>
              {d.searches.keywords.map((kw, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-stroke/50 dark:border-strokedark/50 last:border-0 text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] text-black/40 dark:text-[#E2E5E9]/40 w-4 shrink-0">{i + 1}.</span>
                    <span className="text-body dark:text-bodydark truncate">{kw.term}</span>
                  </div>
                  <span className="font-medium text-black dark:text-[#E2E5E9] shrink-0">{kw.count}</span>
                </div>
              ))}
            </div>
            <button className="mt-3 text-xs text-[#4285F4] hover:underline">See more</button>
          </div>
        </div>

        {/* Posts */}
        <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
            <h3 className="font-semibold text-black dark:text-[#E2E5E9]">Posts</h3>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">Recent Google Business Profile posts</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
            {d.posts.map((post, i) => (
              <div key={i} className="rounded-lg border border-stroke dark:border-strokedark p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full bg-[#1A72D9]/15 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-[#1A72D9]">AC</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-black dark:text-[#E2E5E9]">A/C Now</p>
                    <p className="text-[10px] text-body dark:text-bodydark">{post.date}</p>
                  </div>
                </div>
                <p className="text-xs text-body dark:text-bodydark leading-relaxed whitespace-pre-line line-clamp-5">
                  {post.content}
                </p>
                {post.hashtags && (
                  <p className="mt-2 text-[10px] text-[#4285F4]">{post.hashtags}</p>
                )}
                <p className="mt-2 text-xs font-medium text-[#4285F4] cursor-pointer hover:underline">{post.cta}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════ SECTION 2: Google Analytics ══════════════════════════ */}
        <SectionHeader
          color="#34A853"
          title="Google Analytics"
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          }
        />

        {/* GA4 Summary */}
        <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
            <h3 className="font-semibold text-black dark:text-[#E2E5E9]">Summary</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-stroke dark:divide-strokedark border-b border-stroke dark:border-strokedark">
            {d.ga4Summary.metrics.map((m, i) => (
              <div key={i} className="px-6 py-5">
                <p className="text-xs text-body dark:text-bodydark">{m.label}</p>
                <p className="mt-1 text-2xl font-bold text-black dark:text-[#E2E5E9] tabular-nums">{m.value}</p>
                <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-emerald-500">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                  </svg>
                  {m.delta}%
                </span>
              </div>
            ))}
          </div>
          <div className="px-2 py-4">
            <ReactApexChart
              options={summaryLineOpts(d.ga4Summary.labels, isDark)}
              series={[
                { name: 'Last 90 days',    data: d.ga4Summary.last90 },
                { name: 'Preceding period', data: d.ga4Summary.preceding },
              ]}
              type="line"
              height={220}
            />
          </div>
        </div>

        {/* Event count by Event name */}
        <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="flex items-center justify-between border-b border-stroke px-6 py-4 dark:border-strokedark">
            <h3 className="font-semibold text-black dark:text-[#E2E5E9]">Event count by Event name over time</h3>
            <span className="shrink-0 ml-3 rounded border border-stroke dark:border-strokedark px-2 py-1 text-xs text-body dark:text-bodydark">Month</span>
          </div>
          <div className="px-2 py-4">
            <ReactApexChart
              options={multiLineOpts(d.eventsByName.labels, isDark)}
              series={d.eventsByName.series}
              type="line"
              height={280}
            />
          </div>
        </div>

        {/* Leads Overview */}
        <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
            <h3 className="font-semibold text-black dark:text-[#E2E5E9]">Leads overview</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-stroke dark:divide-strokedark border-b border-stroke dark:border-strokedark">
            {[
              { label: 'New users',       value: d.leadsOverview.newUsers,       active: true  },
              { label: 'Returning users', value: d.leadsOverview.returningUsers, active: false },
              { label: 'Qualified leads', value: d.leadsOverview.qualifiedLeads, active: false },
              { label: 'Converted',       value: d.leadsOverview.converted,      active: false },
            ].map((m, i) => (
              <div key={i} className={`px-6 py-4 ${m.active ? 'border-t-2 border-t-[#4285F4]' : ''}`}>
                <p className={`text-xs font-medium ${m.active ? 'text-[#4285F4]' : 'text-body dark:text-bodydark'}`}>{m.label}</p>
                <p className="mt-1 text-2xl font-bold text-black dark:text-[#E2E5E9] tabular-nums">{m.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="px-2 py-4">
            <ReactApexChart
              options={areaOpts(d.leadsOverview.labels, '#4285F4', isDark)}
              series={[{ name: 'New users', data: d.leadsOverview.values }]}
              type="area"
              height={220}
            />
          </div>
        </div>

        {/* Users by channel */}
        <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="flex items-center justify-between border-b border-stroke px-6 py-4 dark:border-strokedark">
            <h3 className="font-semibold text-black dark:text-[#E2E5E9]">
              Total users by First user primary channel (Default Channel Group) over time
            </h3>
            <span className="shrink-0 ml-3 rounded border border-stroke dark:border-strokedark px-2 py-1 text-xs text-body dark:text-bodydark">Month</span>
          </div>
          <div className="px-2 py-4">
            <ReactApexChart
              options={multiLineOpts(d.usersByChannel.labels, isDark)}
              series={d.usersByChannel.series}
              type="line"
              height={280}
            />
          </div>
        </div>

        {/* ═══════ SECTION 3: Google Search Console ═════════════════════ */}
        <SectionHeader
          color="#F47C20"
          title="Google Search Console"
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          }
        />

        <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-stroke dark:divide-strokedark border-b border-stroke dark:border-strokedark">
            {[
              { label: 'Total clicks',      value: d.gsc.clicks,      bg: '',               fg: '' },
              { label: 'Total impressions', value: d.gsc.impressions, bg: 'bg-[#7C3AED]',   fg: 'text-white' },
              { label: 'Average CTR',       value: d.gsc.ctr,         bg: '',               fg: '' },
              { label: 'Average position',  value: d.gsc.position,    bg: 'bg-[#F47C20]',   fg: 'text-white' },
            ].map((m, i) => (
              <div key={i} className={`px-6 py-5 ${m.bg}`}>
                <p className={`text-xs ${m.fg || 'text-body dark:text-bodydark'}`}>{m.label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${m.fg || 'text-black dark:text-[#E2E5E9]'}`}>{m.value}</p>
              </div>
            ))}
          </div>
          <div className="px-2 py-4">
            <ReactApexChart
              options={gscOpts(d.gsc.labels, isDark)}
              series={[
                { name: 'Impressions', data: d.gsc.impressionSeries },
                { name: 'Position',    data: d.gsc.positionSeries },
              ]}
              type="line"
              height={260}
            />
          </div>
        </div>


      </div>
    </div>
  )
})
