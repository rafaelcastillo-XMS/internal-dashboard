import type { jsPDF } from 'jspdf'
import { clean } from './exportQuarterlySeoReport'

type RGB = [number, number, number]
export const REPORT = {
  // Matches the xms-blue brand token in tailwind.config.js (#1A72D9).
  brandBlue: [26, 114, 217] as RGB,
  teal: [20, 116, 110] as RGB,
  amber: [153, 92, 33] as RGB,
  ink: [30, 46, 62] as RGB,
  muted: [96, 112, 126] as RGB,
  line: [218, 226, 231] as RGB,
  paper: [249, 250, 248] as RGB,
  pale: [237, 243, 247] as RGB,
  white: [255, 255, 255] as RGB,
  margin: 22,
  width: 166,
  bottom: 265,
}

export interface ReportFonts { regular: string; bold: string; display: string }

export function registerReportFonts(pdf: jsPDF, fonts?: ReportFonts) {
  if (!fonts) return
  pdf.addFileToVFS('Lato-Regular.ttf', fonts.regular)
  pdf.addFont('Lato-Regular.ttf', 'ReportSans', 'normal')
  pdf.addFileToVFS('Lato-Bold.ttf', fonts.bold)
  pdf.addFont('Lato-Bold.ttf', 'ReportSans', 'bold')
  pdf.addFileToVFS('DMSerifDisplay-Regular.ttf', fonts.display)
  pdf.addFont('DMSerifDisplay-Regular.ttf', 'ReportDisplay', 'normal')
}

/** Layout is deliberately scoped to client quarterly reports, not the standalone GBP export. */
export class QuarterlyReportLayout {
  readonly sans: string
  readonly display: string
  private sectionTitle = ''
  private sectionLabel = ''

  constructor(readonly pdf: jsPDF, readonly period: string, readonly client: string, fonts?: ReportFonts) {
    registerReportFonts(pdf, fonts)
    this.sans = fonts ? 'ReportSans' : 'helvetica'
    this.display = fonts ? 'ReportDisplay' : 'times'
  }

  text(text: string, x: number, y: number, width = REPORT.width, size = 10.5, color = REPORT.ink, style = 'normal') {
    const { pdf } = this
    pdf.setFont(this.sans, style)
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
    pdf.setLineHeightFactor(1.5)
    const lines: string[] = pdf.splitTextToSize(clean(text), width)
    pdf.text(lines, x, y)
    return y + lines.length * size * 0.3528 * 1.5
  }

  label(text: string, x: number, y: number, color = REPORT.muted) {
    return this.text(text.toUpperCase(), x, y, REPORT.width, 8, color, 'bold')
  }

  title(text: string, x: number, y: number, width = REPORT.width, size = 29, color = REPORT.brandBlue) {
    this.pdf.setFont(this.display, 'normal')
    this.pdf.setFontSize(size)
    this.pdf.setTextColor(...color)
    this.pdf.setLineHeightFactor(1.12)
    const lines: string[] = this.pdf.splitTextToSize(clean(text), width)
    this.pdf.text(lines, x, y)
    return y + lines.length * size * 0.3528 * 1.12
  }

  fittedTitle(text: string, x: number, y: number, width: number, height: number, size: number, color = REPORT.brandBlue) {
    this.pdf.setFont(this.display, 'normal')
    while (size > 9) {
      this.pdf.setFontSize(size)
      if (this.pdf.splitTextToSize(clean(text), width).length * size * 0.3952 <= height) break
      size -= 1
    }
    return this.title(text, x, y, width, size, color)
  }

  singleLine(text: string, x: number, y: number, width: number, size = 7, color = REPORT.muted) {
    this.pdf.setFont(this.sans, 'normal')
    this.pdf.setFontSize(size)
    let value = clean(text)
    if (this.pdf.getTextWidth(value) > width) {
      while (value.length && this.pdf.getTextWidth(`${value}...`) > width) value = value.slice(0, -1)
      value += '...'
    }
    return this.text(value, x, y, width, size, color)
  }

  page(title: string, label: string, continued = false) {
    this.sectionTitle = title
    this.sectionLabel = label
    const { pdf } = this
    pdf.addPage()
    pdf.setFillColor(...REPORT.paper)
    pdf.rect(0, 0, 210, 297, 'F')
    pdf.setFillColor(...REPORT.brandBlue)
    pdf.rect(0, 0, 5, 297, 'F')
    this.label('XMS / SEARCH INTELLIGENCE', 22, 16, REPORT.brandBlue)
    pdf.setFont(this.sans, 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...REPORT.muted)
    pdf.text(clean(this.period), 188, 16, { align: 'right' })
    pdf.setDrawColor(...REPORT.line)
    pdf.setLineWidth(0.25)
    pdf.line(22, 23, 188, 23)
    this.label(`${label}${continued ? ' / CONTINUED' : ''}`, 22, 35, REPORT.brandBlue)
    return this.title(title, 22, 50) + 7
  }

