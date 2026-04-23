import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  BarChart2,
  Calendar,
  CheckSquare,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  TrendingUp,
} from "lucide-react"
import { formatIsoDate } from "@/features/calendar/model"
import { useCalendarEvents } from "@/features/calendar/useCalendarEvents"

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
        </div>

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
            {/* Unified calendar grid: header + events share the same columns */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-stroke dark:border-strokedark">
              {/* Day headers — inside the same width context as the body */}
              <div className="grid grid-cols-7 border-b border-stroke dark:border-strokedark" style={{ paddingRight: "10px" }}>
                {Array.from({ length: 7 }).map((_, i) => {
                  const currentDayOfWeek = today.getDay()
                  const startOfWeek = new Date(today)
                  startOfWeek.setDate(today.getDate() - currentDayOfWeek + i)
                  const dateStr = formatIsoDate(startOfWeek)
                  const isCurrentDay = dateStr === todayStr
                  return (
                    <div key={i} className="border-r border-stroke p-3 text-center last:border-r-0 dark:border-strokedark">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-body dark:text-bodydark">
                        {new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(startOfWeek)}
                      </p>
                      <p className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${isCurrentDay ? "bg-[#1A72D9] text-white shadow-card" : "text-black dark:text-white"}`}>
                        {startOfWeek.getDate()}
                      </p>
                    </div>
                  )
                })}
              </div>
              {/* Events area — scrolls vertically, columns match header exactly */}
              <div className="grid flex-1 grid-cols-7 overflow-y-scroll custom-scrollbar">
                {Array.from({ length: 7 }).map((_, i) => {
                  const currentDayOfWeek = today.getDay()
                  const startOfWeek = new Date(today)
                  startOfWeek.setDate(today.getDate() - currentDayOfWeek + i)
                  const dateStr = formatIsoDate(startOfWeek)
                  const dayEvents = events.filter((e) => e.date === dateStr)
                  return (
                    <div key={i} className="space-y-2 border-r border-stroke p-2 last:border-r-0 dark:border-strokedark">
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className={`${surfaceClass} group relative cursor-pointer overflow-hidden p-2 text-xs transition-colors hover:bg-gray dark:hover:bg-meta-4/60`}
                        >
                          <div className={`absolute bottom-0 left-0 top-0 w-[3px] ${event.color || "bg-[#1A72D9]"}`} />
                          <div className="pl-1">
                            <p className="truncate font-semibold text-black dark:text-white">{event.title}</p>
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-body dark:text-bodydark">
                              <Clock className="h-3 w-3 shrink-0" />
                              {event.time}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.section>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.28 }}
            className={`${panelClass} xl:col-span-2 overflow-hidden`}
            aria-label="Task management integration"
          >
            <div className={panelHeaderClass}>
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                  <CheckSquare className="h-4 w-4 text-[#1A72D9]" />
                  Task Management
                </h2>
                <p className="mt-0.5 text-xs text-body dark:text-bodydark">monday.com integration</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                </span>
                Coming Soon
              </span>
            </div>

            <div className={`${panelBodyClass} flex flex-col items-center justify-center py-10`}>
              <div className="relative mb-5">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#ff3d57]/15 via-[#ffcb00]/15 to-[#00ca72]/15 blur-lg" />
                <div className="relative rounded-xl border border-stroke bg-white/80 p-4 shadow-sm dark:border-strokedark dark:bg-boxdark/80">
                  <img
                    src={MONDAY_LOGO}
                    alt="monday.com logo"
                    className="h-7 w-auto object-contain"
                    onError={(e) => {
                      const target = e.currentTarget
                      target.style.display = "none"
                      const fallback = target.nextElementSibling as HTMLElement
                      if (fallback) fallback.style.display = "flex"
                    }}
                  />
                  <div className="hidden items-center gap-1.5 text-lg font-extrabold" style={{ color: "#ff3d57" }}>
                    <svg width="22" height="22" viewBox="0 0 72 72" fill="none"><rect x="4" y="20" width="12" height="32" rx="6" fill="#ff3d57"/><rect x="24" y="10" width="12" height="42" rx="6" fill="#ffcb00"/><rect x="44" y="25" width="12" height="27" rx="6" fill="#00ca72"/><circle cx="62" cy="52" r="6" fill="#ff3d57"/></svg>
                    monday
                  </div>
                </div>
              </div>
              <p className="mb-1 text-sm font-semibold text-black dark:text-white">Integrating with monday.com</p>
              <p className="mb-5 max-w-xs text-center text-xs leading-relaxed text-body dark:text-bodydark">
                Your boards, tasks, and workflows will sync in real time directly into this dashboard.
              </p>
              <button
                onClick={() => navigate("/tasks")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#ff3d57] via-[#ffcb00] to-[#00ca72] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
              >
                Learn More
                <ExternalLink className="h-3 w-3" />
              </button>
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
