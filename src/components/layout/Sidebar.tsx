import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { NavLink, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
    LayoutDashboard, Users, CheckSquare, Calendar,
    ChevronDown, MessageSquare, Search as SearchIcon,
    BarChart2, Share2, Palette, User, FileText
} from "lucide-react"
import { XMSLogo } from "@/components/ui/XMSLogo"
import { useSidebar } from "@/context/useSidebar"
import { getClients } from "@/features/clients/repository"

const activeClass = "bg-blue-600/15 text-blue-400 border border-blue-500/20"
const inactiveClass = "text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent"

function Tooltip({ label }: { label: string }) {
    const ref = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0 })

    useEffect(() => {
        const parent = ref.current?.parentElement
        if (!parent) return

        const handleEnter = () => {
            const rect = parent.getBoundingClientRect()
            setCoords({ top: rect.top + rect.height / 2, left: rect.right })
            setVisible(true)
        }
        const handleLeave = () => setVisible(false)

        parent.addEventListener("mouseenter", handleEnter)
        parent.addEventListener("mouseleave", handleLeave)
        return () => {
            parent.removeEventListener("mouseenter", handleEnter)
            parent.removeEventListener("mouseleave", handleLeave)
        }
    }, [])

    return (
        <>
            <div ref={ref} className="hidden" />
            {visible && createPortal(
                <div
                    className="fixed -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-700 text-white text-[11px] font-medium rounded-lg z-[100] shadow-lg pointer-events-none whitespace-nowrap"
                    style={{ top: coords.top, left: coords.left }}
                >
                    {label}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-700" />
                </div>,
                document.body
            )}
        </>
    )
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
    if (collapsed) return <div className="mx-3 my-2 h-px bg-slate-800/80" />
    return (
        <div className="flex items-center gap-2 px-3 pt-5 pb-1.5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{label}</h2>
            <div className="flex-1 h-px bg-slate-800/80" aria-hidden="true" />
        </div>
    )
}

