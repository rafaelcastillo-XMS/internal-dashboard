import { useState, useCallback, useEffect, useMemo } from 'react'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { DashboardControls } from '@/features/sem/components/DashboardControls'
import { useSEMDashboardState, formatDateLabel } from '@/features/sem/hooks/useSEMDashboardState'
import { cacheGet, cacheSet } from '@/features/sem/lib/semCache'
import { InsightCard } from '@/features/sem/components/InsightCards'

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

const IRRELEVANT_TERMS = ['free', 'jobs', 'salary', 'training', 'diy', 'definition', 'near me']
function hasIrrelevantTerm(query: string): boolean {
  const q = query.toLowerCase()
  return IRRELEVANT_TERMS.some(term => q.includes(term))
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
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('cost')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedAccountId || !state.dateRange.startDate) return
    const cacheKey = `search-terms:${state.selectedAccountId}:${state.dateRange.startDate}:${state.dateRange.endDate}`
    if (!force) {
      const cached = cacheGet<{ data: SearchTerm[]; lastUpdated: string }>(cacheKey)
      if (cached) {
        setSearchTerms(cached.data)
        state.setLastUpdated(new Date(cached.lastUpdated))
        return
      }
    }
    state.setLoading(true)
    setError(null)
    try {
      const url = `/api/sem/search-terms?accountId=${state.selectedAccountId}&startDate=${state.dateRange.startDate}&endDate=${state.dateRange.endDate}`
      const res  = await fetch(url)
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`)
      const rows: SearchTerm[] = (json.searchTerms ?? [])
      const updated = new Date()
      setSearchTerms(rows)
      cacheSet(cacheKey, { data: rows, lastUpdated: updated.toISOString() })
      state.setLastUpdated(updated)
    } catch (err) {
      const raw = (err as Error).message
      const isQuotaError = raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('Too many requests')
      if (isQuotaError) {
        const delayMatch = raw.match(/"retryDelay"\s*:\s*"(\d+)s"/)
        const base = "Google Ads API quota limit reached. You've exceeded the maximum number of requests allowed for this period."
        if (delayMatch) {
          const restoreAt = new Date(Date.now() + parseInt(delayMatch[1], 10) * 1000)
          const formatted = restoreAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
          setError(`${base} Data will be available again around ${formatted}.`)
        } else {
          setError(`${base} Please wait a few hours before trying again.`)
        }
      } else {
        setError(raw)
      }
      console.error('[SEM Search Terms]', err)
    } finally {
      state.setLoading(false)
    }
  }, [state.selectedAccountId, state.dateRange.startDate, state.dateRange.endDate])

  useEffect(() => { fetchData() }, [fetchData])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const topTerms = useMemo(() =>
    searchTerms
      .filter(st => st.conversions > 0 || (st.clicks > 5 && st.ctr > 8))
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 25)
      .map(st => ({
        label: st.search_term,
        metric: st.conversions > 0 ? `${fmt(st.conversions, 1)} conv.` : `${fmt(st.ctr, 1)}% CTR`,
      })),
    [searchTerms]
  )

  const negativeTerms = useMemo(() => {
    const topSet = new Set(topTerms.map(t => t.label))
    const seen = new Set<string>()
    return searchTerms
      .filter(st => {
        if (topSet.has(st.search_term) || seen.has(st.search_term)) return false
        const bad = (st.clicks >= 5 && st.conversions === 0)
          || (st.cost >= 2 && st.clicks >= 2 && st.conversions === 0)
          || hasIrrelevantTerm(st.search_term)
        if (bad) seen.add(st.search_term)
        return bad
      })
      .slice(0, 25)
      .map(st => ({
        label: st.search_term,
        metric: hasIrrelevantTerm(st.search_term)
          ? 'Irrelevant term'
          : st.clicks >= 5 && st.conversions === 0
            ? `${fmt(st.clicks)} clk, 0 conv`
            : `$${st.cost.toFixed(0)}, 0 conv`,
      }))
  }, [searchTerms, topTerms])

  const reviewTerms = useMemo(() => {
    const topSet = new Set(topTerms.map(t => t.label))
    const negSet = new Set(negativeTerms.map(t => t.label))
    const validCpcs = searchTerms.filter(st => st.avg_cpc > 0).map(st => st.avg_cpc)
    const avgCpc = validCpcs.length > 0
      ? validCpcs.reduce((a, b) => a + b, 0) / validCpcs.length
      : 0
    return searchTerms
      .filter(st => {
        if (topSet.has(st.search_term) || negSet.has(st.search_term)) return false
        const lowCtr = st.impressions >= 50 && st.ctr < 1
        const highCpc = avgCpc > 0 && st.avg_cpc > 1.5 * avgCpc && st.conversions === 0
        const lowEngagement = st.impressions >= 100 && st.clicks <= 2 && st.cost < 1
        return lowCtr || highCpc || lowEngagement
      })
      .slice(0, 25)
      .map(st => {
        const lowCtr = st.impressions >= 50 && st.ctr < 1
        const highCpc = avgCpc > 0 && st.avg_cpc > 1.5 * avgCpc && st.conversions === 0
        const metric = lowCtr
          ? `${fmt(st.ctr, 2)}% CTR`
          : highCpc
            ? `${fmtCurrency(st.avg_cpc)} CPC`
            : `${fmt(st.impressions)} impr, ${fmt(st.clicks)} clk`
        return { label: st.search_term, metric }
      })
  }, [searchTerms, topTerms, negativeTerms])

  const sorted = [...searchTerms].sort((a, b) => {
    const va = a[sortKey] as number
    const vb = b[sortKey] as number
    return sortDir === 'desc' ? vb - va : va - vb
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <InsightCard
          title="Add as Keywords"
          subtitle="Converting terms — add to your keyword list"
          variant="green"
          items={topTerms}
          emptyText="No converting search terms yet for this period."
          loading={state.loading}
        />
        <InsightCard
          title="Negative Candidates"
          subtitle="5+ clicks or $2+ spend with 0 conversions, or irrelevant terms"
          variant="red"
          items={negativeTerms}
          emptyText="No negative candidates detected."
          loading={state.loading}
        />
        <InsightCard
          title="Needs Review"
          subtitle="Low CTR, high CPC vs avg, or high impressions with few clicks"
          variant="blue"
          items={reviewTerms}
          emptyText="No terms flagged for review."
          loading={state.loading}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-5 py-4">
          <p className="text-sm font-semibold text-danger">Unable to load search terms</p>
          <p className="mt-0.5 text-xs text-danger/80">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6 py-5 dark:border-strokedark flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-black dark:text-white">Top Search Terms</h3>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">Top 100 by spend · Live from Google Ads · Click headers to sort</p>
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
              {!state.selectedAccountId
                ? 'Select an account to load data.'
                : error
                  ? 'Could not load search terms. Check the error above.'
                  : 'No search term data for this period.'}
            </p>
          </div>
        ) : (
          <>
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
                {paginated.map((st, i) => (
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
          <div className="flex items-center justify-between border-t border-stroke px-6 py-4 dark:border-strokedark">
            <p className="text-xs text-body dark:text-bodydark">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} terms
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="rounded px-2 py-1 text-xs text-body hover:text-black disabled:opacity-30 dark:text-bodydark dark:hover:text-white"
              >«</button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded px-2 py-1 text-xs text-body hover:text-black disabled:opacity-30 dark:text-bodydark dark:hover:text-white"
              >‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={`dots-${i}`} className="px-1 text-xs text-body dark:text-bodydark">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`min-w-[28px] rounded px-2 py-1 text-xs font-semibold transition-colors
                        ${page === p
                          ? 'bg-[#16a34a] text-white'
                          : 'text-body hover:text-black dark:text-bodydark dark:hover:text-white'}`}
                    >{p}</button>
                  )
                )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded px-2 py-1 text-xs text-body hover:text-black disabled:opacity-30 dark:text-bodydark dark:hover:text-white"
              >›</button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="rounded px-2 py-1 text-xs text-body hover:text-black disabled:opacity-30 dark:text-bodydark dark:hover:text-white"
              >»</button>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
    </SkeletonTheme>
  )
}
