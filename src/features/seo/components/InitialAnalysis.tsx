import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Section / team structure ─────────────────────────────────────────────────
// ponytail: structure is a frontend constant; move to a Supabase table if
// sections/assignees need to be editable from the UI.

type Accent = 'blue' | 'orange' | 'amber' | 'purple' | 'emerald' | 'red'

interface SectionDef {
  key: string
  title: string
  assignee: string
  accent: Accent
  icon: string // svg path
  items: string[]
}

const ICONS = {
  shield: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  text: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h10.5',
  megaphone: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73',
  pin: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  link: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244',
  chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  wrench: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
  play: 'M21 7.5V18M15 7.5V18M3 16.811V8.69c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061A1.125 1.125 0 013 16.811z',
}

const SECTIONS: SectionDef[] = [
  { key: 'google-accounts', title: 'Google Accounts', assignee: 'Juliana', accent: 'blue', icon: ICONS.shield,
    items: ['Google Business Profile access', 'Google Search Console access', 'Google Analytics 4 access', 'Google Ads access'] },
  { key: 'content-review', title: 'Website Content Review', assignee: 'Juliana', accent: 'orange', icon: ICONS.text,
    items: ['Content quality & relevance', 'Landing pages / blog review'] },
  { key: 'reviews-reputation', title: 'Reviews & Reputation', assignee: 'Juliana', accent: 'amber', icon: ICONS.megaphone,
    items: ['Interaction (responses, Q&A, services, posts)'] },
  { key: 'gbp', title: 'Google Business Profile', assignee: 'Geraldine', accent: 'blue', icon: ICONS.pin,
    items: ['Profile completeness (info, categories, attributes)', 'Photos, products & services', 'Posts activity'] },
  { key: 'offsite-seo', title: 'Off-site SEO', assignee: 'Geraldine', accent: 'purple', icon: ICONS.link,
    items: ['Directory listings', 'NAP consistency'] },
  { key: 'backlinks-citations', title: 'Backlinks & Citations', assignee: 'Geraldine', accent: 'purple', icon: ICONS.link,
    items: ['Backlink profile review', 'Citations audit'] },
  { key: 'keyword-ranking', title: 'Keyword Ranking (SERP)', assignee: 'Leomerly', accent: 'emerald', icon: ICONS.chart,
    items: ['Keyword ranking baseline (SERP)'] },
  { key: 'tech-seo', title: 'Website – Tech SEO', assignee: 'Steven', accent: 'blue', icon: ICONS.wrench,
    items: ['Core Web Vitals & PageSpeed', 'Indexing, sitemap & robots.txt', 'Meta tags & heading structure'] },
  { key: 'youtube', title: 'YouTube', assignee: 'Steven', accent: 'red', icon: ICONS.play,
    items: ['YouTube channel review'] },
]

const TEAM = [...new Set(SECTIONS.map(s => s.assignee))]

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
  section: string
  item: string
  status: string | null       // pass / fail / na
  comments: string | null
  evidence: EvidenceFile[]
  updated_by: string | null
}

const rowKey = (section: string, item: string) => `${section}|${item}`
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

