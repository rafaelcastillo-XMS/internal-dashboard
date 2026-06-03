export interface InsightItem {
  label: string
  metric: string
}

const styles = {
  green: {
    border:   'border-[#16a34a]/20',
    header:   'bg-[#16a34a]/5',
    title:    'text-[#16a34a]',
    badge:    'bg-[#16a34a]/10 text-[#16a34a]',
    dot:      'bg-[#16a34a]',
  },
  red: {
    border:   'border-red-200 dark:border-red-500/20',
    header:   'bg-red-50 dark:bg-red-500/5',
    title:    'text-red-600 dark:text-red-400',
    badge:    'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400',
    dot:      'bg-red-400',
  },
  blue: {
    border:   'border-[#1A72D9]/20',
    header:   'bg-[#1A72D9]/5',
    title:    'text-[#1A72D9]',
    badge:    'bg-[#1A72D9]/10 text-[#1A72D9]',
    dot:      'bg-[#1A72D9]',
  },
}

export function InsightCard({
  title,
  subtitle,
  variant,
  items,
  emptyText,
  loading = false,
}: {
  title: string
  subtitle: string
  variant: 'green' | 'red' | 'blue'
  items: InsightItem[]
  emptyText: string
  loading?: boolean
}) {
  const s = styles[variant]
  return (
    <div className={`rounded-xl border ${s.border} bg-white shadow-sm dark:bg-boxdark overflow-hidden flex flex-col`}>
      <div className={`${s.header} border-b ${s.border} px-4 py-3 flex items-center justify-between shrink-0`}>
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider ${s.title}`}>{title}</p>
          <p className="mt-0.5 text-[10px] text-body dark:text-bodydark">{subtitle}</p>
        </div>
        {items.length > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.badge}`}>{items.length}</span>
        )}
      </div>
      <div className="max-h-52 overflow-y-auto px-3 py-2">
        {loading ? (
          <div className="space-y-2 py-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-7 animate-pulse rounded-lg bg-stroke/40 dark:bg-strokedark/40" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-xs text-body dark:text-bodydark italic">{emptyText}</p>
        ) : (
          <ul className="space-y-1 py-1">
            {items.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-meta-4/30 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                  <span className="truncate text-xs text-black dark:text-[#E2E5E9]" title={item.label}>{item.label}</span>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}>{item.metric}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
