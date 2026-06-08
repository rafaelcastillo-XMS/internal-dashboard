import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AhrefsSnapshot {
  id: string
  client: string
  domain: string
  snapshot_date: string
  domain_rating: number | null
  ahrefs_rank: number | null
  organic_traffic: number | null
  organic_keywords: number | null
  backlinks: number | null
  referring_domains: number | null
  notes: string | null
  created_at: string
}


interface FindingRow {
  id: string
  client: string
  analysis_date: string | null
  responsible_owner: string | null
  seo_category: string | null
  audit_item: string | null
  initial_status: string | null
  priority: string | null
  notes: string | null
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAM_MEMBERS    = ['Steven', 'Geraldine', 'Maria', 'John', 'Alex']
const SEO_CATEGORIES  = ['Technical SEO', 'Content', 'Local SEO', 'Listings', 'Reviews', 'Link Building', 'On-Page SEO', 'Analytics']
const AUDIT_ITEMS     = ['PageSpeed Mobile', 'PageSpeed Desktop', 'Core Web Vitals', 'Meta Tags', 'H1 / H2 Structure', 'XML Sitemap', 'Robots.txt', 'GBP Access', 'NAP Consistency', 'Google Reviews', 'Schema Markup', 'SSL Certificate']
const STATUS_OPTIONS  = ['Yes', 'No', 'Incomplete', 'Pending', 'N/A']
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High']

// ─── Shared styles ────────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full rounded-lg border border-stroke bg-transparent px-3.5 py-2.5 ' +
  'text-sm text-black placeholder-body outline-none ' +
  'transition focus:border-[#1A72D9] focus:ring-1 focus:ring-[#1A72D9]/30 ' +
  'dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9] dark:placeholder-bodydark ' +
  'dark:focus:border-[#1A72D9]'

const SELECT_CLS =
  'w-full appearance-none rounded-lg border border-stroke bg-white ' +
  'px-3.5 py-2.5 pr-8 text-sm text-black outline-none ' +
  'transition focus:border-[#1A72D9] focus:ring-1 focus:ring-[#1A72D9]/30 ' +
  'dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9] dark:focus:border-[#1A72D9]'

const LABEL_CLS = 'mb-1.5 block text-sm font-semibold text-black dark:text-[#E2E5E9]'

// ─── Badge helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    Yes:        'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    No:         'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    Incomplete: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
    Pending:    'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    'N/A':      'bg-gray-100 text-gray-500 dark:bg-gray-500/15 dark:text-gray-400',
  }
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls[status] ?? cls['N/A']}`}>
      {status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls: Record<string, string> = {
    High:   'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    Low:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  }
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls[priority] ?? ''}`}>
      {priority}
    </span>
  )
}

