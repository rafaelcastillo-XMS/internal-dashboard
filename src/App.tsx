import { lazy, Suspense, useEffect, useState } from "react"
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
import { ThemeProvider } from "@/context/ThemeContext"
import { PageLoader } from "@/components/app/PageLoader"
import { TopLoadingBar } from "@/components/app/TopLoadingBar"
import { MainLayout } from "./components/layout/MainLayout"
import { supabase } from "@/lib/supabase"
import type { Session } from "@supabase/supabase-js"
import { PageLoadingProvider } from "@/context/PageLoadingContext"

const Dashboard = lazy(() => import("./pages/Dashboard").then(module => ({ default: module.Dashboard })))
const AllClients = lazy(() => import("./pages/AllClients").then(module => ({ default: module.AllClients })))
const Clients = lazy(() => import("./pages/Clients").then(module => ({ default: module.Clients })))
const ClientIntegrations = lazy(() => import("./pages/ClientIntegrations").then(module => ({ default: module.ClientIntegrations })))
const Tasks = lazy(() => import("./pages/Tasks").then(module => ({ default: module.Tasks })))
const CalendarPage = lazy(() => import("./pages/Calendar").then(module => ({ default: module.CalendarPage })))
const Profile = lazy(() => import("./pages/Profile").then(module => ({ default: module.Profile })))
const Settings = lazy(() => import("./pages/Settings").then(module => ({ default: module.Settings })))
const Login = lazy(() => import("./pages/Login").then(module => ({ default: module.Login })))

// SEO Intelligence
const SEOLayout = lazy(() => import("./features/seo/layout/SEOLayout").then(module => ({ default: module.SEOLayout })))
const SEODashboard = lazy(() => import("./pages/seo/SEODashboard").then(module => ({ default: module.SEODashboard })))
const SEOVisibility = lazy(() => import("./pages/seo/SEOVisibility").then(module => ({ default: module.SEOVisibility })))
const SEOKeywords = lazy(() => import("./pages/seo/SEOKeywords").then(module => ({ default: module.SEOKeywords })))
const SEOEngagement = lazy(() => import("./pages/seo/SEOEngagement").then(module => ({ default: module.SEOEngagement })))
const SEOTraffic = lazy(() => import("./pages/seo/SEOTraffic").then(module => ({ default: module.SEOTraffic })))
const SEOCoreWebVitals = lazy(() => import("./pages/seo/SEOCoreWebVitals").then(module => ({ default: module.SEOCoreWebVitals })))
const SEOMobile = lazy(() => import("./pages/seo/SEOMobile").then(module => ({ default: module.SEOMobile })))

// SEM Intelligence
const SEMLayout = lazy(() => import("./features/sem/layout/SEMLayout").then(module => ({ default: module.SEMLayout })))
const SEMDashboard = lazy(() => import("./pages/sem/SEMDashboard").then(module => ({ default: module.SEMDashboard })))
const SEMCampaigns = lazy(() => import("./pages/sem/SEMCampaigns").then(module => ({ default: module.SEMCampaigns })))
const SEMKeywords = lazy(() => import("./pages/sem/SEMKeywords").then(module => ({ default: module.SEMKeywords })))

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

function SEOProtectedLayout({ session }: { session: Session | null }) {
    if (!session) return <Navigate to="/login" replace />
    return <SEOLayout />
}

function SEMProtectedLayout({ session }: { session: Session | null }) {
    if (!session) return <Navigate to="/login" replace />
    return <SEMLayout />
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
            <PageLoadingProvider>
                <BrowserRouter>
                    <TopLoadingBar />
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
                                <Route path="/settings" element={<Settings />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Route>
                            <Route element={<SEOProtectedLayout session={session} />}>
                                <Route path="/seo" element={<SEODashboard />} />
                                <Route path="/seo/visibility" element={<SEOVisibility />} />
                                <Route path="/seo/keywords" element={<SEOKeywords />} />
                                <Route path="/seo/engagement" element={<SEOEngagement />} />
                                <Route path="/seo/traffic" element={<SEOTraffic />} />
                                <Route path="/seo/cwv" element={<SEOCoreWebVitals />} />
                                <Route path="/seo/mobile" element={<SEOMobile />} />
                            </Route>
                            <Route element={<SEMProtectedLayout session={session} />}>
                                <Route path="/sem" element={<SEMDashboard />} />
                                <Route path="/sem/campaigns" element={<SEMCampaigns />} />
                                <Route path="/sem/keywords" element={<SEMKeywords />} />
                            </Route>
                        </Routes>
                    </Suspense>
                </BrowserRouter>
            </PageLoadingProvider>
        </ThemeProvider>
    )
}

export default App
