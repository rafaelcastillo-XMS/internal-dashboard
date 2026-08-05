import { useMemo, useState } from "react"
import { AlertCircle, Check, Copy, Loader2, Sparkles, Wand2 } from "lucide-react"
import { auditPrompt, buildStructuredPrompt } from "../../features/prompts/lib/promptAudit"

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

type OpenAIOptimization = {
  summary: string
  strengths: string[]
  improvements: string[]
  optimizedPrompt: string
}

export function PromptOptimizer() {
  const [prompt, setPrompt] = useState("")
  const [structured, setStructured] = useState<string | null>(null)
  const [openAIResult, setOpenAIResult] = useState<OpenAIOptimization | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [openAIError, setOpenAIError] = useState<string | null>(null)

  // Audit runs on every keystroke — plain regex, no API call.
  const audit = useMemo(() => auditPrompt(prompt), [prompt])
  const g = grade(audit.score)
  const words = prompt.trim() ? prompt.trim().split(/\s+/).length : 0

  const analyzeWithOpenAI = async () => {
    if (!prompt.trim()) return
    setIsAnalyzing(true)
    setOpenAIError(null)
    try {
      const response = await fetch("/api/ai/prompt-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Unable to analyze the prompt")
      setOpenAIResult(payload as OpenAIOptimization)
    } catch (error) {
      setOpenAIError(error instanceof Error ? error.message : "Unable to analyze the prompt")
      setOpenAIResult(null)
    } finally {
      setIsAnalyzing(false)
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
          <p className="text-xs text-slate-500 dark:text-slate-400">Score your prompt against the five pillars, then restructure it</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Editor */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <textarea
            value={prompt}
            disabled={isAnalyzing}
            onChange={e => { setPrompt(e.target.value); setOpenAIResult(null); setOpenAIError(null) }}
            rows={12}
            placeholder="Write your prompt here… e.g. Act as a Senior SEO strategist. Analyze the keyword table below and return the 10 highest-opportunity terms as a markdown table. Max 150 words, English only."
            className="w-full resize-y rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm font-mono leading-relaxed text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{words} words · {prompt.length} chars</span>
            <div className="flex items-center gap-2">
              {prompt && (
                <button
                  onClick={() => { setPrompt(""); setStructured(null); setOpenAIResult(null); setOpenAIError(null) }}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setStructured(buildStructuredPrompt(prompt))}
                disabled={!prompt.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Restructure prompt
              </button>
              <button
                onClick={analyzeWithOpenAI}
                disabled={!prompt.trim() || isAnalyzing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 dark:border-purple-800/70 bg-purple-50 dark:bg-purple-900/20 px-4 py-2 text-xs font-semibold text-purple-700 dark:text-purple-300 shadow-sm transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/40 disabled:opacity-50 cursor-pointer"
              >
                {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {isAnalyzing ? "Analyzing…" : "Analyze with OpenAI"}
              </button>
            </div>
          </div>
        </div>

        {/* Scorecard */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Score</p>
            <p className={`text-2xl font-bold tabular-nums ${g.cls}`}>{audit.score}<span className="text-sm text-slate-400">/100</span></p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div className={`h-full rounded-full transition-all duration-300 ${g.bar}`} style={{ width: `${audit.score}%` }} />
          </div>
          <p className={`mt-1 text-[11px] font-semibold ${g.cls}`}>{g.label}</p>

          <ul className="mt-4 space-y-2.5">
            {audit.pillars.map(p => (
              <li key={p.key} className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  p.pass ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
                         : "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                }`}>
                  {p.pass ? <Check className="h-2.5 w-2.5" /> : "·"}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{p.label}</p>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{p.feedback}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {openAIError && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{openAIError}</span>
        </div>
      )}

      {openAIResult && (
        <div className="mt-4 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-purple-600 dark:text-purple-300">OpenAI analysis</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{openAIResult.summary}</p>
            </div>
            <CopyBtn text={openAIResult.optimizedPrompt} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Strengths</p>
              <ul className="space-y-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {openAIResult.strengths.map((item, index) => <li key={`${item}-${index}`}>· {item}</li>)}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Improvements</p>
              <ul className="space-y-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {openAIResult.improvements.map((item, index) => <li key={`${item}-${index}`}>· {item}</li>)}
              </ul>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700/60">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Optimized prompt</p>
              <button
                onClick={() => { setPrompt(openAIResult.optimizedPrompt); setOpenAIResult(null) }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                Use it
              </button>
            </div>
            <textarea readOnly value={openAIResult.optimizedPrompt} rows={10} className="w-full resize-y rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none" />
          </div>
        </div>
      )}

      {/* Restructured prompt */}
      {structured && (
        <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Restructured — fill the [TODO] blocks
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setPrompt(structured); setStructured(null) }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                Use it
              </button>
              <CopyBtn text={structured} />
            </div>
          </div>
          <textarea
            readOnly
            value={structured}
            rows={12}
            className="w-full resize-y rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </div>
      )}
    </section>
  )
}
