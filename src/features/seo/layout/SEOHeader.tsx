import { useState, useEffect } from 'react'

interface SEOHeaderProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export function SEOHeader({ sidebarOpen, setSidebarOpen }: SEOHeaderProps) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('color-theme')
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
      setIsDark(true)
    }
  }, [])

  function toggleDark() {
    if (isDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('color-theme', 'light')
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('color-theme', 'dark')
    }
    setIsDark((v) => !v)
  }

  return (
    <header className="sticky top-0 z-40 flex w-full border-b border-stroke
                       bg-white dark:border-strokedark dark:bg-boxdark">
      <div className="flex w-full items-center justify-between px-4 py-4 md:px-6">

        {/* Left: hamburger (mobile) */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center rounded-lg p-1.5
                     text-body hover:bg-gray dark:text-bodydark dark:hover:bg-meta-4
                     lg:hidden"
          aria-label="Toggle sidebar"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d={sidebarOpen
                    ? 'M6 18L18 6M6 6l12 12'
                    : 'M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5'} />
          </svg>
        </button>

        {/* Center: title */}
        <p className="hidden font-semibold text-black dark:text-white lg:block">
          SEO Intelligence Dashboard
        </p>

        {/* Right: live badge + dark mode */}
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-stroke
                           px-3 py-1 text-xs text-body dark:border-strokedark
                           dark:text-bodydark sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Data
          </span>

          <button
            onClick={toggleDark}
            className="flex h-9 w-9 items-center justify-center rounded-lg
                       border border-stroke text-body transition-colors
                       hover:border-[#1A72D9] hover:text-[#1A72D9]
                       dark:border-strokedark dark:text-bodydark"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
