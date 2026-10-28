import { jsPDF } from 'jspdf'
import type { BudgetReportTable, BudgetTableRow } from '../reports/budgetReportTables'

const MARGIN = 12
const PAD = 2
const LINE = 3.7
const FONT = 8
const GREEN: [number, number, number] = [22, 163, 74]
const INK: [number, number, number] = [17, 24, 39]
const GRAY: [number, number, number] = [107, 114, 128]

/** Paint an already-processed dashboard table. No reporting calculations here. */
export function renderBudgetTablePdf({ table, title, period, weekly, logoDataUrl }: {
  table: BudgetReportTable; title: string; period: string; weekly: boolean; logoDataUrl?: string | null
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: weekly ? 'a3' : 'a4', compress: true })
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const usable = width - 2 * MARGIN
  const bottom = height - 16
  const weights = weekly
    ? [44, 25, 30, 27, ...Array(table.headers.length - 4).fill(28)]
    : [64, 30, 37, 34, 30, 44, 34]
  if (table.headers.length !== weights.length) throw new Error('Report columns do not match the PDF layout')
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const widths = weights.map(w => w / totalWeight * usable)
  const rightAligned = (i: number) => weekly ? i >= 3 : i >= 3 && i <= 5
  let y = 0
  let tableTop = 0

  function setFont(bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(FONT)
  }
  function wrap(cells: (string | number)[], bold = false) {
    if (cells.length !== widths.length) throw new Error('Report row does not match its columns')
    return cells.map((value, i): string[] => {
      setFont(bold || i === 0)
      return doc.splitTextToSize(String(value), widths[i] - PAD * 2)
    })
  }
  const rowHeight = (lines: string[][]) => Math.max(8, Math.max(...lines.map(c => c.length)) * LINE + PAD * 2)

  function paintRow(lines: string[][], h: number, options: { header?: boolean; total?: boolean; shaded?: boolean } = {}) {
    doc.setFillColor(...(options.total ? [238, 247, 242] : options.header ? [243, 244, 246] : options.shaded ? [238, 245, 255] : [255, 255, 255]) as [number, number, number])
    doc.rect(MARGIN, y, usable, h, 'F')
    let x = MARGIN
    lines.forEach((cell, i) => {
      setFont(options.header || options.total || i === 0)
      doc.setTextColor(...(options.total ? GREEN : options.header ? GRAY : INK))
      const right = !options.header && rightAligned(i)
      doc.text(cell, right ? x + widths[i] - PAD : x + PAD, y + PAD + 2.8, { align: right ? 'right' : 'left', lineHeightFactor: LINE / (FONT * 25.4 / 72) })
      x += widths[i]
    })
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(options.total ? 0.35 : 0.15)
    doc.line(MARGIN, y + h, width - MARGIN, y + h)
    y += h
  }

  function pageHeader(first: boolean) {
    doc.setFillColor(...GREEN)
    doc.rect(MARGIN, 10, usable, 1, 'F')
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.text(title, MARGIN, 21)
    doc.setTextColor(...GRAY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(period, MARGIN, 28)
    if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', width - MARGIN - 32, 16, 32, 32 * 370 / 1314, 'xms-logo', 'MEDIUM')
    else {
      doc.setFont('helvetica', 'bold')
      doc.text('XMS Intelligence', width - MARGIN, 21, { align: 'right' })
    }
    y = 35
    if (first && table.summary.length) {
      const gap = 4
      const boxWidth = (usable - gap * (table.summary.length - 1)) / table.summary.length
      const labels = table.summary.map(s => {
        doc.setFontSize(7)
        return doc.splitTextToSize(s.label, boxWidth - 6) as string[]
      })
      const values = table.summary.map(s => {
        doc.setFontSize(11)
        return doc.splitTextToSize(s.value, boxWidth - 6) as string[]
      })
      const valueHeight = Math.max(...values.map(v => v.length)) * 4.5
      const boxHeight = 6 + valueHeight + Math.max(...labels.map(l => l.length)) * 3
      table.summary.forEach((s, i) => {
        const x = MARGIN + i * (boxWidth + gap)
        doc.setFillColor(243, 244, 246)
        doc.roundedRect(x, y, boxWidth, boxHeight, 1.5, 1.5, 'F')
        doc.setTextColor(...GREEN)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text(values[i], x + 3, y + 6, { lineHeightFactor: 1.15 })
        doc.setTextColor(...GRAY)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text(labels[i], x + 3, y + 5 + valueHeight, { lineHeightFactor: 1.15 })
      })
      y += boxHeight + 6
    }
    const headers = wrap(table.headers, true)
    paintRow(headers, rowHeight(headers), { header: true })
    tableTop = y
  }
  const newPage = () => { doc.addPage(); pageHeader(false) }
  pageHeader(true)

  function drawRow(row: BudgetTableRow, name: string, shaded: boolean, total = false) {
    const cells = [...row.cells]
    let lines = wrap(cells, total)
    if (y > tableTop && y + rowHeight(lines) > bottom) {
      newPage()
      if (!total && !cells[0]) cells[0] = `${name} (continued)`
      lines = wrap(cells, total)
    }
    // Exceptionally long client/campaign names can span pages without clipping.
    while (true) {
      const capacity = Math.floor((bottom - y - PAD * 2) / LINE)
      const count = Math.max(...lines.map(c => c.length))
      if (count <= capacity) { paintRow(lines, rowHeight(lines), { total, shaded }); break }
      if (capacity < 1) { newPage(); continue }
      const chunk = lines.map(c => c.slice(0, capacity))
      paintRow(chunk, rowHeight(chunk), { total, shaded })
      lines = lines.map(c => c.slice(capacity))
      newPage()
      if (!total && !lines[0].length) lines[0] = doc.splitTextToSize(`${name} (continued)`, widths[0] - PAD * 2)
    }
  }

  function drawGroupHeader(name: string) {
    setFont(true)
    const lines = doc.splitTextToSize(name, usable - PAD * 2) as string[]
    const h = Math.max(7, lines.length * LINE + PAD * 2)
    if (y > tableTop && y + h > bottom) newPage()
    doc.setFillColor(238, 245, 255)
    doc.rect(MARGIN, y, usable, h, 'F')
    doc.setTextColor(...INK)
    doc.text(lines, MARGIN + PAD, y + PAD + 2.8, { lineHeightFactor: LINE / (FONT * 25.4 / 72) })
    y += h
  }

  table.groups.forEach(group => {
    const groupHeaderHeight = weekly ? Math.max(7, (doc.splitTextToSize(group.name, usable - PAD * 2) as string[]).length * LINE + PAD * 2) : 0
    const groupHeight = groupHeaderHeight + group.rows.reduce((sum, row) => sum + rowHeight(wrap(row.cells)), 0)
    // Keep normal client groups together; oversized groups continue with their name.
    const continuationHeaderHeight = rowHeight(wrap(table.headers, true))
    const fullPageSpace = bottom - 35 - continuationHeaderHeight
    if (y > tableTop && y + groupHeight > bottom && groupHeight <= fullPageSpace) newPage()
    if (weekly) drawGroupHeader(group.name)
    group.rows.forEach((row, rowIndex) => {
      if (weekly && y > tableTop && y + rowHeight(wrap(row.cells)) > bottom) {
        newPage()
        drawGroupHeader(`${group.name} (continued)`)
      }
      drawRow(row, group.name, !weekly && rowIndex === 0)
    })
  })
  if (!table.groups.length) {
    setFont()
    doc.setTextColor(...GRAY)
    doc.text('No accounts found.', MARGIN + PAD, y + 7)
  }
  const totalsHeight = table.totals.reduce((sum, row) => sum + rowHeight(wrap(row.cells, true)), 0)
  if (table.totals.length && y + totalsHeight > bottom) newPage()
  table.totals.forEach(row => drawRow(row, '', false, true))

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(229, 231, 235)
    doc.line(MARGIN, height - 11, width - MARGIN, height - 11)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text('XMS Intelligence Platform - Confidential', MARGIN, height - 6)
    doc.text(`Page ${p} of ${pages}`, width - MARGIN, height - 6, { align: 'right' })
  }
  return doc
}
