import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { NotepadText } from 'lucide-react'
const SELECTED_KEY = 'xms_sem_selected'
const ACCOUNTS_KEY = 'xms_sem_accounts'

function formatAccountName(id: string): string {
  try {
    const accounts = JSON.parse(sessionStorage.getItem(ACCOUNTS_KEY) || '[]')
    const found = accounts.find((a: { id: string; name: string }) => a.id === id)
    return found?.name || id
  } catch { return id }
}

const NAV_GROUPS = [
  {
    section: null,
    items: [
      {
        label: 'Overview',
        href: '/sem',
        icon: <NotepadText className="h-5 w-5" />,
      },
    ],
  },
  {
    section: 'PERFORMANCE',
    items: [
      {
        label: 'Campaigns',
        href: '/sem/campaigns',
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        ),
      },
      {
        label: 'Keywords',
        href: '/sem/keywords',
        badge: { text: 'Ads', color: 'bg-[#16a34a]/20 text-[#16a34a]' },
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
    ],
  },
]

interface SEMSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export function SEMSidebar({ sidebarOpen, setSidebarOpen }: SEMSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const sidebarRef = useRef<HTMLElement>(null)
  const [activeAccount, setActiveAccount] = useState<string>(() => {
    try {
      const sel = JSON.parse(sessionStorage.getItem(SELECTED_KEY) || 'null')
      return sel?.accountId ? formatAccountName(sel.accountId) : ''
    } catch { return '' }
  })

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ accountId: string; name?: string }>).detail
      if (detail?.accountId) setActiveAccount(detail.name || formatAccountName(detail.accountId))
    }
    window.addEventListener('sem:account-changed', handler)
    return () => window.removeEventListener('sem:account-changed', handler)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setSidebarOpen(false)
      }
    }
    if (sidebarOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [sidebarOpen, setSidebarOpen])

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden
                    ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar panel */}
      <aside
        ref={sidebarRef}
        className={`fixed left-0 top-0 z-50 flex h-screen w-[288px] flex-col border-r transition-transform duration-300 ease-in-out
                    lg:translate-x-0 lg:static lg:z-auto
                    bg-[var(--sidebar-bg)] border-[var(--sidebar-border)]
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* ── Back to Dashboard ── */}
        <div className="flex h-16 items-center border-b border-slate-200/70 px-4 dark:border-white/10">
          <button
            onClick={() => navigate('/')}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3
                       text-sm font-medium transition-all duration-150
                       text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span>Back to Dashboard</span>
          </button>
        </div>

        {/* ── Active account badge ── */}
        <div className="border-b border-slate-200/70 px-4 py-4 dark:border-white/10">
          <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-section-label)]">
            Active Account
          </p>
          <div className="rounded-lg border border-slate-200/70 bg-[var(--bg-surface)] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="truncate text-sm font-semibold leading-tight text-[var(--text-primary)]">
              {activeAccount || 'XMS'}
            </p>
            {activeAccount && (
              <p className="mt-0.5 text-[10px] text-[#16a34a]/70 truncate">
                SEM Intelligence
              </p>
            )}
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-6' : ''}>
              {group.section && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--sidebar-section-label)]">
                  {group.section}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = location.pathname === item.href
                  return (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5
                                    text-sm font-medium transition-all duration-150
                                    ${active
                                      ? 'bg-[#15803D] text-white border border-[#15803D] shadow-sm dark:bg-[#16A34A] dark:text-white dark:border-[#16A34A]'
                                      : 'text-[var(--sidebar-item-text)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--text-primary)] border border-transparent'
                                    }`}
                      >
                        <span className={`shrink-0 ${active ? 'text-white' : ''}`}>
                          {item.icon}
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {'badge' in item && item.badge && (
                          <span className={`shrink-0 rounded px-1.5 py-0.5
                                            text-[10px] font-bold ${item.badge.color}`}>
                            {item.badge.text}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── Reports button — fixed at the bottom ── */}
        <div className="border-t border-slate-200/70 px-4 py-3 dark:border-white/10">
          <button
            disabled
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5
                       text-sm font-medium border border-transparent
                       text-[var(--sidebar-item-text)] opacity-60 cursor-not-allowed"
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="flex-1 truncate">Reports</span>
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-[#16a34a]/20 text-[#16a34a]">
              Soon
            </span>
          </button>
        </div>

        {/* ── Live data indicator ── */}
        <div className="border-t border-slate-200/70 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-[var(--sidebar-section-label)]">Google Ads API</span>
          </div>
        </div>
      </aside>
    </>
  )
}
