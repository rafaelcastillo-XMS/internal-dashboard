import { useState, useCallback, useEffect } from 'react'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { DashboardControls } from '@/features/sem/components/DashboardControls'
import { useSEMDashboardState, formatDateLabel } from '@/features/sem/hooks/useSEMDashboardState'
import { cacheGet, cacheSet } from '@/features/sem/lib/semCache'
import { supabase } from '@/lib/supabase'

interface Campaign {
  id:                  string
  name:                string
  status:              string
  impressions:         number
  clicks:              number
  cost:                number
  ctr:                 number
  avg_cpc:             number
  conversions:         number
  cost_per_conversion: number
}

interface Summary {
  impressions:         number
  clicks:              number
  cost:                number
  ctr:                 number
  avg_cpc:             number
  conversions:         number
  cost_per_conversion: number
}

export interface YearlyAdsMetrics {
  month: string;
  service: string;
  spend: number;
  clicks: number;
  conversions: number;
  impressions: number;
  ctr: number;
  avg_cpc: number;
  interactions: number;
  opt_score: number;
}

export interface YearlyGuaranteeMetrics {
  month: string;
  service: string;
  spend: number;
  leads: number;
  cost_per_lead: number;
  ad_impressions: number;
  top_imp_rate: number;
  abs_top_imp_rate: number;
}

export const ALL_MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtCurrency(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-stroke bg-white px-5 py-4 shadow-default dark:border-strokedark dark:bg-boxdark">
      <p className="text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-black dark:text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-body dark:text-bodydark">{sub}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const enabled = status === 'ENABLED'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold
      ${enabled ? 'bg-meta-3/10 text-meta-3' : 'bg-stroke/50 text-body dark:text-bodydark'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-meta-3' : 'bg-body'}`} />
      {enabled ? 'Active' : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}

function summarize(campaigns: Campaign[]): Summary {
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0)
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0)
  const cost = Math.round(campaigns.reduce((s, c) => s + c.cost, 0) * 100) / 100
  const conversions = Math.round(campaigns.reduce((s, c) => s + c.conversions, 0) * 10) / 10
  const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0
  const avg_cpc = clicks > 0 ? Math.round((cost / clicks) * 100) / 100 : 0
  const cost_per_conversion = conversions > 0 ? Math.round((cost / conversions) * 100) / 100 : 0
  return { impressions, clicks, cost, ctr, avg_cpc, conversions, cost_per_conversion }
}

