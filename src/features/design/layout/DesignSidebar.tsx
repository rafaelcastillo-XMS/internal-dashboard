import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { NotepadText } from 'lucide-react'

const SELECTED_KEY = 'xms_design_selected'

const NAV_GROUPS = [
  {
    section: null,
    items: [
      {
        label: 'Overview',
        href: '/design',
        icon: <NotepadText className="h-5 w-5" />,
      },
    ],
  },
  {
    section: 'PERFORMANCE',
    items: [
      {
        label: 'PageSpeed Insights',
        href: '/design/pagespeed',
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        ),
      },
      {
        label: 'Mobile Usability',
        href: '/design/mobile',
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 15.75h3" />
          </svg>
        ),
      },
    ],
  },
]

interface DesignSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export function DesignSidebar({ sidebarOpen, setSidebarOpen }: DesignSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const sidebarRef = useRef<HTMLElement>(null)
  const [activeClient, setActiveClient] = useState<string>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(SELECTED_KEY) || 'null')?.name || ''
    } catch { return '' }
  })

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ name: string }>).detail
      if (detail?.name) setActiveClient(detail.name)
    }
    window.addEventListener('design:client-changed', handler)
    return () => window.removeEventListener('design:client-changed', handler)
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
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden
                    ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        ref={sidebarRef}
        className={`fixed left-0 top-0 z-50 flex h-screen w-[288px] flex-col border-r transition-transform duration-300 ease-in-out
                    lg:translate-x-0 lg:static lg:z-auto
                    bg-[var(--sidebar-bg)] border-[var(--sidebar-border)]
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Back to Dashboard */}
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

        {/* Active client badge */}
        <div className="border-b border-slate-200/70 px-4 py-4 dark:border-white/10">
          <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-section-label)]">
            Active Client
          </p>
          <div className="rounded-lg border border-slate-200/70 bg-[var(--bg-surface)] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="truncate text-sm font-semibold leading-tight text-[var(--text-primary)]">
              {activeClient || 'Select a client'}
            </p>
            {activeClient && (
              <p className="mt-0.5 text-[10px] text-[#7C3AED]/70 truncate">Design Intelligence</p>
            )}
          </div>
        </div>

        {/* Navigation */}
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
                                      ? 'bg-[#7C3AED] text-white border border-[#7C3AED] shadow-sm'
                                      : 'text-[var(--sidebar-item-text)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--text-primary)] border border-transparent'
                                    }`}
                      >
                        <span className={`shrink-0 ${active ? 'text-white' : ''}`}>{item.icon}</span>
                        <span className="flex-1 truncate">{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Live indicator */}
        <div className="border-t border-slate-200/70 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#7C3AED] animate-pulse" />
            <span className="text-xs text-[var(--sidebar-section-label)]">Google PageSpeed Insights</span>
          </div>
        </div>
      </aside>
    </>
  )
}
