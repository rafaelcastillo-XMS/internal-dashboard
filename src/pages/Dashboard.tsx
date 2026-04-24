import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  AlertCircle,
  BarChart2,
  Calendar,
  CheckSquare,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react"
import { formatIsoDate } from "@/features/calendar/model"
import { useCalendarEvents } from "@/features/calendar/useCalendarEvents"
import { useMondayTasks, statusColor } from "@/features/tasks/useMondayTasks"

const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
  green:  { bg: "bg-green-50 dark:bg-green-900/20",  text: "text-green-700 dark:text-green-400",  dot: "bg-green-500"  },
  blue:   { bg: "bg-blue-50 dark:bg-blue-900/20",    text: "text-blue-700 dark:text-blue-400",    dot: "bg-blue-500"   },
  amber:  { bg: "bg-amber-50 dark:bg-amber-900/20",  text: "text-amber-700 dark:text-amber-400",  dot: "bg-amber-500"  },
  purple: { bg: "bg-purple-50 dark:bg-purple-900/20",text: "text-purple-700 dark:text-purple-400",dot: "bg-purple-500" },
  red:    { bg: "bg-red-50 dark:bg-red-900/20",      text: "text-red-700 dark:text-red-400",      dot: "bg-red-500"    },
  slate:  { bg: "bg-slate-100 dark:bg-slate-700/40", text: "text-slate-600 dark:text-slate-400",  dot: "bg-slate-400"  },
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
  const { tasks, loading: loadingTasks, error: tasksError, user: mondayUser } = useMondayTasks()

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

  const weeklyData = [65, 40, 80, 55, 90, 70, 85]
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const maxVal = Math.max(...weeklyData)
  const weeklyAverage = Math.round(weeklyData.reduce((sum, value) => sum + value, 0) / weeklyData.length)


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
                <RefreshCw className={`h-3.5 w-3.5 shrink-0 text-[#1A72D9] ${loadingTasks ? "animate-spin" : ""}`} />
                Last sync:{" "}
                <span className="font-bold text-black dark:text-white">{syncLabel}</span>
              </span>
            </div>
          </div>
        </div>

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
                          className={`min-h-full space-y-1.5 border-r border-stroke p-1.5 last:border-r-0 dark:border-strokedark ${
                            isCurrentDay
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

        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.28 }}
            className={`${panelClass} xl:col-span-2 overflow-hidden flex flex-col`}
            aria-label="My Tasks"
          >
            <div className={panelHeaderClass}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0 rounded-lg border border-stroke dark:border-strokedark bg-white dark:bg-boxdark p-1.5 shadow-sm">
                  <img src={MONDAY_LOGO} alt="monday.com" className="h-4 w-auto object-contain"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }} />
                </div>
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                    <CheckSquare className="h-4 w-4 text-[#1A72D9]" />
                    My Tasks
                  </h2>
                  <p className="mt-0.5 text-xs text-body dark:text-bodydark truncate">
                    {loadingTasks ? "Loading…" : mondayUser ? `${mondayUser.name} · ${tasks.length} assigned` : "monday.com"}
                  </p>
                </div>
              </div>
              {/* Quick counts */}
              {!loadingTasks && !tasksError && mondayUser && (
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-bold text-meta-3">{doneCount} done</span>
                  <span className="text-[10px] font-bold text-[#1A72D9]">{widgetTasks.length} open</span>
                  <button
                    onClick={() => navigate("/tasks")}
                    className="flex items-center gap-1 text-xs font-medium text-body transition-colors hover:text-[#1A72D9] dark:text-bodydark dark:hover:text-white"
                  >
                    All <ChevronRight className="h-3 w-3" />
                  </button>
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
            className={`${panelClass} xl:col-span-2`}
            aria-label="Weekly performance"
          >
            <div className={panelHeaderClass}>
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                  <BarChart2 className="h-4 w-4 text-[#1A72D9]" />
                  Weekly Performance
                </h2>
                <p className="mt-0.5 text-xs text-body dark:text-bodydark">Task activity distribution across the week</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-meta-3/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-meta-3">
                <TrendingUp className="h-3 w-3" />
                +18%
              </span>
            </div>

            <div className={panelBodyClass}>
              <div className={`${surfaceClass} p-4`}>
                <div className="flex h-64 items-end gap-3">
                  {weeklyData.map((value, index) => (
                    <div key={weekDays[index]} className="group flex flex-1 flex-col items-center gap-2">
                      <span className="text-[10px] font-semibold text-body opacity-0 transition-opacity group-hover:opacity-100 dark:text-bodydark">
                        {value}%
                      </span>
                      <div className="flex h-[180px] w-full items-end justify-center rounded-lg bg-white px-2 py-2 dark:bg-boxdark-2">
                        <div
                          className="w-full rounded-t-lg bg-[#1A72D9]/80 transition-colors group-hover:bg-[#1A72D9]"
                          style={{ height: `${(value / maxVal) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-body dark:text-bodydark">
                        {weekDays[index]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-stroke pt-4 text-xs text-body dark:border-strokedark dark:text-bodydark">
                <span>
                  Avg: <strong className="tabular-nums text-black dark:text-white">{weeklyAverage}%</strong>
                </span>
                <span>
                  Peak: <strong className="tabular-nums text-[#1A72D9]">{maxVal}%</strong>
                </span>
              </div>
            </div>
          </motion.section>
        </div>

      </div>
    </div>
  )
}
