import { useState } from 'react'
import { Download } from 'lucide-react'
import { ACCOUNT_OPTIONS } from '@/features/social/hooks/useSocialDashboardState'

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

const selectClass = `w-full appearance-none rounded-lg border border-stroke bg-white px-3 py-2 text-sm
    text-black transition-colors hover:border-[#8B5CF6] focus:border-[#8B5CF6] focus:outline-none
    dark:border-strokedark dark:bg-boxdark dark:text-[#E2E5E9]`

// ponytail: form shell only — no generation yet. Wire the button to the export
// pipeline once the report format is decided.
export function SocialReports() {
    const [month, setMonth] = useState(new Date().getMonth())
    const [account, setAccount] = useState(ACCOUNT_OPTIONS[0].value)

    return (
        <div className="mx-auto max-w-screen-2xl">

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">Reports</h1>
                <p className="text-sm text-body dark:text-bodydark">Monthly social media report</p>
            </div>

            <div className="max-w-xl rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label htmlFor="report-month" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">
                            Month
                        </label>
                        <select id="report-month" value={month} onChange={e => setMonth(Number(e.target.value))} className={selectClass}>
                            {MONTHS.map((name, idx) => <option key={name} value={idx}>{name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="report-account" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">
                            Account
                        </label>
                        <select id="report-account" value={account} onChange={e => setAccount(e.target.value)} className={selectClass}>
                            {ACCOUNT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                </div>

                <button
                    disabled
                    title="Report generation is not wired up yet"
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 py-2.5
                               text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Download className="h-4 w-4" />
                    Download report
                </button>
            </div>

        </div>
    )
}
