import type { jsPDF as JsPDF } from 'jspdf'
import { clean, formatPeriod, addImageContained, imageToDataUrl } from './exportQuarterlySeoReport'
import { describeClicksTrend, describePositionTrend, getAuditStatusLabel, getSiteSpeedLabel } from './quarterlyReportNarrative'
import { QuarterlyReportLayout, REPORT, type ReportFonts } from './quarterlyReportDesign'
import { loadQuarterlyReportFonts } from './quarterlyReportFonts'
import { MAX_GBP_IMAGES } from './quarterlyReportConfig'
import coverPhotoUrl from '../assets/quarterly-cover.jpg?url'

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
export interface OnPageAuditSummary { status: string; landing_page_url: string; created_at: string }
interface ClientQuarterlyReportOptions {
  data: QuarterlyReportData
  clientName: string
  reportTitle?: string
  psiScore?: number | null
  ahrefsSnapshots?: AhrefsSnapshot[]
  onPageAudit?: OnPageAuditSummary | null
  clientLogoUrl?: string
  xmsLogoUrl?: string
  gbpImageUrl?: string
  gbpImageUrls?: string[]
}
interface ReportAssets { clientLogo?: string; xmsLogo?: string; xmsCoverLogo?: string; coverPhoto?: string; gbpImage?: string; gbpImages?: string[]; fonts?: ReportFonts }

function deltaColor(delta: number) { return delta >= 0 ? REPORT.teal : REPORT.amber }
function deltaLabel(delta: number, unit = '%') { return `${delta > 0 ? '+' : ''}${delta}${unit} vs. previous quarter` }

function brand(layout: QuarterlyReportLayout, logo?: string) {
  layout.pdf.setFillColor(...REPORT.white)
  layout.pdf.rect(0, 0, 210, 37, 'F')
  if (!addImageContained(layout.pdf, logo, 22, 7, 73, 23)) {
    layout.text('XMS', 22, 23, 50, 19, REPORT.brandBlue, 'bold')
    layout.text('Xperience Marketing Solutions', 48, 22, 130, 9, REPORT.brandBlue)
  }
  layout.label('QUARTERLY / SEO', 148, 22, REPORT.brandBlue)
}

