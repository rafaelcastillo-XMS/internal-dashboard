import { jsPDF } from 'jspdf'
import type { Report, Slide, KpiMetric, ReportTableData, TextBlock, ChartBlockData, AdPerformanceCard } from './types'
import { reportTheme } from './reportTheme'

const page = {
  width: 792,
  height: 612,
  margin: 42,
}

const colors = {
  primaryBlue: [0, 87, 194] as [number, number, number],
  darkBlue: [0, 59, 143] as [number, number, number],
  navyBlue: [6, 42, 99] as [number, number, number],
  lightBlue: [0, 174, 239] as [number, number, number],
  paleBlue: [234, 246, 255] as [number, number, number],
  badgeBlue: [191, 239, 255] as [number, number, number],
  slate: [15, 23, 42] as [number, number, number],
  body: [71, 85, 105] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  line: [216, 228, 242] as [number, number, number],
  soft: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

const googleAdsKpiOrder = ['impressions', 'clicks', 'cost', 'avg-cpc']
const googleAdsKpiStyles: Record<string, {
  fill: [number, number, number]
  label: [number, number, number]
  value: [number, number, number]
  comparison: [number, number, number]
}> = {
  impressions: {
    fill: [26, 115, 231],
    label: [222, 235, 255],
    value: colors.white,
    comparison: [235, 244, 255],
  },
  clicks: {
    fill: [217, 47, 37],
    label: [255, 226, 224],
    value: colors.white,
    comparison: [255, 236, 234],
  },
  cost: {
    fill: [249, 171, 2],
    label: [72, 50, 0],
    value: [0, 0, 0],
    comparison: [62, 46, 12],
  },
  'avg-cpc': {
    fill: [31, 142, 63],
    label: [220, 255, 229],
    value: colors.white,
    comparison: [232, 255, 238],
  },
}

function compactKpiValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return value
  if (/k$/i.test(trimmed)) return trimmed

  const hasCurrency = trimmed.includes('$')
  const numeric = Number(trimmed.replace(/[$,\s]/g, ''))
  if (!Number.isFinite(numeric)) return value

  const compactNumber = (input: number) => input.toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })
  const compact = Math.abs(numeric) >= 1000 ? `${compactNumber(numeric / 1000)}K` : compactNumber(numeric)

  return hasCurrency ? `$${compact}` : compact
}

interface PdfAssets {
  xmsLogo: string | null
  xmsLogoLight: string | null
  googleGuaranteedLogo: string | null
  googlePartnerLogo: string | null
  googleAdsLogo: string | null
}

function setFill(doc: jsPDF, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2])
}

function setDraw(doc: jsPDF, color: [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2])
}

function setText(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2])
}

function text(doc: jsPDF, value: string, x: number, y: number, options?: {
  size?: number
  bold?: boolean
  color?: [number, number, number]
  maxWidth?: number
  lineHeight?: number
}) {
  doc.setFont('helvetica', options?.bold ? 'bold' : 'normal')
  doc.setFontSize(options?.size ?? 10)
  setText(doc, options?.color ?? colors.body)
  const lines = options?.maxWidth ? doc.splitTextToSize(value, options.maxWidth) : [value]
  doc.text(lines, x, y, { lineHeightFactor: options?.lineHeight ?? 1.25 })
  return y + lines.length * (options?.size ?? 10) * (options?.lineHeight ?? 1.25)
}

function loadImageDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function drawChrome(doc: jsPDF, report: Report, slide: Slide, assets: PdfAssets, totalSlides: number) {
  if (slide.type === 'cover' || slide.type === 'thank_you') return
  setFill(doc, colors.white)
  doc.rect(0, 0, page.width, page.height, 'F')
  setFill(doc, colors.darkBlue)
  doc.rect(0, 0, page.width, 54, 'F')
  setFill(doc, colors.primaryBlue)
  doc.rect(0, 51, page.width, 3, 'F')
  setDraw(doc, colors.line)
  doc.setLineWidth(1)
  doc.line(0, 54, page.width, 54)

  text(doc, report.clientName, page.margin, 34, { size: 11, bold: true, color: colors.white })
  text(doc, `${report.month} ${report.year}`, page.margin, 47, { size: 8, color: colors.badgeBlue })
  if (assets.xmsLogo) doc.addImage(assets.xmsLogo, 'PNG', page.width - page.margin - 112, 13, 112, 26)
  text(doc, `${slide.order}/${totalSlides}`, page.width - page.margin - 20, page.height - 28, { size: 8, color: colors.muted })
}

function drawKpis(doc: jsPDF, kpis: KpiMetric[], y: number) {
  const gap = 12
  const cols = 3
  const cardW = (page.width - page.margin * 2 - gap * (cols - 1)) / cols
  const cardH = 62
  kpis.slice(0, 9).forEach((kpi, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = page.margin + col * (cardW + gap)
    const cy = y + row * (cardH + gap)
    setFill(doc, colors.white)
    doc.roundedRect(x, cy, cardW, cardH, 8, 8, 'F')
    setDraw(doc, colors.line)
    doc.roundedRect(x, cy, cardW, cardH, 8, 8, 'S')
    text(doc, kpi.label.toUpperCase(), x + 14, cy + 20, { size: 7, bold: true, color: colors.muted })
    text(doc, kpi.value, x + 14, cy + 42, { size: 18, bold: true, color: colors.navyBlue })
    if (kpi.comparison) text(doc, kpi.comparison, x + 14, cy + 56, { size: 7, color: kpi.trend === 'down' ? colors.lightBlue : colors.primaryBlue })
  })
  return y + Math.ceil(kpis.slice(0, 9).length / cols) * (cardH + gap)
}

function drawGoogleAdsKpis(doc: jsPDF, kpis: KpiMetric[], y: number) {
  const visibleKpis = googleAdsKpiOrder
    .map((id) => kpis.find((kpi) => kpi.id === id))
    .filter((kpi): kpi is KpiMetric => Boolean(kpi))
  const gap = 0
  const cardW = (page.width - page.margin * 2 - gap * 3) / 4
  const cardH = 76

  visibleKpis.forEach((kpi, index) => {
    const x = page.margin + index * (cardW + gap)
    const style = googleAdsKpiStyles[kpi.id] ?? googleAdsKpiStyles.impressions
    setFill(doc, style.fill)
    doc.roundedRect(x, y, cardW, cardH, 8, 8, 'F')
    text(doc, kpi.label.toUpperCase(), x + 12, y + 19, { size: 7, bold: true, color: style.label })
    text(doc, compactKpiValue(kpi.value), x + 12, y + 47, { size: 20, bold: true, color: style.value })
    if (kpi.comparison) text(doc, kpi.comparison, x + 12, y + 64, { size: 7, bold: true, color: style.comparison })
  })

  return y + cardH + 18
}

function drawTextBlocks(doc: jsPDF, blocks: TextBlock[], y: number) {
  let cursor = y
  blocks.forEach((block) => {
    text(doc, block.label, page.margin, cursor, { size: 10, bold: true, color: colors.darkBlue })
    cursor = text(doc, block.value, page.margin, cursor + 14, {
      size: 9,
      color: colors.body,
      maxWidth: page.width - page.margin * 2,
      lineHeight: 1.35,
    }) + 12
  })
  return cursor
}

function drawGoogleAdsSummary(doc: jsPDF, blocks: TextBlock[], y: number) {
  let cursor = y
  blocks.forEach((block) => {
    cursor = text(doc, block.value, page.margin, cursor, {
      size: 10,
      color: colors.body,
      maxWidth: page.width - page.margin * 2,
      lineHeight: 1.45,
    }) + 12
  })
  return cursor
}

