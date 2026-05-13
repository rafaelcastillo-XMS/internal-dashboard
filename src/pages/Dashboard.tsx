import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  AlertCircle,
  BarChart2,
  Calendar,
  CalendarCheck,
  CheckSquare,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { formatIsoDate } from "@/features/calendar/model"
import { useCalendarEvents } from "@/features/calendar/useCalendarEvents"
import { useMondayTasks, statusColor, type MondayTask } from "@/features/tasks/useMondayTasks"

// ─── Task Performance chart ────────────────────────────────────────────────────
function buildPerfData(tasks: MondayTask[]) {
  const now = new Date()
  // Build the last 4 Sunday-to-Saturday week buckets
  return Array.from({ length: 4 }, (_, w) => {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay() - (3 - w) * 7)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    const bucket = tasks.filter(t => {
      const d = new Date(t.updatedAt)
      return d >= start && d <= end
    })

    return {
      date: start.toISOString().split("T")[0],
      done: bucket.filter(t => t.statusIndex === 1).length,
      open: bucket.filter(t => t.statusIndex !== 1).length,
    }
  })
}

const perfChartConfig = {
  views: { label: "Tasks" },
  done: { label: "Completed", color: "var(--chart-2)" },
  open: { label: "In Progress", color: "var(--chart-1)" },
} satisfies ChartConfig

