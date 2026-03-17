const TTL = 20 * 60 * 1000 // 20 minutes

export function cacheGet<T>(key: string): T | null {
  try {
    const item = sessionStorage.getItem(`seo_data:${key}`)
    if (!item) return null
    const { data, ts } = JSON.parse(item) as { data: T; ts: number }
    if (Date.now() - ts >= TTL) return null
    // Never serve cached error responses
    if (data && typeof data === 'object' && 'error' in data) {
      sessionStorage.removeItem(`seo_data:${key}`)
      return null
    }
    return data
  } catch { return null }
}

export function cacheSet(key: string, data: unknown): void {
  try {
    sessionStorage.setItem(`seo_data:${key}`, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

export function cacheClear(key: string): void {
  try { sessionStorage.removeItem(`seo_data:${key}`) } catch {}
}
