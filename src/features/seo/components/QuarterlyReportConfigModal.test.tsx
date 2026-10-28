import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { QuarterlyReportConfigModal } from './QuarterlyReportConfigModal'

const baseProps = {
  period: { startDate: '2026-07-29', endDate: '2026-10-27' },
  title: 'Q3 Client Report',
  images: [],
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
        images={[{ id: 'one', name: 'gbp-performance.png', dataUrl: 'data:image/png;base64,AAAA' }]}
      />,
    )

    expect(html).toContain('Google Business Profile preview')
    expect(html).toContain('gbp-performance.png')
    expect(html).toContain('Replace')
    expect(html).toContain('Remove Google Business Profile image')
    expect(html).toContain('Add more images')
    expect(html).toContain('multiple=""')
  })

  it('shows three independent previews and hides the add control at capacity', () => {
    const html = renderToStaticMarkup(<QuarterlyReportConfigModal {...baseProps} images={[
      { id: 'one', name: 'views.png', dataUrl: 'data:image/png;base64,AAAA' },
      { id: 'two', name: 'calls.png', dataUrl: 'data:image/png;base64,BBBB' },
      { id: 'three', name: 'searches.png', dataUrl: 'data:image/png;base64,CCCC' },
    ]} />)
    expect(html.match(/<img /g)).toHaveLength(3)
    expect(html.match(/aria-label="Replace Google Business Profile image /g)).toHaveLength(3)
    expect(html.match(/aria-label="Remove Google Business Profile image /g)).toHaveLength(3)
    expect(html).toContain('All 3 images are ready')
    expect(html).not.toContain('aria-label="Add Google Business Profile images"')
  })

  it('disables file selection and removal while images are being prepared', () => {
    const html = renderToStaticMarkup(<QuarterlyReportConfigModal {...baseProps} preparingImage images={[
      { id: 'one', name: 'views.png', dataUrl: 'data:image/png;base64,AAAA' },
    ]} />)
    expect(html).toMatch(/<input[^>]*type="file"[^>]*disabled=""/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Remove Google Business Profile image 1"/)
  })
})