  ensure(y: number, height: number) {
    return y + height > REPORT.bottom ? this.page(this.sectionTitle, this.sectionLabel, true) : y
  }

  paragraph(text: string, y: number, size = 10.5) {
    this.pdf.setFont(this.sans, 'normal')
    this.pdf.setFontSize(size)
    const lines: string[] = this.pdf.splitTextToSize(clean(text), REPORT.width)
    for (const line of lines) {
      y = this.ensure(y, size * 0.5292)
      this.text(line, 22, y, REPORT.width, size)
      y += size * 0.5292
    }
    return y + 5
  }

  panel(label: string, text: string, y: number, dark = false) {
    this.pdf.setFont(this.sans, 'normal')
    this.pdf.setFontSize(10)
    const lines: string[] = this.pdf.splitTextToSize(clean(text), 148)
    const height = 23 + lines.length * 5.3
    y = this.ensure(y, height + 7)
    this.pdf.setFillColor(...(dark ? REPORT.brandBlue : REPORT.pale))
    this.pdf.rect(22, y, REPORT.width, height, 'F')
    this.pdf.setFillColor(...REPORT.brandBlue)
    this.pdf.rect(22, y, 1.2, height, 'F')
    this.label(label, 30, y + 10, dark ? REPORT.white : REPORT.brandBlue)
    this.text(text, 30, y + 20, 148, 10, dark ? REPORT.white : REPORT.ink)
    return y + height + 9
  }

  metrics(items: { label: string; value: string; detail?: string; color?: RGB }[], y: number) {
    const gap = 6
    const width = (REPORT.width - gap * (items.length - 1)) / items.length
    this.pdf.setFont(this.sans, 'normal')
    this.pdf.setFontSize(8)
    const detailLines = Math.max(...items.map(item => this.pdf.splitTextToSize(clean(item.detail ?? ''), width - 14).length))
    const height = 42 + detailLines * 4.3
    y = this.ensure(y, height + 8)
    items.forEach((item, i) => {
      const x = 22 + i * (width + gap)
      this.pdf.setFillColor(...REPORT.white)
      this.pdf.rect(x, y, width, height, 'F')
      this.pdf.setFillColor(...(item.color ?? REPORT.brandBlue))
      this.pdf.rect(x, y, width, 0.9, 'F')
      // Fit large values instead of allowing them to cross into the adjacent card.
      this.pdf.setFont(this.sans, 'bold')
      this.pdf.setFontSize(26)
      const valueSize = Math.min(26, 26 * (width - 14) / Math.max(this.pdf.getTextWidth(clean(item.value)), 1))
      this.text(item.value, x + 7, y + 20, width - 14, valueSize, REPORT.brandBlue, 'bold')
      this.text(item.label, x + 7, y + 29, width - 14, 9, REPORT.ink, 'bold')
      if (item.detail) this.text(item.detail, x + 7, y + 40, width - 14, 8, item.color ?? REPORT.muted)
    })
    return y + height + 12
  }

  table(headers: string[], rows: string[][], widths: number[], y: number, accents?: (RGB | undefined)[], origin = 22) {
    const tableWidth = widths.reduce((sum, width) => sum + width, 0)
    const header = (top: number) => {
      this.pdf.setFillColor(...REPORT.brandBlue)
      this.pdf.rect(origin, top, tableWidth, 11, 'F')
      let x = origin + 4
      headers.forEach((label, i) => {
        this.text(label, x, top + 7, widths[i] - 8, 7.5, REPORT.white, 'bold')
        x += widths[i]
      })
      return top + 11
    }
    y = header(this.ensure(y, 28))
    rows.forEach((row, index) => {
      this.pdf.setFont(this.sans, 'normal')
      this.pdf.setFontSize(9)
      const wrapped = row.map((cell, i) => this.pdf.splitTextToSize(clean(cell), widths[i] - 8) as string[])
      const lineCount = Math.max(...wrapped.map(lines => lines.length))
      const rowHeight = Math.max(10.5, lineCount * 4.76 + 5)
      if (y + rowHeight > REPORT.bottom) y = header(this.page(this.sectionTitle, this.sectionLabel, true))
      let offset = 0
      while (offset < lineCount) {
        const capacity = Math.max(1, Math.floor((REPORT.bottom - y - 5) / 4.76))
        const count = Math.min(lineCount - offset, capacity)
        const height = Math.max(10.5, count * 4.76 + 5)
        this.pdf.setFillColor(...(index % 2 === 0 ? REPORT.white : REPORT.pale))
        this.pdf.rect(origin, y, tableWidth, height, 'F')
        let x = origin + 4
        wrapped.forEach((lines, i) => {
          const part = lines.slice(offset, offset + count)
          if (part.length) this.text(part.join('\n'), x, y + 6, widths[i] - 8, 9, i === row.length - 1 ? accents?.[index] ?? REPORT.ink : REPORT.ink)
          x += widths[i]
        })
        y += height
        offset += count
        if (offset < lineCount) y = header(this.page(this.sectionTitle, this.sectionLabel, true))
      }
    })
    return y + 10
  }

