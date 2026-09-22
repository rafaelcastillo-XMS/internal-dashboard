import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, RefreshCw, AlertCircle } from "lucide-react"
import { edgeFetch } from "@/lib/edgeFetch"
import { SEO_API } from "@/features/seo/hooks/useSEODashboardState"

type Connection = {
    connected: boolean
    requiredEmail: string
    checkedAt: string
    code: string | null
    message: string
}

export function SeoGoogleConnection({ compact = false }: { compact?: boolean }) {
    const [connection, setConnection] = useState<Connection | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [revision, setRevision] = useState(0)
    const refresh = useCallback(() => setRevision(value => value + 1), [])

    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        edgeFetch(`${SEO_API}/connection`, { signal: controller.signal })
            .then(async response => {
                const data = await response.json()
                if (!response.ok || typeof data.connected !== "boolean") throw new Error("Unable to check the SEO connection. Try again shortly.")
                if (!controller.signal.aborted) { setConnection(data); setError("") }
            })
            .catch((error: Error) => { if (!controller.signal.aborted) setError(error.message) })
            .finally(() => { if (!controller.signal.aborted) setLoading(false) })
        return () => controller.abort()
    }, [revision])

    useEffect(() => {
        const timer = window.setInterval(refresh, 5 * 60_000)
        window.addEventListener("focus", refresh)
        return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh) }
    }, [refresh])

    const healthy = connection?.connected && !error
    const needsAuthorization = ["SEO_RECONNECT_REQUIRED", "SEO_WRONG_ACCOUNT", "SEO_NOT_CONFIGURED"].includes(connection?.code ?? "")
    if (compact && (loading || healthy)) return null

    return (
        <section aria-label="SEO Google connection" className={`${compact ? "m-4" : "mt-4"} rounded-xl border ${healthy ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20"} p-4 text-sm`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100" aria-live="polite">
                        {healthy ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
                        {loading ? "Checking SEO connection…" : healthy ? "Automatic connection active" : needsAuthorization && !error ? "Google authorization required" : "Connection check needed"}
                    </p>
                    <p className="mt-1 break-all text-xs text-slate-700 dark:text-slate-300">{connection?.requiredEmail ?? "xperiencemarketingsolutions@gmail.com"}</p>
                </div>
                <button type="button" onClick={refresh} disabled={loading} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200">
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Check connection
                </button>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{error || connection?.message || "Verifying the saved Google authorization…"}</p>
            {!compact && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Shared across all clients. Access renews automatically, even after you sign out of the dashboard. SEO always uses this Gmail account.</p>}
            {needsAuthorization && !error && <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">Ask a dashboard administrator to authorize this Gmail account again using the SEO connection setup. Your client property assignments are retained.</p>}
            {connection?.checkedAt && !error && !loading && <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Last checked: {new Date(connection.checkedAt).toLocaleString()}</p>}
        </section>
    )
}
