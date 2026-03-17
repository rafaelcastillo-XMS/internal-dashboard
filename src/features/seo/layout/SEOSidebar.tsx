import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

function formatSiteName(url: string): string {
  return url
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\/(?:www\.)?/, '')
    .replace(/\/$/, '')
}

const SELECTED_KEY = 'xms_selected'

const NAV_GROUPS = [
  {
    section: null,
    items: [
      {
        label: 'Executive Summary',
        href: '/seo',
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'SEARCH VISIBILITY',
    items: [
      {
        label: 'GSC Visibility',
        href: '/seo/visibility',
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        label: 'Keyword Intelligence',
        href: '/seo/keywords',
        badge: { text: 'GSC', color: 'bg-[#1A72D9]/20 text-[#1A72D9]' },
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'ENGAGEMENT',
    items: [
      {
        label: 'GA4 Engagement',
        href: '/seo/engagement',
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        ),
      },
      {
        label: 'Traffic Quality',
        href: '/seo/traffic',
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'TECHNICAL',
    items: [
      {
        label: 'Core Web Vitals',
        href: '/seo/cwv',
        badge: { text: 'PSI', color: 'bg-[#F47C20]/20 text-[#F47C20]' },
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        ),
      },
      {
        label: 'Mobile Usability',
        href: '/seo/mobile',
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3" />
          </svg>
        ),
      },
    ],
  },
]

interface SEOSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export function SEOSidebar({ sidebarOpen, setSidebarOpen }: SEOSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const sidebarRef = useRef<HTMLElement>(null)

  const [activeSite, setActiveSite] = useState<string>(() => {
    try {
      const sel = JSON.parse(sessionStorage.getItem(SELECTED_KEY) || 'null')
      return sel?.gsc || ''
    } catch { return '' }
  })

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ gsc: string }>).detail
      if (detail?.gsc) setActiveSite(detail.gsc)
    }
    window.addEventListener('seo:site-changed', handler)
    return () => window.removeEventListener('seo:site-changed', handler)
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
        className={`fixed left-0 top-0 z-50 flex h-screen w-[288px] flex-col
                    bg-[#07111f] transition-transform duration-300 ease-in-out
                    lg:translate-x-0 lg:static lg:z-auto
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* ── Back to Dashboard ── */}
        <div className="border-b border-white/5 px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5
                       text-sm font-medium text-white/60 transition-all duration-150
                       hover:bg-white/5 hover:text-white"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span>Back to Dashboard</span>
          </button>
        </div>

        {/* ── Active site badge ── */}
        <div className="border-b border-white/5 px-4 py-4">
          <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25">
            Active Account
          </p>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-white leading-tight">
              {activeSite ? formatSiteName(activeSite) : 'XMS'}
            </p>
            {activeSite && (
              <p className="mt-0.5 text-[10px] text-[#1A72D9]/70 truncate">
                SEO Intelligence
              </p>
            )}
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-4 py-5">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-6' : ''}>
              {group.section && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase
                               tracking-[0.15em] text-white/25">
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
                                      ? 'bg-[#1A72D9]/15 text-[#1A72D9] border border-[#1A72D9]/20'
                                      : 'text-white/45 hover:bg-white/5 hover:text-white/80'
                                    }`}
                      >
                        <span className={`shrink-0 ${active ? 'text-[#1A72D9]' : ''}`}>
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

        {/* ── Live data indicator ── */}
        <div className="border-t border-white/5 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/25">GSC + GA4 + PSI</span>
          </div>
        </div>
      </aside>
    </>
  )
}
