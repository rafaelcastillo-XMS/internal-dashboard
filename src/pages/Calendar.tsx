import { useState } from "react"
import DOMPurify from "dompurify"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, X, Clock, Loader2, Video, AlignLeft } from "lucide-react"
import { formatIsoDate } from "@/features/calendar/model"
import type { CalendarEvent } from "@/features/calendar/types"
import { useCalendarEvents } from "@/features/calendar/useCalendarEvents"

type View = "weekly" | "monthly"

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function getWeekStart(date: Date): Date {
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d
}

function parseMinutes(time: string): number {
    const ampm = /([\d]+):([\d]+)\s*(AM|PM)/i.exec(time)
    if (ampm) {
        let h = parseInt(ampm[1])
        const m = parseInt(ampm[2])
        const period = ampm[3].toUpperCase()
        if (period === "PM" && h !== 12) h += 12
        if (period === "AM" && h === 12) h = 0
        return h * 60 + m
    }
    const hm = /(\d+):(\d+)/.exec(time)
    if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2])
    return 0
}

function EventPill({ event, compact, onClick }: { event: CalendarEvent; compact?: boolean; onClick?: (e: React.MouseEvent) => void }) {
    return (
        <div
            onClick={e => { e.stopPropagation(); onClick?.(e) }}
            className={`font-medium rounded-md truncate ${event.color} text-white cursor-pointer hover:opacity-90 transition-opacity
                ${compact ? "text-[9px] px-1 py-0.5" : "text-[10px] px-1.5 py-0.5"}`}
            title={event.title}
        >
            {event.time} {event.title}
        </div>
    )
}

// ── Event modal ────────────────────────────────────────────────────────────────

function EventModal({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
    const dateLabel = new Date(event.date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
    })

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/60 overflow-hidden"
            >
                {/* Color stripe + header */}
                <div className={`${event.color} h-1.5 w-full`} />
                <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-[#E2E5E9] leading-snug">
                            {event.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{dateLabel}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {/* Time */}
                    <div className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                        <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>
                            {event.time}
                            {event.endTime && event.endTime !== event.time ? ` – ${event.endTime}` : ""}
                        </span>
                    </div>

                    {/* Description */}
                    {event.description && (
                        <div className="flex items-start gap-2.5">
                            <AlignLeft className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                            <p
                                className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.description) }}
                            />
                        </div>
                    )}

                    {/* Meet link */}
                    {event.meetLink && (
                        <a
                            href={event.meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 w-full rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                            <Video className="h-4 w-4 shrink-0" />
                            Join with Google Meet
                        </a>
                    )}
                </div>
            </motion.div>
        </div>
    )
}

// ── Weekly view ────────────────────────────────────────────────────────────────

