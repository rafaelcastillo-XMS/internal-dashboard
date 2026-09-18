import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ remove: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {
  storage: { from: () => ({ remove: mocks.remove }) },
  from: () => ({ update: mocks.update }),
} }))

import { removeAuditEvidence } from './auditEvidence'

const admin = { role: 'superadmin' as const, email: 'rafael.castillo@xperienceusa.com' }
const file = { name: 'test.pdf', path: 'client/proof.pdf' }
const other = { name: 'keep.pdf', path: 'client/keep.pdf' }
const row = { client: 'Test client', section: 'tech-seo', item: 'HTTPS active', evidence: [file, other] }

beforeEach(() => {
  vi.resetAllMocks()
  const query = { eq: mocks.eq, select: mocks.select, maybeSingle: mocks.maybeSingle }
  mocks.update.mockReturnValue(query)
  mocks.eq.mockReturnValue(query)
  mocks.select.mockReturnValue(query)
  mocks.remove.mockResolvedValue({ error: null })
  mocks.maybeSingle.mockResolvedValue({ data: { id: 1 }, error: null })
})

describe('removeAuditEvidence', () => {
  it.each([
    { role: 'user' as const, email: admin.email },
    { role: 'superadmin' as const, email: 'another@xperienceusa.com' },
  ])('blocks unauthorized deletion before contacting Supabase: %j', async (access) => {
    await expect(removeAuditEvidence(row, file, 'Reviewer', access)).rejects.toThrow('Only the authorized superadmin')
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('removes only the selected attachment and preserves other evaluation fields', async () => {
    expect(await removeAuditEvidence(row, file, 'Reviewer', admin)).toEqual([other])
    expect(mocks.remove).toHaveBeenCalledWith([file.path])
    expect(mocks.update).toHaveBeenCalledWith({ evidence: [other], updated_by: 'Reviewer', updated_at: expect.any(String) })
    expect(mocks.eq).toHaveBeenCalledWith('client', row.client)
    expect(mocks.eq).toHaveBeenCalledWith('section', row.section)
    expect(mocks.eq).toHaveBeenCalledWith('item', row.item)
    expect(mocks.eq).toHaveBeenCalledWith('evidence', JSON.stringify(row.evidence))
  })

  it('retains the database reference if storage denies deletion', async () => {
    mocks.remove.mockResolvedValue({ error: { message: 'Permission denied' } })
    await expect(removeAuditEvidence(row, file, 'Reviewer', admin)).rejects.toThrow('Permission denied')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('reports a partial failure when the row changed or is not writable', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(removeAuditEvidence(row, file, 'Reviewer', admin)).rejects.toThrow('Reload and retry')
  })

  it('reports a database error rather than claiming successful deletion', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Unavailable' } })
    await expect(removeAuditEvidence(row, file, 'Reviewer', admin)).rejects.toThrow('could not be updated')
  })

  it('refuses to delete a path absent from the evaluation', async () => {
    await expect(removeAuditEvidence(row, { name: 'unknown', path: 'other/file' }, 'Reviewer', admin)).rejects.toThrow('not found')
    expect(mocks.remove).not.toHaveBeenCalled()
  })
})
