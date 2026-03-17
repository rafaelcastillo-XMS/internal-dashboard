import { useState } from 'react'

export interface QueryRow {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

function PositionBadge({ position }: { position: number }) {
  const pos = Math.round(position)
  const [bgClass, textClass] =
    pos <= 3  ? ['bg-meta-3/10 dark:bg-meta-3/20', 'text-meta-3'] :
    pos <= 10 ? ['bg-[#1A72D9]/10', 'text-[#1A72D9]'] :
    pos <= 20 ? ['bg-warning/10', 'text-warning'] :
                ['bg-stroke dark:bg-strokedark', 'text-body dark:text-bodydark']

  return (
    <span className={`inline-flex items-center justify-center min-w-[2rem]
                      rounded px-1.5 py-0.5 text-xs font-bold ${bgClass} ${textClass}`}>
      {position.toFixed(1)}
    </span>
  )
}

function CTRBadge({ ctr }: { ctr: number }) {
  const pct = (ctr * 100).toFixed(2)
  const colorClass =
    ctr >= 0.08 ? 'text-meta-3' :
    ctr >= 0.04 ? 'text-[#1A72D9]' :
    ctr >= 0.02 ? 'text-warning' :
                  'text-danger'
  return (
    <span className={`tabular-nums font-semibold text-sm ${colorClass}`}>
      {pct}%
    </span>
  )
}

function useSortableColumn(rows: QueryRow[], defaultKey = 'clicks') {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortAsc, setSortAsc] = useState(false)

  function handleSort(key: string) {
    if (key === sortKey) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(key === 'position') }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortKey] as number | string
    const bv = (b as unknown as Record<string, unknown>)[sortKey] as number | string
    if (typeof av === 'string') return sortAsc ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string)
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  return { sorted, sortKey, sortAsc, handleSort }
}

function SortableHeader({ label, colKey, sortKey, sortAsc, onSort, align = 'left' }: {
  label: string; colKey: string; sortKey: string; sortAsc: boolean
  onSort: (k: string) => void; align?: string
}) {
  const active = colKey === sortKey
  return (
    <th
      onClick={() => onSort(colKey)}
      className={`cursor-pointer select-none px-4 py-3 text-${align}
                  text-xs font-semibold uppercase tracking-wider
                  text-body dark:text-bodydark hover:text-black dark:hover:text-white
                  transition-colors duration-150`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[10px] ${active ? 'opacity-100' : 'opacity-30'}`}>
          {active ? (sortAsc ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  )
}

export function QueryRankingsTable({ rows = [], pageSize = 15 }: { rows?: QueryRow[]; pageSize?: number }) {
  const [page, setPage] = useState(1)
  const [filterText, setFilter] = useState('')
  const { sorted, sortKey, sortAsc, handleSort } = useSortableColumn(rows)

  const filtered = filterText
    ? sorted.filter((r) => r.query.toLowerCase().includes(filterText.toLowerCase()))
    : sorted

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="col-span-12 rounded-xl border border-stroke bg-white
                    shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="flex flex-wrap items-center justify-between gap-3
                      border-b border-stroke px-6 py-5 dark:border-strokedark">
        <div>
          <h3 className="text-lg font-semibold text-black dark:text-white">
            Keyword &amp; Query Rankings
          </h3>
          <p className="mt-0.5 text-sm text-body dark:text-bodydark">
            Google Search Console · {filtered.length} queries
          </p>
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body dark:text-bodydark">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Filter queries…"
            value={filterText}
            onChange={(e) => { setFilter(e.target.value); setPage(1) }}
            className="w-48 rounded-lg border border-stroke bg-transparent
                       py-2 pl-9 pr-4 text-sm text-black outline-none
                       focus:border-[#1A72D9] dark:border-strokedark
                       dark:bg-[#1d2a39] dark:text-white"
          />
        </div>
      </div>

      <div className="max-h-[480px] overflow-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 z-10 bg-gray dark:bg-meta-4">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark w-8">#</th>
              <SortableHeader label="Query"       colKey="query"       sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
              <SortableHeader label="Clicks"      colKey="clicks"      sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right" />
              <SortableHeader label="Impressions" colKey="impressions" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right" />
              <SortableHeader label="CTR"         colKey="ctr"         sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right" />
              <SortableHeader label="Position"    colKey="position"    sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="center" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke dark:divide-strokedark">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-body dark:text-bodydark">
                  {filterText ? 'No queries match your filter.' : 'No data available.'}
                </td>
              </tr>
            ) : paginated.map((row, i) => {
              const globalRank = (page - 1) * pageSize + i + 1
              return (
                <tr key={row.query} className="group transition-colors hover:bg-gray-2 dark:hover:bg-meta-4">
                  <td className="px-4 py-3.5 text-xs text-body dark:text-bodydark tabular-nums w-8">{globalRank}</td>
                  <td className="max-w-[280px] px-4 py-3.5">
                    <span className="block truncate font-medium text-black dark:text-white
                                     group-hover:text-[#1A72D9] transition-colors" title={row.query}>
                      {row.query}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-black dark:text-white">
                    {row.clicks.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-body dark:text-bodydark">
                    {row.impressions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <CTRBadge ctr={row.ctr} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <PositionBadge position={row.position} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stroke px-6 py-3.5 dark:border-strokedark">
          <p className="text-xs text-body dark:text-bodydark">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="flex h-7 w-7 items-center justify-center rounded border border-stroke text-xs text-body
                               hover:border-[#1A72D9] hover:text-[#1A72D9] disabled:opacity-40 dark:border-strokedark dark:text-bodydark">
              ‹
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              const p = idx + 1
              return (
                <button key={p} onClick={() => setPage(p)}
                        className={`flex h-7 w-7 items-center justify-center rounded text-xs transition-colors
                          ${page === p
                            ? 'bg-[#1A72D9] text-white border border-[#1A72D9]'
                            : 'border border-stroke text-body hover:border-[#1A72D9] hover:text-[#1A72D9] dark:border-strokedark dark:text-bodydark'
                          }`}>
                  {p}
                </button>
              )
            })}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="flex h-7 w-7 items-center justify-center rounded border border-stroke text-xs text-body
                               hover:border-[#1A72D9] hover:text-[#1A72D9] disabled:opacity-40 dark:border-strokedark dark:text-bodydark">
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
