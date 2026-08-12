import { X } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Campaign } from '@/features/social/hooks/useFacebookData'
import { useCampaignInsightsSeries } from '@/features/social/hooks/useCampaignInsightsSeries'
import { computeCampaignHealth } from '@/features/social/lib/campaignHealth'

function fmt(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return n.toLocaleString('en-US')
}

const fmtDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function HealthBadge({ score, label }: { score: number; label: string }) {
    const color = score >= 70 ? '#16a34a' : score >= 40 ? '#f59e0b' : '#dc2626'
    return (
        <div className="flex items-center gap-3 rounded-xl border border-stroke px-4 py-3 dark:border-strokedark">
            <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(${color} ${score * 3.6}deg, ${color}22 0deg)` }}
            >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold dark:bg-boxdark" style={{ color }}>
                    {score}
                </div>
            </div>
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-body dark:text-bodydark">Health score</p>
                <p className="text-base font-bold" style={{ color }}>{label}</p>
            </div>
        </div>
    )
}

export function CampaignDetailModal({
    campaign, currency, days, onClose,
}: {
    campaign: Campaign
    currency: string
    days: number
    onClose: () => void
}) {
    const { series, loading, error } = useCampaignInsightsSeries(campaign.id, days)
    const health = computeCampaignHealth(campaign)

    const kpis = [
        { label: 'Spend', value: `${campaign.spend.toFixed(2)} ${currency}` },
        { label: 'Impressions', value: fmt(campaign.impressions) },
        { label: 'Clicks', value: fmt(campaign.clicks) },
        { label: 'CTR', value: `${campaign.ctr.toFixed(2)}%` },
        { label: 'CPC', value: campaign.cpc.toFixed(2) },
        { label: 'Reach', value: fmt(campaign.reach) },
    ]

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div
                className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-boxdark"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-body dark:text-bodydark">{campaign.objective || 'Campaign'}</p>
                        <h2 className="mt-0.5 text-lg font-bold text-black dark:text-[#E2E5E9]">{campaign.name}</h2>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${campaign.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-stroke/50 text-body dark:bg-strokedark dark:text-bodydark'}`}>
                            {campaign.status}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-stroke text-slate-500 transition hover:border-slate-400 hover:bg-slate-100 dark:border-strokedark dark:hover:bg-slate-800"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {kpis.map((kpi) => (
                        <div key={kpi.label} className="rounded-lg border border-stroke px-3 py-2.5 dark:border-strokedark">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-body dark:text-bodydark">{kpi.label}</p>
                            <p className="mt-0.5 text-base font-bold tabular-nums text-black dark:text-[#E2E5E9]">{kpi.value}</p>
                        </div>
                    ))}
                </div>

                <div className="mb-5">
                    <HealthBadge score={health.score} label={health.label} />
                    <ul className="mt-3 space-y-1.5">
                        {health.reasons.map((reason) => (
                            <li key={reason} className="text-xs text-body dark:text-bodydark">• {reason}</li>
                        ))}
                    </ul>
                </div>

                <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-body dark:text-bodydark">Daily trend</p>
                    {error && <p className="text-sm font-medium text-red-600">{error}</p>}
                    {loading && !error && <p className="text-sm text-body dark:text-bodydark">Loading daily trend…</p>}
                    {!loading && !error && series.length === 0 && (
                        <p className="text-sm text-body dark:text-bodydark">No daily breakdown available for this range.</p>
                    )}
                    {!loading && !error && series.length > 0 && (
                        <div className="space-y-5">
                            <div>
                                <p className="mb-1 text-[11px] font-semibold text-body dark:text-bodydark">Spend ({currency})</p>
                                <div className="h-36 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={series} margin={{ left: -20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} />
                                            <Tooltip
                                                labelFormatter={(value) => fmtDay(String(value))}
                                                formatter={(value: number) => [`${value.toFixed(2)} ${currency}`, 'Spend']}
                                            />
                                            <Area type="monotone" dataKey="spend" stroke="#16a34a" fill="#16a34a22" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div>
                                <p className="mb-1 text-[11px] font-semibold text-body dark:text-bodydark">
                                    <span className="text-[#3b82f6]">Impressions</span> vs <span className="text-[#f59e0b]">Clicks</span>
                                </p>
                                <div className="h-36 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={series} margin={{ left: -20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} />
                                            <Tooltip labelFormatter={(value) => fmtDay(String(value))} />
                                            <Line type="monotone" dataKey="impressions" name="Impressions" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey="clicks" name="Clicks" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
