import { useState, useEffect } from 'react'

export const DATE_PRESETS = [
  { label: 'Last 7 Days',  days: 7  },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
]

export function getDateRange(days: number) {
  const end   = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { startDate: fmt(start), endDate: fmt(end) }
}

export function formatDateLabel(startDate: string, endDate: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  const s = new Date(startDate).toLocaleDateString('en-US', opts)
  const e = new Date(endDate).toLocaleDateString('en-US', opts)
  return `${s} – ${e}`
}

export const SEM_API = '/api/sem'

const ACCOUNTS_KEY = 'xms_sem_accounts'
const SELECTED_KEY = 'xms_sem_selected'

function ssGet(key: string) {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') } catch { return null }
}
function ssSet(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export interface AdsAccount {
  id:       string
  name:     string
  currency: string
  timezone: string
  status:   string
}

export function useSEMDashboardState(defaultPreset = 1) {
  const [selectedPreset, setSelectedPreset] = useState(defaultPreset)
  const [dateRange,      setDateRange]      = useState(getDateRange(DATE_PRESETS[defaultPreset].days))
  const [loading,        setLoading]        = useState(false)
  const [lastUpdated,    setLastUpdated]    = useState<Date | null>(null)
  const [accountsError,  setAccountsError]  = useState<string | null>(null)

  const [accounts, setAccounts] = useState<AdsAccount[]>(() => {
    return ssGet(ACCOUNTS_KEY) || []
  })

  const [selectedAccountId, setSelectedAccountIdRaw] = useState<string>(() => {
    const sel = ssGet(SELECTED_KEY)
    if (sel?.accountId) return sel.accountId
    const cached: AdsAccount[] = ssGet(ACCOUNTS_KEY) || []
    return cached[0]?.id || ''
  })

  // Load account list on mount
  useEffect(() => {
    fetch(`${SEM_API}/accounts`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setAccountsError(d.error); return }
        const list: AdsAccount[] = d.accounts || []
        setAccounts(list)
        ssSet(ACCOUNTS_KEY, list)
        setSelectedAccountIdRaw((prev) => prev || list[0]?.id || '')
      })
      .catch((err: Error) => setAccountsError(err.message))
  }, [])

  // Persist selection + notify sidebar
  useEffect(() => {
    if (selectedAccountId) {
      const name = accounts.find((a) => a.id === selectedAccountId)?.name || selectedAccountId
      ssSet(SELECTED_KEY, { accountId: selectedAccountId })
      window.dispatchEvent(new CustomEvent('sem:account-changed', { detail: { accountId: selectedAccountId, name } }))
    }
  }, [selectedAccountId, accounts])

  function setSelectedAccountId(id: string) {
    setSelectedAccountIdRaw(id)
  }

  function handlePresetChange(idx: number) {
    setSelectedPreset(idx)
    setDateRange(getDateRange(DATE_PRESETS[idx].days))
  }

  const accountOptions = accounts
    .filter((a) => a.status === 'ENABLED')
    .map((a) => ({ value: a.id, label: a.name || a.id }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null

  return {
    selectedPreset,
    dateRange,
    loading, setLoading,
    lastUpdated, setLastUpdated,
    accountsError,
    accounts,
    selectedAccountId, setSelectedAccountId,
    selectedAccount,
    accountOptions,
    handlePresetChange,
  }
}
