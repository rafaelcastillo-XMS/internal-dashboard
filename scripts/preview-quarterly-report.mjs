import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { jsPDF } from 'jspdf'

// Offline visual fixture. All performance figures below are illustrative.
const root = fileURLToPath(new URL('..', import.meta.url))
const server = await createServer({
  root, configFile: false, server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom',
})
try {
  const { buildClientQuarterlyPdf } = await server.ssrLoadModule('/src/features/seo/lib/exportClientQuarterlyReport.ts')
  const font = async name => (await readFile(resolve(root, 'src/features/seo/assets/fonts', name))).toString('base64')
  const xmsLogo = `data:image/png;base64,${(await readFile(resolve(root, 'public/XMS LOGO - WHITE BACKGROUND.png'))).toString('base64')}`
  const xmsCoverLogo = `data:image/png;base64,${(await readFile(resolve(root, 'public/XMS LOGO - BLACK BACKGROUND.png'))).toString('base64')}`
  const coverPhoto = `data:image/jpeg;base64,${(await readFile(resolve(root, 'src/features/seo/assets/quarterly-cover.jpg'))).toString('base64')}`
  const gbpPaths = process.argv.filter(arg => arg.startsWith('--gbp=')).map(arg => arg.slice(6))
  const gbpImages = await Promise.all(gbpPaths.map(async path => `data:image/png;base64,${(await readFile(path)).toString('base64')}`))
  const clientLogoPath = process.argv.find(arg => arg.startsWith('--client-logo='))?.slice(14)
  const clientLogo = clientLogoPath ? `data:image/png;base64,${(await readFile(clientLogoPath)).toString('base64')}` : undefined
  const pages = [
    { page: '/', clicks: 267, prevClicks: 210, delta: 57 },
    { page: '/sunrooms/', clicks: 186, prevClicks: 160, delta: 26 },
    { page: '/patio-covers/', clicks: 142, prevClicks: 109, delta: 33 },
    { page: '/pergolas/', clicks: 103, prevClicks: 118, delta: -15 },
    { page: '/blog/outdoor-living-ideas-for-your-florida-home/', clicks: 76, prevClicks: 51, delta: 25 },
    { page: '/contact/', clicks: 40, prevClicks: 44, delta: -4 },
  ]
  const data = {
    period: { startDate: '2026-05-01', endDate: '2026-07-31' },
    domain: 'allstarsunrooms.com',
    totals: {
      clicks: '814', impressions: '42.6K', ctr: '1.91%', position: '12.4',
      prevClicks: '692', prevImpressions: '38.1K', clicksDelta: 17.6, impressionsDelta: 11.8, positionDelta: 2.1,
      labels: Array.from({ length: 13 }, (_, i) => ['May 01', 'May 08', 'May 15', 'May 22', 'May 29', 'Jun 05', 'Jun 12', 'Jun 19', 'Jun 26', 'Jul 03', 'Jul 10', 'Jul 17', 'Jul 31'][i]),
      series: [42, 48, 44, 65, 58, 62, 51, 74, 68, 76, 69, 80, 77],
    },
    keywords: {
      top: ['sunrooms port st lucie', 'patio covers florida', 'pergola installation near me', 'screen enclosures port st lucie', 'custom sunrooms florida', 'covered patio ideas', 'pool enclosure services', 'outdoor living florida', 'sunroom contractors', 'all star sunrooms'].map((term, i) => ({ term, clicks: 95 - i * 7, position: 4.2 + i, prevPosition: i === 4 ? null : 6.3 + i, isNew: i === 4 })),
      newTerms: ['custom sunrooms florida', 'modern patio enclosure', 'pergola with roof'], newCount: 3,
    },
    pages: { top: pages, gainers: pages.filter(p => p.delta > 0), losers: pages.filter(p => p.delta < 0) },
    devices: [{ device: 'MOBILE', clicks: 570, pct: 70 }, { device: 'DESKTOP', clicks: 228, pct: 28 }, { device: 'TABLET', clicks: 16, pct: 2 }],
    countries: [{ country: 'United States', clicks: 782, impressions: 40960 }, { country: 'Canada', clicks: 18, impressions: 960 }, { country: 'United Kingdom', clicks: 9, impressions: 520 }],
    conversions: { current: 37, previous: 29, delta: 27.6 }, users: null,
  }
  const pdf = buildClientQuarterlyPdf({
    data, clientName: 'All Star Sunrooms', psiScore: 87,
    ahrefsSnapshots: [
      { snapshot_date: '2026-07-31', domain_rating: 24, backlinks: 1260, referring_domains: 184, organic_keywords: 468, organic_traffic: 814 },
      { snapshot_date: '2026-04-30', domain_rating: 22, backlinks: 1140, referring_domains: 171, organic_keywords: 412, organic_traffic: 692 },
    ],
    onPageAudit: { status: 'completed', landing_page_url: 'https://allstarsunrooms.com/', created_at: '2026-07-28T12:00:00Z' },
  }, jsPDF, { xmsLogo, xmsCoverLogo, coverPhoto, gbpImages, clientLogo, fonts: { regular: await font('Lato-Regular.ttf'), bold: await font('Lato-Bold.ttf'), display: await font('DMSerifDisplay-Regular.ttf') } })
  pdf.setPage(1)
  pdf.setFont('ReportSans', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(255, 255, 255)
  pdf.text('DESIGN PREVIEW / ILLUSTRATIVE METRICS', 105, 244, { align: 'center' })
  const outDir = resolve(root, 'output/pdf')
  await mkdir(outDir, { recursive: true })
  const outPath = resolve(outDir, 'seo-quarterly-design-preview.pdf')
  await writeFile(outPath, Buffer.from(pdf.output('arraybuffer')))
  console.log(`Illustrative preview: ${outPath} (${pdf.getNumberOfPages()} pages)`)
} finally {
  await server.close()
}
