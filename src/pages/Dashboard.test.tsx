import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { ReactNode } from "react"
import type { MondayTasksResult } from "@/features/tasks/useMondayTasks"
import { Dashboard } from "./Dashboard"

const state = vi.hoisted(() => ({
  calendar: { events: [], loading: false, error: null as string | null, refetch: vi.fn() },
  monday: { tasks: [], user: null, loading: false, syncing: false, error: null, refetch: vi.fn() } as MondayTasksResult,
}))

vi.mock("@/features/calendar/useCalendarEvents", () => ({ useCalendarEvents: () => state.calendar }))
vi.mock("@/features/tasks/useMondayTasks", () => ({ useMondayTasks: () => state.monday, priorityColor: () => "slate" }))
vi.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }))

beforeEach(() => {
  state.calendar.error = null
  state.monday.error = null
  state.monday.tasks = []
})

describe("dashboard data states", () => {
  it("shows a calendar error and retry instead of an empty agenda", () => {
    state.calendar.error = "Provider unavailable"
    const html = renderToStaticMarkup(<Dashboard />)
    expect(html).toContain("Could not load your calendar.")
    expect(html).toContain("Retry calendar")
    expect(html).not.toContain("No events today")
    expect(html).not.toContain("No events scheduled for today")
  })

  it("does not present a failed task request as zero tasks or zero performance", () => {
    state.monday.error = "Provider unavailable"
    const html = renderToStaticMarkup(<Dashboard />)
    expect(html).toContain("Could not load your tasks.")
    expect(html).toContain("Retry tasks")
    expect(html).toContain("Task performance is unavailable")
    expect(html).not.toContain("No pending tasks")
    expect(html).not.toContain(">0%</span>")
  })

  it("retains cached tasks with an explicit stale-data notice", () => {
    state.monday.error = "Provider unavailable"
    state.monday.tasks = [{ id: "123", name: "Previously loaded task", board: "Tasks", status: "Working", statusIndex: 2,
      priority: null, priorityIndex: null, dueDate: null, updatedAt: "2026-10-14T12:00:00Z" }]
    const html = renderToStaticMarkup(<Dashboard />)
    expect(html).toContain("Showing previously loaded data.")
    expect(html).toContain("Previously loaded task")
    expect(html).toContain('href="/tasks/123"')
  })

  it("keeps genuine empty states when providers return no records", () => {
    const html = renderToStaticMarkup(<Dashboard />)
    expect(html).toContain("No events today")
    expect(html).toContain("No pending tasks")
    expect(html).not.toContain('role="alert"')
  })
})
