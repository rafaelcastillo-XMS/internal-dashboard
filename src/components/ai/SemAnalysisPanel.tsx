import type { SemAnalysis } from './semAnalysis'

const areas = { account: 'Campaigns & budget', search_terms: 'Search terms', ads_assets: 'Ads & assets', tracking: 'Conversion tracking', landing_pages: 'Landing pages' }
const severityColors = { critical: 'bg-rose-500/15 text-rose-600 dark:text-rose-300', high: 'bg-orange-500/15 text-orange-700 dark:text-orange-300', medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', low: 'bg-slate-500/10 text-slate-600 dark:text-slate-300' }

export function SemAnalysisPanel({ analysis, onChooseTopic, disabled }: { analysis: SemAnalysis; onChooseTopic: (question: string) => void; disabled?: boolean }) {
  return <div className="space-y-4 break-words">
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">{analysis.analysis}</p>
    {analysis.findings.length > 0 && <div className="space-y-3" aria-label="Prioritized findings">
      {analysis.findings.map((finding, index) => <section key={`${finding.area}:${index}`} className="rounded-xl border border-violet-500/15 p-4">
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className={`rounded-full px-2 py-1 font-semibold uppercase ${severityColors[finding.severity]}`}>{finding.severity}</span>
          <span className="text-[var(--text-muted)]">{areas[finding.area]} · {finding.effort} effort</span>
        </div>
        <h4 className="mt-2 text-sm font-semibold">{finding.title}</h4>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]"><span className="font-semibold">Evidence: </span>{finding.evidence}</p>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">{finding.whyItMatters}</p>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]"><span className="font-semibold">Next step: </span>{finding.recommendation}</p>
        {finding.requiresClientApproval && <p className="mt-3 text-[10px] font-semibold text-amber-700 dark:text-amber-300">Requires client approval</p>}
      </section>)}
    </div>}
    {analysis.notVerified.length > 0 && <section className="rounded-xl border border-slate-500/15 bg-slate-500/5 p-4">
      <h4 className="text-xs font-semibold">Not verified</h4>
      <ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-relaxed text-[var(--text-muted)]">{analysis.notVerified.map((item, index) => <li key={index}>{item}</li>)}</ul>
    </section>}
    <section className="rounded-xl bg-violet-500/10 p-4">
      <p className="text-sm font-medium leading-relaxed">{analysis.followUpQuestion}</p>
      <div className="mt-3 flex flex-wrap gap-2">{[
        ['Spend & budget', 'Help me understand spend and budget allocation.'],
        ['Conversions', 'What should I check about conversions and lead quality?'],
        ['Campaigns', 'Which campaigns need attention and why?'],
        ['Search terms', 'Help me review search terms and negative keywords.'],
        ['Ads & assets', 'Help me review ad copy and assets.'],
        ['Landing pages', 'What should I review on the landing pages?'],
      ].map(([label, question]) => <button key={label} type="button" disabled={disabled} onClick={() => onChooseTopic(question)} className="rounded-full border border-violet-500/20 bg-[var(--bg-surface)] px-3 py-1.5 text-xs transition hover:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-40">{label}</button>)}</div>
    </section>
  </div>
}
