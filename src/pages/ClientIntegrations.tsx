import { useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Camera, ChevronDown, Database, Save, Upload, CheckCircle2, XCircle, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateClientRecord, deleteClientRecord, type ClientRecord } from "@/features/clients/clientsTable"
import { createClientProfileForm, fetchClientProfile, saveClientProfile, type ClientProfileForm, uploadClientLogo } from "@/features/clients/profiles"
import { useClientRecord } from "@/features/clients/useClientRecord"
import { useTrackPageLoading } from "@/context/PageLoadingContext"
import { SEO_API } from "@/features/seo/hooks/useSEODashboardState"
import { edgeFetch } from "@/lib/edgeFetch"
import { supabase } from "@/lib/supabase"
import notionIcon from "@/assets/notion-icon.svg"
import googleAdsIcon from "@/assets/google-ads-icon.png"
import openaiIcon from "@/assets/openai-icon.svg"

const tabs = ["Integrations", "Data"] as const
type Tab = typeof tabs[number]

interface GoogleStatus {
    connected: boolean
    email: string | null
    requiredEmail: string
    allowed: boolean
}

interface GoogleProperties {
    gscSites: { url: string }[]
    ga4Properties: { id: string; name?: string }[]
}

interface GbpLocationOption {
    accountName: string
    locationName: string
    title: string
    websiteUri: string
}

interface ClientGbpMapping {
    gbp_account_id: string | null
    gbp_location_id: string | null
    gbp_location_name: string | null
}

interface SemAccountOption {
    id: string
    name: string
    status: string
}

interface NotionSyncResponse {
    success?: boolean
    logoUrl?: string | null
    monthlySemBudget?: number | null
    budgetAppliedToAccount?: boolean
    lastSyncedAt?: string
    warnings?: string[]
    error?: string
}

const BUDGET_TYPES = [
    { key: "ads_monthly", label: "Monthly Budget — Google Ads" },
    { key: "guarantee_monthly", label: "Monthly Budget — Google LSA" },
] as const

const selectClass = "h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-12 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"

