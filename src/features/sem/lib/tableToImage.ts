import html2canvas from 'html2canvas'

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Renders a small, static, purpose-built table off-screen and rasterizes it —
// used for embedding a table as an image in an email body. Deliberately not
// the live interactive table DOM: that has inputs/selects/hover states that
// don't belong in a static email, and would drag in exportReportPdf.ts's
// input-replacement machinery for no benefit here.
// CSS pixel dimensions alongside the data URL: email clients that strip
// inline `style` (Outlook, some Gmail views) fall back to the <img> tag's
// raw width/height HTML attributes. Without them the image renders at its
// full physical pixel size — double, since the canvas is rasterized at
// scale:2 — which is what made the emailed tables look huge/broken.
export interface CapturedTableImage {
  dataUrl: string
  width: number
  height: number
}

export async function captureTableAsImage(opts: {
  title: string
  headers: string[]
  rows: string[][]
}): Promise<CapturedTableImage> {
  const { title, headers, rows } = opts
  const host = document.createElement('div')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    background: '#ffffff',
  })
  document.body.appendChild(host)

  const headerCells = headers
    .map((h) => `<th style="text-align:left;padding:10px 14px;background:#eff6ff;color:#1A72D9;font-weight:700;text-transform:uppercase;font-size:13px;letter-spacing:0.04em;border-bottom:1px solid #dbeafe;white-space:nowrap;">${escapeHtml(h)}</th>`)
    .join('')

  const bodyRows = rows.length > 0
    ? rows.map((row, i) => `<tr style="background:${i % 2 ? '#f9fafb' : '#ffffff'};">${row.map((cell) => `<td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:15px;white-space:nowrap;">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}" style="padding:20px;text-align:center;color:#9ca3af;font-size:15px;">No data for this period.</td></tr>`

  host.innerHTML = `
    <div style="display:inline-block;font-family:Inter,system-ui,-apple-system,sans-serif;padding:18px;border:1px solid #e5e7eb;border-radius:8px;">
      <h3 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">${escapeHtml(title)}</h3>
      <table style="border-collapse:collapse;"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
    </div>
  `

  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

  try {
    const scale = 2
    const canvas = await html2canvas(host, { backgroundColor: '#ffffff', scale })
    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width / scale, height: canvas.height / scale }
  } finally {
    host.remove()
  }
}
