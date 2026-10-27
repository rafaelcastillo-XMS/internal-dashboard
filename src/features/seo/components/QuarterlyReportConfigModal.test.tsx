import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { QuarterlyReportConfigModal } from './QuarterlyReportConfigModal'

const baseProps = {
  period: { startDate: '2026-07-29', endDate: '2026-10-27' },
  title: 'Q3 Client Report',
  imageName: '',
  imageDataUrl: '',
  imageError: '',
  reportError: '',
  preparingImage: false,
  generating: false,
  onTitleChange: () => undefined,
  onImageChange: () => undefined,
  onRemoveImage: () => undefined,
  onClose: () => undefined,
  onGenerate: () => undefined,
}

describe('QuarterlyReportConfigModal', () => {
  it('renders the existing report name, exact period, three months, and safe file restrictions', () => {
    const html = renderToStaticMarkup(<QuarterlyReportConfigModal {...baseProps} />)

    expect(html).toContain('Q3 Client Report')
    expect(html).toContain('August 2026')
    expect(html).toContain('September 2026')
    expect(html).toContain('October 2026')
    expect(html).toContain('Jul 29, 2026')
    expect(html).toContain('Oct 27, 2026')
    expect(html).toContain('accept="image/png,image/jpeg,image/webp"')
    expect(html).toContain('up to 10 MB')
  })

  it('renders the prepared preview and replacement controls', () => {
    const html = renderToStaticMarkup(
      <QuarterlyReportConfigModal
        {...baseProps}
        imageName="gbp-performance.png"
        imageDataUrl="data:image/png;base64,AAAA"
      />,
    )

    expect(html).toContain('Google Business Profile preview')
    expect(html).toContain('gbp-performance.png')
    expect(html).toContain('Replace')
    expect(html).toContain('Remove Google Business Profile image')
  })
})
