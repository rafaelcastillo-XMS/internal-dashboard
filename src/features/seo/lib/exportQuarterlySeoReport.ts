import type { jsPDF as JsPDF } from 'jspdf'
import type { GBPData } from '@/features/seo/components/GBPReport'

type Pdf = JsPDF

interface QuarterlySeoReportOptions {
  data: GBPData
  clientName: string
  site: string
  startDate: string
  endDate: string
  clientLogoUrl?: string
  xmsLogoUrl?: string
}

type RGB = [number, number, number]

const BLUE: RGB = [0, 113, 188]
const BLUE_DARK: RGB = [0, 61, 139]
const CYAN: RGB = [0, 174, 239]
const INK: RGB = [20, 28, 40]
const MUTED: RGB = [82, 96, 115]
const LIGHT: RGB = [232, 240, 249]

function clean(value: string) {
  return value
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\u2026/g, '...')
    // jsPDF's built-in Helvetica font supports Latin text but not arbitrary Unicode.
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00C0-\u00FF]/g, '')
}

function formatPeriod(startDate: string, endDate: string) {
  const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric', timeZone: 'UTC' }
  const start = new Date(`${startDate}T00:00:00Z`).toLocaleDateString('en-US', options)
  const end = new Date(`${endDate}T00:00:00Z`).toLocaleDateString('en-US', options)
  return `${start} to ${end}`
}

function safeDomain(site: string) {
  return site.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function bodyChrome(pdf: Pdf, period: string, pageNumber: number) {
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
  pdf.line(68, 21.5, 68, 26)
  pdf.text(clean(period), 73, 25)

  pdf.setFontSize(7.5)
  pdf.setTextColor(255, 255, 255)
  pdf.text('www.xperiencemarketingsolutions.com', 8, h - 4.5)
  pdf.text(String(pageNumber), w - 10, h - 4.5, { align: 'right' })
}

function heading(pdf: Pdf, title: string, y = 43) {
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(25)
  pdf.setTextColor(...BLUE)
  const lines = pdf.splitTextToSize(clean(title), 171)
  pdf.text(lines, 21, y)
  return y + lines.length * 10 + 4
}

function paragraph(pdf: Pdf, text: string, y: number, width = 168, size = 11, lineHeight = 1.45) {
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(size)
  pdf.setTextColor(...INK)
  pdf.setLineHeightFactor(lineHeight)
  const lines = pdf.splitTextToSize(clean(text), width)
  pdf.text(lines, 21, y)
  return y + lines.length * size * 0.52 * lineHeight
}

function metricCard(pdf: Pdf, x: number, y: number, width: number, label: string, value: string, accent: RGB = BLUE) {
  pdf.setFillColor(247, 250, 253)
  pdf.setDrawColor(218, 228, 239)
  pdf.roundedRect(x, y, width, 27, 3, 3, 'FD')
  pdf.setFillColor(...accent)
  pdf.roundedRect(x, y, 3, 27, 1.5, 1.5, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.setTextColor(...INK)
  pdf.text(clean(value), x + 8, y + 12)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...MUTED)
  pdf.text(pdf.splitTextToSize(clean(label), width - 13), x + 8, y + 19)
}

function drawLineChart(
  pdf: Pdf,
  values: number[],
  labels: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: RGB = BLUE,
) {
  pdf.setFillColor(248, 251, 255)
  pdf.setDrawColor(220, 230, 241)
  pdf.roundedRect(x, y, width, height, 3, 3, 'FD')
  const padX = 11
  const padY = 10
  const chartW = width - padX * 2
  const chartH = height - padY * 2 - 7
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)

  pdf.setDrawColor(224, 232, 241)
  pdf.setLineWidth(0.25)
  for (let i = 0; i < 4; i++) {
    const lineY = y + padY + (chartH / 3) * i
    pdf.line(x + padX, lineY, x + padX + chartW, lineY)
  }

  if (values.length > 0) {
    const points = values.map((value, index) => ({
      x: x + padX + (values.length === 1 ? chartW / 2 : (chartW * index) / (values.length - 1)),
      y: y + padY + chartH - ((value - min) / range) * chartH,
    }))
    pdf.setDrawColor(...color)
    pdf.setLineWidth(1.15)
    points.slice(1).forEach((point, index) => pdf.line(points[index].x, points[index].y, point.x, point.y))
    pdf.setFillColor(...color)
    points.forEach(point => pdf.circle(point.x, point.y, 1.15, 'F'))
  }

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6.5)
  pdf.setTextColor(...MUTED)
  const step = Math.max(1, Math.ceil(labels.length / 5))
  labels.forEach((label, index) => {
    if (index % step !== 0 && index !== labels.length - 1) return
    const labelX = x + padX + (labels.length === 1 ? chartW / 2 : (chartW * index) / (labels.length - 1))
    pdf.text(clean(label), labelX, y + height - 5, { align: 'center' })
  })
}

