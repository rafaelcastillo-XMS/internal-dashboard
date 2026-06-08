import { useState, useEffect } from 'react'
import { Sparkles, Zap, Target, TrendingUp, AlertCircle, Loader2, Pin, PinOff, RefreshCw } from 'lucide-react'

function ClaudeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/>
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

interface GscData {
  totalClicks: number
  totalImpressions: number
  avgPosition: number
  queries?: { query: string; clicks: number; impressions: number; position: number; ctr: number }[]
}

interface Ga4Data {
  engagedSessions: number
  conversionRate: number
  topPages?: { page: string; sessions?: number }[]
}

interface Props {
  clientName: string
  gscSite: string
  gsc: GscData
  ga4: Ga4Data
  psiScore?: number | null
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

function cacheKey(site: string) {
  return `seo-ai-insights:${site}`
}

export function SEOAIInsights({ clientName, gscSite, gsc, ga4, psiScore }: Props) {
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [pinned, setPinned] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setInsights(null)
    setError('')
    setPinned(false)
    if (!gscSite) return
    try {
      const saved = localStorage.getItem(cacheKey(gscSite))
      if (saved) {
        setInsights(JSON.parse(saved))
        setPinned(true)
      }
    } catch { /* ignore */ }
  }, [gscSite])

  const generate = async () => {
    if (!gscSite) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/seo-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName, gscSite, gsc, ga4, psiScore }),
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
    if (!insights || !gscSite) return
    localStorage.setItem(cacheKey(gscSite), JSON.stringify(insights))
    setPinned(true)
  }

  const handleUnpin = () => {
    if (!gscSite) return
    localStorage.removeItem(cacheKey(gscSite))
    setPinned(false)
  }

  const displayName = clientName || gscSite.replace(/^https?:\/\//, '').replace(/\/$/, '')

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
              {gscSite
                ? `Generate AI-driven SEO recommendations for ${displayName}`
                : 'Select a property to generate insights'}
            </p>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={!gscSite}
          className="shrink-0 flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Generate Insights
        </button>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mb-6 rounded-xl border-[3px] border-violet-200 dark:border-violet-800/50 bg-violet-100/80 dark:bg-violet-900/25 px-6 py-5 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-violet-500 animate-spin shrink-0" />
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Analyzing {displayName}…</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Claude is generating SEO recommendations</p>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
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
            <ClaudeLogo className="w-3 h-3 text-[#D97706]" />
            <span className="font-semibold text-[#D97706]">Claude</span>
          </span>
          {pinned && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Pin className="w-2.5 h-2.5" />
              Pinned
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pinned ? (
            <button onClick={handleUnpin} title="Unpin" className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:opacity-70 transition-opacity">
              <PinOff className="w-3.5 h-3.5" />
              Unpin
            </button>
          ) : (
            <button onClick={handlePin} title="Pin to cache" className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <Pin className="w-3.5 h-3.5" />
              Pin
            </button>
          )}
          <button onClick={generate} className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
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
