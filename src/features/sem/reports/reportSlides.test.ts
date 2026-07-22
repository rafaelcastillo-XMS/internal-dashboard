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

  it('moves legacy next-step text into a separate recommendations slide once', () => {
    const slides = [
      { id: 'next-steps', type: 'next_steps', title: 'Next Steps & Recommendations', order: 10, notes: '', content: {
        textBlocks: [{ id: 'client-recommendations', label: 'Recommendations', value: 'Answer every call promptly.' }],
      } },
      { id: 'final-thank-you', type: 'thank_you', title: 'Final Thank You Slide', order: 11, notes: '', content: {} },
    ] satisfies Slide[]

    const normalized = normalizeReportSlides(slides)
    expect(normalized).toMatchObject([
      {
        id: 'next-steps',
        type: 'next_steps',
        title: 'Next Step & Recommendations',
        order: 1,
        content: { subtitle: 'Priorities for the Month Ahead' },
      },
      {
        id: 'recommendations-content',
        type: 'recommendations',
        title: 'Recommendations',
        order: 2,
        content: {
          textBlocks: [{ id: 'client-recommendations', value: 'Answer every call promptly.' }],
        },
      },
      { id: 'final-thank-you', order: 3 },
    ])
    expect(normalized[0].content.textBlocks).toBeUndefined()

    expect(normalizeReportSlides(normalized)).toHaveLength(3)
  })

  it('adds the editable highlights summary immediately after a legacy highlights divider once', () => {
    const slides = [
      {
        id: 'highlights',
        type: 'highlights',
        title: 'Highlights',
        order: 8,
        notes: '',
        content: { subtitle: 'Summary of Highlights', highlights: ['Legacy highlight'] },
      },
      { id: 'lsa-account-notes', type: 'lsa_notes', title: 'LSA Account Notes', order: 9, notes: '', content: {} },
    ] satisfies Slide[]

    const normalized = normalizeReportSlides(slides)
    expect(normalized).toMatchObject([
      {
        id: 'highlights',
        type: 'highlights',
        order: 1,
        content: { subtitle: 'Summary of Highlights' },
      },
      {
        id: 'highlights-summary',
        type: 'custom',
        title: 'Summary of Highlights',
        order: 2,
        content: {
          customImageSrc: '/sem-reports/highlights-summary.webp',
          textBlocks: [{ id: 'highlights-summary-content' }],
        },
      },
      { id: 'lsa-account-notes', order: 3 },
    ])
    expect(normalized[0].content.highlights).toBeUndefined()
    expect(normalized[1].content.customHtml?.match(/<li>/g)).toHaveLength(5)
    expect(normalized[1].content.customHtml).toContain('<strong>Monthly Budget reviewed and adjusted</strong>')

    expect(normalizeReportSlides(normalized)).toHaveLength(3)
  })
})