function addImageContained(pdf: Pdf, dataUrl: string | undefined, x: number, y: number, maxW: number, maxH: number) {
  if (!dataUrl) return false
  try {
    const props = pdf.getImageProperties(dataUrl)
    const ratio = Math.min(maxW / props.width, maxH / props.height)
    const width = props.width * ratio
    const height = props.height * ratio
    pdf.addImage(dataUrl, props.fileType, x + (maxW - width) / 2, y + (maxH - height) / 2, width, height)
    return true
  } catch {
    return false
  }
}

export function buildQuarterlySeoPdf(
  options: QuarterlySeoReportOptions,
  PdfConstructor: typeof JsPDF,
  assets: { clientLogo?: string; xmsLogo?: string } = {},
) {
  const { data, clientName, site, startDate, endDate } = options
  const period = formatPeriod(startDate, endDate)
  const domain = safeDomain(site)
  const pdf = new PdfConstructor({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const w = pdf.internal.pageSize.getWidth()
  const h = pdf.internal.pageSize.getHeight()
  let pageNumber = 1

  const addBodyPage = (title: string) => {
    pdf.addPage()
    pageNumber += 1
    bodyChrome(pdf, period, pageNumber)
    return heading(pdf, title)
  }

  // Cover
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
  pdf.setFontSize(35)
  pdf.text('ORGANIC SEO', w / 2, 85, { align: 'center' })
  pdf.setFontSize(20)
  pdf.text('QUARTERLY REPORT', w / 2, 99, { align: 'center' })

  pdf.setFillColor(255, 255, 255)
  pdf.circle(w / 2, 143, 30, 'F')
  if (!addImageContained(pdf, assets.clientLogo, w / 2 - 24, 119, 48, 48)) {
    pdf.setTextColor(...BLUE_DARK)
    pdf.setFontSize(24)
    pdf.text(clientName.split(/\s+/).map(word => word[0]).join('').slice(0, 3).toUpperCase(), w / 2, 149, { align: 'center' })
  }
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(18)
  pdf.text(clean(clientName.toUpperCase()), w / 2, 190, { align: 'center', maxWidth: 175 })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(clean(domain), w / 2, 201, { align: 'center' })

  // Introduction
  let y = addBodyPage('Organic Search Engine Optimization & Communication')
  y = paragraph(pdf, 'This quarterly report presents the most relevant organic search, local visibility and website performance results for your business. It combines Google Business Profile, Google Analytics and Search Console data for the selected reporting period.', y + 5)
  y = paragraph(pdf, 'Our SEO team reviews these indicators alongside the work completed throughout the quarter. The objective is to provide a clear view of visibility, audience engagement and opportunities for continued growth.', y + 8)
  pdf.setFillColor(...LIGHT)
  pdf.roundedRect(21, y + 9, 168, 34, 4, 4, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(...BLUE_DARK)
  pdf.text('REPORTING PERIOD', 29, y + 22)
  pdf.setFontSize(15)
  pdf.text(clean(period), 29, y + 33)

  // GBP interactions
  y = addBodyPage('GBP = Google Business Profile')
  y = paragraph(pdf, 'Google Business Profile is your local business listing across Google Search and Maps. The team monitors this channel and works to improve its visibility, information quality and customer interaction.', y + 3)
  y = paragraph(pdf, `During this reporting period, the profile generated ${data.interactions.total.toLocaleString()} recorded interactions. The chart below shows how activity changed over time.`, y + 6)
  metricCard(pdf, 21, y + 6, 51, 'Business Profile interactions', data.interactions.total.toLocaleString())
  metricCard(pdf, 79.5, y + 6, 51, 'Profile views', data.profileViews.total.toLocaleString(), [52, 168, 83])
  metricCard(pdf, 138, y + 6, 51, 'Search appearances', data.searches.total.toLocaleString(), [251, 188, 5])
  drawLineChart(pdf, data.interactions.values, data.interactions.labels, 21, y + 41, 168, 73)

  // GBP discovery
  y = addBodyPage('How Customers Found Your Business')
  y = paragraph(pdf, 'Profile views show how often customers found the business on Google Search or Maps. Search terms reveal the language people used when the profile appeared in their results.', y + 3)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.setTextColor(...INK)
  pdf.text(data.profileViews.total.toLocaleString(), 21, y + 14)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...MUTED)
  pdf.text('People viewed your Business Profile', 21, y + 20)

  let barY = y + 30
  data.profileViews.breakdown.slice(0, 4).forEach(item => {
    pdf.setFontSize(8)
    pdf.setTextColor(...INK)
    pdf.text(clean(item.label), 21, barY)
    pdf.setTextColor(...MUTED)
    pdf.text(`${item.value.toLocaleString()} - ${item.pct}%`, 105, barY, { align: 'right' })
    pdf.setFillColor(232, 238, 245)
    pdf.roundedRect(21, barY + 3, 84, 4, 2, 2, 'F')
    const rgb = /^#([0-9a-f]{6})$/i.exec(item.color)
    const color = rgb ? [parseInt(rgb[1].slice(0, 2), 16), parseInt(rgb[1].slice(2, 4), 16), parseInt(rgb[1].slice(4, 6), 16)] : BLUE
    pdf.setFillColor(color[0], color[1], color[2])
    pdf.roundedRect(21, barY + 3, Math.max(2, 84 * item.pct / 100), 4, 2, 2, 'F')
    barY += 16
  })

  pdf.setDrawColor(220, 228, 238)
  pdf.line(116, y + 8, 116, y + 89)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.setTextColor(...INK)
  pdf.text(String(data.searches.total), 125, y + 14)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...MUTED)
  pdf.text('Search appearances', 125, y + 20)
  data.searches.keywords.slice(0, 6).forEach((keyword, index) => {
    const rowY = y + 34 + index * 10
    pdf.setFontSize(8)
    pdf.setTextColor(...MUTED)
    pdf.text(`${index + 1}.`, 125, rowY)
    pdf.setTextColor(...INK)
    pdf.text(pdf.splitTextToSize(clean(keyword.term), 47)[0], 132, rowY)
    pdf.setFont('helvetica', 'bold')
    pdf.text(clean(keyword.count), 187, rowY, { align: 'right' })
    pdf.setFont('helvetica', 'normal')
  })

  // Posts
  y = addBodyPage('Google Business Profile Posts')
  y = paragraph(pdf, 'Publishing relevant updates directly on the Google listing helps maintain an active profile, communicate services and offers, and encourage customers to interact with the business.', y + 3)
  const posts = data.posts.slice(0, 4)
  if (posts.length === 0) {
    pdf.setFillColor(248, 250, 253)
    pdf.roundedRect(21, y + 10, 168, 42, 4, 4, 'F')
    paragraph(pdf, 'No recent Google Business Profile posts were returned for this reporting period.', y + 28, 150, 10)
  } else {
    posts.forEach((post, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const x = 21 + col * 86
      const cardY = y + 9 + row * 68
      pdf.setFillColor(248, 250, 253)
      pdf.setDrawColor(221, 229, 239)
      pdf.roundedRect(x, cardY, 82, 60, 4, 4, 'FD')
      pdf.setFillColor(...BLUE)
      pdf.circle(x + 8, cardY + 9, 4, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setTextColor(...INK)
      pdf.text(clean(clientName), x + 15, cardY + 8)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(6.5)
      pdf.setTextColor(...MUTED)
      pdf.text(clean(post.date), x + 15, cardY + 12)
      pdf.setFontSize(8)
      pdf.setTextColor(...INK)
      const content = pdf.splitTextToSize(clean(post.content.replace(/\s+/g, ' ')), 68).slice(0, 6)
      pdf.text(content, x + 7, cardY + 23)
      if (post.cta) {
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(...BLUE)
        pdf.text(clean(post.cta), x + 7, cardY + 54)
      }
    })
  }

  // GA4
  y = addBodyPage('Website Audience & Engagement')
  y = paragraph(pdf, 'Google Analytics measures how users reached and interacted with the website. These results provide context for the visibility generated through organic and local search.', y + 3)
  const gaMetrics = data.ga4Summary.metrics.slice(0, 4)
  gaMetrics.forEach((metric, index) => {
    const x = 21 + (index % 2) * 86
    const cardY = y + 8 + Math.floor(index / 2) * 35
    metricCard(pdf, x, cardY, 82, metric.label, metric.value, metric.delta >= 0 ? [52, 168, 83] : [218, 68, 83])
  })
  drawLineChart(pdf, data.ga4Summary.last90, data.ga4Summary.labels, 21, y + 85, 168, 72, [52, 168, 83])

  // GSC
  y = addBodyPage('Organic Search Visibility')
  y = paragraph(pdf, 'Google Search Console shows how the website performed in Google organic search. Clicks represent visits from search results, while impressions measure how often the website appeared.', y + 3)
  const gscMetrics = [
    ['Total clicks', data.gsc.clicks],
    ['Total impressions', data.gsc.impressions],
    ['Average CTR', data.gsc.ctr],
    ['Average position', data.gsc.position],
  ]
  gscMetrics.forEach((metric, index) => metricCard(pdf, 21 + index * 43, y + 8, 39, metric[0], metric[1], index === 1 ? [124, 58, 237] : index === 3 ? [244, 124, 32] : BLUE))
  drawLineChart(pdf, data.gsc.impressionSeries, data.gsc.labels, 21, y + 45, 168, 76, [124, 58, 237])
  y = paragraph(pdf, `The website recorded ${data.gsc.clicks} organic clicks from ${data.gsc.impressions} impressions, with an average click-through rate of ${data.gsc.ctr} and average position of ${data.gsc.position}.`, y + 132)

  // Executive summary
  y = addBodyPage('Quarterly Performance Summary')
  y = paragraph(pdf, `${clientName} maintained an active organic and local search presence during ${period}. Google Business Profile generated ${data.interactions.total.toLocaleString()} interactions and ${data.profileViews.total.toLocaleString()} views, while the website recorded ${data.gsc.clicks} organic clicks.`, y + 3)
  y = paragraph(pdf, 'The next quarter should continue strengthening local profile activity, publishing useful content and improving the website experience. Performance should be reviewed together with completed SEO tasks and client priorities.', y + 8)
  pdf.setFillColor(...BLUE_DARK)
  pdf.roundedRect(21, y + 12, 168, 61, 5, 5, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(255, 255, 255)
  pdf.text('Key results', 31, y + 27)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  const summary = [
    `${data.interactions.total.toLocaleString()} Google Business Profile interactions`,
    `${data.profileViews.total.toLocaleString()} profile views across Search and Maps`,
    `${data.gsc.clicks} organic clicks and ${data.gsc.impressions} impressions`,
  ]
  summary.forEach((item, index) => pdf.text(`- ${clean(item)}`, 31, y + 40 + index * 9))

  // Closing
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
  pdf.setFontSize(31)
  pdf.setTextColor(255, 255, 255)
  pdf.text(['THANK YOU FOR', 'YOUR BUSINESS!'], w / 2, 123, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(14)
  pdf.text('We appreciate it very much.', w / 2, 155, { align: 'center' })
  pdf.setFontSize(11)
  pdf.text(['If you have any questions or need additional information,', 'please contact us at your earliest convenience.'], w / 2, 205, { align: 'center' })
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('(772) 905-3005', w / 2, 238, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text('www.xperiencemarketingsolutions.com', w / 2, 254, { align: 'center' })
  pdf.text('info@xperienceusa.com', w / 2, 263, { align: 'center' })

  pdf.setProperties({
    title: `${clientName} - SEO Quarterly Report - ${period}`,
    subject: 'Organic SEO quarterly performance report',
    author: 'Xperience Marketing Solutions',
  })
  return pdf
}

async function imageToDataUrl(url?: string) {
  if (!url) return undefined
  try {
    const response = await fetch(url)
    if (!response.ok) return undefined
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

export async function exportQuarterlySeoReport(options: QuarterlySeoReportOptions) {
  const { jsPDF } = await import('jspdf')
  const [clientLogo, xmsLogo] = await Promise.all([
    imageToDataUrl(options.clientLogoUrl),
    imageToDataUrl(options.xmsLogoUrl ?? '/XMS LOGO - BLACK BACKGROUND.png'),
  ])
  const pdf = buildQuarterlySeoPdf(options, jsPDF, { clientLogo, xmsLogo })
  const filename = `${options.clientName || 'Client'}-SEO-Quarterly-Report-${options.startDate}-${options.endDate}`
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/-+/g, '-')
  pdf.save(`${filename}.pdf`)
}
