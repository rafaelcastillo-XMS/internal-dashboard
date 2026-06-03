import { Outlet } from 'react-router-dom'
import { SocialSidebar } from './SocialSidebar'
import { Header } from '@/components/layout/Header'
import { SidebarProvider } from '@/context/SidebarContext'

export function SocialLayout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full app-bg overflow-hidden font-sans">
        <SocialSidebar />
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
