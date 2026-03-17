import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Users, ArrowRight, Settings2, Sparkles } from "lucide-react"
import { getClients } from "@/features/clients/repository"
import { getNotebookIntegrationBadge } from "@/features/clients/integrations"

export function AllClients() {
    const navigate = useNavigate()
    const clients = getClients()
    const cardClass = "rounded-xl border border-stroke bg-white shadow-default transition-all duration-200 hover:border-[#1A72D9]/25 hover:shadow-xms-glow dark:border-strokedark dark:bg-boxdark"

    return (
        <div className="flex h-full bg-[var(--bg-app)] overflow-hidden relative">
            <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
                {/* Header */}
                <div className="border-b border-[var(--border)] bg-[var(--bg-surface)]/90 backdrop-blur-xl shrink-0 sticky top-0 z-20">
                    <div className="mx-auto max-w-screen-2xl p-6 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">All Clients</h1>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                {clients.length} total clients · {clients.filter(c => c.status === "active").length} active
                            </p>
                        </div>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <div className="mx-auto max-w-screen-2xl p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {clients.map((client, i) => {
                            const notebookConnected = getNotebookIntegrationBadge(client.id)

                            return (
                                <motion.div
                                    key={client.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: i * 0.05 }}
                                    className={`${cardClass} text-left flex flex-col group relative overflow-hidden h-full p-4`}
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                                        <ArrowRight className="w-4 h-4 text-blue-500" />
                                    </div>

                                    <div className="mb-4 flex items-center justify-between gap-2">
                                        <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${notebookConnected
                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                            : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                                            }`}>
                                            <Sparkles className="h-3.5 w-3.5" />
                                            {notebookConnected ? "NotebookLM Ready" : "No live integrations"}
                                        </div>
                                        <button
                                            type="button"
                                            aria-label={`Configure ${client.name}`}
                                            onClick={() => navigate(`/clients/${client.id}/integrations`)}
                                            className="relative z-10 flex h-10 w-10 items-center justify-center rounded-lg border border-stroke bg-white text-body transition-colors hover:border-[#1A72D9]/25 hover:text-[#1A72D9] dark:border-strokedark dark:bg-boxdark dark:text-bodydark"
                                        >
                                            <Settings2 className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => navigate(`/clients/${client.id}`)}
                                        className="flex h-full flex-col text-left"
                                    >
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className={`w-12 h-12 rounded-xl ${client.color} flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm`}>
                                            {client.initials}
                                        </div>
                                        <div className="pt-1 flex-1 min-w-0 pr-6">
                                            <h3 className="font-semibold text-[var(--text-primary)] truncate">{client.name}</h3>
                                            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{client.industry}</p>
                                        </div>
                                    </div>

                                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-[var(--border)]">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                                Status
                                            </span>
                                            <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider w-fit ${client.status === "active"
                                                ? "bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)]"
                                                : "bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border)]"
                                                }`}>
                                                {client.status === "active" ? "Active" : "Inactive"}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 items-end">
                                            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest text-right">
                                                Level of Service
                                            </span>
                                            <span className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent-subtle)] px-2 py-0.5 rounded-md border border-[var(--accent-subtle-border)]">
                                                {client.levelOfService}
                                            </span>
                                        </div>
                                    </div>
                                    </button>
                                </motion.div>
                            )
                        })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
