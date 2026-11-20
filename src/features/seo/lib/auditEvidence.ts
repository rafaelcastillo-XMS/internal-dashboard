import { supabase } from '@/lib/supabase'
import type { DashboardAccess } from '@/context/DashboardAccessContext'

export function canDeleteAuditEvidence(access: Pick<DashboardAccess, 'role' | 'email'>) {
  return access.role === 'superadmin' && access.email.trim().toLowerCase() === 'rafael.castillo@xperienceusa.com'
}

export interface AuditEvidence { name: string; path: string }

export async function removeAuditEvidence(
  row: { client: string; analysis_version_id: number; section: string; item: string; evidence: AuditEvidence[] },
  file: AuditEvidence,
  updatedBy: string,
  allowed: boolean, // section owner or superadmin; the DB enforces the same rule
) {
  if (!allowed) throw new Error('Only the section owner or the superadmin can delete attachments.')
  if (!row.evidence.some(entry => entry.path === file.path)) throw new Error('Attachment not found in this evaluation.')

  // Keep the reference on failure so a denied deletion is visible and retryable.
  const { error: storageError } = await supabase.storage.from('audit-evidence').remove([file.path])
  if (storageError) throw new Error(`Could not delete the attachment: ${storageError.message}`)

  const evidence = row.evidence.filter(entry => entry.path !== file.path)
  const { data, error } = await supabase.from('seo_initial_audit_items')
    .update({ evidence, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('client', row.client).eq('analysis_version_id', row.analysis_version_id)
    .eq('section', row.section).eq('item', row.item)
    // Do not overwrite files added by another user while deleting this one.
    .eq('evidence', JSON.stringify(row.evidence))
    .select('id').maybeSingle()
  if (error || !data) {
    throw new Error('The storage deletion completed, but the attachment list could not be updated. Reload and retry removing the attachment.')
  }
  return evidence
}
