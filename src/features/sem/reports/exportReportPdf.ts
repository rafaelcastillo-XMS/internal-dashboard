import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { ReportSlide } from './components'
import type { Report } from './types'

const SLIDE_WIDTH = 1164
const SLIDE_HEIGHT = 655
const EXPORT_VIEWPORT_WIDTH = 1440

async function waitForRenderedAssets(container: HTMLElement) {
  if (document.fonts?.ready) await document.fonts.ready

  const images = Array.from(container.querySelectorAll('img'))
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve()

    return new Promise<void>((resolve) => {
      const finish = () => resolve()
      image.addEventListener('load', finish, { once: true })
      image.addEventListener('error', finish, { once: true })
      window.setTimeout(finish, 5000)
    })
  }))

  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

function createExportHost() {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: `${SLIDE_WIDTH}px`,
    background: '#ffffff',
    pointerEvents: 'none',
  })
  document.body.appendChild(host)
  return host
}

// html2canvas doesn't reliably paint CSS `text-overflow: ellipsis` — a
// truncated cell just cuts the glyphs with no "…", indistinguishable from
// the clipping bug this is meant to replace. Truncating the text itself
// (measured with Canvas2D, same approach as the jsPDF budget-table export)
// guarantees the "…" is real, painted text.
let measureCtx: CanvasRenderingContext2D | null = null

