import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useFacebookData } from '@/features/social/hooks/useFacebookData'
import { PLATFORMS, type SocialPlatform } from '@/features/social/hooks/useSocialDashboardState'

// Platforms with a live API connection. The rest render as "not connected"
// with zeros — never with sample numbers.
const CONNECTED: SocialPlatform[] = ['facebook']

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-stroke bg-white px-5 py-4 shadow-default dark:border-strokedark dark:bg-boxdark">
      <p className="text-sm font-medium text-body dark:text-bodydark">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-black dark:text-[#E2E5E9]">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-body dark:text-bodydark">{hint}</p>}
    </div>
  )
}

export function SocialDashboard() {
  const { page, posts, campaigns, loading, error } = useFacebookData(30)

  const followers   = page?.followers ?? 0
  const engagement  = page?.talkingAbout ?? 0
  const activeAds   = campaigns.filter(c => c.status === 'ACTIVE').length
  const totalSpend  = campaigns.reduce((sum, c) => sum + c.spend, 0)

  return (
    <div className="mx-auto max-w-screen-2xl">

      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black dark:text-[#E2E5E9]">Social Media</h1>
        <p className="text-sm text-body dark:text-bodydark">
          {loading ? 'Loading…' : `${CONNECTED.length} of ${PLATFORMS.length} platforms connected`}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-900/30 dark:bg-red-900/10">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Followers"      value={fmt(followers)}  hint="Across connected accounts" />
        <MetricCard label="Posts (30d)"    value={fmt(posts.length)} />
        <MetricCard label="Engagement"     value={fmt(engagement)} hint="People talking about this" />
        <MetricCard label="Active campaigns" value={fmt(activeAds)} hint={totalSpend > 0 ? `${totalSpend.toFixed(2)} spent` : undefined} />
      </div>

      {/* ── Account health ── */}
      <div className="mt-8 rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
          <h2 className="font-semibold text-black dark:text-[#E2E5E9]">Accounts</h2>
        </div>
        <ul className="divide-y divide-stroke dark:divide-strokedark">
          {PLATFORMS.map(platform => {
            const connected = CONNECTED.includes(platform.id)
            return (
              <li key={platform.id} className="flex items-center gap-4 px-6 py-4">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: platform.color }} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-black dark:text-[#E2E5E9]">
                    {connected && page ? page.name : platform.label}
                  </p>
                  <p className="truncate text-xs text-body dark:text-bodydark">
                    {connected
                      ? `${platform.label} · ${page?.category || 'Page'} · ${fmt(followers)} followers`
                      : `${platform.label} · not connected`}
                  </p>
                </div>
                {connected ? (
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Connected
                    </span>
                    {page?.link && (
                      <a href={page.link} target="_blank" rel="noreferrer"
                         className="text-body transition-colors hover:text-[#8B5CF6] dark:text-bodydark">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                ) : (
                  <span className="rounded-full bg-stroke/50 px-2.5 py-1 text-[11px] font-semibold text-body dark:bg-strokedark dark:text-bodydark">
                    Not connected
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        <div className="border-t border-stroke px-6 py-3 dark:border-strokedark">
          <Link to="/social/platforms" className="text-sm font-medium text-[#8B5CF6] hover:underline">
            View platform detail →
          </Link>
        </div>
      </div>

    </div>
  )
}
