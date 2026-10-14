import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { mapGoogleCalendarEvent } from "./model"
import type { CalendarEvent, GoogleCalendarResponse } from "./types"
import { useTrackPageLoading } from "@/context/PageLoadingContext"

type UseCalendarEventsOptions = {
    monthDate: Date
    monthSpan?: number
}

export function useCalendarEvents({ monthDate, monthSpan = 1 }: UseCalendarEventsOptions) {
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const monthKey = `${year}-${month}-${monthSpan}`
    const [revision, setRevision] = useState(0)
    const refetch = useCallback(() => setRevision(value => value + 1), [])

    useTrackPageLoading(loading, `calendar:${monthKey}`)

    useEffect(() => {
        let cancelled = false

        async function fetchCalendarEvents() {
            setLoading(true)
            setError(null)

            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession()
                if (cancelled) return
                if (sessionError) throw sessionError
                if (!session) throw new Error("Sign in to load your calendar.")
                const firstMonth = new Date(year, month, 1)
                // Google Calendar's upper bound is exclusive.
                const nextMonth = new Date(year, month + monthSpan, 1)
                const { data, error: invokeError } = await supabase.functions.invoke("google-calendar", {
                    body: {
                        timeMin: firstMonth.toISOString(),
                        timeMax: nextMonth.toISOString(),
                    },
                })

                if (invokeError) throw invokeError

                const payload = (data ?? {}) as GoogleCalendarResponse
                if (payload.error) {
                    throw new Error(typeof payload.error === "string" ? payload.error : payload.error.message ?? "Unknown calendar error")
                }

                const nextEvents = (payload.items ?? []).map(mapGoogleCalendarEvent)
                if (!cancelled) {
                    setEvents(nextEvents)
                }
            } catch (err) {
                let message = err instanceof Error ? err.message : String(err)
                const context = (err as { context?: { status: number; text: () => Promise<string> } }).context
                if (context) {
                    try {
                        const body = await context.text()
                        message = `HTTP ${context.status} - ${body}`
                    } catch {
                        // Preserve the original message if the body cannot be read.
                    }
                }

                if (!cancelled) {
                    setError(message)
                    setEvents([])
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        fetchCalendarEvents()

        return () => {
            cancelled = true
        }
    }, [year, month, monthSpan, revision])

    return { events, loading, error, refetch }
}
