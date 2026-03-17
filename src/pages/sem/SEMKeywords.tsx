import { useState, useCallback, useEffect } from 'react'
import { DashboardControls } from '@/features/sem/components/DashboardControls'
import { useSEMDashboardState, SEM_API, formatDateLabel } from '@/features/sem/hooks/useSEMDashboardState'
import { cacheGet, cacheSet } from '@/features/sem/lib/semCache'

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

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedAccountId) return
    const { startDate, endDate } = state.dateRange
    const cacheKey = `keywords:${state.selectedAccountId}:${startDate}:${endDate}`
    if (!force) {
      const cached = cacheGet<{ data: Keyword[]; lastUpdated: string }>(cacheKey)
      if (cached) { setKeywords(cached.data); state.setLastUpdated(new Date(cached.lastUpdated)); return }
    }
    state.setLoading(true)
    try {
      const params = new URLSearchParams({ customerId: state.selectedAccountId, start: startDate, end: endDate })
      const d = await fetch(`${SEM_API}/performance?${params}`).then((r) => r.json())
      if (d.error) { console.error('[SEM Keywords]', d.error); return }
      const updated = new Date()
      setKeywords(d.keywords || [])
      cacheSet(cacheKey, { data: d.keywords || [], lastUpdated: updated.toISOString() })
      state.setLastUpdated(updated)
    } catch (err) { console.error('[SEM Keywords]', err) } finally { state.setLoading(false) }
  }, [state.selectedAccountId, state.dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...keywords].sort((a, b) => {
    const va = (a[sortKey] ?? -1) as number
    const vb = (b[sortKey] ?? -1) as number
    return sortDir === 'desc' ? vb - va : va - vb
  })

  function SortIcon({ col }: { col: string }) {
    if (col !== sortKey) return <svg className="h-3 w-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" /></svg>
    return sortDir === 'desc'
      ? <svg className="h-3 w-3 text-[#16a34a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      : <svg className="h-3 w-3 text-[#16a34a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
  }

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
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

      {/* Quality score legend */}
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
          {keywords.length > 0 && (
            <span className="rounded-full bg-stroke/50 px-2.5 py-1 text-xs font-semibold text-body dark:text-bodydark dark:bg-strokedark">
              {keywords.length} keywords
            </span>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-body dark:text-bodydark">
              {state.selectedAccountId ? 'No keyword data for this period.' : 'Select an account and click Refresh.'}
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
                {sorted.map((kw, i) => (
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
        )}
      </div>
    </div>
  )
}