  chart(values: number[], labels: string[], y: number) {
    y = this.ensure(y, 101)
    if (!values.length) return this.panel('Trend data', 'No organic click trend is available for this reporting period.', y)
    const { pdf } = this
    pdf.setFillColor(...REPORT.white)
    pdf.rect(22, y, REPORT.width, 93, 'F')
    this.label('ORGANIC CLICKS / REPORTING PERIOD', 30, y + 11, REPORT.brandBlue)
    const left = 41, top = y + 24, width = 134, height = 48
    const max = Math.max(...values.filter(Number.isFinite), 1)
    const magnitude = 10 ** Math.floor(Math.log10(max))
    const ceiling = Math.ceil(max / magnitude) * magnitude
    for (let i = 0; i <= 4; i++) {
      const lineY = top + height * i / 4
      pdf.setDrawColor(...REPORT.line)
      pdf.setLineWidth(0.2)
      pdf.line(left, lineY, left + width, lineY)
      pdf.setFont(this.sans, 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(...REPORT.muted)
      pdf.text(new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(ceiling * (1 - i / 4)), left - 4, lineY + 1, { align: 'right' })
    }
    const points = values.map((value, i) => ({
      x: left + (values.length === 1 ? width / 2 : width * i / (values.length - 1)),
      y: top + height * (1 - (Number.isFinite(value) ? value : 0) / ceiling),
    }))
    pdf.setDrawColor(...REPORT.brandBlue)
    pdf.setLineWidth(0.85)
    points.slice(1).forEach((p, i) => pdf.line(points[i].x, points[i].y, p.x, p.y))
    // Sparse markers keep daily series readable; label positions follow the value series.
    const labelStep = Math.max(1, Math.ceil(values.length / 5))
    points.forEach((p, i) => {
      if (i % labelStep !== 0 && i !== points.length - 1) return
      pdf.setFillColor(...REPORT.white)
      pdf.circle(p.x, p.y, 1.4, 'FD')
      const label = labels[i]
      if (label) {
        pdf.setFont(this.sans, 'normal')
        pdf.setFontSize(7)
        pdf.setTextColor(...REPORT.muted)
        pdf.text(clean(label), p.x, top + height + 9, { align: 'center' })
      }
    })
    return y + 101
  }

  performanceScore(score: number, status: string, y: number) {
    y = this.ensure(y, 86)
    const { pdf } = this
    pdf.setFillColor(...REPORT.white)
    pdf.rect(22, y, REPORT.width, 76, 'F')
    const cx = 59, cy = y + 37, radius = 23
    const segments = 80
    const progress = Math.max(0, Math.min(100, score)) / 100
    const accent = score >= 90 ? REPORT.teal : REPORT.amber
    pdf.setLineWidth(2.5)
    pdf.setLineCap('round')
    for (let i = 0; i < segments; i++) {
      const start = (135 + 270 * i / segments) * Math.PI / 180
      const end = (135 + 270 * (i + 1) / segments) * Math.PI / 180
      pdf.setDrawColor(...(i / segments < progress ? accent : REPORT.line))
      pdf.line(cx + radius * Math.cos(start), cy + radius * Math.sin(start), cx + radius * Math.cos(end), cy + radius * Math.sin(end))
    }
    pdf.setFont(this.sans, 'bold')
    pdf.setFontSize(28)
    pdf.setTextColor(...REPORT.brandBlue)
    pdf.text(clean(String(score)), cx, cy + 2, { align: 'center' })
    pdf.setFont(this.sans, 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(...REPORT.muted)
    pdf.text('/ 100', cx, cy + 10, { align: 'center' })
    this.label('MOBILE PERFORMANCE', 98, y + 22, REPORT.brandBlue)
    this.text(status, 98, y + 35, 79, 14, accent, 'bold')
    this.text('Latest available measurement', 98, y + 59, 79, 9, REPORT.muted)
    pdf.setLineCap('butt')
    pdf.setLineWidth(0.25)
    return y + 84
  }

  finish() {
    const { pdf } = this
    const count = pdf.getNumberOfPages()
    for (let page = 2; page < count; page++) {
      pdf.setPage(page)
      pdf.setDrawColor(...REPORT.line)
      pdf.setLineWidth(0.25)
      pdf.line(22, 276, 188, 276)
      this.singleLine(this.client, 22, 283, 140)
      pdf.setFont(this.sans, 'bold')
      pdf.setFontSize(7)
      pdf.text(`${String(page).padStart(2, '0')} / ${String(count).padStart(2, '0')}`, 188, 283, { align: 'right' })
      this.text('Xperience Marketing Solutions', 22, 289, 130, 7, REPORT.muted)
    }
    pdf.setPage(count)
  }
}
