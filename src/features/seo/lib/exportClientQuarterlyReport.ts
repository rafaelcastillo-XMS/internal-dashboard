import type { jsPDF as JsPDF } from 'jspdf'
import {
  BLUE, BLUE_DARK, CYAN, INK, MUTED, LIGHT,
  clean, formatPeriod, heading, paragraph, metricCard, drawLineChart, addImageContained, imageToDataUrl,
} from './exportQuarterlySeoReport'

type Pdf = JsPDF

// ─── Data shapes (mirrors /api/seo/quarterly-report + Supabase extras) ────────

export interface QuarterlyReportTotals {
  clicks: string; impressions: string; ctr: string; position: string
  prevClicks: string; prevImpressions: string
  clicksDelta: number; impressionsDelta: number; positionDelta: number
  labels: string[]; series: number[]
}
export interface QuarterlyReportKeyword { term: string; clicks: number; position: number; prevPosition: number | null; isNew: boolean }
export interface QuarterlyReportPage { page: string; clicks: number; prevClicks: number; delta: number }
export interface QuarterlyReportDevice { device: string; clicks: number; pct: number }
export interface QuarterlyReportCountry { country: string; clicks: number; impressions: number }

export interface QuarterlyReportData {
  period: { startDate: string; endDate: string }
  domain: string
  totals: QuarterlyReportTotals
  keywords: { top: QuarterlyReportKeyword[]; newTerms: string[]; newCount: number }
  pages: { top: QuarterlyReportPage[]; gainers: QuarterlyReportPage[]; losers: QuarterlyReportPage[] }
  devices: QuarterlyReportDevice[]
  countries: QuarterlyReportCountry[]
  conversions: { current: number; previous: number; delta: number } | null
  users: { current: number; previous: number; delta: number } | null
}

export interface AhrefsSnapshot {
  snapshot_date: string | null
  domain_rating: number | null
  organic_traffic: number | null
  organic_keywords: number | null
  backlinks: number | null
  referring_domains: number | null
}

export interface OnPageAuditSummary {
  status: string
  landing_page_url: string
  created_at: string
}

interface ClientQuarterlyReportOptions {
  data: QuarterlyReportData
  clientName: string
  reportTitle?: string
  psiScore?: number | null
  ahrefsSnapshots?: AhrefsSnapshot[]
  onPageAudit?: OnPageAuditSummary | null
  clientLogoUrl?: string
  xmsLogoUrl?: string
}

// ─── Small local helpers ───────────────────────────────────────────────────────

function pageChrome(pdf: Pdf, period: string, pageNumber: number) {
  const w = pdf.internal.pageSize.getWidth()
  const h = pdf.internal.pageSize.getHeight()

  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, w, h, 'F')
  pdf.setFillColor(...BLUE_DARK)
  pdf.rect(0, 0, w, 15, 'F')
  pdf.setFillColor(...CYAN)
  pdf.rect(0, 8, w, 7, 'F')
  pdf.setFillColor(255, 255, 255)
  pdf.ellipse(w / 2, 22, w * 0.6, 12, 'F')

  pdf.setFillColor(...BLUE_DARK)
  pdf.rect(0, h - 15, w, 15, 'F')
  pdf.setFillColor(...CYAN)
  pdf.rect(0, h - 15, w, 8, 'F')
  pdf.setFillColor(255, 255, 255)
  pdf.ellipse(w / 2, h - 22, w * 0.62, 11, 'F')

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.setTextColor(...INK)
  pdf.text('SEO Quarterly Report', 21, 25)
  pdf.setDrawColor(...BLUE)
  pdf.line(63, 21.5, 63, 26)
  pdf.text(clean(period), 68, 25)

  pdf.setFontSize(7.5)
  pdf.setTextColor(255, 255, 255)
  pdf.text('www.xperiencemarketingsolutions.com', 8, h - 4.5)
  pdf.text(String(pageNumber), w - 10, h - 4.5, { align: 'right' })
}

