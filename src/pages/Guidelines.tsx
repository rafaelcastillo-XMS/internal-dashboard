import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BookOpen,
  Sparkles,
  Search,
  Copy,
  Check,
  Pencil,
  Trash2,
  X,
  Tag,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Prompt {
  id: string
  title: string
  category: string
  content: string
  tags: string[]
  createdAt: string
}

interface Guideline {
  id: string
  title: string
  content: string
  createdAt: string
}

type GuidelinesMap = Record<string, Guideline[]>

// ─── Config ───────────────────────────────────────────────────────────────────

const GUIDELINE_CATEGORIES = [
  { id: "design",     label: "Design",       accent: "purple" },
  { id: "seo",        label: "SEO",          accent: "blue"   },
  { id: "sem",        label: "SEM",          accent: "orange" },
  { id: "social",     label: "Social Media", accent: "pink"   },
  { id: "operations", label: "Operations",   accent: "green"  },
  { id: "content",    label: "Content",      accent: "amber"  },
]

const PROMPT_CATEGORIES = ["General", "SEO", "SEM", "Social Media", "Design", "Operations", "Content"]

const CATEGORY_STYLES: Record<string, { badge: string; tab: string; dot: string }> = {
  purple: {
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    tab:   "text-purple-600 dark:text-purple-400 border-purple-500",
    dot:   "bg-purple-500",
  },
  blue: {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    tab:   "text-blue-600 dark:text-blue-400 border-blue-500",
    dot:   "bg-blue-500",
  },
  orange: {
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    tab:   "text-orange-600 dark:text-orange-400 border-orange-500",
    dot:   "bg-orange-500",
  },
  pink: {
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
    tab:   "text-pink-600 dark:text-pink-400 border-pink-500",
    dot:   "bg-pink-500",
  },
  green: {
    badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    tab:   "text-green-600 dark:text-green-400 border-green-500",
    dot:   "bg-green-500",
  },
  amber: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    tab:   "text-amber-600 dark:text-amber-400 border-amber-500",
    dot:   "bg-amber-500",
  },
  slate: {
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    tab:   "text-slate-600 dark:text-slate-400 border-slate-400",
    dot:   "bg-slate-400",
  },
}

const PROMPT_CAT_ACCENT: Record<string, string> = {
  "General":     "slate",
  "SEO":         "blue",
  "SEM":         "orange",
  "Social Media":"pink",
  "Design":      "purple",
  "Operations":  "green",
  "Content":     "amber",
}

const FEATURED_PROMPTS = [
  {
    id: "featured-error-log",
    title: "ERROR LOG — Skill Correction Capture",
    category: "General",
    tags: ["error-log", "skill", "correction"],
    content: `# ERROR LOG — Skill Correction Capture

## Role
You are a prompt-engineering analyst. Your sole task is to audit the full
conversation history of this session and extract every correction, constraint,
or behavioral adjustment the user applied to the AI skill being tested or used.

## Instructions

1. Read the ENTIRE conversation from the first message to this one.

2. Identify every instance where the user:
   - Told the skill NOT to do something (prohibition)
   - Told the skill to ALWAYS do something (obligation)
   - Adjusted tone, style, or format (style)
   - Changed a numeric value, limit, or threshold (parameter)
   - Flagged a recurring error or undesired pattern (other)

3. Deduplicate: if the same correction appears multiple times, log it once
   and note it was recurring in the "trigger" field.

4. For each correction, write a clear, imperative rule in the
   "suggested_rule" field — as if writing a bullet point for the skill's
   system prompt.

5. Consolidate all rules into a single ready-to-paste block in the
   "suggested_prompt_addition" field.

## Output format

Return ONLY the following JSON. No preamble, no explanation, no markdown
fences. Raw JSON only.

{
  "skill_name": "",
  "session_date": "",
  "total_corrections": ,
  "corrections": [
    {
      "id": 1,
      "type": "",
      "description": "",
      "trigger": "",
      "frequency": "",
      "priority": "",
      "suggested_rule": ""
    }
  ],
  "suggested_prompt_addition": ""
}

## Priority guidelines

- HIGH   → The correction was repeated more than once, or the user expressed
           strong dissatisfaction (e.g. 'never do this again', 'always').
- MEDIUM → The correction was made once and clearly intentional.
- LOW    → Minor preference, phrasing tweak, or single casual mention.

## Constraints

- Output must be valid, parseable JSON.
- Do not invent corrections that were not explicitly stated by the user.
- Do not include corrections made by the AI to itself.
- Do not modify or interpret the meaning of the user's corrections — capture
  them faithfully.
- If no corrections are found, return the JSON with total_corrections: 0
  and an empty corrections array.`,
  },
]

