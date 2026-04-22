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

const EMPTY_SUMMARY: Summary = { impressions: 0, clicks: 0, cost: 0, ctr: 0, avg_cpc: 0, conversions: 0, cost_per_conversion: 0 }

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

      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
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
    </div>
    </SkeletonTheme>
  )
}
