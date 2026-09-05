import { useState, useEffect, useCallback } from 'react'
import { Download, Trash2, Loader2, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSEODashboardState, getDateRange, formatDateLabel } from '@/features/seo/hooks/useSEODashboardState'
import { safeDomain } from '@/features/seo/lib/exportQuarterlySeoReport'
import { buildClientQuarterlyReportBlob } from '@/features/seo/lib/exportClientQuarterlyReport'
import type { QuarterlyReportData, AhrefsSnapshot, OnPageAuditSummary } from '@/features/seo/lib/exportClientQuarterlyReport'

interface ReportRow {
  id: number
  title: string
  start_date: string | null
  end_date: string | null
  storage_path: string
  created_at: string
}

const BUCKET = 'seo-reports'

export function SEOClientReports() {
  const state = useSEODashboardState()
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const loadReports = useCallback(async () => {
    if (!state.selectedClientId) { setReports([]); return }
    setLoadingList(true)
    const { data } = await supabase
      .from('seo_client_reports')
      .select('id, title, start_date, end_date, storage_path, created_at')
      .eq('client_id', state.selectedClientId)
      .order('created_at', { ascending: false })
    setReports(data ?? [])
    setLoadingList(false)
  }, [state.selectedClientId])

  useEffect(() => { loadReports() }, [loadReports])

  async function handleGenerate() {
    if (!state.selectedClientId || !state.selectedGscSite) return
    setGenerating(true)
    setError('')
    try {
      const { startDate, endDate } = getDateRange(90)
      const domain = safeDomain(state.selectedGscSite)

      const reportParams = new URLSearchParams({ site: state.selectedGscSite, ga4: state.selectedGa4Id, startDate, endDate })
      const reportRes = await fetch(`/api/seo/quarterly-report?${reportParams}`)
      const reportJson = await reportRes.json()
      if (!reportRes.ok || reportJson.error) throw new Error(reportJson.error ?? 'Could not generate the report')
      const data = reportJson as QuarterlyReportData

      const [snapshotsRes, auditRes, psiRes, profileRes] = await Promise.allSettled([
        supabase.from('seo_ahrefs_snapshots').select('snapshot_date, domain_rating, organic_traffic, organic_keywords, backlinks, referring_domains')
          .eq('client', state.clientName).order('snapshot_date', { ascending: false }).limit(2),
        supabase.from('seo_onpage_audits').select('status, landing_page_url, created_at')
          .eq('client', state.clientName).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        fetch(`/api/seo/pagespeed?url=${encodeURIComponent(`https://${domain}`)}`).then((r) => r.ok ? r.json() : null),
        supabase.from('client_profiles').select('logo_url').eq('client_id', state.selectedClientId).maybeSingle(),
      ])

      const ahrefsSnapshots = snapshotsRes.status === 'fulfilled' ? (snapshotsRes.value.data as AhrefsSnapshot[] | null) ?? [] : []
      const onPageAudit = auditRes.status === 'fulfilled' ? (auditRes.value.data as OnPageAuditSummary | null) : null
      const psiScore = psiRes.status === 'fulfilled' && psiRes.value ? psiRes.value.score ?? null : null
      const clientLogoUrl = profileRes.status === 'fulfilled' ? profileRes.value.data?.logo_url ?? '' : ''

      const blob = await buildClientQuarterlyReportBlob({
        data,
        clientName: state.clientName || domain,
        psiScore,
        ahrefsSnapshots,
        onPageAudit,
        clientLogoUrl,
      })

      const path = `${state.selectedClientId}/${Date.now()}.pdf`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'application/pdf' })
      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('seo_client_reports').insert({
        client_id: state.selectedClientId,
        client_name: state.clientName,
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        storage_path: path,
      })
      if (insertError) throw insertError

      setTitle('')
      await loadReports()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the report')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload(row: ReportRow) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(row.storage_path)
    if (data?.publicUrl) window.open(data.publicUrl, '_blank')
  }

  async function handleDelete(row: ReportRow) {
    if (!window.confirm('Delete this report? This action cannot be undone.')) return
    await supabase.storage.from(BUCKET).remove([row.storage_path])
    await supabase.from('seo_client_reports').delete().eq('id', row.id)
    setReports((current) => current.filter((r) => r.id !== row.id))
  }

  return (
    <div className="mx-auto max-w-screen-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">Reports</h1>
        <p className="mt-1 text-sm text-body dark:text-bodydark">
          {state.clientName ? `History of quarterly reports generated for ${state.clientName}.` : 'Select a client to view their report history.'}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-stroke bg-white px-5 py-4 dark:border-strokedark dark:bg-boxdark">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Report title (optional, e.g. September Report)"
          className="min-w-[240px] flex-1 rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-black focus:border-[#1A72D9] focus:outline-none dark:border-strokedark dark:text-[#E2E5E9]"
        />
        <button
          onClick={handleGenerate}
          disabled={generating || !state.selectedClientId}
          className="flex items-center gap-2 rounded-lg bg-[#1A72D9] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1A72D9]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {generating ? 'Generating report…' : 'Generate Report'}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-stroke bg-white dark:border-strokedark dark:bg-boxdark">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stroke bg-[var(--bg-subtle)] dark:border-strokedark">
              <th className="px-6 py-3 font-semibold text-body dark:text-bodydark">Title</th>
              <th className="px-6 py-3 font-semibold text-body dark:text-bodydark">Period Covered</th>
              <th className="px-6 py-3 font-semibold text-body dark:text-bodydark">Generated On</th>
              <th className="px-6 py-3 font-semibold text-body dark:text-bodydark">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke dark:divide-strokedark">
            {reports.map((row) => (
              <tr key={row.id}>
                <td className="px-6 py-4 text-black dark:text-[#E2E5E9]">
                  {row.title || 'Untitled report'}
                </td>
                <td className="px-6 py-4 text-body dark:text-bodydark">
                  {row.start_date && row.end_date ? formatDateLabel(row.start_date, row.end_date) : '—'}
                </td>
                <td className="px-6 py-4 text-body dark:text-bodydark">
                  {new Date(row.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleDownload(row)} className="flex items-center gap-1.5 text-xs font-semibold text-[#1A72D9] hover:underline">
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                    <button onClick={() => handleDelete(row)} className="flex items-center gap-1.5 text-xs font-semibold text-danger hover:underline">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-body dark:text-bodydark">
                  {loadingList ? 'Loading…' : state.selectedClientId ? 'No reports have been generated for this client yet.' : 'Select a client in the sidebar.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
