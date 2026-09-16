import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp, Loader2, Pin, RefreshCw, Sparkles, X } from 'lucide-react'

type Insights = Record<'short_term' | 'medium_term' | 'long_term', { action: string; impact: 'high' | 'medium' | 'low' }[]>
type Message = { role: 'user' | 'assistant'; content: string }
interface Props {
  module: 'seo' | 'sem'
  identity: string
  name: string
  dateRange: { startDate: string; endDate: string }
  context: Record<string, unknown>
  disabled?: boolean
}
const timeframes = [['short_term', 'Short-term', '7–14 days'], ['medium_term', 'Medium-term', '30–60 days'], ['long_term', 'Long-term', '3–6 months']] as const
function validInsights(value: unknown): value is Insights {
  return !!value && typeof value === 'object' && timeframes.every(([key]) => Array.isArray((value as Insights)[key]) && (value as Insights)[key].every(item => typeof item.action === 'string' && ['high', 'medium', 'low'].includes(item.impact)))
}

export function PerformanceAssistant({ module, identity, name, dateRange, context, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [pinned, setPinned] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<'insights' | 'chat' | null>(null)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const cacheKey = `performance-assistant:${module}:${identity}:${dateRange.startDate}:${dateRange.endDate}`

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(cacheKey) || 'null')
      if (validInsights(saved)) { setInsights(saved); setPinned(true) }
    } catch { /* Storage is optional. */ }
    return () => controller.current?.abort()
  }, [cacheKey])
  useEffect(() => {
    if (open) closeButton.current?.focus()
  }, [open])
  useEffect(() => {
    if (messages.length) end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy, open])

  function close() {
    setOpen(false)
    requestAnimationFrame(() => launcher.current?.focus())
  }
  async function request(kind: 'insights' | 'chat') {
    if (controller.current || disabled || (kind === 'chat' && !draft.trim())) return
    const nextMessages: Message[] = [...messages, { role: 'user', content: draft.trim() }]
    const abort = new AbortController()
    controller.current = abort
    setBusy(kind); setError('')
    try {
      const res = await fetch(kind === 'insights' ? `/api/ai/${module}-insights` : '/api/ai/performance-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
        body: JSON.stringify(kind === 'insights' ? context : { module, context, insights, messages: nextMessages.slice(-20) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(res.status === 503 ? 'AI is not configured. Contact your administrator.' : 'Unable to get a response. Please try again.')
      if (kind === 'insights') {
        if (!validInsights(data)) throw new Error('Invalid analysis received. Please try again.')
        setInsights(data); setPinned(false)
        try { localStorage.removeItem(cacheKey) } catch { /* Storage is optional. */ }
      } else {
        if (typeof data.response !== 'string' || !data.response.trim()) throw new Error('Empty response. Please try again.')
        setMessages([...nextMessages, { role: 'assistant', content: data.response }]); setDraft('')
      }
    } catch (err) {
      if (!abort.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to connect. Please try again.')
    } finally {
      if (!abort.signal.aborted) { setBusy(null); controller.current = null }
    }
  }
  function togglePin() {
    try {
      if (pinned) localStorage.removeItem(cacheKey)
      else localStorage.setItem(cacheKey, JSON.stringify(insights))
      setPinned(!pinned)
    } catch { setError('This browser could not save the analysis.') }
  }

  return createPortal(<>
    <button ref={launcher} onClick={() => setOpen(true)} aria-expanded={open} aria-controls="performance-assistant" className={`${open ? 'hidden' : 'flex'} fixed bottom-6 right-6 z-40 items-center gap-3 rounded-2xl border border-violet-200 bg-[var(--bg-surface)] px-5 py-3 text-[var(--text-primary)] shadow-xl transition hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-violet-500`}>
      <span className="rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 p-2.5 text-white"><Sparkles size={20} /></span>
      <span className="text-left"><span className="block text-sm font-semibold">AI Insights</span><span className="block text-xs text-[var(--text-muted)]">{module.toUpperCase()} · Ask about your performance</span></span>
    </button>
    {open && <aside id="performance-assistant" role="dialog" aria-modal="false" aria-labelledby="assistant-title" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close() } }} className="fixed bottom-3 top-20 right-3 z-50 animate-in slide-in-from-right-4 duration-200 motion-reduce:animate-none flex w-[420px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xl">
      <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 dark:border-slate-700 p-5">
        <Sparkles className="mt-1 shrink-0 text-violet-500" size={22} />
        <div className="min-w-0 flex-1"><h2 id="assistant-title" className="font-semibold">{module.toUpperCase()} Assistant</h2><p className="mt-1 truncate text-xs text-[var(--text-muted)]" title={name}>{name || 'Select an account'}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{dateRange.startDate} — {dateRange.endDate}</p></div>
        <button ref={closeButton} onClick={close} aria-label="Close assistant" className="rounded-lg p-1.5 hover:bg-violet-500/10 focus-visible:ring-2 focus-visible:ring-violet-500"><X size={20} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Performance Insights</h3>{insights && <button onClick={togglePin} className="flex items-center gap-1 text-xs text-violet-500"><Pin size={13} />{pinned ? 'Unpin analysis' : 'Pin analysis'}</button>}</div>
        {!insights && <div className="mb-5 rounded-xl bg-violet-500/5 p-4"><p className="text-sm font-medium">Turn your data into next steps</p><p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">Generate an analysis of this overview, or ask a question about your performance below.</p></div>}
        <button onClick={() => request('insights')} disabled={disabled || !!busy} className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-40">
          {busy === 'insights' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}{busy === 'insights' ? 'Analyzing performance…' : insights ? 'Regenerate analysis' : 'Generate insights'}
        </button>
        {insights && <div className="space-y-3">{timeframes.map(([key, label, period]) => <section key={key} className="overflow-hidden rounded-xl border border-violet-500/15"><div className="flex items-center justify-between bg-violet-500/5 px-4 py-3"><h4 className="text-xs font-semibold">{label}</h4><span className="text-[10px] text-[var(--text-muted)]">{period}</span></div><ul className="space-y-4 p-4">{insights[key].map((item, index) => <li key={index} className="text-xs leading-relaxed text-[var(--text-secondary)]"><span className={`mb-1 block text-[9px] font-semibold uppercase tracking-wide ${item.impact === 'high' ? 'text-rose-500' : item.impact === 'medium' ? 'text-amber-500' : 'text-slate-500'}`}>{item.impact} impact</span>{item.action}</li>)}{!insights[key].length && <li className="text-xs text-[var(--text-muted)]">Insufficient data for this timeframe.</li>}</ul></section>)}</div>}
        <div role="log" aria-label="Conversation" aria-live="polite" className="mt-6 space-y-4">{messages.map((message, index) => <div key={index} className={`rounded-xl p-3 text-sm ${message.role === 'user' ? 'ml-6 bg-violet-500/10' : 'mr-3 bg-[var(--bg-subtle)]'}`}><p className="mb-1 text-[10px] font-semibold text-[var(--text-muted)]">{message.role === 'user' ? 'You' : 'Assistant'}</p><p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p></div>)}{busy === 'chat' && <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><Loader2 size={14} className="animate-spin" />Thinking…</p>}</div>
        <div ref={end} />
      </div>
      <footer className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-4">
        {error && <p role="alert" className="mb-3 text-xs text-red-500">{error}</p>}
        {disabled && <p className="mb-3 text-xs text-[var(--text-muted)]">Select an account and wait for the overview to finish loading.</p>}
        <form onSubmit={event => { event.preventDefault(); void request('chat') }} className="rounded-2xl border border-violet-500/25 p-3 focus-within:ring-2 focus-within:ring-violet-500/30">
          <textarea aria-label="Ask about your performance" placeholder="Ask about your performance…" value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} rows={2} disabled={disabled || !!busy} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void request('chat') } }} className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)] disabled:opacity-50" />
          <div className="flex items-center justify-between"><span className="text-[10px] text-[var(--text-muted)]">Based on this overview</span><button type="submit" aria-label="Send message" disabled={disabled || !!busy || !draft.trim()} className="rounded-full bg-violet-600 p-2 text-white disabled:opacity-30"><ArrowUp size={16} /></button></div>
        </form>
      </footer>
    </aside>}
  </>, document.body)
}
