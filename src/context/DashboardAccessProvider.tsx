import { useEffect, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { ShieldX } from "lucide-react"
import { PageLoader } from "@/components/app/PageLoader"
import { supabase } from "@/lib/supabase"
import { DashboardAccessContext, type DashboardRole } from "./DashboardAccessContext"
import { isAllowedDashboardEmail, normalizeDashboardEmail } from "@/features/auth/access"

type AccessState =
    | { status: "loading" }
    | { status: "allowed"; email: string; role: DashboardRole }
    | { status: "denied"; email: string; reason: string }

export function DashboardAccessProvider({ session, children }: { session: Session; children: ReactNode }) {
    const [access, setAccess] = useState<AccessState>({ status: "loading" })

    useEffect(() => {
        let active = true
        const email = normalizeDashboardEmail(session.user.email)

        if (!isAllowedDashboardEmail(email)) {
            setAccess({ status: "denied", email, reason: "This dashboard is restricted to Xperience USA team accounts." })
            return () => { active = false }
        }

        setAccess({ status: "loading" })
        supabase
            .from("dashboard_user_roles")
            .select("role, email")
            .eq("user_id", session.user.id)
            .maybeSingle()
            .then(({ data, error }) => {
                if (!active) return
                if (error || !data || !["superadmin", "user"].includes(data.role)) {
                    setAccess({
                        status: "denied",
                        email,
                        reason: error
                            ? "Your dashboard permissions are not configured yet."
                            : "Your account has not been authorized for this dashboard.",
                    })
                    return
                }
                setAccess({ status: "allowed", email, role: data.role as DashboardRole })
            })

        return () => { active = false }
    }, [session.user.email, session.user.id])

    if (access.status === "loading") return <PageLoader label="Checking your permissions..." />

    if (access.status === "denied") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    <ShieldX className="mx-auto h-10 w-10 text-red-500" />
                    <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">Access unavailable</h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{access.reason}</p>
                    {access.email && <p className="mt-2 text-xs text-slate-400">Signed in as {access.email}</p>}
                    <button
                        type="button"
                        onClick={() => void supabase.auth.signOut()}
                        className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Sign out
                    </button>
                </div>
            </div>
        )
    }

    return (
        <DashboardAccessContext.Provider value={{
            role: access.role,
            isSuperadmin: access.role === "superadmin",
            email: access.email,
        }}>
            {children}
        </DashboardAccessContext.Provider>
    )
}
