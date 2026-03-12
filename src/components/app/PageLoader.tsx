import { Loader2 } from "lucide-react"

export function PageLoader({ label = "Loading dashboard..." }: { label?: string }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium">{label}</span>
            </div>
        </div>
    )
}
