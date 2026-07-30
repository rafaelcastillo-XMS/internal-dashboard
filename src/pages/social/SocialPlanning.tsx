import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Empty month grid. No content source is wired yet, so every day renders blank
// rather than borrowing events from the Google Calendar module.
export function SocialPlanning() {
    const today = new Date()
    const [month, setMonth] = useState(today.getMonth())
    const [year, setYear] = useState(today.getFullYear())

    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const cells: { day: number; currentMonth: boolean }[] = []
    for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrevMonth - i, currentMonth: false })
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, currentMonth: true })
    while (cells.length % 7 !== 0) cells.push({ day: cells.length % 7, currentMonth: false })

    function shift(delta: number) {
        const d = new Date(year, month + delta, 1)
        setMonth(d.getMonth())
        setYear(d.getFullYear())
    }

    const isToday = (day: number, currentMonth: boolean) =>
        currentMonth && day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

    return (
        <div className="mx-auto max-w-screen-2xl p-6">

            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">Planning</h1>
                    <p className="text-sm text-body dark:text-bodydark">Content calendar</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => shift(-1)}
                        className="rounded-lg border border-stroke p-2 text-body transition-colors hover:bg-gray-2 dark:border-strokedark dark:text-bodydark dark:hover:bg-meta-4">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-[160px] text-center text-sm font-semibold text-black dark:text-[#E2E5E9]">
                        {MONTH_NAMES[month]} {year}
                    </span>
                    <button onClick={() => shift(1)}
                        className="rounded-lg border border-stroke p-2 text-body transition-colors hover:bg-gray-2 dark:border-strokedark dark:text-bodydark dark:hover:bg-meta-4">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="grid grid-cols-7 border-b border-stroke dark:border-strokedark">
                    {DAY_NAMES.map(name => (
                        <div key={name} className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">
                            {name}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {cells.map((cell, idx) => (
                        <div key={idx}
                            className={`min-h-[90px] border-b border-r border-stroke p-2 dark:border-strokedark ${cell.currentMonth ? '' : 'opacity-40'}`}>
                            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isToday(cell.day, cell.currentMonth)
                                ? 'bg-[#8B5CF6] text-white'
                                : 'text-body dark:text-bodydark'}`}>
                                {cell.day}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    )
}
