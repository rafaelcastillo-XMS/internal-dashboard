import { jsPDF } from 'jspdf'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfWeeklyRow {
  status: string
  accountName: string
  budget: number
  cost: number
}

export interface PdfMonthlyRow {
  status: string
  accountName: string
  budget: number
  spend: number
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  green:       [21,  128, 61]   as [number,number,number],
  greenLight:  [240, 253, 244]  as [number,number,number],
  greenMid:    [187, 247, 208]  as [number,number,number],
  greenText:   [22,  163, 74]   as [number,number,number],
  greenHeader: [209, 250, 229]  as [number,number,number],
  blue:        [29,  78,  216]  as [number,number,number],
  blueLight:   [239, 246, 255]  as [number,number,number],
  blueMid:     [191, 219, 254]  as [number,number,number],
  blueHeader:  [219, 234, 254]  as [number,number,number],
  totals:      [238, 247, 242]  as [number,number,number],
  rowAlt:      [249, 250, 251]  as [number,number,number],
  white:       [255, 255, 255]  as [number,number,number],
  dark:        [17,  24,  39]   as [number,number,number],
  body:        [107, 114, 128]  as [number,number,number],
  muted:       [156, 163, 175]  as [number,number,number],
  border:      [229, 231, 235]  as [number,number,number],
  red:         [239, 68,  68]   as [number,number,number],
  yellow:      [234, 179, 8]    as [number,number,number],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fc(n: number): string {
  if (n === 0) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function setColor(doc: jsPDF, c: [number,number,number], type: 'fill' | 'text' | 'draw') {
  if (type === 'fill')  doc.setFillColor(c[0], c[1], c[2])
  if (type === 'text')  doc.setTextColor(c[0], c[1], c[2])
  if (type === 'draw')  doc.setDrawColor(c[0], c[1], c[2])
}

function cell(doc: jsPDF, text: string, x: number, y: number, w: number, h: number, opts?: {
  bold?: boolean
  color?: [number,number,number]
  align?: 'left' | 'right' | 'center'
  size?: number
}) {
  const { bold = false, color = C.body, align = 'left', size = 7.5 } = opts ?? {}
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  setColor(doc, color, 'text')
  const px = align === 'right' ? x + w - 2.5 : align === 'center' ? x + w / 2 : x + 3
  // Truncate text to fit column width
  const maxW = w - 5
  const lines = doc.splitTextToSize(text, maxW)
  doc.text(lines[0] ?? '', px, y + h / 2 + 2, { align })
}

function drawStatusDot(doc: jsPDF, active: boolean, x: number, cy: number) {
  const color = active ? C.greenText : C.muted
  setColor(doc, color, 'fill')
  // Small filled square as dot
  doc.rect(x + 3, cy - 1.2, 2.4, 2.4, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  setColor(doc, active ? C.greenText : C.body, 'text')
  doc.text(active ? 'Active' : 'Inactive', x + 7, cy + 1.2)
}

// ─── Weekly Table ─────────────────────────────────────────────────────────────

const WEEKLY_COLS = [20, 90, 40, 40, 50, 25] as const
// Total = 265mm

const WEEKLY_HEADERS = ['STATUS', 'ACCOUNT NAME', 'BUDGET', 'PERIOD SPEND', 'REMAINING', '% USED']

const ROW_H  = 8
const HDR_H  = 9
const ML     = 16
const PAGE_W = 297
const PAGE_H = 210
const USABLE = PAGE_W - ML * 2  // 265mm

function drawWeeklyTableHeader(doc: jsPDF, y: number, headerColor: [number,number,number]) {
  setColor(doc, headerColor, 'fill')
  doc.rect(ML, y, USABLE, HDR_H, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  setColor(doc, C.white, 'text')
  let x = ML
  WEEKLY_HEADERS.forEach((h, i) => {
    doc.text(h, x + 3, y + HDR_H / 2 + 2)
    x += WEEKLY_COLS[i]
  })
}

function drawWeeklyRows(
  doc: jsPDF,
  rows: PdfWeeklyRow[],
  startY: number,
  pendingCost: boolean,
): number {
  let y = startY
  rows.forEach((row, ri) => {
    // Check page break
    if (y + ROW_H > PAGE_H - 14) {
      doc.addPage()
      y = 20
    }
    const alt = ri % 2 === 1
    setColor(doc, alt ? C.rowAlt : C.white, 'fill')
    doc.rect(ML, y, USABLE, ROW_H, 'F')

    const active    = row.status === 'ENABLED'
    const remaining = !pendingCost && row.budget > 0 ? row.budget - row.cost : null
    const remNeg    = remaining !== null && remaining < 0
    const pct       = !pendingCost && row.budget > 0 && row.cost > 0 ? (row.cost / row.budget) * 100 : null

    let x = ML
    const cy = y + ROW_H / 2

    // Status
    drawStatusDot(doc, active, x, cy)
    x += WEEKLY_COLS[0]

    // Account
    cell(doc, row.accountName, x, y, WEEKLY_COLS[1], ROW_H, { bold: true, color: C.dark })
    x += WEEKLY_COLS[1]

    // Budget
    cell(doc, fc(row.budget), x, y, WEEKLY_COLS[2], ROW_H, { color: row.budget > 0 ? C.dark : C.muted, align: 'right' })
    x += WEEKLY_COLS[2]

    // Period Spend
    if (pendingCost) {
      cell(doc, 'Pending', x, y, WEEKLY_COLS[3], ROW_H, { color: C.muted, align: 'right' })
    } else {
      cell(doc, fc(row.cost), x, y, WEEKLY_COLS[3], ROW_H, { color: C.red, align: 'right' })
    }
    x += WEEKLY_COLS[3]

    // Remaining
    if (remaining !== null) {
      cell(doc, fc(Math.abs(remaining)) + (remNeg ? ' ↓' : ''), x, y, WEEKLY_COLS[4], ROW_H, {
        bold: true, color: remNeg ? C.red : C.greenText, align: 'right',
      })
    } else {
      cell(doc, '—', x, y, WEEKLY_COLS[4], ROW_H, { color: C.muted, align: 'right' })
    }
    x += WEEKLY_COLS[4]

    // % Used
    cell(doc, pct !== null ? `${pct.toFixed(1)}%` : '—', x, y, WEEKLY_COLS[5], ROW_H, {
      color: pct === null ? C.muted : pct > 90 ? C.red : pct > 70 ? [202, 138, 4] : C.greenText,
      align: 'right',
    })

    // Row separator
    setColor(doc, C.border, 'draw')
    doc.setLineWidth(0.1)
    doc.line(ML, y + ROW_H, ML + USABLE, y + ROW_H)

    y += ROW_H
  })
  return y
}

function drawWeeklyTotals(doc: jsPDF, rows: PdfWeeklyRow[], y: number, pendingCost: boolean): number {
  const totalBudget    = rows.reduce((s, r) => s + r.budget, 0)
  const totalCost      = rows.reduce((s, r) => s + r.cost, 0)
  const totalRemaining = !pendingCost && totalBudget > 0 ? totalBudget - totalCost : null
  const remNeg         = totalRemaining !== null && totalRemaining < 0
  const totalPct       = !pendingCost && totalBudget > 0 && totalCost > 0 ? (totalCost / totalBudget) * 100 : null

  setColor(doc, C.totals, 'fill')
  doc.rect(ML, y, USABLE, ROW_H + 1, 'F')
  setColor(doc, C.greenMid, 'draw')
  doc.setLineWidth(0.4)
  doc.line(ML, y, ML + USABLE, y)

  let x = ML
  cell(doc, 'TOTALS', x + WEEKLY_COLS[0] + 3, y, WEEKLY_COLS[1], ROW_H + 1, { bold: true, color: C.greenText, size: 7 })
  x += WEEKLY_COLS[0] + WEEKLY_COLS[1]

  cell(doc, totalBudget > 0 ? fc(totalBudget) : '—', x, y, WEEKLY_COLS[2], ROW_H + 1, { bold: true, color: C.greenText, align: 'right' })
  x += WEEKLY_COLS[2]

  cell(doc, pendingCost ? 'Pending' : totalCost > 0 ? fc(totalCost) : '—', x, y, WEEKLY_COLS[3], ROW_H + 1, { bold: true, color: pendingCost ? C.muted : C.greenText, align: 'right' })
  x += WEEKLY_COLS[3]

  if (totalRemaining !== null) {
    cell(doc, fc(Math.abs(totalRemaining)) + (remNeg ? ' ↓' : ''), x, y, WEEKLY_COLS[4], ROW_H + 1, { bold: true, color: remNeg ? C.red : C.greenText, align: 'right' })
  } else {
    cell(doc, '—', x, y, WEEKLY_COLS[4], ROW_H + 1, { bold: true, color: C.muted, align: 'right' })
  }
  x += WEEKLY_COLS[4]

  cell(doc, totalPct !== null ? `${totalPct.toFixed(1)}%` : '—', x, y, WEEKLY_COLS[5], ROW_H + 1, { bold: true, color: C.greenText, align: 'right' })

  return y + ROW_H + 1
}

function drawPageHeader(doc: jsPDF, dateLabel: string, pageNum?: number) {
  setColor(doc, C.green, 'fill')
  doc.rect(0, 0, PAGE_W, 26, 'F')
  // Accent strip
  setColor(doc, [16, 185, 129], 'fill')
  doc.rect(0, 23.5, PAGE_W, 2.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  setColor(doc, C.white, 'text')
  doc.text('Google Ads Budget Report', ML, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  setColor(doc, C.greenHeader, 'text')
  doc.text(dateLabel, ML, 19)

  doc.setFontSize(8)
  setColor(doc, C.greenHeader, 'text')
  doc.text('XMS Intelligence', PAGE_W - ML, 10, { align: 'right' })
  setColor(doc, [167, 243, 208], 'text')
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.text(`Generated: ${dateStr}`, PAGE_W - ML, 17.5, { align: 'right' })

  if (pageNum && pageNum > 1) {
    doc.setFontSize(7)
    setColor(doc, [167, 243, 208], 'text')
    doc.text(`(continued)`, PAGE_W / 2, 17.5, { align: 'center' })
  }
}

function drawSectionLabel(
  doc: jsPDF,
  label: string,
  note: string,
  y: number,
  variant: 'ads' | 'guarantee',
) {
  const bg    = variant === 'ads' ? C.greenLight : C.blueLight
  const bord  = variant === 'ads' ? C.greenMid   : C.blueMid
  const color = variant === 'ads' ? C.green       : C.blue

  setColor(doc, bg, 'fill')
  doc.rect(ML, y, USABLE, 8.5, 'F')
  setColor(doc, bord, 'draw')
  doc.setLineWidth(0.3)
  doc.rect(ML, y, USABLE, 8.5, 'S')

  // Dot
  setColor(doc, color, 'fill')
  doc.rect(ML + 4.5, y + 3, 3, 3, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  setColor(doc, color, 'text')
  doc.text(label, ML + 10, y + 5.8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setColor(doc, C.body, 'text')
  doc.text(note, PAGE_W - ML, y + 5.8, { align: 'right' })
}

function drawFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    setColor(doc, C.border, 'draw')
    doc.setLineWidth(0.25)
    doc.line(ML, PAGE_H - 10, PAGE_W - ML, PAGE_H - 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    setColor(doc, C.muted, 'text')
    doc.text('XMS Intelligence Platform · Confidential · Do not distribute', ML, PAGE_H - 5.5)
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W - ML, PAGE_H - 5.5, { align: 'right' })
  }
}

// ─── Public: Weekly PDF ───────────────────────────────────────────────────────

export async function generateWeeklyBudgetPdf(params: {
  dateLabel: string
  adsRows: PdfWeeklyRow[]
  guaranteeRows: PdfWeeklyRow[]
}): Promise<void> {
  const { dateLabel, adsRows, guaranteeRows } = params
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Page 1 header
  drawPageHeader(doc, dateLabel)
  let y = 32

  // ── Google Ads section ────────────────────────────────────────────
  drawSectionLabel(doc, 'GOOGLE ADS', `Period: ${dateLabel} · Google Ads API`, y, 'ads')
  y += 11
  drawWeeklyTableHeader(doc, y, C.green)
  y += HDR_H
  y = drawWeeklyRows(doc, adsRows, y, false)
  y = drawWeeklyTotals(doc, adsRows, y, false)

  if (guaranteeRows.length > 0) {
    const guaranteeHeight = HDR_H + guaranteeRows.length * ROW_H + ROW_H + 1 + 22
    if (PAGE_H - y - 14 < guaranteeHeight) {
      doc.addPage()
      drawPageHeader(doc, dateLabel, 2)
      y = 32
    } else {
      y += 8
    }

    // ── Google Guarantee section ────────────────────────────────────
    drawSectionLabel(doc, 'GOOGLE GUARANTEE', `Period: ${dateLabel}`, y, 'guarantee')
    y += 11
    drawWeeklyTableHeader(doc, y, C.blue)
    y += HDR_H
    y = drawWeeklyRows(doc, guaranteeRows, y, false)
    drawWeeklyTotals(doc, guaranteeRows, y, false)
  }

  drawFooters(doc)

  const filename = `XMS-Budget-Report-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}

// ─── Public: Monthly PDF ──────────────────────────────────────────────────────

export async function generateMonthlyBudgetPdf(params: {
  monthLabel: string
  rows: PdfMonthlyRow[]
}): Promise<void> {
  const { monthLabel, rows } = params
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Header
  setColor(doc, C.green, 'fill')
  doc.rect(0, 0, PAGE_W, 26, 'F')
  setColor(doc, [16, 185, 129], 'fill')
  doc.rect(0, 23.5, PAGE_W, 2.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  setColor(doc, C.white, 'text')
  doc.text('Budget Overview — Monthly', ML, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  setColor(doc, C.greenHeader, 'text')
  doc.text(monthLabel, ML, 19)

  doc.setFontSize(8)
  setColor(doc, C.greenHeader, 'text')
  doc.text('XMS Intelligence', PAGE_W - ML, 10, { align: 'right' })
  setColor(doc, [167, 243, 208], 'text')
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.text(`Generated: ${dateStr}`, PAGE_W - ML, 17.5, { align: 'right' })

  let y = 32

  // Section label
  drawSectionLabel(doc, 'GOOGLE ADS', 'Spend from Google Ads API · sem_yearly_ads', y, 'ads')
  y += 11

  // Table header
  const MCOLS = [20, 90, 35, 35, 35, 50] as const
  const MHDRS = ['STATUS', 'ACCOUNT NAME', 'MONTHLY BUDGET', 'SPEND (GA)', 'REMAINING', '% USED']

  setColor(doc, C.green, 'fill')
  doc.rect(ML, y, USABLE, HDR_H, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  setColor(doc, C.white, 'text')
  let x = ML
  MHDRS.forEach((h, i) => {
    doc.text(h, x + 3, y + HDR_H / 2 + 2)
    x += MCOLS[i]
  })
  y += HDR_H

  // Rows
  rows.forEach((row, ri) => {
    if (y + ROW_H > PAGE_H - 14) {
      doc.addPage()
      y = 20
    }
    setColor(doc, ri % 2 === 1 ? C.rowAlt : C.white, 'fill')
    doc.rect(ML, y, USABLE, ROW_H, 'F')

    const active    = row.status === 'ENABLED'
    const remaining = row.budget > 0 ? row.budget - row.spend : null
    const remNeg    = remaining !== null && remaining < 0
    const pct       = row.budget > 0 ? (row.spend / row.budget) * 100 : null

    let x = ML
    const cy = y + ROW_H / 2
    drawStatusDot(doc, active, x, cy)
    x += MCOLS[0]

    cell(doc, row.accountName, x, y, MCOLS[1], ROW_H, { bold: true, color: C.dark })
    x += MCOLS[1]

    cell(doc, fc(row.budget), x, y, MCOLS[2], ROW_H, { color: row.budget > 0 ? C.dark : C.muted, align: 'right' })
    x += MCOLS[2]

    cell(doc, fc(row.spend), x, y, MCOLS[3], ROW_H, { color: row.spend > 0 ? C.body : C.muted, align: 'right' })
    x += MCOLS[3]

    if (remaining !== null) {
      cell(doc, fc(Math.abs(remaining)) + (remNeg ? ' ↓' : ''), x, y, MCOLS[4], ROW_H, { bold: true, color: remNeg ? C.red : C.greenText, align: 'right' })
    } else {
      cell(doc, '—', x, y, MCOLS[4], ROW_H, { color: C.muted, align: 'right' })
    }
    x += MCOLS[4]

    // % Used bar
    if (pct !== null) {
      const barX  = x + 3
      const barY  = y + ROW_H / 2 - 1.2
      const barW  = 28
      const barH  = 2.4
      const color = pct > 90 ? C.red : pct > 70 ? C.yellow : C.greenText
      setColor(doc, C.border, 'fill')
      doc.rect(barX, barY, barW, barH, 'F')
      setColor(doc, color, 'fill')
      doc.rect(barX, barY, Math.min(pct / 100, 1) * barW, barH, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      setColor(doc, color, 'text')
      doc.text(`${pct.toFixed(1)}%`, barX + barW + 2, y + ROW_H / 2 + 2)
    } else {
      cell(doc, '—', x, y, MCOLS[5], ROW_H, { color: C.muted })
    }

    setColor(doc, C.border, 'draw')
    doc.setLineWidth(0.1)
    doc.line(ML, y + ROW_H, ML + USABLE, y + ROW_H)
    y += ROW_H
  })

  // Totals
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0)
  const totalSpend  = rows.reduce((s, r) => s + r.spend, 0)
  const totalRem    = totalBudget > 0 ? totalBudget - totalSpend : null
  const totalPct    = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : null

  setColor(doc, C.totals, 'fill')
  doc.rect(ML, y, USABLE, ROW_H + 1, 'F')
  setColor(doc, C.greenMid, 'draw')
  doc.setLineWidth(0.4)
  doc.line(ML, y, ML + USABLE, y)

  x = ML
  cell(doc, 'TOTALS', x + MCOLS[0] + 3, y, MCOLS[1], ROW_H + 1, { bold: true, color: C.greenText, size: 7 })
  x += MCOLS[0] + MCOLS[1]
  cell(doc, fc(totalBudget), x, y, MCOLS[2], ROW_H + 1, { bold: true, color: C.greenText, align: 'right' })
  x += MCOLS[2]
  cell(doc, fc(totalSpend), x, y, MCOLS[3], ROW_H + 1, { bold: true, color: C.greenText, align: 'right' })
  x += MCOLS[3]
  if (totalRem !== null) {
    const remNeg = totalRem < 0
    cell(doc, fc(Math.abs(totalRem)) + (remNeg ? ' ↓' : ''), x, y, MCOLS[4], ROW_H + 1, { bold: true, color: remNeg ? C.red : C.greenText, align: 'right' })
  }
  x += MCOLS[4]
  if (totalPct !== null) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    setColor(doc, totalPct > 90 ? C.red : totalPct > 70 ? C.yellow : C.greenText, 'text')
    doc.text(`${totalPct.toFixed(1)}%`, x + 3, y + ROW_H / 2 + 2)
  }

  drawFooters(doc)

  const filename = `XMS-Budget-Monthly-${monthLabel.replace(/\s/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