function truncateTextToWidth(text: string, maxWidth: number, font: string): string {
  if (maxWidth <= 0) return ''
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return text
  measureCtx.font = font
  if (measureCtx.measureText(text).width <= maxWidth) return text

  // html2canvas doesn't reliably paint the single-glyph "…" (U+2026) —
  // renders as a stray mark instead of visible dots. ASCII periods paint
  // correctly in every font html2canvas has to fall back to.
  const ellipsis = '...'
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const candidate = text.slice(0, mid).trimEnd() + ellipsis
    if (measureCtx.measureText(candidate).width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo === 0 ? ellipsis : text.slice(0, lo).trimEnd() + ellipsis
}

// Report tables use the browser's automatic table layout, where every column's
// width is solved from the content of every cell in it. html2canvas re-runs
// that solve in its own clone, with its own font metrics, so the columns land
// on widths that no longer match the ones each cell's content was pinned to
// below — every row reads as shifted, as if the table were plain text. Freezing
// the live column widths first makes the clone's solve a no-op. (The LSA table
// already declares `table-fixed` with a colgroup, which is why that one prints
// straight; this gives every other table the same guarantee.)
function pinTableColumnWidths(container: HTMLElement) {
  container.querySelectorAll('table').forEach((table) => {
    const headerCells = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'))
    if (headerCells.length === 0) return

    // Read every width before writing any, so a pinned column can't shift the
    // solution for the columns measured after it.
    const tableWidth = table.getBoundingClientRect().width
    const widths = headerCells.map((cell) => cell.getBoundingClientRect().width)
    if (!tableWidth) return

    table.style.tableLayout = 'fixed'
    table.style.width = `${tableWidth}px`
    headerCells.forEach((cell, index) => { cell.style.width = `${widths[index]}px` })
  })
}

function replaceEditableControlsWithStaticText(container: HTMLElement) {
  const controls = Array.from(container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'))

  // Table columns (e.g. the keywords/search-terms report tables) use the
  // browser's auto table-layout, which sizes every column from the combined
  // content of every cell in it. Reading each control's bounds one at a time
  // while replacing controls in the same pass meant every replacement (an
  // input swapped for a fixed-width div) could itself shift that column
  // solution before the next control's bounds were read — the widths drifted
  // further with each cell, producing a "wavy", increasingly crooked table.
  // Reading every bound up front, against the untouched layout, then
  // replacing everything in a second pass avoids that compounding drift.
  const measurements = controls.map((control) => ({
    control,
    bounds: control.getBoundingClientRect(),
    computed: window.getComputedStyle(control),
    value: control.value,
    // A cell that wraps to two lines still only pushes its own <td> taller;
    // the other cells in that row (rendered top-aligned) stay level with the
    // wrapped cell's first line, so every wrapped row visually splits from
    // its neighbors — a staircase of misaligned rows. Table data truncates
    // with an ellipsis instead, so every row stays exactly one line.
    inTableCell: control.closest('table') !== null,
  }))

  measurements.forEach(({ control, bounds, computed, value, inTableCell }) => {
    const replacement = document.createElement('div')

    replacement.className = control.className
    replacement.style.width = `${bounds.width}px`
    // Table cells wrap, so their height has to follow the text; pinning it
    // would clip the second line.
    if (!inTableCell) replacement.style.height = `${bounds.height}px`
    replacement.style.minWidth = '0'
    replacement.style.boxSizing = computed.boxSizing
    replacement.style.font = computed.font
    replacement.style.lineHeight = computed.lineHeight
    replacement.style.letterSpacing = computed.letterSpacing
    replacement.style.color = computed.color
    replacement.style.textAlign = computed.textAlign
    replacement.style.padding = computed.padding
    replacement.style.border = computed.border
    replacement.style.borderRadius = computed.borderRadius
    replacement.style.background = computed.background
    if (inTableCell) {
      // Keyword and search-term cells carry data the reader needs in full, so
      // a long one wraps onto a second line instead of being cut with an
      // ellipsis. Every cell in a row is top-aligned, so the taller row stays
      // level; the columns are already pinned by pinTableColumnWidths, so the
      // extra line can't widen anything either.
      replacement.textContent = value
      replacement.style.whiteSpace = 'normal'
      replacement.style.overflow = 'visible'
    } else {
      replacement.textContent = value
      // Single-line inputs were forced to `nowrap`, so a title longer than
      // the control's rendered width overflowed horizontally and got clipped
      // by the slide's `overflow: hidden` wrapper. Wrapping instead of
      // clipping is the safer failure mode for exported titles/text blocks.
      replacement.style.whiteSpace = 'pre-wrap'
      // html2canvas calculates native input baselines outside their CSS box
      // on some font sizes. Static text may paint beyond that box without
      // changing layout, which prevents glyphs from being cut at the top or
      // bottom.
      replacement.style.overflow = 'visible'
    }
    replacement.style.overflowWrap = 'anywhere'
    replacement.style.flexShrink = '0'

    control.replaceWith(replacement)
  })
}

function hidePdfOnlyControls(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>('[data-pdf-hide="true"]').forEach((element) => element.remove())
}

// Same html2canvas limitation as replaceEditableControlsWithStaticText above,
// but for static text (client name on the cover slide, ad preview URLs, LSA
// filter labels) that relies on Tailwind's `truncate` (CSS text-overflow:
// ellipsis) instead of an input/textarea — html2canvas paints those elements
// hard-clipped mid-word, with no "…". Baking the ellipsis into the text
// itself fixes every `.truncate` element in one pass instead of one per slide.
function truncateOverflowingStaticText(container: HTMLElement) {
  const elements = Array.from(container.querySelectorAll<HTMLElement>('.truncate'))

  // Read every bound before mutating any element — same reasoning as the
  // measurements pass above: truncating one flex/grid sibling reflows the
  // others, so measuring-then-mutating one at a time drifts.
  const measurements = elements.map((element) => {
    const bounds = element.getBoundingClientRect()
    const computed = window.getComputedStyle(element)
    return { element, bounds, computed }
  })

  measurements.forEach(({ element, bounds, computed }) => {
    const text = element.textContent ?? ''
    if (!text || !bounds.width) return
    const contentWidth = computed.boxSizing === 'content-box'
      ? bounds.width
      : bounds.width - parseFloat(computed.paddingLeft) - parseFloat(computed.paddingRight)
        - parseFloat(computed.borderLeftWidth) - parseFloat(computed.borderRightWidth)
    const fontSpec = `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`
    element.textContent = truncateTextToWidth(text, contentWidth, fontSpec)
    // html2canvas recomputes flex/grid layout in its own clone rather than
    // reusing the live browser's — pin the box to its measured width so it
    // can't land on a narrower one and clip the ellipsis this just baked in.
    element.style.width = `${bounds.width}px`
    element.style.maxWidth = `${bounds.width}px`
    element.style.flex = '0 0 auto'
    // html2canvas measures text with its own font metrics, which run a
    // few px narrower than the browser's for some fonts/sizes — enough to
    // re-clip the "…" this just baked in even though it fit here. The text
    // is already the right length; overflow:hidden has nothing left to do
    // except risk cutting it again, so drop it.
    element.style.overflow = 'visible'
    element.style.whiteSpace = 'nowrap'
  })
}

function imageCanBeSafelyRasterized(image: HTMLImageElement) {
  try {
    const url = new URL(image.currentSrc || image.src, window.location.href)
    return url.protocol === 'data:' || url.protocol === 'blob:' || url.origin === window.location.origin
  } catch {
    return false
  }
}

function rasterizeImagesAtTheirRenderedAspectRatio(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'))

  images.forEach((image) => {
    if (!imageCanBeSafelyRasterized(image) || !image.naturalWidth || !image.naturalHeight) return

    const bounds = image.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return

    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bounds.width * scale))
    canvas.height = Math.max(1, Math.round(bounds.height * scale))
    canvas.style.width = `${bounds.width}px`
    canvas.style.height = `${bounds.height}px`

    const computed = window.getComputedStyle(image)
    canvas.className = image.className
    canvas.style.borderRadius = computed.borderRadius
    canvas.style.background = computed.background

    const context = canvas.getContext('2d')
    if (!context) return

    const sourceRatio = image.naturalWidth / image.naturalHeight
    const targetRatio = bounds.width / bounds.height
    const shouldCover = computed.objectFit === 'cover'
    const drawWidth = (shouldCover ? sourceRatio > targetRatio : sourceRatio < targetRatio)
      ? bounds.height * sourceRatio
      : bounds.width
    const drawHeight = drawWidth / sourceRatio
    const x = (bounds.width - drawWidth) / 2
    const y = (bounds.height - drawHeight) / 2

    context.scale(scale, scale)
    context.drawImage(image, x, y, drawWidth, drawHeight)
    image.replaceWith(canvas)
  })
}

