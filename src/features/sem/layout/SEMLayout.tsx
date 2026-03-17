import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { SEMSidebar } from './SEMSidebar'
import { Header } from '@/components/layout/Header'

export function SEMLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-900">
      <SEMSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