function deltaColor(delta: number): [number, number, number] {
  return delta >= 0 ? [52, 168, 83] : [218, 68, 83]
}

function deltaLabel(delta: number, unit = '%') {
  const arrow = delta >= 0 ? '+' : ''
  return `${arrow}${delta}${unit} vs. previous quarter`
}

function infoBox(pdf: Pdf, y: number, text: string) {
  pdf.setFillColor(...LIGHT)
  pdf.roundedRect(21, y, 168, 26, 4, 4, 'F')
  paragraph(pdf, text, y + 11, 156, 10)
  return y + 34
}

function twoColBars(pdf: Pdf, y: number, rows: { label: string; value: string; pct: number }[], accent: [number, number, number] = BLUE) {
  let rowY = y
  rows.forEach((row) => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...INK)
    pdf.text(clean(row.label), 21, rowY)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...MUTED)
    pdf.text(clean(row.value), 189, rowY, { align: 'right' })
    pdf.setFillColor(232, 238, 245)
    pdf.roundedRect(21, rowY + 3, 168, 4.5, 2, 2, 'F')
    pdf.setFillColor(...accent)
    pdf.roundedRect(21, rowY + 3, Math.max(3, 168 * row.pct / 100), 4.5, 2, 2, 'F')
    rowY += 15
  })
  return rowY
}

// ─── Builder ────────────────────────────────────────────────────────────────

