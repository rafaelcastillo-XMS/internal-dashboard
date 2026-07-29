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

function replaceEditableControlsWithStaticText(container: HTMLElement) {
  const controls = Array.from(container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'))

  controls.forEach((control) => {
    const replacement = document.createElement('div')
    const bounds = control.getBoundingClientRect()
    const computed = window.getComputedStyle(control)
    const multiline = control instanceof HTMLTextAreaElement

    replacement.className = control.className
    replacement.textContent = control.value
    replacement.style.width = `${bounds.width}px`
    replacement.style.height = `${bounds.height}px`
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
    replacement.style.whiteSpace = multiline ? 'pre-wrap' : 'nowrap'
    // html2canvas calculates native input baselines outside their CSS box on
    // some font sizes. Static text may paint beyond that box without changing
    // layout, which prevents glyphs from being cut at the top or bottom.
    replacement.style.overflow = 'visible'
    replacement.style.overflowWrap = 'anywhere'
    replacement.style.flexShrink = '0'

    control.replaceWith(replacement)
  })
}

function hidePdfOnlyControls(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>('[data-pdf-hide="true"]').forEach((element) => element.remove())
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
    replaceEditableControlsWithStaticText(host)
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
