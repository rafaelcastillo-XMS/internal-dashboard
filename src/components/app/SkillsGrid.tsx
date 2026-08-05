import { useCallback, useEffect, useState } from "react"
import { AlertCircle, ExternalLink, Github, Loader2, RefreshCw } from "lucide-react"

type Skill = {
  id: string
  name: string
  title: string
  category: string
  status: "available" | "draft" | "deprecated" | "archived"
  url: string
  summary: string
  commitCount: number
}

type SkillsCatalog = {
  repository: { fullName: string; url: string; private: boolean }
  totals: { skills: number; available: number; categories: number }
  skills: Skill[]
}

const statusStyles: Record<Skill["status"], string> = {
  available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  deprecated: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  archived: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
}

export function SkillsGrid() {
  const [catalog, setCatalog] = useState<SkillsCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSkills = useCallback(async (refresh = false) => {
    setError(null)
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const response = await fetch(`/api/company-skills${refresh ? "?refresh=1" : ""}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Unable to load GitHub skills")
      setCatalog(payload as SkillsCatalog)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load GitHub skills")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void loadSkills() }, [loadSkills])

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Skills</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {catalog ? `${catalog.totals.skills} skills · ${catalog.totals.categories} categories` : "Skills from the connected GitHub repository"}
          </p>
        </div>
        {catalog && (
          <div className="flex items-center gap-2">
            <a href={catalog.repository.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700">
              <Github className="h-3.5 w-3.5" />
              {catalog.repository.fullName}
              <ExternalLink className="h-3 w-3" />
            </a>
            <button type="button" onClick={() => void loadSkills(true)} disabled={refreshing} aria-label="Refresh skills" className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 px-4 py-5 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading skills from GitHub…
        </div>
      )}

      {error && !loading && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Could not load the GitHub skills catalog.</p>
            <p className="mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && catalog?.skills.length === 0 && (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 px-4 py-5 text-xs text-slate-500 dark:text-slate-400">No `SKILL.md` files were found in this repository.</div>
      )}

      {!loading && !error && catalog && catalog.skills.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {catalog.skills.map(skill => (
            <a key={skill.id} href={skill.url} target="_blank" rel="noopener noreferrer" className="group min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md dark:hover:border-purple-700">
              <div className="flex items-start justify-between gap-1.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  <Github className="h-3.5 w-3.5" />
                </span>
                <ExternalLink className="h-3 w-3 shrink-0 text-slate-300 transition-colors group-hover:text-purple-500" />
              </div>
              <h3 className="mt-2 line-clamp-2 text-xs font-semibold leading-snug text-slate-800 dark:text-slate-100">{skill.title || skill.name}</h3>
              <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{skill.summary}</p>
              <div className="mt-2 flex items-center justify-between gap-1 border-t border-slate-100 pt-2 dark:border-slate-700/60">
                <span className={`truncate rounded-full px-1.5 py-0.5 text-[9px] font-semibold capitalize ${statusStyles[skill.status]}`}>{skill.status}</span>
                <span className="shrink-0 text-[9px] text-slate-400 dark:text-slate-500">{skill.commitCount ? `${skill.commitCount} commits` : skill.category}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  )
}
