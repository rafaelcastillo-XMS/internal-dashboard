import { useMemo, useState } from "react"
import { Check, Copy, Sparkles, Wand2, AlertCircle, RefreshCw } from "lucide-react"

// ─── Pillars of an efficient prompt ───────────────────────────────────────────

const PILLARS = [
  {
    key: "role",
    label: "Role / Persona",
    hint: 'Define who the model is — "Act as a Senior DevOps engineer…"',
    test: (p: string) => /\b(act as|you are|your role|role:|persona:|behave as|as an? (senior|expert|experienced|professional))\b/i.test(p),
  },
  {
    key: "task",
    label: "Concrete task",
    hint: "One clear, direct instruction — write, analyze, generate, review…",
    test: (p: string) => /\b(write|create|generate|analyz|summariz|list|build|review|translate|optimiz|extract|audit|draft|refactor|explain|compare|classif|rewrite)\w*\b/i.test(p),
  },
  {
    key: "context",
    label: "Necessary context",
    hint: "Supply the relevant data only — no filler.",
    test: (p: string) => /\b(context|background|given|here is|here's|the following|based on|our|data:|input:)\b/i.test(p) || p.trim().length > 280,
  },
  {
    key: "format",
    label: "Output format",
    hint: "Demand JSON, a table, bullets or a markdown code block.",
    test: (p: string) => /\b(json|yaml|csv|xml|markdown|table|bullet|bullets|code block|output format|format:|return only|respond with|schema)\b/i.test(p),
  },
  {
    key: "constraints",
    label: "Constraints",
    hint: "Bound length, tone, language or allowed libraries.",
    test: (p: string) => /\b(max|maximum|no more than|at most|limit|under \d+|within \d+|tone|in (english|spanish)|do not|don't|never|avoid|only use|must not|words|characters|sentences)\b/i.test(p),
  },
] as const

type PillarKey = typeof PILLARS[number]["key"]

interface AiPillar { key: PillarKey; score: number; feedback: string }
interface AiResult { pillars: AiPillar[]; summary: string; optimized: string }

function grade(score: number) {
  if (score >= 80) return { label: "Strong", cls: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" }
  if (score >= 60) return { label: "Decent", cls: "text-blue-600 dark:text-blue-400", bar: "bg-blue-500" }
  if (score >= 40) return { label: "Weak", cls: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" }
  return { label: "Poor", cls: "text-red-600 dark:text-red-400", bar: "bg-red-500" }
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
    >
      {copied
        ? <><Check className="h-3.5 w-3.5 text-green-500" /><span className="text-green-600 dark:text-green-400">Copied!</span></>
        : <><Copy className="h-3.5 w-3.5" />Copy</>}
    </button>
  )
}

export function PromptOptimizer() {
  const [prompt, setPrompt] = useState("")
  const [result, setResult] = useState<AiResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Live heuristic audit — runs on every keystroke, no API call.
  const live = useMemo(() => {
    const checks = PILLARS.map(p => ({ key: p.key, label: p.label, hint: p.hint, pass: prompt.trim().length > 0 && p.test(prompt) }))
    return { checks, score: checks.filter(c => c.pass).length * 20 }
  }, [prompt])

  const aiScore = result ? Math.min(100, result.pillars.reduce((s, p) => s + (Number(p.score) || 0), 0)) : null
  const shownScore = aiScore ?? live.score
  const g = grade(shownScore)
  const words = prompt.trim() ? prompt.trim().split(/\s+/).length : 0

  const optimize = async () => {
    if (!prompt.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/ai/optimize-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Unable to optimize prompt")
      setResult(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to optimize prompt")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
          <Wand2 className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#E2E5E9]">Prompt Optimizer</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Audit your prompt against the five pillars, then let AI rewrite it</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Editor */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={12}
            placeholder="Write your prompt here… e.g. Act as a Senior SEO strategist. Analyze the keyword table below and return the 10 highest-opportunity terms as a markdown table. Max 150 words, English only."
            className="w-full resize-y rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm font-mono leading-relaxed text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{words} words · {prompt.length} chars</span>
            <div className="flex items-center gap-2">
              {prompt && (
                <button
                  onClick={() => { setPrompt(""); setResult(null); setError(null) }}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                onClick={optimize}
                disabled={loading || !prompt.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {loading ? "Analyzing…" : "Validate & Optimize"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Scorecard */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {aiScore !== null ? "AI score" : "Live score"}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${g.cls}`}>{shownScore}<span className="text-sm text-slate-400">/100</span></p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div className={`h-full rounded-full transition-all duration-300 ${g.bar}`} style={{ width: `${shownScore}%` }} />
          </div>
          <p className={`mt-1 text-[11px] font-semibold ${g.cls}`}>{g.label}</p>

          <ul className="mt-4 space-y-2.5">
            {live.checks.map(c => {
              const ai = result?.pillars.find(p => p.key === c.key)
              const pass = ai ? ai.score >= 14 : c.pass
              return (
                <li key={c.key} className="flex items-start gap-2.5">
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    pass ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
                         : "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                  }`}>
                    {pass ? <Check className="h-2.5 w-2.5" /> : "·"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {c.label}
                      {ai && <span className="ml-1.5 text-[10px] font-bold tabular-nums text-slate-400">{ai.score}/20</span>}
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{ai?.feedback || c.hint}</p>
                  </div>
                </li>
              )
            })}
          </ul>

          {result?.summary && (
            <p className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              {result.summary}
            </p>
          )}
        </div>
      </div>

      {/* Optimized prompt */}
      {result?.optimized && (
        <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Optimized prompt
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setPrompt(result.optimized); setResult(null) }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                Use it
              </button>
              <CopyBtn text={result.optimized} />
            </div>
          </div>
          <textarea
            readOnly
            value={result.optimized}
            rows={10}
            className="w-full resize-y rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </div>
      )}
    </section>
  )
}
