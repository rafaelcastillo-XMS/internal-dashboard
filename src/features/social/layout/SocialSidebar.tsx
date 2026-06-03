import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Route, RouteOff } from 'lucide-react'
import { useSidebar } from '@/context/useSidebar'
import { ClientSelector } from '@/features/shared/components/ClientSelector'
import { XMSLogo } from '@/components/ui/XMSLogo'
import { PLATFORMS, type SocialPlatform } from '../hooks/useSocialDashboardState'

const CONNECTED: Record<SocialPlatform, boolean> = {
  instagram: true,
  facebook:  true,
  tiktok:    false,
  youtube:   true,
  linkedin:  false,
}

function PlatformIcon({ id }: { id: SocialPlatform }) {
  if (id === 'instagram') return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
  if (id === 'youtube') return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
  if (id === 'facebook') return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
  if (id === 'tiktok') return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  )
  if (id === 'linkedin') return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
  return null
}

const PLATFORM_NAV: { id: SocialPlatform; label: string; href: string; color: string }[] = [
  { id: 'instagram', label: 'Instagram', href: '/social/instagram', color: '#E1306C' },
  { id: 'facebook',  label: 'Facebook',  href: '/social/facebook',  color: '#1877F2' },
  { id: 'tiktok',    label: 'TikTok',    href: '/social/tiktok',    color: '#010101' },
  { id: 'youtube',   label: 'YouTube',   href: '/social/youtube',   color: '#FF0000' },
  { id: 'linkedin',  label: 'LinkedIn',  href: '/social/linkedin',  color: '#0A66C2' },
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
              activeName="Holts"
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

          {/* Overview */}
          {!collapsed ? (
            <div className="flex items-center gap-2 px-3 pt-4 pb-1.5">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sidebar-section-label)]">Overview</h2>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
          ) : <div className="mx-3 my-2 h-px bg-[var(--border)]" />}

          <div className="relative group">
            <Link to="/social" onClick={closeMobile} className={`${navItemClass} ${isActive('/social') ? activeClass : inactiveClass}`}>
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              {!collapsed && 'Overview'}
            </Link>
            {collapsed && <Tooltip label="Overview" />}
          </div>

          {/* Platforms */}
          {!collapsed ? (
            <div className="flex items-center gap-2 px-3 pt-4 pb-1.5">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sidebar-section-label)]">Platforms</h2>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
          ) : <div className="mx-3 my-2 h-px bg-[var(--border)]" />}

          <ul className="space-y-0.5">
            {PLATFORM_NAV.map((p) => {
              const active = isActive(p.href)
              const connected = CONNECTED[p.id]
              return (
                <li key={p.id}>
                  <div className="relative group">
                    <Link
                      to={p.href}
                      onClick={closeMobile}
                      className={`${navItemClass} ${active ? activeClass : inactiveClass}`}
                    >
                      <span style={{ color: active ? 'white' : p.color }}>
                        <PlatformIcon id={p.id} />
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{p.label}</span>
                          {connected
                            ? <Route className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-white/70' : 'text-emerald-500'}`} />
                            : <RouteOff className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-white/50' : 'text-slate-400 dark:text-slate-600'}`} />
                          }
                        </>
                      )}
                    </Link>
                    {collapsed && <Tooltip label={p.label} />}
                  </div>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Bottom: Reports */}
        <div className={`${collapsed ? 'px-0 py-3' : 'px-3 pb-4 pt-3'} border-t border-[var(--sidebar-border)] space-y-0.5`}>
          <div className="relative group">
            <div className={`${navItemClass} opacity-50 cursor-not-allowed`}>
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              {!collapsed && (
                <span className="flex items-center gap-2 flex-1">
                  Reports
                  <span className="text-[10px] font-semibold bg-yellow-400/20 text-yellow-500 px-1.5 py-0.5 rounded-full leading-none">Soon</span>
                </span>
              )}
            </div>
            {collapsed && <Tooltip label="Reports (Soon)" />}
          </div>
        </div>

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
