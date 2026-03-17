import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Camera, ChevronDown, Database, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getClientIntegrationConfig, saveClientIntegrationConfig, type ClientIntegrationConfig } from "@/features/clients/integrations"
import { fetchNotebooklmNotebooks, type NotebookSummary } from "@/features/clients/notebooklm"
import { createClientProfileForm, saveClientProfile, type ClientProfileForm, uploadClientLogo } from "@/features/clients/profiles"
import { useClientRecord } from "@/features/clients/useClientRecord"
import notebooklmIcon from "@/assets/notebooklm-icon.svg"

const tabs = ["Integrations", "Data"] as const
type Tab = typeof tabs[number]

export function ClientIntegrations() {
    const navigate = useNavigate()
    const { clientId } = useParams<{ clientId: string }>()
    const { client, profile, loading: profileLoading, setProfile } = useClientRecord(clientId)

    const [activeTab, setActiveTab] = useState<Tab>("Integrations")
    const [config, setConfig] = useState<ClientIntegrationConfig>(() => getClientIntegrationConfig(client.id))
    const [profileForm, setProfileForm] = useState<ClientProfileForm>(() => createClientProfileForm(client))
    const [notebooks, setNotebooks] = useState<NotebookSummary[]>([])
    const [loadingNotebooks, setLoadingNotebooks] = useState(true)
    const [integrationError, setIntegrationError] = useState("")
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

    return (
        <div className="h-full overflow-auto bg-slate-50 dark:bg-slate-950 p-5 md:p-6">
            <div className="mx-auto max-w-6xl space-y-6">
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
