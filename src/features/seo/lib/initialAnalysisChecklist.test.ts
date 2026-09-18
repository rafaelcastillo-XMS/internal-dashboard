import { describe, expect, it } from 'vitest'
import { itemIdentity, previousChecklistRows, rowKey } from './initialAnalysisChecklist'

describe('Initial Analysis saved evaluations', () => {
  it('reuses the saved GBP access evaluation after moving it to Steven', () => {
    const saved = {
      section: 'google-accounts', item: 'Google Business Profile access',
      status: 'pass', comments: 'Access confirmed', evidence: [{ path: 'existing-proof.pdf' }],
    }
    const rows = { [rowKey(saved.section, saved.item)]: saved }
    expect(rows[rowKey('reviews-reputation-steven', 'Access to Google Business Profile')]).toBe(saved)
    expect(itemIdentity('reviews-reputation-steven', 'Access to Google Business Profile'))
      .toEqual({ section: saved.section, item: saved.item })
    expect(previousChecklistRows([saved])).toEqual([])
  })

  it('keeps broad prior checks visible without marking the new specific checks complete', () => {
    const saved = {
      section: 'tech-seo', item: 'Indexing, sitemap & robots.txt',
      status: 'pass', comments: 'Previous review', evidence: [{ path: 'old-proof.pdf' }],
    }
    const rows = { [rowKey(saved.section, saved.item)]: saved }
    for (const item of ['Indexing in Google', 'Sitemap.xml', 'Robots.txt']) {
      expect(rows[rowKey('tech-seo', item)]).toBeUndefined()
    }
    expect(previousChecklistRows([saved])).toEqual([saved])
  })

  it('keeps unchanged evaluations in the current checklist and unknown records in history', () => {
    const current = { section: 'offsite-seo', item: 'NAP consistency' }
    const older = { section: 'custom-old-section', item: 'Prior custom review' }
    expect(itemIdentity(current.section, current.item)).toEqual(current)
    expect(previousChecklistRows([current, older])).toEqual([older])
  })
})
