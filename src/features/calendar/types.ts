export interface GoogleCalendarEvent {
    id: string
    summary?: string
    colorId?: string
    start?: {
        date?: string
        dateTime?: string
    }
}

export interface GoogleCalendarResponse {
    error?: { message?: string } | string
    items?: GoogleCalendarEvent[]
}

export interface CalendarEvent {
    id: string
    date: string
    time: string
    title: string
    type: string
    color: string
}
