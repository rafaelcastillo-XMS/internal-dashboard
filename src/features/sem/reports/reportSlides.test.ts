import { describe, expect, it } from 'vitest'
import { normalizeReportSlides } from './reportSlides'
import type { Slide } from './types'

describe('normalizeReportSlides', () => {
  it('removes the strategy slide and renumbers the remaining slides', () => {
    const slides = [
      { id: 'cover', type: 'cover', title: 'Cover', order: 1, notes: '', content: {} },
      { id: 'general-strategy-notes', type: 'strategy', title: 'Strategy', order: 2, notes: '', content: {} },
      { id: 'google-ads-key-stats', type: 'google_ads_kpis', title: 'Google Ads', order: 3, notes: '', content: {} },
    ] satisfies Slide[]

    expect(normalizeReportSlides(slides)).toMatchObject([
      { id: 'cover', order: 1 },
      { id: 'google-ads-key-stats', order: 2 },
    ])
  })
})
