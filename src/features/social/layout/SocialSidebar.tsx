import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { NotepadText, Route, RouteOff } from 'lucide-react'
import { PLATFORMS, type SocialPlatform } from '../hooks/useSocialDashboardState'

// Mock connection status — replace with real API data when integrations are live
const CONNECTED: Record<SocialPlatform, boolean> = {
  instagram: true,
  facebook:  true,
  tiktok:    false,
  youtube:   true,
  linkedin:  false,
}

// Platform SVG icons (inline, no external dep)
function PlatformIcon({ id }: { id: SocialPlatform }) {
  if (id === 'instagram') return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
  if (id === 'youtube') return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
  if (id === 'facebook') return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
  if (id === 'tiktok') return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  )
  if (id === 'linkedin') return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
  return null
}

// Platform nav items (no section header, listed vertically)
const PLATFORM_NAV: { id: SocialPlatform; label: string; href: string; color: string }[] = [
  { id: 'instagram', label: 'Instagram', href: '/social/instagram', color: '#E1306C' },
  { id: 'facebook',  label: 'Facebook',  href: '/social/facebook',  color: '#1877F2' },
  { id: 'tiktok',    label: 'TikTok',    href: '/social/tiktok',    color: '#010101' },
  { id: 'youtube',   label: 'YouTube',   href: '/social/youtube',   color: '#FF0000' },
  { id: 'linkedin',  label: 'LinkedIn',  href: '/social/linkedin',  color: '#0A66C2' },
]

interface SocialSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export function SocialSidebar({ sidebarOpen, setSidebarOpen }: SocialSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const sidebarRef = useRef<HTMLElement>(null)

  // Keep platforms in sync (no-op here, just for future use)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setSidebarOpen(false)
      }
    }
    if (sidebarOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [sidebarOpen, setSidebarOpen])

  const isActive = (href: string) => location.pathname === href

  const navItemBase = `flex items-center gap-3 rounded-lg px-3 py-2.5
    text-sm font-medium transition-all duration-150 border`
  const activeStyle = 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm dark:bg-[#8B5CF6] dark:border-[#8B5CF6]'
  const inactiveStyle = 'text-[var(--sidebar-item-text)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--text-primary)] border-transparent'

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
            <p className="truncate text-sm font-semibold leading-tight text-[var(--text-primary)]">XMS</p>
            <p className="mt-0.5 text-[10px] text-[#8B5CF6]/70 truncate">Social Intelligence</p>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5">
          {/* Overview */}
          <ul className="space-y-0.5">
            <li>
              <Link
                to="/social"
                onClick={() => setSidebarOpen(false)}
                className={`${navItemBase} ${isActive('/social') ? activeStyle : inactiveStyle}`}
              >
                <span className="shrink-0">
                  <NotepadText className="h-5 w-5" />
                </span>
                <span className="flex-1 truncate">Overview</span>
              </Link>
            </li>
          </ul>

          {/* Platform buttons */}
          <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--sidebar-section-label)]">
            Platforms
          </p>
          <ul className="space-y-0.5">
            {PLATFORM_NAV.map((p) => {
              const active = isActive(p.href)
              const connected = CONNECTED[p.id]
              return (
                <li key={p.id}>
                  <Link
                    to={p.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`${navItemBase} ${active ? activeStyle : inactiveStyle}`}
                  >
                    <span
                      className="shrink-0"
                      style={{ color: active ? 'white' : p.color }}
                    >
                      <PlatformIcon id={p.id} />
                    </span>
                    <span className="flex-1 truncate">{p.label}</span>
                    {connected
                      ? <Route className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-white/70' : 'text-emerald-500'}`} />
                      : <RouteOff className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-white/50' : 'text-slate-400 dark:text-slate-600'}`} />
                    }
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ── Reports button — fixed at the bottom ── */}
        <div className="border-t border-slate-200/70 px-4 py-3 dark:border-white/10">
          <Link
            to="/social/reports"
            onClick={() => setSidebarOpen(false)}
            className={`${navItemBase} ${isActive('/social/reports') ? activeStyle : inactiveStyle}`}
          >
            <span className="shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </span>
            <span className="flex-1 truncate">Reports</span>
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-[#8B5CF6]/20 text-[#8B5CF6]">
              Soon
            </span>
          </Link>
        </div>

        {/* ── Live data indicator ── */}
        <div className="border-t border-slate-200/70 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#8B5CF6] animate-pulse" />
            <span className="text-xs text-[var(--sidebar-section-label)]">Social Media APIs</span>
          </div>
        </div>
      </aside>
    </>
  )
}
