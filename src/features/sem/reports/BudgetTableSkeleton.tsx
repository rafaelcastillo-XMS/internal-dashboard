import { MONTHLY_HEADERS } from './reportTableHeaders'

export function BudgetTableSkeleton({ headers = MONTHLY_HEADERS }: { headers?: string[] }) {
  return <div role="status" aria-label="Loading report" aria-busy="true" className="overflow-x-auto rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
    <table className="w-full text-sm"><thead><tr className="border-b border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4">
      {headers.map(h => <th key={h} className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">{h}</th>)}
    </tr></thead><tbody aria-hidden="true" className="divide-y divide-stroke dark:divide-strokedark">
      {Array.from({ length: 6 }, (_, row) => <tr key={row}>{headers.map((h, col) => <td key={h} className="px-5 py-4"><div className={`h-5 rounded bg-stroke motion-safe:animate-pulse dark:bg-strokedark ${col === 0 ? 'w-36' : 'w-20'}`} /></td>)}</tr>)}
    </tbody></table>
  </div>
}
