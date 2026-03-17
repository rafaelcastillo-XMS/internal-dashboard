import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'

function buildOptions(labels: string[], isDark: boolean): ApexOptions {
  const textColor = isDark ? '#AEB7C0' : '#64748B'
  const gridColor = isDark ? '#2E3A47' : '#E2E8F0'

  return {
    chart: {
      type: 'area',
      fontFamily: 'Inter, system-ui, sans-serif',
      background: 'transparent',
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, speed: 700 },
    },
    colors: ['#3B82F6', '#10B981'],
    stroke: { curve: 'smooth', width: [2.5, 2] },
    fill: {
      type: 'gradient',
      gradient: {
        shade: isDark ? 'dark' : 'light',
        type: 'vertical',
        shadeIntensity: 0.3,
        opacityFrom: 0.25,
        opacityTo: 0.0,
        stops: [0, 100],
      },
    },
    yaxis: [
      {
        seriesName: 'Impressions',
        title: {
          text: 'Impressions',
          style: { color: '#3B82F6', fontWeight: 600, fontSize: '11px' },
        },
        labels: {
          style: { colors: textColor, fontSize: '11px' },
          formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
        },
      },
      {
        seriesName: 'Clicks',
        opposite: true,
        title: {
          text: 'Clicks',
          style: { color: '#10B981', fontWeight: 600, fontSize: '11px' },
        },
        labels: {
          style: { colors: textColor, fontSize: '11px' },
          formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v),
        },
      },
    ],
    xaxis: {
      categories: labels,
      type: 'category',
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: textColor, fontSize: '11px' },
        formatter: (val: string) => {
          if (!val) return ''
          const date = new Date(val)
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        },
      },
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      markers: { size: 6 },
      labels: { colors: textColor },
      itemMargin: { horizontal: 12 },
    },
    dataLabels: { enabled: false },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      shared: true,
      intersect: false,
      y: [
        { formatter: (v: number) => `${v?.toLocaleString()} impressions` },
        { formatter: (v: number) => `${v?.toLocaleString()} clicks` },
      ],
    },
    markers: ({
      size: 4,
      strokeWidth: 2,
      strokeColors: ['#3B82F6', '#10B981'],
      fillColors: ['#fff', '#fff'],
      hover: { size: 6 },
    } as unknown) as ApexOptions['markers'],
  }
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
  const series = [
    { name: 'Impressions', data: impressions },
    { name: 'Clicks', data: clicks },
  ]

  return (
    <div className="col-span-12 rounded-xl border border-stroke bg-white
                    shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="flex flex-wrap items-start justify-between gap-3
                      border-b border-stroke px-6 py-5 dark:border-strokedark">
        <div>
          <h3 className="text-lg font-semibold text-black dark:text-white">
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
          <ReactApexChart
            options={buildOptions(labels, isDark)}
            series={series}
            type="area"
            height={320}
          />
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
            <p className="mt-0.5 text-lg font-bold text-black dark:text-white tabular-nums">
              {impressions.reduce((a, b) => a + b, 0).toLocaleString()}
            </p>
          </div>
          <div className="px-6 py-3">
            <p className="text-[11px] uppercase tracking-wider text-body dark:text-bodydark">
              Total Clicks
            </p>
            <p className="mt-0.5 text-lg font-bold text-black dark:text-white tabular-nums">
              {clicks.reduce((a, b) => a + b, 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