function SelectField({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  options: string[]; placeholder: string
}) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)} className={SELECT_CLS}>
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <svg className="h-3.5 w-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InitialStatus() {

  const [clients,  setClients]  = useState<string[]>([])
  const [snapshots, setSnapshots] = useState<AhrefsSnapshot[]>([])

  // ── Checklist state (manual) ──────────────────────────────────────────────
  const [checklist, setChecklist] = useState({
    client: '', analysisDate: '', owner: '', category: '',
    auditItem: '', status: '', priority: '', notes: '',
  })
  const [findings,        setFindings]        = useState<FindingRow[]>([])
  const [loadingFindings, setLoadingFindings] = useState(false)
  const [savingChecklist, setSavingChecklist] = useState(false)
  const [checklistError,  setChecklistError]  = useState('')

  // ── Load on mount ─────────────────────────────────────────────────────────

  useEffect(() => {
    loadClients()
    loadSnapshots()
    loadFindings()
  }, [])

  async function loadClients() {
    const { data } = await supabase.from('client_profiles').select('client_id')
    if (data) setClients(data.map((r: { client_id: string }) => r.client_id))
  }

  async function loadSnapshots() {
    const { data } = await supabase
      .from('seo_ahrefs_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setSnapshots(data as AhrefsSnapshot[])
  }

  async function loadFindings() {
    setLoadingFindings(true)
    const { data } = await supabase
      .from('seo_initial_findings')
      .select('*')
      .eq('is_draft', false)
      .order('created_at', { ascending: false })
    if (data) setFindings(data as FindingRow[])
    setLoadingFindings(false)
  }

  // ── Checklist: save ───────────────────────────────────────────────────────

  async function saveChecklistItem() {
    if (!checklist.client.trim()) { setChecklistError('Client is required'); return }
    setSavingChecklist(true)
    setChecklistError('')
    const { error: dbErr } = await supabase.from('seo_initial_findings').insert({
      client:            checklist.client,
      analysis_date:     checklist.analysisDate || null,
      responsible_owner: checklist.owner        || null,
      seo_category:      checklist.category     || null,
      audit_item:        checklist.auditItem    || null,
      initial_status:    checklist.status       || null,
      priority:          checklist.priority     || null,
      notes:             checklist.notes        || null,
      is_draft:          false,
    })
    if (dbErr) {
      setChecklistError(dbErr.message)
    } else {
      setChecklist({ client: '', analysisDate: '', owner: '', category: '', auditItem: '', status: '', priority: '', notes: '' })
      await loadFindings()
    }
    setSavingChecklist(false)
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ══ CARD 2: SAVED BASELINES ════════════════════════════════════════════ */}
      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6 py-5 dark:border-strokedark flex items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-black dark:text-[#E2E5E9]">Saved Baselines</h3>
            <p className="mt-0.5 text-sm text-body dark:text-bodydark">All initial Ahrefs snapshots per client</p>
          </div>
          {snapshots.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-stroke bg-gray-50/50 dark:border-strokedark dark:bg-black/10">
                {['Client', 'Domain', 'Date', 'DR', 'Rank', 'Traffic/mo', 'Keywords', 'Backlinks', 'Ref. Domains', 'Notes'].map(col => (
                  <th key={col} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-body dark:text-bodydark whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke dark:divide-strokedark">
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-sm text-body dark:text-bodydark">
                    No baselines saved yet. Run your first analysis above.
                  </td>
                </tr>
              ) : snapshots.map(s => (
                <tr key={s.id} className="transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3.5 text-sm font-medium text-black dark:text-[#E2E5E9] whitespace-nowrap">{s.client}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-body dark:text-bodydark">{s.domain}</td>
                  <td className="px-4 py-3.5 text-xs text-body dark:text-bodydark whitespace-nowrap">{s.snapshot_date}</td>
                  <td className="px-4 py-3.5 text-sm font-bold text-orange-500 tabular-nums">{s.domain_rating ?? '—'}</td>
                  <td className="px-4 py-3.5 text-sm text-body dark:text-bodydark tabular-nums">{s.ahrefs_rank?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3.5 text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">{s.organic_traffic?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3.5 text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">{s.organic_keywords?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3.5 text-sm text-purple-500 tabular-nums">{s.backlinks?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3.5 text-sm text-purple-500 tabular-nums">{s.referring_domains?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3.5 text-xs text-body dark:text-bodydark max-w-[160px] truncate">{s.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ CARD 3: MANUAL SEO CHECKLIST ══════════════════════════════════════ */}
      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6 py-5 dark:border-strokedark">
          <h3 className="text-lg font-bold text-black dark:text-[#E2E5E9]">Manual SEO Checklist</h3>
          <p className="mt-0.5 text-sm text-body dark:text-bodydark">
            Record individual audit items — meta tags, PageSpeed, robots.txt, etc.
          </p>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Client */}
            <div>
              <label className={LABEL_CLS}>Client</label>
              <div className="relative">
                <select
                  value={checklist.client}
                  onChange={e => setChecklist(f => ({ ...f, client: e.target.value }))}
                  className={SELECT_CLS}
                >
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="h-3.5 w-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </span>
              </div>
            </div>

            {/* Analysis Date */}
            <div>
              <label className={LABEL_CLS}>Analysis Date</label>
              <input
                type="date"
                value={checklist.analysisDate}
                onChange={e => setChecklist(f => ({ ...f, analysisDate: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>

            {/* Owner */}
            <SelectField
              label="Responsible Owner"
              value={checklist.owner}
              onChange={v => setChecklist(f => ({ ...f, owner: v }))}
              options={TEAM_MEMBERS}
              placeholder="Select member"
            />

            {/* Category */}
            <SelectField
              label="SEO Category"
              value={checklist.category}
              onChange={v => setChecklist(f => ({ ...f, category: v }))}
              options={SEO_CATEGORIES}
              placeholder="Category…"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SelectField
              label="Audit Item"
              value={checklist.auditItem}
              onChange={v => setChecklist(f => ({ ...f, auditItem: v }))}
              options={AUDIT_ITEMS}
              placeholder="Select item"
            />
            <SelectField
              label="Initial Status"
              value={checklist.status}
              onChange={v => setChecklist(f => ({ ...f, status: v }))}
              options={STATUS_OPTIONS}
              placeholder="Yes / No / Pending…"
            />
            <SelectField
              label="Priority"
              value={checklist.priority}
              onChange={v => setChecklist(f => ({ ...f, priority: v }))}
              options={PRIORITY_OPTIONS}
              placeholder="Low / Medium / High"
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Notes</label>
            <textarea
              rows={2}
              value={checklist.notes}
              onChange={e => setChecklist(f => ({ ...f, notes: e.target.value }))}
              placeholder="Observations, findings…"
              className={INPUT_CLS + ' resize-none'}
            />
          </div>
        </div>

        <div className="border-t border-stroke px-6 py-4 dark:border-strokedark flex items-center justify-between gap-4">
          {checklistError
            ? <p className="text-xs text-red-500">{checklistError}</p>
            : <span />
          }
          <button
            type="button"
            onClick={saveChecklistItem}
            disabled={savingChecklist}
            className="flex items-center gap-2 rounded-lg bg-[#1A72D9] px-5 py-2.5
                       text-sm font-semibold text-white transition
                       disabled:opacity-50 hover:bg-[#0F4FA8] active:scale-[0.98]"
          >
            {savingChecklist ? 'Saving…' : 'Save Checklist Item'}
          </button>
        </div>

        {/* Checklist table */}
        {(loadingFindings || findings.length > 0) && (
          <div className="border-t border-stroke dark:border-strokedark overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-stroke bg-gray-50/50 dark:border-strokedark dark:bg-black/10">
                  {['Client', 'Category', 'Item', 'Status', 'Priority', 'Owner', 'Date'].map(col => (
                    <th key={col} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-body dark:text-bodydark whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-strokedark">
                {loadingFindings ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-body dark:text-bodydark">Loading…</td>
                  </tr>
                ) : findings.map(row => (
                  <tr key={row.id} className="transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5 text-sm font-medium text-black dark:text-[#E2E5E9]">{row.client}</td>
                    <td className="px-4 py-3.5 text-sm text-body dark:text-bodydark">{row.seo_category ?? '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-body dark:text-bodydark">{row.audit_item ?? '—'}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={row.initial_status ?? 'N/A'} /></td>
                    <td className="px-4 py-3.5"><PriorityBadge priority={row.priority ?? ''} /></td>
                    <td className="px-4 py-3.5 text-sm text-body dark:text-bodydark">{row.responsible_owner ?? '—'}</td>
                    <td className="px-4 py-3.5 text-xs text-body dark:text-bodydark whitespace-nowrap">
                      {row.analysis_date
                        ? new Date(row.analysis_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
