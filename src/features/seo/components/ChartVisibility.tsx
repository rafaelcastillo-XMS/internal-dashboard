import { Area, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function formatK(v: number, decimals = 0) {
  return v >= 1000 ? `${(v / 1000).toFixed(decimals)}k` : String(v)
}

function formatDate(val: string) {
  if (!val) return ''
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function VisibilityTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; dataKey: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-stroke bg-white px-3 py-2 text-xs shadow-lg dark:border-strokedark dark:bg-boxdark">
      <p className="mb-1 font-medium text-black dark:text-[#E2E5E9]">{formatDate(label ?? '')}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="text-body dark:text-bodydark">
          {p.value?.toLocaleString()} {p.dataKey === 'impressions' ? 'impressions' : 'clicks'}
        </p>
      ))}
    </div>
  )
}

interface ChartVisibilityProps {
  impressions?: number[]
  clicks?: number[]
  labels?: string[]
  isDark?: boolean
  dateRangeLabel?: string
}

export function ChartVisibility({
  impressions = [],
  clicks = [],
  labels = [],
  isDark = false,
  dateRangeLabel = 'Last 30 Days',
}: ChartVisibilityProps) {
  const chartData = labels.map((date, i) => ({
    date,
    impressions: impressions[i],
    clicks: clicks[i],
  }))
  const textColor = isDark ? '#AEB7C0' : '#64748B'
  const gridColor = isDark ? '#2E3A47' : '#E2E8F0'

  return (
    <div className="col-span-12 rounded-xl border border-stroke bg-white
                    shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="flex flex-wrap items-start justify-between gap-3
                      border-b border-stroke px-6 py-5 dark:border-strokedark">
        <div>
          <h3 className="text-lg font-semibold text-black dark:text-[#E2E5E9]">
            Search Visibility vs. Action
          </h3>
          <p className="mt-0.5 text-sm text-body dark:text-bodydark">
            GSC Impressions &amp; Clicks · {dateRangeLabel}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-body">
          <span className="flex items-center gap-1.5">
            <span className="block h-2.5 w-2.5 rounded-full bg-blue-500" />
            Impressions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Clicks
          </span>
        </div>
      </div>

      <div className="px-2 py-4">
        {labels.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="visImpressions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="visClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridColor} strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: textColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="impressions"
                tick={{ fill: textColor, fontSize: 11 }}
                tickFormatter={(v: number) => formatK(v)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="clicks"
                orientation="right"
                tick={{ fill: textColor, fontSize: 11 }}
                tickFormatter={(v: number) => formatK(v, 1)}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<VisibilityTooltip />} />
              <Area
                yAxisId="impressions"
                type="monotone"
                dataKey="impressions"
                stroke="#3B82F6"
                strokeWidth={2.5}
                fill="url(#visImpressions)"
                dot={{ r: 4, strokeWidth: 2, stroke: '#3B82F6', fill: '#fff' }}
                activeDot={{ r: 6 }}
              />
              <Area
                yAxisId="clicks"
                type="monotone"
                dataKey="clicks"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#visClicks)"
                dot={{ r: 4, strokeWidth: 2, stroke: '#10B981', fill: '#fff' }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[320px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full
                              border-2 border-stroke border-t-[#1A72D9]" />
              <p className="text-sm text-body dark:text-bodydark">Loading chart data…</p>
            </div>
          </div>
        )}
      </div>

      {impressions.length > 0 && (
        <div className="grid grid-cols-2 divide-x divide-stroke border-t
                        border-stroke dark:divide-strokedark dark:border-strokedark">
          <div className="px-6 py-3">
            <p className="text-[11px] uppercase tracking-wider text-body dark:text-bodydark">
              Total Impressions
            </p>
            <p className="mt-0.5 text-lg font-bold text-black dark:text-[#E2E5E9] tabular-nums">
              {impressions.reduce((a, b) => a + b, 0).toLocaleString()}
            </p>
          </div>
          <div className="px-6 py-3">
            <p className="text-[11px] uppercase tracking-wider text-body dark:text-bodydark">
              Total Clicks
            </p>
            <p className="mt-0.5 text-lg font-bold text-black dark:text-[#E2E5E9] tabular-nums">
              {clicks.reduce((a, b) => a + b, 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
