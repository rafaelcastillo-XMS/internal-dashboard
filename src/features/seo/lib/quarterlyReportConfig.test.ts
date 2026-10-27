import { describe, expect, it } from 'vitest'
import {
  MAX_GBP_IMAGE_BYTES,
  getQuarterlyMonthLabels,
  isSupportedGbpImage,
  validateGbpImageFile,
} from './quarterlyReportConfig'

describe('quarterly report configuration', () => {
  it('shows the three calendar months ending in the report end month', () => {
    expect(getQuarterlyMonthLabels('2026-10-27')).toEqual([
      'August 2026',
      'September 2026',
      'October 2026',
    ])
  })

  it('handles year boundaries without changing the report date range', () => {
    expect(getQuarterlyMonthLabels('2026-01-15')).toEqual([
      'November 2025',
      'December 2025',
      'January 2026',
    ])
  })

  it('accepts only the supported local image formats', () => {
    expect(isSupportedGbpImage({ type: 'image/png' })).toBe(true)
    expect(isSupportedGbpImage({ type: 'image/jpeg' })).toBe(true)
    expect(isSupportedGbpImage({ type: 'image/webp' })).toBe(true)
    expect(isSupportedGbpImage({ type: 'image/gif' })).toBe(false)
  })

  it('checks the real image signature instead of trusting only the MIME type', async () => {
    const png = new Blob([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
    ], { type: 'image/png' })
    const spoofedPng = new Blob(['not an image'], { type: 'image/png' })

    await expect(validateGbpImageFile(png)).resolves.toBeNull()
    await expect(validateGbpImageFile(spoofedPng)).resolves.toBe('The selected file does not contain a valid image.')
  })

  it('rejects empty and oversized images before decoding them', async () => {
    await expect(validateGbpImageFile(new Blob([], { type: 'image/jpeg' })))
      .resolves.toBe('The selected image is empty.')

    const oversized = {
      type: 'image/jpeg',
      size: MAX_GBP_IMAGE_BYTES + 1,
      slice: () => new Blob(),
    } as Blob
    await expect(validateGbpImageFile(oversized)).resolves.toBe('The image must be 10 MB or smaller.')
  })
})
