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

type SortKey = keyof Omit<Campaign, 'id' | 'name' | 'status'>
type SortDir = 'asc' | 'desc'

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtCurrency(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

const COLUMNS: { key: SortKey | 'name' | 'status'; label: string; sortable: boolean }[] = [
  { key: 'name',                label: 'Campaign',    sortable: false },
  { key: 'status',              label: 'Status',      sortable: false },
  { key: 'impressions',         label: 'Impressions', sortable: true  },
  { key: 'clicks',              label: 'Clicks',      sortable: true  },
  { key: 'ctr',                 label: 'CTR',         sortable: true  },
  { key: 'avg_cpc',             label: 'Avg CPC',     sortable: true  },
  { key: 'cost',                label: 'Spend',       sortable: true  },
  { key: 'conversions',         label: 'Conv.',       sortable: true  },
  { key: 'cost_per_conversion', label: 'Cost/Conv.',  sortable: true  },
]

export function SEMCampaigns() {
  const state = useSEMDashboardState()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('cost')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedAccountId) return
    const cacheKey = `campaigns:${state.selectedAccountId}:${state.rangeKey}`
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
      if (error) { console.error('[SEM Campaigns]', error.message); return }
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
    } catch (err) { console.error('[SEM Campaigns]', err) } finally { state.setLoading(false) }
  }, [state.selectedAccountId, state.rangeKey])

  useEffect(() => { fetchData() }, [fetchData])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...campaigns].sort((a, b) => {
    const va = a[sortKey] as number
    const vb = b[sortKey] as number
    return sortDir === 'desc' ? vb - va : va - vb
  })

  function SortIcon({ col }: { col: string }) {
    if (col !== sortKey) return <svg className="h-3 w-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" /></svg>
    return sortDir === 'desc'
      ? <svg className="h-3 w-3 text-[#16a34a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      : <svg className="h-3 w-3 text-[#16a34a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
  }

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
          <h1 className="text-2xl font-bold text-black dark:text-white">Campaigns</h1>
          <p className="text-sm text-body dark:text-bodydark">
            Google Ads · {state.dateRange.startDate
              ? formatDateLabel(state.dateRange.startDate, state.dateRange.endDate)
              : 'Select account and date range'}
            {state.lastUpdated ? ` · Updated ${state.lastUpdated.toLocaleTimeString()}` : ''}
          </p>
        </div>
        <DashboardControls {...state} onRefresh={() => fetchData(true)} pageTitle="SEM-Campaigns" />
      </div>

      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6 py-5 dark:border-strokedark flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-black dark:text-white">All Campaigns</h3>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">Click column headers to sort</p>
          </div>
          {!state.loading && campaigns.length > 0 && (
            <span className="rounded-full bg-stroke/50 px-2.5 py-1 text-xs font-semibold text-body dark:text-bodydark dark:bg-strokedark">
              {campaigns.length} campaigns
            </span>
          )}
        </div>

        {state.loading ? (
          <div className="px-6 py-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton width="30%" height={16} />
                <Skeleton width={60} height={20} borderRadius={20} />
                <Skeleton width={70} height={16} />
                <Skeleton width={50} height={16} />
                <Skeleton width={50} height={16} />
                <Skeleton width={60} height={16} />
                <Skeleton width={70} height={16} />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
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
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && toggleSort(col.key as SortKey)}
                      className={`whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark
                        ${col.sortable ? 'cursor-pointer hover:text-black dark:hover:text-white select-none' : ''}`}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && <SortIcon col={col.key} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-strokedark">
                {sorted.map((c) => (
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