export function buildClientQuarterlyPdf(
  options: ClientQuarterlyReportOptions,
  PdfConstructor: typeof JsPDF,
  assets: { clientLogo?: string; xmsLogo?: string } = {},
) {
  const { data, clientName, ahrefsSnapshots = [], onPageAudit, psiScore } = options
  const period = formatPeriod(data.period.startDate, data.period.endDate)
  const pdf = new PdfConstructor({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const w = pdf.internal.pageSize.getWidth()
  const h = pdf.internal.pageSize.getHeight()
  let pageNumber = 1

  const addBodyPage = (title: string) => {
    pdf.addPage()
    pageNumber += 1
    pageChrome(pdf, period, pageNumber)
    return heading(pdf, title)
  }

  // ═══ Cover ═══
  pdf.setFillColor(...BLUE_DARK)
  pdf.rect(0, 0, w, h, 'F')
  pdf.setFillColor(...BLUE)
  pdf.circle(w * 0.18, h * 0.25, 75, 'F')
  pdf.setFillColor(...CYAN)
  pdf.circle(w * 0.78, h * 0.83, 92, 'F')
  pdf.setFillColor(18, 91, 165)
  for (let i = 0; i < 7; i++) pdf.circle(24 + i * 29, 92 + (i % 2) * 17, 15 + i * 2, 'F')

  addImageContained(pdf, assets.xmsLogo, 56, 252, 98, 25)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(12)
  pdf.text(clean(period.toUpperCase()), w / 2, 23, { align: 'center' })
  pdf.setFontSize(30)
  pdf.text('QUARTERLY REPORT', w / 2, 85, { align: 'center' })
  pdf.setFontSize(20)
  pdf.text('SEO PERFORMANCE', w / 2, 99, { align: 'center' })

  pdf.setFillColor(255, 255, 255)
  pdf.circle(w / 2, 143, 30, 'F')
  if (!addImageContained(pdf, assets.clientLogo, w / 2 - 24, 119, 48, 48)) {
    pdf.setTextColor(...BLUE_DARK)
    pdf.setFontSize(24)
    pdf.text(clientName.split(/\s+/).map((word) => word[0]).join('').slice(0, 3).toUpperCase(), w / 2, 149, { align: 'center' })
  }
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(18)
  pdf.text(clean(clientName.toUpperCase()), w / 2, 190, { align: 'center', maxWidth: 175 })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(clean(data.domain), w / 2, 201, { align: 'center' })

  // ═══ Purpose / intro ═══
  let y = addBodyPage('About This Report')
  y = paragraph(pdf, `This report summarizes the search engine optimization (SEO) work completed for ${clientName} during the period below. Our goal is to show you, clearly and without technical jargon, how your website's visibility on Google evolved and what concrete results the team's work delivered.`, y + 5)
  y = paragraph(pdf, 'Below you will find the traffic generated, the keywords driving your business, how your pages performed, and the overall technical health of your site.', y + 8)
  pdf.setFillColor(...LIGHT)
  pdf.roundedRect(21, y + 9, 168, 34, 4, 4, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(...BLUE_DARK)
  pdf.text('REPORTING PERIOD', 29, y + 22)
  pdf.setFontSize(15)
  pdf.text(clean(period), 29, y + 33)

  // ═══ Executive summary ═══
  const t = data.totals
  const clicksTrend = t.clicksDelta >= 0 ? `an increase of ${t.clicksDelta}%` : `a decrease of ${Math.abs(t.clicksDelta)}%`
  const posTrend = t.positionDelta > 0 ? `improved by ${t.positionDelta} positions on average`
    : t.positionDelta < 0 ? `dropped by ${Math.abs(t.positionDelta)} positions on average` : 'held steady'
  y = addBodyPage('Quarterly Executive Summary')
  y = paragraph(pdf, `During ${period}, ${clientName}'s website earned ${t.clicks} organic clicks from Google, ${clicksTrend} compared to the previous quarter (${t.prevClicks}). The average position in search results ${posTrend}.${data.keywords.newCount > 0 ? ` ${data.keywords.newCount} new keywords began ranking during this period.` : ''}`, y + 5, 168, 11.5)
  metricCard(pdf, 21, y + 10, 51, 'Organic clicks', t.clicks, deltaColor(t.clicksDelta))
  metricCard(pdf, 79.5, y + 10, 51, 'Impressions', t.impressions, deltaColor(t.impressionsDelta))
  metricCard(pdf, 138, y + 10, 51, 'Average position', t.position, deltaColor(t.positionDelta))
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...MUTED)
  pdf.text(clean(deltaLabel(t.clicksDelta)), 21, y + 43)
  pdf.text(clean(deltaLabel(t.impressionsDelta)), 79.5, y + 43)
  pdf.text(clean(t.positionDelta === 0 ? 'No change' : `${t.positionDelta > 0 ? 'Improved' : 'Dropped'} by ${Math.abs(t.positionDelta)} positions`), 138, y + 43)

  // ═══ Organic traffic ═══
  y = addBodyPage('Organic Traffic & Visibility')
  y = paragraph(pdf, 'Organic traffic is the visits your site receives directly from Google search results, with no paid advertising. Impressions show how many times your site appeared to someone searching for something related to your business.', y + 3)
  drawLineChart(pdf, t.series, t.labels, 21, y + 8, 168, 78, BLUE)
  y = paragraph(pdf, `The average click-through rate (CTR) was ${t.ctr} during this quarter.`, y + 92)

  // ═══ Conversions (only if GA4 connected) ═══
  if (data.conversions) {
    const c = data.conversions
    y = addBodyPage('Conversions Generated from SEO')
    y = paragraph(pdf, 'Conversions represent valuable actions completed by visitors who arrived from an organic Google search: for example, a submitted form, a call initiated, or a purchase made.', y + 3)
    metricCard(pdf, 21, y + 10, 82, 'Conversions from SEO', String(c.current), deltaColor(c.delta))
    metricCard(pdf, 107, y + 10, 82, 'Previous quarter', String(c.previous))
    y = paragraph(pdf, deltaLabel(c.delta), y + 48, 168, 9)
  }

  // ═══ Keywords ═══
  y = addBodyPage('Top Keywords')
  y = paragraph(pdf, 'These are the searches that drove the most traffic to your site, and how their Google ranking changed compared to the previous quarter.', y + 3)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...MUTED)
  pdf.text('KEYWORD', 21, y + 10)
  pdf.text('CLICKS', 145, y + 10, { align: 'right' })
  pdf.text('POSITION', 189, y + 10, { align: 'right' })
  pdf.setDrawColor(220, 228, 238)
  pdf.line(21, y + 12.5, 189, y + 12.5)
  let rowY = y + 20
  data.keywords.top.slice(0, 10).forEach((kw) => {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(...INK)
    pdf.text(pdf.splitTextToSize(clean(kw.term), 110)[0], 21, rowY)
    pdf.text(String(kw.clicks), 145, rowY, { align: 'right' })
    const change = kw.isNew ? 'NEW' : kw.prevPosition == null ? '—' : kw.position < kw.prevPosition ? `+${(kw.prevPosition - kw.position).toFixed(1)}` : kw.position > kw.prevPosition ? `-${(kw.position - kw.prevPosition).toFixed(1)}` : '='
    const color = kw.isNew || (kw.prevPosition != null && kw.position < kw.prevPosition) ? [52, 168, 83] : kw.prevPosition != null && kw.position > kw.prevPosition ? [218, 68, 83] : MUTED
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(color[0], color[1], color[2])
    pdf.text(`${kw.position.toFixed(1)} (${change})`, 189, rowY, { align: 'right' })
    rowY += 9
  })
  if (data.keywords.newTerms.length > 0) {
    y = rowY + 6
    pdf.setFillColor(...LIGHT)
    pdf.roundedRect(21, y, 168, 8 + Math.ceil(data.keywords.newTerms.length / 2) * 6, 4, 4, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...BLUE_DARK)
    pdf.text(`New keywords that started ranking (${data.keywords.newCount}):`, 27, y + 8)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...INK)
    pdf.text(pdf.splitTextToSize(clean(data.keywords.newTerms.join('  ·  ')), 156), 27, y + 15)
  }

  // ═══ Pages ═══
  y = addBodyPage('Top-Performing Pages')
  y = paragraph(pdf, 'The pages on your site that received the most organic visits, and which ones gained or lost traffic compared to the previous quarter.', y + 3)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...MUTED)
  pdf.text('PAGE', 21, y + 10)
  pdf.text('CLICKS', 189, y + 10, { align: 'right' })
  pdf.line(21, y + 12.5, 189, y + 12.5)
  rowY = y + 20
  data.pages.top.slice(0, 6).forEach((p) => {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(...INK)
    pdf.text(pdf.splitTextToSize(clean(p.page || '/'), 130)[0], 21, rowY)
    pdf.text(String(p.clicks), 189, rowY, { align: 'right' })
    rowY += 9
  })
  y = rowY + 8
  const half = 82
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(52, 168, 83)
  pdf.text('▲ Gained traffic', 21, y)
  pdf.setTextColor(218, 68, 83)
  pdf.text('▼ Lost traffic', 21 + half + 6, y)
  const gainRows = data.pages.gainers.slice(0, 4)
  const loseRows = data.pages.losers.slice(0, 4)
  for (let i = 0; i < Math.max(gainRows.length, loseRows.length); i++) {
    const rowY2 = y + 8 + i * 8
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    if (gainRows[i]) {
      pdf.setTextColor(...INK)
      pdf.text(pdf.splitTextToSize(clean(gainRows[i].page || '/'), 60)[0], 21, rowY2)
      pdf.setTextColor(52, 168, 83)
      pdf.text(`+${gainRows[i].delta}`, 21 + half - 4, rowY2, { align: 'right' })
    }
    if (loseRows[i]) {
      pdf.setTextColor(...INK)
      pdf.text(pdf.splitTextToSize(clean(loseRows[i].page || '/'), 60)[0], 21 + half + 6, rowY2)
      pdf.setTextColor(218, 68, 83)
      pdf.text(`${loseRows[i].delta}`, 189, rowY2, { align: 'right' })
    }
  }

  // ═══ Device + Country ═══
  y = addBodyPage('Performance by Device & Location')
  y = paragraph(pdf, 'How your organic visits break down by the type of device your visitors used.', y + 3)
  y = twoColBars(pdf, y + 10, data.devices.map((d) => ({
    label: d.device.charAt(0) + d.device.slice(1).toLowerCase(),
    value: `${d.clicks} clicks · ${d.pct}%`,
    pct: d.pct,
  })))
  y = paragraph(pdf, 'Top countries your organic visitors came from.', y + 8)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...MUTED)
  pdf.text('COUNTRY', 21, y + 10)
  pdf.text('CLICKS', 145, y + 10, { align: 'right' })
  pdf.text('IMPRESSIONS', 189, y + 10, { align: 'right' })
  pdf.line(21, y + 12.5, 189, y + 12.5)
  rowY = y + 20
  data.countries.slice(0, 5).forEach((c) => {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(...INK)
    pdf.text(clean(c.country), 21, rowY)
    pdf.text(String(c.clicks), 145, rowY, { align: 'right' })
    pdf.text(String(c.impressions), 189, rowY, { align: 'right' })
    rowY += 9
  })

  // ═══ Backlinks / authority ═══
  y = addBodyPage('Domain Authority & Backlinks')
  y = paragraph(pdf, 'Backlinks are links from other websites pointing to yours. The more quality sites that link to your page, the more authority your domain earns with Google, which helps you rank better over time.', y + 3)
  const [latestSnap, prevSnap] = ahrefsSnapshots
  if (latestSnap) {
    const drDelta = prevSnap?.domain_rating != null && latestSnap.domain_rating != null ? Math.round((latestSnap.domain_rating - prevSnap.domain_rating) * 10) / 10 : null
    const blDelta = prevSnap?.backlinks != null && latestSnap.backlinks != null ? latestSnap.backlinks - prevSnap.backlinks : null
    metricCard(pdf, 21, y + 10, 82, 'Domain Rating (Ahrefs)', String(latestSnap.domain_rating ?? '—'), drDelta != null ? deltaColor(drDelta) : BLUE)
    metricCard(pdf, 107, y + 10, 82, 'Total backlinks', String(latestSnap.backlinks ?? '—'), blDelta != null ? deltaColor(blDelta) : BLUE)
    metricCard(pdf, 21, y + 41, 82, 'Referring domains', String(latestSnap.referring_domains ?? '—'))
    metricCard(pdf, 107, y + 41, 82, 'Organic keywords (Ahrefs)', String(latestSnap.organic_keywords ?? '—'))
    if (drDelta != null) paragraph(pdf, `Domain Rating: ${deltaLabel(drDelta, ' pts')}`, y + 78, 168, 9)
  } else {
    infoBox(pdf, y + 8, 'No domain authority (Ahrefs) snapshot has been recorded for this client yet. This section will populate automatically in future reports.')
  }

  // ═══ Core Web Vitals ═══
  y = addBodyPage('Site Speed & Experience')
  y = paragraph(pdf, 'Google measures how fast and stable a website is for its visitors, especially on mobile devices. A good score improves the user experience and helps with search rankings.', y + 3)
  if (typeof psiScore === 'number') {
    const label = psiScore >= 90 ? 'Excellent' : psiScore >= 50 ? 'Needs improvement' : 'Poor performance'
    metricCard(pdf, 21, y + 10, 82, 'Mobile speed score', `${psiScore} / 100`, psiScore >= 90 ? [52, 168, 83] : psiScore >= 50 ? [244, 124, 32] : [218, 68, 83])
    paragraph(pdf, `Diagnosis: ${label}.`, y + 45, 168, 10)
  } else {
    infoBox(pdf, y + 8, 'The site speed score could not be calculated for this period. It will be included in the next report.')
  }

  // ═══ Technical status (on-page audit) ═══
  y = addBodyPage('Technical Site Status')
  y = paragraph(pdf, 'Summary of the latest on-page technical audit performed on the site, which reviews aspects such as structure, metadata and crawl errors.', y + 3)
  if (onPageAudit) {
    const statusLabel = onPageAudit.status === 'completed' ? 'Audit completed' : onPageAudit.status === 'error' ? 'Audit had errors' : 'Audit in progress'
    const statusColor: [number, number, number] = onPageAudit.status === 'completed' ? [52, 168, 83] : onPageAudit.status === 'error' ? [218, 68, 83] : [244, 124, 32]
    const dateLabel = new Date(onPageAudit.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    metricCard(pdf, 21, y + 10, 82, 'Audit status', statusLabel, statusColor)
    metricCard(pdf, 107, y + 10, 82, 'Run date', dateLabel)
    paragraph(pdf, `Page audited: ${onPageAudit.landing_page_url}`, y + 48, 168, 9)
  } else {
    infoBox(pdf, y + 8, 'No on-page technical audit has been run for this client yet.')
  }

  // ═══ Google Business Profile — placeholder ═══
  y = addBodyPage('Google Business Profile')
  y = paragraph(pdf, 'Your Google Business Profile is the information that appears on Google Maps and in local search results: reviews, hours, calls and direction requests.', y + 3)
  pdf.setFillColor(...LIGHT)
  pdf.roundedRect(21, y + 9, 168, 40, 4, 4, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(...BLUE_DARK)
  pdf.text('COMING SOON TO THIS REPORT', 29, y + 22)
  paragraph(pdf, "We're integrating your Google Business Profile data (interactions, calls, views and posts). Once the connection is active, this section will include those results automatically.", y + 30, 152, 9.5)

  // ═══ Closing ═══
  pdf.addPage()
  pageNumber += 1
  pdf.setFillColor(...BLUE_DARK)
  pdf.rect(0, 0, w, h, 'F')
  pdf.setFillColor(...BLUE)
  pdf.circle(28, 45, 75, 'F')
  pdf.setFillColor(...CYAN)
  pdf.circle(w - 10, h - 35, 95, 'F')
  addImageContained(pdf, assets.xmsLogo, 52, 19, 106, 28)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(29)
  pdf.setTextColor(255, 255, 255)
  pdf.text(['THANK YOU FOR', 'YOUR BUSINESS!'], w / 2, 123, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(14)
  pdf.text('We look forward to continuing to grow your business.', w / 2, 155, { align: 'center' })
  pdf.setFontSize(11)
  pdf.text(['If you have any questions about this report or would like', 'to schedule a call, please reach out anytime.'], w / 2, 205, { align: 'center' })
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('(772) 905-3005', w / 2, 238, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text('www.xperiencemarketingsolutions.com', w / 2, 254, { align: 'center' })
  pdf.text('info@xperienceusa.com', w / 2, 263, { align: 'center' })

  pdf.setProperties({
    title: `${clientName} - SEO Quarterly Report - ${period}`,
    subject: 'Quarterly SEO performance report',
    author: 'Xperience Marketing Solutions',
  })
  return pdf
}

export async function buildClientQuarterlyReportBlob(options: ClientQuarterlyReportOptions) {
  const { jsPDF } = await import('jspdf')
  const [clientLogo, xmsLogo] = await Promise.all([
    imageToDataUrl(options.clientLogoUrl),
    imageToDataUrl(options.xmsLogoUrl ?? '/XMS LOGO - BLACK BACKGROUND.png'),
  ])
  const pdf = buildClientQuarterlyPdf(options, jsPDF, { clientLogo, xmsLogo })
  return pdf.output('blob') as Blob
}
