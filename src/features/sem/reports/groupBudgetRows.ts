import type { MonthlyBudgetClient } from './monthlyBudgetAccounts'

export type BudgetPlatform = 'Google Ads' | 'Google Guarantee' | 'OpenAI Ads'
/** Preserve account order and put each client's platforms in Monthly Report order. */
export function groupBudgetRows<T extends { accountId: string; clientId?: string; name: string; platform: BudgetPlatform }>(rows: T[], clients: MonthlyBudgetClient[]) {
  const groups = new Map<string, { id: string; name: string; items: T[] }>()
  for (const row of rows) {
    const client = clients.find(c => row.clientId ? c.id === row.clientId : c.sem_account_id === row.accountId || c.lsa_account_id === row.accountId)
    const id = client?.id ?? client?.sem_account_id ?? row.accountId
    const group = groups.get(id) ?? { id, name: row.name, items: [] }
    group.items.push(row)
    groups.set(id, group)
  }
  const order: BudgetPlatform[] = ['Google Ads', 'Google Guarantee', 'OpenAI Ads']
  return [...groups.values()].map(g => ({ ...g, items: [...g.items].sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform)) }))
}
