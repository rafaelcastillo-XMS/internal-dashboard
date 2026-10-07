export interface MonthlyBudgetClient {
  status: string
  sem_enabled: boolean
  sem_account_id: string | null
  lsa_account_id: string | null
}

/** Keep legacy/unlinked accounts, but respect explicit client activation and
 * dedicated LSA mappings. Historical spend alone does not make an LSA account
 * a Google Ads account. This selection is shared by the table and exports. */
export function selectMonthlyBudgetAccounts<T extends { id: string }>(
  accounts: T[], clients: MonthlyBudgetClient[], adsIds: Set<string>, guaranteeIds: Set<string>,
) {
  const disabled = new Set<string>()
  const adsMappings = new Set<string>()
  const dedicatedLsa = new Set<string>()
  for (const client of clients) {
    if (client.sem_account_id) adsMappings.add(client.sem_account_id)
    if (client.lsa_account_id && client.lsa_account_id !== client.sem_account_id) {
      dedicatedLsa.add(client.lsa_account_id)
    }
    if (client.sem_enabled === false || client.status !== 'active') {
      for (const id of [client.sem_account_id, client.lsa_account_id]) {
        if (id) disabled.add(id)
      }
    }
  }
  return accounts.filter(account => !disabled.has(account.id)).map(account => ({
    account,
    googleAds: adsIds.has(account.id) && !(dedicatedLsa.has(account.id) && !adsMappings.has(account.id)),
    googleGuarantee: guaranteeIds.has(account.id),
  })).filter(row => row.googleAds || row.googleGuarantee)
}
