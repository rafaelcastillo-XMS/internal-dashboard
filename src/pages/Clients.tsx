import { useNavigate, useParams } from "react-router-dom"
import { MapPin, Phone, Mail, Building, Globe, User, ExternalLink, Activity, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type { Client } from "@/data/dummy"
import { useClientRecord } from "@/features/clients/useClientRecord"
import { useDashboardAccess } from "@/context/useDashboardAccess"
import type { NotionRelatedData } from "@/features/clients/notionRelated"

function ClientInfo({ client, logoUrl, notionRelated }: { client: Client; logoUrl: string; notionRelated: NotionRelatedData | null }) {
    return (
        <div className="w-full bg-[var(--bg-surface)] flex flex-col">
            <div className="p-6 flex flex-col items-center border-b border-slate-200/70 dark:border-white/10">
                <div className={`mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl text-3xl font-bold text-white shadow-xl ${logoUrl ? "border border-slate-200 bg-white dark:border-slate-700" : client.color}`}>
                    {logoUrl ? (
                        <img src={logoUrl} alt={`${client.name} logo`} className="h-full w-full object-contain p-2" />
                    ) : client.initials}
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] mb-1">{client.name}</h3>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${client.status === "active"
                    ? "bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]"
                    : "bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border)]"
                    }`}>
                    {client.status === "active" ? "Active" : "Inactive"}
                </div>
            </div>

            <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                    <section>
                        <h4 className="text-[10px] font-bold text-[var(--sidebar-section-label)] uppercase tracking-widest mb-4">Client Information</h4>
                        <div className="grid gap-4">
                            <InfoItem icon={User} label="POC - Owner Name" value={client.pocOwnerName} />
                            <InfoItem icon={Activity} label="Level of Service" value={client.levelOfService} badge />
                            <InfoItem icon={Building} label="Industry" value={client.industry} />
                            <InfoItem icon={MapPin} label="Location" value={client.location} />
                        </div>
                    </section>

                    <Separator className="bg-[var(--border)]" />

                    <section>
                        <h4 className="text-[10px] font-bold text-[var(--sidebar-section-label)] uppercase tracking-widest mb-4">Contact & Media</h4>
                        <div className="grid gap-4">
                            <InfoItem icon={Phone} label="Phone" value={client.phone} />
                            <InfoItem icon={Mail} label="Email" value={client.email} />
                            <InfoItem icon={Globe} label="Website" value={client.website} isLink />
                        </div>
                    </section>

                    {notionRelated && (
                        <>
                            <Separator className="bg-[var(--border)]" />
                            <section>
                                <h4 className="text-[10px] font-bold text-[var(--sidebar-section-label)] uppercase tracking-widest mb-4">Notion Related Data</h4>
                                <div className="grid gap-3">
                                    {(["sem", "seo", "design", "social"] as const).map(category => {
                                        const count = notionRelated.sources.filter(source => source.category === category).reduce((total, source) => total + source.records.length, 0)
                                        return <div key={category} className="flex items-center justify-between text-sm"><span className="capitalize text-[var(--text-secondary)]">{category}</span><span className="font-semibold text-[var(--text-primary)]">{count} registros</span></div>
                                    })}
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}

function InfoItem({ icon: Icon, label, value, isLink, linkUrl, badge }: { icon: React.ElementType, label: string, value: string, isLink?: boolean, linkUrl?: string, badge?: boolean }) {
    return (
        <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center shrink-0 border border-slate-200/70 dark:border-white/10">
                <Icon className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-[var(--sidebar-section-label)] uppercase tracking-wider mb-0.5">{label}</p>
                {badge ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--brand-accent-subtle)] text-[var(--brand-accent)] border border-[var(--brand-accent-subtle-border)]">
                        {value}
                    </span>
                ) : isLink ? (
                    <a
                        href={linkUrl || value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 truncate"
                    >
                        {value} <ExternalLink className="w-3 h-3" />
                    </a>
                ) : (
                    <p className="text-sm font-semibold text-[var(--text-secondary)] truncate">{value}</p>
                )}
            </div>
        </div>
    )
}

export function Clients() {
    const { clientId } = useParams<{ clientId: string }>()
    const { client, profile, notionRelated } = useClientRecord(clientId)
    const navigate = useNavigate()
    const { isSuperadmin } = useDashboardAccess()
    const logoUrl = profile?.logo_url ?? ""

    return (
        <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="mx-auto max-w-4xl p-6">
                {isSuperadmin && (
                    <div className="mb-4 flex justify-end">
                        <Button variant="outline" onClick={() => navigate(`/clients/${client.id}/integrations`)}>
                            <Settings2 className="h-4 w-4" />
                            Integrations
                        </Button>
                    </div>
                )}
                <div className="w-full overflow-hidden rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                    <ClientInfo client={client} logoUrl={logoUrl} notionRelated={notionRelated} />
                </div>
            </div>
        </div>
    )
}
