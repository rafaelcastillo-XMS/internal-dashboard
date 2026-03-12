import { createContext } from "react"

type SidebarCtx = {
    collapsed: boolean
    toggle: () => void
    isMobileOpen: boolean
    toggleMobile: () => void
    closeMobile: () => void
}

export const SidebarContext = createContext<SidebarCtx>({
    collapsed: false,
    toggle: () => { },
    isMobileOpen: false,
    toggleMobile: () => { },
    closeMobile: () => { },
})
