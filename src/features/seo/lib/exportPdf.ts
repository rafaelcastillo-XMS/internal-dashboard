/**
 * exportPdf.ts
 * Collects live page data from the DOM and sends a structured payload
 * to the Python/ReportLab backend (/api/export/pdf) for high-quality rendering.
 *
 * Falls back to html2canvas screenshot if the backend is unavailable.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfSummaryCard {
  label: string
  value: string
  note?: string
}

export interface PdfSection {
  heading: string
  body: string
}

export interface PdfTable {
  title: string
  columns: string[]
  rows: string[][]
  note?: string
}

export interface PdfPayload {
  title: string
  subtitle: string
  generatedAt: string
  summaryCards?: PdfSummaryCard[]
  sections?: PdfSection[]
  tables?: PdfTable[]
}

// ─── Page descriptions ────────────────────────────────────────────────────────

const PAGE_DESCRIPTIONS: Record<string, string> = {
  'GSC-Visibility':
    'This report presents organic search performance data sourced from Google Search Console (GSC). ' +
    'It covers total clicks and impressions for the selected date range, average click-through rate (CTR), ' +
    'and average ranking position across all indexed queries. Use this data to assess your overall search visibility ' +
    'and identify trends in audience reach and engagement from organic search.',

  'Keyword-Intelligence':
    'This report details keyword-level performance data from Google Search Console. ' +
    'It lists individual search queries that triggered your site in Google Search, along with each query\'s ' +
    'position, impressions, clicks, and CTR. Queries ranking in positions 4–10 are flagged as Quick Wins — ' +
    'these represent the best optimization opportunities to push rankings into the top 3 with targeted content improvements.',

  'Core-Web-Vitals':
    'This report presents Core Web Vitals performance scores sourced from PageSpeed Insights (Google PSI). ' +
    'It evaluates Largest Contentful Paint (LCP), First Input Delay (FID), Cumulative Layout Shift (CLS), ' +
    'and overall Performance Score for both desktop and mobile environments. These metrics directly influence ' +
    'Google Search rankings and user experience quality.',

  'Mobile-Usability':
    'This report contains results from a Google PageSpeed Insights mobile usability audit. ' +
    'It evaluates whether your website meets Google\'s mobile-friendliness requirements, including ' +
    'viewport configuration, tap target sizing, text legibility, and responsive layout compliance. ' +
    'Mobile usability issues can negatively impact your site\'s ranking in Google Search on mobile devices.',

  'GA4-Engagement':
    'This report presents user engagement metrics sourced from Google Analytics 4 (GA4). ' +
    'It includes sessions, engaged sessions, engagement rate, average engagement time per session, ' +
    'bounce rate, and event counts. These metrics reflect how effectively your content retains and ' +
    'engages visitors after they arrive from any traffic source.',

  'Traffic-Quality':
    'This report analyzes traffic quality and audience behavior using Google Analytics 4 data. ' +
    'It examines session sources, new vs. returning user ratios, top landing pages, and ' +
    'conversion-related events. Use this data to evaluate the value of each traffic channel ' +
    'and identify pages that drive the most meaningful user interactions.',

  'SEM-Overview':
    'This report provides a comprehensive overview of Google Ads account performance for the selected period. ' +
    'It summarizes total spend, impressions, clicks, CTR, average CPC, conversions, and cost-per-conversion. ' +
    'Use this report to evaluate overall ad effectiveness, budget efficiency, and return on ad spend (ROAS) ' +
    'across all active campaigns.',

  'SEM-Campaigns':
    'This report breaks down Google Ads performance by individual campaign for the selected date range. ' +
    'Each row represents one campaign with its impressions, clicks, CTR, average CPC, total spend, ' +
    'conversions, and cost-per-conversion. Use this data to identify top-performing campaigns, ' +
    'allocate budget more effectively, and pause or optimize underperforming ad sets.',

  'SEM-Keywords':
    'This report lists the top 100 keywords by spend from your Google Ads account for the selected period. ' +
    'Each keyword includes its match type, quality score, impressions, clicks, CTR, avg. CPC, total cost, ' +
    'and conversions. Quality Score is a key efficiency indicator — keywords with scores below 5 should be ' +
    'reviewed for ad relevance, landing page quality, and expected CTR improvements.',

  'Social-Intelligence':
    'This report provides a summary of social media performance across connected platforms. ' +
    'It includes key engagement metrics such as reach, impressions, interactions, follower growth, ' +
    'and content performance. Use this data to measure social media ROI, benchmark performance ' +
    'across channels, and inform your content and posting strategy.',
}

// ─── DOM data extraction ──────────────────────────────────────────────────────

function extractSummaryCards(): PdfSummaryCard[] {
  const cards: PdfSummaryCard[] = []
  // CardDataStats components render a title + value in specific elements
  const cardEls = document.querySelectorAll('[data-pdf-card]')
  if (cardEls.length > 0) {
    cardEls.forEach((el) => {
      const label = el.getAttribute('data-pdf-label') || ''
      const value = el.getAttribute('data-pdf-value') || ''
      const note  = el.getAttribute('data-pdf-note')  || undefined
      if (label) cards.push({ label, value, note })
    })
    return cards
  }

  // Fallback: scrape stat cards by common patterns
  document.querySelectorAll('.rounded-xl, .rounded-lg').forEach((el) => {
    const title = el.querySelector('p, span')?.textContent?.trim()
    const value = el.querySelector('h4, h3, .text-2xl, .text-3xl')?.textContent?.trim()
    if (title && value && value.length < 30 && cards.length < 8) {
      cards.push({ label: title, value })
    }
  })
  return cards
}

function extractTables(): PdfTable[] {
  const tables: PdfTable[] = []
  document.querySelectorAll('table').forEach((tableEl) => {
    const headers: string[] = []
    const rows: string[][] = []

    tableEl.querySelectorAll('thead th').forEach((th) => {
      headers.push(th.textContent?.trim() || '')
    })

    tableEl.querySelectorAll('tbody tr').forEach((tr) => {
      const row: string[] = []
      tr.querySelectorAll('td').forEach((td) => {
        // Get plain text, strip badges/icons
        row.push(td.textContent?.trim().replace(/[\u{1F300}-\u{1FFFF}]/gu, '').replace(/\s+/g, ' ') || '')
      })
      if (row.length > 0 && row.some((c) => c.length > 0)) rows.push(row)
    })

    if (headers.length > 0 && rows.length > 0) {
      // Find nearest heading above the table
      let heading = ''
      let el: Element | null = tableEl.closest('.rounded-xl, .rounded-lg, section')
      if (el) {
        const h = el.querySelector('h2, h3, h4')
        heading = h?.textContent?.trim() || ''
      }
      tables.push({
        title: heading || 'Data Table',
        columns: headers,
        rows: rows.slice(0, 100), // cap at 100 rows
      })
    }
  })
  return tables
}

// ─── Backend PDF export ───────────────────────────────────────────────────────

async function exportViaBackend(payload: PdfPayload, filename: string): Promise<boolean> {
  try {
    const response = await fetch('/api/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, payload }),
    })

    if (!response.ok) return false

    const blob = await response.blob()
    if (blob.size < 100) return false

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    return true
  } catch {
    return false
  }
}

// ─── Fallback: screenshot PDF ─────────────────────────────────────────────────

async function exportViaScreenshot(title: string, filename: string): Promise<void> {
  const [h2cMod, jspdfMod] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const html2canvas = h2cMod.default || (h2cMod as any)
  const jsPDF = jspdfMod.jsPDF || jspdfMod.default || (jspdfMod as any)

  const element = document.querySelector('main') || document.body
  if (!element) return

  const originalScrollY = window.scrollY
  window.scrollTo(0, 0)

  try {
    const canvas = await html2canvas(element as HTMLElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0F1117',
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: 'a4',
      hotfixes: ['px_scaling']
    })

    pdf.setProperties({
      title: title,
      subject: 'XMS Intelligence Report',
      author: 'XMS Ai Platform',
      creator: 'XMS Ai Dashboard'
    })

    const pdfW = pdf.internal.pageSize.getWidth()
    const pdfH = pdf.internal.pageSize.getHeight()

    // Fit to width, let height spill over multiple pages
    const ratio = pdfW / canvas.width
    const canvasImgHeightInPdfUnits = canvas.height * ratio
    const pages = Math.ceil(canvasImgHeightInPdfUnits / pdfH)

    for (let i = 0; i < pages; i++) {
      if (i > 0) pdf.addPage()
      const yOffset = -(i * pdfH)
      pdf.addImage(
        imgData,
        'PNG',
        0,
        yOffset,
        canvas.width * ratio,
        canvas.height * ratio,
        undefined,
        'FAST'
      )
    }

    pdf.save(filename)
  } catch (err) {
    console.error('[exportPdf] Screenshot export failed:', err)
  } finally {
    window.scrollTo(0, originalScrollY)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ExportPdfOptions {
  /** Data to inject directly — bypasses DOM scraping when provided */
  summaryCards?: PdfSummaryCard[]
  tables?: PdfTable[]
  extraSections?: PdfSection[]
  subtitle?: string
}

