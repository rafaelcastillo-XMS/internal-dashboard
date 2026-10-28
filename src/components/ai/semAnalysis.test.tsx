import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { isSemAnalysis, type SemAnalysis } from './semAnalysis'
import { SemAnalysisPanel } from './SemAnalysisPanel'

const analysis: SemAnalysis = {
  analysis: 'Spend is concentrated in Campaign A for the selected period.',
  findings: [{ area: 'account', title: 'Review allocation', evidence: 'Campaign A: $200 spend, 0 reported conversions.', whyItMatters: 'Tracking and conversion lag need verification.', recommendation: 'Review lead measurement before considering a budget change.', severity: 'medium', effort: 'low', requiresClientApproval: true }],
  notVerified: ['Lead quality: conversion action settings are required.'],
  followUpQuestion: 'What would you like to investigate next?',
}

describe('SEM single analysis', () => {
  it('renders evidence, approval requirements, verification gaps and a conversation prompt without timeframes', () => {
    const html = renderToStaticMarkup(<SemAnalysisPanel analysis={analysis} onChooseTopic={() => {}} />)
    for (const content of [analysis.analysis, analysis.findings[0].evidence, 'Requires client approval', analysis.notVerified[0], analysis.followUpQuestion, 'Search terms', 'Landing pages']) expect(html).toContain(content)
    for (const timeframe of ['Short-term', 'Medium-term', 'Long-term']) expect(html).not.toContain(timeframe)
    expect(isSemAnalysis(analysis)).toBe(true)
    expect(isSemAnalysis({ ...analysis, findings: [] })).toBe(true)
  })
  it.each([
    null, { short_term: [], medium_term: [], long_term: [] },
    { ...analysis, findings: [null] }, { ...analysis, findings: [{ ...analysis.findings[0], evidence: '' }] },
    { ...analysis, followUpQuestion: '' }, { ...analysis, notVerified: [1] },
  ])('rejects legacy cached or malformed analyses safely', value => {
    expect(isSemAnalysis(value)).toBe(false)
  })
})
