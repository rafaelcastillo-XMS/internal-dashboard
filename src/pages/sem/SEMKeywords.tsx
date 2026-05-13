import { useState, useCallback, useEffect, useMemo } from 'react'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { DashboardControls } from '@/features/sem/components/DashboardControls'
import { useSEMDashboardState, formatDateLabel } from '@/features/sem/hooks/useSEMDashboardState'
import { cacheGet, cacheSet } from '@/features/sem/lib/semCache'
import { supabase } from '@/lib/supabase'
import { InsightCard } from '@/features/sem/components/InsightCards'

interface Keyword {
  text:          string
  match_type:    string
  quality_score: number | null
  impressions:   number
  clicks:        number
  cost:          number
  ctr:           number
  avg_cpc:       number
  conversions:   number
}

type SortKey = Exclude<keyof Keyword, 'text' | 'match_type'>
type SortDir = 'asc' | 'desc'

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function fmtCurrency(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function QualityScore({ score }: { score: number | null }) {
  if (score == null) return <span className="text-body dark:text-bodydark">—</span>
  const color = score >= 7 ? 'text-meta-3' : score >= 5 ? 'text-warning' : 'text-danger'
  return <span className={`font-semibold tabular-nums ${color}`}>{score}/10</span>
}

function MatchTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    EXACT:  'bg-[#1A72D9]/10 text-[#1A72D9]',
    PHRASE: 'bg-warning/10 text-warning',
    BROAD:  'bg-stroke/50 text-body dark:text-bodydark dark:bg-strokedark',
  }
  const c = colors[type] || colors.BROAD
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${c}`}>
      {type.charAt(0) + type.slice(1).toLowerCase()}
    </span>
  )
}

const COLUMNS: { key: string; label: string; sortable: boolean }[] = [
  { key: 'text',          label: 'Keyword',      sortable: false },
  { key: 'match_type',    label: 'Match',        sortable: false },
  { key: 'quality_score', label: 'Quality',      sortable: true  },
  { key: 'impressions',   label: 'Impressions',  sortable: true  },
  { key: 'clicks',        label: 'Clicks',       sortable: true  },
  { key: 'ctr',           label: 'CTR',          sortable: true  },
  { key: 'avg_cpc',       label: 'Avg CPC',      sortable: true  },
  { key: 'cost',          label: 'Spend',        sortable: true  },
  { key: 'conversions',   label: 'Conv.',        sortable: true  },
]

export function SEMKeywords() {
  const state = useSEMDashboardState()
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('cost')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedAccountId) return
    const cacheKey = `keywords:${state.selectedAccountId}:${state.rangeKey}`
    if (!force) {
      const cached = cacheGet<{ data: Keyword[]; lastUpdated: string }>(cacheKey)
      if (cached) { setKeywords(cached.data); state.setLastUpdated(new Date(cached.lastUpdated)); return }
    }
    state.setLoading(true)
    try {
      const { data, error } = await supabase
        .from('sem_keywords')
        .select('keyword_text,match_type,quality_score,impressions,clicks,cost,ctr,avg_cpc,conversions')
        .eq('account_id', state.selectedAccountId)
        .eq('date_range', state.rangeKey)
        .order('cost', { ascending: false })
        .limit(100)
      if (error) { console.error('[SEM Keywords]', error.message); return }
      const rows: Keyword[] = (data || []).map((r) => ({
        text: r.keyword_text,
        match_type: r.match_type,
        quality_score: r.quality_score,
        impressions: r.impressions,
        clicks: r.clicks,
        cost: r.cost,
        ctr: r.ctr,
        avg_cpc: r.avg_cpc,
        conversions: r.conversions,
      }))
      const updated = new Date()
      setKeywords(rows)
      cacheSet(cacheKey, { data: rows, lastUpdated: updated.toISOString() })
      state.setLastUpdated(updated)
    } catch (err) { console.error('[SEM Keywords]', err) } finally { state.setLoading(false) }
  }, [state.selectedAccountId, state.rangeKey])

  useEffect(() => { fetchData() }, [fetchData])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(1)
  }

  const topPerformers = useMemo(() =>
    keywords
      .filter(k => (k.quality_score ?? 0) >= 7 && k.conversions > 0)
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 25)
      .map(k => ({ label: k.text, metric: `${fmt(k.conversions, 1)} conv.` })),
    [keywords]
  )

  const lowPerformers = useMemo(() => {
    const topSet = new Set(topPerformers.map(k => k.label))
    const seen = new Set<string>()
    return keywords
      .filter(k => {
        if (topSet.has(k.text) || seen.has(k.text)) return false
        const bad = (k.quality_score != null && k.quality_score <= 3)
          || (k.impressions > 100 && k.clicks === 0)
          || (k.cost > 10 && k.conversions === 0 && k.clicks > 3)
        if (bad) seen.add(k.text)
        return bad
      })
      .slice(0, 25)
      .map(k => ({
        label: k.text,
        metric: k.quality_score != null && k.quality_score <= 3
          ? `QS ${k.quality_score}/10`
          : k.impressions > 100 && k.clicks === 0
            ? `${fmt(k.impressions)} impr`
            : `$${k.cost.toFixed(0)}, 0 conv`,
      }))
  }, [keywords, topPerformers])

  const opportunities = useMemo(() => {
    const topSet = new Set(topPerformers.map(k => k.label))
    const lowSet = new Set(lowPerformers.map(k => k.label))
    return keywords
      .filter(k =>
        !topSet.has(k.text) && !lowSet.has(k.text) &&
        k.impressions > 100 && k.ctr < 1.5 &&
        (k.quality_score == null || k.quality_score >= 5)
      )
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 25)
      .map(k => ({ label: k.text, metric: `${fmt(k.ctr, 2)}% CTR` }))
  }, [keywords, topPerformers, lowPerformers])

  const sorted = [...keywords].sort((a, b) => {
    const va = (a[sortKey] ?? -1) as number
    const vb = (b[sortKey] ?? -1) as number
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
          <h1 className="text-2xl font-bold text-black dark:text-white">Keywords</h1>
          <p className="text-sm text-body dark:text-bodydark">
            Google Ads · {state.dateRange.startDate
              ? formatDateLabel(state.dateRange.startDate, state.dateRange.endDate)
              : 'Select account and date range'}
            {state.lastUpdated ? ` · Updated ${state.lastUpdated.toLocaleTimeString()}` : ''}
          </p>
        </div>
        <DashboardControls {...state} onRefresh={() => fetchData(true)} pageTitle="SEM-Keywords" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <InsightCard
          title="High Performance"
          subtitle="Quality ≥7 with conversions — keep and expand"
          variant="green"
          items={topPerformers}
          emptyText="No high-performance keywords yet for this period."
          loading={state.loading}
        />
        <InsightCard
          title="Review for Removal"
          subtitle="Poor quality score or spending with no results"
          variant="red"
          items={lowPerformers}
          emptyText="No low-performance keywords detected."
          loading={state.loading}
        />
        <InsightCard
          title="Optimization Opportunities"
          subtitle="High impressions but low CTR — improve ad copy"
          variant="blue"
          items={opportunities}
          emptyText="No optimization opportunities found."
          loading={state.loading}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        {[{ label: 'Good (7–10)', color: 'text-meta-3' }, { label: 'Fair (5–6)', color: 'text-warning' }, { label: 'Poor (1–4)', color: 'text-danger' }].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-xs text-body dark:text-bodydark">
            <span className={`font-semibold ${item.color}`}>●</span>
            {item.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-body dark:text-bodydark ml-4">
          {['Exact', 'Phrase', 'Broad'].map((m) => (
            <MatchTypeBadge key={m} type={m.toUpperCase()} />
          ))}
          <span>match types</span>
        </div>
      </div>

      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6 py-5 dark:border-strokedark flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-black dark:text-white">Top Keywords</h3>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">Top 100 by spend · Click column headers to sort</p>
          </div>
          {!state.loading && keywords.length > 0 && (
            <span className="rounded-full bg-stroke/50 px-2.5 py-1 text-xs font-semibold text-body dark:text-bodydark dark:bg-strokedark">
              {keywords.length} keywords
            </span>
          )}
        </div>

        {state.loading ? (
          <div className="px-6 py-4 space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton width="25%" height={16} />
                <Skeleton width={55} height={20} borderRadius={4} />
                <Skeleton width={35} height={16} />
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
              {state.selectedAccountId ? 'No keyword data for this period. Make sure the sync script has run.' : 'Select an account to load data.'}
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
                {paginated.map((kw, i) => (
                  <tr key={`${kw.text}-${kw.match_type}-${i}`} className="hover:bg-gray-2 dark:hover:bg-meta-4 transition-colors">
                    <td className="max-w-[200px] truncate px-5 py-4 font-medium text-black dark:text-white" title={kw.text}>{kw.text}</td>
                    <td className="px-5 py-4"><MatchTypeBadge type={kw.match_type} /></td>
                    <td className="px-5 py-4"><QualityScore score={kw.quality_score} /></td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(kw.impressions)}</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(kw.clicks)}</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(kw.ctr, 2)}%</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmtCurrency(kw.avg_cpc)}</td>
                    <td className="px-5 py-4 tabular-nums font-semibold text-black dark:text-white">{fmtCurrency(kw.cost)}</td>
                    <td className="px-5 py-4 tabular-nums text-body dark:text-bodydark">{fmt(kw.conversions, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-stroke px-6 py-4 dark:border-strokedark">
            <p className="text-xs text-body dark:text-bodydark">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} keywords
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1} className="rounded px-2 py-1 text-xs text-body hover:text-black disabled:opacity-30 dark:text-bodydark dark:hover:text-white">«</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded px-2 py-1 text-xs text-body hover:text-black disabled:opacity-30 dark:text-bodydark dark:hover:text-white">‹</button>
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
                      className={`min-w-[28px] rounded px-2 py-1 text-xs font-semibold transition-colors ${page === p ? 'bg-[#16a34a] text-white' : 'text-body hover:text-black dark:text-bodydark dark:hover:text-white'}`}
                    >{p}</button>
                  )
                )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded px-2 py-1 text-xs text-body hover:text-black disabled:opacity-30 dark:text-bodydark dark:hover:text-white">›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="rounded px-2 py-1 text-xs text-body hover:text-black disabled:opacity-30 dark:text-bodydark dark:hover:text-white">»</button>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
    </SkeletonTheme>
  )
}
