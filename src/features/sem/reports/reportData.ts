import { edgeFetch } from '@/lib/edgeFetch'
import { supabase } from '@/lib/supabase'
import type { ChartBlockData, KpiMetric, Report, ReportDataSource, ReportTableColumn, ReportTableData, Slide } from './types'
import { normalizeReport } from './reportSlides'

export type ReportDataConnectionStatus = 'mock_not_connected' | 'connected' | 'empty' | 'error'

const SEM_API = 'https://sjpvyxdyleebhqlmqscy.supabase.co/functions/v1/sem'
const REPORT_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const GOOGLE_ADS_REPORT_DATA_LAYER = {
  source: 'mock',
  connectionStatus: 'mock_not_connected',
  integrationTarget: 'Existing SEM Google Ads integration: Google Ads API / Supabase SEM tables',
} as const

export const LSA_REPORT_DATA_LAYER = {
  source: 'mock',
  connectionStatus: 'mock_not_connected',
  integrationTarget: 'Existing SEM LSA integration: Local Services Ads API / Supabase SEM tables',
} as const

export interface GoogleAdsReportData {
  source: 'mock' | 'google_ads_api'
  connectionStatus: ReportDataConnectionStatus
  integrationTarget: string
  kpis: KpiMetric[]
  summary: string
}

export interface LsaReportData {
  source: 'mock' | 'lsa_api'
  connectionStatus: ReportDataConnectionStatus
  integrationTarget: string
  kpis: KpiMetric[]
  summary: string
}

interface GoogleAdsKeywordApiRow {
  text?: string
  match_type?: string
  quality_score?: number | null
  impressions?: number
  clicks?: number
  cost?: number
  ctr?: number
  avg_cpc?: number
  conversions?: number
}

interface SupabaseKeywordRow {
  keyword_text?: string
  match_type?: string
  quality_score?: number | null
  impressions?: number
  clicks?: number
  cost?: number
  ctr?: number
  avg_cpc?: number
  conversions?: number
}

interface GoogleAdsPerformanceSummary {
  impressions?: number
  clicks?: number
  cost?: number
  avg_cpc?: number
}

interface GoogleAdsPerformanceResponse {
  summary?: GoogleAdsPerformanceSummary
  keywords?: GoogleAdsKeywordApiRow[]
  error?: string
}

interface GoogleAdsBreakdownRow {
  key?: string | number
  label?: string
  impressions?: number
  clicks?: number
  cost?: number
  conversions?: number
}

interface GoogleAdsBreakdownsResponse {
  devices?: GoogleAdsBreakdownRow[]
  days?: GoogleAdsBreakdownRow[]
  hours?: GoogleAdsBreakdownRow[]
  error?: string
}

export interface GoogleAdsKpiReportData {
  kpis: KpiMetric[]
  summary: string
  dataSource: ReportDataSource
}

export interface GoogleAdsKeywordReportData {
  table: ReportTableData
  analysis: string
  dataSource: ReportDataSource
}

export interface GoogleAdsBreakdownReportData {
  charts: ChartBlockData[]
  analysis: string
  dataSource: ReportDataSource
}

export const GOOGLE_ADS_KEYWORD_COLUMNS: ReportTableColumn[] = [
  { key: 'keyword', label: 'Keyword' },
  { key: 'matchType', label: 'Match type' },
  { key: 'impressions', label: 'Impr.', align: 'right' },
  { key: 'clicks', label: 'Clicks', align: 'right' },
  { key: 'cost', label: 'Cost', align: 'right' },
  { key: 'conversions', label: 'Conv.', align: 'right' },
  { key: 'cpc', label: 'CPC', align: 'right' },
  { key: 'status', label: 'Status' },
]

// TEMPLATE PLACEHOLDER: no fake performance numbers live here. The report editor
// hydrates this slide from the real Google Ads /sem/performance endpoint when a
// report is generated or opened.
export function getGoogleAdsReportData(clientId: string, month: string, year: number): GoogleAdsReportData {
  void clientId
  void month
  void year

  return {
    ...GOOGLE_ADS_REPORT_DATA_LAYER,
    kpis: [
      { id: 'impressions', label: 'Impressions', value: '0', comparison: 'Pending Google Ads API', trend: 'flat' },
      { id: 'clicks', label: 'Clicks', value: '0', comparison: 'Pending Google Ads API', trend: 'flat' },
      { id: 'cost', label: 'Cost', value: '$0', comparison: 'Pending Google Ads API', trend: 'flat' },
      { id: 'avg-cpc', label: 'Average CPC', value: '$0', comparison: 'Pending Google Ads API', trend: 'flat' },
    ],
    summary: 'Real Google Ads KPI data will load from the client Ads account when the report is generated or opened.',
  }
}

