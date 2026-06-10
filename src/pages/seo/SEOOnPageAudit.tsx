import { useState, useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'
import { supabase } from '../../lib/supabase'
import { GBPReport } from '../../features/seo/components/GBPReport'
import { RunAhrefsCard } from '../../features/seo/components/RunAhrefsCard'
import type { GBPReportHandle } from '../../features/seo/components/GBPReport'
import { InitialStatus } from '../../features/seo/components/InitialStatus'
import { Comparative } from '../../features/seo/components/Comparative'
import { useSEODashboardState } from '../../features/seo/hooks/useSEODashboardState'
import { DashboardControls } from '../../features/seo/components/DashboardControls'

const STATUS = { idle: 'idle', loading: 'loading', ready: 'ready', error: 'error' } as const
type StatusKey = typeof STATUS[keyof typeof STATUS]

type TabKey = 'run-audit' | 'initial-status' | 'comparative' | 'download-reports'

const TABS: { id: TabKey; label: string; icon: React.ReactNode }[] = [
  {
    id: 'run-audit',
    label: 'Run Audit',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
              d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
    ),
  },
  {
    id: 'initial-status',
    label: 'Initial Status',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
      </svg>
    ),
  },
  {
    id: 'comparative',
    label: 'Comparative',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
              d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    id: 'download-reports',
    label: 'Download Reports',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
  },
]

const POLL_INTERVAL = 5000
const POLL_TIMEOUT  = 10 * 60 * 1000

