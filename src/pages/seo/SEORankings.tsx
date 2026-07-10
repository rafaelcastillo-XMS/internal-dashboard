import { edgeFetch } from '@/lib/edgeFetch'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { CardDataStats }     from '@/features/seo/components/CardDataStats'
import { DashboardControls } from '@/features/seo/components/DashboardControls'
import { useSEODashboardState, SEO_API } from '@/features/seo/hooks/useSEODashboardState'
import { cacheGet, cacheSet } from '@/features/seo/lib/seoCache'

interface RankingRow {
  query: string
  country: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

// GSC returns ISO-3166-1 alpha-3 lowercase codes; map to alpha-2 for Intl display names
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  usa: 'US', mex: 'MX', can: 'CA', esp: 'ES', arg: 'AR', col: 'CO', per: 'PE',
  chl: 'CL', ven: 'VE', ecu: 'EC', gtm: 'GT', dom: 'DO', pri: 'PR', hnd: 'HN',
  slv: 'SV', nic: 'NI', cri: 'CR', pan: 'PA', bol: 'BO', ury: 'UY', pry: 'PY',
  bra: 'BR', gbr: 'GB', fra: 'FR', deu: 'DE', ita: 'IT', prt: 'PT', nld: 'NL',
  ind: 'IN', chn: 'CN', jpn: 'JP', kor: 'KR', aus: 'AU', nzl: 'NZ', rus: 'RU',
  phl: 'PH', idn: 'ID', pak: 'PK', nga: 'NG', zaf: 'ZA', egy: 'EG', tur: 'TR',
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

function countryLabel(alpha3: string): string {
  const alpha2 = ALPHA3_TO_ALPHA2[alpha3.toLowerCase()]
  if (!alpha2) return alpha3.toUpperCase()
  try { return regionNames.of(alpha2) ?? alpha3.toUpperCase() } catch { return alpha3.toUpperCase() }
}

function countryFlag(alpha3: string): string {
  const alpha2 = ALPHA3_TO_ALPHA2[alpha3.toLowerCase()]
  if (!alpha2) return ''
  return String.fromCodePoint(...[...alpha2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

// ── Geo-target detection from query text ─────────────────────────────────────
// GSC has no city dimension — the geo target lives inside the query itself
// ("ac repair miami"). Detected against a city/state dictionary.
// ponytail: dictionary-based; add city names here when a market is missed
const GEO_TOKENS = new Set([
  // Florida
  'miami', 'orlando', 'tampa', 'jacksonville', 'port st lucie', 'port saint lucie',
  'st lucie', 'saint lucie', 'fort lauderdale', 'west palm beach', 'palm beach',
  'boca raton', 'naples', 'sarasota', 'fort myers', 'cape coral', 'kissimmee',
  'lakeland', 'gainesville', 'tallahassee', 'pensacola', 'ocala', 'daytona beach',
  'melbourne', 'palm bay', 'stuart', 'jupiter', 'vero beach', 'sebastian',
  'okeechobee', 'hollywood', 'hialeah', 'pembroke pines', 'coral springs',
  'pompano beach', 'delray beach', 'boynton beach', 'wellington', 'doral',
  'kendall', 'homestead', 'brandon', 'clearwater', 'st petersburg',
  'saint petersburg', 'bradenton', 'venice', 'port charlotte', 'punta gorda',
  'bonita springs', 'estero', 'winter haven', 'winter park', 'sanford',
  'deltona', 'deland', 'palm coast', 'jensen beach', 'hobe sound', 'palm city',
  'fort pierce', 'tradition',
  // Major US metros
  'new york', 'los angeles', 'chicago', 'houston', 'dallas', 'austin',
  'san antonio', 'phoenix', 'philadelphia', 'san diego', 'san jose',
  'san francisco', 'seattle', 'denver', 'boston', 'atlanta', 'charlotte',
  'nashville', 'las vegas', 'detroit', 'portland', 'memphis',
  // States / generic
  'florida', 'fl', 'texas', 'california', 'georgia', 'near me', 'nearby',
])

function splitGeo(query: string): { base: string; geo: string } {
  const tokens = query.toLowerCase().trim().split(/\s+/)
  for (let k = Math.min(4, tokens.length - 1); k >= 1; k--) {
    const tail = tokens.slice(-k).join(' ')
    if (GEO_TOKENS.has(tail)) {
      let base = tokens.slice(0, tokens.length - k)
      if (base[base.length - 1] === 'in') base = base.slice(0, -1)
      return { base: base.join(' '), geo: tail }
    }
  }
  // "keyword in <place>" — trust the preposition even if the place isn't in the dictionary
  const inIdx = tokens.lastIndexOf('in')
  if (inIdx > 0 && inIdx < tokens.length - 1) {
    return { base: tokens.slice(0, inIdx).join(' '), geo: tokens.slice(inIdx + 1).join(' ') }
  }
  return { base: query.toLowerCase(), geo: '' }
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

interface GeoEntry { geo: string; position: number; impressions: number; clicks: number; ctr: number }
interface KeywordGroup { keyword: string; geos: GeoEntry[]; totalImpressions: number }

function groupByKeyword(rows: RankingRow[]): KeywordGroup[] {
  const acc = new Map<string, Map<string, { posWeight: number; weight: number; impressions: number; clicks: number }>>()
  for (const row of rows) {
    const { base, geo } = splitGeo(row.query)
    if (!acc.has(base)) acc.set(base, new Map())
    const geos = acc.get(base)!
    const cur = geos.get(geo) ?? { posWeight: 0, weight: 0, impressions: 0, clicks: 0 }
    const w = Math.max(row.impressions, 1)
    cur.posWeight += row.position * w
    cur.weight += w
    cur.impressions += row.impressions
    cur.clicks += row.clicks
    geos.set(geo, cur)
  }
  const groups: KeywordGroup[] = []
  for (const [keyword, geos] of acc) {
    const entries: GeoEntry[] = [...geos].map(([geo, v]) => ({
      geo,
      position: Math.round((v.posWeight / v.weight) * 10) / 10,
      impressions: v.impressions,
      clicks: v.clicks,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
    })).sort((a, b) => b.impressions - a.impressions)
    groups.push({
      keyword,
      geos: entries,
      totalImpressions: entries.reduce((s, g) => s + g.impressions, 0),
    })
  }
  return groups.sort((a, b) => b.totalImpressions - a.totalImpressions)
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

const RankIcon = () => (
  <svg className="h-5 w-5 text-[#1A72D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
)
const GeoIcon = () => (
  <svg className="h-5 w-5 text-meta-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
)
const TopRankIcon = () => (
  <svg className="h-5 w-5 text-[#F47C20]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497" />
  </svg>
)
const KeywordIcon = () => (
  <svg className="h-5 w-5 text-[#80CAEE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const PAGE_SIZE = 25

export function SEORankings() {
  const state = useSEODashboardState()
  const [rankings, setRankings] = useState<RankingRow[]>([])
  const [filterText, setFilterText] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async (force = false) => {
    if (!state.selectedGscSite) return
    const cacheKey = `rankings:${state.selectedGscSite}:${state.dateRange.startDate}:${state.dateRange.endDate}`
    if (!force) {
      const cached = cacheGet<{ data: RankingRow[]; lastUpdated: string }>(cacheKey)
      if (cached) { setRankings(cached.data); state.setLastUpdated(new Date(cached.lastUpdated)); return }
    }
    state.setLoading(true)
    try {
      const params = new URLSearchParams({ siteUrl: state.selectedGscSite, startDate: state.dateRange.startDate, endDate: state.dateRange.endDate })
      const data = await edgeFetch(`${SEO_API}/rankings?${params}`).then((r) => r.json())
      if (data.error) throw new Error(data.error)
      const rows: RankingRow[] = data.rankings ?? []
      const updated = new Date()
      setRankings(rows)
      cacheSet(cacheKey, { data: rows, lastUpdated: updated.toISOString() })
      state.setLastUpdated(updated)
    } catch (err) { console.error('[Rankings]', err) } finally { state.setLoading(false) }
  }, [state.selectedGscSite, state.dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const domain = state.selectedGscSite.replace('sc-domain:', '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const countries = useMemo(() => [...new Set(rankings.map((r) => r.country))].sort(), [rankings])

  const groups = useMemo(() => {
    const byCountry = filterCountry ? rankings.filter((r) => r.country === filterCountry) : rankings
    const grouped = groupByKeyword(byCountry)
    if (!filterText) return grouped
    const q = filterText.toLowerCase()
    return grouped.filter((g) => g.keyword.includes(q) || g.geos.some((e) => e.geo.includes(q)))
  }, [rankings, filterCountry, filterText])

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE))
  const paginated = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const allGeoRows = groups.flatMap((g) => g.geos)
  const geoTargets = new Set(allGeoRows.map((e) => e.geo).filter(Boolean))
  const top3 = allGeoRows.filter((r) => r.position <= 3).length
  const page1 = allGeoRows.filter((r) => r.position <= 10).length

  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">
            Keyword Rankings
            <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-bold bg-[#1A72D9]/20 text-[#1A72D9] align-middle">GSC</span>
          </h1>
          <p className="text-sm text-body dark:text-bodydark">
            {domain ? `${domain} · ` : ''}Position by keyword &amp; geo target · {state.lastUpdated ? `Updated ${state.lastUpdated.toLocaleTimeString()}` : 'Loading data…'}
          </p>
        </div>
        <DashboardControls {...state} onRefresh={() => fetchData(true)} pageTitle="Keyword-Rankings" />
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardDataStats title="Primary Keywords" value={groups.length.toLocaleString()} delta={null}
          deltaLabel="unique keywords tracked" sparklineData={[]} sparklineColor="#1A72D9"
          icon={<KeywordIcon />} iconBg="bg-[#80CAEE]/10" source="GSC" />
        <CardDataStats title="Geo Targets" value={geoTargets.size.toLocaleString()} delta={null}
          deltaLabel="locations detected in queries" sparklineData={[]} sparklineColor="#10B981"
          icon={<GeoIcon />} iconBg="bg-meta-3/10" source="GSC" />
        <CardDataStats title="Top 3 Positions" value={top3.toLocaleString()} delta={null}
          deltaLabel="ranking #1–3" sparklineData={[]} sparklineColor="#F47C20"
          icon={<TopRankIcon />} iconBg="bg-[#F47C20]/10" source="GSC" />
        <CardDataStats title="Page 1 Rankings" value={page1.toLocaleString()} delta={null}
          deltaLabel="ranking #1–10" sparklineData={[]} sparklineColor="#1A72D9"
          icon={<RankIcon />} iconBg="bg-[#1A72D9]/10" source="GSC" />
      </section>

      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke px-6 py-5 dark:border-strokedark">
          <div>
            <h3 className="text-lg font-semibold text-black dark:text-[#E2E5E9]">Ranking by Primary Keyword &amp; Geo Target</h3>
            <p className="mt-0.5 text-sm text-body dark:text-bodydark">
              Google Search Console · {groups.length} keywords · geo detected from query text
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterCountry}
              onChange={(e) => { setFilterCountry(e.target.value); setPage(1) }}
              className="rounded-lg border border-stroke bg-transparent py-2 px-3 text-sm text-black outline-none
                         focus:border-[#1A72D9] dark:border-strokedark dark:bg-[#1d2a39] dark:text-[#E2E5E9]"
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>{countryFlag(c)} {countryLabel(c)}</option>
              ))}
            </select>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body dark:text-bodydark">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Filter keywords…"
                value={filterText}
                onChange={(e) => { setFilterText(e.target.value); setPage(1) }}
                className="w-48 rounded-lg border border-stroke bg-transparent py-2 pl-9 pr-4 text-sm text-black outline-none
                           focus:border-[#1A72D9] dark:border-strokedark dark:bg-[#1d2a39] dark:text-[#E2E5E9]"
              />
            </div>
          </div>
        </div>

        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-10 bg-gray dark:bg-meta-4">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">Primary Keyword</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">Geo Target</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">Position</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">Impressions</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">Clicks</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">CTR</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-body dark:text-bodydark">
                    {filterText || filterCountry ? 'No keywords match your filters.' : 'No ranking data available.'}
                  </td>
                </tr>
              ) : paginated.map((group) => (
                group.geos.map((entry, gi) => (
                  <tr key={`${group.keyword}-${entry.geo}`}
                      className={`transition-colors hover:bg-gray-2 dark:hover:bg-meta-4
                        ${gi === group.geos.length - 1 ? 'border-b border-stroke dark:border-strokedark' : ''}`}>
                    {gi === 0 && (
                      <td rowSpan={group.geos.length}
                          className="max-w-[280px] border-b border-stroke px-4 py-3.5 align-top dark:border-strokedark">
                        <span className="block truncate font-semibold text-black dark:text-[#E2E5E9]" title={group.keyword}>
                          {titleCase(group.keyword)}
                        </span>
                        <span className="mt-0.5 block text-xs text-body dark:text-bodydark">
                          {group.geos.length > 1 ? `${group.geos.length} geo targets` : ''}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {entry.geo ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-meta-3/10 px-2.5 py-0.5
                                         text-xs font-medium text-meta-3 dark:bg-meta-3/20">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          {titleCase(entry.geo)}
                        </span>
                      ) : (
                        <span className="text-xs text-body dark:text-bodydark">General</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <PositionBadge position={entry.position} />
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-body dark:text-bodydark">
                      {entry.impressions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-black dark:text-[#E2E5E9]">
                      {entry.clicks.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-body dark:text-bodydark">
                      {(entry.ctr * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-stroke px-6 py-3.5 dark:border-strokedark">
            <p className="text-xs text-body dark:text-bodydark">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, groups.length)} of {groups.length} keywords
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="flex h-7 w-7 items-center justify-center rounded border border-stroke text-xs text-body
                                 hover:border-[#1A72D9] hover:text-[#1A72D9] disabled:opacity-40 dark:border-strokedark dark:text-bodydark">
                ‹
              </button>
              <span className="px-2 text-xs text-body dark:text-bodydark tabular-nums">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="flex h-7 w-7 items-center justify-center rounded border border-stroke text-xs text-body
                                 hover:border-[#1A72D9] hover:text-[#1A72D9] disabled:opacity-40 dark:border-strokedark dark:text-bodydark">
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
