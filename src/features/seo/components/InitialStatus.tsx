import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FindingRow {
  id: string
  client: string
  analysis_date: string | null
  responsible_owner: string | null
  seo_category: string | null
  audit_item: string | null
  initial_status: string | null
  priority: string | null
  seo_impact: string | null
  notes: string | null
  recommendation: string | null
  evidence_url: string | null
  is_draft: boolean
  created_at: string
  updated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEO_CATEGORIES = [
  'Technical SEO', 'Content', 'Local SEO', 'Listings', 'Reviews',
  'Link Building', 'On-Page SEO', 'Analytics',
]

const AUDIT_ITEMS = [
  'PageSpeed Mobile', 'PageSpeed Desktop', 'Core Web Vitals', 'Meta Tags',
  'H1 / H2 Structure', 'XML Sitemap', 'Robots.txt', 'GBP Access',
  'NAP Consistency', 'Google Reviews', 'Schema Markup', 'SSL Certificate',
]

const TEAM_MEMBERS = ['Steven', 'Geraldine', 'Maria', 'John', 'Alex']
const STATUS_OPTIONS = ['Yes', 'No', 'Incomplete', 'Pending', 'N/A']
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High']
const SEO_IMPACT_OPTIONS = [
  'Technical', 'Content', 'Local Visibility', 'Link Authority', 'User Experience',
]

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

// ─── Shared field styles ──────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full rounded-lg border border-stroke bg-transparent px-3.5 py-2.5 ' +
  'text-sm text-black placeholder-body outline-none ' +
  'transition focus:border-[#1A72D9] focus:ring-1 focus:ring-[#1A72D9]/30 ' +
  'dark:border-strokedark dark:bg-boxdark dark:text-white dark:placeholder-bodydark ' +
  'dark:focus:border-[#1A72D9]'

const SELECT_CLS =
  'w-full appearance-none rounded-lg border border-stroke bg-white ' +
  'px-3.5 py-2.5 pr-8 text-sm text-black outline-none ' +
  'transition focus:border-[#1A72D9] focus:ring-1 focus:ring-[#1A72D9]/30 ' +
  'dark:border-strokedark dark:bg-boxdark dark:text-white ' +
  'dark:focus:border-[#1A72D9]'

const FILTER_SELECT_CLS =
  'appearance-none rounded-lg border border-stroke bg-white ' +
  'pl-3 pr-7 py-1.5 text-xs font-medium text-black outline-none ' +
  'focus:border-[#1A72D9] ' +
  'dark:border-strokedark dark:bg-boxdark dark:text-white'

const LABEL_CLS = 'mb-1.5 block text-sm font-semibold text-black dark:text-white'

// ─── Select wrapper ───────────────────────────────────────────────────────────

function SelectField({
  label, value, onChange, options, placeholder,
}: {
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

// ─── Filter dropdown ──────────────────────────────────────────────────────────

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className={FILTER_SELECT_CLS}>
        <option value="">{label}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
        <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InitialStatus() {
  const [form, setForm] = useState({
    client: '', analysisDate: '', responsibleOwner: '', seoCategory: '',
    auditItem: '', initialStatus: '', priority: '', seoImpact: '',
    notes: '', recommendation: '',
  })

  const [clients,         setClients]         = useState<string[]>([])
  const [findings,        setFindings]        = useState<FindingRow[]>([])
  const [loadingFindings, setLoadingFindings] = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [saveError,       setSaveError]       = useState('')

  const [categoryFilter, setCategoryFilter] = useState('')
  const [ownerFilter,    setOwnerFilter]    = useState('')
  const [statusFilter,   setStatusFilter]   = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [dateFilter,     setDateFilter]     = useState('')

  // ── Load clients + findings on mount ──────────────────────────────────────

  useEffect(() => {
    async function loadClients() {
      const { data } = await supabase.from('client_profiles').select('client_id')
      if (data) setClients(data.map((r: { client_id: string }) => r.client_id))
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

    loadClients()
    loadFindings()
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function reloadFindings() {
    const { data } = await supabase
      .from('seo_initial_findings')
      .select('*')
      .eq('is_draft', false)
      .order('created_at', { ascending: false })
    if (data) setFindings(data as FindingRow[])
  }

  async function handleSave(isDraft: boolean) {
    if (!form.client.trim()) {
      setSaveError('Client is required.')
      return
    }
    setSaving(true)
    setSaveError('')

    const { error } = await supabase.from('seo_initial_findings').insert({
      client:            form.client,
      analysis_date:     form.analysisDate     || null,
      responsible_owner: form.responsibleOwner || null,
      seo_category:      form.seoCategory      || null,
      audit_item:        form.auditItem        || null,
      initial_status:    form.initialStatus    || null,
      priority:          form.priority         || null,
      seo_impact:        form.seoImpact        || null,
      notes:             form.notes            || null,
      recommendation:    form.recommendation   || null,
      is_draft:          isDraft,
    })

    if (error) {
      setSaveError(error.message)
    } else {
      setForm({
        client: '', analysisDate: '', responsibleOwner: '', seoCategory: '',
        auditItem: '', initialStatus: '', priority: '', seoImpact: '',
        notes: '', recommendation: '',
      })
      await reloadFindings()
    }

    setSaving(false)
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = findings.filter(r => {
    if (categoryFilter && r.seo_category    !== categoryFilter) return false
    if (ownerFilter    && r.responsible_owner !== ownerFilter)  return false
    if (statusFilter   && r.initial_status  !== statusFilter)   return false
    if (priorityFilter && r.priority        !== priorityFilter) return false
    if (dateFilter) {
      const label = r.analysis_date
        ? new Date(r.analysis_date).toLocaleString('en-US', { month: 'long', year: 'numeric' })
        : ''
      if (label !== dateFilter) return false
    }
    return true
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ══ FORM CARD ══════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">

        {/* Header */}
        <div className="border-b border-stroke px-6 py-5 dark:border-strokedark">
          <h3 className="text-lg font-bold text-black dark:text-white">Initial Analysis Setup</h3>
          <p className="mt-0.5 text-sm text-body dark:text-bodydark">
            Save the client's SEO starting point, responsible owners, notes, and evidence.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">

          {/* Row 1: Client + Analysis Date */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLS}>Client</label>
              <input
                type="text"
                list="client-suggestions"
                value={form.client}
                onChange={e => set('client', e.target.value)}
                placeholder="casaseo.org"
                className={INPUT_CLS}
              />
              <datalist id="client-suggestions">
                {clients.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className={LABEL_CLS}>Analysis Date</label>
              <input
                type="date"
                value={form.analysisDate}
                onChange={e => set('analysisDate', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Row 2: Responsible Owner + SEO Category */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SelectField
              label="Responsible Owner"
              value={form.responsibleOwner}
              onChange={v => set('responsibleOwner', v)}
              options={TEAM_MEMBERS}
              placeholder="Select team member"
            />
            <SelectField
              label="SEO Category"
              value={form.seoCategory}
              onChange={v => set('seoCategory', v)}
              options={SEO_CATEGORIES}
              placeholder="Technical SEO / Content / Local SEO / Listings…"
            />
          </div>

          {/* Row 3: Audit Item + Initial Status */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SelectField
              label="Audit Item"
              value={form.auditItem}
              onChange={v => set('auditItem', v)}
              options={AUDIT_ITEMS}
              placeholder="Select or type item"
            />
            <SelectField
              label="Initial Status"
              value={form.initialStatus}
              onChange={v => set('initialStatus', v)}
              options={STATUS_OPTIONS}
              placeholder="Yes / No / Incomplete / Pending / N/A"
            />
          </div>

          {/* Row 4: Priority + SEO Impact */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SelectField
              label="Priority"
              value={form.priority}
              onChange={v => set('priority', v)}
              options={PRIORITY_OPTIONS}
              placeholder="Low / Medium / High"
            />
            <SelectField
              label="SEO Impact"
              value={form.seoImpact}
              onChange={v => set('seoImpact', v)}
              options={SEO_IMPACT_OPTIONS}
              placeholder="Technical / Content / Local Visibility…"
            />
          </div>

          {/* Notes / Key Findings */}
          <div>
            <label className={LABEL_CLS}>Notes / Key Findings</label>
            <textarea
              rows={4}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Enter detailed findings…"
              className={INPUT_CLS + ' resize-none'}
            />
          </div>

          {/* Recommendation */}
          <div>
            <label className={LABEL_CLS}>Recommendation</label>
            <textarea
              rows={3}
              value={form.recommendation}
              onChange={e => set('recommendation', e.target.value)}
              placeholder="Enter recommendation…"
              className={INPUT_CLS + ' resize-none'}
            />
          </div>

          {/* Evidence Upload */}
          <div>
            <label className={LABEL_CLS}>Evidence Upload</label>
            <div className="flex flex-col items-center justify-center rounded-lg
                            border border-dashed border-stroke
                            bg-gray-50/50 px-6 py-10 text-center
                            cursor-pointer transition-colors
                            hover:border-[#1A72D9]/60 hover:bg-[#1A72D9]/3
                            dark:border-strokedark dark:bg-transparent
                            dark:hover:border-[#1A72D9]/50">
              <svg className="mb-3 h-10 w-10 text-body dark:text-bodydark"
                   fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775
                         5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              <p className="text-sm text-body dark:text-bodydark">
                Upload screenshot, PDF, or paste URL
              </p>
            </div>
          </div>

        </div>

        {/* Footer buttons */}
        <div className="flex flex-col items-end gap-2
                        border-t border-stroke px-6 py-4 dark:border-strokedark">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="rounded-lg border border-stroke px-5 py-2.5 text-sm font-medium
                         text-black transition disabled:opacity-50
                         hover:border-[#1A72D9] hover:text-[#1A72D9]
                         dark:border-strokedark dark:text-white
                         dark:hover:border-[#1A72D9] dark:hover:text-[#1A72D9]"
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="rounded-lg bg-[#1A72D9] px-5 py-2.5 text-sm font-semibold
                         text-white transition disabled:opacity-50
                         hover:bg-[#0F4FA8] active:scale-[0.98]"
            >
              {saving ? 'Saving…' : 'Save Initial Finding'}
            </button>
          </div>
          {saveError && (
            <p className="text-xs text-red-500">{saveError}</p>
          )}
        </div>
      </div>

      {/* ══ FINDINGS TABLE ═════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">

        {/* Header */}
        <div className="border-b border-stroke px-6 py-5 dark:border-strokedark">
          <h3 className="text-lg font-bold text-black dark:text-white">Initial Findings</h3>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2
                        border-b border-stroke px-6 py-3 dark:border-strokedark">
          <FilterSelect
            label="Category Filter"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={SEO_CATEGORIES}
          />
          <FilterSelect
            label="Owner Filter"
            value={ownerFilter}
            onChange={setOwnerFilter}
            options={TEAM_MEMBERS}
          />
          <FilterSelect
            label="Status Filter"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />
          <FilterSelect
            label="Priority Filter"
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={PRIORITY_OPTIONS}
          />
          <FilterSelect
            label="Date Filter"
            value={dateFilter}
            onChange={setDateFilter}
            options={['May 2025', 'April 2025', 'March 2025']}
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-stroke bg-gray-50/50 dark:border-strokedark dark:bg-black/10">
                {['Category', 'Item', 'Initial Status', 'Owner', 'Priority', 'Evidence', 'Last Updated'].map(col => (
                  <th key={col}
                      className="px-5 py-3 text-left text-[11px] font-semibold
                                 uppercase tracking-wider text-body dark:text-bodydark whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke dark:divide-strokedark">
              {loadingFindings ? (
                <tr>
                  <td colSpan={7}
                      className="px-6 py-10 text-center text-sm text-body dark:text-bodydark">
                    Loading…
                  </td>
                </tr>
              ) : (
                <>
                  {filtered.map(row => (
                    <tr key={row.id}
                        className="transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-5 py-4 text-sm font-semibold text-black dark:text-white whitespace-nowrap">
                        {row.seo_category ?? '—'}
                      </td>
                      <td className="px-5 py-4 text-sm text-body dark:text-bodydark">
                        {row.audit_item ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={row.initial_status ?? 'N/A'} />
                      </td>
                      <td className="px-5 py-4 text-sm text-black dark:text-white">
                        {row.responsible_owner ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        <PriorityBadge priority={row.priority ?? ''} />
                      </td>
                      <td className="px-5 py-4">
                        {row.evidence_url ? (
                          <a
                            href={row.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-[#1A72D9] hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-xs text-body dark:text-bodydark">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-body dark:text-bodydark whitespace-nowrap">
                        {row.analysis_date
                          ? new Date(row.analysis_date).toLocaleString('en-US', { month: 'long', year: 'numeric' })
                          : '—'}
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7}
                          className="px-6 py-10 text-center text-sm text-body dark:text-bodydark">
                        No findings match the selected filters.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
