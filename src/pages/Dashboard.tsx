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


export function Dashboard() {
  const tasks = getTasks()
  const [today] = useState(() => new Date())
  const todayStr = formatIsoDate(today)
  const navigate = useNavigate()
  const { events, loading: loadingEvents } = useCalendarEvents({
    monthDate: today,
    monthSpan: 2,
  })

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

        <div className="mb-6">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className={`${panelClass} flex h-[420px] flex-col`}
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
            <div className="flex min-h-0 flex-1 grid-cols-7 border-t border-stroke dark:border-strokedark sm:grid">
              {Array.from({ length: 7 }).map((_, i) => {
                const currentDayOfWeek = today.getDay()
                const startOfWeek = new Date(today)
                startOfWeek.setDate(today.getDate() - currentDayOfWeek + i)
                const dateStr = formatIsoDate(startOfWeek)
                const dayEvents = events.filter((e) => e.date === dateStr)
                const isCurrentDay = dateStr === todayStr

                return (
                  <div
                    key={i}
                    className="flex min-h-0 flex-col border-r border-stroke last:border-r-0 dark:border-strokedark"
                  >
                    <div className="border-b border-stroke p-3 text-center dark:border-strokedark">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-body dark:text-bodydark">
                        {new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(startOfWeek)}
                      </p>
                      <p
                        className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                          isCurrentDay
                            ? "bg-[#1A72D9] text-white shadow-card"
                            : "text-black dark:text-white"
                        }`}
                      >
                        {startOfWeek.getDate()}
                      </p>
                    </div>
                    <div className="max-h-[180px] space-y-2 overflow-y-auto p-2 custom-scrollbar">
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className={`${surfaceClass} group relative cursor-pointer overflow-hidden p-2 text-xs transition-colors hover:bg-gray dark:hover:bg-meta-4/60`}
                        >
                          <div className={`absolute bottom-0 left-0 top-0 w-[3px] ${event.color || "bg-[#1A72D9]"}`} />
                          <div className="pl-1">
                            <p className="truncate font-semibold text-black dark:text-white">
                              {event.title}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-body dark:text-bodydark">
                              <Clock className="h-3 w-3 shrink-0" />
                              {event.time}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
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
