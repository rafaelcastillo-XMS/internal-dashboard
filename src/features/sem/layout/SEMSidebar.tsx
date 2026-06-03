import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { NotepadText, ArrowLeft } from 'lucide-react'
import { useSidebar } from '@/context/useSidebar'
import { XMSLogo } from '@/components/ui/XMSLogo'
import { SEMAccountSelector } from '@/features/sem/components/SEMAccountSelector'

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
        icon: <NotepadText className="w-4 h-4" />,
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
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: 'Search Terms',
        href: '/sem/search-terms',
        badge: { text: 'Ads', color: 'bg-[#16a34a]/20 text-[#16a34a]' },
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0zM10.5 7.5h3m-3 3h3m-3 3h1.5" />
          </svg>
        ),
      },
    ],
  },
]

function Tooltip({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    const handleEnter = () => {
      const rect = parent.getBoundingClientRect()
      setCoords({ top: rect.top + rect.height / 2, left: rect.right })
      setVisible(true)
    }
    const handleLeave = () => setVisible(false)
    parent.addEventListener('mouseenter', handleEnter)
    parent.addEventListener('mouseleave', handleLeave)
    return () => {
      parent.removeEventListener('mouseenter', handleEnter)
      parent.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  return (
    <>
      <div ref={ref} className="hidden" />
      {visible && createPortal(
        <div
          className="fixed -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-700 text-white text-[11px] font-medium rounded-lg z-[100] shadow-lg pointer-events-none whitespace-nowrap"
          style={{ top: coords.top, left: coords.left }}
        >
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-700" />
        </div>,
        document.body
      )}
    </>
  )
}

const activeClass = "bg-[#15803D] text-white border border-transparent shadow-sm"
const inactiveClass = "text-[var(--sidebar-item-text)] hover:bg-[var(--sidebar-item-hover)] border border-transparent"

export function SEMSidebar() {
  const { collapsed, isMobileOpen, closeMobile } = useSidebar()
  const location = useLocation()
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

  const navItemClass = collapsed
    ? "relative group flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all text-sm font-semibold"
    : "relative group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-semibold w-full"

  const isReportsActive = location.pathname === '/sem/reports'

  return (
    <>
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeMobile}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col h-screen border-r shrink-0 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 overflow-x-visible bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] sidebar-shadow ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: collapsed ? 64 : 232 }}
      >
        {/* Back to Home — header slot */}
        <div className={`h-16 border-b border-[var(--sidebar-border)] flex items-center transition-all duration-200 ${collapsed ? 'justify-center px-3' : 'px-4'}`}>
          <div className="relative group">
            <Link
              to="/"
              onClick={closeMobile}
              className={collapsed
                ? "flex items-center justify-center w-10 h-10 rounded-lg transition-all text-[var(--sidebar-section-label)] hover:text-[var(--text-primary)] hover:bg-[var(--sidebar-item-hover)]"
                : "flex items-center gap-2 px-2 py-2 rounded-lg transition-all text-sm font-semibold text-[var(--sidebar-section-label)] hover:text-[var(--text-primary)] hover:bg-[var(--sidebar-item-hover)] w-full"
              }
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              {!collapsed && 'Back to Home'}
            </Link>
            {collapsed && <Tooltip label="Back to Home" />}
          </div>
        </div>

        {/* Account selector (expanded only) */}
        {!collapsed && (
          <div className="border-b border-[var(--sidebar-border)] px-3 py-3">
            <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-section-label)]">Active Account</p>
            <SEMAccountSelector />
          </div>
        )}

        {/* Navigation */}
        <nav className={`flex-1 ${collapsed ? 'px-0 py-2' : 'px-3'} overflow-y-auto custom-scrollbar pb-2 space-y-0.5`}>

          {!collapsed ? (
            <div className="flex items-center gap-2 px-3 pt-4 pb-1.5">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sidebar-section-label)]">Menu</h2>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
          ) : <div className="mx-3 my-2 h-px bg-[var(--border)]" />}

          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.section ? (
                !collapsed ? (
                  <div className="flex items-center gap-2 px-3 pt-4 pb-1.5">
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sidebar-section-label)]">{group.section}</h2>
                    <div className="flex-1 h-px bg-[var(--border)]" />
                  </div>
                ) : <div className="mx-3 my-2 h-px bg-[var(--border)]" />
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = location.pathname === item.href
                  return (
                    <li key={item.href}>
                      <div className="relative group">
                        <Link
                          to={item.href}
                          onClick={closeMobile}
                          className={`${navItemClass} ${active ? activeClass : inactiveClass}`}
                        >
                          <span className="shrink-0">{item.icon}</span>
                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate">{item.label}</span>
                              {'badge' in item && item.badge && (
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${item.badge.color}`}>
                                  {item.badge.text}
                                </span>
                              )}
                            </>
                          )}
                        </Link>
                        {collapsed && <Tooltip label={item.label} />}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom: Reports link */}
        <div className={`${collapsed ? 'px-0 py-3' : 'px-3 pb-4 pt-3'} border-t border-[var(--sidebar-border)] space-y-0.5`}>
          <div className="relative group">
            <Link
              to="/sem/reports"
              onClick={closeMobile}
              className={`${navItemClass} ${isReportsActive ? activeClass : inactiveClass}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              {!collapsed && <span className="flex-1 truncate">Reports</span>}
            </Link>
            {collapsed && <Tooltip label="Reports" />}
          </div>
        </div>

        {/* Live indicator (expanded only) */}
        {!collapsed && (
          <div className="border-t border-[var(--sidebar-border)] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-[var(--sidebar-section-label)]">Google Ads API</span>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
