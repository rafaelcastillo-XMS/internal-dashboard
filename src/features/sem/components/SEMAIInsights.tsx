import { useState, useEffect } from 'react'
import { Sparkles, Zap, Target, TrendingUp, AlertCircle, Loader2, Pin, PinOff, RefreshCw } from 'lucide-react'

function OpenAiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.0201 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
    </svg>
  )
}

interface InsightItem {
  action: string
  impact: 'high' | 'medium' | 'low'
}

interface Insights {
  short_term: InsightItem[]
  medium_term: InsightItem[]
  long_term: InsightItem[]
}

interface Props {
  accountName: string
  summary: {
    impressions: number
    clicks: number
    ctr: number
    avg_cpc: number
    cost: number
    conversions: number
    cost_per_conversion: number
  }
  campaigns: {
    name: string
    impressions: number
    clicks: number
    ctr: number
    avg_cpc: number
    cost: number
    conversions: number
  }[]
}

const impactColors = {
  high:   'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  low:    'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400',
}

const timeframes = [
  {
    key: 'short_term' as const,
    label: 'Short-term',
    sub: '7–14 days',
    icon: Zap,
    color: 'text-blue-600 dark:text-blue-400',
    headerBg: 'bg-blue-50 dark:bg-blue-500/[0.07]',
    border: 'border-blue-200/60 dark:border-blue-500/20',
    iconBg: 'bg-blue-100 dark:bg-blue-500/15',
    dot: 'bg-blue-500',
  },
  {
    key: 'medium_term' as const,
    label: 'Medium-term',
    sub: '30–60 days',
    icon: Target,
    color: 'text-violet-600 dark:text-violet-400',
    headerBg: 'bg-violet-50 dark:bg-violet-500/[0.07]',
    border: 'border-violet-200/60 dark:border-violet-500/20',
    iconBg: 'bg-violet-100 dark:bg-violet-500/15',
    dot: 'bg-violet-500',
  },
  {
    key: 'long_term' as const,
    label: 'Long-term',
    sub: '3–6 months',
    icon: TrendingUp,
    color: 'text-emerald-600 dark:text-emerald-400',
    headerBg: 'bg-emerald-50 dark:bg-emerald-500/[0.07]',
    border: 'border-emerald-200/60 dark:border-emerald-500/20',
    iconBg: 'bg-emerald-100 dark:bg-emerald-500/15',
    dot: 'bg-emerald-500',
  },
]

function cacheKey(name: string) {
  return `sem-ai-insights:${name}`
}

export function SEMAIInsights({ accountName, summary, campaigns }: Props) {
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [pinned, setPinned] = useState(false)
  const [error, setError] = useState('')

  // When account changes, try to load pinned insights from localStorage
  useEffect(() => {
    setInsights(null)
    setError('')
    setPinned(false)
    if (!accountName) return
    try {
      const saved = localStorage.getItem(cacheKey(accountName))
      if (saved) {
        setInsights(JSON.parse(saved))
        setPinned(true)
      }
    } catch { /* ignore */ }
  }, [accountName])

  const generate = async () => {
    if (!accountName) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/sem-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName, summary, campaigns: campaigns.slice(0, 8) }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setInsights(data)
      setPinned(false)
    } catch {
      setError('Failed to generate insights. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePin = () => {
    if (!insights || !accountName) return
    localStorage.setItem(cacheKey(accountName), JSON.stringify(insights))
    setPinned(true)
  }

  const handleUnpin = () => {
    if (!accountName) return
    localStorage.removeItem(cacheKey(accountName))
    setPinned(false)
  }

  // ── Initial state ─────────────────────────────────────────────────────────
  if (!insights && !loading) {
    return (
      <div className="mb-6 rounded-xl border-[3px] border-violet-200 dark:border-violet-800/50 bg-violet-100/80 dark:bg-violet-900/25 px-6 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Performance Insights</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {accountName
                ? `Generate AI-driven recommendations for ${accountName}`
                : 'Select an account to generate insights'}
            </p>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={!accountName}
          className="shrink-0 flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Generate Insights
        </button>
      </div>
    )
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mb-6 rounded-xl border-[3px] border-violet-200 dark:border-violet-800/50 bg-violet-100/80 dark:bg-violet-900/25 px-6 py-5 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-violet-500 animate-spin shrink-0" />
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Analyzing {accountName}…</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">ChatGPT is generating strategic recommendations</p>
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mb-6 rounded-xl border-[3px] border-red-200 dark:border-red-700/50 bg-red-50 dark:bg-red-950/20 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
        <button onClick={generate} className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:opacity-70 transition-opacity shrink-0">
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Performance Insights</p>
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            by
            <OpenAiLogo className="w-3 h-3 text-[var(--text-secondary)]" />
            <span className="font-semibold text-[var(--text-secondary)]">ChatGPT</span>
          </span>
          {pinned && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Pin className="w-2.5 h-2.5" />
              Pinned
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Pin / Unpin */}
          {pinned ? (
            <button
              onClick={handleUnpin}
              title="Unpin — results will not be cached"
              className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:opacity-70 transition-opacity"
            >
              <PinOff className="w-3.5 h-3.5" />
              Unpin
            </button>
          ) : (
            <button
              onClick={handlePin}
              title="Pin — save to cache so you can return without regenerating"
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Pin className="w-3.5 h-3.5" />
              Pin
            </button>
          )}

          {/* Regenerate */}
          <button
            onClick={generate}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Regenerate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {timeframes.map(({ key, label, sub, icon: Icon, color, headerBg, border, iconBg, dot }) => {
          const items = insights?.[key] ?? []
          return (
            <div key={key} className={`rounded-xl border ${border} bg-[var(--bg-surface)] dark:bg-white/[0.02] overflow-hidden`}>
              <div className={`${headerBg} border-b ${border} px-4 py-3 flex items-center gap-2.5`}>
                <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <div>
                  <p className={`text-xs font-bold ${color}`}>{label}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{sub}</p>
                </div>
              </div>
              <ul className="px-4 py-3 space-y-2.5">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{item.action}</p>
                    </div>
                    {item.impact && (
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${impactColors[item.impact] ?? impactColors.low}`}>
                        {item.impact}
                      </span>
                    )}
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="text-xs text-[var(--text-muted)] italic py-2">Insufficient data for this timeframe</li>
                )}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
