import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { NavLink } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
    Home, Users, CheckSquare, Calendar,
    ChevronDown, Search as SearchIcon,
    BarChart2, Share2, Palette, FileText,
    Bug, X
} from "lucide-react"
import { XMSLogo } from "@/components/ui/XMSLogo"
import { useSidebar } from "@/context/useSidebar"
import { getClients } from "@/features/clients/repository"
import { fetchClientProfiles } from "@/features/clients/profiles"
import { supabase } from "@/lib/supabase"

const activeClass = "bg-[#1F2937] text-white border border-transparent shadow-sm"
const inactiveClass = "text-[var(--sidebar-item-text)] hover:bg-[var(--sidebar-item-hover)] border border-transparent"

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
    if (collapsed) return <div className="mx-3 my-2 h-px bg-[var(--border)]" />
    return (
        <div className="flex items-center gap-2 px-3 pt-5 pb-1.5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sidebar-section-label)]">{label}</h2>
            <div className="flex-1 h-px bg-[var(--border)]" aria-hidden="true" />
        </div>
    )
}

export function Sidebar() {
    const [clientsOpen, setClientsOpen] = useState(false)
    const [bugOpen, setBugOpen] = useState(false)
    const [bugText, setBugText] = useState("")
    const [bugSent, setBugSent] = useState(false)
    const [clientLogos, setClientLogos] = useState<Record<string, string>>({})
    const bugTextareaRef = useRef<HTMLTextAreaElement>(null)
    const { collapsed, isMobileOpen, closeMobile } = useSidebar()
    const clients = getClients()

    useEffect(() => {
        let active = true
        fetchClientProfiles()
            .then(profiles => {
                if (!active) return
                setClientLogos(Object.fromEntries(
                    profiles.filter(profile => profile.logo_url).map(profile => [profile.client_id, profile.logo_url as string]),
                ))
            })
            .catch(() => { /* Keep the existing initials fallback. */ })
        return () => { active = false }
    }, [])

    useEffect(() => {
        if (bugOpen) setTimeout(() => bugTextareaRef.current?.focus(), 80)
    }, [bugOpen])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setBugOpen(false)
        }
        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [])

    const handleSendBug = async () => {
        if (!bugText.trim()) return
        const { data: { session } } = await supabase.auth.getSession()
        const { error } = await supabase.from("bug_reports").insert({
            description: bugText,
            user_email: session?.user?.email ?? null,
            created_at: new Date().toISOString(),
        })
        if (error) console.error("[BugReport] Failed to submit:", error.message)
        setBugSent(true)
        setTimeout(() => {
            setBugOpen(false)
            setBugText("")
            setBugSent(false)
        }, 1800)
    }

    const navItemClass = collapsed
        ? "relative group flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all text-sm font-semibold"
        : "relative group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold w-full"

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
                className={`fixed inset-y-0 left-0 z-50 flex flex-col h-screen border-r shrink-0 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 overflow-x-visible bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] sidebar-shadow ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}
                style={{ width: collapsed ? 64 : 232 }}
            >
                {/* Logo */}
                <div className={`h-16 border-b border-[var(--sidebar-border)] flex items-center transition-all duration-200 ${collapsed ? "justify-center px-3" : "px-5 justify-between"}`}>
                    {collapsed ? (
                        <img
                            src="/xms-isotipo.png"
                            alt="XMS"
                            className="h-9 w-9 rounded-xl object-contain shrink-0"
                            draggable={false}
                        />
                    ) : (
                        <>
                            <XMSLogo mode="auto" height={55} className="max-w-[160px]" />
                            <span className="text-[8px] font-semibold opacity-40 text-[var(--brand-accent)] bg-[var(--brand-accent-subtle)] px-1 py-0.5 rounded-full tracking-widest uppercase shrink-0">Beta</span>
                        </>
                    )}
                </div>

                <nav className={`flex-1 ${collapsed ? "px-0 py-2" : "px-3"} overflow-y-auto custom-scrollbar pb-2 space-y-0.5`}>

                    <SectionLabel label="Menu" collapsed={collapsed} />

                    <div className="relative group">
                        <NavLink to="/" end onClick={closeMobile} className={({ isActive }) => `${navItemClass} ${isActive ? activeClass : inactiveClass}`}>
                            <Home className="w-4 h-4 shrink-0" />
                            {!collapsed && "Home"}
                        </NavLink>
                        {collapsed && <Tooltip label="Home" />}
                    </div>

                    <div className="relative group">
                        <NavLink to="/calendar" onClick={closeMobile} className={({ isActive }) => `${navItemClass} ${isActive ? activeClass : inactiveClass}`}>
                            <Calendar className="w-4 h-4 shrink-0" />
                            {!collapsed && "Calendar"}
                        </NavLink>
                        {collapsed && <Tooltip label="Calendar" />}
                    </div>

                    <div className="relative group">
                        <NavLink to="/tasks" onClick={closeMobile} className={({ isActive }) => `${navItemClass} ${isActive ? activeClass : inactiveClass}`}>
                            <CheckSquare className="w-4 h-4 shrink-0" />
                            {!collapsed && "Tasks"}
                        </NavLink>
                        {collapsed && <Tooltip label="Tasks" />}
                    </div>

                    <div className="relative group">
                        <NavLink to="/guidelines" onClick={closeMobile} className={({ isActive }) => `${navItemClass} ${isActive ? activeClass : inactiveClass}`}>
                            <FileText className="w-4 h-4 shrink-0" />
                            {!collapsed && "Guidelines"}
                        </NavLink>
                        {collapsed && <Tooltip label="Guidelines" />}
                    </div>

                    {/* Clients */}
                    {collapsed ? (
                        <div className="relative group">
                            <NavLink to="/clients/coca-cola" onClick={closeMobile} className={({ isActive }) => `${navItemClass} ${isActive ? activeClass : inactiveClass}`}>
                                <Users className="w-4 h-4 shrink-0" />
                            </NavLink>
                            <Tooltip label="Clients" />
                        </div>
                    ) : (
                        <div>
                            <button
                                onClick={() => setClientsOpen(o => !o)}
                                className={`relative group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold w-full ${inactiveClass} justify-between`}
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
                                        <ul className="ml-4 mt-1 space-y-0.5 border-l border-[var(--border)] pl-3 pb-1">
                                            <li>
                                                <NavLink
                                                    to="/clients"
                                                    end
                                                    onClick={closeMobile}
                                                    className={({ isActive }) =>
                                                        `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-semibold transition-all ${isActive
                                                            ? "bg-[#1F2937] text-white"
                                                            : "text-[var(--sidebar-item-text)] hover:bg-[var(--sidebar-item-hover)]"
                                                        }`
                                                    }
                                                >
                                                    <div className="w-6 h-6 rounded-md bg-black/10 dark:bg-white/10 flex items-center justify-center shrink-0">
                                                        <Users className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="truncate">All Clients</span>
                                                </NavLink>
                                            </li>
                                            {clients.map(client => (
                                                <li key={client.id}>
                                                    <NavLink
                                                        to={`/clients/${client.id}`}
                                                        onClick={closeMobile}
                                                        className={({ isActive }) =>
                                                            `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                                                ? "bg-[#1F2937] text-white"
                                                                : "text-[var(--sidebar-item-text)] hover:bg-[var(--sidebar-item-hover)]"
                                                            }`
                                                        }
                                                    >
                                                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md text-[9px] font-bold text-white ${clientLogos[client.id] ? "border border-slate-200 bg-white" : client.color}`}>
                                                            {clientLogos[client.id] ? (
                                                                <img src={clientLogos[client.id]} alt={`${client.name} logo`} className="h-full w-full object-contain p-0.5" />
                                                            ) : client.initials}
                                                        </div>
                                                        <span className="truncate">{client.name}</span>
                                                        <span className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${client.status === "active" ? "bg-green-500" : "bg-slate-400"}`} />
                                                    </NavLink>
                                                </li>
                                            ))}
                                        </ul>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    <SectionLabel label="Apps" collapsed={collapsed} />

                    <div className="relative group">
                        <NavLink to="/seo" className={({ isActive }) => `${navItemClass} ${isActive ? activeClass : inactiveClass}`}>
                            <SearchIcon className="w-4 h-4 shrink-0" />
                            {!collapsed && <span>SEO Intelligence</span>}
                        </NavLink>
                        {collapsed && <Tooltip label="SEO Intelligence" />}
                    </div>

                    <div className="relative group">
                        <NavLink to="/sem" className={({ isActive }) => `${navItemClass} ${isActive ? activeClass : inactiveClass}`}>
                            <BarChart2 className="w-4 h-4 shrink-0" />
                            {!collapsed && <span>SEM Intelligence</span>}
                        </NavLink>
                        {collapsed && <Tooltip label="SEM Intelligence" />}
                    </div>

                    <div className="relative group">
                        <NavLink to="/social" className={({ isActive }) => `${navItemClass} ${isActive ? activeClass : inactiveClass}`}>
                            <Share2 className="w-4 h-4 shrink-0" />
                            {!collapsed && <span>Social Media</span>}
                        </NavLink>
                        {collapsed && <Tooltip label="Social Media" />}
                    </div>

                    <div className="relative group">
                        <div className={`${navItemClass} opacity-50 cursor-not-allowed`}>
                            <Palette className="w-4 h-4 shrink-0" />
                            {!collapsed && (
                                <span className="flex items-center gap-2 flex-1">
                                    Design
                                    <span className="text-[10px] font-semibold bg-yellow-400/20 text-yellow-500 px-1.5 py-0.5 rounded-full leading-none">Working</span>
                                </span>
                            )}
                        </div>
                        {collapsed && <Tooltip label="Design (Working)" />}
                    </div>

                </nav>

                {/* Bottom: Report a Bug */}
                <div className={`${collapsed ? "px-0 py-3" : "px-3 pb-4 pt-3"} border-t border-[var(--sidebar-border)] space-y-0.5`}>
                    <div className="relative group">
                        <button
                            onClick={() => setBugOpen(true)}
                            className={`${navItemClass} ${inactiveClass} w-full`}
                        >
                            <Bug className="w-4 h-4 shrink-0" />
                            {!collapsed && "Report a Bug"}
                        </button>
                        {collapsed && <Tooltip label="Report a Bug" />}
                    </div>
                </div>
            </aside>

            {/* Bug report modal */}
            <AnimatePresence>
                {bugOpen && createPortal(
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                        onClick={e => { if (e.target === e.currentTarget) setBugOpen(false) }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 8 }}
                            transition={{ duration: 0.2 }}
                            role="dialog"
                            aria-modal="true"
                            aria-label="Report a bug"
                            className="bg-[var(--bg-raised)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--border)] overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 bg-[var(--brand-accent-subtle)] rounded-xl flex items-center justify-center">
                                            <Bug className="w-5 h-5 text-[var(--brand-accent)]" />
                                        </div>
                                        <div>
                                            <h2 className="font-semibold text-[var(--text-primary)] text-sm">Report a Bug</h2>
                                            <p className="text-[11px] text-[var(--text-muted)]">Help us improve XMS</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setBugOpen(false)}
                                        className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-muted)] transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {bugSent ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="py-8 text-center"
                                    >
                                        <div className="w-14 h-14 bg-[var(--success-bg)] rounded-full flex items-center justify-center mx-auto mb-3">
                                            <svg className="w-7 h-7 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <p className="font-semibold text-[var(--text-primary)] text-sm">Report sent!</p>
                                        <p className="text-xs text-[var(--text-muted)] mt-1">Our support team will review it shortly.</p>
                                    </motion.div>
                                ) : (
                                    <>
                                        <p className="text-sm text-[var(--text-muted)] mb-4">
                                            Describe the issue you encountered and our support team will work on a fix.
                                        </p>
                                        <textarea
                                            ref={bugTextareaRef}
                                            value={bugText}
                                            onChange={e => setBugText(e.target.value)}
                                            placeholder="What went wrong? What did you expect to happen?"
                                            rows={5}
                                            className="w-full text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-primary)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4 placeholder:text-[var(--text-muted)]"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleSendBug}
                                                disabled={!bugText.trim()}
                                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                                            >
                                                Send Report
                                            </button>
                                            <button
                                                onClick={() => setBugOpen(false)}
                                                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>,
                    document.body
                )}
            </AnimatePresence>
        </>
    )
}
