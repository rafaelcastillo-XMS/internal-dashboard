const METRICS_CONFIG = [
  { key: 'lcp', label: 'LCP', fullLabel: 'Largest Contentful Paint', unit: 's', good: 2.5, poor: 4.0, toPercent: (v: number) => Math.min(100, (v / 5.0) * 100), format: (v: number) => `${v.toFixed(2)}s` },
  { key: 'inp', label: 'INP', fullLabel: 'Interaction to Next Paint', unit: 'ms', good: 200, poor: 500, toPercent: (v: number) => Math.min(100, (v / 700) * 100), format: (v: number) => `${Math.round(v)}ms` },
  { key: 'cls', label: 'CLS', fullLabel: 'Cumulative Layout Shift', unit: '', good: 0.1, poor: 0.25, toPercent: (v: number) => Math.min(100, (v / 0.35) * 100), format: (v: number) => v.toFixed(3) },
  { key: 'fid', label: 'FID', fullLabel: 'First Input Delay', unit: 'ms', good: 100, poor: 300, toPercent: (v: number) => Math.min(100, (v / 450) * 100), format: (v: number) => `${Math.round(v)}ms` },
]

function getStatus(value: number | null, good: number, poor: number) {
  if (value == null) return null
  if (value <= good) return 'good'
  if (value <= poor) return 'needs-improvement'
  return 'poor'
}

const STATUS_MAP: Record<string, { label: string; barClass: string; textClass: string }> = {
  'good':              { label: 'Good',       barClass: 'bg-meta-3',  textClass: 'text-meta-3'  },
  'needs-improvement': { label: 'Needs Work', barClass: 'bg-warning', textClass: 'text-warning' },
  'poor':              { label: 'Poor',       barClass: 'bg-danger',  textClass: 'text-danger'  },
}

function MetricRow({ config, value }: { config: typeof METRICS_CONFIG[0]; value: number | null }) {
  const status = getStatus(value, config.good, config.poor)
  const display = config.format(value ?? 0)
  const barPct = config.toPercent(value ?? 0)
  const st = STATUS_MAP[status ?? 'poor']

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-black dark:text-white w-8">{config.label}</span>
          <span className="hidden text-xs text-body dark:text-bodydark sm:inline">{config.fullLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-sm font-medium text-black dark:text-white">
            {value != null ? display : '—'}
          </span>
          {status && <span className={`text-[10px] font-bold ${st.textClass}`}>{st.label}</span>}
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stroke dark:bg-strokedark">
        <div className={`h-2 rounded-full transition-all duration-700 ease-out ${st.barClass}`} style={{ width: `${barPct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-body dark:text-bodydark">
        <span>Good ≤{config.format(config.good)}</span>
        <span>Poor &gt;{config.format(config.poor)}</span>
      </div>
    </div>
  )
}

function OverallScore({ metrics }: { metrics: Record<string, number | null> }) {
  const statuses = METRICS_CONFIG.map((c) => getStatus(metrics[c.key] ?? null, c.good, c.poor))
  const poorCount  = statuses.filter((s) => s === 'poor').length
  const needsCount = statuses.filter((s) => s === 'needs-improvement').length

  const [bg, text, label] =
    poorCount > 0  ? ['bg-danger/10',  'text-danger',  'Needs Attention'] :
    needsCount > 0 ? ['bg-warning/10', 'text-warning', 'Needs Work']      :
                     ['bg-meta-3/10',  'text-meta-3',  'Passing']

  return (
    <div className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${bg}`}>
      <span className={`text-sm font-bold ${text}`}>Overall: {label}</span>
      <div className="flex items-center gap-1">
        {[poorCount, needsCount, METRICS_CONFIG.length - poorCount - needsCount].map((count, i) => {
          const cls = ['bg-danger', 'bg-warning', 'bg-meta-3'][i]
          return count > 0 ? (
            <span key={i} className={`text-xs font-bold text-white rounded px-1.5 py-0.5 ${cls}`}>{count}</span>
          ) : null
        })}
      </div>
    </div>
  )
}

function MobileUsabilityRow({ verdict, issues = [] }: { verdict: string | null; issues?: string[] }) {
  const isPassing = verdict === 'PASS'
  const isPartial = verdict === 'PARTIAL'

  const [dotClass, textClass, label] =
    isPassing ? ['bg-meta-3', 'text-meta-3', 'Passing'] :
    isPartial ? ['bg-warning', 'text-warning', 'Partial'] :
                ['bg-danger', 'text-danger', 'Issues Found']

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[#1A72D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-black dark:text-white">Mobile Usability</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          <span className={`text-xs font-bold ${textClass}`}>{label}</span>
        </div>
      </div>
      {issues.length > 0 && (
        <ul className="space-y-1">
          {issues.map((issue) => (
            <li key={issue} className="flex items-start gap-2 rounded-md bg-danger/5 px-3 py-1.5 dark:bg-danger/10">
              <span className="mt-0.5 text-danger text-xs">✕</span>
              <span className="text-xs text-body dark:text-bodydark">{issue}</span>
            </li>
          ))}
        </ul>
      )}
      {issues.length === 0 && isPassing && (
        <p className="text-xs text-body dark:text-bodydark">No usability issues detected.</p>
      )}
    </div>
  )
}

interface CoreWebVitalsProps {
  metrics?: Record<string, number | null>
  mobile?: { verdict: string | null; issues?: string[] }
  url?: string | null
}

export function CoreWebVitals({ metrics = {}, mobile = { verdict: null, issues: [] }, url = null }: CoreWebVitalsProps) {
  return (
    <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="border-b border-stroke px-6 py-5 dark:border-strokedark">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-black dark:text-white">Core Web Vitals</h3>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">PageSpeed Insights · Mobile Strategy</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F47C20]/10">
            <svg className="h-5 w-5 text-[#F47C20]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
        </div>
        {url && (
          <p className="mt-2 truncate rounded bg-gray px-2.5 py-1 font-mono text-[11px] text-body dark:bg-meta-4 dark:text-bodydark" title={url}>
            {url}
          </p>
        )}
      </div>

      <div className="px-6 pt-4">
        <OverallScore metrics={metrics} />
      </div>

      <div className="space-y-5 px-6 py-5">
        {METRICS_CONFIG.map((config) => (
          <MetricRow key={config.key} config={config} value={metrics[config.key] ?? null} />
        ))}
      </div>

      <div className="border-t border-stroke px-6 py-5 dark:border-strokedark">
        <MobileUsabilityRow verdict={mobile.verdict} issues={mobile.issues} />
      </div>
    </div>
  )
}