function drawTable(doc: jsPDF, table: ReportTableData, y: number, maxRows = 8) {
  const usable = page.width - page.margin * 2
  const rowH = 24
  const headers = table.columns
  const colW = usable / headers.length
  let cursor = y
  text(doc, table.title, page.margin, cursor, { size: 11, bold: true, color: colors.slate })
  cursor += 10
  setFill(doc, colors.paleBlue)
  doc.roundedRect(page.margin, cursor, usable, rowH, 6, 6, 'F')
  setDraw(doc, colors.line)
  doc.roundedRect(page.margin, cursor, usable, rowH, 6, 6, 'S')
  headers.forEach((col, index) => {
    text(doc, col.label, page.margin + index * colW + 8, cursor + 16, { size: 7, bold: true, color: colors.darkBlue })
  })
  cursor += rowH
  table.rows.slice(0, maxRows).forEach((row, rowIndex) => {
    setFill(doc, rowIndex % 2 === 0 ? colors.white : colors.soft)
    doc.rect(page.margin, cursor, usable, rowH, 'F')
    setDraw(doc, colors.line)
    doc.line(page.margin, cursor + rowH, page.margin + usable, cursor + rowH)
    headers.forEach((col, index) => {
      const raw = row[col.key] ?? ''
      const value = String(raw)
      text(doc, value.length > 24 ? `${value.slice(0, 23)}...` : value, page.margin + index * colW + 8, cursor + 16, {
        size: 7,
        color: index === 0 ? colors.slate : colors.body,
        bold: index === 0,
      })
    })
    cursor += rowH
  })
  return cursor + 16
}

function drawCharts(doc: jsPDF, charts: ChartBlockData[], y: number) {
  let cursor = y
  charts.slice(0, 3).forEach((chart) => {
    text(doc, chart.title, page.margin, cursor, { size: 10, bold: true, color: colors.slate })
    if (chart.description) text(doc, chart.description, page.margin + 180, cursor, { size: 8, color: colors.muted })
    cursor += 16
    const max = Math.max(...chart.series.map((point) => point.value), 1)
    chart.series.forEach((point) => {
      text(doc, point.label, page.margin, cursor + 8, { size: 8, color: colors.body })
      setFill(doc, colors.line)
      doc.roundedRect(page.margin + 92, cursor, 250, 10, 5, 5, 'F')
      setFill(doc, colors.primaryBlue)
      doc.roundedRect(page.margin + 92, cursor, 250 * (point.value / max), 10, 5, 5, 'F')
      text(doc, point.displayValue, page.margin + 356, cursor + 8, { size: 8, bold: true, color: colors.slate })
      if (point.detail) text(doc, point.detail, page.margin + 410, cursor + 8, { size: 8, color: colors.muted })
      cursor += 18
    })
    cursor += 14
  })
  return cursor
}

function imageFormat(src: string) {
  if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/jpg')) return 'JPEG'
  if (src.startsWith('data:image/webp')) return 'WEBP'
  return 'PNG'
}

function fitImage(width: number, height: number, maxW: number, maxH: number) {
  if (width <= 0 || height <= 0) return { width: maxW, height: maxH, x: 0, y: 0 }
  const scale = Math.min(maxW / width, maxH / height)
  const nextWidth = width * scale
  const nextHeight = height * scale
  return {
    width: nextWidth,
    height: nextHeight,
    x: (maxW - nextWidth) / 2,
    y: (maxH - nextHeight) / 2,
  }
}

