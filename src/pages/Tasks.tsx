import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react"
import { useMondayTasks, statusColor, priorityColor, type MondayTask } from "@/features/tasks/useMondayTasks"

// ─── Monday brand colours ─────────────────────────────────────────────────────
const MONDAY_LOGO =
  "https://dapulse-res.cloudinary.com/image/upload/f_auto,q_auto/remote_mondaycom_static/uploads/product/monday-logo.png"

// ─── Status / priority chip helpers ──────────────────────────────────────────
const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
  green:  { bg: "bg-green-50 dark:bg-green-900/20",  text: "text-green-700 dark:text-green-400",  dot: "bg-green-500"  },
  blue:   { bg: "bg-blue-50 dark:bg-blue-900/20",    text: "text-blue-700 dark:text-blue-400",    dot: "bg-blue-500"   },
  amber:  { bg: "bg-amber-50 dark:bg-amber-900/20",  text: "text-amber-700 dark:text-amber-400",  dot: "bg-amber-500"  },
  purple: { bg: "bg-purple-50 dark:bg-purple-900/20",text: "text-purple-700 dark:text-purple-400",dot: "bg-purple-500" },
  red:    { bg: "bg-red-50 dark:bg-red-900/20",      text: "text-red-700 dark:text-red-400",      dot: "bg-red-500"    },
  slate:  { bg: "bg-slate-100 dark:bg-slate-700/40", text: "text-slate-600 dark:text-slate-400",  dot: "bg-slate-400"  },
}

function StatusChip({ label, index }: { label: string; index: number | null }) {
  const c = colorMap[statusColor(index)] ?? colorMap.slate
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {label}
    </span>
  )
}

function PriorityChip({ label }: { label: string | null }) {
  if (!label) return null
  const c = colorMap[priorityColor(label)] ?? colorMap.slate
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${c.bg} ${c.text}`}>
      {label}
    </span>
  )
}

// ─── Due date badge ───────────────────────────────────────────────────────────
function DueBadge({ date }: { date: string | null }) {
  if (!date) return null
  const due = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000)

  let cls = "text-slate-500 dark:text-slate-400"
  let icon = <Clock className="h-3 w-3" />
  if (diff < 0) { cls = "text-red-600 dark:text-red-400"; icon = <AlertCircle className="h-3 w-3" /> }
  else if (diff <= 2) { cls = "text-amber-600 dark:text-amber-400"; icon = <Clock className="h-3 w-3" /> }
  else { cls = "text-emerald-600 dark:text-emerald-400"; icon = <CheckCircle2 className="h-3 w-3" /> }

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${cls}`}>
      {icon}
      {diff < 0 ? `${-diff}d overdue` : diff === 0 ? "Due today" : `${diff}d left`}
    </span>
  )
}

// ─── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, index }: { task: MondayTask; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.035 }}
      className="group flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-[1px] dark:border-slate-700/60 dark:bg-slate-800/80"
    >
      {/* Board label + priority */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {task.board}
        </span>
        <PriorityChip label={task.priority} />
      </div>

      {/* Task name */}
      <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-white line-clamp-2">
        {task.name}
      </p>

      {/* Footer: status + due */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <StatusChip label={task.status} index={task.statusIndex} />
        <DueBadge date={task.dueDate} />
      </div>
    </motion.div>
  )
}