interface OnPageAuditRow {
  id: number
  client: string
  landing_page_url: string
  status: string            // running / completed / error
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export function SEOOnPageAudit() {
  const seoState = useSEODashboardState()
  const [activeTab, setActiveTab] = useState<TabKey>('run-audit')
  const [landingPageUrl, setLandingPageUrl]               = useState('')
  const [screamingFrogSheetUrl, setScreamingFrogSheetUrl] = useState('')
  const [status, setStatus]     = useState<StatusKey>(STATUS.idle)
  const [errorMsg, setErrorMsg] = useState('')
  const [auditHtml, setAuditHtml] = useState('')
  const [submittedUrl, setSubmittedUrl] = useState('')
  const [elapsedSecs, setElapsedSecs] = useState(0)

  const [clients, setClients]       = useState<string[]>([])
  const [client, setClient]         = useState('')
  const [audits, setAudits]         = useState<OnPageAuditRow[]>([])
  const [viewingId, setViewingId]   = useState<number | null>(null)

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const auditIdRef   = useRef<number | null>(null)
  const gbpRef       = useRef<GBPReportHandle>(null)

  function stopPolling() {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  useEffect(() => () => stopPolling(), [])

  useEffect(() => {
    loadClients()
    loadAudits()
  }, [])

  async function loadClients() {
    const { data } = await supabase.from('client_profiles').select('client_id')
    if (data) setClients(data.map((r: { client_id: string }) => r.client_id))
  }

  async function loadAudits() {
    const { data } = await supabase
      .from('seo_onpage_audits')
      .select('id, client, landing_page_url, status, error_message, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setAudits(data as OnPageAuditRow[])
  }

  async function markAuditFailed(message: string) {
    if (auditIdRef.current === null) return
    await supabase
      .from('seo_onpage_audits')
      .update({ status: 'error', error_message: message, completed_at: new Date().toISOString() })
      .eq('id', auditIdRef.current)
    loadAudits()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!client) {
      setErrorMsg('Select a client first — every audit is registered against a client.')
      setStatus(STATUS.error)
      return
    }
    setStatus(STATUS.loading)
    setErrorMsg('')
    setAuditHtml('')
    setElapsedSecs(0)
    setSubmittedUrl(landingPageUrl)

    // Register the audit run in Supabase before launching the workflow
    const { data: row } = await supabase
      .from('seo_onpage_audits')
      .insert({
        client,
        landing_page_url:   landingPageUrl,
        screaming_frog_url: screamingFrogSheetUrl,
        status: 'running',
      })
      .select('id')
      .single()
    auditIdRef.current = row?.id ?? null
    loadAudits()

    try {
      const res  = await fetch('/api/seo/onpage-audit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landingPageUrl, screamingFrogSheetUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setErrorMsg(message)
      setStatus(STATUS.error)
      markAuditFailed(message)
      return
    }

    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)

    const url = landingPageUrl
    pollRef.current = setInterval(async () => {
      if (Date.now() - startTimeRef.current > POLL_TIMEOUT) {
        stopPolling()
        setErrorMsg('Audit timed out after 10 minutes. Please try again.')
        setStatus(STATUS.error)
        markAuditFailed('Audit timed out after 10 minutes')
        return
      }
      try {
        const r    = await fetch(`/api/seo/onpage-audit/result?url=${encodeURIComponent(url)}`)
        const data = await r.json()
        if (data.ready) {
          stopPolling()
          setAuditHtml(DOMPurify.sanitize(data.html, { USE_PROFILES: { html: true } }))
          setStatus(STATUS.ready)
          // Persist the finished report so it stays in the client's audit history
          if (auditIdRef.current !== null) {
            await supabase
              .from('seo_onpage_audits')
              .update({ status: 'completed', audit_html: data.html, completed_at: new Date().toISOString() })
              .eq('id', auditIdRef.current)
            loadAudits()
          }
        }
      } catch {
        // network hiccup — keep polling
      }
    }, POLL_INTERVAL)
  }

  async function viewSavedAudit(a: OnPageAuditRow) {
    setViewingId(a.id)
    const { data } = await supabase
      .from('seo_onpage_audits')
      .select('audit_html')
      .eq('id', a.id)
      .single()
    setViewingId(null)
    if (data?.audit_html) {
      stopPolling()
      setSubmittedUrl(a.landing_page_url)
      setAuditHtml(DOMPurify.sanitize(data.audit_html, { USE_PROFILES: { html: true } }))
      setStatus(STATUS.ready)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function handleReset() {
    stopPolling()
    setStatus(STATUS.idle)
    setErrorMsg('')
    setLandingPageUrl('')
    setScreamingFrogSheetUrl('')
    setAuditHtml('')
    setSubmittedUrl('')
    setElapsedSecs(0)
    auditIdRef.current = null
    loadAudits()
  }

  const mins = String(Math.floor(elapsedSecs / 60)).padStart(2, '0')
  const secs = String(elapsedSecs % 60).padStart(2, '0')

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">

      {/* Tabs */}
      <div className="mb-8 border-b border-stroke dark:border-strokedark">
        <nav className="-mb-px flex gap-0" aria-label="Tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-150 whitespace-nowrap',
                  isActive
                    ? 'border-[#1A72D9] text-[#1A72D9]'
                    : 'border-transparent text-body dark:text-bodydark hover:text-black dark:hover:text-white hover:border-stroke dark:hover:border-strokedark',
                ].join(' ')}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab: Initial Status */}
      {activeTab === 'initial-status' && (
        <>
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A72D9]/15 border border-[#1A72D9]/20">
                <svg className="h-4 w-4 text-[#1A72D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">Initial Status</h1>
            </div>
            <p className="text-sm text-body dark:text-bodydark ml-11">
              Baseline SEO snapshot recorded at client onboarding
            </p>
          </div>
          <InitialStatus />
        </>
      )}

      {/* Tab: Comparative */}
      {activeTab === 'comparative' && (
        <>
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">Comparative</h1>
            </div>
            <p className="text-sm text-body dark:text-bodydark ml-11">
              Initial Status vs. current audit — track progress since onboarding
            </p>
          </div>
          <Comparative selectedGscSite={seoState.selectedGscSite} />
        </>
      )}

      {/* Tab: Download Reports — Google Business Profile Report */}
      {activeTab === 'download-reports' && (
        <>
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4285F4]/10 border border-[#4285F4]/20">
                <svg className="h-4 w-4 text-[#4285F4]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">GBP Report</h1>
            </div>
            <p className="text-sm text-body dark:text-bodydark ml-11">
              Google Business Profile · Analytics · Search Console — select a client to generate their report
            </p>
          </div>

          {/* Client selector */}
          <div className="mb-6">
            <DashboardControls
              {...seoState}
              showDateRange={true}
              pageTitle="GBP-Report"
              onRefresh={() => {}}
              onExportPdf={() => gbpRef.current?.triggerDownload() ?? Promise.resolve()}
            />
          </div>

          <GBPReport
            ref={gbpRef}
            selectedGscSite={seoState.selectedGscSite}
            selectedGa4Id={seoState.selectedGa4Id}
            dateRange={seoState.dateRange}
            clientLabel={seoState.clientName || undefined}
          />
        </>
      )}

      {/* Tab: Run Audit */}
      {activeTab === 'run-audit' && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A72D9]/15 border border-[#1A72D9]/20">
              <svg className="h-4 w-4 text-[#1A72D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">On-Page SEO Audit</h1>
          </div>
          <p className="text-sm text-body dark:text-bodydark ml-11">
            Technical · Content · Screaming Frog analysis — results displayed here
          </p>
        </div>
      )}

