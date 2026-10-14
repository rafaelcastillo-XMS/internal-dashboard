import { formatIsoDate } from "@/features/calendar/model"
import type { CalendarEvent } from "@/features/calendar/types"
import type { MondayTask } from "@/features/tasks/useMondayTasks"

export function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

export function dueDaysFromToday(value: string, now: Date): number {
  const due = parseLocalDate(value)
  // Compare calendar days independently of timezone offsets and DST.
  return (Date.UTC(due.getFullYear(), due.getMonth(), due.getDate())
    - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000
}

export function isEventPast(event: CalendarEvent, now: Date): boolean {
  // All-day events remain active throughout their calendar day.
  const end = event.endDateTime ?? event.startDateTime
  return end ? new Date(end).getTime() <= now.getTime() : false
}

export function buildPerfData(tasks: MondayTask[], now: Date) {
  return Array.from({ length: 6 }, (_, w) => {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay() - (5 - w) * 7)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    const bucket = tasks.filter(task => {
      const updated = new Date(task.updatedAt)
      return updated >= start && updated < end
    })
    return {
      date: formatIsoDate(start),
      done: bucket.filter(task => task.statusIndex === 1).length,
      open: bucket.filter(task => task.statusIndex !== 1).length,
    }
  })
}
