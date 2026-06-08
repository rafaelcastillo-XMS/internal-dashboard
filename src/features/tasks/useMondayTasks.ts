import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"

export interface MondayTask {
  id: string
  name: string
  board: string
  status: string
  statusIndex: number | null
  priority: string | null
  priorityIndex: number | null
  dueDate: string | null
  updatedAt: string
}

export interface MondayUser {
  id: string
  name: string
  email: string
  avatar: string
}

export interface MondayTasksResult {
  user: MondayUser | null
  tasks: MondayTask[]
  loading: boolean
  syncing: boolean
  error: string | null
  refetch: () => void
}

const CACHE_KEY = 'monday_tasks_v1'
const REVALIDATE_MS = 2 * 60 * 1000 // refetch if cache is older than 2 min

interface Cache {
  user: MondayUser | null
  tasks: MondayTask[]
  cachedAt: number
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Cache) : null
  } catch { return null }
}

function writeCache(data: Cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

/** Maps Monday status index → semantic colour bucket */
export function statusColor(index: number | null): string {
  if (index === null) return "slate"
  if (index === 1) return "green"   // Done
  if (index === 2) return "blue"    // In Progress / Working on it
  if (index === 4) return "amber"   // Stuck
  if (index === 5) return "purple"  // Review
  return "slate"
}

/** Maps priority label → colour */
export function priorityColor(label: string | null): string {
  if (!label) return "slate"
  const l = label.toLowerCase()
  if (l.includes("critical") || l.includes("high")) return "red"
  if (l.includes("medium")) return "amber"
  if (l.includes("low")) return "green"
  return "slate"
}

export function useMondayTasks(): MondayTasksResult {
  const cached = readCache()
  const [user, setUser]       = useState<MondayUser | null>(cached?.user ?? null)
  const [tasks, setTasks]     = useState<MondayTask[]>(cached?.tasks ?? [])
  const [loading, setLoading] = useState(!cached)
  const [syncing, setSyncing] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [tick, setTick]       = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    const cache = readCache()
    const fresh = cache && Date.now() - cache.cachedAt < REVALIDATE_MS && tick === 0
    if (fresh) return // cache is recent enough, skip fetch

    let cancelled = false

    async function load() {
      if (tick > 0) localStorage.removeItem(CACHE_KEY)
      if (cache) setSyncing(true); else setLoading(true)
      setError(null)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email ?? ""

        // When the user explicitly hits Refresh (tick > 0), bust the server cache too
        const url = tick > 0
          ? `/api/monday/tasks?email=${encodeURIComponent(email)}&bust=1`
          : `/api/monday/tasks?email=${encodeURIComponent(email)}`

        const res = await fetch(url, { headers: { Accept: "application/json" } })

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }

        const body = await res.json() as { user: MondayUser | null; tasks: MondayTask[] }

        if (!cancelled) {
          setUser(body.user)
          setTasks(body.tasks)
          writeCache({ user: body.user, tasks: body.tasks, cachedAt: Date.now() })
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        if (!cancelled) { setLoading(false); setSyncing(false) }
      }
    }

    load()
    return () => { cancelled = true }
  }, [tick])

  return { user, tasks, loading, syncing, error, refetch }
}
