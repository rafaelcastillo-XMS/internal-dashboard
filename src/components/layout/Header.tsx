import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Moon, Sun, ChevronDown, X, LogOut, User, ArrowUp, PanelLeft, MoreVertical } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useTheme } from "@/context/useTheme"
import { useSidebar } from "@/context/useSidebar"
import { supabase } from "@/lib/supabase"


interface HeaderProps {
    onMobileMenuClick?: () => void
}

export function Header({ onMobileMenuClick }: HeaderProps = {}) {
    const { theme, toggleTheme } = useTheme()
    const { collapsed, toggle: toggleSidebar, toggleMobile } = useSidebar()
    const navigate = useNavigate()
    const { pathname } = useLocation()

    const [userName, setUserName] = useState("Rafael A.")
    const [userAvatar, setUserAvatar] = useState("")
    const [userInitials, setUserInitials] = useState("RA")

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return
            const meta = session.user.user_metadata
            const fullName: string = meta?.full_name ?? meta?.name ?? ""
            if (fullName) {
                const parts = fullName.split(" ")
                setUserName(parts[0] + (parts[1] ? " " + parts[1][0] + "." : ""))
                setUserInitials((parts[0][0] ?? "") + (parts[1]?.[0] ?? ""))
            }
            setUserAvatar(meta?.picture ?? meta?.avatar_url ?? "")
        })
    }, [])

    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [aiOpen, setAiOpen] = useState(false)
    const [aiQuery, setAiQuery] = useState("")
    const [aiResponse, setAiResponse] = useState("")
    const [aiLoading, setAiLoading] = useState(false)
    const aiInputRef = useRef<HTMLTextAreaElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const mobileMenuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false)
            }
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
                setMobileMenuOpen(false)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault()
                openAI()
            }
            if (e.key === "Escape") {
                setAiOpen(false)
                setMobileMenuOpen(false)
            }
        }
        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [])

    const handleAskAI = async () => {
        if (!aiQuery.trim() || aiLoading) return
        setAiLoading(true)
        setAiResponse("")
        try {
            // Build dashboard context to send alongside the query
            const context: Record<string, unknown> = {
                today: new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
                currentPage: pathname,
            }

            // Fetch Monday.com tasks for the current user
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user?.email) {
                try {
                    const mondayRes = await fetch(`/api/monday/tasks?email=${encodeURIComponent(session.user.email)}`)
                    if (mondayRes.ok) {
                        const { tasks } = await mondayRes.json()
                        context.tasks = tasks
                    }
                } catch { /* tasks unavailable, continue without them */ }
            }

            const res = await fetch("/api/ai/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: aiQuery, context }),
            })
            const data = await res.json()
            setAiResponse(data.response ?? data.error ?? "No response")
        } catch {
            setAiResponse("Error al conectar con la IA. Inténtalo de nuevo.")
        } finally {
            setAiLoading(false)
        }
    }

    const handleAiKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleAskAI()
        }
    }

    const renderAiResponse = (text: string) => {
        return text.split("\n").filter(l => l.trim()).map((line, i) => {
            const parts = line.split(/\*\*(.+?)\*\*/g).map((part, j) =>
                j % 2 === 1 ? <strong key={j} className="font-semibold text-[var(--text-primary)]">{part}</strong> : part
            )
            return <p key={i} className="text-sm text-[var(--text-secondary)] leading-relaxed">{parts}</p>
        })
    }

    const openAI = () => {
        setAiOpen(true)
        setAiQuery("")
        setAiResponse("")
        setTimeout(() => aiInputRef.current?.focus(), 80)
    }

    return (
        <>
            <header className="h-16 bg-white/90 dark:bg-[#1C2438]/90 backdrop-blur-md border-b border-[var(--sidebar-border)] flex items-center px-6 justify-between shrink-0 z-[100] sticky top-0">
                <div className="flex items-center gap-2">
                    {/* Sidebar toggle - Mobile */}
                    <button
                        onClick={onMobileMenuClick ?? toggleMobile}
                        aria-label="Toggle mobile sidebar"
                        className="lg:hidden p-2 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        <PanelLeft className="w-5 h-5" />
                    </button>

                    {/* Sidebar toggle - Desktop */}
                    <button
                        onClick={toggleSidebar}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className="hidden lg:flex p-2 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        <PanelLeft className="w-5 h-5" />
                    </button>

                </div>

                <div className="flex items-center gap-1">
                    {/* Desktop Theme & Bug Buttons */}
                    <div className="hidden lg:flex items-center gap-1">
                        {/* Dark mode toggle */}
                        <button
                            onClick={toggleTheme}
                            aria-label="Toggle dark mode"
                            className="p-2 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            {theme === "dark" ? (
                                <Sun className="w-5 h-5 text-amber-400" />
                            ) : (
                                <Moon className="w-5 h-5" />
                            )}
                        </button>

                        {/* My Profile button */}
                        <div className="relative group">
                            <button
                                onClick={() => navigate("/profile")}
                                aria-label="My Profile"
                                className="p-2 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                <User className="w-5 h-5" />
                            </button>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-[var(--text-primary)] text-[var(--bg-surface)] text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-50">
                                My Profile
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--text-primary)] rotate-45" />
                            </div>
                        </div>
                    </div>

                    {/* Mobile More Options Menu */}
                    <div className="relative lg:hidden" ref={mobileMenuRef}>
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="More options"
                            className="p-2 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            <MoreVertical className="w-5 h-5" />
                        </button>

                        <AnimatePresence>
                            {mobileMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-raised)] rounded-xl shadow-lg border border-[var(--border)] overflow-hidden z-50"
                                >
                                    <div className="py-1">
                                        <button
                                            onClick={() => { toggleTheme(); setMobileMenuOpen(false); }}
                                            className="w-full px-4 py-2.5 text-sm text-left flex items-center justify-between text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                                        >
                                            <span className="flex items-center gap-2">
                                                {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                                                {theme === "dark" ? "Light Mode" : "Dark Mode"}
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => { navigate("/profile"); setMobileMenuOpen(false); }}
                                            className="w-full px-4 py-2.5 text-sm text-left flex items-center gap-2 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                                        >
                                            <User className="w-4 h-4" />
                                            My Profile
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* User profile button with dropdown */}
                    <div className="relative ml-1" ref={dropdownRef}>
                        <button
                            onClick={() => setDropdownOpen(o => !o)}
                            className="flex h-10 items-center gap-2.5 rounded-full pl-2 pr-3 transition-colors hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            <Avatar className="w-8 h-8 ring-2 ring-transparent hover:ring-blue-200 dark:hover:ring-blue-800 transition-all">
                                <AvatarImage src={userAvatar} referrerPolicy="no-referrer" />
                                <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">{userInitials}</AvatarFallback>
                            </Avatar>
                            <div className="hidden md:flex flex-col items-start leading-tight">
                                <span className="text-sm font-semibold text-[var(--text-primary)]">{userName}</span>
                                <span className="text-[10px] text-[var(--text-muted)]">Marketing Strategist</span>
                            </div>
                            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] hidden md:block" />
                        </button>

                        <AnimatePresence>
                            {dropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                                    transition={{ duration: 0.15 }}
                                    role="menu"
                                    aria-label="User menu"
                                    className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-raised)] rounded-xl shadow-xl border border-[var(--border)] overflow-hidden z-50"
                                >
                                    <button
                                        role="menuitem"
                                        onClick={() => { navigate("/profile"); setDropdownOpen(false) }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors text-left"
                                    >
                                        <User className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" /> Edit Profile
                                    </button>
                                    <div className="border-t border-[var(--border)]" />
                                    <button
                                        role="menuitem"
                                        onClick={async () => {
                                            setDropdownOpen(false)
                                            await supabase.auth.signOut()
                                            navigate("/login")
                                        }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors text-left"
                                    >
                                        <LogOut className="w-4 h-4" aria-hidden="true" /> Sign Out
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header >

            {/* AI Assistant modal */}
            <AnimatePresence>
                {
                    aiOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/40 backdrop-blur-sm p-4"
                            onClick={e => { if (e.target === e.currentTarget) setAiOpen(false) }}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96, y: -12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: -12 }}
                                transition={{ duration: 0.18 }}
                                role="dialog"
                                aria-modal="true"
                                aria-label="AI Assistant"
                                className="bg-[var(--bg-raised)] rounded-2xl shadow-2xl w-full max-w-lg border border-[var(--border)] overflow-hidden"
                            >
                                {/* Header */}
                                <div className="px-5 pt-5 pb-4 border-b border-[var(--border)] flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-sm">
                                            <Sparkles className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-[var(--text-primary)]">XMS AI Assistant</p>
                                            <p className="text-[10px] text-[var(--text-muted)]">Ask anything about your campaigns, tasks or clients</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setAiOpen(false)}
                                        className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-muted)] transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Response area */}
                                <div className="px-5 py-4 min-h-[100px]">
                                    {aiLoading ? (
                                        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                                            <motion.div
                                                animate={{ opacity: [0.4, 1, 0.4] }}
                                                transition={{ duration: 1.2, repeat: Infinity }}
                                                className="flex gap-1"
                                            >
                                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full block" />
                                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full block" />
                                                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full block" />
                                            </motion.div>
                                            Thinking...
                                        </div>
                                    ) : aiResponse ? (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.25 }}
                                            className="flex gap-3"
                                        >
                                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shrink-0 mt-0.5">
                                                <Sparkles className="w-3.5 h-3.5 text-white" />
                                            </div>
                                            <div className="space-y-1">{renderAiResponse(aiResponse)}</div>
                                        </motion.div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {["What are my priorities today?", "How are my clients doing?", "Show me performance stats"].map(suggestion => (
                                                <button
                                                    key={suggestion}
                                                    onClick={() => { setAiQuery(suggestion); aiInputRef.current?.focus() }}
                                                    className="text-xs px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand-accent-subtle-border)] hover:text-[var(--brand-accent)] hover:bg-[var(--brand-accent-subtle)] transition-all"
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Input */}
                                <div className="px-4 pb-4">
                                    <div className="flex items-end gap-2 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border)] focus-within:border-[var(--brand-accent)] transition-colors px-3 py-2.5">
                                        <textarea
                                            ref={aiInputRef}
                                            value={aiQuery}
                                            onChange={e => setAiQuery(e.target.value)}
                                            onKeyDown={handleAiKeyDown}
                                            placeholder="Ask anything..."
                                            rows={1}
                                            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none resize-none leading-relaxed"
                                            style={{ maxHeight: 96 }}
                                        />
                                        <button
                                            onClick={handleAskAI}
                                            disabled={!aiQuery.trim() || aiLoading}
                                            className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-colors"
                                        >
                                            <ArrowUp className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-[var(--text-muted)] mt-1.5 text-center">Press Enter to send · Shift+Enter for new line</p>
                                </div>
                            </motion.div>
                        </motion.div>
                    )
                }
            </AnimatePresence >

        </>
    )
}
