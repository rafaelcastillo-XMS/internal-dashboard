import { useState, useCallback, useEffect } from 'react'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { DashboardControls } from '@/features/sem/components/DashboardControls'
import { useSEMDashboardState, formatDateLabel } from '@/features/sem/hooks/useSEMDashboardState'
import { cacheGet, cacheSet } from '@/features/sem/lib/semCache'
import { supabase } from '@/lib/supabase'

interface SearchTerm {
  search_term:   string
  campaign_name: string
  ad_group_name: string
  impressions:   number
  clicks:        number
  cost:          number
  ctr:           number
  avg_cpc:       number
  conversions:   number
}

type SortKey = Exclude<keyof SearchTerm, 'search_term' | 'campaign_name' | 'ad_group_name'>
type SortDir = 'asc' | 'desc'

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function fmtCurrency(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const COLUMNS: { key: string; label: string; sortable: boolean }[] = [
  { key: 'search_term',   label: 'Search Term',  sortable: false },
  { key: 'campaign_name', label: 'Campaign',     sortable: false },
  { key: 'ad_group_name', label: 'Ad Group',     sortable: false },
  { key: 'impressions',   label: 'Impressions',  sortable: true  },
  { key: 'clicks',        label: 'Clicks',       sortable: true  },
  { key: 'ctr',           label: 'CTR',          sortable: true  },
  { key: 'avg_cpc',       label: 'Avg CPC',      sortable: true  },
  { key: 'cost',          label: 'Spend',        sortable: true  },
  { key: 'conversions',   label: 'Conv.',        sortable: true  },
]

export function SEMSearchTerms() {
  const state = useSEMDashboardState()
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('cost')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedAccountId) return
    const cacheKey = `search-terms:${state.selectedAccountId}:${state.rangeKey}`
    if (!force) {
      const cached = cacheGet<{ data: SearchTerm[]; lastUpdated: string }>(cacheKey)
      if (cached) { setSearchTerms(cached.data); state.setLastUpdated(new Date(cached.lastUpdated)); return }
    }
    state.setLoading(true)
    try {
      const { data, error } = await supabase
        .from('sem_search_terms')
        .select('search_term,campaign_name,ad_group_name,impressions,clicks,cost,ctr,avg_cpc,conversions')
        .eq('account_id', state.selectedAccountId)
        .eq('date_range', state.rangeKey)
        .order('cost', { ascending: false })
        .limit(500)
      if (error) { console.error('[SEM Search Terms]', error.message); return }
      const rows: SearchTerm[] = (data || []).map((r) => ({
        search_term:   r.search_term,
        campaign_name: r.campaign_name,
        ad_group_name: r.ad_group_name,
        impressions:   r.impressions,
        clicks:        r.clicks,
        cost:          r.cost,
        ctr:           r.ctr,
        avg_cpc:       r.avg_cpc,
        conversions:   r.conversions,
      }))
      const updated = new Date()
      setSearchTerms(rows)
      cacheSet(cacheKey, { data: rows, lastUpdated: updated.toISOString() })
      state.setLastUpdated(updated)
    } catch (err) { console.error('[SEM Search Terms]', err) } finally { state.setLoading(false) }
  }, [state.selectedAccountId, state.rangeKey])

  useEffect(() => { fetchData() }, [fetchData])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...searchTerms].sort((a, b) => {
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
          <h1 className="text-2xl font-bold text-black dark:text-white">Search Terms</h1>
          <p className="text-sm text-body dark:text-bodydark">
            Google Ads · {state.dateRange.startDate
              ? formatDateLabel(state.dateRange.startDate, state.dateRange.endDate)
              : 'Select account and date range'}
            {state.lastUpdated ? ` · Updated ${state.lastUpdated.toLocaleTimeString()}` : ''}
          </p>
        </div>
        <DashboardControls {...state} onRefresh={() => fetchData(true)} pageTitle="SEM-SearchTerms" />
      </div>

      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6 py-5 dark:border-strokedark flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-black dark:text-white">Top Search Terms</h3>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">Top 500 by spend · Click column headers to sort</p>
          </div>
          {!state.loading && searchTerms.length > 0 && (
            <span className="rounded-full bg-stroke/50 px-2.5 py-1 text-xs font-semibold text-body dark:text-bodydark dark:bg-strokedark">
              {searchTerms.length} terms
            </span>
          )}
        </div>

        {state.loading ? (
          <div className="px-6 py-4 space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton width="20%" height={16} />
                <Skeleton width="15%" height={16} />
                <Skeleton width="15%" height={16} />
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
              {state.selectedAccountId ? 'No search term data for this period. Make sure the sync script has run.' : 'Select an account to load data.'}
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
                {sorted.map((st, i) => (
                  <tr key={`${st.search_term}-${i}`} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                    <td className="max-w-[220px] truncate px-5 py-4 font-medium text-black dark:text-white" title={st.search_term}>{st.search_term}</td>
                    <td className="max-w-[160px] truncate px-5 py-4 text-body dark:text-bodydark" title={st.campaign_name}>{st.campaign_name || '—'}</td>
                    <td className="max-w-[160px] truncate px-5 py-4 text-body dark:text-bodydark" title={st.ad_group_name}>{st.ad_group_name || '—'}</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(st.impressions)}</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(st.clicks)}</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(st.ctr, 2)}%</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmtCurrency(st.avg_cpc)}</td>
                    <td className="px-5 py-4 tabular-nums font-semibold text-black dark:text-white">{fmtCurrency(st.cost)}</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(st.conversions, 1)}</td>
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