export function SEMDashboard() {
  const state = useSEMDashboardState()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [activeTab, setActiveTab] = useState<'ads' | 'guarantee'>('ads')
  
  // Dynamic state for Yearly Performance tables
  const [yearlyAds, setYearlyAds] = useState<YearlyAdsMetrics[]>([])
  const [yearlyGuarantee, setYearlyGuarantee] = useState<YearlyGuaranteeMetrics[]>([])
  const [selectedYear, setSelectedYear] = useState('2026')
  
  // Local notes state
  const [localNotes, setLocalNotes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('sem_dashboard_notes')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [editingNote, setEditingNote] = useState<{ key: string; month: string } | null>(null)

  const getNoteKey = useCallback((month: string) => {
    return `${state.selectedAccountId || 'default'}-${selectedYear}-${activeTab}-${month}`
  }, [state.selectedAccountId, selectedYear, activeTab])

  const handleSaveNote = (content: string) => {
    if (!editingNote) return
    const newNotes = { ...localNotes, [editingNote.key]: content }
    setLocalNotes(newNotes)
    localStorage.setItem('sem_dashboard_notes', JSON.stringify(newNotes))
    setEditingNote(null)
  }

  const fetchYearlyPerformance = useCallback(async (accountId: string, year: string) => {
    try {
      // Uncomment and adapt table names to your Supabase schema:
      /*
      const [adsRes, guaranteeRes] = await Promise.all([
        supabase.from('sem_yearly_ads').select('*').eq('account_id', accountId).eq('year', year).order('month_index', { ascending: true }),
        supabase.from('sem_yearly_guarantee').select('*').eq('account_id', accountId).eq('year', year).order('month_index', { ascending: true })
      ])
      
      if (adsRes.error) throw adsRes.error;
      if (guaranteeRes.error) throw guaranteeRes.error;

      setYearlyAds(adsRes.data || []);
      setYearlyGuarantee(guaranteeRes.data || []);
      */
      
      // Since it's dynamic now, we initialize to empty to prove it won't show hardcoded data.
      // Once your Supabase tables are ready, you can uncomment block above.
      setYearlyAds([]);
      setYearlyGuarantee([]);
      
    } catch (err) {
      console.error('[SEM Yearly Performance]', err)
      setYearlyAds([]);
      setYearlyGuarantee([]);
    }
  }, [])

  useEffect(() => {
    if (state.selectedAccountId) {
      fetchYearlyPerformance(state.selectedAccountId, selectedYear)
    }
  }, [state.selectedAccountId, selectedYear, fetchYearlyPerformance])

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedAccountId) return

    const cacheKey = `dashboard:${state.selectedAccountId}:${state.rangeKey}`
    if (!force) {
      const cached = cacheGet<{ data: Campaign[]; lastUpdated: string }>(cacheKey)
      if (cached) { setCampaigns(cached.data); state.setLastUpdated(new Date(cached.lastUpdated)); return }
    }
    state.setLoading(true)
    try {
      const { data, error } = await supabase
        .from('sem_campaigns')
        .select('campaign_id,campaign_name,status,impressions,clicks,cost,ctr,avg_cpc,conversions,cost_per_conversion')
        .eq('account_id', state.selectedAccountId)
        .eq('date_range', state.rangeKey)
        .order('cost', { ascending: false })
        .limit(100)
      if (error) { console.error('[SEM]', error.message); return }
      const rows: Campaign[] = (data || []).map((r) => ({
        id: r.campaign_id,
        name: r.campaign_name,
        status: r.status,
        impressions: r.impressions,
        clicks: r.clicks,
        cost: r.cost,
        ctr: r.ctr,
        avg_cpc: r.avg_cpc,
        conversions: r.conversions,
        cost_per_conversion: r.cost_per_conversion,
      }))
      const updated = new Date()
      setCampaigns(rows)
      cacheSet(cacheKey, { data: rows, lastUpdated: updated.toISOString() })
      state.setLastUpdated(updated)
    } catch (err) { console.error('[SEM]', err) } finally { state.setLoading(false) }
  }, [state.selectedAccountId, state.rangeKey])

  useEffect(() => { fetchData() }, [fetchData])

  const summary = summarize(campaigns)
  const topCampaigns = campaigns.slice(0, 8)
  const isDark = document.documentElement.classList.contains('dark')

  return (
    <SkeletonTheme
      baseColor={isDark ? '#1e293b' : '#f1f5f9'}
      highlightColor={isDark ? '#334155' : '#e2e8f0'}
      borderRadius={8}
    >
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">
            SEM
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-bold bg-[#16a34a]/20 text-[#16a34a] align-middle">Intelligence</span>
          </h1>
          <p className="text-sm text-body dark:text-bodydark">
            Google Ads · {state.dateRange.startDate
              ? formatDateLabel(state.dateRange.startDate, state.dateRange.endDate)
              : 'Select account and date range'}
            {state.lastUpdated ? ` · Updated ${state.lastUpdated.toLocaleTimeString()}` : ''}
          </p>
        </div>
        <DashboardControls
          {...state}
          onRefresh={() => fetchData(true)}
          pageTitle="SEM-Overview"
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        {state.loading ? (
          [...Array(7)].map((_, i) => (
            <div key={i} className="rounded-xl border border-stroke bg-white px-5 py-4 dark:border-strokedark dark:bg-boxdark">
              <Skeleton width={80} height={12} className="mb-2" />
              <Skeleton width={60} height={28} />
            </div>
          ))
        ) : (
          <>
            <MetricCard label="Impressions"   value={fmt(summary.impressions)} />
            <MetricCard label="Clicks"        value={fmt(summary.clicks)} />
            <MetricCard label="CTR"           value={`${fmt(summary.ctr, 2)}%`} />
            <MetricCard label="Avg CPC"       value={fmtCurrency(summary.avg_cpc)} />
            <MetricCard label="Total Spend"   value={fmtCurrency(summary.cost)} />
            <MetricCard label="Conversions"   value={fmt(summary.conversions, 1)} />
            <MetricCard label="Cost / Conv."  value={summary.conversions > 0 ? fmtCurrency(summary.cost_per_conversion) : '—'} />
          </>
        )}
      </div>

      <div className="mb-6 rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6 py-5 dark:border-strokedark flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-black dark:text-white">Top Campaigns</h3>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">Sorted by spend — {state.dateRange.startDate ? formatDateLabel(state.dateRange.startDate, state.dateRange.endDate) : '—'}</p>
          </div>
          {!state.loading && campaigns.length > 0 && (
            <span className="rounded-full bg-stroke/50 px-2.5 py-1 text-xs font-semibold text-body dark:text-bodydark dark:bg-strokedark">
              {campaigns.length} campaigns
            </span>
          )}
        </div>

        {state.loading ? (
          <div className="px-6 py-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton width="35%" height={16} />
                <Skeleton width={60} height={20} borderRadius={20} />
                <Skeleton width={70} height={16} />
                <Skeleton width={50} height={16} />
                <Skeleton width={50} height={16} />
                <Skeleton width={60} height={16} />
                <Skeleton width={70} height={16} />
              </div>
            ))}
          </div>
        ) : topCampaigns.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-body dark:text-bodydark">
              {state.selectedAccountId ? 'No campaign data for this period. Make sure the sync script has run.' : 'Select an account to load data.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke dark:border-strokedark">
                  {['Campaign', 'Status', 'Impressions', 'Clicks', 'CTR', 'Avg CPC', 'Spend', 'Conv.', 'Cost/Conv.'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-strokedark">
                {topCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                    <td className="max-w-[220px] truncate px-5 py-4 font-medium text-black dark:text-white" title={c.name}>{c.name}</td>
                    <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(c.impressions)}</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(c.clicks)}</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(c.ctr, 2)}%</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmtCurrency(c.avg_cpc)}</td>
                    <td className="px-5 py-4 tabular-nums font-semibold text-black dark:text-white">{fmtCurrency(c.cost)}</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(c.conversions, 1)}</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">
                      {c.conversions > 0 ? fmtCurrency(c.cost_per_conversion) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6 py-5 dark:border-strokedark flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-black dark:text-white">Yearly Performance</h3>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">Month-by-month metrics overview ({selectedYear})</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-8 rounded-lg border border-stroke bg-transparent px-3 py-1 text-xs outline-none focus:border-[#1A72D9] dark:border-strokedark dark:bg-boxdark"
            >
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
            <div className="flex bg-gray-2 dark:bg-meta-4 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('ads')}
              className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'ads' ? 'bg-white text-black shadow-sm dark:bg-boxdark dark:text-white' : 'text-body dark:text-bodydark hover:text-black dark:hover:text-white'}`}
            >
              Google Ads
            </button>
            <button
              onClick={() => setActiveTab('guarantee')}
              className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'guarantee' ? 'bg-white text-black shadow-sm dark:bg-boxdark dark:text-white' : 'text-body dark:text-bodydark hover:text-black dark:hover:text-white'}`}
            >
              Google Guarantee
            </button>
            </div>
          </div>
        </div>
        
        {activeTab === 'ads' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke dark:border-strokedark bg-gray-2 dark:bg-meta-4 text-left">
                  {['Month', 'Service', 'Total Spend', 'Clicks', 'Conv.', 'Impressions', 'CTR', 'Avg CPC', 'Interactions', 'Opt. Score', 'Notes'].map((h, idx) => {
                    const isStickyBg = idx === 0 || idx === 1;
                    const hasShadow = idx === 1;
                    return (
                      <th key={h} className={`whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark ${isStickyBg ? 'bg-[#f8fafc] dark:bg-meta-4' : ''} ${hasShadow ? 'border-r border-stroke/50 dark:border-strokedark/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] relative z-10' : ''}`}>
                        {h}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-strokedark">
                {ALL_MONTHS.map((monthName) => {
                  const row = yearlyAds.find(r => r.month === monthName);
                  if (row) {
                    return (
                      <tr key={monthName} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                        <td className="whitespace-nowrap px-5 py-4 font-bold text-black dark:text-white uppercase text-xs bg-[#f8fafc] dark:bg-meta-4/80">{row.month}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-body dark:text-bodydark bg-[#f8fafc] dark:bg-meta-4/80 border-r border-stroke/50 dark:border-strokedark/50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.08)] relative z-10">{row.service}</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums font-semibold text-black dark:text-white">{fmtCurrency(row.spend)}</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(row.clicks)}</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{row.conversions}</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(row.impressions)}</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(row.ctr, 2)}%</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmtCurrency(row.avg_cpc)}</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(row.interactions)}</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(row.opt_score, 2)}%</td>
                        <td className="whitespace-nowrap px-5 py-4 text-center">
                          <button 
                            onClick={() => setEditingNote({ key: getNoteKey(monthName), month: monthName })}
                            className={`transition-all hover:scale-110 ${localNotes[getNoteKey(monthName)] ? 'text-[#FFD700] opacity-100' : 'text-body dark:text-bodydark opacity-25 hover:opacity-50'}`} 
                            title={localNotes[getNoteKey(monthName)] ? "View/Edit Note" : "Add Note"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM6 6h12v2H6V6zm0 4h12v2H6v-2zm0 4h7v2H6v-2z"></path></svg>
                          </button>
                        </td>
                      </tr>
                    )
                  } else {
                    return (
                      <tr key={monthName} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                        <td className="whitespace-nowrap px-5 py-4 font-bold text-black dark:text-white uppercase text-xs bg-[#f8fafc] dark:bg-meta-4/80">{monthName}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-body dark:text-bodydark bg-[#f8fafc] dark:bg-meta-4/80 border-r border-stroke/50 dark:border-strokedark/50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.08)] relative z-10">Google Ads</td>
                        <td colSpan={8} className="whitespace-nowrap px-5 py-4 text-center text-body dark:text-bodydark italic text-xs opacity-60">
                          No data yet
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-center">
                          <button 
                            onClick={() => setEditingNote({ key: getNoteKey(monthName), month: monthName })}
                            className={`transition-all hover:scale-110 ${localNotes[getNoteKey(monthName)] ? 'text-[#FFD700] opacity-100' : 'text-body dark:text-bodydark opacity-25 hover:opacity-50'}`} 
                            title={localNotes[getNoteKey(monthName)] ? "View/Edit Note" : "Add Note"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM6 6h12v2H6V6zm0 4h12v2H6v-2zm0 4h7v2H6v-2z"></path></svg>
                          </button>
                        </td>
                      </tr>
                    )
                  }
                })}
              {/* Totals Row */}
              {yearlyAds.length > 0 && (
              <tr className="bg-meta-3/10 transition-colors">
                <td className="whitespace-nowrap px-5 py-4 font-bold text-black dark:text-white uppercase text-xs bg-[#eef7f2] dark:bg-[#1a382e]">TOTAL</td>
                <td className="whitespace-nowrap px-5 py-4 text-body dark:text-bodydark bg-[#eef7f2] dark:bg-[#1a382e] border-r border-stroke/50 dark:border-strokedark/50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.08)] relative z-10">-</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">{fmtCurrency(yearlyAds.reduce((sum, r) => sum + r.spend, 0))}</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">{fmt(yearlyAds.reduce((sum, r) => sum + r.clicks, 0))}</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">{yearlyAds.reduce((sum, r) => sum + r.conversions, 0).toFixed(2)}</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">{fmt(yearlyAds.reduce((sum, r) => sum + r.impressions, 0))}</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">{fmt(yearlyAds.reduce((sum, r) => sum + r.ctr, 0) / yearlyAds.length || 0, 2)}%</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">{fmtCurrency(yearlyAds.reduce((sum, r) => sum + r.avg_cpc, 0) / yearlyAds.length || 0)}</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">{fmt(yearlyAds.reduce((sum, r) => sum + r.interactions, 0))}</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">-</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">-</td>
              </tr>
              )}
            </tbody>
            </table>
          </div>
        )}

        {activeTab === 'guarantee' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke dark:border-strokedark bg-gray-2 dark:bg-meta-4 text-left">
                  {['Month', 'Service', 'Total Spend', 'Total Leads', 'Cost/Lead', 'Ad Impr.', 'Top Impr. Rate', 'Abs. Top Impr.', 'Notes'].map((h, idx) => {
                    const isStickyBg = idx === 0 || idx === 1;
                    const hasShadow = idx === 1;
                    return (
                      <th key={h} className={`whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark ${isStickyBg ? 'bg-[#f8fafc] dark:bg-meta-4' : ''} ${hasShadow ? 'border-r border-stroke/50 dark:border-strokedark/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] relative z-10' : ''}`}>
                        {h}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-strokedark">
                {ALL_MONTHS.map((monthName) => {
                  const row = yearlyGuarantee.find(r => r.month === monthName);
                  if (row) {
                    return (
                      <tr key={monthName} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                        <td className="whitespace-nowrap px-5 py-4 font-bold text-black dark:text-white uppercase text-xs bg-[#f8fafc] dark:bg-meta-4/80">{row.month}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-body dark:text-bodydark bg-[#f8fafc] dark:bg-meta-4/80 border-r border-stroke/50 dark:border-strokedark/50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.08)] relative z-10">{row.service}</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums font-semibold text-black dark:text-white">{fmtCurrency(row.spend)}</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{row.leads}</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmtCurrency(row.cost_per_lead)}</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(row.ad_impressions)}</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(row.top_imp_rate, 2)}%</td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(row.abs_top_imp_rate, 2)}%</td>
                        <td className="whitespace-nowrap px-5 py-4 text-center">
                          <button 
                            onClick={() => setEditingNote({ key: getNoteKey(monthName), month: monthName })}
                            className={`transition-all hover:scale-110 ${localNotes[getNoteKey(monthName)] ? 'text-[#FFD700] opacity-100' : 'text-body dark:text-bodydark opacity-25 hover:opacity-50'}`} 
                            title={localNotes[getNoteKey(monthName)] ? "View/Edit Note" : "Add Note"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM6 6h12v2H6V6zm0 4h12v2H6v-2zm0 4h7v2H6v-2z"></path></svg>
                          </button>
                        </td>
                      </tr>
                    )
                  } else {
                    return (
                      <tr key={monthName} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                        <td className="whitespace-nowrap px-5 py-4 font-bold text-black dark:text-white uppercase text-xs bg-[#f8fafc] dark:bg-meta-4/80">{monthName}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-body dark:text-bodydark bg-[#f8fafc] dark:bg-meta-4/80 border-r border-stroke/50 dark:border-strokedark/50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.08)] relative z-10">Google Guarantee</td>
                        <td colSpan={6} className="whitespace-nowrap px-5 py-4 text-center text-body dark:text-bodydark italic text-xs opacity-60">
                          No data yet
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-center">
                          <button 
                            onClick={() => setEditingNote({ key: getNoteKey(monthName), month: monthName })}
                            className={`transition-all hover:scale-110 ${localNotes[getNoteKey(monthName)] ? 'text-[#FFD700] opacity-100' : 'text-body dark:text-bodydark opacity-25 hover:opacity-50'}`} 
                            title={localNotes[getNoteKey(monthName)] ? "View/Edit Note" : "Add Note"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM6 6h12v2H6V6zm0 4h12v2H6v-2zm0 4h7v2H6v-2z"></path></svg>
                          </button>
                        </td>
                      </tr>
                    )
                  }
                })}
              {/* Totals Row */}
              {yearlyGuarantee.length > 0 && (
              <tr className="bg-meta-3/10 transition-colors">
                <td className="whitespace-nowrap px-5 py-4 font-bold text-black dark:text-white uppercase text-xs bg-[#eef7f2] dark:bg-[#1a382e]">TOTAL</td>
                <td className="whitespace-nowrap px-5 py-4 text-body dark:text-bodydark bg-[#eef7f2] dark:bg-[#1a382e] border-r border-stroke/50 dark:border-strokedark/50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.08)] relative z-10">-</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">{fmtCurrency(yearlyGuarantee.reduce((sum, r) => sum + r.spend, 0))}</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">{fmt(yearlyGuarantee.reduce((sum, r) => sum + r.leads, 0))}</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">{fmtCurrency(yearlyGuarantee.reduce((sum, r) => sum + r.cost_per_lead, 0) / yearlyGuarantee.length || 0)}</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">{fmt(yearlyGuarantee.reduce((sum, r) => sum + r.ad_impressions, 0))}</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">{fmt(yearlyGuarantee.reduce((sum, r) => sum + r.top_imp_rate, 0) / yearlyGuarantee.length || 0, 2)}%</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">{fmt(yearlyGuarantee.reduce((sum, r) => sum + r.abs_top_imp_rate, 0) / yearlyGuarantee.length || 0, 2)}%</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums font-bold text-meta-3">-</td>
              </tr>
              )}
            </tbody>
            </table>
          </div>
        )}
      </div>

      </div>
      
      {/* Note Modal */}
      {editingNote && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-boxdark overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="border-b border-stroke px-6 py-4 dark:border-strokedark flex items-center justify-between bg-gray-50 dark:bg-meta-4/20">
              <h4 className="font-bold text-black dark:text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#FFD700]"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM6 6h12v2H6V6zm0 4h12v2H6v-2zm0 4h7v2H6v-2z"></path></svg>
                Notes for {editingNote.month} {selectedYear}
              </h4>
              <button 
                onClick={() => setEditingNote(null)}
                className="text-body hover:text-black dark:text-bodydark dark:hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-6">
              <textarea
                autoFocus
                className="w-full min-h-[180px] rounded-xl border border-stroke bg-gray-50 p-4 text-sm outline-none focus:border-[#1A72D9] focus:bg-white dark:border-strokedark dark:bg-boxdark-2 dark:text-white dark:focus:border-[#1A72D9] transition-all resize-none"
                placeholder="Write your monthly notes here..."
                defaultValue={localNotes[editingNote.key] || ''}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleSaveNote((e.target as HTMLTextAreaElement).value);
                  }
                }}
                id="note-textarea"
              />
              <div className="mt-4 flex items-center justify-between text-xs text-body dark:text-bodydark">
                <span>Press <kbd className="font-sans px-1.5 py-0.5 rounded bg-stroke dark:bg-strokedark">Ctrl + Enter</kbd> to save</span>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setEditingNote(null)}
                    className="px-4 py-2 font-semibold hover:text-black dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      const val = (document.getElementById('note-textarea') as HTMLTextAreaElement).value;
                      handleSaveNote(val);
                    }}
                    className="rounded-lg bg-[#1A72D9] px-6 py-2 font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-[#1A72D9]/90 active:scale-95 transition-all"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </SkeletonTheme>
  )
}
