import { Outlet } from 'react-router-dom'
import { DesignSidebar } from './DesignSidebar'
import { Header } from '@/components/layout/Header'
import { SidebarProvider } from '@/context/SidebarContext'

export function DesignLayout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full app-bg overflow-hidden font-sans">
        <DesignSidebar />
        <div className="flex flex-col flex-1 h-full min-w-0 relative">
          <Header />
          <main className="flex-1 overflow-y-auto relative">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
