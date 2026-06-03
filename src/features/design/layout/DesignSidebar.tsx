import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { NotepadText, ArrowLeft } from 'lucide-react'
import { useSidebar } from '@/context/useSidebar'
import { XMSLogo } from '@/components/ui/XMSLogo'
import { ClientSelector } from '@/features/shared/components/ClientSelector'

const SELECTED_KEY = 'xms_design_selected'

const NAV_GROUPS = [
  {
    section: null,
    items: [
      {
        label: 'Overview',
        href: '/design',
        icon: <NotepadText className="w-4 h-4" />,
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
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        ),
      },
      {
        label: 'Mobile Usability',
        href: '/design/mobile',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 15.75h3" />
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

const activeClass = "bg-[#7C3AED] text-white border border-transparent shadow-sm"
const inactiveClass = "text-[var(--sidebar-item-text)] hover:bg-[var(--sidebar-item-hover)] border border-transparent"

export function DesignSidebar() {
  const { collapsed, isMobileOpen, closeMobile } = useSidebar()
  const location = useLocation()
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

  const navItemClass = collapsed
    ? "relative group flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all text-sm font-semibold"
    : "relative group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-semibold w-full"

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

        {/* Client selector (expanded only) */}
        {!collapsed && (
          <div className="border-b border-[var(--sidebar-border)] px-3 py-3">
            <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-section-label)]">Active Client</p>
            <ClientSelector
              activeName={activeClient || 'Holts'}
              subtitle="Design Intelligence"
              onSelect={(name) => setActiveClient(name)}
            />
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
                          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
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

        {/* Live indicator (expanded only) */}
        {!collapsed && (
          <div className="border-t border-[var(--sidebar-border)] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#7C3AED] animate-pulse" />
              <span className="text-xs text-[var(--sidebar-section-label)]">Google PageSpeed Insights</span>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
