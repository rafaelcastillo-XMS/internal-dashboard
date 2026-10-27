import { describe, expect, it } from 'vitest'
import {
  describeClicksTrend,
  describePositionTrend,
  getAuditStatusLabel,
  getSiteSpeedLabel,
} from './quarterlyReportNarrative'

describe('quarterly report client-facing narrative', () => {
  it('keeps positive results direct and frames declines as transparent opportunities', () => {
    expect(describeClicksTrend(12)).toBe('an increase of 12%')
    expect(describeClicksTrend(-12)).toContain('change of -12%')
    expect(describeClicksTrend(-12)).toContain('opportunity')
    expect(describePositionTrend(-2.5)).toBe('shows an opportunity to recover 2.5 positions on average')
  })

  it('uses constructive, non-alarming diagnostic labels', () => {
    expect(getSiteSpeedLabel(95)).toBe('Strong experience')
    expect(getSiteSpeedLabel(70)).toBe('Optimization opportunity')
    expect(getSiteSpeedLabel(30)).toBe('Priority optimization opportunity')
    expect(getAuditStatusLabel('error')).toBe('Audit ready for follow-up')
  })
})
