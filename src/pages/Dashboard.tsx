import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowUpRight,
  BarChart2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  Loader2,
  Target,
  TrendingUp,
} from "lucide-react"
import { formatIsoDate } from "@/features/calendar/model"
import { useCalendarEvents } from "@/features/calendar/useCalendarEvents"
import type { CalendarEvent } from "@/features/calendar/types"
import { getTasks } from "@/features/tasks/repository"

const panelClass = "rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
const panelHeaderClass = "flex items-center justify-between gap-3 border-b border-stroke px-6 py-5 dark:border-strokedark"
const panelBodyClass = "px-6 py-5"
const surfaceClass = "rounded-lg border border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4/35"

function MiniCalendar({
  selectedDate,
  onSelectDate,
  events,
  today,
}: {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  events: CalendarEvent[]
  today: Date
}) {
  const [current] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const year = current.getFullYear()
  const month = current.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayNum = today.getDate()
  const monthName = current.toLocaleString("en-US", { month: "long", year: "numeric" })
  const selectedNum =
    selectedDate.getFullYear() === year && selectedDate.getMonth() === month
      ? selectedDate.getDate()
      : null

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const rows: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`
  const eventDays = new Set(
    events
      .filter((event) => event.date.startsWith(monthPrefix))
      .map((event) => parseInt(event.date.split("-")[2], 10)),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-black dark:text-white">{monthName}</p>
        <span className="rounded-full bg-[#1A72D9]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1A72D9]">
          Planner
        </span>
      </div>
      <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wider text-body dark:text-bodydark">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex flex-1 gap-1">
            {row.map((day, columnIndex) =>
              day === null ? (
                <div key={columnIndex} className="flex-1" />
              ) : (
                <button
                  key={columnIndex}
                  onClick={() => onSelectDate(new Date(year, month, day))}
                  className={`relative flex flex-1 items-center justify-center rounded-lg text-[12px] font-semibold transition-all
                    ${
                      day === todayNum
                        ? "border-[#1A72D9] bg-[#1A72D9] text-white shadow-card"
                      : day === selectedNum
                          ? "border-[#1A72D9]/40 bg-[#1A72D9]/10 text-[#1A72D9] dark:border-[#1A72D9]/50 dark:bg-[#1A72D9]/15"
                        : eventDays.has(day)
                            ? "border-transparent bg-white text-black hover:bg-gray hover:text-[#1A72D9] dark:bg-meta-4/50 dark:text-white dark:hover:bg-meta-4/70"
                            : "border-transparent text-body hover:bg-gray dark:text-bodydark dark:hover:bg-meta-4/50"
                    }`}
                >
                  {day}
                  {day !== todayNum && day !== selectedNum && eventDays.has(day) && (
                    <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#1A72D9]" />
                  )}
                </button>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Dashboard() {
  const tasks = getTasks()
  const [today] = useState(() => new Date())
  const todayStr = formatIsoDate(today)
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const { events, loading: loadingEvents } = useCalendarEvents({
    monthDate: today,
    monthSpan: 2,
  })

  const selectedDateStr = formatIsoDate(selectedDate)
  const isToday = selectedDateStr === todayStr
  const selectedDayEvents = events.filter((event) => event.date === selectedDateStr)
  const dayLabel = isToday
    ? "Today"
    : new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(selectedDate)

  const upcomingEvents = useMemo(
    () => events.filter((event) => event.date > todayStr).slice(0, 8),
    [events, todayStr],
  )

  const doneTasks = tasks.filter((task) => task.status === "done").length
  const inProgressTasks = tasks.filter((task) => task.status === "in-progress").length
  const totalTasks = tasks.length
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const stats = [
    {
      label: "Tasks Assigned",
      value: totalTasks.toString(),
      icon: Target,
      iconClass: "bg-[#1A72D9]/10 text-[#1A72D9]",
      accent: "bg-[#1A72D9]/10 text-[#1A72D9]",
      change: `${Math.max(totalTasks - doneTasks, 0)} remaining`,
    },
    {
      label: "In Progress",
      value: inProgressTasks.toString(),
      icon: Clock,
      iconClass: "bg-warning/10 text-warning",
      accent: "bg-warning/10 text-warning",
      change: "Active now",
    },
    {
      label: "Completed",
      value: doneTasks.toString(),
      icon: CheckSquare,
      iconClass: "bg-meta-3/10 text-meta-3",
      accent: "bg-meta-3/10 text-meta-3",
      change: `${completionRate}% completion`,
    },
  ]

  const weeklyData = [65, 40, 80, 55, 90, 70, 85]
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const maxVal = Math.max(...weeklyData)
  const weeklyAverage = Math.round(weeklyData.reduce((sum, value) => sum + value, 0) / weeklyData.length)

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="mx-auto max-w-screen-2xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">Operations Dashboard</h1>
            <p className="text-sm text-body dark:text-bodydark">
              Xperience Ai Marketing Solutions ·{" "}
              {new Intl.DateTimeFormat("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              }).format(today)}
            </p>
          </div>
          <button
            onClick={() => navigate("/tasks")}
            className="flex h-10 items-center gap-2 rounded-lg border border-stroke bg-white px-4 text-sm font-medium text-black shadow-card transition-colors hover:border-[#1A72D9] hover:text-[#1A72D9] dark:border-strokedark dark:bg-boxdark dark:text-white"
          >
            <CheckSquare className="h-4 w-4" />
            View Tasks
          </button>
        </div>

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.07 }}
              className={`${panelClass} px-5 py-5 transition-shadow duration-200 hover:shadow-xms-glow`}
            >
              <div className="mb-4 flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.iconClass}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${stat.accent}`}>
                  Live
                </span>
              </div>

              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-body dark:text-bodydark">
                    {stat.label}
                  </p>
                  <h2 className="text-2xl font-bold tabular-nums text-black dark:text-white">{stat.value}</h2>
                </div>
                <ArrowUpRight className="h-4 w-4 text-body dark:text-bodydark" />
              </div>

              <div className="mt-3 flex items-center gap-1.5 border-t border-stroke pt-3 text-xs text-body dark:border-strokedark dark:text-bodydark">
                <span>{stat.change}</span>
              </div>
            </motion.div>
          ))}
        </section>

        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className={`${panelClass} flex h-[360px] flex-col`}
            aria-label="Mini calendar"
          >
            <div className={panelHeaderClass}>
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                  <Calendar className="h-4 w-4 text-[#1A72D9]" />
                  Calendar
                </h2>
                <p className="mt-0.5 text-xs text-body dark:text-bodydark">Monthly overview with scheduled activity</p>
              </div>
              <button
                onClick={() => navigate("/calendar")}
                className="flex items-center gap-1 text-xs font-medium text-body transition-colors hover:text-[#1A72D9] dark:text-bodydark dark:hover:text-white"
              >
                Full view
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className={`${panelBodyClass} flex min-h-0 flex-1`}>
              <MiniCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                events={events}
                today={today}
              />
            </div>
          </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className={`${panelClass} flex h-[360px] flex-col`}
          aria-label="Day events"
        >
          <div className={panelHeaderClass}>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                <CalendarDays className="h-4 w-4 text-[#1A72D9]" />
                {dayLabel}
              </h2>
              <p className="mt-0.5 text-xs text-body dark:text-bodydark">Scheduled items for the selected day</p>
            </div>
            <span className="rounded-full bg-[#1A72D9]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1A72D9]">
              {selectedDayEvents.length} items
            </span>
          </div>
          <div className={`${panelBodyClass} min-h-0 flex-1 overflow-y-auto custom-scrollbar`}>
            <div className="space-y-3">
              {selectedDayEvents.length > 0 ? (
                selectedDayEvents.map((event) => (
                  <div key={event.id} className={`${surfaceClass} flex items-start gap-3 p-4`}>
                    <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${event.color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-black dark:text-white">{event.title}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-body dark:text-bodydark">
                        <Clock className="h-3 w-3" />
                        {event.time}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-stroke px-6 text-center dark:border-strokedark">
                  <CalendarDays className="mb-3 h-8 w-8 text-body dark:text-bodydark" />
                  <p className="text-sm font-medium text-black dark:text-white">No events on this day</p>
                  <p className="mt-1 text-xs text-body dark:text-bodydark">
                    Pick another date in the calendar to inspect activity.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className={`${panelClass} flex h-[360px] flex-col`}
          aria-label="Upcoming events"
        >
          <div className={panelHeaderClass}>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                <Clock className="h-4 w-4 text-[#1A72D9]" />
                Upcoming
                {loadingEvents && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1A72D9]" />}
              </h2>
              <p className="mt-0.5 text-xs text-body dark:text-bodydark">Next scheduled calendar touchpoints</p>
            </div>
            <span className="rounded-full bg-stroke/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-body dark:bg-strokedark dark:text-bodydark">
              {upcomingEvents.length} queued
            </span>
          </div>
          <div className={`${panelBodyClass} min-h-0 flex-1 overflow-y-auto custom-scrollbar`}>
            <div className="space-y-3">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => {
                  const date = new Date(`${event.date}T12:00:00`)
                  const label = new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                  }).format(date)

                  return (
                    <div key={event.id} className={`${surfaceClass} flex items-start gap-3 p-4`}>
                      <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${event.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-black dark:text-white">{event.title}</p>
                        <p className="mt-1 text-xs text-body dark:text-bodydark">
                          {label} · {event.time}
                        </p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-stroke px-6 text-center dark:border-strokedark">
                  <Clock className="mb-3 h-8 w-8 text-body dark:text-bodydark" />
                  <p className="text-sm font-medium text-black dark:text-white">No upcoming events</p>
                  <p className="mt-1 text-xs text-body dark:text-bodydark">
                    New scheduled items will appear here automatically.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.section>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.28 }}
          className={`${panelClass} xl:col-span-2`}
          aria-label="My tasks"
        >
          <div className={panelHeaderClass}>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                <CheckSquare className="h-4 w-4 text-[#1A72D9]" />
                My Tasks
              </h2>
              <p className="mt-0.5 text-xs text-body dark:text-bodydark">Task execution and completion rhythm</p>
            </div>
            <button
              onClick={() => navigate("/tasks")}
              className="flex items-center gap-1 text-xs font-medium text-body transition-colors hover:text-[#1A72D9] dark:text-bodydark dark:hover:text-white"
            >
              View all
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className={panelBodyClass}>
            <div className={`${surfaceClass} mb-4 p-4`}>
              <div className="mb-2 flex items-center justify-between text-xs text-body dark:text-bodydark">
                <span>
                  {doneTasks} of {totalTasks} tasks done
                </span>
                <span className="font-semibold tabular-nums text-black dark:text-white">{completionRate}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stroke dark:bg-strokedark">
                <div
                  className="h-full rounded-full bg-[#1A72D9] transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>

            <ul className="space-y-2">
              {tasks.slice(0, 5).map((task) => (
                <li key={task.id}>
                  <button
                    onClick={() => navigate("/tasks")}
                    className={`${surfaceClass} flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-[#1A72D9]/30 hover:bg-gray dark:hover:bg-meta-4/60`}
                  >
                    <div
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        task.status === "done"
                          ? "bg-meta-3"
                          : task.status === "in-progress"
                            ? "bg-warning"
                            : "bg-body"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-semibold ${
                          task.status === "done"
                            ? "text-body line-through dark:text-bodydark"
                            : "text-black dark:text-white"
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="mt-1 text-xs text-body dark:text-bodydark">{task.client}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          task.priority === "high"
                            ? "bg-danger/10 text-danger"
                            : task.priority === "medium"
                              ? "bg-warning/10 text-warning"
                              : "bg-stroke/50 text-body dark:bg-strokedark dark:text-bodydark"
                        }`}
                      >
                        {task.priority}
                      </span>
                      {task.status === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-meta-3" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-body dark:text-bodydark" />
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
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
