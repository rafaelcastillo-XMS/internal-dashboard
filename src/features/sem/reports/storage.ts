import { supabase } from '@/lib/supabase'
import type { Report, ReportStatus, Slide } from './types'
import { normalizeReport } from './reportSlides'

const TABLE_NAME = 'sem_monthly_reports'
const LEGACY_STORAGE_KEY = 'xms_sem_monthly_reports'
const REPORT_COLUMNS = 'id, account_id, client_name, client_logo, month, year, status, slides, created_at, updated_at'

interface MonthlyReportRow {
  id: string
  account_id: string
  client_name: string
  client_logo: string | null
  month: string
  year: number
  status: string
  slides: unknown
  created_at: string
  updated_at: string
}

function reportStatus(value: string): ReportStatus {
  if (value === 'Ready' || value === 'In Review') return value
  return 'Draft'
}

function validIsoDate(value: unknown) {
  const date = new Date(String(value ?? ''))
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export function monthlyReportRowToReport(row: MonthlyReportRow): Report {
  const createdAt = validIsoDate(row.created_at)
  return normalizeReport({
    id: String(row.id),
    clientId: String(row.account_id),
    clientName: String(row.client_name),
    clientLogo: String(row.client_logo ?? ''),
    month: String(row.month),
    year: Number(row.year),
    status: reportStatus(row.status),
    slides: Array.isArray(row.slides) ? row.slides as Slide[] : [],
    createdAt,
    updatedAt: validIsoDate(row.updated_at ?? createdAt),
  })
}

export function reportToMonthlyReportRow(report: Report) {
  const normalized = normalizeReport(report)
  return {
    id: normalized.id,
    account_id: normalized.clientId,
    client_name: normalized.clientName,
    client_logo: normalized.clientLogo,
    month: normalized.month,
    year: normalized.year,
    status: normalized.status,
    slides: normalized.slides,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  }
}

function storageError(action: string, message: string) {
  return new Error(`Unable to ${action} monthly report data in Supabase: ${message}`)
}

export async function listStoredReports(accountId: string): Promise<Report[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(REPORT_COLUMNS)
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false })

  if (error) throw storageError('load', error.message)
  return (data ?? []).map((row) => monthlyReportRowToReport(row as MonthlyReportRow))
}

export async function getStoredReport(reportId: string): Promise<Report | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(REPORT_COLUMNS)
    .eq('id', reportId)
    .maybeSingle()

  if (error) throw storageError('load', error.message)
  return data ? monthlyReportRowToReport(data as MonthlyReportRow) : null
}

export async function upsertStoredReport(report: Report): Promise<Report> {
  const normalized = normalizeReport(report)
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(reportToMonthlyReportRow(normalized), { onConflict: 'id' })
    .select(REPORT_COLUMNS)
    .single()

  if (error) throw storageError('save', error.message)
  return monthlyReportRowToReport(data as MonthlyReportRow)
}

export async function upsertStoredReports(reports: Report[]): Promise<Report[]> {
  const saved: Report[] = []
  for (const report of reports) saved.push(await upsertStoredReport(report))
  return saved
}

export async function deleteStoredReport(reportId: string): Promise<void> {
  const { error } = await supabase.from(TABLE_NAME).delete().eq('id', reportId)
  if (error) throw storageError('delete', error.message)
}

function readLegacyReports(): Report[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((report) => normalizeReport(report as Report)) : []
  } catch {
    return []
  }
}

async function migrateLegacyReports() {
  const localReports = readLegacyReports()
  if (!localReports.length) return 0

  const remoteById = new Map<string, Report>()
  const chunkSize = 50
  for (let index = 0; index < localReports.length; index += chunkSize) {
    const ids = localReports.slice(index, index + chunkSize).map((report) => report.id)
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(REPORT_COLUMNS)
      .in('id', ids)
    if (error) throw storageError('migrate', error.message)
    for (const row of data ?? []) {
      const report = monthlyReportRowToReport(row as MonthlyReportRow)
      remoteById.set(report.id, report)
    }
  }

  const reportsToMigrate = localReports.filter((localReport) => {
    const remoteReport = remoteById.get(localReport.id)
    if (!remoteReport) return true
    return new Date(localReport.updatedAt).getTime() > new Date(remoteReport.updatedAt).getTime()
  })

  await upsertStoredReports(reportsToMigrate)
  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  return reportsToMigrate.length
}

let legacyMigrationPromise: Promise<number> | null = null

export function migrateLegacyStoredReports(): Promise<number> {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = migrateLegacyReports().catch((error) => {
      legacyMigrationPromise = null
      throw error
    })
  }
  return legacyMigrationPromise
}