function cover(layout: QuarterlyReportLayout, options: ClientQuarterlyReportOptions, assets: ReportAssets) {
  const { pdf } = layout
  pdf.setFillColor(...REPORT.brandBlue)
  pdf.rect(0, 0, 210, 297, 'F')
  if (assets.coverPhoto) {
    pdf.saveGraphicsState()
    try {
      const dimensions = pdf.getImageProperties(assets.coverPhoto)
      const scale = Math.max(210 / dimensions.width, 297 / dimensions.height)
      const width = dimensions.width * scale
      const height = dimensions.height * scale
      pdf.addImage(assets.coverPhoto, dimensions.fileType, (210 - width) / 2, (297 - height) / 2, width, height)
    } catch {
      // A missing or unreadable decorative photo leaves the solid brand-blue cover.
    }
    pdf.setGState(pdf.GState({ opacity: 0.86 }))
    pdf.setFillColor(...REPORT.brandBlue)
    pdf.rect(0, 0, 210, 297, 'F')
    pdf.restoreGraphicsState()
  }

  pdf.setFont(layout.sans, 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(...REPORT.white)
  pdf.text(clean(layout.period.replace(' to ', ' - ').toUpperCase()), 188, 25, { align: 'right' })
  pdf.setFontSize(38)
  pdf.text('ORGANIC SEO', 105, 87, { align: 'center' })
  pdf.setFontSize(24)
  pdf.text('REPORT', 105, 101, { align: 'center' })

  pdf.setFillColor(...REPORT.white)
  pdf.circle(105, 149, 27, 'F')
  if (!addImageContained(pdf, assets.clientLogo, 87, 131, 36, 36)) {
    const initials = options.clientName.split(/\s+/).map(word => word[0]).join('').slice(0, 3).toUpperCase()
    pdf.setTextColor(...REPORT.brandBlue)
    pdf.setFontSize(25)
    pdf.text(clean(initials), 105, 152, { align: 'center' })
  }

  let nameSize = 24
  const name = clean(options.clientName.toUpperCase())
  while (nameSize > 10) {
    pdf.setFontSize(nameSize)
    if (pdf.splitTextToSize(name, 166).length <= 2) break
    nameSize -= 1
  }
  pdf.setTextColor(...REPORT.white)
  pdf.setLineHeightFactor(1.2)
  pdf.text(pdf.splitTextToSize(name, 166), 105, 205, { align: 'center' })
  pdf.setFont(layout.sans, 'normal')
  pdf.setFontSize(9)
  pdf.text(clean(options.data.domain), 105, 229, { align: 'center', maxWidth: 166 })
  if (!addImageContained(pdf, assets.xmsCoverLogo, 61, 257, 88, 27)) {
    pdf.setFont(layout.sans, 'bold')
    pdf.setFontSize(12)
    pdf.text('XPERIENCE', 105, 269, { align: 'center' })
    pdf.setFont(layout.sans, 'normal')
    pdf.setFontSize(8)
    pdf.text('Marketing Solutions', 105, 277, { align: 'center' })
  }
}

export function buildClientQuarterlyPdf(options: ClientQuarterlyReportOptions, PdfConstructor: typeof JsPDF, assets: ReportAssets = {}) {
  const { data, clientName, ahrefsSnapshots = [], onPageAudit, psiScore } = options
  const period = formatPeriod(data.period.startDate, data.period.endDate)
  const pdf = new PdfConstructor({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const layout = new QuarterlyReportLayout(pdf, period, clientName, assets.fonts)
  const t = data.totals
  cover(layout, options, assets)

  let y = layout.page('About this report', '01 / THE OVERVIEW')
  y = layout.paragraph(`A quarterly perspective on search visibility for ${clientName}: how people discovered your website, which content attracted their attention, and where the next opportunities lie.`, y, 12)
  y = layout.panel('The reporting period', period, y + 5, true)
  y = layout.paragraph('Start with the executive summary for the main results, then explore the detail behind each area of performance.', y)
  y = layout.table(['IN THIS REPORT', 'WHAT IT TELLS YOU'], [
    ['Search performance', 'Visibility, organic clicks and valuable visitor actions'],
    ['Content & audience', 'Search terms, leading pages, devices and locations'],
    ['Website foundations', 'Backlinks, mobile speed and technical review status'],
    ['Local presence', 'Google Business Profile and available visual evidence'],
  ], [59, 107], y + 5)
  layout.paragraph('Comparisons use the previous reporting period. Technical scores and backlink metrics reflect the latest available measurements, which may fall outside this quarter.', y + 2, 9)

  y = layout.page('Quarterly executive summary', '01 / THE OVERVIEW')
  y = layout.paragraph(`During ${period}, your website earned ${t.clicks} organic clicks from Google, ${describeClicksTrend(t.clicksDelta)} compared with the previous quarter (${t.prevClicks}).`, y, 12)
  y = layout.metrics([
    { label: 'Organic clicks', value: t.clicks, detail: deltaLabel(t.clicksDelta), color: deltaColor(t.clicksDelta) },
    { label: 'Search impressions', value: t.impressions, detail: deltaLabel(t.impressionsDelta), color: deltaColor(t.impressionsDelta) },
    { label: 'Average position', value: t.position, detail: t.positionDelta === 0 ? 'Stable position' : `${Math.abs(t.positionDelta)} positions ${t.positionDelta > 0 ? 'improved' : 'to recover'}`, color: deltaColor(t.positionDelta) },
  ], y + 6)
  y = layout.panel('The ranking perspective', `Your average search position ${describePositionTrend(t.positionDelta)}.${data.keywords.newCount > 0 ? ` ${data.keywords.newCount} new keywords began ranking during this period.` : ''}`, y)
  layout.panel('What to focus on', 'Use the keyword and page results that follow to identify content worth strengthening. Read changes alongside lead quality and business outcomes, rather than treating visibility alone as success.', y, true)

  y = layout.page('Organic traffic & visibility', '02 / SEARCH PERFORMANCE')
  y = layout.paragraph('Impressions measure how often your website appeared in Google search results. Organic clicks measure how often someone selected your website from those results.', y)
  y = layout.chart(t.series, t.labels, y + 3)
  y = layout.metrics([
    { label: 'Average click-through rate', value: t.ctr, detail: 'Share of impressions that became clicks' },
    { label: 'Previous quarter impressions', value: t.prevImpressions, detail: 'Comparison period' },
  ], y)

  if (data.conversions) {
    const c = data.conversions
    y = layout.page('Conversions generated from SEO', '02 / SEARCH PERFORMANCE')
    y = layout.paragraph('Conversions are the valuable actions recorded for visitors who arrived from organic Google search, such as an enquiry, an initiated call or a purchase. The actions included depend on your analytics configuration.', y, 12)
    y = layout.metrics([
      { label: 'Conversions from SEO', value: String(c.current), detail: deltaLabel(c.delta), color: deltaColor(c.delta) },
      { label: 'Previous quarter', value: String(c.previous), detail: 'Recorded conversions' },
    ], y + 8)
    layout.panel('From attention to action', 'These recorded actions help connect search visibility with business interest. They are analytics events; they should not be interpreted as confirmed sales unless your tracking specifically measures sales.', y, true)
  }

  y = layout.page('Top keywords', '03 / CONTENT & AUDIENCE')
  y = layout.paragraph('The searches that brought the most organic clicks to your website. A lower position number means a higher placement in Google results.', y)
  if (data.keywords.top.length) {
    const keywords = data.keywords.top.slice(0, 10)
    y = layout.table(['SEARCH TERM', 'CLICKS', 'POSITION / CHANGE'], keywords.map(kw => {
      const change = kw.isNew ? 'NEW' : kw.prevPosition == null ? 'N/A' : kw.position < kw.prevPosition ? `+${(kw.prevPosition - kw.position).toFixed(1)}` : kw.position > kw.prevPosition ? `-${(kw.position - kw.prevPosition).toFixed(1)}` : 'Stable'
      return [kw.term, String(kw.clicks), `${kw.position.toFixed(1)} / ${change}`]
    }), [96, 24, 46], y + 3, keywords.map(kw => kw.isNew || (kw.prevPosition != null && kw.position < kw.prevPosition) ? REPORT.teal : REPORT.ink))
  } else y = layout.panel('Search term detail', 'No keyword-level results are available for this reporting period.', y)
  if (data.keywords.newTerms.length) {
    y = layout.ensure(y + 3, 25)
    y = layout.paragraph(`New keywords that started ranking (${data.keywords.newCount})`, y, 11)
    y = layout.paragraph(data.keywords.newTerms.join('  /  '), y, 9)
  }
  layout.paragraph('Positive change = improved ranking. NEW = newly present in the comparison data. N/A = no prior position available.', y, 8)

  y = layout.page('Top-performing pages', '03 / CONTENT & AUDIENCE')
  y = layout.paragraph('The pages receiving the most organic clicks, followed by the strongest gains and the pages that present an opportunity to strengthen performance.', y)
  if (data.pages.top.length) y = layout.table(['PAGE', 'ORGANIC CLICKS'], data.pages.top.slice(0, 6).map(p => [p.page || '/', String(p.clicks)]), [131, 35], y + 3)
  else y = layout.panel('Page performance', 'No page-level results are available for this reporting period.', y)
  const pageGroups = [
    { title: 'Gained traffic', rows: data.pages.gainers, color: REPORT.teal },
    { title: 'Pages to strengthen', rows: data.pages.losers, color: REPORT.amber },
  ]
  pdf.setFont(layout.sans, 'normal')
  pdf.setFontSize(9)
  const groupHeight = (rows: QuarterlyReportPage[]) => 33 + rows.slice(0, 4).reduce((height, p) => height + Math.max(10.5, pdf.splitTextToSize(clean(p.page || '/'), 52).length * 4.76 + 5), 0)
  const sideBySide = y + Math.max(...pageGroups.map(group => groupHeight(group.rows))) <= REPORT.bottom
  if (!sideBySide) {
    for (const group of pageGroups) {
      if (!group.rows.length) continue
      y = layout.ensure(y + 2, 40)
      y = layout.label(group.title, 22, y, group.color) + 4
      const rows = group.rows.slice(0, 4)
      y = layout.table(['PAGE', 'CLICK CHANGE'], rows.map(p => [p.page || '/', `${p.delta > 0 ? '+' : ''}${p.delta}`]), [131, 35], y, rows.map(() => group.color))
    }
  }
  // Use full-width flowing tables for unusually long paths; normal reports use a balanced two-column comparison.
  if (sideBySide) pageGroups.forEach((group, index) => {
    if (!group.rows.length) return
    const x = 22 + index * 86
    const top = layout.label(group.title, x, y, group.color) + 4
    const rows = group.rows.slice(0, 4)
    layout.table(['PAGE', 'CHANGE'], rows.map(p => [p.page || '/', `${p.delta > 0 ? '+' : ''}${p.delta}`]), [60, 20], top, rows.map(() => group.color), x)
  })

  y = layout.page('Performance by device & location', '03 / CONTENT & AUDIENCE')
  y = layout.paragraph('Where your organic search audience comes from and the devices people use to reach your website.', y)
  y = layout.label('DEVICE MIX', 22, y + 3, REPORT.brandBlue) + 7
  if (!data.devices.length) y = layout.panel('Device detail', 'No device breakdown is available for this reporting period.', y)
  for (const device of data.devices) {
    y = layout.ensure(y, 24)
    layout.text(device.device.charAt(0) + device.device.slice(1).toLowerCase(), 22, y, 72, 10, REPORT.ink, 'bold')
    pdf.setFont(layout.sans, 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(...REPORT.muted)
    pdf.text(clean(`${device.clicks} clicks / ${device.pct}%`), 188, y, { align: 'right' })
    pdf.setFillColor(...REPORT.line)
    pdf.rect(22, y + 4, 166, 3, 'F')
    pdf.setFillColor(...REPORT.brandBlue)
    pdf.rect(22, y + 4, 166 * Math.max(0, Math.min(100, device.pct)) / 100, 3, 'F')
    y += 21
  }
  y = layout.ensure(y + 6, 40)
  y = layout.label('TOP COUNTRIES', 22, y, REPORT.brandBlue) + 6
  if (data.countries.length) y = layout.table(['COUNTRY', 'CLICKS', 'IMPRESSIONS'], data.countries.slice(0, 5).map(c => [c.country, String(c.clicks), String(c.impressions)]), [94, 32, 40], y)
  else y = layout.panel('Location detail', 'No country breakdown is available for this reporting period.', y)
  layout.paragraph('Read audience data alongside your service area and customer enquiries when choosing which experiences to prioritize.', y, 9)

  y = layout.page('Domain authority & backlinks', '04 / WEBSITE FOUNDATIONS')
  y = layout.paragraph('Backlinks are links from other websites to yours. Relevant, reputable links can support discoverability. Domain Rating is an Ahrefs metric, rather than a score assigned by Google.', y)
  const [latestSnap, prevSnap] = ahrefsSnapshots
  if (latestSnap) {
    const drDelta = prevSnap?.domain_rating != null && latestSnap.domain_rating != null ? Math.round((latestSnap.domain_rating - prevSnap.domain_rating) * 10) / 10 : null
    const blDelta = prevSnap?.backlinks != null && latestSnap.backlinks != null ? latestSnap.backlinks - prevSnap.backlinks : null
    y = layout.metrics([
      { label: 'Domain Rating / Ahrefs', value: String(latestSnap.domain_rating ?? '-'), detail: drDelta == null ? 'Latest available snapshot' : deltaLabel(drDelta, ' pts').replace('previous quarter', 'previous snapshot') },
      { label: 'Total backlinks', value: String(latestSnap.backlinks ?? '-'), detail: blDelta == null ? 'Latest available snapshot' : deltaLabel(blDelta, ' links').replace('previous quarter', 'previous snapshot') },
    ], y + 6)
    y = layout.metrics([
      { label: 'Referring domains', value: String(latestSnap.referring_domains ?? '-') },
      { label: 'Organic keywords / Ahrefs', value: String(latestSnap.organic_keywords ?? '-') },
    ], y)
    if (latestSnap.snapshot_date) y = layout.paragraph(`Latest snapshot: ${latestSnap.snapshot_date}`, y, 9)
    layout.panel('Quality over volume', 'Link relevance and quality matter more than the total alone. Changes here compare the available Ahrefs snapshots and may not match the reporting-quarter boundaries.', y)
  } else layout.panel('Data availability', 'Domain authority data will appear when an Ahrefs snapshot is available for this client.', y + 6)

  y = layout.page('Site speed & experience', '04 / WEBSITE FOUNDATIONS')
  y = layout.paragraph('A faster, more stable mobile experience makes it easier for visitors to explore your website and take the next step. This page shows the latest available mobile performance measurement.', y, 12)
  if (typeof psiScore === 'number') {
    y = layout.performanceScore(psiScore, getSiteSpeedLabel(psiScore), y + 7)
    y = layout.label('PERFORMANCE SCALE', 22, y, REPORT.brandBlue) + 8
    const zones = [{ label: '0-49 / Priority', color: REPORT.amber }, { label: '50-89 / Optimize', color: REPORT.brandBlue }, { label: '90-100 / Strong', color: REPORT.teal }]
    zones.forEach((zone, i) => {
      pdf.setFillColor(...zone.color)
      pdf.rect(22 + i * 56, y, 54, 2, 'F')
      layout.text(zone.label, 22 + i * 56, y + 9, 54, 8, REPORT.muted)
    })
    layout.panel('How to interpret this score', 'This is a performance diagnostic, not a direct ranking score. Lab measurements can vary between runs; use repeated measurements to assess the effect of optimizations.', y + 18, true)
  } else layout.panel('Measurement availability', 'The mobile speed measurement is being refreshed. A score will appear when a measurement is available.', y + 6)

  y = layout.page('Technical site status', '04 / WEBSITE FOUNDATIONS')
  y = layout.paragraph('A focused view of the latest on-page review, covering page structure, metadata and crawl issues. Use the review findings to guide the next technical improvements.', y, 12)
  if (onPageAudit) {
    const dateLabel = new Date(onPageAudit.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    y = layout.panel('Review status', getAuditStatusLabel(onPageAudit.status), y + 6, true)
    y = layout.paragraph(`Run date: ${dateLabel}`, y, 10)
    y = layout.paragraph(`Page audited: ${onPageAudit.landing_page_url}`, y, 10)
    layout.panel('Review scope', 'Completed means that the audit process has finished. Its detailed findings identify which improvements have been completed and which opportunities require follow-up.', y + 7)
  } else layout.panel('Review availability', 'Technical review details will appear once an on-page audit is available for this client.', y + 6)

  y = layout.page('Google Business Profile', '05 / LOCAL PRESENCE')
  y = layout.paragraph('Your Google Business Profile helps customers find your business in Google Search and Maps, check opening hours, read reviews and choose how to get in touch.', y)
  const gbpImages = (assets.gbpImages ?? (assets.gbpImage ? [assets.gbpImage] : []))
    .slice(0, MAX_GBP_IMAGES).flatMap(source => {
      try {
        const dimensions = pdf.getImageProperties(source)
        return dimensions.width > 0 && dimensions.height > 0 ? [{ source, dimensions }] : []
      } catch {
        return []
      }
    })
  gbpImages.forEach(({ source, dimensions }, index) => {
    // Full-width evidence gets its own page so screenshots stay legible at print size.
    if (index > 0) {
      y = layout.page('Google Business Profile', '05 / LOCAL PRESENCE')
      y = layout.paragraph('A closer look at your local presence in Google Search and Maps.', y)
    }
    const imageY = y + 6
    const imageHeight = Math.min(163, REPORT.bottom - imageY - 17, 158 * dimensions.height / dimensions.width + 8)
    addImageContained(pdf, source, 26, imageY + 4, 158, imageHeight - 8)
    pdf.setDrawColor(...REPORT.line)
    pdf.setLineWidth(0.3)
    pdf.rect(22, imageY, 166, imageHeight)
    layout.text(`GOOGLE BUSINESS PROFILE / VISUAL ${index + 1} OF ${gbpImages.length}`, 22, imageY + imageHeight + 8, 166, 7.5, REPORT.muted)
  })
  if (!gbpImages.length) layout.panel('Local performance', 'Google Business Profile metrics are not connected to this report yet. Local interactions, calls, views and posts will be included when the connection is available.', y + 6)

  pdf.addPage()
  pdf.setFillColor(...REPORT.brandBlue)
  pdf.rect(0, 0, 210, 297, 'F')
  brand(layout, assets.xmsLogo)
  layout.label('THE NEXT CHAPTER', 22, 74, REPORT.white)
  layout.title('Thank you for\nyour partnership.', 22, 105, 166, 38, REPORT.white)
  layout.text('A clearer understanding today.\nA stronger direction for tomorrow.', 22, 152, 166, 13, REPORT.white)
  pdf.setDrawColor(...REPORT.white)
  pdf.line(22, 186, 188, 186)
  layout.text('Let\'s discuss your next quarter.', 22, 203, 166, 14, REPORT.white, 'bold')
  layout.text('Contact your team to review these findings\nand align the next priorities for your business.', 22, 215, 166, 11, REPORT.white)
  layout.text('(772) 905-3005', 22, 249, 166, 19, REPORT.white)
  layout.text('info@xperienceusa.com', 22, 263, 166, 11, REPORT.white)
  layout.text('www.xperiencemarketingsolutions.com', 22, 276, 166, 9, REPORT.white)
  pdf.link(22, 257, 95, 9, { url: 'mailto:info@xperienceusa.com' })
  pdf.link(22, 270, 166, 9, { url: 'https://www.xperiencemarketingsolutions.com' })
  layout.finish()
  pdf.setProperties({ title: `${clientName} - SEO Quarterly Report - ${period}`, subject: 'Quarterly SEO performance report', author: 'Xperience Marketing Solutions' })
  return pdf
}

export async function buildClientQuarterlyReportBlob(options: ClientQuarterlyReportOptions) {
  const { jsPDF } = await import('jspdf')
  const imageUrls = (options.gbpImageUrls ?? (options.gbpImageUrl ? [options.gbpImageUrl] : [])).slice(0, MAX_GBP_IMAGES)
  const [clientLogo, xmsLogo, xmsCoverLogo, coverPhoto, gbpImages, fonts] = await Promise.all([
    imageToDataUrl(options.clientLogoUrl),
    imageToDataUrl(options.xmsLogoUrl ?? '/XMS LOGO - WHITE BACKGROUND.png'),
    imageToDataUrl(options.xmsLogoUrl ?? '/XMS LOGO - BLACK BACKGROUND.png'),
    imageToDataUrl(coverPhotoUrl),
    Promise.all(imageUrls.map(url => imageToDataUrl(url))),
    loadQuarterlyReportFonts(),
  ])
  return buildClientQuarterlyPdf(options, jsPDF, { clientLogo, xmsLogo, xmsCoverLogo, coverPhoto, gbpImages: gbpImages.filter((image): image is string => !!image), fonts }).output('blob') as Blob
}
