import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, Plus, X, Clock, Loader2 } from "lucide-react"
import { formatIsoDate } from "@/features/calendar/model"
import type { CalendarEvent } from "@/features/calendar/types"
import { useCalendarEvents } from "@/features/calendar/useCalendarEvents"

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function EventPill({ event }: { event: CalendarEvent }) {
    return (
        <div className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate ${event.color} text-white cursor-pointer hover:opacity-90 transition-opacity`} title={event.title}>
            {event.time} {event.title}
        </div>
    )
}

function DayCell({
    day, events, isToday, isCurrentMonth, onClick, selected
}: {
    day: number
    month: number
    year: number
    events: CalendarEvent[]
    isToday: boolean
    isCurrentMonth: boolean
    onClick: () => void
    selected: boolean
}) {
    return (
        <div
            onClick={onClick}
            className={`min-h-[90px] p-2 border-b border-r border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors
                ${!isCurrentMonth ? "opacity-40" : ""}
                ${selected ? "bg-blue-50/60 dark:bg-blue-900/10" : ""}
            `}
        >
            <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1 ${isToday
                ? "bg-blue-600 text-white shadow-sm shadow-blue-400/30"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}>
                {day}
            </div>
            <div className="space-y-0.5">
                {events.slice(0, 2).map(ev => (
                    <EventPill key={ev.id} event={ev} />
                ))}
                {events.length > 2 && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 pl-1">+{events.length - 2} more</div>
                )}
            </div>
        </div>
    )
}

function EventDetailPanel({ events, date, onClose }: { events: CalendarEvent[]; date: string; onClose: () => void }) {
    const d = new Date(date + "T12:00:00")
    const label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-lg p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{label}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{events.length} event{events.length !== 1 ? "s" : ""}</p>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400">
                    <X className="w-4 h-4" />
                </button>
            </div>
            {events.length === 0 ? (
                <div className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">No events this day</div>
            ) : (
                <div className="space-y-3">
                    {events.map(ev => (
                        <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                            <div className={`w-2.5 h-2.5 rounded-full ${ev.color} mt-1.5 shrink-0`} />
                            <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{ev.title}</p>
                                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3" /> {ev.time}
                                </p>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 mt-1 inline-block capitalize">
                                    {ev.type}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    )
}

export function CalendarPage() {
    const today = new Date()
    const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
    const [selectedDate, setSelectedDate] = useState<string | null>(formatIsoDate(today))
    const { events, loading: loadingEvents, error: gcalError } = useCalendarEvents({ monthDate: currentDate })

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDayOfMonth = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
    const goToToday = () => {
        setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))
        setSelectedDate(formatIsoDate(today))
    }

    // Build calendar grid
    type GridDay = { day: number; month: number; year: number; isCurrentMonth: boolean }
    const cells: GridDay[] = []

    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i
        const m = month === 0 ? 11 : month - 1
        const y = month === 0 ? year - 1 : year
        cells.push({ day: d, month: m, year: y, isCurrentMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, month, year, isCurrentMonth: true })
    }
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
        const m = month === 11 ? 0 : month + 1
        const y = month === 11 ? year + 1 : year
        cells.push({ day: d, month: m, year: y, isCurrentMonth: false })
    }

    const getEventsForDate = (d: number, m: number, y: number) => {
        const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
        return events.filter(e => e.date === dateStr)
    }

    const selectedEvents = selectedDate ? events.filter(e => e.date === selectedDate) : []

    const upcomingEvents = events
        .filter(e => e.date >= formatIsoDate(today))
        .slice(0, 6)

    return (
        <div className="flex flex-col xl:flex-row h-full bg-slate-50 dark:bg-slate-900 overflow-hidden p-5 gap-5 min-h-full xl:h-full overflow-y-auto xl:overflow-hidden">
            {/* GCal error banner */}
            {gcalError && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-lg w-full mx-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-3 shadow-lg">
                    <span className="font-semibold">Google Calendar error:</span> {gcalError}
                </div>
            )}
            {/* Calendar main */}
            <div className="flex-1 flex flex-col shrink-0 min-h-[500px] xl:min-h-0 xl:overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                {/* Header */}
                <div className="border-b border-slate-100 dark:border-slate-700 p-5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                            {MONTH_NAMES[month]} {year}
                        </h1>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={prevMonth}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={nextMonth}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        <button
                            onClick={goToToday}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            Today
                        </button>
                        {loadingEvents && (
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                        )}
                    </div>
                    <button className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-sm">
                        <Plus className="w-4 h-4" /> New Event
                    </button>
                </div>

                {/* Day names */}
                <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700">
                    {DAY_NAMES.map(d => (
                        <div key={d} className="py-2 text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="flex-1 overflow-auto">
                    <motion.div
                        key={`${year}-${month}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-7 border-l border-t border-slate-100 dark:border-slate-700 min-h-full"
                    >
                        {cells.map((cell, i) => {
                            const dateStr = `${cell.year}-${String(cell.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`
                            const isToday = dateStr === today.toISOString().split("T")[0]
                            const cellEvents = getEventsForDate(cell.day, cell.month, cell.year)
                            return (
                                <DayCell
                                    key={i}
                                    day={cell.day}
                                    month={cell.month}
                                    year={cell.year}
                                    events={cellEvents}
                                    isToday={isToday}
                                    isCurrentMonth={cell.isCurrentMonth}
                                    selected={selectedDate === dateStr}
                                    onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                                />
                            )
                        })}
                    </motion.div>
                </div>
            </div>

            {/* Right sidebar */}
            <div className="w-full xl:w-72 shrink-0 flex flex-col gap-4 overflow-visible xl:overflow-auto">
                {/* Selected day detail */}
                <AnimatePresence mode="wait">
                    {selectedDate && (
                        <EventDetailPanel
                            key={selectedDate}
                            events={selectedEvents}
                            date={selectedDate}
                            onClose={() => setSelectedDate(null)}
                        />
                    )}
                </AnimatePresence>

                {/* Upcoming events */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-4">Upcoming Events</h3>
                    <div className="space-y-3">
                        {upcomingEvents.map(ev => {
                            const d = new Date(ev.date + "T12:00:00")
                            const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            return (
                                <button
                                    key={ev.id}
                                    onClick={() => setSelectedDate(ev.date)}
                                    className="w-full flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 p-2 rounded-xl transition-colors text-left"
                                >
                                    <div className={`w-2 h-2 rounded-full ${ev.color} mt-1.5 shrink-0`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{ev.title}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{label} · {ev.time}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
