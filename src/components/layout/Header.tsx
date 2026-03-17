import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Moon, Sun, ChevronDown, Bug, X, LogOut, User, ArrowUp, PanelLeft, MoreVertical } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useTheme } from "@/context/useTheme"
import { useSidebar } from "@/context/useSidebar"
import { supabase } from "@/lib/supabase"

const AI_RESPONSES: Record<string, string> = {
    default: "I'm analyzing your dashboard data now. Based on current activity, your top priority this week should be the IBM campaign review — it's overdue and blocking two dependent tasks.",
    task: `You have 3 tasks in progress and 2 completed this week. The highest priority pending item is the Coca-Cola brand refresh, due ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(new Date())}.`,
    client: "Your most active client this week is IBM with 4 open tasks. McDonald's has a campaign deadline coming up on March 15.",
    calendar: "You have 2 events today and 6 upcoming this month. Your next meeting is tomorrow at 10:00 AM — the SEO strategy review.",
    performance: "Weekly task activity is up 18% compared to last week. Friday had the highest output at 90%. Keep it up!",
}

function getAIResponse(query: string): string {
    const q = query.toLowerCase()
    if (q.includes("task") || q.includes("todo")) return AI_RESPONSES.task
    if (q.includes("client") || q.includes("account")) return AI_RESPONSES.client
    if (q.includes("calendar") || q.includes("event") || q.includes("meeting")) return AI_RESPONSES.calendar
    if (q.includes("performance") || q.includes("stat") || q.includes("progress")) return AI_RESPONSES.performance
    return AI_RESPONSES.default
}

export function Header() {
    const { theme, toggleTheme } = useTheme()
    const { collapsed, toggle: toggleSidebar, toggleMobile } = useSidebar()
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const isSEO = pathname.startsWith('/seo') || pathname.startsWith('/sem')

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
    const [bugOpen, setBugOpen] = useState(false)
    const [bugText, setBugText] = useState("")
    const [bugSent, setBugSent] = useState(false)
    const [aiOpen, setAiOpen] = useState(false)
    const [aiQuery, setAiQuery] = useState("")
    const [aiResponse, setAiResponse] = useState("")
    const [aiLoading, setAiLoading] = useState(false)
    const aiInputRef = useRef<HTMLTextAreaElement>(null)
    const bugTextareaRef = useRef<HTMLTextAreaElement>(null)
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
        if (bugOpen) setTimeout(() => bugTextareaRef.current?.focus(), 80)
    }, [bugOpen])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault()
                openAI()
            }
            if (e.key === "Escape") {
                setAiOpen(false)
                setBugOpen(false)
                setMobileMenuOpen(false)
            }
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
        if (error) {
            console.error("[BugReport] Failed to submit:", error.message)
        }
        setBugSent(true)
        setTimeout(() => {
            setBugOpen(false)
            setBugText("")
            setBugSent(false)
        }, 1800)
    }

    const handleAskAI = () => {
        if (!aiQuery.trim() || aiLoading) return
        setAiLoading(true)
        setAiResponse("")
        setTimeout(() => {
            setAiResponse(getAIResponse(aiQuery))
            setAiLoading(false)
        }, 900)
    }

    const handleAiKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleAskAI()
        }
    }

    const openAI = () => {
        setAiOpen(true)
        setAiQuery("")
        setAiResponse("")
        setTimeout(() => aiInputRef.current?.focus(), 80)
    }

    return (
        <>
            <header className="h-16 border-b border-[var(--sidebar-border)] bg-[var(--bg-surface)]/90 backdrop-blur-md flex items-center px-6 justify-between shrink-0 shadow-sm z-[100] sticky top-0">
                <div className="flex items-center gap-2">
                    {/* Sidebar toggle - Mobile (hidden on SEO routes) */}
                    {!isSEO && (
                        <button
                            onClick={toggleMobile}
                            aria-label="Toggle mobile sidebar"
                            className="lg:hidden p-2 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            <PanelLeft className="w-5 h-5" />
                        </button>
                    )}

                    {/* Sidebar toggle - Desktop (hidden on SEO routes) */}
                    {!isSEO && (
                        <button
                            onClick={toggleSidebar}
                            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                            className="hidden lg:flex p-2 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            <PanelLeft className="w-5 h-5" />
                        </button>
                    )}

                    {/* AI Assistant button */}
                    <button
                        onClick={openAI}
                        className="flex h-10 items-center gap-2.5 rounded-full border border-blue-100 bg-gradient-to-r from-blue-50 to-violet-50 pl-3.5 pr-4 text-[var(--text-muted)] transition-all group hover:border-[var(--accent-subtle-border)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800/50 dark:from-blue-900/20 dark:to-violet-900/20"
                        aria-label="Ask AI"
                    >
                        <Sparkles className="w-4 h-4 text-blue-500 group-hover:text-blue-600 transition-colors" />
                        <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">Ask AI anything...</span>
                        <span className="hidden sm:inline-flex items-center gap-1 ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-500 dark:text-blue-400">⌘K</span>
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

                        {/* Bug report button */}
                        <div className="relative group">
                            <button
                                onClick={() => setBugOpen(true)}
                                aria-label="Report a bug"
                                className="p-2 rounded-full hover:bg-[var(--hover-bg)] text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                <Bug className="w-5 h-5" />
                            </button>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 bg-[var(--text-primary)] text-[var(--bg-surface)] text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-50">
                                Report a bug
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
                                            onClick={() => { setBugOpen(true); setMobileMenuOpen(false); }}
                                            className="w-full px-4 py-2.5 text-sm text-left flex items-center gap-2 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                                        >
                                            <Bug className="w-4 h-4" />
                                            Report a bug
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
                                            <p className="text-sm font-semibold text-[var(--text-primary)]">XMS AI Assistant <span className="text-[10px] font-normal text-[var(--text-muted)]">(Demo)</span></p>
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
                                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{aiResponse}</p>
                                        </motion.div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {["What are my priorities today?", "How are my clients doing?", "Show me performance stats"].map(suggestion => (
                                                <button
                                                    key={suggestion}
                                                    onClick={() => { setAiQuery(suggestion); aiInputRef.current?.focus() }}
                                                    className="text-xs px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent-subtle-border)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all"
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Input */}
                                <div className="px-4 pb-4">
                                    <div className="flex items-end gap-2 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border)] focus-within:border-[var(--accent)] transition-colors px-3 py-2.5">
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

            {/* Bug report modal */}
            <AnimatePresence>
                {
                    bugOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
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
                                            <div className="w-9 h-9 bg-[var(--accent-subtle)] rounded-xl flex items-center justify-center">
                                                <Bug className="w-5 h-5 text-[var(--accent)]" />
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
                        </motion.div>
                    )
                }
            </AnimatePresence >
        </>
    )
}