function WeeklyView({ weekStart, events, todayStr, selectedDate, onSelectDate, onEventClick }: {
    weekStart: Date
    events: CalendarEvent[]
    todayStr: string
    selectedDate: string | null
    onSelectDate: (date: string) => void
    onEventClick: (event: CalendarEvent) => void
}) {
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + i)
        return d
    })

    return (
        <motion.div
            key={weekStart.toISOString()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="flex-1 overflow-auto"
        >
            <div className="grid grid-cols-7 h-full border-l border-t border-slate-100 dark:border-slate-700" style={{ minHeight: 400 }}>
                {days.map((day, i) => {
                    const dateStr = formatIsoDate(day)
                    const isToday = dateStr === todayStr
                    const isSelected = dateStr === selectedDate
                    const dayEvents = events
                        .filter(e => e.date === dateStr)
                        .sort((a, b) => parseMinutes(a.time) - parseMinutes(b.time))

                    return (
                        <div
                            key={i}
                            onClick={() => onSelectDate(dateStr)}
                            className={`flex flex-col border-b border-r border-slate-100 dark:border-slate-700 cursor-pointer transition-colors
                                ${isSelected ? "bg-blue-50/60 dark:bg-blue-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-700/20"}
                            `}
                        >
                            {/* Day header */}
                            <div className={`flex flex-col items-center py-3 border-b border-slate-100 dark:border-slate-700
                                ${isToday ? "bg-blue-600/5 dark:bg-blue-500/10" : ""}
                            `}>
                                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    {DAY_NAMES[i]}
                                </span>
                                <div className={`mt-1 w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold
                                    ${isToday
                                        ? "bg-blue-600 text-white shadow-sm shadow-blue-400/30"
                                        : "text-slate-700 dark:text-slate-300"
                                    }
                                `}>
                                    {day.getDate()}
                                </div>
                            </div>

                            {/* Events */}
                            <div className="flex-1 p-2 space-y-1">
                                {dayEvents.length === 0 ? (
                                    <div className="h-full" />
                                ) : (
                                    dayEvents.map(ev => (
                                        <EventPill key={ev.id} event={ev} compact onClick={() => onEventClick(ev)} />
                                    ))
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </motion.div>
    )
}

// ── Monthly view ───────────────────────────────────────────────────────────────

function DayCell({ day, events, isToday, isCurrentMonth, onClick, selected, onEventClick }: {
    day: number
    month: number
    year: number
    events: CalendarEvent[]
    isToday: boolean
    isCurrentMonth: boolean
    onClick: () => void
    selected: boolean
    onEventClick: (event: CalendarEvent) => void
}) {
    return (
        <div
            onClick={onClick}
            className={`min-h-[90px] p-2 border-b border-r border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors
                ${!isCurrentMonth ? "opacity-40" : ""}
                ${selected ? "bg-blue-50/60 dark:bg-blue-900/10" : ""}
            `}
        >
            <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1
                ${isToday
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-400/30"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }
            `}>
                {day}
            </div>
            <div className="space-y-0.5">
                {events.slice(0, 2).map(ev => (
                    <EventPill key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
                ))}
                {events.length > 2 && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 pl-1">+{events.length - 2} more</div>
                )}
            </div>
        </div>
    )
}

// ── Event detail panel ─────────────────────────────────────────────────────────

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
                    <h3 className="font-semibold text-slate-900 dark:text-[#E2E5E9] text-sm">{label}</h3>
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

// ── Page ───────────────────────────────────────────────────────────────────────

export function CalendarPage() {
    const today = new Date()
    const todayStr = formatIsoDate(today)

    const [view, setView] = useState<View>("weekly")
    const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
    const [weekStart, setWeekStart] = useState(() => getWeekStart(today))
    const [selectedDate, setSelectedDate] = useState<string | null>(todayStr)
    const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null)

    const monthDateForFetch = view === "weekly"
        ? new Date(weekStart.getFullYear(), weekStart.getMonth(), 1)
        : currentDate

    // When the visible week spans two months, fetch both so no events are missed
    const weekEndDate = new Date(weekStart)
    weekEndDate.setDate(weekStart.getDate() + 6)
    const weekCrossesMonth = view === "weekly" && (
        weekEndDate.getMonth() !== weekStart.getMonth() ||
        weekEndDate.getFullYear() !== weekStart.getFullYear()
    )

    const { events, loading: loadingEvents, error: gcalError } = useCalendarEvents({
        monthDate: monthDateForFetch,
        monthSpan: weekCrossesMonth ? 2 : 1,
    })

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
    const prevWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(d.getDate() - 7); return n })
    const nextWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(d.getDate() + 7); return n })

    const goToToday = () => {
        setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))
        setWeekStart(getWeekStart(today))
        setSelectedDate(todayStr)
    }

    // Build monthly grid
    const firstDayOfMonth = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    type GridDay = { day: number; month: number; year: number; isCurrentMonth: boolean }
    const cells: GridDay[] = []
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        cells.push({ day: daysInPrevMonth - i, month: month === 0 ? 11 : month - 1, year: month === 0 ? year - 1 : year, isCurrentMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, month, year, isCurrentMonth: true })
    }
    for (let d = 1; d <= 42 - cells.length; d++) {
        cells.push({ day: d, month: month === 11 ? 0 : month + 1, year: month === 11 ? year + 1 : year, isCurrentMonth: false })
    }

    const getEventsForDate = (d: number, m: number, y: number) =>
        events.filter(e => e.date === `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`)

    const selectedEvents = selectedDate ? events.filter(e => e.date === selectedDate) : []
    const upcomingEvents = events.filter(e => e.date >= todayStr).slice(0, 6)

    // Week range label
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
        ? `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()}–${weekEnd.getDate()}, ${weekStart.getFullYear()}`
        : `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTH_NAMES[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`

    return (
        <>
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 custom-scrollbar">
            <div className="mx-auto flex min-h-full max-w-screen-2xl flex-col gap-5 p-6 xl:h-full xl:flex-row xl:overflow-hidden">

                {gcalError && (
                    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-lg w-full mx-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-3 shadow-lg">
                        <span className="font-semibold">Google Calendar error:</span> {gcalError}
                    </div>
                )}

                {/* Main calendar panel */}
                <div className="flex-1 flex flex-col shrink-0 min-h-[500px] xl:min-h-0 xl:overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">

                    {/* Header */}
                    <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4 flex items-center justify-between shrink-0 gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <h1 className="text-lg font-bold text-slate-900 dark:text-[#E2E5E9] truncate">
                                {view === "weekly" ? weekLabel : `${MONTH_NAMES[month]} ${year}`}
                            </h1>
                            <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                    onClick={view === "weekly" ? prevWeek : prevMonth}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={view === "weekly" ? nextWeek : nextMonth}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                            <button
                                onClick={goToToday}
                                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                            >
                                Today
                            </button>
                            {loadingEvents && <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />}
                        </div>

                        {/* View toggle */}
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-900 shrink-0">
                            <button
                                onClick={() => setView("weekly")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all
                                    ${view === "weekly"
                                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-[#E2E5E9] shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    }
                                `}
                            >
                                Weekly
                            </button>
                            <button
                                onClick={() => setView("monthly")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all
                                    ${view === "monthly"
                                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-[#E2E5E9] shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    }
                                `}
                            >
                                Monthly
                            </button>
                        </div>
                    </div>

                    {/* Monthly day-name row */}
                    {view === "monthly" && (
                        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700 shrink-0">
                            {DAY_NAMES.map(d => (
                                <div key={d} className="py-2 text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    {d}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Weekly view */}
                    {view === "weekly" && (
                        <WeeklyView
                            weekStart={weekStart}
                            events={events}
                            todayStr={todayStr}
                            selectedDate={selectedDate}
                            onSelectDate={d => setSelectedDate(d === selectedDate ? null : d)}
                            onEventClick={setActiveEvent}
                        />
                    )}

                    {/* Monthly view */}
                    {view === "monthly" && (
                        <div className="flex-1 overflow-auto">
                            <motion.div
                                key={`${year}-${month}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.18 }}
                                className="grid grid-cols-7 border-l border-t border-slate-100 dark:border-slate-700 min-h-full"
                            >
                                {cells.map((cell, i) => {
                                    const dateStr = `${cell.year}-${String(cell.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`
                                    return (
                                        <DayCell
                                            key={i}
                                            day={cell.day}
                                            month={cell.month}
                                            year={cell.year}
                                            events={getEventsForDate(cell.day, cell.month, cell.year)}
                                            isToday={dateStr === todayStr}
                                            isCurrentMonth={cell.isCurrentMonth}
                                            selected={selectedDate === dateStr}
                                            onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                                            onEventClick={setActiveEvent}
                                        />
                                    )
                                })}
                            </motion.div>
                        </div>
                    )}
                </div>

                {/* Right sidebar */}
                <div className="w-full xl:w-72 shrink-0 flex flex-col gap-4 overflow-visible xl:overflow-auto">
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

                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
                        <h3 className="font-semibold text-slate-900 dark:text-[#E2E5E9] text-sm mb-4">Upcoming Events</h3>
                        {upcomingEvents.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-slate-500">No upcoming events.</p>
                        ) : (
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
                        )}
                    </div>
                </div>

            </div>
        </div>

            <AnimatePresence>
                {activeEvent && (
                    <EventModal event={activeEvent} onClose={() => setActiveEvent(null)} />
                )}
            </AnimatePresence>
        </>
    )
}
