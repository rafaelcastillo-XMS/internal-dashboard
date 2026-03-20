const TTL = 20 * 60 * 1000 // 20 minutes

export function cacheGet<T>(key: string): T | null {
  try {
    const item = sessionStorage.getItem(`social_data:${key}`)
    if (!item) return null
    const { data, ts } = JSON.parse(item) as { data: T; ts: number }
    if (Date.now() - ts >= TTL) return null
    if (data && typeof data === 'object' && 'error' in data) {
      sessionStorage.removeItem(`social_data:${key}`)
      return null
    }
    return data
  } catch { return null }
}

export function cacheSet(key: string, data: unknown): void {
  try {
    sessionStorage.setItem(`social_data:${key}`, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

export function cacheClear(key: string): void {
  try { sessionStorage.removeItem(`social_data:${key}`) } catch {}
}