export async function exportPageToPdf(
  pageTitle = 'Dashboard',
  options: ExportPdfOptions = {},
): Promise<void> {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10)
  const filename = `XMS-${pageTitle}-${dateStr}.pdf`

  const description = PAGE_DESCRIPTIONS[pageTitle] || ''
  const humanTitle  = pageTitle.replace(/-/g, ' ')

  const summaryCards = options.summaryCards ?? extractSummaryCards()
  const tables       = options.tables       ?? extractTables()

  const sections: PdfSection[] = []
  if (description) {
    sections.push({ heading: 'About This Report', body: description })
  }
  if (options.extraSections) sections.push(...options.extraSections)

  const payload: PdfPayload = {
    title:       `XMS Intelligence — ${humanTitle}`,
    subtitle:    options.subtitle ?? `Report generated by XMS Ai Platform`,
    generatedAt: date.toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }),
    summaryCards: summaryCards.length > 0 ? summaryCards : undefined,
    sections:     sections.length > 0 ? sections : undefined,
    tables:       tables.length > 0 ? tables : undefined,
  }

  const success = await exportViaBackend(payload, filename)
  if (!success) {
    console.warn('[exportPdf] Backend unavailable, falling back to screenshot export.')
    await exportViaScreenshot(humanTitle, filename)
  }
}
