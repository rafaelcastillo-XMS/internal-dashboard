import type { MonthlyBudgetClient } from './monthlyBudgetAccounts'

export type BudgetPlatform = 'Google Ads' | 'Google Guarantee' | 'OpenAI Ads'

// These account links also exist in `clients`, but keeping the verified pair
// here prevents a split report if that table is temporarily unavailable to the
// current session while SEM account data still loads.
const ACCOUNT_GROUP_FALLBACKS: Record<string, { id: string; name: string }> = {
  '5028132994': { id: 'holts-garage', name: "Holt's Reliable Garage Door Repair" },
  '4101522507': { id: 'holts-garage', name: "Holt's Reliable Garage Door Repair" },
}

/** Preserve account order and put each client's platforms in Monthly Report order. */
export function groupBudgetRows<T extends { accountId: string; clientId?: string; name: string; platform: BudgetPlatform }>(rows: T[], clients: MonthlyBudgetClient[]) {
  const groups = new Map<string, { id: string; name: string; items: T[] }>()
  for (const row of rows) {
    const client = clients.find(c => row.clientId ? c.id === row.clientId : c.sem_account_id === row.accountId || c.lsa_account_id === row.accountId)
    const fallback = ACCOUNT_GROUP_FALLBACKS[row.accountId]
    const id = client?.id ?? fallback?.id ?? client?.sem_account_id ?? row.accountId
    const group = groups.get(id) ?? { id, name: fallback?.name ?? row.name, items: [] }
    group.items.push(row)
    groups.set(id, group)
  }
  const order: BudgetPlatform[] = ['Google Ads', 'Google Guarantee', 'OpenAI Ads']
  return [...groups.values()].map(g => ({ ...g, items: [...g.items].sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform)) }))
}
