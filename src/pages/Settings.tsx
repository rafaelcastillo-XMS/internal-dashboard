import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { ExternalLink, Puzzle } from "lucide-react"
import { getClients } from "@/features/clients/repository"

export function Settings() {
    const navigate = useNavigate()
    const clients = getClients()

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 custom-scrollbar">
            <div className="mx-auto max-w-screen-2xl p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Dashboard preferences and integrations</p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden"
                >
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700">
                        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Puzzle className="w-4 h-4 text-slate-500" />
                            API Integrations
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Manage Google APIs and other connections from each client's integrations page
                        </p>
                    </div>

                    <div className="px-6 py-4 space-y-2">
                        {clients.map(client => (
                            <button
                                key={client.id}
                                onClick={() => navigate(`/clients/${client.id}/integrations`)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group text-left"
                            >
                                <div className={`w-8 h-8 rounded-xl ${client.color} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                                    {client.initials}
                                </div>
                                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                                    {client.name}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