function formatNumber(n: number, decimals = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function formatCurrency(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function getMonthlyReportDateRange(month: string, year: number) {
  const monthIndex = REPORT_MONTH_NAMES.findIndex((item) => item.toLowerCase() === month.toLowerCase())

  const safeMonthIndex = monthIndex >= 0 ? monthIndex : new Date().getMonth()
  const start = `${year}-${String(safeMonthIndex + 1).padStart(2, '0')}-01`
  const endDay = new Date(year, safeMonthIndex + 1, 0).getDate()
  const end = `${year}-${String(safeMonthIndex + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
  return { start, end }
}

function getPreviousMonthlyReportDateRange(month: string, year: number) {
  const monthIndex = REPORT_MONTH_NAMES.findIndex((item) => item.toLowerCase() === month.toLowerCase())
  const safeMonthIndex = monthIndex >= 0 ? monthIndex : new Date().getMonth()
  const previousMonthIndex = safeMonthIndex === 0 ? 11 : safeMonthIndex - 1
  const previousYear = safeMonthIndex === 0 ? year - 1 : year
  return getMonthlyReportDateRange(REPORT_MONTH_NAMES[previousMonthIndex], previousYear)
}

async function resolveGoogleAdsAccountId(clientId: string): Promise<string> {
  const normalized = clientId.replace(/-/g, '')
  if (/^\d+$/.test(normalized)) return normalized

  const { data, error } = await supabase
    .from('clients')
    .select('sem_account_id')
    .eq('id', clientId)
    .maybeSingle()

  if (error) throw new Error(`Unable to resolve Google Ads account for client ${clientId}: ${error.message}`)
  const accountId = String(data?.sem_account_id ?? '').replace(/-/g, '')
  if (!accountId) throw new Error(`Client ${clientId} does not have a linked Google Ads account.`)
  return accountId
}

function safeNumber(value: unknown) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function normalizePerformanceSummary(summary?: GoogleAdsPerformanceSummary) {
  return {
    impressions: safeNumber(summary?.impressions),
    clicks: safeNumber(summary?.clicks),
    cost: safeNumber(summary?.cost),
    avg_cpc: safeNumber(summary?.avg_cpc),
  }
}

async function fetchGoogleAdsPerformance(
  accountId: string,
  dateRange: { start: string; end: string },
): Promise<GoogleAdsPerformanceResponse> {
  const params = new URLSearchParams({
    accountId,
    startDate: dateRange.start,
    endDate: dateRange.end,
  })
  const response = await edgeFetch(`${SEM_API}/performance?${params}`)
  const json = await response.json() as GoogleAdsPerformanceResponse

  if (!response.ok || json.error) throw new Error(json.error ?? `Google Ads API HTTP ${response.status}`)
  return json
}

async function fetchGoogleAdsBreakdowns(
  accountId: string,
  dateRange: { start: string; end: string },
): Promise<GoogleAdsBreakdownsResponse> {
  const params = new URLSearchParams({
    accountId,
    startDate: dateRange.start,
    endDate: dateRange.end,
  })
  const response = await edgeFetch(`${SEM_API}/breakdowns?${params}`)
  const json = await response.json() as GoogleAdsBreakdownsResponse

  if (!response.ok || json.error) throw new Error(json.error ?? `Google Ads API HTTP ${response.status}`)
  return json
}

function createGoogleAdsKpiDataSource(
  connectionStatus: ReportDataSource['connectionStatus'],
  dateRange: { start: string; end: string },
  message: string,
  clientId: string,
  accountId?: string,
): ReportDataSource {
  return {
    source: 'google_ads_api',
    connectionStatus,
    clientId,
    accountId,
    integrationTarget: 'Existing SEM Google Ads integration: Supabase Edge Function /sem/performance -> Google Ads campaign summary',
    dateRange,
    updatedAt: new Date().toISOString(),
    message,
  }
}

function createGoogleAdsBreakdownDataSource(
  connectionStatus: ReportDataSource['connectionStatus'],
  dateRange: { start: string; end: string },
  message: string,
  clientId: string,
  accountId?: string,
): ReportDataSource {
  return {
    source: 'google_ads_api',
    connectionStatus,
    clientId,
    accountId,
    rangeKey: 'monthly_google_ads_breakdowns',
    integrationTarget: 'Existing SEM Google Ads integration: Supabase Edge Function /sem/breakdowns -> Google Ads segments.device, segments.day_of_week, segments.hour',
    dateRange,
    updatedAt: new Date().toISOString(),
    message,
  }
}

function formatKpiComparison(current: number, previous: number) {
  if (previous === 0 && current === 0) return 'No previous-month data'
  if (previous === 0) return 'New activity vs previous month'

  const delta = ((current - previous) / previous) * 100
  const formatted = Math.abs(delta).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return `${delta >= 0 ? '+' : '-'}${formatted}% vs previous month`
}

function kpiTrend(current: number, previous: number, lowerIsBetter = false): KpiMetric['trend'] {
  if (previous === 0 && current === 0) return 'flat'
  if (previous === 0) return 'up'

  const delta = current - previous
  if (Math.abs(delta) < 0.01) return 'flat'
  if (lowerIsBetter) return delta < 0 ? 'up' : 'down'
  return delta > 0 ? 'up' : 'down'
}

function buildGoogleAdsKpis(
  current: ReturnType<typeof normalizePerformanceSummary>,
  previous: ReturnType<typeof normalizePerformanceSummary>,
): KpiMetric[] {
  return [
    {
      id: 'impressions',
      label: 'Impressions',
      value: formatNumber(current.impressions),
      comparison: formatKpiComparison(current.impressions, previous.impressions),
      trend: kpiTrend(current.impressions, previous.impressions),
    },
    {
      id: 'clicks',
      label: 'Clicks',
      value: formatNumber(current.clicks),
      comparison: formatKpiComparison(current.clicks, previous.clicks),
      trend: kpiTrend(current.clicks, previous.clicks),
    },
    {
      id: 'cost',
      label: 'Cost',
      value: formatCurrency(current.cost),
      comparison: formatKpiComparison(current.cost, previous.cost),
      trend: kpiTrend(current.cost, previous.cost, true),
    },
    {
      id: 'avg-cpc',
      label: 'Average CPC',
      value: formatCurrency(current.avg_cpc),
      comparison: formatKpiComparison(current.avg_cpc, previous.avg_cpc),
      trend: kpiTrend(current.avg_cpc, previous.avg_cpc, true),
    },
  ]
}

export async function getGoogleAdsKpiReportData(
  clientId: string,
  month: string,
  year: number,
): Promise<GoogleAdsKpiReportData> {
  const dateRange = getMonthlyReportDateRange(month, year)
  const previousDateRange = getPreviousMonthlyReportDateRange(month, year)
  let accountId = ''

  try {
    accountId = await resolveGoogleAdsAccountId(clientId)
    const [currentResponse, previousResponse] = await Promise.all([
      fetchGoogleAdsPerformance(accountId, dateRange),
      fetchGoogleAdsPerformance(accountId, previousDateRange).catch(() => ({ summary: undefined })),
    ])
    const currentSummary = normalizePerformanceSummary(currentResponse.summary)
    const previousSummary = normalizePerformanceSummary(previousResponse.summary)
    const hasData = Object.values(currentSummary).some((value) => value > 0)
    const dataSource = createGoogleAdsKpiDataSource(
      hasData ? 'connected' : 'empty',
      dateRange,
      hasData
        ? `Loaded real Google Ads KPI summary from account ${accountId}.`
        : `Google Ads returned no KPI activity for account ${accountId} in this month.`,
      clientId,
      accountId,
    )

    return {
      dataSource,
      kpis: buildGoogleAdsKpis(currentSummary, previousSummary),
      summary: hasData
        ? `Real Google Ads account data loaded for ${dateRange.start} through ${dateRange.end}. Impressions, clicks, cost, and average CPC are pulled from the account campaign performance summary, with comparisons calculated against the previous month.`
        : `No real Google Ads KPI activity returned for ${dateRange.start} through ${dateRange.end}. Confirm the account had campaign activity and the Google Ads integration can access this customer.`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load real Google Ads KPI data.'
    const dataSource = createGoogleAdsKpiDataSource('error', dateRange, message, clientId, accountId || undefined)
    return {
      dataSource,
      kpis: buildGoogleAdsKpis(
        { impressions: 0, clicks: 0, cost: 0, avg_cpc: 0 },
        { impressions: 0, clicks: 0, cost: 0, avg_cpc: 0 },
      ),
      summary: `Unable to load real Google Ads KPI data for ${dateRange.start} through ${dateRange.end}: ${message}`,
    }
  }
}

function keywordStatus(row: GoogleAdsKeywordApiRow) {
  const conversions = Number(row.conversions ?? 0)
  const clicks = Number(row.clicks ?? 0)
  const cost = Number(row.cost ?? 0)
  const qualityScore = row.quality_score

  if (conversions > 0 && (qualityScore == null || qualityScore >= 7)) return 'Scale'
  if (conversions > 0) return 'Maintain'
  if (clicks >= 5 || cost >= 50 || (qualityScore != null && qualityScore <= 3)) return 'Review'
  return 'Monitor'
}

function buildKeywordTable(rows: GoogleAdsKeywordApiRow[], dataSource: ReportDataSource): ReportTableData {
  return {
    id: 'keywords-table',
    title: 'Keyword Performance - Google Ads API',
    dataSource,
    columns: GOOGLE_ADS_KEYWORD_COLUMNS,
    rows: rows.slice(0, 7).map((row) => ({
      keyword: row.text ?? '',
      matchType: row.match_type ? row.match_type.charAt(0) + row.match_type.slice(1).toLowerCase() : 'Unknown',
      impressions: formatNumber(Number(row.impressions ?? 0)),
      clicks: formatNumber(Number(row.clicks ?? 0)),
      cost: formatCurrency(Number(row.cost ?? 0)),
      conversions: formatNumber(Number(row.conversions ?? 0), 1),
      cpc: formatCurrency(Number(row.avg_cpc ?? 0)),
      status: keywordStatus(row),
    })),
  }
}

function mapSupabaseKeywordRow(row: SupabaseKeywordRow): GoogleAdsKeywordApiRow {
  return {
    text: row.keyword_text ?? '',
    match_type: row.match_type ?? '',
    quality_score: row.quality_score ?? null,
    impressions: safeNumber(row.impressions),
    clicks: safeNumber(row.clicks),
    cost: safeNumber(row.cost),
    ctr: safeNumber(row.ctr),
    avg_cpc: safeNumber(row.avg_cpc),
    conversions: safeNumber(row.conversions),
  }
}

function createKeywordDataSource(
  source: Extract<ReportDataSource['source'], 'google_ads_api' | 'supabase_sem_keywords'>,
  connectionStatus: ReportDataSource['connectionStatus'],
  dateRange: { start: string; end: string },
  message: string,
  clientId: string,
  accountId?: string,
  rangeKey?: string,
): ReportDataSource {
  return {
    source,
    connectionStatus,
    clientId,
    accountId,
    rangeKey,
    integrationTarget: source === 'supabase_sem_keywords'
      ? 'Existing SEM Keywords tab: Supabase sem_keywords table'
      : 'Existing SEM Google Ads integration: Supabase Edge Function /sem/performance -> Google Ads keyword_view',
    dateRange,
    updatedAt: new Date().toISOString(),
    message,
  }
}

async function fetchSupabaseKeywordRows(accountId: string): Promise<{
  rows: GoogleAdsKeywordApiRow[]
  rangeKey: string
}> {
  const rangeKeys = ['last_30', 'last_90', 'last_7']

  for (const rangeKey of rangeKeys) {
    const { data, error } = await supabase
      .from('sem_keywords')
      .select('keyword_text,match_type,quality_score,impressions,clicks,cost,ctr,avg_cpc,conversions')
      .eq('account_id', accountId)
      .eq('date_range', rangeKey)
      .order('cost', { ascending: false })
      .limit(100)

    if (error) throw new Error(`Unable to load SEM keyword table data: ${error.message}`)

    const rows = (data ?? []).map((row) => mapSupabaseKeywordRow(row as SupabaseKeywordRow))
    if (rows.length > 0) return { rows, rangeKey }
  }

  return { rows: [], rangeKey: rangeKeys[0] }
}

export async function getGoogleAdsKeywordReportData(
  clientId: string,
  month: string,
  year: number,
): Promise<GoogleAdsKeywordReportData> {
  const dateRange = getMonthlyReportDateRange(month, year)
  let accountId = ''

  try {
    accountId = await resolveGoogleAdsAccountId(clientId)
    const semKeywordData = await fetchSupabaseKeywordRows(accountId)
    if (semKeywordData.rows.length > 0) {
      const dataSource = createKeywordDataSource(
        'supabase_sem_keywords',
        'connected',
        dateRange,
        `Loaded ${semKeywordData.rows.length} real keywords from SEM Keywords for account ${accountId}.`,
        clientId,
        accountId,
        semKeywordData.rangeKey,
      )

      return {
        dataSource,
        table: buildKeywordTable(semKeywordData.rows, dataSource),
        analysis: `Real SEM keyword data loaded from the selected account (${accountId}) using the ${semKeywordData.rangeKey.replace(/_/g, ' ')} range from the Keywords tab. Rows are sorted by spend and limited to the top 7 keywords.`,
      }
    }

    const json = await fetchGoogleAdsPerformance(accountId, dateRange)

    const keywords = Array.isArray(json.keywords) ? json.keywords as GoogleAdsKeywordApiRow[] : []
    const dataSource = createKeywordDataSource(
      'google_ads_api',
      keywords.length > 0 ? 'connected' : 'empty',
      dateRange,
      keywords.length > 0
        ? `Loaded ${keywords.length} real keywords from Google Ads account ${accountId}.`
        : `Google Ads returned no keyword rows for account ${accountId} in this month.`,
      clientId,
      accountId,
      'monthly_google_ads_api',
    )

    return {
      dataSource,
      table: buildKeywordTable(keywords, dataSource),
      analysis: keywords.length > 0
        ? `Real Google Ads keyword data loaded for ${dateRange.start} through ${dateRange.end}. Rows are sorted by spend from the account keyword_view query.`
        : `No real Google Ads keyword data returned for ${dateRange.start} through ${dateRange.end}. Confirm the account had keyword activity and the Google Ads integration can access this customer.`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load real Google Ads keyword data.'
    const dataSource = createKeywordDataSource('supabase_sem_keywords', 'error', dateRange, message, clientId, accountId || undefined, 'last_30')
    return {
      dataSource,
      table: buildKeywordTable([], dataSource),
      analysis: `Unable to load real Google Ads keyword data for ${dateRange.start} through ${dateRange.end}: ${message}`,
    }
  }
}

function breakdownMetric(row: GoogleAdsBreakdownRow) {
  const conversions = safeNumber(row.conversions)
  const clicks = safeNumber(row.clicks)
  return conversions > 0 ? conversions : clicks
}

function formatShare(value: number, total: number) {
  if (total <= 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

function breakdownDetail(row: GoogleAdsBreakdownRow) {
  const conversions = safeNumber(row.conversions)
  const cost = safeNumber(row.cost)
  const clicks = safeNumber(row.clicks)
  if (conversions > 0) return `${formatCurrency(cost / conversions)} CPL`
  return `${formatNumber(clicks)} clicks`
}

function deviceLabel(value: unknown) {
  const normalized = String(value ?? '').replace(/_/g, ' ').toLowerCase()
  if (!normalized) return 'Unknown'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const dayLabels: Record<string, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
}

const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

function buildShareChart(
  id: string,
  title: string,
  description: string,
  rows: GoogleAdsBreakdownRow[],
  labelForRow: (row: GoogleAdsBreakdownRow) => string,
): ChartBlockData {
  const total = rows.reduce((sum, row) => sum + breakdownMetric(row), 0)

  return {
    id,
    title,
    description,
    series: rows.map((row) => {
      const metric = breakdownMetric(row)
      return {
        label: labelForRow(row),
        value: total > 0 ? Math.round((metric / total) * 100) : 0,
        displayValue: formatShare(metric, total),
        detail: breakdownDetail(row),
      }
    }),
  }
}

function buildHourRows(rows: GoogleAdsBreakdownRow[]) {
  const buckets = [
    { label: '12-8 AM', min: 0, max: 8, row: { key: '12-8 AM', clicks: 0, cost: 0, conversions: 0 } },
    { label: '8-11 AM', min: 8, max: 11, row: { key: '8-11 AM', clicks: 0, cost: 0, conversions: 0 } },
    { label: '11-2 PM', min: 11, max: 14, row: { key: '11-2 PM', clicks: 0, cost: 0, conversions: 0 } },
    { label: '2-5 PM', min: 14, max: 17, row: { key: '2-5 PM', clicks: 0, cost: 0, conversions: 0 } },
    { label: '5-8 PM', min: 17, max: 20, row: { key: '5-8 PM', clicks: 0, cost: 0, conversions: 0 } },
    { label: 'After 8 PM', min: 20, max: 24, row: { key: 'After 8 PM', clicks: 0, cost: 0, conversions: 0 } },
  ]

  rows.forEach((sourceRow) => {
    const hour = Number(sourceRow.key)
    const bucket = buckets.find((item) => Number.isFinite(hour) && hour >= item.min && hour < item.max)
    if (!bucket) return
    bucket.row.clicks += safeNumber(sourceRow.clicks)
    bucket.row.cost += safeNumber(sourceRow.cost)
    bucket.row.conversions += safeNumber(sourceRow.conversions)
  })

  return buckets.map((bucket) => ({ ...bucket.row, label: bucket.label }))
}

function buildGoogleAdsBreakdownCharts(response: GoogleAdsBreakdownsResponse): ChartBlockData[] {
  const devices = (response.devices ?? [])
    .slice()
    .sort((a, b) => breakdownMetric(b) - breakdownMetric(a))

  const days = (response.days ?? [])
    .slice()
    .sort((a, b) => dayOrder.indexOf(String(a.key)) - dayOrder.indexOf(String(b.key)))

  const hours = buildHourRows(response.hours ?? [])

  return [
    buildShareChart('device-performance', 'Device Performance', 'Lead share by device', devices, (row) => row.label ?? deviceLabel(row.key)),
    buildShareChart('day-performance', 'Day of Week Performance', 'Lead share by day', days, (row) => dayLabels[String(row.key)] ?? row.label ?? String(row.key ?? 'Unknown')),
    buildShareChart('hour-performance', 'Hour of Day Performance', 'Lead share by time window', hours, (row) => row.label ?? String(row.key ?? 'Unknown')),
  ]
}

export async function getGoogleAdsBreakdownReportData(
  clientId: string,
  month: string,
  year: number,
): Promise<GoogleAdsBreakdownReportData> {
  const dateRange = getMonthlyReportDateRange(month, year)
  let accountId = ''

  try {
    accountId = await resolveGoogleAdsAccountId(clientId)
    const json = await fetchGoogleAdsBreakdowns(accountId, dateRange)
    const hasData = [...(json.devices ?? []), ...(json.days ?? []), ...(json.hours ?? [])]
      .some((row) => breakdownMetric(row) > 0)
    const dataSource = createGoogleAdsBreakdownDataSource(
      hasData ? 'connected' : 'empty',
      dateRange,
      hasData
        ? `Loaded real Google Ads device, day, and hour breakdowns from account ${accountId}.`
        : `Google Ads returned no device, day, or hour activity for account ${accountId} in this month.`,
      clientId,
      accountId,
    )

    return {
      dataSource,
      charts: buildGoogleAdsBreakdownCharts(json),
      analysis: hasData
        ? `Real Google Ads breakdown data loaded for ${dateRange.start} through ${dateRange.end}. Shares use conversions when available and clicks as the fallback signal.`
        : `No real Google Ads device, day, or hour data returned for ${dateRange.start} through ${dateRange.end}. Confirm the account had campaign activity and the Google Ads integration can access this customer.`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load real Google Ads breakdown data.'
    const dataSource = createGoogleAdsBreakdownDataSource('error', dateRange, message, clientId, accountId || undefined)
    return {
      dataSource,
      charts: buildGoogleAdsBreakdownCharts({ devices: [], days: [], hours: [] }),
      analysis: `Unable to load real Google Ads device, day, and hour data for ${dateRange.start} through ${dateRange.end}: ${message}`,
    }
  }
}

function replaceKeywordSlide(slide: Slide, keywordData: GoogleAdsKeywordReportData): Slide {
  return {
    ...slide,
    notes: keywordData.dataSource.message ?? slide.notes,
    content: {
      ...slide.content,
      dataSource: keywordData.dataSource,
      tables: [keywordData.table],
      textBlocks: [
        {
          id: 'keyword-analysis',
          label: 'Keyword Analysis',
          value: keywordData.analysis,
        },
      ],
    },
  }
}

function replaceGoogleAdsBreakdownSlide(slide: Slide, breakdownData: GoogleAdsBreakdownReportData): Slide {
  return {
    ...slide,
    notes: breakdownData.dataSource.message ?? slide.notes,
    content: {
      ...slide.content,
      dataSource: breakdownData.dataSource,
      charts: breakdownData.charts,
      textBlocks: [
        {
          id: 'device-day-hour-analysis',
          label: 'Analysis',
          value: breakdownData.analysis,
        },
      ],
    },
  }
}

function replaceGoogleAdsKpiSlide(slide: Slide, kpiData: GoogleAdsKpiReportData): Slide {
  return {
    ...slide,
    notes: kpiData.dataSource.message ?? slide.notes,
    content: {
      ...slide.content,
      dataSource: kpiData.dataSource,
      kpis: kpiData.kpis,
      textBlocks: [
        {
          id: 'monthly-summary',
          label: 'Monthly Summary',
          value: kpiData.summary,
        },
      ],
    },
  }
}

export function reportNeedsGoogleAdsKpiHydration(report: Report): boolean {
  const normalizedReport = normalizeReport(report)
  const kpiSlide = normalizedReport.slides.find((slide) => slide.type === 'google_ads_kpis')
  const expectedRange = getMonthlyReportDateRange(report.month, report.year)
  const source = kpiSlide?.content.dataSource

  if (!source) return true
  if (source.source !== 'google_ads_api') return true
  if (source.connectionStatus === 'error') {
    const lastAttempt = source.updatedAt ? new Date(source.updatedAt).getTime() : 0
    return Date.now() - lastAttempt > 5 * 60 * 1000
  }
  if (source.clientId !== report.clientId) return true
  const expectedAccountId = report.clientId.replace(/-/g, '')
  if (/^\d+$/.test(expectedAccountId) && source.accountId !== expectedAccountId) return true
  if (!source.accountId) return true
  return source.dateRange?.start !== expectedRange.start || source.dateRange?.end !== expectedRange.end
}

export async function hydrateReportWithRealGoogleAdsKpis(report: Report): Promise<Report> {
  const normalizedReport = normalizeReport(report)
  const kpiData = await getGoogleAdsKpiReportData(normalizedReport.clientId, normalizedReport.month, normalizedReport.year)
  return {
    ...normalizedReport,
    slides: normalizedReport.slides.map((slide) => (
      slide.type === 'google_ads_kpis' ? replaceGoogleAdsKpiSlide(slide, kpiData) : slide
    )),
  }
}

export function reportNeedsGoogleAdsKeywordHydration(report: Report): boolean {
  const normalizedReport = normalizeReport(report)
  const keywordSlide = normalizedReport.slides.find((slide) => slide.type === 'keywords')
  const expectedRange = getMonthlyReportDateRange(report.month, report.year)
  const source = keywordSlide?.content.dataSource
  const table = keywordSlide?.content.tables?.[0]

  if (!source) return true
  if (source.source !== 'supabase_sem_keywords') {
    if (source.source !== 'google_ads_api' || source.rangeKey !== 'monthly_google_ads_api') return true
  }
  if (source.connectionStatus === 'error') {
    const lastAttempt = source.updatedAt ? new Date(source.updatedAt).getTime() : 0
    return Date.now() - lastAttempt > 5 * 60 * 1000
  }
  if (source.clientId !== report.clientId) return true
  const expectedAccountId = report.clientId.replace(/-/g, '')
  if (/^\d+$/.test(expectedAccountId) && source.accountId !== expectedAccountId) return true
  if (!source.accountId) return true
  if (source.source === 'supabase_sem_keywords' && source.rangeKey !== 'last_30' && source.rangeKey !== 'last_90' && source.rangeKey !== 'last_7') return true
  if (!table?.rows?.length && source.connectionStatus === 'connected') return true
  if (source.updatedAt && Date.now() - new Date(source.updatedAt).getTime() > 20 * 60 * 1000) return true
  return source.dateRange?.start !== expectedRange.start || source.dateRange?.end !== expectedRange.end
}

export async function hydrateReportWithRealGoogleAdsKeywords(report: Report): Promise<Report> {
  const normalizedReport = normalizeReport(report)
  const keywordData = await getGoogleAdsKeywordReportData(normalizedReport.clientId, normalizedReport.month, normalizedReport.year)
  return {
    ...normalizedReport,
    slides: normalizedReport.slides.map((slide) => (
      slide.type === 'keywords' ? replaceKeywordSlide(slide, keywordData) : slide
    )),
  }
}

export function reportNeedsGoogleAdsBreakdownHydration(report: Report): boolean {
  const normalizedReport = normalizeReport(report)
  const breakdownSlide = normalizedReport.slides.find((slide) => slide.type === 'devices_day_hour')
  const expectedRange = getMonthlyReportDateRange(report.month, report.year)
  const source = breakdownSlide?.content.dataSource
  const charts = breakdownSlide?.content.charts ?? []

  if (!source) return true
  if (source.source !== 'google_ads_api' || source.rangeKey !== 'monthly_google_ads_breakdowns') return true
  if (source.connectionStatus === 'error') {
    const lastAttempt = source.updatedAt ? new Date(source.updatedAt).getTime() : 0
    return Date.now() - lastAttempt > 5 * 60 * 1000
  }
  if (source.clientId !== report.clientId) return true
  const expectedAccountId = report.clientId.replace(/-/g, '')
  if (/^\d+$/.test(expectedAccountId) && source.accountId !== expectedAccountId) return true
  if (!source.accountId) return true
  if (!charts.length && source.connectionStatus === 'connected') return true
  if (source.updatedAt && Date.now() - new Date(source.updatedAt).getTime() > 20 * 60 * 1000) return true
  return source.dateRange?.start !== expectedRange.start || source.dateRange?.end !== expectedRange.end
}

export async function hydrateReportWithRealGoogleAdsBreakdowns(report: Report): Promise<Report> {
  const normalizedReport = normalizeReport(report)
  const breakdownData = await getGoogleAdsBreakdownReportData(normalizedReport.clientId, normalizedReport.month, normalizedReport.year)
  return {
    ...normalizedReport,
    slides: normalizedReport.slides.map((slide) => (
      slide.type === 'devices_day_hour' ? replaceGoogleAdsBreakdownSlide(slide, breakdownData) : slide
    )),
  }
}

export async function hydrateReportWithRealGoogleAdsData(report: Report): Promise<Report> {
  const withKpis = await hydrateReportWithRealGoogleAdsKpis(normalizeReport(report))
  const withKeywords = await hydrateReportWithRealGoogleAdsKeywords(withKpis)
  return hydrateReportWithRealGoogleAdsBreakdowns(withKeywords)
}

// MOCK DATA LAYER: this is intentionally separate from Google Ads so the LSA API
// connection can be wired independently without changing report components.
export function getLsaReportData(clientId: string, month: string, year: number): LsaReportData {
  void clientId
  void month
  void year

  return {
    ...LSA_REPORT_DATA_LAYER,
    kpis: [
      { id: 'charged-leads', label: 'Charged Leads', value: '38', comparison: '+4 vs previous month', trend: 'up' },
      { id: 'lead-spend', label: 'Lead Spend', value: '$1,824.00', comparison: '+6.3% vs previous month', trend: 'up' },
      { id: 'impressions', label: 'Impressions', value: '7,940', comparison: '+12.5% vs previous month', trend: 'up' },
      { id: 'top-impression-rate', label: 'Top Impression Rate', value: '72.4%', comparison: '+3.6 pts vs previous month', trend: 'up' },
      { id: 'absolute-top-rate', label: 'Absolute Top Impression Rate', value: '39.8%', comparison: '+1.9 pts vs previous month', trend: 'up' },
      { id: 'cost-per-lead', label: 'Cost per Lead', value: '$48.00', comparison: '-2.1% vs previous month', trend: 'down' },
    ],
    summary: 'Local Services Ads delivered stronger visibility and steady cost per lead. Responsiveness and accurate lead feedback remain the main levers for continued improvement.',
  }
}