function drawAds(doc: jsPDF, ads: AdPerformanceCard[], y: number) {
  const cardW = (page.width - page.margin * 2 - 16) / 2
  const cardH = 268
  const imageH = 162
  ads.slice(0, 2).forEach((ad, index) => {
    const x = page.margin + index * (cardW + 16)
    setFill(doc, colors.soft)
    doc.roundedRect(x, y, cardW, cardH, 10, 10, 'F')
    setDraw(doc, colors.line)
    doc.roundedRect(x, y, cardW, cardH, 10, 10, 'S')
    setFill(doc, colors.white)
    doc.roundedRect(x + 16, y + 16, cardW - 32, imageH, 8, 8, 'F')
    setDraw(doc, colors.line)
    doc.roundedRect(x + 16, y + 16, cardW - 32, imageH, 8, 8, 'S')

    if (ad.imageSrc) {
      try {
        const props = doc.getImageProperties(ad.imageSrc)
        const fit = fitImage(props.width, props.height, cardW - 44, imageH - 18)
        doc.addImage(
          ad.imageSrc,
          imageFormat(ad.imageSrc),
          x + 22 + fit.x,
          y + 25 + fit.y,
          fit.width,
          fit.height,
        )
      } catch {
        text(doc, 'Ad image could not be embedded', x + 36, y + 95, { size: 9, color: colors.muted })
      }
    } else {
      text(doc, 'No ad image attached', x + 36, y + 95, { size: 9, color: colors.muted })
    }

    text(doc, ad.description, x + 16, y + imageH + 44, {
      size: 9,
      color: colors.body,
      maxWidth: cardW - 32,
      lineHeight: 1.35,
    })
  })
  return y + cardH + 22
}

