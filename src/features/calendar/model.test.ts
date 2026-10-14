import { afterAll, describe, expect, it } from "vitest"
import { mapGoogleCalendarEvent } from "./model"

const originalTimezone = process.env.TZ
afterAll(() => {
  if (originalTimezone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimezone
})

describe("calendar event dates", () => {
  it("uses the same local timezone for a timed event's day and hour", () => {
    process.env.TZ = "America/Bogota"
    const event = mapGoogleCalendarEvent({
      id: "utc-event", start: { dateTime: "2026-10-15T02:30:00Z" },
      end: { dateTime: "2026-10-15T03:30:00Z" },
    }, 0)
    expect(event.date).toBe("2026-10-14")
    expect(event.time).toBe("9:30 PM")
    expect(event.endTime).toBe("10:30 PM")
  })

  it("does not apply a timezone offset to an all-day event", () => {
    process.env.TZ = "America/Bogota"
    const event = mapGoogleCalendarEvent({ id: "all-day", start: { date: "2026-10-14" }, end: { date: "2026-10-15" } }, 0)
    expect(event.date).toBe("2026-10-14")
    expect(event.time).toBe("All day")
    expect(event.startDateTime).toBeNull()
    expect(event.endDateTime).toBeNull()
  })
})
