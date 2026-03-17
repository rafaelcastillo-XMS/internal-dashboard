import { lazy, Suspense, useEffect, useState } from "react"
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
import { ThemeProvider } from "@/context/ThemeContext"
import { PageLoader } from "@/components/app/PageLoader"
import { MainLayout } from "./components/layout/MainLayout"
import { supabase } from "@/lib/supabase"
import type { Session } from "@supabase/supabase-js"

const Dashboard = lazy(() => import("./pages/Dashboard").then(module => ({ default: module.Dashboard })))
const AllClients = lazy(() => import("./pages/AllClients").then(module => ({ default: module.AllClients })))
const Clients = lazy(() => import("./pages/Clients").then(module => ({ default: module.Clients })))
const ClientIntegrations = lazy(() => import("./pages/ClientIntegrations").then(module => ({ default: module.ClientIntegrations })))
const Tasks = lazy(() => import("./pages/Tasks").then(module => ({ default: module.Tasks })))
const CalendarPage = lazy(() => import("./pages/Calendar").then(module => ({ default: module.CalendarPage })))
const Profile = lazy(() => import("./pages/Profile").then(module => ({ default: module.Profile })))
const Login = lazy(() => import("./pages/Login").then(module => ({ default: module.Login })))

function AppLayout() {
    return (
        <MainLayout>
            <Outlet />
        </MainLayout>
    )
}

function ProtectedLayout({ session }: { session: Session | null }) {
    if (!session) return <Navigate to="/login" replace />
    return <AppLayout />
}

function App() {
    const [session, setSession] = useState<Session | null | undefined>(undefined)

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session))
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
        return () => subscription.unsubscribe()
    }, [])

    // Wait until we know the session state to avoid flicker
    if (session === undefined) return <PageLoader label="Checking your session..." />

    return (
        <ThemeProvider>
            <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
                        <Route element={<ProtectedLayout session={session} />}>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/clients" element={<AllClients />} />
                            <Route path="/clients/:clientId/integrations" element={<ClientIntegrations />} />
                            <Route path="/clients/:clientId" element={<Clients />} />
                            <Route path="/tasks" element={<Tasks />} />
                            <Route path="/calendar" element={<CalendarPage />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                    </Routes>
                </Suspense>
            </BrowserRouter>
        </ThemeProvider>
    )
}

export default App
