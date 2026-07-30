import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, LayoutDashboard, LayoutGrid, CalendarDays, FileText } from 'lucide-react'
import { useSidebar } from '@/context/useSidebar'
import { ClientSelector } from '@/features/shared/components/ClientSelector'

const SOCIAL_CLIENTS = [
  { id: 'xms-ai', name: 'XMS Ai', initials: 'XA', color: 'bg-[#8B5CF6]' },
]

const SECTION_NAV = [
  { label: 'Overview',  href: '/social',           icon: LayoutDashboard },
  { label: 'Platforms', href: '/social/platforms', icon: LayoutGrid },
  { label: 'Calendar',  href: '/social/calendar',  icon: CalendarDays },
  { label: 'Reports',   href: '/social/reports',   icon: FileText },
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

export function SocialSidebar() {
  const { collapsed, isMobileOpen, closeMobile } = useSidebar()
  const location = useLocation()

  const navItemClass = collapsed
    ? "relative group flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all text-sm font-semibold"
    : "relative group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-semibold w-full"

  const isActive = (href: string) => location.pathname === href

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
            <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-section-label)]">Active Account</p>
            <ClientSelector
              clients={SOCIAL_CLIENTS}
              activeName="XMS Ai"
              subtitle="Social Intelligence"
              onSelect={() => {}}
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

          {SECTION_NAV.map((item) => (
            <div key={item.href} className="relative group">
              <Link to={item.href} onClick={closeMobile} className={`${navItemClass} ${isActive(item.href) ? activeClass : inactiveClass}`}>
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
              {collapsed && <Tooltip label={item.label} />}
            </div>
          ))}
        </nav>

        {/* Live indicator (expanded only) */}
        {!collapsed && (
          <div className="border-t border-[var(--sidebar-border)] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#8B5CF6] animate-pulse" />
              <span className="text-xs text-[var(--sidebar-section-label)]">Social Media APIs</span>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