// ─── Status chip colour map ────────────────────────────────────────────────────
const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
  green: { bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
  blue: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  amber: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  purple: { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500" },
  red: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  slate: { bg: "bg-slate-100 dark:bg-slate-700/40", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" },
}

function MiniStatusChip({ label, index }: { label: string; index: number | null }) {
  const c = colorMap[statusColor(index)] ?? colorMap.slate
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {label}
    </span>
  )
}

function MiniDueBadge({ date }: { date: string | null }) {
  if (!date) return null
  const due = new Date(date)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  let cls = "text-slate-400 dark:text-slate-500"
  if (diff < 0) cls = "text-red-500 dark:text-red-400"
  else if (diff <= 2) cls = "text-amber-500 dark:text-amber-400"
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${cls}`}>
      <Clock className="h-2.5 w-2.5" />
      {diff < 0 ? `${-diff}d late` : diff === 0 ? "Today" : `${diff}d`}
    </span>
  )
}

const MONDAY_LOGO = "https://dapulse-res.cloudinary.com/image/upload/f_auto,q_auto/remote_mondaycom_static/uploads/product/monday-logo.png"

const panelClass = "rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
const panelHeaderClass = "flex items-center justify-between gap-3 border-b border-stroke px-6 py-5 dark:border-strokedark"
const panelBodyClass = "px-6 py-5"
const surfaceClass = "rounded-lg border border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4/35"


export function Dashboard() {
  const [today] = useState(() => new Date())
  const todayStr = formatIsoDate(today)
  const navigate = useNavigate()
  const { events, loading: loadingEvents } = useCalendarEvents({
    monthDate: today,
    monthSpan: 2,
  })
  const { tasks, loading: loadingTasks, syncing: syncingTasks, error: tasksError, user: mondayUser } = useMondayTasks()

  // Show the 5 most recent non-done tasks in the widget
  const widgetTasks = tasks
    .filter(t => t.statusIndex !== 1) // exclude "Done"
    .slice(0, 5)
  const doneCount = tasks.filter(t => t.statusIndex === 1).length

  const [syncTime, setSyncTime] = useState<Date | null>(null)
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    if (!loadingTasks) setSyncTime(new Date())
  }, [loadingTasks])
  useEffect(() => {
    const id = setInterval(() => forceUpdate(n => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  const syncLabel = loadingTasks
    ? "Syncing…"
    : syncTime
      ? (() => {
        const diff = Math.round((Date.now() - syncTime.getTime()) / 1000)
        if (diff < 60) return "Just now"
        if (diff < 3600) return `${Math.round(diff / 60)}m ago`
        return `${Math.round(diff / 3600)}h ago`
      })()
      : "—"

  const [activePerfMetric, setActivePerfMetric] = useState<"done" | "open">("done")
  const performanceData = useMemo(() => buildPerfData(tasks), [tasks])
  const perfTotals = useMemo(() => ({
    done: performanceData.reduce((acc, d) => acc + d.done, 0),
    open: performanceData.reduce((acc, d) => acc + d.open, 0),
  }), [performanceData])

  const todayTasks = useMemo(() => tasks.filter(t => t.dueDate === todayStr && t.statusIndex !== 1), [tasks, todayStr])
  const overdueTasks = useMemo(() => tasks.filter(t => t.dueDate && t.dueDate < todayStr && t.statusIndex !== 1), [tasks, todayStr])

  const thisWeekEvents = useMemo(() => {
    const start = new Date(today)
    start.setDate(today.getDate() - today.getDay())
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const startStr = formatIsoDate(start)
    const endStr = formatIsoDate(end)
    return events
      .filter(e => e.date >= startStr && e.date <= endStr)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  }, [events, today])

  const upcomingCount = thisWeekEvents.length
  const perfPct = useMemo(() => {
    const total = perfTotals.done + perfTotals.open
    return total > 0 ? Math.round((perfTotals.done / total) * 100) : 0
  }, [perfTotals])


  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="mx-auto max-w-screen-2xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">
              Welcome, {mondayUser?.name?.split(" ")[0] ?? "there"}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1">
              <span className="flex items-center gap-1.5 text-sm text-body dark:text-bodydark">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-[#1A72D9]" />
                Today is{" "}
                {new Intl.DateTimeFormat("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }).format(today)}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-body dark:text-bodydark">
                <RefreshCw className={`h-3.5 w-3.5 shrink-0 text-[#1A72D9] ${loadingTasks || syncingTasks ? "animate-spin" : ""}`} />
                Last sync:{" "}
                <span className="font-bold text-black dark:text-white">{syncLabel}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Summary cards ─────────────────────────────────────────────── */}
        <div className="mb-6">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className={`${panelClass} flex h-[440px] flex-col overflow-hidden`}
            aria-label="Weekly calendar"
          >
            <div className={panelHeaderClass}>
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                  <Calendar className="h-4 w-4 text-[#1A72D9]" />
                  This Week
                  {loadingEvents && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1A72D9] ml-2" />}
                </h2>
                <p className="mt-0.5 text-xs text-body dark:text-bodydark">
                  Weekly overview of scheduled activities
                </p>
              </div>
              <button
                onClick={() => navigate("/calendar")}
                className="flex items-center gap-1 text-xs font-medium text-body transition-colors hover:text-[#1A72D9] dark:text-bodydark dark:hover:text-white"
              >
                Full view
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            {/* Unified calendar grid: header + events share the same columns */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-stroke dark:border-strokedark">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-stroke dark:border-strokedark">
                {Array.from({ length: 7 }).map((_, i) => {
                  const currentDayOfWeek = today.getDay()
                  const startOfWeek = new Date(today)
                  startOfWeek.setDate(today.getDate() - currentDayOfWeek + i)
                  const dateStr = formatIsoDate(startOfWeek)
                  const isCurrentDay = dateStr === todayStr

                  const dayOfWeek = startOfWeek.getDay()
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                  return (
                    <div key={i} className={`border-r border-stroke p-2 text-center last:border-r-0 dark:border-strokedark ${isCurrentDay ? "bg-[#EEF5FE] dark:bg-[#1A72D9]/10" : isWeekend ? "bg-[#F7F8FA] dark:bg-[#1D2A39]" : "bg-white dark:bg-boxdark"}`}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-body dark:text-bodydark">
                        {new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(startOfWeek)}
                      </p>
                      <p className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${isCurrentDay ? "bg-[#1A72D9] text-white shadow-sm" : "text-black dark:text-white"}`}>
                        {startOfWeek.getDate()}
                      </p>
                    </div>
                  )
                })}
              </div>
              {/* Events area with bottom fade hint */}
              <div className="relative min-h-0 flex-1">
                <div className="absolute inset-0 overflow-y-auto no-scrollbar">
                  <div className="grid grid-cols-7 min-h-full">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const currentDayOfWeek = today.getDay()
                      const startOfWeek = new Date(today)
                      startOfWeek.setDate(today.getDate() - currentDayOfWeek + i)
                      const dateStr = formatIsoDate(startOfWeek)
                      const isCurrentDay = dateStr === todayStr

                      const dayOfWeek = startOfWeek.getDay()
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                      const dayEvents = events.filter((e) => e.date === dateStr)
                      return (
                        <div
                          key={i}
                          className={`min-h-full space-y-1.5 border-r border-stroke p-1.5 last:border-r-0 dark:border-strokedark ${isCurrentDay
                              ? "bg-[#EEF5FE] dark:bg-[#1A72D9]/10"
                              : isWeekend
                                ? "bg-[#F7F8FA] dark:bg-[#1D2A39]"
                                : "bg-white dark:bg-boxdark"
                            }`}
                        >
                          {dayEvents.length === 0 ? (
                            <div className="flex justify-center pt-4">
                              <span className="h-1 w-1 rounded-full bg-stroke dark:bg-strokedark" />
                            </div>
                          ) : (
                            dayEvents.map((event) => (
                              <div
                                key={event.id}
                                className={`${surfaceClass} group relative cursor-pointer overflow-hidden p-2 transition-colors hover:bg-gray dark:hover:bg-meta-4/60`}
                              >
                                <div className={`absolute bottom-0 left-0 top-0 w-[3px] ${event.color || "bg-[#1A72D9]"}`} />
                                <div className="pl-2">
                                  <p className="truncate text-[11px] font-semibold leading-tight text-black dark:text-white">
                                    {event.title}
                                  </p>
                                  <p className="mt-1 flex items-center gap-0.5 text-[10px] text-body dark:text-bodydark">
                                    <Clock className="h-2.5 w-2.5 shrink-0" />
                                    {event.time}
                                  </p>
                                  {event.type && (
                                    <span className="mt-1 inline-block rounded-sm bg-stroke/70 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-body dark:bg-strokedark dark:text-bodydark">
                                      {event.type}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </div>


        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">

          {/* What do I need to do today? */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}
            className={`${panelClass} flex flex-col p-5`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1A72D9]/10">
                <CalendarCheck className="h-5 w-5 text-[#1A72D9]" />
              </span>
              <p className="text-xs font-semibold text-body dark:text-bodydark leading-tight">What do I need to do today?</p>
            </div>
            <p className="mt-4 text-4xl font-bold tabular-nums text-black dark:text-white">
              {loadingTasks ? "—" : todayTasks.length}
            </p>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">pending tasks</p>
            <button onClick={() => navigate("/tasks")} className="mt-auto pt-4 text-left text-xs font-semibold text-[#1A72D9] hover:underline">
              View my tasks →
            </button>
          </motion.div>

          {/* What meetings/events are coming? */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}
            className={`${panelClass} flex flex-col p-5`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10">
                <Calendar className="h-5 w-5 text-purple-500" />
              </span>
              <p className="text-xs font-semibold text-body dark:text-bodydark leading-tight">What meetings/events are coming?</p>
            </div>
            <p className="mt-4 text-4xl font-bold tabular-nums text-black dark:text-white">
              {loadingEvents ? "—" : upcomingCount}
            </p>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">events this week</p>
            {thisWeekEvents.length > 0 && (
              <ul className="mt-3 max-h-24 space-y-1 overflow-y-auto">
                {thisWeekEvents.map(e => (
                  <li key={e.id} className="flex items-center gap-1.5 text-[11px] text-body dark:text-bodydark">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${e.color || "bg-purple-400"}`} />
                    <span className="shrink-0 tabular-nums text-[10px] font-medium text-black dark:text-white">{e.time}</span>
                    <span className="truncate">{e.title}</span>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => navigate("/calendar")} className="mt-auto pt-3 text-left text-xs font-semibold text-purple-500 hover:underline">
              View calendar →
            </button>
          </motion.div>

          {/* What's overdue? */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }}
            className={`${panelClass} flex flex-col p-5`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </span>
              <p className="text-xs font-semibold text-body dark:text-bodydark leading-tight">What's overdue?</p>
            </div>
            <p className="mt-4 text-4xl font-bold tabular-nums text-black dark:text-white">
              {loadingTasks ? "—" : overdueTasks.length}
            </p>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">overdue tasks</p>
            {overdueTasks.length > 0 && (
              <ul className="mt-3 max-h-24 space-y-1 overflow-y-auto">
                {overdueTasks.map(t => (
                  <li key={t.id} className="flex items-center gap-1.5 text-[11px] text-body dark:text-bodydark">
                    <AlertCircle className="h-3 w-3 shrink-0 text-red-400" />
                    <span className="truncate">{t.name}</span>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => navigate("/tasks")} className="mt-auto pt-3 text-left text-xs font-semibold text-amber-500 hover:underline">
              View overdue tasks →
            </button>
          </motion.div>

          {/* How am I performing? */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.2 }}
            className={`${panelClass} flex flex-col p-5`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#16a34a]/10">
                <TrendingUp className="h-5 w-5 text-[#16a34a]" />
              </span>
              <p className="text-xs font-semibold text-body dark:text-bodydark leading-tight">How am I performing?</p>
            </div>
            <p className="mt-4 text-4xl font-bold tabular-nums text-black dark:text-white">
              {loadingTasks ? "—" : `${perfPct}%`}
            </p>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">completed last 4 weeks</p>
            <p className="mt-1.5 text-xs text-[#16a34a] font-semibold">
              {loadingTasks ? "" : `${perfTotals.done} completed · ${perfTotals.open} in progress`}
            </p>
            <button
              onClick={() => document.querySelector('[aria-label="Task performance"]')?.scrollIntoView({ behavior: "smooth" })}
              className="mt-auto pt-3 text-left text-xs font-semibold text-[#16a34a] hover:underline"
            >
              View metrics →
            </button>
          </motion.div>
        </div>


        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.28 }}
            className={`${panelClass} xl:col-span-2 overflow-hidden flex flex-col`}
            aria-label="My Tasks"
          >
            <div className="flex flex-col items-stretch border-b border-stroke dark:border-strokedark sm:flex-row">
              <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                  <CheckSquare className="h-4 w-4 text-[#1A72D9]" />
                  My Tasks
                </h2>
                <p className="text-xs text-body dark:text-bodydark truncate">
                  {loadingTasks ? "Loading…" : mondayUser ? `${mondayUser.name} · ${tasks.length} assigned` : "monday.com"}
                </p>
              </div>
              {/* Metric display */}
              {!loadingTasks && !tasksError && mondayUser && (
                <div className="flex border-t border-stroke dark:border-strokedark sm:border-t-0">
                  {([
                    { key: "done", label: "Done", value: doneCount },
                    { key: "open", label: "Open", value: widgetTasks.length },
                  ] as const).map(({ key, label, value }) => (
                    <div
                      key={key}
                      className="flex flex-1 flex-col justify-center gap-0.5 border-l border-stroke dark:border-strokedark px-6 py-4 sm:px-8"
                    >
                      <span className="text-[11px] text-body dark:text-bodydark">{label}</span>
                      <span className="text-2xl font-bold tabular-nums text-black dark:text-white">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loadingTasks && (
                <div className="flex items-center justify-center py-10 gap-2 text-body dark:text-bodydark">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Loading tasks…</span>
                </div>
              )}

              {!loadingTasks && tasksError && (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-4">
                  <AlertCircle className="h-6 w-6 text-red-400" />
                  <p className="text-xs text-body dark:text-bodydark">{tasksError}</p>
                </div>
              )}

              {!loadingTasks && !tasksError && !mondayUser && (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-4">
                  <Circle className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs text-body dark:text-bodydark">No monday.com account matched your email.</p>
                </div>
              )}

              {!loadingTasks && !tasksError && mondayUser && widgetTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-4">
                  <CheckSquare className="h-6 w-6 text-meta-3" />
                  <p className="text-xs font-medium text-black dark:text-white">All caught up!</p>
                  <p className="text-[11px] text-body dark:text-bodydark">No open tasks assigned to you.</p>
                </div>
              )}

              {!loadingTasks && !tasksError && mondayUser && widgetTasks.length > 0 && (
                <div className="divide-y divide-stroke dark:divide-strokedark">
                  {widgetTasks.map(task => (
                    <div key={task.id}
                      className="flex items-center gap-3 px-6 py-3 hover:bg-gray-2 dark:hover:bg-meta-4/20 transition-colors group cursor-default">
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-semibold text-black dark:text-white">{task.name}</p>
                        <p className="mt-0.5 truncate text-[10px] text-body dark:text-bodydark">{task.board}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <MiniDueBadge date={task.dueDate} />
                        <MiniStatusChip label={task.status} index={task.statusIndex} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer CTA */}
            {!loadingTasks && mondayUser && (
              <div className="border-t border-stroke dark:border-strokedark px-6 py-3">
                <button
                  onClick={() => navigate("/tasks")}
                  className="text-xs font-medium text-[#1A72D9] hover:text-[#1560c0] transition-colors"
                >
                  View all tasks →
                </button>
              </div>
            )}
          </motion.section>


          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.33 }}
            className={`${panelClass} xl:col-span-2 overflow-hidden flex flex-col`}
            aria-label="Task performance"
          >
            {/* Interactive header with metric toggles */}
            <div className="flex flex-col items-stretch border-b border-stroke dark:border-strokedark sm:flex-row">
              <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                  <BarChart2 className="h-4 w-4 text-[#1A72D9]" />
                  Task Performance
                </h2>
                <p className="text-xs text-body dark:text-bodydark">Last 4 weeks · click a metric to explore</p>
              </div>
              <div className="flex border-t border-stroke dark:border-strokedark sm:border-t-0">
                {(["done", "open"] as const).map((key) => (
                  <button
                    key={key}
                    data-active={activePerfMetric === key}
                    onClick={() => setActivePerfMetric(key)}
                    className="relative flex flex-1 flex-col justify-center gap-0.5 border-l border-stroke dark:border-strokedark px-6 py-4 text-left transition-colors hover:bg-gray-2 dark:hover:bg-meta-4/20 data-[active=true]:bg-[#1A72D9]/5 dark:data-[active=true]:bg-[#1A72D9]/10 sm:px-8"
                  >
                    <span className="text-[11px] text-body dark:text-bodydark whitespace-nowrap">
                      {perfChartConfig[key].label}
                    </span>
                    <span className="text-2xl font-bold tabular-nums text-black dark:text-white">
                      {perfTotals[key]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 flex flex-col px-2 pt-4 pb-3 sm:px-6 sm:pt-5 min-h-0">
              <ChartContainer config={perfChartConfig} className="flex-1 w-full min-h-0">
                <BarChart accessibilityLayer data={performanceData} margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    }
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    allowDecimals={false}
                    domain={[0, 8]}
                    ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8]}
                    width={24}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="w-[160px]"
                        nameKey="views"
                        labelFormatter={(value) =>
                          new Date(value).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })
                        }
                      />
                    }
                  />
                  <Bar
                    dataKey={activePerfMetric}
                    fill={`var(--color-${activePerfMetric})`}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          </motion.section>
        </div>

      </div>
    </div>
  )
}
