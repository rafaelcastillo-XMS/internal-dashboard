import { describe, expect, it, vi } from 'vitest'
import {
  MAX_GBP_IMAGE_BYTES,
  getQuarterlyMonthLabels,
  isSupportedGbpImage,
  validateGbpImageFile,
  prepareGbpImageSelection,
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

  const files = ['views.png', 'calls.png', 'searches.png'].map(name => new File(['image'], name, { type: 'image/png' }))
  const existing = [{ id: 'existing', name: 'original.png', dataUrl: 'original-data' }]

  it('appends a batch of images in selection order and supports adding up to three', async () => {
    const prepare = vi.fn(async (file: File) => `prepared-${file.name}`)
    const result = await prepareGbpImageSelection(files.slice(0, 2), existing, undefined, prepare)
    expect(result.map(image => image.name)).toEqual(['original.png', 'views.png', 'calls.png'])
    expect(result.map(image => image.dataUrl)).toEqual(['original-data', 'prepared-views.png', 'prepared-calls.png'])
    expect(new Set(result.map(image => image.id)).size).toBe(3)
    expect(existing).toEqual([{ id: 'existing', name: 'original.png', dataUrl: 'original-data' }])
  })

  it('rejects excess images before preparing files or changing the selection', async () => {
    const prepare = vi.fn()
    await expect(prepareGbpImageSelection(files, existing, undefined, prepare)).rejects.toThrow('up to 3')
    expect(prepare).not.toHaveBeenCalled()
  })

  it('replaces only the targeted image while preserving its position and id', async () => {
    const selected = [...existing, { id: 'second', name: 'second.png', dataUrl: 'second-data' }, { id: 'third', name: 'third.png', dataUrl: 'third-data' }]
    const result = await prepareGbpImageSelection([files[0]], selected, 'second', async () => 'replacement-data')
    expect(result).toEqual([existing[0], { id: 'second', name: 'views.png', dataUrl: 'replacement-data' }, selected[2]])
    await expect(prepareGbpImageSelection(files, selected, 'second')).rejects.toThrow('one replacement')
  })

  it('preserves existing images if any file in a batch fails preparation', async () => {
    const prepare = vi.fn().mockResolvedValueOnce('first-prepared').mockRejectedValueOnce(new Error('Invalid image'))
    await expect(prepareGbpImageSelection(files.slice(0, 2), existing, undefined, prepare)).rejects.toThrow('Invalid image')
    expect(existing).toEqual([{ id: 'existing', name: 'original.png', dataUrl: 'original-data' }])
  })

  it('ignores a cancelled picker and rejects an unavailable replacement target', async () => {
    const prepare = vi.fn()
    await expect(prepareGbpImageSelection([], existing, undefined, prepare)).resolves.toBe(existing)
    await expect(prepareGbpImageSelection([files[0]], existing, 'missing', prepare)).rejects.toThrow('no longer available')
    expect(prepare).not.toHaveBeenCalled()
  })
})
