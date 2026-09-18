import { useContext } from "react"
import { DashboardAccessContext } from "./DashboardAccessContext"

export function useDashboardAccess() {
    const access = useContext(DashboardAccessContext)
    if (!access) throw new Error("useDashboardAccess must be used inside DashboardAccessProvider")
    return access
}