      {activeTab === 'run-audit' && status === STATUS.ready ? (
        <div>
          <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-body dark:text-bodydark mb-0.5">Audit complete</p>
                <p className="font-mono text-sm text-[#1A72D9]">{submittedUrl}</p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-lg border border-[#1A72D9]/30 bg-[#1A72D9]/10
                         px-5 py-2.5 text-sm font-medium text-[#1A72D9] transition-all duration-150
                         hover:bg-[#1A72D9]/20 active:scale-[0.98]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Run Another Audit
            </button>
          </div>

          <div className="rounded-xl border border-white/5 bg-[#141827] overflow-hidden">
            {/* Static scoped styles — no user content, safe to inject directly */}
            <style>{`
.audit-report { color: #c9d1e0; font-family: inherit; line-height: 1.7; padding: 2.5rem; }
.audit-report h1 { display: flex; align-items: center; gap: .75rem; font-size: 1.125rem; font-weight: 700; color: #fff; padding: 1rem 1.5rem; margin: 0 -2.5rem 2rem -2.5rem; background: linear-gradient(90deg,rgba(26,114,217,.15) 0%,rgba(26,114,217,.04) 100%); border-top: 1px solid rgba(26,114,217,.15); border-bottom: 1px solid rgba(26,114,217,.15); }
.audit-report h1:first-child { margin-top: -2.5rem; border-top: none; }
.audit-report h1 em { font-style: normal; font-size: .75rem; font-weight: 400; color: rgba(255,255,255,.35); letter-spacing: .03em; }
.audit-report h2 { display: flex; align-items: center; gap: .6rem; font-size: .9375rem; font-weight: 600; color: #fff; margin: 2rem 0 1rem; padding: .75rem 1rem; border-radius: .5rem; border-left: 3px solid; }
.audit-report h2.critical    { border-color: #f43f5e; background: rgba(244,63,94,.07);   color: #fda4af; }
.audit-report h2.quickwin    { border-color: #f59e0b; background: rgba(245,158,11,.07);  color: #fcd34d; }
.audit-report h2.opportunity { border-color: #10b981; background: rgba(16,185,129,.07);  color: #6ee7b7; }
.audit-report h2.summary     { border-color: #1A72D9; background: rgba(26,114,217,.07);  color: #7db8f7; }
.audit-report h2.generic     { border-color: rgba(255,255,255,.1); background: rgba(255,255,255,.03); }
.audit-report h3 { font-size: .8125rem; font-weight: 600; color: rgba(255,255,255,.7); margin: 1.5rem 0 .5rem; padding-bottom: .375rem; border-bottom: 1px solid rgba(255,255,255,.06); text-transform: uppercase; letter-spacing: .06em; }
.audit-report p { font-size: .875rem; color: #9aafc8; margin: .5rem 0 .75rem; line-height: 1.75; }
.audit-report ul { margin: .5rem 0 1rem; padding: 0; list-style: none; display: flex; flex-direction: column; gap: .375rem; }
.audit-report li { font-size: .8125rem; color: #9aafc8; padding: .5rem .75rem; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.05); border-radius: .375rem; display: flex; align-items: flex-start; gap: .5rem; line-height: 1.6; }
.audit-report li::before { content: ''; display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #1A72D9; margin-top: .45rem; flex-shrink: 0; }
.audit-report li:has(a),.audit-report li a { font-family: 'SF Mono','Fira Code',monospace; font-size: .75rem; color: #7db8f7; word-break: break-all; }
.audit-report a { color: #7db8f7; text-decoration: none; }
.audit-report a:hover { text-decoration: underline; }
.audit-report strong,.audit-report b { color: #fff; font-weight: 600; }
.audit-report code { font-family: 'SF Mono','Fira Code',monospace; font-size: .75rem; background: rgba(26,114,217,.12); color: #7db8f7; padding: .1rem .4rem; border-radius: .25rem; border: 1px solid rgba(26,114,217,.2); }
.audit-report table { width: 100%; border-collapse: collapse; font-size: .8125rem; margin: 1rem 0; border-radius: .5rem; overflow: hidden; border: 1px solid rgba(255,255,255,.06); }
.audit-report thead { background: rgba(26,114,217,.1); }
.audit-report th { padding: .625rem .875rem; text-align: left; font-size: .6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: rgba(255,255,255,.5); border-bottom: 1px solid rgba(255,255,255,.08); }
.audit-report td { padding: .5rem .875rem; color: #9aafc8; border-bottom: 1px solid rgba(255,255,255,.04); }
.audit-report tr:last-child td { border-bottom: none; }
.audit-report tbody tr:hover td { background: rgba(255,255,255,.02); }
.audit-report hr { margin: 2.5rem -2.5rem; border: none; height: 1px; background: linear-gradient(90deg,transparent,rgba(255,255,255,.08) 20%,rgba(255,255,255,.08) 80%,transparent); }
`}</style>
            {/* Sanitized user HTML — DOMPurify applied at fetch time, static CSS injected separately above */}
            <div
              className="audit-report"
              dangerouslySetInnerHTML={{
                __html: auditHtml
                  .replace(/Google Sheet SEO Audit/gi, 'SEO Audit')
                  .replace(/<h2>([^<]*🔴[^<]*)<\/h2>/gi, '<h2 class="critical">$1</h2>')
                  .replace(/<h2>([^<]*🟡[^<]*)<\/h2>/gi, '<h2 class="quickwin">$1</h2>')
                  .replace(/<h2>([^<]*🟢[^<]*)<\/h2>/gi, '<h2 class="opportunity">$1</h2>')
                  .replace(/<h2>([^<]*📊[^<]*)<\/h2>/gi, '<h2 class="summary">$1</h2>')
                  .replace(/<h2>(?!.*class=)(.*?)<\/h2>/gi, '<h2 class="generic">$1</h2>'),
              }}
            />
          </div>
        </div>
      ) : activeTab === 'run-audit' ? (
        <div className="space-y-6">

          {/* Ahrefs Run Card */}
          <RunAhrefsCard />

          {status === STATUS.loading ? (
            <div className="rounded-xl border border-[#1A72D9]/20 bg-[#1A72D9]/5 px-8 py-12 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center
                              rounded-full bg-[#1A72D9]/10 border border-[#1A72D9]/20">
                <svg className="h-8 w-8 text-[#1A72D9] animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-black dark:text-[#E2E5E9] mb-2">Running Audit…</h2>
              <p className="text-sm text-body dark:text-bodydark mb-1">
                The workflow is processing. This typically takes{' '}
                <span className="text-black dark:text-[#E2E5E9] font-medium">3–8 minutes</span>.
              </p>
              <p className="text-sm text-body dark:text-bodydark mb-8">
                Results will appear here automatically — no need to refresh.
              </p>
              <div className="rounded-lg bg-white/5 border border-white/5 px-4 py-3 mb-4 inline-block min-w-[220px]">
                <p className="text-[11px] uppercase tracking-wider text-white/25 mb-1">Elapsed</p>
                <p className="font-mono text-2xl font-bold text-[#1A72D9]">{mins}:{secs}</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/5 px-4 py-3 text-left mt-2">
                <p className="text-[11px] uppercase tracking-wider text-white/25 mb-1">Auditing</p>
                <p className="font-mono text-sm text-white/70 truncate">{submittedUrl}</p>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit}>
                <div className="rounded-xl border border-stroke bg-white shadow-default
                                dark:border-strokedark dark:bg-boxdark">
                  <div className="border-b border-stroke px-6 py-5 dark:border-strokedark">
                    <h3 className="font-semibold text-black dark:text-[#E2E5E9]">Audit Inputs</h3>
                    <p className="mt-0.5 text-xs text-body dark:text-bodydark">
                      Provide the landing page and your Screaming Frog export sheet
                    </p>
                  </div>

                  <div className="px-6 py-6 space-y-6">

                    {/* Client */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-black dark:text-[#E2E5E9]">
                        Client
                        <span className="ml-1 text-danger">*</span>
                      </label>
                      <div className="relative">
                        <select
                          required
                          value={client}
                          onChange={(e) => setClient(e.target.value)}
                          className="w-full appearance-none rounded-lg border border-stroke bg-white px-4 py-3 pr-8
                                     text-sm text-black outline-none
                                     transition focus:border-[#1A72D9] focus:ring-1 focus:ring-[#1A72D9]/30
                                     dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]
                                     dark:focus:border-[#1A72D9]"
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
                      <p className="mt-1.5 text-xs text-body dark:text-bodydark">
                        The audit is registered in this client's history
                      </p>
                    </div>

                    {/* Landing Page URL */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-black dark:text-[#E2E5E9]">
                        Landing Page URL
                        <span className="ml-1 text-danger">*</span>
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                          <svg className="h-4 w-4 text-body dark:text-bodydark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                          </svg>
                        </span>
                        <input
                          type="url"
                          required
                          value={landingPageUrl}
                          onChange={(e) => setLandingPageUrl(e.target.value)}
                          placeholder="https://example.com/landing-page"
                          className="w-full rounded-lg border border-stroke bg-transparent pl-10 pr-4 py-3
                                     text-sm text-black placeholder-body outline-none
                                     transition focus:border-[#1A72D9] focus:ring-1 focus:ring-[#1A72D9]/30
                                     dark:border-strokedark dark:text-[#E2E5E9] dark:placeholder-bodydark
                                     dark:focus:border-[#1A72D9]"
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-body dark:text-bodydark">
                        The full URL of the page to audit (must be publicly accessible)
                      </p>
                    </div>

                    {/* Screaming Frog Sheet */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-black dark:text-[#E2E5E9]">
                        Screaming Frog Google Sheet URL
                        <span className="ml-1 text-danger">*</span>
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                          <svg className="h-4 w-4 text-body dark:text-bodydark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c-.621 0-1.125.504-1.125 1.125v1.5m2.25-2.625h7.5" />
                          </svg>
                        </span>
                        <input
                          type="url"
                          required
                          value={screamingFrogSheetUrl}
                          onChange={(e) => setScreamingFrogSheetUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="w-full rounded-lg border border-stroke bg-transparent pl-10 pr-4 py-3
                                     text-sm text-black placeholder-body outline-none
                                     transition focus:border-[#1A72D9] focus:ring-1 focus:ring-[#1A72D9]/30
                                     dark:border-strokedark dark:text-[#E2E5E9] dark:placeholder-bodydark
                                     dark:focus:border-[#1A72D9]"
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-body dark:text-bodydark">
                        Google Sheet with Screaming Frog export data (must be shared with the service account)
                      </p>
                    </div>

                    {/* Error banner */}
                    {status === STATUS.error && (
                      <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3">
                        <svg className="h-4 w-4 text-danger mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <p className="text-xs text-danger">{errorMsg}</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-stroke px-6 py-4 dark:border-strokedark flex items-center justify-between gap-4">
                    <p className="text-xs text-body dark:text-bodydark">
                      Audit takes ~3–8 min · Results appear in this page
                    </p>
                    <button
                      type="submit"
                      className="flex items-center gap-2 rounded-lg bg-[#1A72D9] px-5 py-2.5
                                 text-sm font-semibold text-white transition-all duration-150
                                 hover:bg-[#0F4FA8] active:scale-[0.98]"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                              d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                      Run Audit
                    </button>
                  </div>
                </div>
              </form>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                <div className="rounded-xl border border-stroke bg-white shadow-default
                                dark:border-strokedark dark:bg-boxdark">
                  <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
                    <h3 className="font-semibold text-black dark:text-[#E2E5E9]">What's Included</h3>
                    <p className="mt-0.5 text-xs text-body dark:text-bodydark">
                      Three AI-powered audit modules run in parallel
                    </p>
                  </div>
                  <div className="divide-y divide-stroke dark:divide-strokedark">
                    {[
                      {
                        label: 'Technical SEO Audit',
                        desc: 'Critical issues, quick wins, and structural opportunities from live page HTML',
                        color: 'bg-[#1A72D9]/10 text-[#1A72D9]',
                        icon: (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                          </svg>
                        ),
                      },
                      {
                        label: 'Content Audit',
                        desc: 'Keyword density, readability scores (Flesch-Kincaid, Gunning-Fog), and copy recommendations',
                        color: 'bg-[#F47C20]/10 text-[#F47C20]',
                        icon: (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        ),
                      },
                      {
                        label: 'Screaming Frog Audit',
                        desc: 'H1 tags, meta descriptions, titles, internal links, URL status, and word count across all crawled pages',
                        color: 'bg-emerald-500/10 text-emerald-400',
                        icon: (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c-.621 0-1.125.504-1.125 1.125v1.5m2.25-2.625h7.5" />
                          </svg>
                        ),
                      },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-4 px-6 py-4">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                          {item.icon}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-black dark:text-[#E2E5E9]">{item.label}</p>
                          <p className="mt-0.5 text-xs text-body dark:text-bodydark leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-stroke bg-white shadow-default
                                dark:border-strokedark dark:bg-boxdark">
                  <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
                    <h3 className="font-semibold text-black dark:text-[#E2E5E9]">Screaming Frog Setup</h3>
                  </div>
                  <div className="px-6 py-5 space-y-3">
                    {[
                      'Crawl the site in Screaming Frog SEO Spider',
                      'Export the full crawl to Google Sheets (File → Export → Google Sheets)',
                      'Make sure the sheet is shared with the Google service account',
                      'Paste the sheet URL above — the workflow reads Sheet1 automatically',
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                                         bg-[#1A72D9]/10 text-[10px] font-bold text-[#1A72D9]">
                          {i + 1}
                        </span>
                        <p className="text-xs text-body dark:text-bodydark leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* ══ AUDIT HISTORY ══════════════════════════════════════════ */}
              <div className="rounded-xl border border-stroke bg-white shadow-default
                              dark:border-strokedark dark:bg-boxdark">
                <div className="border-b border-stroke px-6 py-4 dark:border-strokedark flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-black dark:text-[#E2E5E9]">Audit History</h3>
                    <p className="mt-0.5 text-xs text-body dark:text-bodydark">
                      Every audit run is registered per client — reopen any saved report
                    </p>
                  </div>
                  {audits.length > 0 && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {audits.length} audit{audits.length !== 1 ? 's' : ''} registered
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="border-b border-stroke bg-gray-50/50 dark:border-strokedark dark:bg-black/10">
                        {['Client', 'Landing Page', 'Date', 'Status', ''].map(col => (
                          <th key={col} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-body dark:text-bodydark whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stroke dark:divide-strokedark">
                      {audits.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-sm text-body dark:text-bodydark">
                            No audits registered yet. Run your first audit above.
                          </td>
                        </tr>
                      ) : audits.map(a => (
                        <tr key={a.id} className="transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                          <td className="px-5 py-3.5 text-sm font-medium text-black dark:text-[#E2E5E9] whitespace-nowrap">{a.client}</td>
                          <td className="px-5 py-3.5 font-mono text-xs text-[#1A72D9] max-w-[280px] truncate">{a.landing_page_url}</td>
                          <td className="px-5 py-3.5 text-xs text-body dark:text-bodydark whitespace-nowrap">
                            {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              a.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                                : a.status === 'running'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                            }`}>
                              {a.status === 'running' && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />}
                              {a.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {a.status === 'completed' && (
                              <button
                                type="button"
                                onClick={() => viewSavedAudit(a)}
                                disabled={viewingId === a.id}
                                className="rounded-lg border border-[#1A72D9]/30 bg-[#1A72D9]/10 px-3 py-1.5
                                           text-xs font-medium text-[#1A72D9] transition
                                           disabled:opacity-50 hover:bg-[#1A72D9]/20 active:scale-[0.98]"
                              >
                                {viewingId === a.id ? 'Loading…' : 'View Report'}
                              </button>
                            )}
                            {a.status === 'error' && a.error_message && (
                              <span className="text-xs text-red-500/80 max-w-[180px] inline-block truncate" title={a.error_message}>
                                {a.error_message}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

    </div>
  )
}
