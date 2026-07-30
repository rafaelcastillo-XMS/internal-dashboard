import { useState } from 'react'
import { ExternalLink, Info } from 'lucide-react'
import { PlatformIcon } from '@/features/social/components/PlatformIcon'
import { useFacebookData, type Campaign, type FbPost } from '@/features/social/hooks/useFacebookData'
import { DATE_PRESETS, PLATFORMS, type SocialPlatform } from '@/features/social/hooks/useSocialDashboardState'

const CONNECTED: SocialPlatform[] = ['facebook']
const FB = '#1877F2'

function fmt(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
    return n.toLocaleString('en-US')
}

function Card({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            {children}
        </div>
    )
}

function CardHeader({ title, subtitle, aside }: { title: string; subtitle?: string; aside?: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-stroke px-6 py-4 dark:border-strokedark">
            <div>
                <h3 className="font-semibold text-black dark:text-[#E2E5E9]">{title}</h3>
                {subtitle && <p className="mt-0.5 text-xs text-body dark:text-bodydark">{subtitle}</p>}
            </div>
            {aside}
        </div>
    )
}

// Meta Business Suite renders a weekly plan, but exposes no Graph API endpoint
// for it. The card keeps the shape and reports zeros rather than inventing
// tasks; wire it up if Meta ever ships an endpoint.
function WeeklyPlan() {
    const completed = 0
    const total = 0
    const pct = total > 0 ? (completed / total) * 100 : 0

    return (
        <Card>
            <CardHeader
                title="Weekly plan"
                subtitle="Set your business up for success by completing recommended tasks."
                aside={
                    <span className="flex items-center gap-1.5 rounded-full bg-stroke/50 px-2.5 py-1 text-[11px] font-medium text-body dark:bg-strokedark dark:text-bodydark">
                        <Info className="h-3 w-3" /> No Meta API
                    </span>
                }
            />
            <div className="p-6">
                <p className="text-sm font-semibold text-black dark:text-[#E2E5E9]">
                    {completed} of {total} tasks completed
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stroke dark:bg-strokedark">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#10B981' }} />
                </div>
                <p className="mt-4 text-xs text-body dark:text-bodydark">
                    Meta Business Suite does not expose the weekly plan through the Graph API, so tasks
                    cannot be synced. Track them in Business Suite.
                </p>
            </div>
        </Card>
    )
}

