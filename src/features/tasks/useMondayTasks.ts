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
  error: string | null
  refetch: () => void
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
  const [user, setUser] = useState<MondayUser | null>(null)
  const [tasks, setTasks] = useState<MondayTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email ?? ""

        const res = await fetch(
          `/api/monday/tasks?email=${encodeURIComponent(email)}`,
          { headers: { Accept: "application/json" } },
        )

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }

        const body = await res.json() as { user: MondayUser | null; tasks: MondayTask[] }

        if (!cancelled) {
          setUser(body.user)
          setTasks(body.tasks)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [tick])

  return { user, tasks, loading, error, refetch }
}