export function InitialAnalysis({ clientName, domain }: { clientName: string; domain: string }) {
  const [rows, setRows] = useState<Record<string, ItemRow>>({})
  const [activeTab, setActiveTab] = useState<string>('all')       // 'all' | team member
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({}) // unsaved comment edits
  const [uploading, setUploading] = useState<string | null>(null)  // rowKey being uploaded
  const [userName, setUserName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const meta = data.session?.user?.user_metadata
      setUserName(meta?.full_name || meta?.name || data.session?.user?.email || 'Unknown')
    })
  }, [])

  const loadRows = useCallback(async () => {
    if (!clientName) { setRows({}); return }
    const { data, error: dbErr } = await supabase
      .from('seo_initial_audit_items')
      .select('*')
      .eq('client', clientName)
    if (dbErr) { setError(dbErr.message); return }
    const map: Record<string, ItemRow> = {}
    for (const r of (data ?? []) as ItemRow[]) map[rowKey(r.section, r.item)] = r
    setRows(map)
    setDrafts({})
  }, [clientName])

  useEffect(() => { loadRows() }, [loadRows])

  async function saveItem(section: SectionDef, item: string, patch: Partial<ItemRow>) {
    if (!clientName) return
    const key = rowKey(section.key, item)
    const current = rows[key]
    const next: ItemRow = {
      client: clientName,
      section: section.key,
      item,
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
        { ...next, updated_at: new Date().toISOString() },
        { onConflict: 'client,section,item' },
      )
    if (dbErr) { setError(dbErr.message); loadRows() }
  }

  async function uploadEvidence(section: SectionDef, item: string, file: File) {
    const key = rowKey(section.key, item)
    setUploading(key)
    setError('')
    const safeName = file.name.replace(/[^\w.-]+/g, '_')
    const path = `${clientName}/${section.key}/${crypto.randomUUID()}_${safeName}`
    const { error: upErr } = await supabase.storage.from('audit-evidence').upload(path, file)
    setUploading(null)
    if (upErr) { setError(upErr.message); return }
    const current = rows[key]?.evidence ?? []
    await saveItem(section, item, { evidence: [...current, { name: file.name, path }] })
  }

  function evidenceUrl(path: string) {
    return supabase.storage.from('audit-evidence').getPublicUrl(path).data.publicUrl
  }

  // ── Progress ──────────────────────────────────────────────────────────────
  const sectionDone = (s: SectionDef) => s.items.filter(i => rows[rowKey(s.key, i)]?.status).length
  const progressOf = (sections: SectionDef[]) => {
    const total = sections.reduce((n, s) => n + s.items.length, 0)
    const done = sections.reduce((n, s) => n + sectionDone(s), 0)
    return total ? Math.round((done / total) * 100) : 0
  }
  const overallPct = progressOf(SECTIONS)
  const visibleSections = activeTab === 'all' ? SECTIONS : SECTIONS.filter(s => s.assignee === activeTab)

  if (!clientName) {
    return (
      <div className="rounded-xl border border-stroke bg-white px-6 py-12 text-center text-sm text-body shadow-default dark:border-strokedark dark:bg-boxdark dark:text-bodydark">
        Select an active client to start the Initial Analysis.
      </div>
    )
  }

  return (
    <div className="space-y-6">

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
            onClick={() => setActiveTab(tab.key)}
            className={`min-w-[160px] max-w-[240px] shrink-0 rounded-xl border px-4 py-3 text-left transition ${
              activeTab === tab.key
                ? 'border-[#1A72D9]/30 bg-[#1A72D9]/5 dark:bg-[#1A72D9]/10'
                : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/[0.03]'
            }`}
          >
            <p className={`text-sm font-semibold ${activeTab === tab.key ? 'text-[#1A72D9]' : 'text-body dark:text-bodydark'}`}>
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
                            <td className="px-5 py-4 min-w-[220px]">
                              <input
                                value={draft}
                                onChange={e => setDrafts(p => ({ ...p, [key]: e.target.value }))}
                                onBlur={() => { if (draft !== (row?.comments ?? '')) saveItem(section, item, { comments: draft || null }) }}
                                placeholder="Add a note…"
                                className="w-full rounded-lg border border-transparent bg-gray-100 px-3.5 py-2 text-sm text-black outline-none transition placeholder-body focus:border-[#1A72D9]/50 dark:bg-white/5 dark:text-[#E2E5E9] dark:placeholder-bodydark"
                              />
                            </td>

                            {/* Evidence */}
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap items-center gap-2">
                                {(row?.evidence ?? []).map(f => (
                                  <a
                                    key={f.path}
                                    href={evidenceUrl(f.path)} target="_blank" rel="noreferrer"
                                    title={f.name}
                                    className="inline-flex max-w-[140px] items-center gap-1.5 rounded-lg border border-[#1A72D9]/30 bg-[#1A72D9]/5 px-2.5 py-1.5 text-xs font-medium text-[#1A72D9] hover:bg-[#1A72D9]/15"
                                  >
                                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                                    </svg>
                                    <span className="truncate">{f.name}</span>
                                  </a>
                                ))}
                                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-stroke px-2.5 py-1.5 text-xs font-medium text-body transition hover:border-[#1A72D9]/50 hover:text-[#1A72D9] dark:border-strokedark dark:text-bodydark">
                                  <input
                                    type="file"
                                    className="hidden"
                                    disabled={uploading === key}
                                    onChange={e => {
                                      const file = e.target.files?.[0]
                                      if (file) uploadEvidence(section, item, file)
                                      e.target.value = ''
                                    }}
                                  />
                                  {uploading === key ? 'Uploading…' : '+ Attach'}
                                </label>
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
    </div>
  )
}
