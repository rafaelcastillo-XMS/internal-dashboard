import { useState } from "react"
import { SidebarContext } from "./sidebar-context"

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false)
    const [isMobileOpen, setIsMobileOpen] = useState(false)

    return (
        <SidebarContext.Provider value={{
            collapsed,
            toggle: () => setCollapsed(c => !c),
            isMobileOpen,
            toggleMobile: () => setIsMobileOpen(o => !o),
            closeMobile: () => setIsMobileOpen(false)
        }}>
            {children}
        </SidebarContext.Provider>
    )
}