export function Sidebar() {
    const [clientsOpen, setClientsOpen] = useState(false)
    const navigate = useNavigate()
    const { collapsed, isMobileOpen, closeMobile } = useSidebar()
    const clients = getClients()

    const navItemClass = collapsed
        ? "relative group flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-all text-sm font-medium"
        : "relative group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium w-full"

    return (
        <>
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isMobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeMobile}
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                    />
                )}
            </AnimatePresence>

            <aside
                className={`fixed inset-y-0 left-0 z-50 flex flex-col h-screen border-r border-slate-800/60 shrink-0 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 overflow-x-visible ${isMobileOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
                style={{ background: "#0d0d12", width: collapsed ? 64 : 288 }}
            >
                {/* Logo */}
                <div className={`border-b border-slate-800/60 flex items-center transition-all duration-200 ${collapsed ? "justify-center px-3 py-4" : "px-5 py-5 justify-between"}`}>
                    {collapsed ? (
                        <div className="w-8 h-8 bg-blue-600 rounded-full shrink-0" />
                    ) : (
                        <>
                            <XMSLogo mode="dark" height={50} />
                            <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full tracking-widest uppercase shrink-0">Beta</span>
                        </>
                    )}
                </div>

                <nav className={`flex-1 ${collapsed ? "px-0 py-2" : "px-3"} overflow-y-auto custom-scrollbar pb-2 space-y-0.5`}>

                    <SectionLabel label="Menu" collapsed={collapsed} />

                    {/* Dashboard */}
                    <div className="relative group">
                        <NavLink
                            to="/"
                            end
                            onClick={closeMobile}
                            className={({ isActive }) => `${navItemClass} ${isActive ? activeClass : inactiveClass}`}
                        >
                            <LayoutDashboard className="w-4 h-4 shrink-0" />
                            {!collapsed && "Dashboard"}
                        </NavLink>
                        {collapsed && <Tooltip label="Dashboard" />}
                    </div>

                    {/* Clients */}
                    {collapsed ? (
                        <div className="relative group">
                            <NavLink
                                to="/clients/coca-cola"
                                onClick={closeMobile}
                                className={({ isActive }) => `${navItemClass} ${isActive ? activeClass : inactiveClass}`}
                            >
                                <Users className="w-4 h-4 shrink-0" />
                            </NavLink>
                            <Tooltip label="Clients" />
                        </div>
                    ) : (
                        <div>
                            <button
                                onClick={() => setClientsOpen(o => !o)}
                                className={`relative group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium w-full ${inactiveClass} justify-between`}
                            >
                                <span className="flex items-center gap-3">
                                    <Users className="w-4 h-4 shrink-0" />
                                    Clients
                                </span>
                                <motion.span animate={{ rotate: clientsOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                    <ChevronDown className="w-3.5 h-3.5" />
                                </motion.span>
                            </button>

                            <AnimatePresence initial={false}>
                                {clientsOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.22, ease: "easeInOut" }}
                                        className="overflow-hidden"
                                    >
                                        <ul className="ml-4 mt-1 space-y-0.5 border-l border-slate-800 pl-3 pb-1">
                                            <li>
                                                <NavLink
                                                    to="/clients"
                                                    end
                                                    onClick={closeMobile}
                                                    className={({ isActive }) =>
                                                        `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all ${isActive
                                                            ? "text-blue-400 bg-blue-600/10"
                                                            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                                                        }`
                                                    }
                                                >
                                                    <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                                        <Users className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="truncate font-medium">All Clients</span>
                                                </NavLink>
                                            </li>
                                            {clients.map(client => (
                                                <li key={client.id}>
                                                    <NavLink
                                                        to={`/clients/${client.id}`}
                                                        onClick={closeMobile}
                                                        className={({ isActive }) =>
                                                            `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all ${isActive
                                                                ? "text-blue-400 bg-blue-600/10"
                                                                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                                                            }`
                                                        }
                                                    >
                                                        <div className={`w-6 h-6 rounded-md ${client.color} flex items-center justify-center text-white font-bold text-[9px] shrink-0`}>
                                                            {client.initials}
                                                        </div>
                                                        <span className="truncate">{client.name}</span>
                                                        <span className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${client.status === "active" ? "bg-green-500" : "bg-slate-400"}`} />
                                                    </NavLink>
                                                </li>
                                            ))}
                                            <li>
                                                <button
                                                    onClick={() => { navigate("/clients/coca-cola"); closeMobile(); }}
                                                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-600 hover:text-slate-400 transition-colors"
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    All conversations
                                                </button>
                                            </li>
                                        </ul>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Tasks */}
                    <div className="relative group">
                        <NavLink
                            to="/tasks"
                            onClick={closeMobile}
                            className={({ isActive }) => `${navItemClass} ${isActive ? activeClass : inactiveClass}`}
                        >
                            <CheckSquare className="w-4 h-4 shrink-0" />
                            {!collapsed && "Tasks"}
                        </NavLink>
                        {collapsed && <Tooltip label="Tasks" />}
                    </div>

                    {/* Calendar */}
                    <div className="relative group">
                        <NavLink
                            to="/calendar"
                            onClick={closeMobile}
                            className={({ isActive }) => `${navItemClass} ${isActive ? activeClass : inactiveClass}`}
                        >
                            <Calendar className="w-4 h-4 shrink-0" />
                            {!collapsed && "Calendar"}
                        </NavLink>
                        {collapsed && <Tooltip label="Calendar" />}
                    </div>

                    {/* Guidelines */}
                    <div className="relative group">
                        <button
                            onClick={closeMobile}
                            className={`${navItemClass} ${inactiveClass}`}
                        >
                            <FileText className="w-4 h-4 shrink-0" />
                            {!collapsed && "Guidelines"}
                        </button>
                        {collapsed && <Tooltip label="Guidelines" />}
                    </div>

                    {/* APPS section */}
                    <SectionLabel label="Apps" collapsed={collapsed} />

                    <div className="relative group">
                        <button className={`${navItemClass} ${inactiveClass} opacity-80`} onClick={() => alert("This app is coming soon!")}>
                            <SearchIcon className="w-4 h-4 shrink-0" />
                            {!collapsed && <>SEO <span className="ml-auto text-[9px] font-semibold text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded-full">Soon</span></>}
                        </button>
                        {collapsed && <Tooltip label="SEO – Coming soon" />}
                    </div>

                    <div className="relative group">
                        <button className={`${navItemClass} ${inactiveClass} opacity-80`} onClick={() => alert("This app is coming soon!")}>
                            <BarChart2 className="w-4 h-4 shrink-0" />
                            {!collapsed && <>SEM <span className="ml-auto text-[9px] font-semibold text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded-full">Soon</span></>}
                        </button>
                        {collapsed && <Tooltip label="SEM – Coming soon" />}
                    </div>

                    <div className="relative group">
                        <button className={`${navItemClass} ${inactiveClass} opacity-80`} onClick={() => alert("This app is coming soon!")}>
                            <Share2 className="w-4 h-4 shrink-0" />
                            {!collapsed && <>Social Media <span className="ml-auto text-[9px] font-semibold text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded-full">Soon</span></>}
                        </button>
                        {collapsed && <Tooltip label="Social Media – Coming soon" />}
                    </div>

                    <div className="relative group">
                        <button className={`${navItemClass} ${inactiveClass} opacity-80`} onClick={() => alert("This app is coming soon!")}>
                            <Palette className="w-4 h-4 shrink-0" />
                            {!collapsed && <>Design <span className="ml-auto text-[9px] font-semibold text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded-full">Soon</span></>}
                        </button>
                        {collapsed && <Tooltip label="Design – Coming soon" />}
                    </div>

                </nav>

                {/* Bottom: Profile + Settings */}
                <div className={`${collapsed ? "px-0 py-3" : "px-3 pb-4 pt-3"} border-t border-slate-800/60 space-y-0.5`}>
                    <div className="relative group">
                        <NavLink
                            to="/profile"
                            onClick={closeMobile}
                            className={({ isActive }) => `${navItemClass} ${isActive ? activeClass : inactiveClass}`}
                        >
                            <User className="w-4 h-4 shrink-0" />
                            {!collapsed && "My Profile"}
                        </NavLink>
                        {collapsed && <Tooltip label="My Profile" />}
                    </div>

                </div>
            </aside>
        </>
    )
}
