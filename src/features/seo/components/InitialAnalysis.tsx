import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, X } from 'lucide-react'
import { useDashboardAccess } from '@/context/useDashboardAccess'
import { removeAuditEvidence, canDeleteAuditEvidence } from '../lib/auditEvidence'
import { SlideToConfirmDialog } from './SlideToConfirmDialog'

import { SECTIONS, itemIdentity, rowKey, previousChecklistRows, type Accent, type SectionDef } from '../lib/initialAnalysisChecklist'

const TEAM = [...new Set(SECTIONS.map(s => s.assignee))]

const DEFAULT_ANALYSIS_VERSIONS = [
  { title: 'Initial Analysis', position: 0 },
  { title: '3 months analysis', position: 1 },
  { title: '6 months analysis', position: 2 },
  { title: '12 months analysis', position: 3 },
] as const

const ACCENT: Record<Accent, { text: string; border: string; bg: string; bar: string }> = {
  blue:    { text: 'text-[#1A72D9]',   border: 'border-[#1A72D9]/40',   bg: 'bg-[#1A72D9]/10',   bar: 'bg-[#1A72D9]' },
  orange:  { text: 'text-orange-500',  border: 'border-orange-400/50',  bg: 'bg-orange-500/10',  bar: 'bg-orange-500' },
  amber:   { text: 'text-amber-500',   border: 'border-amber-400/50',   bg: 'bg-amber-500/10',   bar: 'bg-amber-500' },
  purple:  { text: 'text-purple-500',  border: 'border-purple-400/50',  bg: 'bg-purple-500/10',  bar: 'bg-purple-500' },
  emerald: { text: 'text-emerald-500', border: 'border-emerald-400/50', bg: 'bg-emerald-500/10', bar: 'bg-emerald-500' },
  red:     { text: 'text-red-500',     border: 'border-red-400/50',     bg: 'bg-red-500/10',     bar: 'bg-red-500' },
}

// ─── DB row ───────────────────────────────────────────────────────────────────

interface EvidenceFile { name: string; path: string }

interface ItemRow {
  id?: number
  client: string
  analysis_version_id: number
  section: string
  item: string
  status: string | null       // pass / fail / na
  comments: string | null
  evidence: EvidenceFile[]
  updated_by: string | null
}

interface AnalysisVersion {
  id: number
  client: string
  title: string
  position: number
  created_by: string | null
  created_at: string
}

const initials = (name: string) => name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()

