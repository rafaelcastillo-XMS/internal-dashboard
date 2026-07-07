import type { Report } from './types'
import { normalizeReport } from './reportSlides'

const STORAGE_KEY = 'xms_sem_monthly_reports'

export function readStoredReports(): Report[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeReport) : []
  } catch {
    return []
  }
}

export function writeStoredReports(reports: Report[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.map(normalizeReport)))
}

export function upsertStoredReport(report: Report) {
  const normalizedReport = normalizeReport(report)
  const reports = readStoredReports()
  const next = reports.some((item) => item.id === normalizedReport.id)
    ? reports.map((item) => (item.id === normalizedReport.id ? normalizedReport : item))
    : [normalizedReport, ...reports]
  writeStoredReports(next)
  return next
}
