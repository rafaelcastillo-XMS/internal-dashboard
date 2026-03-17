import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { endOfMonth, mapGoogleCalendarEvent, startOfMonth } from "./model"
import type { CalendarEvent, GoogleCalendarResponse } from "./types"
import { useTrackPageLoading } from "@/context/PageLoadingContext"

type UseCalendarEventsOptions = {
    monthDate: Date
    monthSpan?: number
}

export function useCalendarEvents({ monthDate, monthSpan = 1 }: UseCalendarEventsOptions) {
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth()}-${monthSpan}`

    useTrackPageLoading(loading, `calendar:${monthKey}`)

    useEffect(() => {
        let cancelled = false

        async function fetchCalendarEvents() {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session || cancelled) return

            setLoading(true)
            setError(null)

            try {
                const firstMonth = startOfMonth(monthDate)
                const lastMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + monthSpan - 1, 1)
                const { data, error: invokeError } = await supabase.functions.invoke("google-calendar", {
                    body: {
                        timeMin: firstMonth.toISOString(),
                        timeMax: endOfMonth(lastMonth).toISOString(),
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
    }, [monthDate.getFullYear(), monthDate.getMonth(), monthSpan])

    return { events, loading, error }
}