function PostGrid({ posts, loading }: { posts: FbPost[]; loading: boolean }) {
    if (loading) {
        return <p className="px-6 py-10 text-center text-sm text-body dark:text-bodydark">Loading posts…</p>
    }
    if (posts.length === 0) {
        return <p className="px-6 py-10 text-center text-sm text-body dark:text-bodydark">0 posts in this period.</p>
    }
    return (
        <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4">
            {posts.map(post => (
                <div key={post.id} className="overflow-hidden rounded-lg border border-stroke dark:border-strokedark">
                    {post.image
                        ? <img src={post.image} alt="" className="h-40 w-full object-cover" />
                        : <div className="flex h-40 w-full items-center justify-center bg-stroke/40 text-xs text-body dark:bg-strokedark dark:text-bodydark">No image</div>}
                    <div className="p-3">
                        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-black dark:text-[#E2E5E9]" title={post.message}>
                            {post.message || <span className="opacity-50">(no caption)</span>}
                        </p>
                        <p className="mt-1.5 text-[11px] text-body dark:text-bodydark">
                            {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {' · '}{post.type}
                            {' · '}{post.shares} shares
                        </p>
                        {post.permalink && (
                            <a href={post.permalink} target="_blank" rel="noreferrer"
                               className="mt-2 inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: FB }}>
                                See post <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

function CampaignTable({ campaigns, currency, loading }: { campaigns: Campaign[]; currency: string; loading: boolean }) {
    if (loading) {
        return <p className="px-6 py-10 text-center text-sm text-body dark:text-bodydark">Loading campaigns…</p>
    }
    if (campaigns.length === 0) {
        return (
            <div className="px-6 py-10 text-center">
                <p className="text-sm text-body dark:text-bodydark">0 campaigns.</p>
                <p className="mt-1 text-xs text-body dark:text-bodydark">
                    Assign an ad account to the System User in Business Settings to populate this table.
                </p>
            </div>
        )
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-stroke dark:border-strokedark">
                        {['Campaign', 'Status', 'Spend', 'Impressions', 'Clicks', 'CTR', 'CPC'].map(h => (
                            <th key={h} className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-stroke dark:divide-strokedark">
                    {campaigns.map(c => (
                        <tr key={c.id} className="hover:bg-gray-2 dark:hover:bg-meta-4">
                            <td className="max-w-[260px] truncate px-5 py-3.5 font-medium text-black dark:text-[#E2E5E9]" title={c.name}>{c.name}</td>
                            <td className="px-5 py-3.5">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-stroke/50 text-body dark:bg-strokedark dark:text-bodydark'}`}>
                                    {c.status}
                                </span>
                            </td>
                            <td className="px-5 py-3.5 tabular-nums text-black dark:text-[#E2E5E9]">{c.spend.toFixed(2)} {currency}</td>
                            <td className="px-5 py-3.5 tabular-nums text-body dark:text-bodydark">{fmt(c.impressions)}</td>
                            <td className="px-5 py-3.5 tabular-nums text-body dark:text-bodydark">{fmt(c.clicks)}</td>
                            <td className="px-5 py-3.5 tabular-nums text-body dark:text-bodydark">{c.ctr.toFixed(2)}%</td>
                            <td className="px-5 py-3.5 tabular-nums text-body dark:text-bodydark">{c.cpc.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function FacebookTab({ days }: { days: number }) {
    const { page, posts, campaigns, currency, loading, error } = useFacebookData(days)

    return (
        <div className="space-y-6">
            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-900/30 dark:bg-red-900/10">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                {[
                    { label: 'Followers', value: page?.followers ?? 0 },
                    { label: 'Page fans', value: page?.fans ?? 0 },
                    { label: 'Talking about', value: page?.talkingAbout ?? 0 },
                    { label: 'Posts', value: posts.length },
                ].map(stat => (
                    <div key={stat.label} className="rounded-xl border border-stroke bg-white px-5 py-4 dark:border-strokedark dark:bg-boxdark">
                        <p className="text-xs text-body dark:text-bodydark">{stat.label}</p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-black dark:text-[#E2E5E9]">{fmt(stat.value)}</p>
                    </div>
                ))}
            </div>

            <WeeklyPlan />

            <Card>
                <CardHeader title="Posts & reels" subtitle={`Published in the last ${days} days`} />
                <PostGrid posts={posts} loading={loading} />
            </Card>

            <Card>
                <CardHeader title="Campaigns" subtitle="Meta Ads performance" />
                <CampaignTable campaigns={campaigns} currency={currency} loading={loading} />
            </Card>
        </div>
    )
}

function NotConnected({ label }: { label: string }) {
    return (
        <Card>
            <div className="px-6 py-16 text-center">
                <p className="font-medium text-black dark:text-[#E2E5E9]">{label} is not connected</p>
                <p className="mt-1 text-sm text-body dark:text-bodydark">
                    Connect the account to load its data. No sample data is shown.
                </p>
            </div>
        </Card>
    )
}

export function SocialPlatforms() {
    const [active, setActive] = useState<SocialPlatform>('facebook')
    const [preset, setPreset] = useState(1)
    const days = DATE_PRESETS[preset].days

    return (
        <div className="mx-auto max-w-screen-2xl p-6">

            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">Platforms</h1>
                    <p className="text-sm text-body dark:text-bodydark">Per-network performance</p>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-stroke bg-white p-1 shadow-card dark:border-strokedark dark:bg-boxdark">
                    {DATE_PRESETS.map((p, idx) => (
                        <button key={p.days} onClick={() => setPreset(idx)}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${preset === idx
                                ? 'bg-[#8B5CF6] text-white shadow-sm'
                                : 'text-body hover:text-black dark:text-bodydark dark:hover:text-white'}`}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Platform buttons ── */}
            <div className="mb-6 flex flex-wrap items-center gap-2.5">
                {PLATFORMS.map(platform => {
                    const isActive = active === platform.id
                    const connected = CONNECTED.includes(platform.id)
                    return (
                        <button
                            key={platform.id}
                            onClick={() => setActive(platform.id)}
                            aria-pressed={isActive}
                            className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all
                                ${isActive
                                    ? 'border-transparent text-white shadow-sm'
                                    : 'border-stroke bg-white text-body hover:border-current hover:text-black dark:border-strokedark dark:bg-boxdark dark:text-bodydark dark:hover:text-white'}
                                ${connected ? '' : 'opacity-60'}`}
                            style={isActive ? { backgroundColor: platform.color } : undefined}
                        >
                            <span style={isActive ? undefined : { color: platform.color }}>
                                <PlatformIcon id={platform.id} />
                            </span>
                            {platform.label}
                            <span className={`h-1.5 w-1.5 rounded-full ${connected
                                ? 'bg-emerald-400'
                                : isActive ? 'bg-white/40' : 'bg-slate-300 dark:bg-slate-600'}`} />
                        </button>
                    )
                })}
            </div>

            {active === 'facebook'
                ? <FacebookTab days={days} />
                : <NotConnected label={PLATFORMS.find(p => p.id === active)?.label ?? active} />}
        </div>
    )
}
