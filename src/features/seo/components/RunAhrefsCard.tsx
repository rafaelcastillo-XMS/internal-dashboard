import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface AhrefsResult {
  domain: string
  snapshot_date: string
  domain_rating: number | null
  ahrefs_rank: number | null
  organic_traffic: number | null
  organic_keywords: number | null
  backlinks: number | null
  referring_domains: number | null
}

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

function MetricCard({ label, value, unit, color }: {
  label: string; value: number | null | undefined; unit?: string; color: string
}) {
  return (
    <div className="rounded-xl border border-stroke bg-white px-4 py-4
                    dark:border-strokedark dark:bg-boxdark text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-body dark:text-bodydark mb-2 leading-tight">
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>
        {value !== null && value !== undefined ? Number(value).toLocaleString() : '—'}
        {unit && <span className="text-xs font-normal text-body dark:text-bodydark ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

export function RunAhrefsCard() {
  const [clients,       setClients]       = useState<string[]>([])
  const [client,        setClient]        = useState('')
  const [domain,        setDomain]        = useState('')
  const [analysisNotes, setAnalysisNotes] = useState('')
  const [result,        setResult]        = useState<AhrefsResult | null>(null)
  const [fetching,      setFetching]      = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [savedOk,       setSavedOk]       = useState(false)
  const [error,         setError]         = useState('')

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    const { data } = await supabase.from('client_profiles').select('client_id')
    if (data) setClients(data.map((r: { client_id: string }) => r.client_id))
  }

  async function runAnalysis() {
    const d = domain.trim()
    if (!client.trim()) { setError('Select a client first'); return }
    if (!d)             { setError('Enter the client domain'); return }
    setFetching(true)
    setError('')
    setResult(null)
    setSavedOk(false)
    try {
      const res  = await fetch(`/api/seo/ahrefs-snapshot?target=${encodeURIComponent(d)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setResult(data as AhrefsResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setFetching(false)
    }
  }

  async function saveBaseline() {
    if (!result) return
    setSaving(true)
    setError('')
    const { error: dbErr } = await supabase.from('seo_ahrefs_snapshots').insert({
      client,
      domain:            result.domain,
      snapshot_date:     result.snapshot_date,
      domain_rating:     result.domain_rating,
      ahrefs_rank:       result.ahrefs_rank,
      organic_traffic:   result.organic_traffic,
      organic_keywords:  result.organic_keywords,
      backlinks:         result.backlinks,
      referring_domains: result.referring_domains,
      notes:             analysisNotes.trim() || null,
    })
    if (dbErr) {
      setError(dbErr.message)
    } else {
      setSavedOk(true)
      setResult(null)
      setDomain('')
      setAnalysisNotes('')
    }
    setSaving(false)
  }

  return (
    <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">

      {/* Header */}
      <div className="border-b border-stroke px-6 py-5 dark:border-strokedark flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-black dark:text-[#E2E5E9]">Run Initial Analysis</h3>
          <p className="mt-0.5 text-sm text-body dark:text-bodydark">
            Select client, enter their domain, and pull the Ahrefs baseline — saved to Supabase
          </p>
        </div>
        <span className="shrink-0 flex items-center gap-1.5 rounded-full border border-orange-300/30
                         bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-500">
          Ahrefs v3
        </span>
      </div>

      <div className="px-6 py-6 space-y-5">

        {/* Row 1: Client + Domain */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Client */}
          <div>
            <label className={LABEL_CLS}>Client</label>
            <div className="relative">
              <select
                value={client}
                onChange={e => { setClient(e.target.value); setError(''); setSavedOk(false) }}
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

          {/* Domain */}
          <div>
            <label className={LABEL_CLS}>Domain</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-body dark:text-bodydark">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.919 17.919 0 01-8.716-2.247" />
                </svg>
              </span>
              <input
                type="text"
                value={domain}
                onChange={e => { setDomain(e.target.value); setError(''); setSavedOk(false) }}
                onKeyDown={e => e.key === 'Enter' && runAnalysis()}
                placeholder="example.com"
                className={INPUT_CLS + ' pl-10'}
              />
            </div>
            <p className="mt-1 text-xs text-body dark:text-bodydark">Without https://</p>
          </div>
        </div>

        {/* Run button */}
        <div>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={fetching || !client || !domain.trim()}
            className="flex items-center gap-2 rounded-lg bg-[#1A72D9] px-6 py-2.5
                       text-sm font-semibold text-white transition
                       disabled:opacity-50 hover:bg-[#0F4FA8] active:scale-[0.98]"
          >
            {fetching
              ? <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg> Fetching from Ahrefs…</>
              : <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg> Run Initial Analysis</>
            }
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3">
            <svg className="h-4 w-4 text-danger mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-xs text-danger">{error}</p>
          </div>
        )}

        {/* Success */}
        {savedOk && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
            <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Baseline saved successfully to Supabase
            </p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 rounded-xl border border-[#1A72D9]/20 bg-[#1A72D9]/5 p-5">

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-black dark:text-[#E2E5E9]">{result.domain}</span>
              <span className="text-xs text-body dark:text-bodydark">· {result.snapshot_date}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricCard label="Domain Rating"    value={result.domain_rating}    unit="/100" color="text-orange-500" />
              <MetricCard label="Ahrefs Rank"      value={result.ahrefs_rank}                  color="text-[#1A72D9]" />
              <MetricCard label="Organic Traffic"  value={result.organic_traffic}  unit="/mo"  color="text-emerald-500" />
              <MetricCard label="Keywords"         value={result.organic_keywords}             color="text-emerald-500" />
              <MetricCard label="Backlinks"        value={result.backlinks}                    color="text-purple-500" />
              <MetricCard label="Ref. Domains"     value={result.referring_domains}            color="text-purple-500" />
            </div>

            {/* Optional notes */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-black dark:text-[#E2E5E9]">
                Notes <span className="font-normal text-body dark:text-bodydark">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={analysisNotes}
                onChange={e => setAnalysisNotes(e.target.value)}
                placeholder="Observations about this baseline…"
                className={INPUT_CLS + ' resize-none text-xs'}
              />
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={saveBaseline}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5
                           text-sm font-semibold text-white transition
                           disabled:opacity-50 hover:bg-emerald-700 active:scale-[0.98]"
              >
                {saving
                  ? 'Saving…'
                  : <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg> Save as Initial Baseline</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
