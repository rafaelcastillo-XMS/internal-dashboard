import { useState, useCallback, useEffect } from 'react'
import { DashboardControls } from '@/features/sem/components/DashboardControls'
import { useSEMDashboardState, SEM_API, formatDateLabel } from '@/features/sem/hooks/useSEMDashboardState'
import { cacheGet, cacheSet } from '@/features/sem/lib/semCache'

interface Summary {
  impressions:         number
  clicks:              number
  cost:                number
  ctr:                 number
  avg_cpc:             number
  conversions:         number
  cost_per_conversion: number
}

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

interface AdsData {
  summary:   Summary
  campaigns: Campaign[]
  dateRange: { start: string; end: string }
}

const EMPTY: AdsData = {
  summary: { impressions: 0, clicks: 0, cost: 0, ctr: 0, avg_cpc: 0, conversions: 0, cost_per_conversion: 0 },
  campaigns: [],
  dateRange: { start: '', end: '' },
}

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

export function SEMDashboard() {
  const state = useSEMDashboardState()
  const [data, setData] = useState<AdsData>(EMPTY)

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedAccountId) return
    const { startDate, endDate } = state.dateRange
    const cacheKey = `dashboard:${state.selectedAccountId}:${startDate}:${endDate}`
    if (!force) {
      const cached = cacheGet<{ data: AdsData; lastUpdated: string }>(cacheKey)
      if (cached) { setData(cached.data); state.setLastUpdated(new Date(cached.lastUpdated)); return }
    }
    state.setLoading(true)
    try {
      const params = new URLSearchParams({ customerId: state.selectedAccountId, start: startDate, end: endDate })
      const d = await fetch(`${SEM_API}/performance?${params}`).then((r) => r.json())
      if (d.error) { console.error('[SEM]', d.error); return }
      const updated = new Date()
      setData(d)
      cacheSet(cacheKey, { data: d, lastUpdated: updated.toISOString() })
      state.setLastUpdated(updated)
    } catch (err) { console.error('[SEM]', err) } finally { state.setLoading(false) }
  }, [state.selectedAccountId, state.dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const s = data.summary
  const topCampaigns = [...data.campaigns].slice(0, 8)

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">
            SEM Overview
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-bold bg-[#16a34a]/20 text-[#16a34a] align-middle">Ads</span>
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

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        <MetricCard label="Impressions"   value={fmt(s.impressions)} />
        <MetricCard label="Clicks"        value={fmt(s.clicks)} />
        <MetricCard label="CTR"           value={`${fmt(s.ctr, 2)}%`} />
        <MetricCard label="Avg CPC"       value={fmtCurrency(s.avg_cpc)} />
        <MetricCard label="Total Spend"   value={fmtCurrency(s.cost)} />
        <MetricCard label="Conversions"   value={fmt(s.conversions, 1)} />
        <MetricCard label="Cost / Conv."  value={s.conversions > 0 ? fmtCurrency(s.cost_per_conversion) : '—'} />
      </div>

      {/* Campaigns table */}
      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6 py-5 dark:border-strokedark flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-black dark:text-white">Top Campaigns</h3>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">Sorted by spend — {state.dateRange.startDate ? formatDateLabel(state.dateRange.startDate, state.dateRange.endDate) : '—'}</p>
          </div>
          {data.campaigns.length > 0 && (
            <span className="rounded-full bg-stroke/50 px-2.5 py-1 text-xs font-semibold text-body dark:text-bodydark dark:bg-strokedark">
              {data.campaigns.length} campaigns
            </span>
          )}
        </div>

        {topCampaigns.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-body dark:text-bodydark">
              {state.selectedAccountId ? 'No campaign data for this period.' : 'Select an account and click Refresh to load data.'}
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
  )
}