export async function exportReportToPdf(report: Report) {
  const slides = report.slides.slice().sort((a, b) => a.order - b.order)
  const host = createExportHost()
  const root = createRoot(host)

  try {
    flushSync(() => {
      root.render(createElement(
        'div',
        { style: { width: `${SLIDE_WIDTH}px` } },
        slides.map((slide) => createElement(
          'div',
          {
            key: slide.id,
            'data-pdf-slide': slide.id,
            style: {
              width: `${SLIDE_WIDTH}px`,
              height: `${SLIDE_HEIGHT}px`,
              overflow: 'hidden',
              background: '#ffffff',
            },
          },
          createElement(ReportSlide, { report, slide, onChange: () => undefined }),
        )),
      ))
    })

    await waitForRenderedAssets(host)
    hidePdfOnlyControls(host)
    pinTableColumnWidths(host)
    replaceEditableControlsWithStaticText(host)
    truncateOverflowingStaticText(host)
    rasterizeImagesAtTheirRenderedAspectRatio(host)
    const slideNodes = Array.from(host.querySelectorAll<HTMLElement>('[data-pdf-slide]'))
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [SLIDE_WIDTH, SLIDE_HEIGHT],
      hotfixes: ['px_scaling'],
    })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    for (let index = 0; index < slideNodes.length; index += 1) {
      const canvas = await html2canvas(slideNodes[index], {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        windowWidth: EXPORT_VIEWPORT_WIDTH,
        windowHeight: SLIDE_HEIGHT,
      })

      if (index > 0) pdf.addPage([SLIDE_WIDTH, SLIDE_HEIGHT], 'landscape')
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.94),
        'JPEG',
        0,
        0,
        pageWidth,
        pageHeight,
        undefined,
        'FAST',
      )
    }

    pdf.save(`${report.clientName}-${report.month}-${report.year}-SEM-Report.pdf`.replace(/\s+/g, '-'))
  } finally {
    root.unmount()
    host.remove()
  }
}
