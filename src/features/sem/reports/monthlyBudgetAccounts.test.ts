import { describe, expect, it } from 'vitest'
import { selectMonthlyBudgetAccounts, type MonthlyBudgetClient } from './monthlyBudgetAccounts'

const holt: MonthlyBudgetClient = { status: 'active', sem_enabled: true, sem_account_id: '5028132994', lsa_account_id: '4101522507' }
const atlantic: MonthlyBudgetClient = { status: 'active', sem_enabled: false, sem_account_id: '4338698549', lsa_account_id: null }
const accounts = ['5028132994', '4101522507', '4338698549', 'other'].map(id => ({ id, name: id }))
const ads = new Set(accounts.map(a => a.id))
const guarantee = new Set(['4101522507', '4338698549', 'other'])
const select = (clients: MonthlyBudgetClient[]) => selectMonthlyBudgetAccounts(accounts, clients, ads, guarantee)

describe('Monthly Budget account eligibility', () => {
  it('removes only the Holt LSA Google Ads row, excludes Atlantic, and preserves other rows', () => {
    expect(select([holt, atlantic])).toEqual([
      { account: accounts[0], googleAds: true, googleGuarantee: false },
      { account: accounts[1], googleAds: false, googleGuarantee: true },
      { account: accounts[3], googleAds: true, googleGuarantee: true },
    ])
  })
  it('excludes both linked accounts of an inactive client even when SEM is enabled', () => {
    const rows = select([{ ...holt, status: 'inactive' }, atlantic])
    expect(rows.map(row => row.account.id)).toEqual(['other'])
  })
  it('excludes a disabled client’s separate LSA account as well as its Ads account', () => {
    expect(select([{ ...holt, sem_enabled: false }, atlantic]).map(row => row.account.id)).toEqual(['other'])
  })
  it('preserves both platforms when they share the same account', () => {
    const rows = select([{ ...holt, sem_account_id: '4101522507' }, atlantic])
    expect(rows.find(row => row.account.id === '4101522507')).toMatchObject({ googleAds: true, googleGuarantee: true })
  })
  it('includes Atlantic again only when activated and preserves year-specific membership', () => {
    expect(select([holt, { ...atlantic, sem_enabled: true }]).find(row => row.account.id === '4338698549')).toMatchObject({ googleAds: true, googleGuarantee: true })
    expect(selectMonthlyBudgetAccounts(accounts, [holt], new Set(['5028132994']), new Set())).toEqual([
      { account: accounts[0], googleAds: true, googleGuarantee: false },
    ])
  })
})
