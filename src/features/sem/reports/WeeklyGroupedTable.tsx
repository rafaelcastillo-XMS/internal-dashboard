import { buildWeeklyReportTable, type BudgetReportTable, type WeeklyDisplayRow } from './budgetReportTables'
import type { MonthlyBudgetClient } from './monthlyBudgetAccounts'
export type { WeeklyDisplayRow } from './budgetReportTables'

type Props = { table: BudgetReportTable } | { rows: WeeklyDisplayRow[]; clients: MonthlyBudgetClient[]; dateLabel: string }

export function WeeklyGroupedTable(props: Props) {
  const table = 'table' in props ? props.table : buildWeeklyReportTable(props.rows, props.clients, props.dateLabel)
  return <div className="overflow-x-auto rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
    <table className="w-full min-w-[1150px] text-sm"><thead><tr className="border-b border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4">
      {table.headers.map(h => <th key={h} className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">{h}</th>)}
    </tr></thead><tbody className="divide-y divide-stroke dark:divide-strokedark">
      {!table.groups.length && <tr><td colSpan={table.headers.length} className="px-5 py-10 text-center">No accounts found.</td></tr>}
      {table.groups.flatMap(g => [
        <tr key={`${g.id}:account`} className="bg-[#eef5ff] dark:bg-[#17233a]">
          <th colSpan={table.headers.length} scope="rowgroup" className="px-5 py-3 text-left font-semibold text-black dark:text-[#E2E5E9]">{g.name}</th>
        </tr>,
        ...g.rows.map(row => <tr key={row.key} title={row.note} className="hover:bg-gray-2 dark:hover:bg-meta-4">
          <td className="px-5 py-4" />
          {row.cells.slice(1).map((value, index) => <td key={index} className="overflow-hidden text-ellipsis whitespace-nowrap px-5 py-4 tabular-nums text-black dark:text-[#E2E5E9]">{value}</td>)}
        </tr>),
      ])}
      {table.totals.map(row => <tr key={row.key} className="border-t-2 border-[#16a34a]/30 bg-[#eef7f2] font-bold text-[#16a34a] dark:bg-[#1a382e]">
        <td className="px-5 py-4">{row.cells[0]}</td>{row.cells.slice(1).map((value, index) => <td key={index} className="whitespace-nowrap px-5 py-4 tabular-nums">{value}</td>)}
      </tr>)}
    </tbody></table>
  </div>
}
