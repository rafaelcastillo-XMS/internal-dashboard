import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const options: ApexOptions = {
    chart: { type: 'area', sparkline: { enabled: true }, animations: { enabled: true, speed: 600 } },
    stroke: { curve: 'smooth', width: 1.5 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0 } },
    colors: [color],
    tooltip: { enabled: false },
  }
  return <ReactApexChart options={options} series={[{ data }]} type="area" height={40} width={80} />
}

function DeltaBadge({ delta, invertScale = false }: { delta: number | null; invertScale?: boolean }) {
  const isPositive = invertScale ? (delta ?? 0) < 0 : (delta ?? 0) > 0
  const isNeutral = delta === 0 || delta == null

  if (isNeutral) {
    return <span className="text-xs font-medium text-body dark:text-bodydark">No change</span>
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold
      ${isPositive ? 'text-meta-3' : 'text-danger'}`}>
      <svg className={`h-3 w-3 ${isPositive ? '' : 'rotate-180'}`} viewBox="0 0 10 10" fill="currentColor">
        <path d="M5 0L9.33 7.5H0.67L5 0Z" />
      </svg>
      {Math.abs(delta!).toFixed(1)}%
    </span>
  )
}

interface CardDataStatsProps {
  title: string
  value: string
  delta: number | null
  deltaLabel?: string
  sparklineData?: number[]
  invertScale?: boolean
  sparklineColor?: string
  icon: React.ReactNode
  iconBg?: string
  source?: string
}

export function CardDataStats({
  title,
  value,
  delta,
  deltaLabel = 'vs last period',
  sparklineData = [],
  invertScale = false,
  sparklineColor = '#1A72D9',
  icon,
  iconBg = 'bg-[#1A72D9]/10',
  source,
}: CardDataStatsProps) {
  return (
    <div className="rounded-xl border border-stroke bg-white px-5 py-5
                    shadow-default transition-shadow duration-200
                    hover:shadow-xms-glow
                    dark:border-strokedark dark:bg-boxdark">
      <div className="flex items-start justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
        {source && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold
                           uppercase tracking-wider bg-[#1A72D9]/10 text-[#1A72D9]">
            {source}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-body dark:text-bodydark">
            {title}
          </p>
          <h4 className="text-2xl font-bold text-black dark:text-white tabular-nums">
            {value}
          </h4>
        </div>
        {sparklineData.length > 1 && (
          <div className="-mr-1 -mb-1">
            <Sparkline data={sparklineData} color={sparklineColor} />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-stroke pt-3 dark:border-strokedark">
        <DeltaBadge delta={delta} invertScale={invertScale} />
        <span className="text-xs text-body dark:text-bodydark">{deltaLabel}</span>
      </div>
    </div>
  )
}
