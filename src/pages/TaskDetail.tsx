import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  AlertCircle,
  Calendar,
  Clock,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquare,
  Sparkles,
  X,
} from "lucide-react"
import DOMPurify from "dompurify"
import { useMondayTasks, statusColor, priorityColor } from "@/features/tasks/useMondayTasks"

function MondayLogo() {
  return (
    <svg className="h-3.5 w-auto shrink-0" viewBox="0 0 60 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" fill="#FF3D57" />
      <circle cx="30" cy="10" r="9" fill="#FFCB00" />
      <circle cx="50" cy="10" r="9" fill="#00D647" />
    </svg>
  )
}

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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.bg} ${c.text}`}>
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

function DueBadge({ date }: { date: string | null }) {
  if (!date) return null
  const due = new Date(date)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  let cls = "text-slate-500 dark:text-slate-400"
  let icon = <Clock className="h-3 w-3" />
  if (diff < 0)       { cls = "text-red-600 dark:text-red-400";      icon = <AlertCircle className="h-3 w-3" /> }
  else if (diff <= 2) { cls = "text-amber-600 dark:text-amber-400";  icon = <Clock className="h-3 w-3" /> }
  else                { cls = "text-emerald-600 dark:text-emerald-400"; icon = <CheckCircle2 className="h-3 w-3" /> }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      {icon}
      {diff < 0 ? `${-diff}d overdue` : diff === 0 ? "Due today" : `${diff}d left`}
    </span>
  )
}

interface TaskDetail {
  id: string
  boardId: string | null
  boardName: string
  mondayUrl: string | null
  updates: { id: string; body: string; createdAt: string; creatorName: string; creatorAvatar: string | null }[]
}

export function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { tasks, loading: tasksLoading } = useMondayTasks()
  const task = tasks.find(t => t.id === taskId) ?? null

  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [loadingInsight, setLoadingInsight] = useState(false)
  const [insightError, setInsightError] = useState<string | null>(null)

  const handleGetInsight = async () => {
    if (!task || loadingInsight) return
    setLoadingInsight(true)
    setAiInsight(null)
    setInsightError(null)
    try {
      const res = await fetch("/api/ai/task-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: {
            name: task.name,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            board: task.board,
          },
          updates: detail?.updates?.map(u => ({
            creatorName: u.creatorName,
            createdAt: u.createdAt,
            body: u.body,
          })) ?? [],
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiInsight(data.insight)
    } catch (err) {
      setInsightError(err instanceof Error ? err.message : "Failed to get insight")
    } finally {
      setLoadingInsight(false)
    }
  }

  useEffect(() => {
    if (!taskId) return
    setLoadingDetail(true)
    setDetailError(null)
    fetch(`/api/monday/tasks/${taskId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setDetail(data as TaskDetail)
      })
      .catch(err => setDetailError(err instanceof Error ? err.message : "Failed to load detail"))
      .finally(() => setLoadingDetail(false))
  }, [taskId])

  const mondayUrl = detail?.mondayUrl ?? null

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 custom-scrollbar">
      <div className="mx-auto max-w-3xl px-6 py-6">

        {/* Back */}
        <button
          onClick={() => navigate("/tasks")}
          className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tasks
        </button>

        {/* Loading state (tasks not in cache yet) */}
        {tasksLoading && !task && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-10">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading task…
          </div>
        )}

        {/* Not found */}
        {!tasksLoading && !task && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Task not found.</p>
            <button onClick={() => navigate("/tasks")} className="text-xs font-medium text-[#1A72D9] hover:underline">
              Go to Tasks
            </button>
          </div>
        )}

        {task && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

            {/* Task header */}
            <div className="mb-6 rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h1 className="text-xl font-bold text-slate-900 dark:text-[#E2E5E9] leading-snug">
                  {task.name}
                </h1>
                <div className="flex items-center gap-2 shrink-0">
                  {/* AI Insight button */}
                  <button
                    onClick={handleGetInsight}
                    disabled={loadingInsight}
                    className="flex items-center gap-1.5 rounded-lg border border-violet-200 dark:border-violet-700/60 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 shadow-sm hover:from-violet-100 hover:to-blue-100 dark:hover:from-violet-900/30 dark:hover:to-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {loadingInsight ? "Thinking…" : "AI Insight"}
                  </button>
                  {/* Monday link */}
                  {loadingDetail ? (
                    <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700" />
                  ) : mondayUrl ? (
                    <a
                      href={mondayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <MondayLogo />
                      Open in Monday
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip label={task.status} index={task.statusIndex} />
                <PriorityChip label={task.priority} />
                <DueBadge date={task.dueDate} />
                <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                  <Calendar className="h-3 w-3" />
                  {task.board}
                </span>
              </div>
            </div>

            {/* AI Insight panel */}
            <AnimatePresence>
              {(loadingInsight || aiInsight || insightError) && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="mb-6 rounded-xl border border-violet-200/80 dark:border-violet-700/40 bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-[#E2E5E9]">AI Insight</span>
                    </div>
                    {!loadingInsight && (
                      <button
                        onClick={() => { setAiInsight(null); setInsightError(null) }}
                        className="p-1 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-800/30 text-slate-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {loadingInsight && (
                    <div className="flex items-center gap-2.5 text-xs text-violet-600 dark:text-violet-400">
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="flex gap-1"
                      >
                        <span className="w-1.5 h-1.5 bg-violet-500 rounded-full block" />
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full block" />
                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full block" />
                      </motion.div>
                      Analyzing task…
                    </div>
                  )}

                  {insightError && (
                    <p className="text-xs text-red-500 dark:text-red-400">{insightError}</p>
                  )}

                  {aiInsight && (
                    <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {aiInsight}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Updates / Description */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 px-5 py-3.5">
                <MessageSquare className="h-4 w-4 text-[#1A72D9]" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-[#E2E5E9]">Updates</h2>
              </div>

              {loadingDetail && (
                <div className="flex items-center gap-2 px-5 py-8 text-xs text-slate-400 dark:text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading updates…
                </div>
              )}

              {!loadingDetail && detailError && (
                <div className="flex items-center gap-2 px-5 py-8 text-xs text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  {detailError}
                </div>
              )}

              {!loadingDetail && !detailError && !detail?.updates?.length && (
                <p className="px-5 py-8 text-xs text-slate-400 dark:text-slate-500">
                  No updates yet for this task.
                </p>
              )}

              {!loadingDetail && !detailError && !!detail?.updates?.length && (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {detail.updates.map(update => (
                    <div key={update.id} className="flex gap-3 px-5 py-4">
                      {update.creatorAvatar ? (
                        <img
                          src={update.creatorAvatar}
                          alt={update.creatorName}
                          className="h-8 w-8 rounded-full shrink-0 object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-[#1A72D9]/10 shrink-0 flex items-center justify-center text-[11px] font-bold text-[#1A72D9]">
                          {update.creatorName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-slate-900 dark:text-[#E2E5E9]">
                            {update.creatorName}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {new Date(update.createdAt).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                            })}
                          </span>
                        </div>
                        <div
                          className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed prose prose-xs dark:prose-invert max-w-none [&_p]:mb-1 [&_ul]:ml-4 [&_ul]:list-disc"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(update.body) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </motion.div>
        )}
      </div>
    </div>
  )
}
