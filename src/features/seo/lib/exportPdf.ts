export async function exportPageToPdf(title = 'Dashboard') {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const element = document.querySelector('main')
  if (!element) return

  const canvas = await html2canvas(element as HTMLElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#0F1117',
    scrollY: -window.scrollY,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' })

  const pdfW = pdf.internal.pageSize.getWidth()
  const pdfH = pdf.internal.pageSize.getHeight()
  const ratio = Math.min(pdfW / canvas.width, pdfH / canvas.height)
  const pages = Math.ceil((canvas.height * ratio) / pdfH)

  for (let i = 0; i < pages; i++) {
    if (i > 0) pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, -(i * pdfH), canvas.width * ratio, canvas.height * ratio)
  }

  const date = new Date().toISOString().slice(0, 10)
  pdf.save(`XMS-${title.replace(/\s+/g, '-')}-${date}.pdf`)
}
