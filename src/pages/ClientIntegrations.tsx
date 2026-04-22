import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Camera, ChevronDown, Database, Save, Upload, CheckCircle2, XCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getClientIntegrationConfig, saveClientIntegrationConfig, type ClientIntegrationConfig } from "@/features/clients/integrations"
import { fetchNotebooklmNotebooks, type NotebookSummary } from "@/features/clients/notebooklm"
import { createClientProfileForm, saveClientProfile, type ClientProfileForm, uploadClientLogo } from "@/features/clients/profiles"
import { useClientRecord } from "@/features/clients/useClientRecord"
import { useTrackPageLoading } from "@/context/PageLoadingContext"
import notebooklmIcon from "@/assets/notebooklm-icon.svg"

const tabs = ["Integrations", "Data"] as const
type Tab = typeof tabs[number]

interface GoogleStatus {
    connected: boolean
    email: string | null
    requiredEmail: string
    allowed: boolean
}

export function ClientIntegrations() {
    const navigate = useNavigate()
    const { clientId } = useParams<{ clientId: string }>()
    const [searchParams] = useSearchParams()
    const { client, profile, loading: profileLoading, setProfile } = useClientRecord(clientId)

    const [activeTab, setActiveTab] = useState<Tab>("Integrations")
    const [config, setConfig] = useState<ClientIntegrationConfig>(() => getClientIntegrationConfig(client.id))
    const [profileForm, setProfileForm] = useState<ClientProfileForm>(() => createClientProfileForm(client))
    const [notebooks, setNotebooks] = useState<NotebookSummary[]>([])
    const [loadingNotebooks, setLoadingNotebooks] = useState(true)
    const [integrationError, setIntegrationError] = useState("")
    const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null)
    const [loadingGoogle, setLoadingGoogle] = useState(true)
    const authResult = searchParams.get("auth")
    const [savingProfile, setSavingProfile] = useState(false)
    const [profileMessage, setProfileMessage] = useState<{ ok: boolean; text: string } | null>(null)
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreviewUrl, setLogoPreviewUrl] = useState("")

    const selectedNotebook = useMemo(
        () => notebooks.find(notebook => notebook.id === config.notebooklm.notebookId),
        [config.notebooklm.notebookId, notebooks],
    )

    useEffect(() => {
        setConfig(getClientIntegrationConfig(client.id))
    }, [client.id])

    useEffect(() => {
        setProfileForm(createClientProfileForm(client, profile))
    }, [client, profile])

    useEffect(() => {
        saveClientIntegrationConfig(client.id, config)
    }, [client.id, config])

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
        let active = true

        async function loadNotebooks() {
            setLoadingNotebooks(true)
            setIntegrationError("")

            try {
                const data = await fetchNotebooklmNotebooks()
                if (active) setNotebooks(data)
            } catch (err) {
                if (active) {
                    setIntegrationError(err instanceof Error ? err.message : "Unable to load NotebookLM notebooks.")
                }
            } finally {
                if (active) setLoadingNotebooks(false)
            }
        }

        void loadNotebooks()
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        setLoadingGoogle(true)
        fetch("/api/auth/google/status")
            .then(r => r.json())
            .then(d => setGoogleStatus(d as GoogleStatus))
            .catch(() => setGoogleStatus({ connected: false, email: null, requiredEmail: "eva@xperienceusa.com", allowed: false }))
            .finally(() => setLoadingGoogle(false))
    }, [authResult])

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

    const integrationEnabled = config.notebooklm.enabled
    const hasPersistedLogo = Boolean(profile?.logo_url)
    const logoPreview = logoPreviewUrl || profileForm.logoUrl || (hasPersistedLogo ? client.avatar : "")
    const googleAuthorized = !!googleStatus?.allowed
    const googleWrongAccount = !!googleStatus?.connected && !googleAuthorized
    useTrackPageLoading(loadingNotebooks || loadingGoogle || profileLoading, `client-integrations:${client.id}`)

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
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{client.name}</h1>
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
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                                <img
                                                    src={notebooklmIcon}
                                                    alt="NotebookLM logo"
                                                    className="h-10 w-10 object-contain"
                                                />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">NotebookLM</h3>
                                                <p className={`mt-1 text-xs font-bold uppercase tracking-[0.18em] ${integrationEnabled
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-slate-400"
                                                    }`}>
                                                    {integrationEnabled ? "Enabled" : "Disabled"}
                                                </p>
                                            </div>
                                        </div>

                                        <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Enable</span>
                                            <span className={`relative h-7 w-12 rounded-full transition ${integrationEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"}`}>
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={integrationEnabled}
                                                    onChange={e => setConfig(current => ({
                                                        ...current,
                                                        notebooklm: {
                                                            ...current.notebooklm,
                                                            enabled: e.target.checked,
                                                        },
                                                    }))}
                                                />
                                                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${integrationEnabled ? "left-6" : "left-1"}`} />
                                            </span>
                                        </label>
                                    </div>

                                    <div className="mt-5 space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Notebook</label>
                                        <div className="relative">
                                            <select
                                                value={config.notebooklm.notebookId}
                                                disabled={!integrationEnabled || loadingNotebooks}
                                                onChange={event => {
                                                    const notebook = notebooks.find(item => item.id === event.target.value)
                                                    setConfig(current => ({
                                                        ...current,
                                                        notebooklm: {
                                                            ...current.notebooklm,
                                                            notebookId: event.target.value,
                                                            notebookTitle: notebook?.title ?? "",
                                                        },
                                                    }))
                                                }}
                                                className="h-14 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-12 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <option value="">
                                                    {loadingNotebooks ? "Loading notebooks..." : "Select a NotebookLM notebook"}
                                                </option>
                                                {notebooks.map(notebook => (
                                                    <option key={notebook.id} value={notebook.id}>
                                                        {notebook.title}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        </div>
                                    </div>

                                    {selectedNotebook && (
                                        <div className="mt-4">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedNotebook.title}</p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedNotebook.source_count} sources indexed</p>
                                        </div>
                                    )}
                                    {!selectedNotebook && integrationError && (
                                        <p className="mt-4 text-sm text-amber-600 dark:text-amber-300">{integrationError}</p>
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
                                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Google APIs</h3>
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
                                                { label: "Google Ads", color: "bg-green-500" },
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
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Client Logo</p>
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
                                            <p className="text-sm font-medium text-slate-900 dark:text-white">
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
