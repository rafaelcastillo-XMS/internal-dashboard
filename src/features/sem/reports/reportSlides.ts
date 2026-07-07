import type { Report, Slide } from './types'

const removedSlideIds = new Set(['general-strategy-notes'])
const removedSlideTypes = new Set(['strategy'])

export function normalizeReportSlides(slides: Slide[]): Slide[] {
  return slides
    .filter((slide) => !removedSlideIds.has(slide.id) && !removedSlideTypes.has(slide.type))
    .slice()
    .sort((a, b) => a.order - b.order)
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