// ─── Small pieces ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, barCls = 'bg-[#1A72D9]', trackCls = '' }: { pct: number; barCls?: string; trackCls?: string }) {
  return (
    <div className={`h-2 w-full rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden ${trackCls}`}>
      <div className={`h-full rounded-full transition-all duration-500 ${barCls}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function SectionStatusBadge({ done, total }: { done: number; total: number }) {
  if (total > 0 && done === total)
    return <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Completed</span>
  if (done > 0)
    return <span className="rounded-full bg-orange-100 px-3 py-0.5 text-xs font-semibold text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">In progress</span>
  return <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-semibold text-gray-500 dark:bg-gray-500/15 dark:text-gray-400">Pending</span>
}

// ─── Main component ───────────────────────────────────────────────────────────

// Comments wrap to 3 lines; longer notes get a "See more" toggle that grows the cell to fit.
function CommentCell({ value, disabled, onChange, onBlur }: { value: string; disabled: boolean; onChange: (value: string) => void; onBlur: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = ''
    setOverflows(el.scrollHeight > el.clientHeight + 1)
    if (expanded) el.style.height = `${el.scrollHeight}px`
  }, [value, expanded])

  return (
    <td className={`px-5 py-4 align-top transition-[min-width] ${expanded ? 'min-w-[420px]' : 'min-w-[260px]'}`}>
      <textarea
        ref={ref}
        rows={3}
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="Add a note…"
        className="block w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent bg-gray-100 px-3.5 py-2 text-sm leading-5 text-black outline-none transition placeholder-body focus:border-[#1A72D9]/50 dark:bg-white/5 dark:text-[#E2E5E9] dark:placeholder-bodydark"
      />
      {(overflows || expanded) && (
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => setExpanded(v => !v)}
          className="mt-1 text-xs font-semibold text-[#1A72D9] hover:underline"
        >
          {expanded ? 'See less' : 'See more'}
        </button>
      )}
    </td>
  )
}

export function InitialAnalysis({ clientName, domain }: { clientName: string; domain: string }) {
  const access = useDashboardAccess()
  const canDeleteEvidence = canDeleteAuditEvidence(access)
  // Section owners come from seo_section_owners, the same table the DB guard uses.
  const [owners, setOwners] = useState<Record<string, string>>({})
  useEffect(() => {
    supabase.from('seo_section_owners').select('section,email').then(({ data, error: ownersErr }) => {
      if (ownersErr) { setError(`Could not load section owners: ${ownersErr.message}`); return }
      setOwners(Object.fromEntries((data ?? []).map(o => [o.section, o.email])))
    })
  }, [])
  const canEditSection = (section: SectionDef) => canDeleteEvidence || owners[section.key] === access.email.trim().toLowerCase()
  const [versions, setVersions] = useState<AnalysisVersion[]>([])
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null)
  const [showVersionForm, setShowVersionForm] = useState(false)
  const [versionTitle, setVersionTitle] = useState('')
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [rows, setRows] = useState<Record<string, ItemRow>>({})
  const [teamTab, setTeamTab] = useState<string>('all')       // 'all' | team member
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({}) // unsaved comment edits
  const [uploading, setUploading] = useState<string | null>(null)  // rowKey being uploaded
  const [deleting, setDeleting] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ row: ItemRow; file: EvidenceFile } | null>(null)
  const [userName, setUserName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const meta = data.session?.user?.user_metadata
      setUserName(meta?.full_name || meta?.name || data.session?.user?.email || 'Unknown')
    })
  }, [])

  const loadVersions = useCallback(async () => {
    if (!clientName) {
      setVersions([])
      setActiveVersionId(null)
      return
    }

    setError('')
    const { data, error: dbErr } = await supabase
      .from('seo_initial_analysis_versions')
      .select('*')
      .eq('client', clientName)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })

    if (dbErr) { setError(dbErr.message); return }

    let nextVersions = (data ?? []) as AnalysisVersion[]
    if (nextVersions.length === 0) {
      const { data: defaultVersions, error: createErr } = await supabase
        .from('seo_initial_analysis_versions')
        .upsert(
          DEFAULT_ANALYSIS_VERSIONS.map(version => ({
            client: clientName,
            ...version,
            created_by: userName || null,
          })),
          { onConflict: 'client,position' },
        )
        .select('*')
        .order('position', { ascending: true })
      if (createErr) { setError(createErr.message); return }
      nextVersions = (defaultVersions ?? []) as AnalysisVersion[]
    }

    setVersions(nextVersions)
    setActiveVersionId(current => nextVersions.some(version => version.id === current) ? current : nextVersions[0].id)
  }, [clientName, userName])

  useEffect(() => {
    setActiveVersionId(null)
    setRows({})
    setDrafts({})
    setShowVersionForm(false)
    setVersionTitle('')
    void loadVersions()
  }, [clientName, loadVersions])

  const loadRows = useCallback(async () => {
    if (!clientName || activeVersionId === null) { setRows({}); return }
    const { data, error: dbErr } = await supabase
      .from('seo_initial_audit_items')
      .select('*')
      .eq('client', clientName)
      .eq('analysis_version_id', activeVersionId)
    if (dbErr) { setError(dbErr.message); return }
    const map: Record<string, ItemRow> = {}
    for (const r of (data ?? []) as ItemRow[]) map[rowKey(r.section, r.item)] = r
    setRows(map)
    setDrafts({})
  }, [activeVersionId, clientName])

  useEffect(() => { loadRows() }, [loadRows])

  async function saveItem(section: SectionDef, item: string, patch: Partial<ItemRow>) {
    if (!clientName || activeVersionId === null) return
    const key = rowKey(section.key, item)
    const current = rows[key]
    const next: ItemRow = {
      client: clientName,
      analysis_version_id: activeVersionId,
      ...itemIdentity(section.key, item),
      status: current?.status ?? null,
      comments: current?.comments ?? null,
      evidence: current?.evidence ?? [],
      ...patch,
      updated_by: userName,
    }
    setRows(prev => ({ ...prev, [key]: next })) // optimistic
    const { error: dbErr } = await supabase
      .from('seo_initial_audit_items')
      .upsert(
        { client: clientName, analysis_version_id: activeVersionId, ...itemIdentity(section.key, item), ...patch, updated_by: userName, updated_at: new Date().toISOString() },
        { onConflict: 'analysis_version_id,section,item' },
      )
    if (dbErr) { setError(dbErr.message); loadRows() }
  }

  async function uploadEvidence(section: SectionDef, item: string, file: File) {
    const key = rowKey(section.key, item)
    setUploading(key)
    setError('')
    const safeName = file.name.replace(/[^\w.-]+/g, '_')
    const path = `${clientName}/${activeVersionId}/${section.key}/${crypto.randomUUID()}_${safeName}`
    const { error: upErr } = await supabase.storage.from('audit-evidence').upload(path, file)
    if (upErr) { setUploading(null); setError(upErr.message); return }
    const current = rows[key]?.evidence ?? []
    try {
      await saveItem(section, item, { evidence: [...current, { name: file.name, path }] })
    } finally {
      setUploading(null)
    }
  }

  async function createVersion() {
    const title = versionTitle.trim()
    if (!clientName || !title || creatingVersion) return
    setCreatingVersion(true)
    setError('')
    const nextPosition = versions.reduce((highest, version) => Math.max(highest, version.position), -1) + 1
    const { data, error: dbErr } = await supabase
      .from('seo_initial_analysis_versions')
      .insert({ client: clientName, title, position: nextPosition, created_by: userName || null })
      .select('*')
      .single()
    setCreatingVersion(false)
    if (dbErr) { setError(dbErr.message); return }

    const created = data as AnalysisVersion
    setVersions(current => [...current, created])
    setActiveVersionId(created.id)
    setVersionTitle('')
    setShowVersionForm(false)
    setTeamTab('all')
    setOpenSections({})
  }

  async function deleteEvidence(row: ItemRow, file: EvidenceFile) {
    if (deleting || uploading) return
    setDeleting(file.path)
    setError('')
    try {
      await removeAuditEvidence(row, file, userName, true)
      setPendingDelete(null)
      await loadRows()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete the attachment.')
      setPendingDelete(null)
      await loadRows()
    } finally {
      setDeleting(null)
    }
  }

  function evidenceAttachment(row: ItemRow, file: EvidenceFile, canDelete: boolean) {
    return (
      <span key={file.path} className="group inline-flex items-center rounded-lg border border-[#1A72D9]/30 bg-[#1A72D9]/5 text-xs text-[#1A72D9]">
        <button type="button" onClick={() => void openEvidence(file.path)} title={file.name} className="max-w-[140px] truncate px-2.5 py-1.5 hover:underline">
          {file.name}
        </button>
        {canDelete && <button type="button" title={`Delete ${file.name}`} aria-label={`Delete ${file.name}`}
          disabled={Boolean(deleting || uploading)} onClick={() => setPendingDelete({ row, file })}
          className="rounded-r-lg p-1.5 text-red-500 opacity-0 transition-opacity hover:bg-red-50 focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-red-500/10">
          <Trash2 className="h-3 w-3" />
        </button>}
      </span>
    )
  }

  // Private bucket: open a short-lived signed URL. The tab opens synchronously so popup blockers allow it.
  async function openEvidence(path: string) {
    const tab = window.open('', '_blank')
    const { data, error: signErr } = await supabase.storage.from('audit-evidence').createSignedUrl(path, 300)
    if (signErr || !data) {
      tab?.close()
      setError(`Could not open the attachment: ${signErr?.message ?? 'unknown error'}`)
      return
    }
    if (tab) { tab.opener = null; tab.location.href = data.signedUrl } else window.location.href = data.signedUrl
  }

  // ── Progress ──────────────────────────────────────────────────────────────
  const sectionDone = (s: SectionDef) => s.items.filter(i => rows[rowKey(s.key, i)]?.status).length
  const progressOf = (sections: SectionDef[]) => {
    const total = sections.reduce((n, s) => n + s.items.length, 0)
    const done = sections.reduce((n, s) => n + sectionDone(s), 0)
    return total ? Math.round((done / total) * 100) : 0
  }
  const overallPct = progressOf(SECTIONS)
  const previousRows = previousChecklistRows(Object.values(rows))
  const visibleSections = teamTab === 'all' ? SECTIONS : SECTIONS.filter(s => s.assignee === teamTab)

  if (!clientName) {
    return (
      <div className="rounded-xl border border-stroke bg-white px-6 py-12 text-center text-sm text-body shadow-default dark:border-strokedark dark:bg-boxdark dark:text-bodydark">
        Select an active client to start the Initial Analysis.
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Analysis versions ── */}
      <div>
        <div className="flex items-end gap-3 border-b border-stroke dark:border-strokedark">
          <div className="flex min-w-0 flex-1 overflow-x-auto" role="tablist" aria-label="Initial Analysis versions">
            {versions.length === 0 && DEFAULT_ANALYSIS_VERSIONS.map(version => (
              <button
                key={version.position}
                type="button"
                role="tab"
                aria-selected={version.position === 0}
                disabled
                className={`shrink-0 border-b-2 px-5 py-3 text-sm font-semibold ${
                  version.position === 0 ? 'border-[#1A72D9] text-[#1A72D9]' : 'border-transparent text-body dark:text-bodydark'
                }`}
              >
                {version.title}
              </button>
            ))}
            {versions.map(version => (
              <button
                key={version.id}
                type="button"
                role="tab"
                aria-selected={activeVersionId === version.id}
                onClick={() => {
                  setActiveVersionId(version.id)
                  setTeamTab('all')
                  setOpenSections({})
                }}
                className={`shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition ${
                  activeVersionId === version.id
                    ? 'border-[#1A72D9] text-[#1A72D9]'
                    : 'border-transparent text-body hover:border-[#1A72D9]/40 hover:text-[#1A72D9] dark:text-bodydark'
                }`}
              >
                {version.title}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowVersionForm(true)}
            className="inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-[#1A72D9] transition hover:border-[#1A72D9]"
          >
            <Plus className="h-4 w-4" />
            New analysis
          </button>
        </div>

        {showVersionForm && (
          <form
            className="mt-4 flex flex-col gap-2 rounded-lg border border-[#1A72D9]/20 bg-[#1A72D9]/5 p-3 sm:flex-row sm:items-center"
            onSubmit={event => { event.preventDefault(); void createVersion() }}
          >
            <input
              autoFocus
              value={versionTitle}
              maxLength={80}
              onChange={event => setVersionTitle(event.target.value)}
              placeholder="Example: 6 months, 1 year, Second analysis…"
              className="min-w-0 flex-1 rounded-lg border border-stroke bg-white px-3.5 py-2 text-sm text-black outline-none focus:border-[#1A72D9] dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]"
            />
            <button
              type="submit"
              disabled={!versionTitle.trim() || creatingVersion}
              className="rounded-lg bg-[#1A72D9] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingVersion ? 'Creating…' : 'Create tab'}
            </button>
            <button
              type="button"
              onClick={() => { setShowVersionForm(false); setVersionTitle('') }}
              className="flex h-9 w-9 items-center justify-center self-end rounded-lg text-body hover:bg-black/5 dark:text-bodydark dark:hover:bg-white/10 sm:self-auto"
              aria-label="Cancel new analysis"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>

      {/* ── Header ── */}
      <div className="rounded-xl border border-stroke bg-white px-5 py-5 shadow-sm dark:border-strokedark dark:bg-boxdark md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-body dark:text-bodydark">Team progress</p>
            <p className="mt-1 text-sm text-body dark:text-bodydark">Diagnostic checklist and supporting evidence</p>
          </div>
          <div className="flex items-center gap-3">
            {domain && (
              <a
                href={`https://${domain}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-[#1A72D9] hover:underline"
              >
                {domain}
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            )}
            <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
              overallPct === 100
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400'
            }`}>
              {overallPct === 100 ? 'Completed' : 'In Progress'}
            </span>
          </div>
        </div>

        {/* Overall progress */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-black dark:text-[#E2E5E9]">Overall Team Progress</p>
            <p className="text-sm font-bold text-[#1A72D9]">{overallPct}%</p>
          </div>
          <ProgressBar pct={overallPct} />
        </div>

        {/* Per-user cards */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TEAM.map(member => {
            const pct = progressOf(SECTIONS.filter(s => s.assignee === member))
            return (
              <div key={member} className="flex items-center gap-3 rounded-lg border border-stroke px-4 py-3 dark:border-strokedark">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1A72D9]/10 text-xs font-bold text-[#1A72D9]">
                  {initials(member)}
                </span>
                <span className="text-sm font-medium text-black dark:text-[#E2E5E9]">{member}</span>
                <div className="min-w-0 flex-1"><ProgressBar pct={pct} /></div>
                <span className="text-xs font-semibold text-body dark:text-bodydark tabular-nums">{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', title: 'All Sections', sub: 'Initial Analysis view' },
          ...TEAM.map(m => ({
            key: m, title: m,
            sub: SECTIONS.filter(s => s.assignee === m).map(s => s.title).join(' · '),
          })),
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTeamTab(tab.key)}
            className={`min-w-[160px] max-w-[240px] shrink-0 rounded-xl border px-4 py-3 text-left transition ${
              teamTab === tab.key
                ? 'border-[#1A72D9]/30 bg-[#1A72D9]/5 dark:bg-[#1A72D9]/10'
                : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/[0.03]'
            }`}
          >
            <p className={`text-sm font-semibold ${teamTab === tab.key ? 'text-[#1A72D9]' : 'text-body dark:text-bodydark'}`}>
              {tab.title}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-body/70 dark:text-bodydark/70">{tab.sub}</p>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {/* ── Section accordions ── */}
      <div className="space-y-4">
        {visibleSections.map(section => {
          const accent = ACCENT[section.accent]
          const done = sectionDone(section)
          const total = section.items.length
          const open = openSections[section.key] ?? false
          return (
            <div key={section.key} className={`rounded-xl border bg-white shadow-default dark:bg-boxdark ${accent.border}`}>
              {/* Accordion header */}
              <button
                type="button"
                onClick={() => setOpenSections(p => ({ ...p, [section.key]: !open }))}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent.bg}`}>
                      <svg className={`h-4 w-4 ${accent.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={section.icon} />
                      </svg>
                    </span>
                    <h3 className={`text-lg font-bold ${accent.text}`}>{section.title}</h3>
                    <SectionStatusBadge done={done} total={total} />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1A72D9]/10 text-[9px] font-bold text-[#1A72D9]">
                      {initials(section.assignee)}
                    </span>
                    <span className="text-xs font-medium text-black dark:text-[#E2E5E9]">{section.assignee}</span>
                    <div className="w-28"><ProgressBar pct={total ? (done / total) * 100 : 0} barCls={accent.bar} /></div>
                    <span className="text-xs text-body dark:text-bodydark">{done}/{total} Item{total !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <svg
                  className={`h-4 w-4 shrink-0 text-body transition-transform dark:text-bodydark ${open ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {/* Accordion body */}
              {open && (
                <div className="border-t border-stroke dark:border-strokedark overflow-x-auto">
                  <table className="w-full min-w-[820px]">
                    <thead>
                      <tr>
                        {['Diagnostic Item', 'Status', 'Comments / Notes', 'Evidence', 'By'].map(col => (
                          <th key={col} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-body dark:text-bodydark whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stroke dark:divide-strokedark">
                      {section.items.map(item => {
                        const key = rowKey(section.key, item)
                        const row = rows[key]
                        const draft = drafts[key] ?? row?.comments ?? ''
                        const editable = canEditSection(section)
                        return (
                          <tr key={item}>
                            <td className="px-5 py-4 text-sm font-semibold text-black dark:text-[#E2E5E9] max-w-[240px]">{item}</td>

                            {/* Status: pass / fail / na */}
                            <td className="px-5 py-4">
                              <div className="flex gap-1.5">
                                {([
                                  { v: 'pass', title: 'OK', active: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400', path: 'M4.5 12.75l6 6 9-13.5' },
                                  { v: 'fail', title: 'Issue', active: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400', path: 'M6 18L18 6M6 6l12 12' },
                                  { v: 'na', title: 'N/A', active: 'bg-gray-200 text-gray-600 dark:bg-gray-500/25 dark:text-gray-300', path: 'M5 12h14' },
                                ] as const).map(btn => (
                                  <button
                                    key={btn.v}
                                    type="button"
                                    title={btn.title}
                                    disabled={Boolean(deleting) || !editable}
                                    onClick={() => saveItem(section, item, { status: row?.status === btn.v ? null : btn.v })}
                                    className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                                      row?.status === btn.v
                                        ? btn.active
                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-white/5 dark:text-bodydark dark:hover:bg-white/10'
                                    }`}
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d={btn.path} />
                                    </svg>
                                  </button>
                                ))}
                              </div>
                            </td>

                            {/* Comments — saved on blur */}
                            <CommentCell
                              value={draft}
                              disabled={Boolean(deleting) || !editable}
                              onChange={value => setDrafts(p => ({ ...p, [key]: value }))}
                              onBlur={() => { if (draft !== (row?.comments ?? '')) saveItem(section, item, { comments: draft || null }) }}
                            />

                            {/* Evidence */}
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap items-center gap-2">
                                {row && row.evidence.map(file => evidenceAttachment(row, file, editable))}
                                {editable && <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-stroke px-2.5 py-1.5 text-xs font-medium text-body transition hover:border-[#1A72D9]/50 hover:text-[#1A72D9] dark:border-strokedark dark:text-bodydark">
                                  <input
                                    type="file"
                                    className="hidden"
                                    disabled={Boolean(uploading || deleting)}
                                    onChange={e => {
                                      const file = e.target.files?.[0]
                                      if (file) uploadEvidence(section, item, file)
                                      e.target.value = ''
                                    }}
                                  />
                                  {uploading === key ? 'Uploading…' : '+ Attach'}
                                </label>}
                              </div>
                            </td>

                            {/* By */}
                            <td className="px-5 py-4">
                              {row?.updated_by ? (
                                <span
                                  title={row.updated_by}
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A72D9]/10 text-[10px] font-bold text-[#1A72D9]"
                                >
                                  {initials(row.updated_by)}
                                </span>
                              ) : (
                                <span className="text-xs text-body dark:text-bodydark">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {teamTab === 'all' && previousRows.length > 0 && (
        <details className="rounded-xl border border-stroke bg-white p-5 dark:border-strokedark dark:bg-boxdark">
          <summary className="cursor-pointer font-semibold text-black dark:text-[#E2E5E9]">
            Previous checklist records ({previousRows.length})
          </summary>
          <p className="mt-2 text-sm text-body dark:text-bodydark">Saved evaluations from the previous checklist. These do not count toward current progress.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr>{['Section', 'Diagnostic Item', 'Status', 'Comments / Notes', 'Evidence', 'By'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
              <tbody>
                {previousRows.map(row => (
                  <tr key={rowKey(row.section, row.item)} className="border-t border-stroke dark:border-strokedark">
                    <td className="p-3">{row.section}</td>
                    <td className="p-3">{row.item}</td>
                    <td className="p-3">{row.status === 'pass' ? 'OK' : row.status === 'fail' ? 'Issue' : row.status === 'na' ? 'N/A' : 'Pending'}</td>
                    <td className="p-3">{row.comments || '—'}</td>
                    <td className="p-3"><div className="flex flex-wrap gap-2">{(row.evidence ?? []).map(file => evidenceAttachment(row, file, canDeleteEvidence))}</div></td>
                    <td className="p-3">{row.updated_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {pendingDelete && (
        <SlideToConfirmDialog
          title="Delete attachment?"
          description={`"${pendingDelete.file.name}" will be permanently removed from this evaluation.`}
          busy={deleting === pendingDelete.file.path}
          onConfirm={() => void deleteEvidence(pendingDelete.row, pendingDelete.file)}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