function drawSlideBody(doc: jsPDF, slide: Slide, report: Report, assets: PdfAssets) {
  let y = 108

  if (slide.type === 'cover') {
    const columnW = 230
    const columnX = page.width - columnW
    const logoW = 92
    const logoH = 62

    setFill(doc, colors.darkBlue)
    doc.rect(0, 0, page.width, page.height, 'F')
    setFill(doc, colors.primaryBlue)
    doc.rect(0, 0, page.width, 142, 'F')
    setFill(doc, colors.lightBlue)
    doc.rect(0, 142, page.width, 8, 'F')
    setDraw(doc, [84, 180, 238])
    doc.setLineWidth(0.6)
    for (let x = 0; x < page.width; x += 44) doc.line(x, 0, x, page.height)
    for (let gy = 0; gy < page.height; gy += 44) doc.line(0, gy, page.width, gy)
    doc.setLineWidth(4)
    setDraw(doc, colors.white)
    doc.line(400, 440, 470, 394)
    doc.line(470, 394, 526, 420)
    doc.line(526, 420, 610, 330)
    doc.line(610, 330, 738, 250)

    setFill(doc, colors.white)
    doc.rect(columnX, 0, columnW, page.height, 'F')
    if (assets.xmsLogoLight) doc.addImage(assets.xmsLogoLight, 'PNG', columnX + 34, 42, 162, 58)
    if (assets.googleGuaranteedLogo) doc.addImage(assets.googleGuaranteedLogo, 'PNG', columnX + (columnW - logoW) / 2, 360, logoW, logoH)
    if (assets.googlePartnerLogo) doc.addImage(assets.googlePartnerLogo, 'PNG', columnX + 18, 452, logoW, logoH)
    if (assets.googleAdsLogo) doc.addImage(assets.googleAdsLogo, 'PNG', columnX + columnW - 18 - logoW, 452, logoW, logoH)

    setFill(doc, [255, 255, 255])
    doc.roundedRect(page.margin, 32, 56, 56, 8, 8, 'F')
    setFill(doc, colors.primaryBlue)
    doc.roundedRect(page.margin + 9, 41, 38, 38, 7, 7, 'F')
    const initials = report.clientName
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    text(doc, initials, page.margin + 18, 66, { size: 14, bold: true, color: colors.white })
    text(doc, report.clientName, page.margin + 72, 56, { size: 13, bold: true, color: colors.white, maxWidth: 330 })
    text(doc, 'Prepared for', page.margin + 72, 73, { size: 8, bold: true, color: colors.badgeBlue })

    y = 238
    text(doc, slide.content.reportTitle ?? 'Google Ads & LSA Report', page.margin, y, {
      size: 42,
      bold: true,
      color: colors.white,
      maxWidth: columnX - page.margin - 34,
      lineHeight: 1.1,
    })
    text(doc, `${report.month} ${report.year}`, page.margin, y + 106, { size: 21, color: colors.badgeBlue, bold: true })
    return
  }

  if (slide.type === 'thank_you') {
    setFill(doc, colors.darkBlue)
    doc.rect(0, 0, page.width, page.height, 'F')
    setFill(doc, colors.primaryBlue)
    doc.rect(0, 0, page.width, 110, 'F')
    setFill(doc, colors.lightBlue)
    doc.rect(0, 110, page.width, 8, 'F')
    setDraw(doc, [84, 180, 238])
    doc.setLineWidth(0.5)
    for (let x = 0; x < page.width; x += 44) doc.line(x, 0, x, page.height)
    for (let gy = 0; gy < page.height; gy += 44) doc.line(0, gy, page.width, gy)
    if (assets.xmsLogo) doc.addImage(assets.xmsLogo, 'PNG', page.width - page.margin - 134, 34, 134, 32)
    y = 232
    text(doc, slide.content.finalMessage ?? '', page.margin + 42, y, {
      size: 28,
      bold: true,
      color: colors.white,
      maxWidth: page.width - page.margin * 2 - 84,
      lineHeight: 1.2,
    })
    return
  }

  text(doc, slide.title, page.margin, y, { size: 24, bold: true, color: colors.darkBlue, maxWidth: page.width - page.margin * 2 })
  y += 40

  if (slide.content.kpis?.length) {
    y = slide.type === 'google_ads_kpis'
      ? drawGoogleAdsKpis(doc, slide.content.kpis, y)
      : drawKpis(doc, slide.content.kpis, y) + 8
  }
  if (slide.content.ads?.length) y = drawAds(doc, slide.content.ads, y)
  if (slide.content.charts?.length) y = drawCharts(doc, slide.content.charts, y)
  if (slide.content.tables?.length) {
    slide.content.tables.slice(0, 2).forEach((table) => {
      y = drawTable(doc, table, y, slide.type === 'keywords' || slide.type === 'search_terms' ? 7 : 8)
    })
  }
  if (slide.content.highlights?.length) {
    slide.content.highlights.forEach((item) => {
      setFill(doc, colors.lightBlue)
      doc.circle(page.margin + 6, y - 3, 3, 'F')
      text(doc, item, page.margin + 20, y, { size: 12, color: colors.body, maxWidth: page.width - page.margin * 2 - 20 })
      y += 26
    })
    y += 8
  }
  if (slide.type !== 'ads' && slide.content.textBlocks?.length) {
    y = slide.type === 'google_ads_kpis' || slide.type === 'keywords' || slide.type === 'search_terms'
      ? drawGoogleAdsSummary(doc, slide.content.textBlocks, y)
      : drawTextBlocks(doc, slide.content.textBlocks, y)
  }
  if (slide.content.noteBlocks?.length) y = drawTextBlocks(doc, slide.content.noteBlocks, y)
}

export async function exportReportToPdf(report: Report) {
  const assets: PdfAssets = {
    xmsLogo: await loadImageDataUrl(reportTheme.xmsLogoDark),
    xmsLogoLight: await loadImageDataUrl(reportTheme.xmsLogoLight),
    googleGuaranteedLogo: await loadImageDataUrl('/sem-reports/google-guaranteed-logo.png'),
    googlePartnerLogo: await loadImageDataUrl('/sem-reports/google-partner-logo.png'),
    googleAdsLogo: await loadImageDataUrl('/sem-reports/google-ads-logo.webp'),
  }
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
  const slides = report.slides
    .slice()
    .sort((a, b) => a.order - b.order)

  slides.forEach((slide, index) => {
    if (index > 0) doc.addPage()
    drawChrome(doc, report, slide, assets, slides.length)
    drawSlideBody(doc, slide, report, assets)
  })

  doc.save(`${report.clientName}-${report.month}-${report.year}-SEM-Report.pdf`.replace(/\s+/g, '-'))
}
