export interface AhrefsSnapshot {
  domain: string
  snapshot_date: string
  domain_rating: number | null
  ahrefs_rank: number | null
  organic_keywords: number | null
  organic_traffic: number | null
  backlinks: number | null
  referring_domains: number | null
}

export class AhrefsApiError extends Error {
  upstreamStatus: number
}

export function normalizeAhrefsTarget(value: unknown): string

export function getAhrefsSnapshot(options: {
  apiKey: string
  target: unknown
  fetchImpl?: typeof fetch
}): Promise<AhrefsSnapshot>
