import { useState, useEffect, useMemo, useRef } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Layers3,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { formatIsoDate } from "@/features/calendar/model"
import { useCalendarEvents } from "@/features/calendar/useCalendarEvents"
import { useMondayTasks, priorityColor, type MondayTask } from "@/features/tasks/useMondayTasks"

function buildPerfData(tasks: MondayTask[]) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, w) => {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay() - (5 - w) * 7)
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

const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
  green:  { bg: "bg-green-50 dark:bg-green-900/20",   text: "text-green-700 dark:text-green-400",   dot: "bg-green-500"  },
  blue:   { bg: "bg-blue-50 dark:bg-blue-900/20",     text: "text-blue-700 dark:text-blue-400",     dot: "bg-blue-500"   },
  amber:  { bg: "bg-amber-50 dark:bg-amber-900/20",   text: "text-amber-700 dark:text-amber-400",   dot: "bg-amber-500"  },
  red:    { bg: "bg-red-50 dark:bg-red-900/20",       text: "text-red-700 dark:text-red-400",       dot: "bg-red-500"    },
  slate:  { bg: "bg-slate-100 dark:bg-slate-700/40",  text: "text-slate-600 dark:text-slate-400",   dot: "bg-slate-400"  },
}

function MiniDueBadge({ date }: { date: string | null }) {
  if (!date) return null
  const due = new Date(date)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  let cls = "text-slate-400 dark:text-slate-500"
  if (diff < 0)      cls = "text-red-500 dark:text-red-400"
  else if (diff <= 2) cls = "text-amber-500 dark:text-amber-400"
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${cls}`}>
      <Clock className="h-2.5 w-2.5" />
      {diff < 0 ? `${-diff}d late` : diff === 0 ? "Today" : `${diff}d`}
    </span>
  )
}

function MiniPriorityChip({ label }: { label: string | null }) {
  if (!label) return null
  const c = colorMap[priorityColor(label)] ?? colorMap.slate
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {label}
    </span>
  )
}

function parseTimeMinutes(timeStr: string): number {
  const ampm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampm) {
    let h = parseInt(ampm[1])
    const m = parseInt(ampm[2])
    const p = ampm[3].toUpperCase()
    if (p === "PM" && h !== 12) h += 12
    if (p === "AM" && h === 12) h = 0
    return h * 60 + m
  }
  const h24 = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (h24) return parseInt(h24[1]) * 60 + parseInt(h24[2])
  return 0
}

function isEventPast(timeStr: string): boolean {
  const now = new Date()
  return parseTimeMinutes(timeStr) < now.getHours() * 60 + now.getMinutes()
}

function priorityRank(p: string | null): number {
  const l = p?.toLowerCase() ?? ""
  if (l.includes("critical")) return 0
  if (l.includes("high"))     return 1
  if (l.includes("medium"))   return 2
  if (l.includes("low"))      return 3
  return 4
}

function useSlider() {
  const ref = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const check = () => {
    const el = ref.current
    if (!el) return
    setCanPrev(el.scrollLeft > 2)
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }

  const scrollPrev = () => ref.current?.scrollBy({ left: -(ref.current.clientWidth / 4), behavior: "smooth" })
  const scrollNext = () => ref.current?.scrollBy({ left:  ref.current.clientWidth / 4,  behavior: "smooth" })

  return { ref, canPrev, canNext, check, scrollPrev, scrollNext }
}

const sliderArrowClass =
  "flex h-7 w-7 items-center justify-center rounded-full border border-stroke bg-white text-body transition hover:bg-gray-2 disabled:opacity-30 dark:border-strokedark dark:bg-boxdark dark:text-bodydark"

const guidelineLinks = [
  { title: "Prompt Library", subtitle: "Reusable AI prompts", icon: Sparkles, color: "blue" },
  { title: "Company Skills", subtitle: "Repo inventory", icon: Layers3, color: "green" },
  { title: "Guidelines", subtitle: "Team playbook", icon: BookOpen, color: "amber" },
  { title: "Skill Capture", subtitle: "Approval and error logs", icon: CheckSquare, color: "slate" },
] as const

export function Dashboard() {
  const [today] = useState(() => new Date())
  const todayStr = formatIsoDate(today)

  const { events, loading: loadingEvents } = useCalendarEvents({ monthDate: today, monthSpan: 2 })
  const { tasks, loading: loadingTasks, syncing: syncingTasks, user: mondayUser } = useMondayTasks()

  // Force re-render every 30s to keep relative timestamps fresh
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceUpdate(n => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const todayTasks = useMemo(
    () => tasks.filter(t => t.dueDate === todayStr && t.statusIndex !== 1),
    [tasks, todayStr]
  )

  const todayEvents = useMemo(() =>
    events
      .filter(e => e.date === todayStr)
      .sort((a, b) => parseTimeMinutes(a.time) - parseTimeMinutes(b.time)),
    [events, todayStr]
  )

  const urgentTasks = useMemo(() =>
    tasks
      .filter(t => t.statusIndex !== 1)
      .sort((a, b) => {
        const aOverdue = a.dueDate && a.dueDate < todayStr ? 1 : 0
        const bOverdue = b.dueDate && b.dueDate < todayStr ? 1 : 0
        if (aOverdue !== bOverdue) return bOverdue - aOverdue
        const pDiff = priorityRank(a.priority) - priorityRank(b.priority)
        if (pDiff !== 0) return pDiff
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      }),
    [tasks, todayStr]
  )

  const performanceData = useMemo(() => buildPerfData(tasks), [tasks])
  const perfTotals = useMemo(() => ({
    done: performanceData.reduce((s, d) => s + d.done, 0),
    open: performanceData.reduce((s, d) => s + d.open, 0),
  }), [performanceData])
  const perfPct = useMemo(() => {
    const total = perfTotals.done + perfTotals.open
    return total > 0 ? Math.round((perfTotals.done / total) * 100) : 0
  }, [perfTotals])

  const eventSlider = useSlider()
  const taskSlider  = useSlider()

  useEffect(() => { requestAnimationFrame(eventSlider.check) }, [todayEvents.length])
  useEffect(() => { requestAnimationFrame(taskSlider.check)  }, [urgentTasks.length])

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="mx-auto max-w-screen-2xl p-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black dark:text-[#E2E5E9]">
            {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(today)}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-base text-body dark:text-bodydark">
            Welcome,{" "}
            <span className="font-semibold text-black dark:text-[#E2E5E9]">
              {mondayUser?.name?.split(" ")[0] ?? "there"}
            </span>
            {(loadingTasks || syncingTasks) && (
              <RefreshCw className="h-3 w-3 animate-spin text-[#1A72D9]" />
            )}
          </p>
        </div>

        {/* ── Today Events ────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-black dark:text-[#E2E5E9]">Today Events</h2>
              <p className="mt-0.5 text-xs text-body dark:text-bodydark">
                {loadingEvents
                  ? "Loading events…"
                  : todayEvents.length === 0
                    ? "No events scheduled for today"
                    : `You have ${todayEvents.length} event${todayEvents.length !== 1 ? "s" : ""} today`}
              </p>
            </div>
            {todayEvents.length > 4 && (
              <div className="flex items-center gap-1.5">
                <button onClick={eventSlider.scrollPrev} disabled={!eventSlider.canPrev} className={sliderArrowClass}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button onClick={eventSlider.scrollNext} disabled={!eventSlider.canNext} className={sliderArrowClass}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {loadingEvents ? (
            <div className="flex items-center gap-2 py-6 text-xs text-body dark:text-bodydark">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
            </div>
          ) : todayEvents.length === 0 ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-stroke py-8 text-xs text-body dark:border-strokedark dark:text-bodydark">
              No events today
            </div>
          ) : (
            <div ref={eventSlider.ref} onScroll={eventSlider.check} className="flex gap-3 overflow-x-auto no-scrollbar">
              {todayEvents.map(event => {
                const past = isEventPast(event.time)
                return (
                  <div
                    key={event.id}
                    className={`flex-none rounded-xl border border-stroke bg-white p-3 transition-opacity dark:border-strokedark dark:bg-boxdark ${past ? "opacity-40" : "opacity-100"}`}
                    style={{ width: "calc(25% - 9px)", minWidth: 160 }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1A72D9]">
                        <Calendar className="h-3.5 w-3.5 text-white" />
                      </span>
                      {event.type && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-body dark:text-bodydark">
                          {event.type}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm font-semibold text-black dark:text-[#E2E5E9]">{event.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-body dark:text-bodydark">
                      <Clock className="h-3 w-3 shrink-0" />
                      {event.time}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Today Tasks ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-black dark:text-[#E2E5E9]">Today Tasks</h2>
              <p className="mt-0.5 text-xs text-body dark:text-bodydark">
                {loadingTasks
                  ? "Loading tasks…"
                  : urgentTasks.length === 0
                    ? "No pending tasks"
                    : todayTasks.length > 0
                      ? `You have ${todayTasks.length} task${todayTasks.length !== 1 ? "s" : ""} due today`
                      : "Sorted by priority · closest deadline"}
              </p>
            </div>
            {urgentTasks.length > 4 && (
              <div className="flex items-center gap-1.5">
                <button onClick={taskSlider.scrollPrev} disabled={!taskSlider.canPrev} className={sliderArrowClass}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button onClick={taskSlider.scrollNext} disabled={!taskSlider.canNext} className={sliderArrowClass}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {loadingTasks ? (
            <div className="flex items-center gap-2 py-6 text-xs text-body dark:text-bodydark">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
            </div>
          ) : urgentTasks.length === 0 ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-stroke py-8 text-xs text-body dark:border-strokedark dark:text-bodydark">
              No pending tasks
            </div>
          ) : (
            <div ref={taskSlider.ref} onScroll={taskSlider.check} className="flex gap-3 overflow-x-auto no-scrollbar">
              {urgentTasks.map(task => {
                const overdue = task.dueDate && task.dueDate < todayStr
                return (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className="flex-none rounded-xl border border-stroke bg-white p-3 transition-shadow hover:shadow-md dark:border-strokedark dark:bg-boxdark"
                    style={{ width: "calc(25% - 9px)", minWidth: 160 }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${overdue ? "bg-red-500" : "bg-[#1A72D9]"}`}>
                        <CheckSquare className="h-3.5 w-3.5 text-white" />
                      </span>
                      <MiniPriorityChip label={task.priority} />
                    </div>
                    <p className="truncate text-sm font-semibold text-black dark:text-[#E2E5E9]">{task.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <MiniDueBadge date={task.dueDate} />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Guidelines ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-8"
        >
          <div className="mb-3">
            <h2 className="text-base font-semibold text-black dark:text-[#E2E5E9]">Guidelines</h2>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">Prompts, skills and team playbook</p>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {guidelineLinks.map(({ title, subtitle, icon: Icon, color }) => {
              const c = colorMap[color]
              return (
              <Link
                key={title}
                to="/guidelines"
                className="flex-none rounded-xl border border-stroke bg-white p-4 transition-shadow hover:shadow-md dark:border-strokedark dark:bg-boxdark"
                style={{ width: "calc(25% - 9px)", minWidth: 160 }}
              >
                <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}>
                  <Icon className={`h-4 w-4 ${c.text}`} />
                </div>
                <p className="text-sm font-semibold text-black dark:text-[#E2E5E9]">{title}</p>
                <p className="mt-1 text-xs text-body dark:text-bodydark">{subtitle}</p>
              </Link>
              )
            })}
          </div>
        </motion.div>

        {/* ── Task Performance ────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-8 rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden"
          aria-label="Task performance"
        >
          {/* Header row */}
          <div className="flex flex-col items-stretch border-b border-stroke dark:border-strokedark sm:flex-row">
            <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-[#E2E5E9]">
                <TrendingUp className="h-4 w-4 text-[#16a34a]" />
                Task Performance
              </h2>
              <p className="text-xs text-body dark:text-bodydark">Last 6 weeks</p>
            </div>
            <div className="flex border-t border-stroke dark:border-strokedark sm:border-t-0">
              {([
                { label: "Completion", value: `${loadingTasks ? "—" : `${perfPct}%`}`, color: "text-[#16a34a]" },
                { label: "Completed",  value: loadingTasks ? "—" : String(perfTotals.done), color: "text-black dark:text-[#E2E5E9]" },
                { label: "In Progress", value: loadingTasks ? "—" : String(perfTotals.open), color: "text-black dark:text-[#E2E5E9]" },
              ] as const).map(({ label, value, color }) => (
                <div
                  key={label}
                  className="flex flex-1 flex-col justify-center gap-0.5 border-l border-stroke dark:border-strokedark px-6 py-4 sm:px-8"
                >
                  <span className="text-[11px] text-body dark:text-bodydark whitespace-nowrap">{label}</span>
                  <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Line chart */}
          <div className="px-4 pt-5 pb-4 sm:px-6">
            {loadingTasks ? (
              <div className="flex items-center justify-center h-48 gap-2 text-xs text-body dark:text-bodydark">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <ChartContainer config={perfChartConfig} className="h-48 w-full">
                <LineChart data={performanceData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 11 }}
                    tickFormatter={v => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    allowDecimals={false}
                    width={24}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="w-[170px]"
                        nameKey="views"
                        labelFormatter={v =>
                          new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        }
                      />
                    }
                  />
                  <Line dataKey="done" stroke="var(--color-done)" strokeWidth={2} dot={false} />
                  <Line dataKey="open" stroke="var(--color-open)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            )}
            {/* Legend */}
            <div className="mt-3 flex items-center gap-5 px-2">
              <span className="flex items-center gap-1.5 text-xs text-body dark:text-bodydark">
                <span className="inline-block h-2 w-4 rounded-full" style={{ background: "var(--chart-2)" }} />
                Completed
              </span>
              <span className="flex items-center gap-1.5 text-xs text-body dark:text-bodydark">
                <span className="inline-block h-2 w-4 rounded-full" style={{ background: "var(--chart-1)" }} />
                In Progress
              </span>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  )
}