// ─── Group tasks by board ─────────────────────────────────────────────────────
function groupByBoard(tasks: MondayTask[]): Map<string, MondayTask[]> {
  const map = new Map<string, MondayTask[]>()
  for (const t of tasks) {
    if (!map.has(t.board)) map.set(t.board, [])
    map.get(t.board)!.push(t)
  }
  return map
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function Tasks() {
  const { user, tasks, loading, error, refetch } = useMondayTasks()
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [view, setView] = useState<"board" | "list">("list")

  const statuses = ["all", ...Array.from(new Set(tasks.map(t => t.status)))]

  const filtered = tasks.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.board.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === "all" || t.status === filterStatus
    return matchSearch && matchStatus
  })

  const grouped = groupByBoard(filtered)

  const doneCount = tasks.filter(t => t.statusIndex === 1).length
  const inProgressCount = tasks.filter(t => t.statusIndex !== null && t.statusIndex !== 1 && t.statusIndex !== 0).length
  const overdueCount = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 custom-scrollbar">
      <div className="mx-auto max-w-screen-2xl px-6 py-6">

        {/* ── Header ── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Monday logo + title */}
            <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 shadow-sm">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#ff3d57]/10 via-[#ffcb00]/10 to-[#00ca72]/10 blur-md" />
              <img
                src={MONDAY_LOGO}
                alt="monday.com"
                className="relative h-5 w-auto object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Tasks</h1>
              {user && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {user.name} · {tasks.length} task{tasks.length !== 1 ? "s" : ""} assigned
                </p>
              )}
            </div>
          </div>

          <button
            onClick={refetch}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* ── Quick stats ── */}
        {!loading && !error && user && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total Tasks",   value: tasks.length,    color: "text-slate-900 dark:text-white",           bg: "bg-white dark:bg-slate-800" },
              { label: "In Progress",   value: inProgressCount, color: "text-blue-700 dark:text-blue-400",         bg: "bg-blue-50 dark:bg-blue-900/20" },
              { label: "Done",          value: doneCount,       color: "text-green-700 dark:text-green-400",       bg: "bg-green-50 dark:bg-green-900/20" },
              { label: "Overdue",       value: overdueCount,    color: "text-red-700 dark:text-red-400",           bg: "bg-red-50 dark:bg-red-900/20" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`${s.bg} rounded-xl border border-slate-200/80 dark:border-slate-700/60 p-4 shadow-sm`}
              >
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Filters + search ── */}
        {!loading && !error && user && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1A72D9]/50"
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <div className="flex flex-wrap gap-1.5">
                {statuses.slice(0, 6).map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      filterStatus === s
                        ? "bg-[#1A72D9] text-white"
                        : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    {s === "all" ? "All" : s}
                  </button>
                ))}
              </div>
            </div>

            {/* View toggle */}
            <div className="ml-auto flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
              {(["list", "board"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    view === v
                      ? "bg-[#1A72D9] text-white"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── States ── */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-[#1A72D9]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Fetching your monday.com tasks…</p>
            </motion.div>
          )}

          {!loading && error && (
            <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="rounded-full bg-red-50 dark:bg-red-900/20 p-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Could not load tasks</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">{error}</p>
              </div>
              <button onClick={refetch} className="inline-flex items-center gap-2 rounded-lg bg-[#1A72D9] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1560c0] transition-colors">
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
            </motion.div>
          )}

          {!loading && !error && !user && (
            <motion.div key="no-user" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="relative rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-6 shadow-lg">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#ff3d57]/10 via-[#ffcb00]/10 to-[#00ca72]/10 blur-xl" />
                <img src={MONDAY_LOGO} alt="monday.com" className="relative h-10 w-auto object-contain" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">No monday.com account found</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                  We couldn't find a monday.com user matching your login email. Make sure you're using the same email in both platforms.
                </p>
              </div>
              <a href="https://monday.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Open monday.com <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </motion.div>
          )}

          {!loading && !error && user && filtered.length === 0 && (
            <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <Circle className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No tasks match your current filters.</p>
              <button onClick={() => { setSearch(""); setFilterStatus("all") }}
                className="text-xs font-medium text-[#1A72D9] hover:underline">
                Clear filters
              </button>
            </motion.div>
          )}

          {/* ── Task list view ── */}
          {!loading && !error && user && filtered.length > 0 && view === "list" && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filtered.map((task, i) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.025 }}
                    className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{task.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{task.board}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.priority && <PriorityChip label={task.priority} />}
                      <StatusChip label={task.status} index={task.statusIndex} />
                      <DueBadge date={task.dueDate} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Task board view ── */}
          {!loading && !error && user && filtered.length > 0 && view === "board" && (
            <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-6">
              {Array.from(grouped.entries()).map(([board, boardTasks]) => (
                <div key={board}>
                  <div className="mb-3 flex items-center gap-2">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{board}</h2>
                    <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {boardTasks.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {boardTasks.map((task, i) => (
                      <TaskCard key={task.id} task={task} index={i} />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