// ─── LocalStorage ─────────────────────────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback }
}
function save<T>(key: string, v: T) { try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }

// ─── FeaturedPromptCard ───────────────────────────────────────────────────────

function FeaturedPromptCard({ prompt }: { prompt: typeof FEATURED_PROMPTS[number] }) {
  const accent = PROMPT_CAT_ACCENT[prompt.category] ?? "slate"
  const styles = CATEGORY_STYLES[accent]

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Featured
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
            {prompt.category}
          </span>
          {prompt.tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-400">
              <Tag className="h-2.5 w-2.5" />{tag}
            </span>
          ))}
        </div>
        <CopyButton text={prompt.content} />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{prompt.title}</h3>
      <textarea
        readOnly
        value={prompt.content}
        rows={8}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] cursor-text select-all"
      />
    </div>
  )
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handle = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handle}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
    >
      {copied
        ? <><Check className="h-3.5 w-3.5 text-green-500" /><span className="text-green-600 dark:text-green-400">Copied!</span></>
        : <><Copy className="h-3.5 w-3.5" />Copy</>
      }
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/60 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700/60">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </motion.div>
    </div>
  )
}

// ─── PromptForm ───────────────────────────────────────────────────────────────

function PromptForm({ initial, onSave, onClose }: {
  initial?: Prompt
  onSave: (data: Omit<Prompt, "id" | "createdAt">) => void
  onClose: () => void
}) {
  const [title, setTitle]       = useState(initial?.title ?? "")
  const [category, setCategory] = useState(initial?.category ?? "General")
  const [tags, setTags]         = useState(initial?.tags.join(", ") ?? "")
  const [content, setContent]   = useState(initial?.content ?? "")

  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    onSave({
      title: title.trim(),
      category,
      content: content.trim(),
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Title</label>
        <input className={inputCls} placeholder="e.g. Meta description optimizer" value={title} onChange={e => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Category</label>
          <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
            {PROMPT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Tags</label>
          <input className={inputCls} placeholder="tag1, tag2" value={tags} onChange={e => setTags(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Prompt</label>
        <textarea className={`${inputCls} resize-none`} rows={6} placeholder="Write your prompt here…" value={content} onChange={e => setContent(e.target.value)} required />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 rounded-lg bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-sm font-semibold transition-colors cursor-pointer shadow-sm">
          {initial ? "Save changes" : "Add prompt"}
        </button>
      </div>
    </form>
  )
}

// ─── GuidelineForm ────────────────────────────────────────────────────────────

function GuidelineForm({ initial, onSave, onClose }: {
  initial?: Guideline
  onSave: (data: Omit<Guideline, "id" | "createdAt">) => void
  onClose: () => void
}) {
  const [title, setTitle]     = useState(initial?.title ?? "")
  const [content, setContent] = useState(initial?.content ?? "")

  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    onSave({ title: title.trim(), content: content.trim() })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Title</label>
        <input className={inputCls} placeholder="e.g. Image alt text rules" value={title} onChange={e => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Content</label>
        <textarea className={`${inputCls} resize-none`} rows={7} placeholder="Write the guideline content here…" value={content} onChange={e => setContent(e.target.value)} required />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 rounded-lg bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-sm font-semibold transition-colors cursor-pointer shadow-sm">
          {initial ? "Save changes" : "Add guideline"}
        </button>
      </div>
    </form>
  )
}

// ─── PromptCard ───────────────────────────────────────────────────────────────

function PromptCard({ prompt, index, onEdit, onDelete }: {
  prompt: Prompt
  index: number
  onEdit: (p: Prompt) => void
  onDelete: (id: string) => void
}) {
  const accent = PROMPT_CAT_ACCENT[prompt.category] ?? "slate"
  const styles = CATEGORY_STYLES[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.04 }}
      className="group flex flex-col gap-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-4 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
            {prompt.category}
          </span>
          {prompt.tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-400">
              <Tag className="h-2.5 w-2.5" />{tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onEdit(prompt)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(prompt.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{prompt.title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3 flex-1">{prompt.content}</p>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60">
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {new Date(prompt.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <CopyButton text={prompt.content} />
      </div>
    </motion.div>
  )
}

// ─── GuidelineItem ────────────────────────────────────────────────────────────

function GuidelineItem({ guideline, index, onEdit, onDelete }: {
  guideline: Guideline
  index: number
  onEdit: (g: Guideline) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isLong = guideline.content.length > 200

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="group rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">{guideline.title}</h4>
          <p className={`text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap ${!expanded && isLong ? "line-clamp-3" : ""}`}>
            {guideline.content}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--brand-accent)] hover:underline transition-colors cursor-pointer"
            >
              {expanded ? <><ChevronUp className="h-3 w-3" />Show less</> : <><ChevronDown className="h-3 w-3" />Show more</>}
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
          <button onClick={() => onEdit(guideline)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(guideline.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="px-4 pb-3">
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          Added {new Date(guideline.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
    </motion.div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 gap-4 text-center"
    >
      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <Icon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
      </div>
      <div>
        <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-xs">{description}</p>
      </div>
      {action}
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Guidelines() {
  const [activeMain, setActiveMain] = useState<"prompts" | "guidelines">("prompts")
  const [activeGuideCat, setActiveGuideCat] = useState(GUIDELINE_CATEGORIES[0].id)

  const [prompts, setPrompts]         = useState<Prompt[]>(() => load("xms_prompts", []))
  const [promptSearch, setPromptSearch] = useState("")
  const [promptCatFilter, setPromptCatFilter] = useState("All")
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [editingPrompt, setEditingPrompt]     = useState<Prompt | null>(null)

  const [guidelines, setGuidelines]         = useState<GuidelinesMap>(() => load("xms_guidelines", {}))
  const [showGuidelineModal, setShowGuidelineModal] = useState(false)
  const [editingGuideline, setEditingGuideline]     = useState<Guideline | null>(null)

  useEffect(() => { save("xms_prompts", prompts) }, [prompts])
  useEffect(() => { save("xms_guidelines", guidelines) }, [guidelines])

  const filteredPrompts = prompts.filter(p => {
    const q = promptSearch.toLowerCase()
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q))
    const matchCat = promptCatFilter === "All" || p.category === promptCatFilter
    return matchSearch && matchCat
  })

  const currentGuidelines = guidelines[activeGuideCat] ?? []

  const savePrompt = (data: Omit<Prompt, "id" | "createdAt">) => {
    if (editingPrompt) {
      setPrompts(ps => ps.map(p => p.id === editingPrompt.id ? { ...editingPrompt, ...data } : p))
    } else {
      setPrompts(ps => [{ ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...ps])
    }
    setShowPromptModal(false)
    setEditingPrompt(null)
  }

  const deletePrompt = (id: string) => setPrompts(ps => ps.filter(p => p.id !== id))

  const openEditPrompt = (p: Prompt) => { setEditingPrompt(p); setShowPromptModal(true) }

  const saveGuideline = (data: Omit<Guideline, "id" | "createdAt">) => {
    if (editingGuideline) {
      setGuidelines(gs => ({
        ...gs,
        [activeGuideCat]: (gs[activeGuideCat] ?? []).map(g => g.id === editingGuideline.id ? { ...editingGuideline, ...data } : g),
      }))
    } else {
      setGuidelines(gs => ({
        ...gs,
        [activeGuideCat]: [{ ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...(gs[activeGuideCat] ?? [])],
      }))
    }
    setShowGuidelineModal(false)
    setEditingGuideline(null)
  }

  const deleteGuideline = (id: string) => {
    setGuidelines(gs => ({ ...gs, [activeGuideCat]: (gs[activeGuideCat] ?? []).filter(g => g.id !== id) }))
  }

  const openEditGuideline = (g: Guideline) => { setEditingGuideline(g); setShowGuidelineModal(true) }

  const activeCatMeta = GUIDELINE_CATEGORIES.find(c => c.id === activeGuideCat)!
  const activeCatStyles = CATEGORY_STYLES[activeCatMeta.accent]

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 custom-scrollbar">
      <div className="mx-auto max-w-screen-2xl p-6">

        {/* ── Page header ── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Guidelines & Prompts</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Team playbook and AI prompt library</p>
        </div>

        {/* ── Main tabs ── */}
        <div className="mb-6 flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 w-fit shadow-sm">
          {([
            { id: "prompts",    label: "Prompt Library",  icon: Sparkles },
            { id: "guidelines", label: "Guidelines",      icon: BookOpen  },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveMain(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeMain === id
                  ? "bg-[var(--brand-accent)] text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {id === "prompts" && prompts.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeMain === "prompts" ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
                  {prompts.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ════════════════════ PROMPTS TAB ════════════════════ */}
          {activeMain === "prompts" && (
            <motion.div key="prompts" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

              {/* Toolbar */}
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search prompts…"
                    value={promptSearch}
                    onChange={e => setPromptSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                </div>

                {/* Category filter chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {["All", ...PROMPT_CATEGORIES].map(cat => {
                    const accent = cat === "All" ? "slate" : (PROMPT_CAT_ACCENT[cat] ?? "slate")
                    const styles = CATEGORY_STYLES[accent]
                    const isActive = promptCatFilter === cat
                    return (
                      <button
                        key={cat}
                        onClick={() => setPromptCatFilter(cat)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                          isActive ? styles.badge + " ring-1 ring-current/30" : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }`}
                      >
                        {isActive && <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />}
                        {cat}
                        {cat !== "All" && prompts.filter(p => p.category === cat).length > 0 && (
                          <span className="opacity-60">{prompts.filter(p => p.category === cat).length}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Featured prompts */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Featured</p>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {FEATURED_PROMPTS.map(fp => <FeaturedPromptCard key={fp.id} prompt={fp} />)}
                </div>
              </div>

              {/* Prompt grid */}
              {filteredPrompts.length === 0 ? (
                prompts.length > 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No results found</p>
                    <button onClick={() => { setPromptSearch(""); setPromptCatFilter("All") }} className="text-xs font-medium text-[var(--brand-accent)] hover:underline cursor-pointer">
                      Clear filters
                    </button>
                  </div>
                ) : null
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPrompts.map((p, i) => (
                    <PromptCard key={p.id} prompt={p} index={i} onEdit={openEditPrompt} onDelete={deletePrompt} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ════════════════════ GUIDELINES TAB ════════════════════ */}
          {activeMain === "guidelines" && (
            <motion.div key="guidelines" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

              {/* Category tabs */}
              <div className="mb-5 flex items-center gap-1 flex-wrap">
                {GUIDELINE_CATEGORIES.map(cat => {
                  const styles = CATEGORY_STYLES[cat.accent]
                  const count = (guidelines[cat.id] ?? []).length
                  const isActive = activeGuideCat === cat.id
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveGuideCat(cat.id)}
                      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer border ${
                        isActive
                          ? `${styles.badge} border-current/20 shadow-sm`
                          : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800"
                      }`}
                    >
                      {isActive && <span className={`h-2 w-2 rounded-full ${styles.dot}`} />}
                      {cat.label}
                      {count > 0 && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-current/10" : "bg-slate-100 dark:bg-slate-700 text-slate-400"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}

              </div>

              {/* Category header */}
              <div className="mb-4 flex items-center gap-3">
                <span className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold ${activeCatStyles.badge} border border-current/20`}>
                  <span className={`h-2 w-2 rounded-full ${activeCatStyles.dot}`} />
                  {activeCatMeta.label} Guidelines
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{currentGuidelines.length} {currentGuidelines.length === 1 ? "entry" : "entries"}</span>
              </div>

              {/* Guidelines list */}
              {currentGuidelines.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-20 gap-4 text-center"
                >
                  <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <BookOpen className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">Guidelines coming soon</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                      These guidelines are being set up and will be available shortly. Stay tuned.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {currentGuidelines.map((g, i) => (
                    <GuidelineItem key={g.id} guideline={g} index={i} onEdit={openEditGuideline} onDelete={deleteGuideline} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showPromptModal && (
          <Modal title={editingPrompt ? "Edit prompt" : "New prompt"} onClose={() => { setShowPromptModal(false); setEditingPrompt(null) }}>
            <PromptForm
              initial={editingPrompt ?? undefined}
              onSave={savePrompt}
              onClose={() => { setShowPromptModal(false); setEditingPrompt(null) }}
            />
          </Modal>
        )}
        {showGuidelineModal && (
          <Modal title={editingGuideline ? "Edit guideline" : "New guideline"} onClose={() => { setShowGuidelineModal(false); setEditingGuideline(null) }}>
            <GuidelineForm
              initial={editingGuideline ?? undefined}
              onSave={saveGuideline}
              onClose={() => { setShowGuidelineModal(false); setEditingGuideline(null) }}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}
