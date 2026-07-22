import type { Report, Slide } from './types'

const removedSlideIds = new Set(['general-strategy-notes'])
const removedSlideTypes = new Set(['strategy'])

export const HIGHLIGHTS_SUMMARY_ITEMS = [
  'Monthly Budget reviewed and adjusted',
  'Removing non-serving keywords: this really helps to declutter your account.',
  'Search Terms Reviewed: Analyzed search terms to identify performance and relevancy.',
  'Negative Keywords Added: Implemented new negative keywords to enhance targeting and reduce irrelevant traffic.',
  'Search Keywords Added: Expanded the keyword list with additional relevant search terms to improve reach.',
]

export function createHighlightsSummarySlide(order: number): Slide {
  return {
    id: 'highlights-summary',
    type: 'custom',
    title: 'Summary of Highlights',
    order,
    notes: 'Summarize the optimizations completed during the month.',
    content: {
      textBlocks: [{
        id: 'highlights-summary-content',
        label: 'Content',
        value: HIGHLIGHTS_SUMMARY_ITEMS.join('\n'),
      }],
      customHtml: `<ul>${HIGHLIGHTS_SUMMARY_ITEMS.map((item) => `<li><strong>${item}</strong></li>`).join('')}</ul>`,
      customImageSrc: '/sem-reports/highlights-summary.webp',
    },
  }
}

export function normalizeReportSlides(slides: Slide[]): Slide[] {
  const sortedSlides = slides
    .filter((slide) => !removedSlideIds.has(slide.id) && !removedSlideTypes.has(slide.type))
    .slice()
    .sort((a, b) => a.order - b.order)

  const hasRecommendationsSlide = sortedSlides.some((slide) => slide.type === 'recommendations')
  const hasHighlightsSummarySlide = sortedSlides.some((slide) => slide.id === 'highlights-summary')
  const expandedSlides: Slide[] = []

  for (const slide of sortedSlides) {
    if (slide.type === 'highlights') {
      const shouldAddSummarySlide = Array.isArray(slide.content.highlights) && !hasHighlightsSummarySlide
      const dividerContent = { ...slide.content }
      delete dividerContent.highlights
      expandedSlides.push({ ...slide, content: dividerContent })
      if (shouldAddSummarySlide) expandedSlides.push(createHighlightsSummarySlide(slide.order + 0.5))
      continue
    }

    if (slide.type !== 'next_steps') {
      expandedSlides.push(slide)
      continue
    }

    const recommendationBlocks = slide.content.textBlocks ?? []
    const dividerContent = { ...slide.content }
    delete dividerContent.textBlocks
    expandedSlides.push({
      ...slide,
      title: slide.title === 'Next Steps & Recommendations' ? 'Next Step & Recommendations' : slide.title,
      content: {
        ...dividerContent,
        subtitle: dividerContent.subtitle ?? 'Priorities for the Month Ahead',
      },
    })

    if (recommendationBlocks.length > 0 && !hasRecommendationsSlide) {
      expandedSlides.push({
        id: 'recommendations-content',
        type: 'recommendations',
        title: 'Recommendations',
        order: slide.order + 0.5,
        notes: 'Keep recommendations practical and tied to client behavior.',
        content: { textBlocks: recommendationBlocks },
      })
    }
  }

  return expandedSlides
    .map((slide, index) => ({
      ...slide,
      order: index + 1,
    }))
}

export function normalizeReport(report: Report): Report {
  return {
    ...report,
    slides: normalizeReportSlides(report.slides),
  }
}
