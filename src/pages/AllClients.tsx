import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Users, ArrowRight } from "lucide-react"
import { getClients } from "@/features/clients/repository"

export function AllClients() {
    const navigate = useNavigate()
    const clients = getClients()

    return (
        <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
            <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shrink-0 sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">All Clients</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {clients.length} total clients · {clients.filter(c => c.status === "active").length} active
                            </p>
                        </div>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-auto p-5 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {clients.map((client, i) => {
                            return (
                                <motion.button
                                    key={client.id}
                                    onClick={() => navigate(`/clients/${client.id}`)}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: i * 0.05 }}
                                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-slate-600 transition-all text-left flex flex-col group relative overflow-hidden h-full"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                                        <ArrowRight className="w-4 h-4 text-blue-500" />
                                    </div>

                                    <div className="flex items-start gap-4 mb-4">
                                        <div className={`w-12 h-12 rounded-xl ${client.color} flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm`}>
                                            {client.initials}
                                        </div>
                                        <div className="pt-1 flex-1 min-w-0 pr-6">
                                            <h3 className="font-semibold text-slate-900 dark:text-white truncate">{client.name}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{client.industry}</p>
                                        </div>
                                    </div>

                                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-700/50">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                Status
                                            </span>
                                            <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider w-fit ${client.status === "active"
                                                ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                                                : "bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20"
                                                }`}>
                                                {client.status === "active" ? "Active" : "Inactive"}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 items-end">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">
                                                Level of Service
                                            </span>
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800/50">
                                                {client.levelOfService}
                                            </span>
                                        </div>
                                    </div>
                                </motion.button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
