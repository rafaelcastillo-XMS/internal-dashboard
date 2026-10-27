import { describe, expect, it } from 'vitest'
import { formatDateLabel } from './useSEODashboardState'

describe('formatDateLabel', () => {
  it('keeps calendar dates stable in time zones west of UTC', () => {
    expect(formatDateLabel('2026-07-29', '2026-10-27')).toBe('Jul 29, 2026 – Oct 27, 2026')
  })
})
