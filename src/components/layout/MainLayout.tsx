import { SidebarProvider } from "@/context/SidebarContext"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"

export function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <div className="flex h-screen w-full bg-[var(--bg-app)] overflow-hidden font-sans">
                <Sidebar />
                <div className="flex flex-col flex-1 h-full min-w-0 relative">
                    <Header />
                    <main className="flex-1 overflow-hidden relative">
                        {children}
                    </main>
                </div>
            </div>
        </SidebarProvider>
    )
}
