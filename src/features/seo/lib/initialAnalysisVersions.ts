import { supabase } from '@/lib/supabase'
import type { DashboardAccess } from '@/context/DashboardAccessContext'
import { canDeleteAuditEvidence, type AuditEvidence } from './auditEvidence'

interface VersionRow {
  id: number
  position: number
}

interface VersionItemRow {
  evidence: AuditEvidence[] | null
}

/**
 * Code-only maintenance helper. There is intentionally no delete control in the UI.
 * It keeps the original Initial Analysis (position 0) and removes Storage objects
 * before deleting an additional version and its checklist rows.
 */
export async function deleteInitialAnalysisVersion(
  versionId: number,
  access: Pick<DashboardAccess, 'role' | 'email'>,
) {
  if (!canDeleteAuditEvidence(access)) {
    throw new Error('Only the authorized superadmin can delete an Initial Analysis version.')
  }

  const { data: version, error: versionError } = await supabase
    .from('seo_initial_analysis_versions')
    .select('id,position')
    .eq('id', versionId)
    .single()

  if (versionError || !version) throw new Error('Initial Analysis version not found.')
  if ((version as VersionRow).position === 0) throw new Error('The original Initial Analysis cannot be deleted.')

  const { data: items, error: itemsError } = await supabase
    .from('seo_initial_audit_items')
    .select('evidence')
    .eq('analysis_version_id', versionId)

  if (itemsError) throw new Error(`Could not load the version evidence: ${itemsError.message}`)

  const paths = ((items ?? []) as VersionItemRow[])
    .flatMap(item => item.evidence ?? [])
    .map(file => file.path)

  for (let start = 0; start < paths.length; start += 1000) {
    const { error: storageError } = await supabase.storage
      .from('audit-evidence')
      .remove(paths.slice(start, start + 1000))
    if (storageError) throw new Error(`Could not delete the version evidence: ${storageError.message}`)
  }

  const { error: itemsDeleteError } = await supabase
    .from('seo_initial_audit_items')
    .delete()
    .eq('analysis_version_id', versionId)
  if (itemsDeleteError) throw new Error(`Could not delete the version checklist: ${itemsDeleteError.message}`)

  const { data: deleted, error: versionDeleteError } = await supabase
    .from('seo_initial_analysis_versions')
    .delete()
    .eq('id', versionId)
    .select('id')
    .maybeSingle()

  if (versionDeleteError || !deleted) throw new Error('Could not delete the Initial Analysis version.')
}