export function ClientIntegrations() {
    const navigate = useNavigate()
    const { clientId } = useParams<{ clientId: string }>()
    const [searchParams] = useSearchParams()
    const { client, profile, record, loading: profileLoading, setProfile, setRecord } = useClientRecord(clientId)

    const [activeTab, setActiveTab] = useState<Tab>("Integrations")
    const [profileForm, setProfileForm] = useState<ClientProfileForm>(() => createClientProfileForm(client))
    const [syncingNotion, setSyncingNotion] = useState(false)
    const [notionLastSyncedAt, setNotionLastSyncedAt] = useState<string | null>(null)
    const [notionMessage, setNotionMessage] = useState<{ ok: boolean; text: string } | null>(null)
    const [saveError, setSaveError] = useState("")
    const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null)
    const [loadingGoogle, setLoadingGoogle] = useState(true)
    const [gbpStatus, setGbpStatus] = useState<GoogleStatus | null>(null)
    const [gbpLocations, setGbpLocations] = useState<GbpLocationOption[]>([])
    const [loadingGbp, setLoadingGbp] = useState(true)
    const [gbpError, setGbpError] = useState("")
    const [gbpMapping, setGbpMapping] = useState<ClientGbpMapping>({
        gbp_account_id: null,
        gbp_location_id: null,
        gbp_location_name: null,
    })
    const authResult = searchParams.get("auth")
    const [savingProfile, setSavingProfile] = useState(false)
    const [profileMessage, setProfileMessage] = useState<{ ok: boolean; text: string } | null>(null)
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreviewUrl, setLogoPreviewUrl] = useState("")
    const [deleting, setDeleting] = useState(false)

    // Google properties (GSC sites + GA4 properties) available to assign
    const [properties, setProperties] = useState<GoogleProperties>({ gscSites: [], ga4Properties: [] })
    const [loadingProperties, setLoadingProperties] = useState(true)
    const [propertiesError, setPropertiesError] = useState("")

    // SEM accounts available to link
    const [semAccounts, setSemAccounts] = useState<SemAccountOption[]>([])
    const [loadingSemAccounts, setLoadingSemAccounts] = useState(true)

    // Report budgets for the linked Google Ads account
    const [budgets, setBudgets] = useState<Record<string, string>>({})
    const [savingBudgets, setSavingBudgets] = useState(false)
    const [budgetsMessage, setBudgetsMessage] = useState<{ ok: boolean; text: string } | null>(null)

    // OpenAI Ads API token (write-only: the browser can save it but never read it back)
    const [openaiToken, setOpenaiToken] = useState("")
    const [openaiTokenSet, setOpenaiTokenSet] = useState<string | null>(null)
    const [savingToken, setSavingToken] = useState(false)
    const [tokenMessage, setTokenMessage] = useState<{ ok: boolean; text: string } | null>(null)

    useEffect(() => {
        setProfileForm(createClientProfileForm(client, profile))
    }, [client, profile])

    useEffect(() => {
        if (!logoFile) {
            setLogoPreviewUrl("")
            return
        }

        const objectUrl = URL.createObjectURL(logoFile)
        setLogoPreviewUrl(objectUrl)

        return () => {
            URL.revokeObjectURL(objectUrl)
        }
    }, [logoFile])

    useEffect(() => {
        setLoadingGoogle(true)
        fetch("/api/auth/google/status")
            .then(r => r.json())
            .then(d => setGoogleStatus(d as GoogleStatus))
            .catch(() => setGoogleStatus({ connected: false, email: null, requiredEmail: "eva@xperienceusa.com", allowed: false }))
            .finally(() => setLoadingGoogle(false))
    }, [authResult])

    useEffect(() => {
        setLoadingGbp(true)
        fetch("/api/auth/gbp/status")
            .then(r => r.json())
            .then(d => setGbpStatus(d as GoogleStatus))
            .catch(() => setGbpStatus({ connected: false, email: null, requiredEmail: "xperiencemarketingsolutions@gmail.com", allowed: false }))
            .finally(() => setLoadingGbp(false))
    }, [authResult])

    useEffect(() => {
        if (!gbpStatus?.allowed) {
            setGbpLocations([])
            return
        }
        let active = true
        setLoadingGbp(true)
        setGbpError("")
        fetch("/api/seo/gbp/locations")
            .then(async r => {
                const data = await r.json()
                if (!r.ok || data.error) throw new Error(data.error ?? `HTTP ${r.status}`)
                return data
            })
            .then(data => {
                if (active) setGbpLocations(Array.isArray(data.locations) ? data.locations : [])
            })
            .catch((err: Error) => { if (active) setGbpError(err.message) })
            .finally(() => { if (active) setLoadingGbp(false) })
        return () => { active = false }
    }, [gbpStatus?.allowed])

    useEffect(() => {
        if (!client?.id) return
        let active = true
        supabase
            .from("clients")
            .select("gbp_account_id, gbp_location_id, gbp_location_name")
            .eq("id", client.id)
            .maybeSingle()
            .then(({ data, error }) => {
                if (!active) return
                if (error) {
                    setGbpError("GBP mapping is not available until its database migration is applied.")
                    return
                }
                if (data) setGbpMapping(data as ClientGbpMapping)
            })
        return () => { active = false }
    }, [client?.id])

    useEffect(() => {
        if (!client?.id) return
        let active = true
        supabase
            .from("clients")
            .select("notion_last_synced_at")
            .eq("id", client.id)
            .maybeSingle()
            .then(({ data }) => {
                if (active) setNotionLastSyncedAt(data?.notion_last_synced_at ?? null)
            })
        return () => { active = false }
    }, [client?.id])

    useEffect(() => {
        let active = true
        setLoadingProperties(true)
        edgeFetch(`${SEO_API}/properties`)
            .then(r => r.json())
            .then((d: Record<string, unknown>) => {
                if (!active) return
                if (d.error || d.message) throw new Error(String(d.error ?? d.message))
                setProperties({
                    gscSites: Array.isArray(d.gscSites) ? d.gscSites as { url: string }[] : [],
                    ga4Properties: Array.isArray(d.ga4Properties) ? d.ga4Properties as { id: string; name?: string }[] : [],
                })
            })
            .catch((err: Error) => { if (active) setPropertiesError(err.message) })
            .finally(() => { if (active) setLoadingProperties(false) })
        return () => { active = false }
    }, [])

    useEffect(() => {
        let active = true
        setLoadingSemAccounts(true)
        supabase
            .from("sem_accounts")
            .select("id, name, status")
            .order("name")
            .then(({ data }) => {
                if (active) setSemAccounts(((data ?? []) as SemAccountOption[]).filter(a => a.status === "ENABLED"))
            })
            .then(() => { if (active) setLoadingSemAccounts(false) })
        return () => { active = false }
    }, [])

    useEffect(() => {
        const accountId = record?.sem_account_id
        if (!accountId) {
            setBudgets({})
            return
        }
        let active = true
        supabase
            .from("sem_report_budgets")
            .select("report_type, budget")
            .eq("account_id", accountId)
            .then(({ data }) => {
                if (!active) return
                const next: Record<string, string> = {}
                for (const row of data ?? []) next[row.report_type] = String(row.budget ?? "")
                setBudgets(next)
            })
        return () => { active = false }
    }, [record?.sem_account_id])

    // Whether an OpenAI Ads token exists (metadata only — the token itself is never read back)
    useEffect(() => {
        const id = client?.id
        if (!id) { setOpenaiTokenSet(null); return }
        let active = true
        supabase
            .from("client_ad_secrets")
            .select("updated_at")
            .eq("client_id", id)
            .eq("provider", "openai_ads")
            .maybeSingle()
            .then(({ data }) => {
                if (!active) return
                setOpenaiTokenSet(data?.updated_at ? new Date(data.updated_at).toLocaleDateString() : null)
            })
        return () => { active = false }
    }, [client?.id])

    async function saveRecord(patch: Partial<Omit<ClientRecord, "id">>) {
        setSaveError("")
        try {
            const updated = await updateClientRecord(client.id, patch)
            setRecord(updated)
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Unable to save integration settings.")
        }
    }

    async function saveGbpMapping(next: ClientGbpMapping) {
        setGbpError("")
        const { error } = await supabase
            .from("clients")
            .update(next)
            .eq("id", client.id)
        if (error) {
            setGbpError("Unable to save GBP location. Apply the GBP database migration first.")
            return
        }
        setGbpMapping(next)
    }

    async function handleSyncNotion() {
        if (!record || syncingNotion) return
        setSyncingNotion(true)
        setNotionMessage(null)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.access_token) throw new Error("Your dashboard session expired. Sign in again and retry.")

            const response = await fetch(`/api/notion/clients/${encodeURIComponent(client.id)}/sync`, {
                method: "POST",
                headers: { Authorization: `Bearer ${session.access_token}` },
            })
            const result = await response.json() as NotionSyncResponse
            if (!response.ok || result.error) throw new Error(result.error ?? `Notion synchronization failed (HTTP ${response.status}).`)

            const refreshedProfile = await fetchClientProfile(client.id)
            setProfile(refreshedProfile)
            setProfileForm(createClientProfileForm(client, refreshedProfile))
            setLogoFile(null)

            if (result.budgetAppliedToAccount && result.monthlySemBudget != null) {
                setBudgets(current => ({ ...current, ads_monthly: String(result.monthlySemBudget) }))
            }

            setNotionLastSyncedAt(result.lastSyncedAt ?? new Date().toISOString())
            const updated = [result.logoUrl ? "logo" : "", result.budgetAppliedToAccount ? "monthly SEM budget" : ""].filter(Boolean)
            const successText = updated.length > 0
                ? `Notion synchronized: ${updated.join(" and ")} updated in Supabase.`
                : "Notion synchronization completed without replacing existing logo or budget data."
            const warningText = result.warnings?.length ? ` ${result.warnings.join(" ")}` : ""
            setNotionMessage({ ok: true, text: successText + warningText })
        } catch (err) {
            setNotionMessage({ ok: false, text: err instanceof Error ? err.message : "Unable to synchronize with Notion." })
        } finally {
            setSyncingNotion(false)
        }
    }

    async function handleApplyBudgets() {
        const accountId = record?.sem_account_id
        if (!accountId || savingBudgets) return
        setSavingBudgets(true)
        setBudgetsMessage(null)
        try {
            const rows = BUDGET_TYPES.map(t => ({
                account_id: accountId,
                report_type: t.key,
                budget: parseFloat((budgets[t.key] ?? "").replace(/[$,]/g, "")) || 0,
                updated_at: new Date().toISOString(),
            }))
            const { error } = await supabase
                .from("sem_report_budgets")
                .upsert(rows, { onConflict: "account_id,report_type" })
            if (error) throw error
            setBudgetsMessage({ ok: true, text: "Budgets saved. SEM Reports will use these values." })
        } catch (err) {
            setBudgetsMessage({ ok: false, text: err instanceof Error ? err.message : "Unable to save budgets." })
        } finally {
            setSavingBudgets(false)
            setTimeout(() => setBudgetsMessage(null), 4000)
        }
    }

    async function handleSaveOpenAiToken() {
        const id = client?.id
        const token = openaiToken.trim()
        if (!id || !token || savingToken) return
        setSavingToken(true)
        setTokenMessage(null)
        try {
            const { error } = await supabase.rpc("set_client_ad_token", {
                p_client_id: id,
                p_provider: "openai_ads",
                p_token: token,
            })
            if (error) throw error
            setOpenaiToken("")
            setOpenaiTokenSet(new Date().toLocaleDateString())
            setTokenMessage({ ok: true, text: "Token saved (write-only — it cannot be read back here)." })
        } catch (err) {
            setTokenMessage({ ok: false, text: err instanceof Error ? err.message : "Unable to save token." })
        } finally {
            setSavingToken(false)
            setTimeout(() => setTokenMessage(null), 4000)
        }
    }

    async function handleDeleteClient() {
        if (deleting) return
        const confirmed = window.confirm(`Delete ${client.name}? This removes the client and its integration settings (SEO/SEM data and budgets are kept).`)
        if (!confirmed) return
        setDeleting(true)
        try {
            await deleteClientRecord(client.id)
            navigate("/clients")
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Unable to delete client.")
            setDeleting(false)
        }
    }

    function updateProfileField(field: keyof ClientProfileForm, value: string) {
        setProfileForm(current => ({ ...current, [field]: value }))
    }

    async function handleSaveProfile() {
        setSavingProfile(true)
        setProfileMessage(null)

        try {
            let nextForm = profileForm

            if (logoFile) {
                const uploaded = await uploadClientLogo(client.id, logoFile, profile?.logo_storage_path)
                nextForm = {
                    ...nextForm,
                    logoUrl: uploaded.logoUrl,
                    logoStoragePath: uploaded.logoStoragePath,
                }
            }

            const saved = await saveClientProfile(client.id, nextForm)
            setProfile(saved)
            setProfileForm(createClientProfileForm(client, saved))
            setLogoFile(null)
            setProfileMessage({ ok: true, text: "Client data saved to Supabase." })
        } catch (err) {
            setProfileMessage({
                ok: false,
                text: err instanceof Error ? err.message : "Unable to save client data.",
            })
        } finally {
            setSavingProfile(false)
            setTimeout(() => setProfileMessage(null), 3000)
        }
    }

    const hasPersistedLogo = Boolean(profile?.logo_url)
    const logoPreview = logoPreviewUrl || profileForm.logoUrl || (hasPersistedLogo ? client.avatar : "")
    const googleAuthorized = !!googleStatus?.allowed
    const googleWrongAccount = !!googleStatus?.connected && !googleAuthorized
    const gbpAuthorized = !!gbpStatus?.allowed
    const gbpWrongAccount = !!gbpStatus?.connected && !gbpAuthorized
    const linkedSemAccount = semAccounts.find(a => a.id === record?.sem_account_id)
    const semEnabled = record?.sem_enabled !== false
    useTrackPageLoading(loadingGoogle || loadingGbp || profileLoading, `client-integrations:${client.id}`)

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 custom-scrollbar">
            <div className="mx-auto max-w-screen-2xl p-6 space-y-6">
                <div className="rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.14),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.97),_rgba(241,245,249,0.92))] p-6 shadow-sm dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_30%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.92))]">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(`/clients/${client.id}`)}
                            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-600 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:text-white"
                            aria-label={`Back to ${client.name}`}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                {logoPreview ? (
                                    <img src={logoPreview} alt={`${client.name} logo`} className="h-full w-full object-cover" />
                                ) : (
                                    <div className={`flex h-full w-full items-center justify-center ${client.color} text-lg font-bold text-white`}>
                                        {client.initials}
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
                                    Client Integrations
                                </p>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-[#E2E5E9]">{client.name}</h1>
                            </div>
                        </div>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                    <div role="tablist" className="flex gap-1 border-b border-slate-100 px-6 dark:border-slate-800">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                role="tab"
                                aria-selected={activeTab === tab}
                                onClick={() => setActiveTab(tab)}
                                className={`relative px-4 py-4 text-sm font-semibold transition ${activeTab === tab
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                                    }`}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <motion.span
                                        layoutId="client-integrations-tab"
                                        className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-blue-600"
                                    />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">
                        {activeTab === "Integrations" && (
                            <div className="space-y-4">
                            {/* Auth result banner */}
                            {authResult === "success" && (
                                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-3 rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    Google account connected successfully. SEO &amp; SEM data is now available.
                                </motion.div>
                            )}
                            {authResult === "wrong-account" && (
                                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
                                    <XCircle className="w-4 h-4 shrink-0" />
                                    Wrong Google account. Please authorize with {googleStatus?.requiredEmail || "eva@xperienceusa.com"}.
                                </motion.div>
                            )}
                            {authResult === "error" && (
                                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                                    <XCircle className="w-4 h-4 shrink-0" />
                                    Connection failed. Make sure you authorize the correct Google account and try again.
                                </motion.div>
                            )}
                            {!profileLoading && !record && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                                    This client does not exist in the clients table yet, so integration settings cannot be saved.
                                </div>
                            )}
                            {saveError && (
                                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                                    {saveError}
                                </div>
                            )}
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                {/* ── Notion client sync card ── */}
                                <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-white">
                                                <img
                                                    src={notionIcon}
                                                    alt="Notion logo"
                                                    className="h-10 w-10 object-contain"
                                                />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-900 dark:text-[#E2E5E9]">Notion</h3>
                                                <p className={`mt-1 text-xs font-bold uppercase tracking-[0.18em] ${notionLastSyncedAt
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-slate-400"}`}>
                                                    {syncingNotion ? "Synchronizing..." : notionLastSyncedAt ? "Synchronized" : "Ready"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${syncingNotion
                                            ? "animate-pulse bg-blue-500"
                                            : notionLastSyncedAt ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                                    </div>

                                    <p className="mt-5 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                        Import this client&apos;s logo and Google Ads monthly budget into Supabase.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleSyncNotion}
                                        disabled={!record || syncingNotion}
                                        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${syncingNotion ? "animate-spin" : ""}`} />
                                        {syncingNotion ? "Sincronizando..." : "Sincronizar con Notion"}
                                    </button>
                                    {notionLastSyncedAt && (
                                        <p className="mt-3 text-xs text-slate-400">
                                            Last sync: {new Date(notionLastSyncedAt).toLocaleString()}
                                        </p>
                                    )}
                                    {notionMessage && (
                                        <p className={`mt-3 text-sm ${notionMessage.ok
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-red-600 dark:text-red-400"}`}>
                                            {notionMessage.text}
                                        </p>
                                    )}
                                </div>

                                {/* ── Google APIs card ── */}
                                <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                                <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-900 dark:text-[#E2E5E9]">Google APIs</h3>
                                                <p className={`mt-1 text-xs font-bold uppercase tracking-[0.18em] ${
                                                    loadingGoogle ? "text-slate-400" :
                                                    googleAuthorized ? "text-emerald-600 dark:text-emerald-400" :
                                                    googleWrongAccount ? "text-amber-600 dark:text-amber-400" : "text-slate-400"
                                                }`}>
                                                    {loadingGoogle ? "Checking..." : googleAuthorized ? "Connected" : googleWrongAccount ? "Wrong account" : "Not connected"}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Status dot */}
                                        <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
                                            loadingGoogle ? "bg-slate-300 dark:bg-slate-700" :
                                            googleAuthorized ? "bg-emerald-500 animate-pulse" :
                                            googleWrongAccount ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"
                                        }`} />
                                    </div>

                                    {/* Connected email */}
                                    {googleStatus?.email && (
                                        <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                                            <span className="text-xs text-slate-400">Authorized as</span>
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{googleStatus.email}</span>
                                        </div>
                                    )}
                                    {googleWrongAccount && (
                                        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                                            SEO and SEM are locked to {googleStatus?.requiredEmail || "eva@xperienceusa.com"}.
                                        </p>
                                    )}

                                    {/* APIs covered */}
                                    <div className="mt-4 space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Covers</label>
                                        <div className="space-y-1.5">
                                            {[
                                                { label: "Search Console", color: "bg-blue-500" },
                                                { label: "Google Analytics 4", color: "bg-orange-500" },
                                            ].map(api => (
                                                <div key={api.label} className="flex items-center gap-2.5">
                                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${googleAuthorized ? api.color : "bg-slate-300 dark:bg-slate-600"}`} />
                                                    <span className="text-sm text-slate-600 dark:text-slate-400">{api.label}</span>
                                                    {googleAuthorized && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Connect button */}
                                    <div className="mt-5">
                                        <button
                                            disabled={loadingGoogle}
                                            onClick={() => {
                                                window.location.href = `/api/auth/google/start?return=${encodeURIComponent(window.location.pathname)}`
                                            }}
                                            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${loadingGoogle ? "animate-spin" : ""}`} />
                                            {googleAuthorized
                                                ? "Reconnect Google Account"
                                                : googleWrongAccount
                                                    ? `Reconnect as ${googleStatus?.requiredEmail || "eva@xperienceusa.com"}`
                                                    : "Connect Google Account"}
                                        </button>
                                    </div>
                                </div>

                                {/* ── SEO Properties card (GSC + GA4) ── */}
                                <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                            <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="#1A72D9" strokeWidth={1.8}>
                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                      d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900 dark:text-[#E2E5E9]">SEO Properties</h3>
                                            <p className={`mt-1 text-xs font-bold uppercase tracking-[0.18em] ${
                                                record?.gsc_property && record?.ga4_property_id
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-slate-400"
                                            }`}>
                                                {record?.gsc_property && record?.ga4_property_id ? "Configured" : "Not configured"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-5 space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Search Console Property</label>
                                        <div className="relative">
                                            <select
                                                value={record?.gsc_property ?? ""}
                                                disabled={!record}
                                                onChange={e => void saveRecord({ gsc_property: e.target.value || null })}
                                                className={selectClass}
                                            >
                                                <option value="">{loadingProperties ? "Loading properties..." : "Select GSC property"}</option>
                                                {record?.gsc_property && !properties.gscSites.some(s => s.url === record.gsc_property) && (
                                                    <option value={record.gsc_property}>{record.gsc_property}</option>
                                                )}
                                                {properties.gscSites.map(site => (
                                                    <option key={site.url} value={site.url}>{site.url}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">GA4 Property</label>
                                        <div className="relative">
                                            <select
                                                value={record?.ga4_property_id ?? ""}
                                                disabled={!record}
                                                onChange={e => void saveRecord({ ga4_property_id: e.target.value || null })}
                                                className={selectClass}
                                            >
                                                <option value="">{loadingProperties ? "Loading properties..." : "Select GA4 property"}</option>
                                                {record?.ga4_property_id && !properties.ga4Properties.some(p => p.id === record.ga4_property_id) && (
                                                    <option value={record.ga4_property_id}>{record.ga4_property_id}</option>
                                                )}
                                                {properties.ga4Properties.map(prop => (
                                                    <option key={prop.id} value={prop.id}>{prop.name ? `${prop.name} (${prop.id})` : prop.id}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        </div>
                                    </div>

                                    {propertiesError && (
                                        <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">{propertiesError}</p>
                                    )}
                                    <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                                        The SEO module always uses this fixed GSC + GA4 pair for this client.
                                    </p>
                                </div>

                                {/* ── Google Business Profile card ── */}
                                <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                                <svg className="h-8 w-8 text-[#4285F4]" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-900 dark:text-[#E2E5E9]">Google Business Profile</h3>
                                                <p className={`mt-1 text-xs font-bold uppercase tracking-[0.18em] ${
                                                    loadingGbp ? "text-slate-400" :
                                                    gbpMapping.gbp_location_id ? "text-emerald-600 dark:text-emerald-400" :
                                                    gbpWrongAccount ? "text-amber-600 dark:text-amber-400" : "text-slate-400"
                                                }`}>
                                                    {loadingGbp ? "Checking..." : gbpMapping.gbp_location_id ? "Location assigned" : gbpWrongAccount ? "Wrong account" : "Not configured"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`mt-1 h-2.5 w-2.5 rounded-full ${gbpAuthorized ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                                    </div>

                                    {gbpStatus?.email && (
                                        <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                                            <span className="text-xs text-slate-400">Authorized as</span>
                                            <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{gbpStatus.email}</span>
                                        </div>
                                    )}

                                    {gbpAuthorized ? (
                                        <div className="mt-5 space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Business Profile location</label>
                                            <div className="relative">
                                                <select
                                                    value={gbpMapping.gbp_location_id ?? ""}
                                                    disabled={!record || loadingGbp}
                                                    onChange={event => {
                                                        const location = gbpLocations.find(item => item.locationName === event.target.value)
                                                        void saveGbpMapping({
                                                            gbp_account_id: location?.accountName ?? null,
                                                            gbp_location_id: location?.locationName ?? null,
                                                            gbp_location_name: location?.title ?? null,
                                                        })
                                                    }}
                                                    className={selectClass}
                                                >
                                                    <option value="">{loadingGbp ? "Loading GBP locations..." : "Select GBP location"}</option>
                                                    {gbpMapping.gbp_location_id && !gbpLocations.some(location => location.locationName === gbpMapping.gbp_location_id) && (
                                                        <option value={gbpMapping.gbp_location_id}>{gbpMapping.gbp_location_name || gbpMapping.gbp_location_id}</option>
                                                    )}
                                                    {gbpLocations.map(location => (
                                                        <option key={`${location.accountName}:${location.locationName}`} value={location.locationName}>
                                                            {location.title}{location.websiteUri ? ` — ${location.websiteUri}` : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                SEO Reports uses this exact GBP location for the selected client.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="mt-5">
                                            {gbpWrongAccount && (
                                                <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                                                    Connect as {gbpStatus?.requiredEmail || "the Google account that manages the profiles"}.
                                                </p>
                                            )}
                                            <button
                                                disabled={loadingGbp}
                                                onClick={() => {
                                                    window.location.href = `/api/auth/gbp/start?return=${encodeURIComponent(window.location.pathname)}`
                                                }}
                                                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            >
                                                <RefreshCw className={`h-4 w-4 ${loadingGbp ? "animate-spin" : ""}`} />
                                                Connect Google Business Profile
                                            </button>
                                        </div>
                                    )}

                                    {gbpError && <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">{gbpError}</p>}
                                </div>

                                {/* ── Google Ads card (account link + report budgets) ── */}
                                <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                                <img src={googleAdsIcon} alt="Google Ads logo" className="h-10 w-10 object-contain" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-900 dark:text-[#E2E5E9]">Google Ads</h3>
                                                <p className={`mt-1 text-xs font-bold uppercase tracking-[0.18em] ${
                                                    semEnabled ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                                                }`}>
                                                    {semEnabled ? (linkedSemAccount ? "Enabled · linked" : "Enabled") : "Disabled"}
                                                </p>
                                            </div>
                                        </div>

                                        <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Enable</span>
                                            <span className={`relative h-7 w-12 rounded-full transition ${semEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"}`}>
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={semEnabled}
                                                    disabled={!record}
                                                    onChange={e => void saveRecord({ sem_enabled: e.target.checked })}
                                                />
                                                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${semEnabled ? "left-6" : "left-1"}`} />
                                            </span>
                                        </label>
                                    </div>

                                    <div className="mt-5 space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Google Ads Account</label>
                                        <div className="relative">
                                            <select
                                                value={record?.sem_account_id ?? ""}
                                                disabled={!record || loadingSemAccounts || !semEnabled}
                                                onChange={e => void saveRecord({ sem_account_id: e.target.value || null })}
                                                className={selectClass}
                                            >
                                                <option value="">{loadingSemAccounts ? "Loading accounts..." : "Select Google Ads account"}</option>
                                                {semAccounts.map(account => (
                                                    <option key={account.id} value={account.id}>{account.name}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-3">
                                        {BUDGET_TYPES.map(type => (
                                            <div key={type.key} className="space-y-1.5">
                                                <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{type.label}</label>
                                                <div className="relative">
                                                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">$</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        disabled={!record?.sem_account_id || !semEnabled}
                                                        value={budgets[type.key] ?? ""}
                                                        onChange={e => setBudgets(current => ({ ...current, [type.key]: e.target.value }))}
                                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-8 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-4">
                                        <button
                                            disabled={!record?.sem_account_id || savingBudgets || !semEnabled}
                                            onClick={() => void handleApplyBudgets()}
                                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4285F4] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3367d6] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {savingBudgets ? "Saving…" : "Apply Budgets"}
                                        </button>
                                        {budgetsMessage ? (
                                            <p className={`mt-2 text-center text-xs ${budgetsMessage.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                                                {budgetsMessage.text}
                                            </p>
                                        ) : (
                                            <p className="mt-2 text-center text-xs text-slate-400">
                                                {record?.sem_account_id ? "Used by the Weekly and Monthly reports in SEM." : "Link a Google Ads account to set budgets."}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* ── OpenAI Ads card (per-client API token, write-only) ── */}
                                <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                            <img src={openaiIcon} alt="OpenAI logo" className="h-9 w-9 object-contain dark:invert" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900 dark:text-[#E2E5E9]">OpenAI Ads</h3>
                                            <p className={`mt-1 text-xs font-bold uppercase tracking-[0.18em] ${
                                                openaiTokenSet ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                                            }`}>
                                                {openaiTokenSet ? "Configured" : "Not configured"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-5 space-y-3">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">API Token</label>
                                            <p className="text-[11px] text-slate-400">
                                                {openaiTokenSet ? `Last updated ${openaiTokenSet}` : "No token saved yet."}
                                            </p>
                                        </div>
                                        <input
                                            type="password"
                                            autoComplete="off"
                                            placeholder={openaiTokenSet ? "•••••••• — enter a new token to replace" : "Paste OpenAI Ads token"}
                                            value={openaiToken}
                                            onChange={e => setOpenaiToken(e.target.value)}
                                            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        />
                                        <button
                                            disabled={!openaiToken.trim() || savingToken}
                                            onClick={() => void handleSaveOpenAiToken()}
                                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                                        >
                                            {savingToken ? "Saving…" : openaiTokenSet ? "Replace Token" : "Save Token"}
                                        </button>
                                        {tokenMessage ? (
                                            <p className={`text-center text-xs ${tokenMessage.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                                                {tokenMessage.text}
                                            </p>
                                        ) : (
                                            <p className="text-center text-[11px] text-slate-400">
                                                Write-only — the token can't be read back here. OpenAI Ads has no reporting API yet; saved for future use.
                                            </p>
                                        )}
                                    </div>
                                </div>

                            </div>
                            </div>
                        )}

                        {activeTab === "Data" && (
                            <div className="max-w-3xl space-y-6">
                                <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                                    <div className="h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                        {logoPreview ? (
                                            <img src={logoPreview} alt={`${client.name} logo preview`} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className={`flex h-full w-full items-center justify-center ${client.color} text-2xl font-bold text-white`}>
                                                {client.initials}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-[#E2E5E9]">Client Logo</p>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Upload a logo file and save it to Supabase Storage.</p>
                                    </div>
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                                        <Camera className="h-5 w-5" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Logo File</label>
                                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-slate-900 dark:text-[#E2E5E9]">
                                                {logoFile ? logoFile.name : profile?.logo_storage_path ? "Current logo stored in Supabase Storage" : "No file selected yet"}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                PNG, JPG, SVG or WEBP work well for client logos.
                                            </p>
                                        </div>
                                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
                                            <Upload className="h-4 w-4" />
                                            {logoFile ? "Replace file" : "Choose file"}
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                                className="sr-only"
                                                onChange={event => {
                                                    const file = event.target.files?.[0] ?? null
                                                    setLogoFile(file)
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <Field label="POC - Owner Name" value={profileForm.pocOwnerName} onChange={value => updateProfileField("pocOwnerName", value)} />
                                    <Field label="Level of Service" value={profileForm.levelOfService} onChange={value => updateProfileField("levelOfService", value)} />
                                    <Field label="Industry" value={profileForm.industry} onChange={value => updateProfileField("industry", value)} />
                                    <Field label="Location" value={profileForm.location} onChange={value => updateProfileField("location", value)} />
                                    <Field label="Phone" value={profileForm.phone} onChange={value => updateProfileField("phone", value)} />
                                    <Field label="Email" value={profileForm.email} onChange={value => updateProfileField("email", value)} />
                                </div>

                                <Field label="Website" value={profileForm.website} onChange={value => updateProfileField("website", value)} />

                                <div className="flex items-center gap-3 pt-2">
                                    <Button onClick={handleSaveProfile} disabled={savingProfile || profileLoading} className="bg-blue-600 text-white hover:bg-blue-700">
                                        <Save className="h-4 w-4" />
                                        {savingProfile ? "Saving..." : "Save Changes"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setProfileForm(createClientProfileForm(client, profile))}
                                        className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                                    >
                                        Reset
                                    </Button>
                                    <div className="ml-auto flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                        <Database className="h-4 w-4" />
                                        Stored in Supabase
                                    </div>
                                </div>

                                {profileMessage && (
                                    <p className={`text-sm ${profileMessage.ok ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                                        {profileMessage.text}
                                    </p>
                                )}

                                <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/20">
                                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</p>
                                    <p className="mt-1 text-sm text-red-600/80 dark:text-red-400/80">
                                        Deleting removes this client from the dashboard. SEO/SEM data and report budgets are not deleted.
                                    </p>
                                    <Button
                                        variant="outline"
                                        onClick={() => void handleDeleteClient()}
                                        disabled={deleting || !record}
                                        className="mt-3 border-red-300 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:bg-transparent dark:text-red-400"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        {deleting ? "Deleting..." : "Delete Client"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</label>
            <Input value={value} onChange={e => onChange(e.target.value)} />
        </div>
    )
}
