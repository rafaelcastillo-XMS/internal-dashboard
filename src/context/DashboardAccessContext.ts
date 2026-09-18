import { createContext } from "react"

export type DashboardRole = "superadmin" | "user"

export type DashboardAccess = {
    role: DashboardRole
    isSuperadmin: boolean
    email: string
}

export const DashboardAccessContext = createContext<DashboardAccess | null>(null)
