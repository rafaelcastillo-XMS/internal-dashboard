import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
    CheckSquare, Clock, Users, ChevronRight,
    ArrowUpRight, BarChart2, Target, TrendingUp, Zap, Calendar, CheckCircle2, CalendarDays, Loader2
} from "lucide-react"
import { getClients } from "@/features/clients/repository"
import { formatIsoDate } from "@/features/calendar/model"
import { useCalendarEvents } from "@/features/calendar/useCalendarEvents"
import type { CalendarEvent } from "@/features/calendar/types"
import { getTasks } from "@/features/tasks/repository"

function MiniCalendar({ selectedDate, onSelectDate, events, today }: {
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
    const selectedNum = selectedDate.getFullYear() === year && selectedDate.getMonth() === month
        ? selectedDate.getDate() : null

    const cells: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)

    const rows: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`
    const eventDays = new Set(
        events
            .filter(e => e.date.startsWith(monthPrefix))
            .map(e => parseInt(e.date.split("-")[2]))
    )

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 shrink-0">{monthName}</p>
            <div className="grid grid-cols-7 text-center text-[11px] mb-1 shrink-0">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                    <span key={d} className="text-slate-400 dark:text-slate-500 font-medium py-0.5">{d}</span>
                ))}
            </div>
            <div className="flex-1 flex flex-col gap-0.5 min-h-0">
                {rows.map((row, ri) => (
                    <div key={ri} className="flex flex-1 gap-0.5">
                        {row.map((d, ci) =>
                            d === null ? (
                                <div key={ci} className="flex-1" />
                            ) : (
                                <button
                                    key={ci}
                                    onClick={() => onSelectDate(new Date(year, month, d))}
                                    className={`relative flex-1 flex items-center justify-center rounded-full text-[12px] font-medium transition-colors
                                        ${d === todayNum
                                            ? "bg-blue-600 text-white shadow-sm shadow-blue-400/30"
                                            : d === selectedNum
                                                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400/40"
                                                : eventDays.has(d)
                                                    ? "text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700"
                                                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                        }`}
                                >
                                    {d}
                                    {d !== todayNum && d !== selectedNum && eventDays.has(d) && (
                                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full" />
                                    )}
                                </button>
                            )
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}


export function Dashboard() {
    const clients = getClients()
    const tasks = getTasks()
    const today = new Date()
    const todayStr = formatIsoDate(today)
    const navigate = useNavigate()
    const [selectedDate, setSelectedDate] = useState<Date>(today)
    const { events, loading: loadingEvents } = useCalendarEvents({
        monthDate: today,
        monthSpan: 2,
    })

    const selectedDateStr = formatIsoDate(selectedDate)
    const isToday = selectedDateStr === todayStr
    const selectedDayEvents = events.filter(e => e.date === selectedDateStr)
    const dayLabel = isToday
        ? "Today"
        : new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(selectedDate)

    const upcomingEvents = useMemo(() => events
        .filter(e => e.date > todayStr)
        .slice(0, 8), [events, todayStr])

    const doneTasks = tasks.filter(t => t.status === "done").length
    const inProgressTasks = tasks.filter(t => t.status === "in-progress").length
    const totalTasks = tasks.length

    const stats = [
        { label: "Tasks Assigned", value: totalTasks.toString(), icon: Target, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20", change: "+2 this week" },
        { label: "In Progress", value: inProgressTasks.toString(), icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20", change: "Active now" },
        { label: "Completed", value: doneTasks.toString(), icon: CheckSquare, color: "text-green-600 bg-green-50 dark:bg-green-900/20", change: "+3 this week" },
        { label: "Active Clients", value: clients.filter(c => c.status === "active").length.toString(), icon: Users, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20", change: "5 total" },
    ]

    const weeklyData = [65, 40, 80, 55, 90, 70, 85]
    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    const maxVal = Math.max(...weeklyData)

    return (
        <div className="p-6 space-y-6 overflow-auto h-full bg-slate-50 dark:bg-slate-900">

            {/* Welcome row */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Good morning, Rafael 👋</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {new Intl.DateTimeFormat('en-US', { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(today)}
                    </p>
                </div>
                <button
                    onClick={() => navigate("/tasks")}
                    className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
                >
                    <CheckSquare className="w-4 h-4" /> View Tasks
                </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s, i) => (
                    <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: i * 0.07 }}
                        className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                                <s.icon className="w-5 h-5" />
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5">{s.label}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{s.change}</p>
                    </motion.div>
                ))}
            </div>

            {/* Row 1: Mini Calendar + Day Events + Upcoming Events */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Mini Calendar */}
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col h-[300px]"
                    aria-label="Mini calendar"
                >
                    <div className="flex items-center justify-between mb-3 shrink-0">
                        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-600" /> Calendar
                        </h2>
                        <button
                            onClick={() => navigate("/calendar")}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
                        >
                            Full view <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    <MiniCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} events={events} today={today} />
                </motion.section>

                {/* Selected Day Events */}
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col h-[300px]"
                    aria-label="Day events"
                >
                    <div className="flex items-center justify-between mb-3 shrink-0">
                        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-blue-600" /> {dayLabel}
                        </h2>
                        {selectedDayEvents.length > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                {selectedDayEvents.length}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 min-h-[160px]">
                        {selectedDayEvents.length > 0 ? (
                            selectedDayEvents.map(ev => (
                                <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/40">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${ev.color}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{ev.title}</p>
                                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {ev.time}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <CalendarDays className="w-8 h-8 text-slate-200 dark:text-slate-700 mb-2" />
                                <p className="text-sm text-slate-400 dark:text-slate-500">No events on this day</p>
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* Upcoming Events */}
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col h-[300px]"
                    aria-label="Upcoming events"
                >
                    <div className="flex items-center justify-between mb-3 shrink-0">
                        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-600" /> Upcoming
                            {loadingEvents && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                        </h2>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                            {upcomingEvents.length}
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                        {upcomingEvents.map(ev => {
                            const d = new Date(ev.date + "T12:00:00")
                            const label = new Intl.DateTimeFormat('en-US', { month: "short", day: "numeric" }).format(d)
                            return (
                                <div key={ev.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/40">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${ev.color} mt-1.5`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate leading-tight">{ev.title}</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">{label} · {ev.time}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </motion.section>

            </div>

            {/* Row 2: My Tasks (2 cols) + Weekly Performance (1 col) */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.28 }}
                    className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700"
                    aria-label="My tasks"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <CheckSquare className="w-4 h-4 text-blue-600" /> My Tasks
                        </h2>
                        <button
                            onClick={() => navigate("/tasks")}
                            className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
                        >
                            View all <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Progress */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                            <span>{doneTasks} of {totalTasks} tasks done</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.round((doneTasks / totalTasks) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                                style={{ width: `${(doneTasks / totalTasks) * 100}%` }}
                            />
                        </div>
                    </div>

                    <ul className="space-y-1">
                        {tasks.slice(0, 5).map(task => (
                            <li key={task.id}>
                                <button
                                    onClick={() => navigate("/tasks")}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${task.status === "done" ? "bg-green-500" : task.status === "in-progress" ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"
                                        }`} />
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${task.status === "done" ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-200"
                                            }`}>
                                            {task.title}
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">{task.client}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${task.priority === "high" ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                                            : task.priority === "medium" ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                                                : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                                            }`}>
                                            {task.priority}
                                        </span>
                                        {task.status === "done"
                                            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                            : <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" />
                                        }
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </motion.section>

                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.33 }}
                    className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700"
                    aria-label="Weekly performance"
                >
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <BarChart2 className="w-4 h-4 text-blue-600" /> Weekly
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">Task activity</p>
                        </div>
                        <span className="text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> +18%
                        </span>
                    </div>

                    {/* Bar chart */}
                    <div className="flex items-end gap-2  h-64">
                        {weeklyData.map((val, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                                <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">{val}</span>
                                <div className="w-full flex items-end justify-center" style={{ height: 90 }}>
                                    <div
                                        className="w-full rounded-t-lg bg-blue-500/70 dark:bg-blue-500/60 group-hover:bg-blue-600 transition-colors cursor-default"
                                        style={{ height: `${(val / maxVal) * 100}%` }}
                                    />
                                </div>
                                <span className="text-[10px] text-slate-400">{weekDays[i]}</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Avg: <strong className="text-slate-700 dark:text-slate-200">{Math.round(weeklyData.reduce((a, b) => a + b) / weeklyData.length)}%</strong></span>
                        <span>Peak: <strong className="text-blue-600 dark:text-blue-400">{maxVal}%</strong></span>
                    </div>
                </motion.section>
            </div>

            {/* Row 3: Clients quick access */}
            <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700"
                aria-label="Client quick access"
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Zap className="w-4 h-4 text-blue-600" /> Quick Access – Clients
                    </h2>
                    <button
                        onClick={() => navigate("/clients")}
                        className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
                    >
                        All clients <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {clients.map(client => (
                        <button
                            key={client.id}
                            onClick={() => navigate(`/clients/${client.id}`)}
                            className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            <div className={`w-12 h-12 rounded-xl ${client.color} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                                {client.initials}
                            </div>
                            <div className="text-center">
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-blue-700 dark:group-hover:text-blue-400 block truncate w-full leading-tight">
                                    {client.name}
                                </span>
                                <span className={`mt-1 inline-block text-[9px] px-1.5 py-0.5 rounded-full font-medium ${client.status === "active"
                                    ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                                    : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                                    }`}>
                                    {client.status}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </motion.section>

        </div>
    )
}
