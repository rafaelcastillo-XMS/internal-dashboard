export interface GoogleCalendarEvent {
    id: string
    summary?: string
    description?: string
    colorId?: string
    hangoutLink?: string
    conferenceData?: {
        entryPoints?: Array<{
            entryPointType?: string
            uri?: string
        }>
    }
    start?: {
        date?: string
        dateTime?: string
    }
    end?: {
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
    endTime: string | null
    title: string
    description: string | null
    meetLink: string | null
    type: string
    color: string
}
