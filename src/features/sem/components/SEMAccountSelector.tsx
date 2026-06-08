import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Search, Check, ChevronDown, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const ACCOUNTS_KEY = 'xms_sem_accounts'
const SELECTED_KEY = 'xms_sem_selected'

interface AdsAccount {
  id: string
  name: string
  status: string
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

export function SEMAccountSelector() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [accounts, setAccounts] = useState<AdsAccount[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 })

  const loadAccounts = () => {
    try {
      const cached: AdsAccount[] = JSON.parse(sessionStorage.getItem(ACCOUNTS_KEY) || '[]')
      if (cached.length > 0) {
        setAccounts(cached.filter(a => a.status === 'ENABLED'))
        return
      }
    } catch { /* ignore */ }
    supabase
      .from('sem_accounts')
      .select('id, name, status')
      .order('name')
      .then(({ data }) => {
        if (data) setAccounts(data.filter(a => a.status === 'ENABLED'))
      })
  }

  useEffect(() => {
    loadAccounts()
    try {
      const sel = JSON.parse(sessionStorage.getItem(SELECTED_KEY) || 'null')
      if (sel?.accountId) setSelectedId(sel.accountId)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ accountId: string }>).detail
      if (detail?.accountId) setSelectedId(detail.accountId)
    }
    window.addEventListener('sem:account-changed', handler)
    return () => window.removeEventListener('sem:account-changed', handler)
  }, [])

  const selectedAccount = accounts.find(a => a.id === selectedId)
  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleOpen = () => {
    loadAccounts()
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) setPanelPos({ top: rect.top, left: rect.right + 8 })
    setOpen(true)
    setTimeout(() => searchRef.current?.focus(), 80)
  }

  const handleSelect = (account: AdsAccount) => {
    setSelectedId(account.id)
    sessionStorage.setItem(SELECTED_KEY, JSON.stringify({ accountId: account.id }))
    window.dispatchEvent(new CustomEvent('sem:account-changed', {
      detail: { accountId: account.id, name: account.name }
    }))
    setOpen(false)
    setSearch('')
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="w-full text-left rounded-md border border-[var(--sidebar-border)] bg-[var(--bg-surface)] dark:bg-white/[0.03] px-3 py-2.5 hover:bg-[var(--bg-subtle)] transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#15803D] flex items-center justify-center text-white text-[10px] font-bold shrink-0 ring-2 ring-[#15803D]/20">
            {selectedAccount ? getInitials(selectedAccount.name) : <Building2 className="w-3.5 h-3.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-[var(--text-primary)]">
              {selectedAccount?.name || 'Select account'}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--sidebar-section-label)] truncate">
              SEM Intelligence
            </p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-[var(--sidebar-section-label)] shrink-0 group-hover:text-[var(--text-primary)] transition-colors" />
        </div>
      </button>

      {open && createPortal(
        <>
          {/* Overlay — behind sidebar (z-45 < sidebar z-50) */}
          <div
            className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-[1px]"
            onClick={() => { setOpen(false); setSearch('') }}
          />

          {/* Floating panel */}
          <div
            className="fixed z-50 w-96 bg-[var(--bg-raised)] border border-[var(--sidebar-border)] dark:border-white/[0.08] shadow-2xl rounded-xl overflow-hidden"
            style={{ top: panelPos.top, left: panelPos.left }}
          >
            {/* Search */}
            <div className="border-b border-[var(--border)] px-1">
              <div className="flex items-center gap-2.5 px-3 py-3">
                <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search accounts..."
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
              </div>
            </div>

            {/* Account list */}
            <div className="py-2 px-2 max-h-72 overflow-y-auto custom-scrollbar">
              <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--sidebar-section-label)]">
                Accounts
              </p>
              <ul className="space-y-0.5">
                {filtered.map(account => {
                  const isSelected = selectedId === account.id
                  return (
                    <li key={account.id}>
                      <button
                        onClick={() => handleSelect(account)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-[var(--hover-bg)] ${isSelected ? 'font-semibold text-[var(--text-primary)] bg-[var(--hover-bg)]' : 'font-medium text-[var(--text-secondary)]'}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-[#15803D] flex items-center justify-center text-white text-[10px] font-bold shrink-0 ring-2 ring-[#15803D]/20">
                          {getInitials(account.name)}
                        </div>
                        <span className="flex-1 text-left">{account.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                      </button>
                    </li>
                  )
                })}
                {filtered.length === 0 && (
                  <li className="px-3 py-4 text-sm text-[var(--text-muted)] text-center">
                    {accounts.length === 0 ? 'Loading accounts…' : 'No accounts found'}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
