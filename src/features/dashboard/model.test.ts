import { afterAll, describe, expect, it } from "vitest"
import { mapGoogleCalendarEvent } from "@/features/calendar/model"
import type { MondayTask } from "@/features/tasks/useMondayTasks"
import { buildPerfData, dueDaysFromToday, isEventPast, parseLocalDate } from "./model"

const originalTimezone = process.env.TZ
afterAll(() => {
  if (originalTimezone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimezone
})

function task(updatedAt: string, statusIndex: number | null): MondayTask {
  return { id: updatedAt, name: "Test task", board: "Tasks", status: "", statusIndex,
    priority: null, priorityIndex: null, dueDate: null, updatedAt }
}

describe.each(["America/Bogota", "Asia/Tokyo", "America/New_York"])("dashboard dates in %s", timezone => {
  it("keeps date-only labels and due days in the user's calendar", () => {
    process.env.TZ = timezone
    expect(parseLocalDate("2026-10-14").getDate()).toBe(14)
    expect(parseLocalDate("2026-10-14").getHours()).toBe(0)
    const now = new Date(2026, 9, 14, 23, 59)
    expect(dueDaysFromToday("2026-10-14", now)).toBe(0)
    expect(dueDaysFromToday("2026-10-13", now)).toBe(-1)
    expect(dueDaysFromToday("2026-10-15", now)).toBe(1)
  })

  it("counts calendar days across daylight-saving changes", () => {
    process.env.TZ = timezone
    expect(dueDaysFromToday("2026-03-09", new Date(2026, 2, 7, 23))).toBe(2)
    expect(dueDaysFromToday("2026-11-02", new Date(2026, 9, 31, 23))).toBe(2)
  })

  it("places Sunday midnight updates in exactly one local week", () => {
    process.env.TZ = timezone
    const data = buildPerfData([
      task(new Date(2026, 9, 10, 23, 59, 59).toISOString(), 1),
      task(new Date(2026, 9, 11, 0, 0, 0).toISOString(), 2),
      task(new Date(2026, 9, 12).toISOString(), 4),
      task(new Date(2026, 8, 5).toISOString(), 1),
      task("invalid", 1),
    ], new Date(2026, 9, 14))
    expect(data).toHaveLength(6)
    expect(data[0].date).toBe("2026-09-06")
    expect(data[4]).toEqual({ date: "2026-10-04", done: 1, open: 0 })
    expect(data[5]).toEqual({ date: "2026-10-11", done: 0, open: 2 })
    expect(data.reduce((total, row) => total + row.done + row.open, 0)).toBe(3)
  })
})

describe("event progress", () => {
  it("does not mark all-day events as past at midnight", () => {
    const event = mapGoogleCalendarEvent({ id: "all-day", start: { date: "2026-10-14" }, end: { date: "2026-10-15" } }, 0)
    expect(isEventPast(event, new Date("2026-10-14T20:00:00Z"))).toBe(false)
  })

  it("keeps ongoing meetings active until they end", () => {
    const event = mapGoogleCalendarEvent({ id: "meeting", start: { dateTime: "2026-10-14T14:00:00Z" }, end: { dateTime: "2026-10-14T15:00:00Z" } }, 0)
    expect(isEventPast(event, new Date("2026-10-14T14:30:00Z"))).toBe(false)
    expect(isEventPast(event, new Date("2026-10-14T15:00:00Z"))).toBe(true)
  })
})
