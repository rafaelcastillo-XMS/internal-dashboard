import type { CalendarEvent, GoogleCalendarEvent } from "./types"

export const GCAL_COLORS: Record<string, string> = {
    "1": "bg-blue-500",
    "2": "bg-green-600",
    "3": "bg-purple-500",
    "4": "bg-red-500",
    "5": "bg-yellow-500",
    "6": "bg-orange-500",
    "7": "bg-teal-500",
    "8": "bg-gray-500",
    "9": "bg-blue-700",
    "10": "bg-green-700",
    "11": "bg-red-700",
}

const FALLBACK_COLORS = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-teal-500"]

export function mapGoogleCalendarEvent(event: GoogleCalendarEvent, index: number): CalendarEvent {
    const startValue = event.start?.dateTime ?? event.start?.date ?? ""
    return {
        id: event.id,
        title: event.summary ?? "(No title)",
        date: startValue.slice(0, 10),
        time: event.start?.dateTime
            ? new Date(event.start.dateTime).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            })
            : "All day",
        type: "meeting",
        color: GCAL_COLORS[event.colorId ?? ""] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    }
}

export function formatIsoDate(date: Date): string {
    return date.toISOString().split("T")[0]
}

export function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)
}
