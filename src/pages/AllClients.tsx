import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Users, Settings2 } from "lucide-react"
import { fetchClientRecords, type ClientRecord } from "@/features/clients/clientsTable"
import { clientColor } from "@/features/clients/useClientRecord"
import { fetchClientProfiles } from "@/features/clients/profiles"
import { fetchNotionCovers } from "@/features/clients/notionCovers"
import { supabase } from "@/lib/supabase"

export function AllClients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [clientLogos, setClientLogos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadClients = useCallback(() => {
    setLoading(true)
    Promise.all([fetchClientRecords(), fetchClientProfiles().catch(() => []), supabase.auth.getSession()])
      .then(async ([rows, profiles, sessionResult]) => {
        const covers: Record<string, string> = sessionResult.data.session?.access_token ? await fetchNotionCovers(sessionResult.data.session.access_token).catch(() => ({} as Record<string, string>)) : {}
        setClients(rows)
        setClientLogos(Object.fromEntries(
          rows.map(row => [row.id, covers[row.id] ?? profiles.find(profile => profile.client_id === row.id)?.logo_url ?? ""]).filter(([, url]) => url),
        ))
        setLoadError(null)
      })
      .catch(err => setLoadError(err instanceof Error ? err.message : "Unable to load clients."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  const cardClass =
    "rounded-xl border border-stroke bg-white shadow-none transition-all duration-200 hover:brightness-90 dark:border-strokedark dark:bg-boxdark"

  const activeCount = clients.filter(c => c.status === 'active').length

  return (
    <div className="flex h-full overflow-hidden relative">
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* Header */}
        <div className="shrink-0 sticky top-0 z-20">
          <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-6 pt-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">All Clients</h1>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {clients.length} total · {activeCount} active
              </p>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="mx-auto max-w-screen-2xl p-6">
            {loadError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {loadError}
              </div>
            )}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`${cardClass} h-52 animate-pulse`} />
                ))}
              </div>
            ) : clients.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--text-muted)]">
                <Users className="w-8 h-8 opacity-30" />
                <p className="text-sm">No clients found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {clients.map((client, i) => {
                  const hasSEO = !!client.gsc_property || !!client.ga4_property_id
                  const hasSEM = !!client.sem_account_id

                  return (
                    <motion.div
                      key={client.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.6) }}
                      className={`${cardClass} flex flex-col relative overflow-hidden`}
                    >
                      <div className="relative h-44 w-full overflow-hidden bg-[var(--bg-subtle)]">
                        {clientLogos[client.id] ? <img src={clientLogos[client.id]} alt={`${client.name} cover`} className="h-full w-full object-cover" /> : <div className={`h-full w-full ${clientColor(client.id)} opacity-80`} />}
                      </div>
                      <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-1">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold leading-tight text-[var(--text-primary)]">{client.name}</h3>
                          {client.gsc_property && <p className="mt-0.5 truncate text-xs leading-tight text-[var(--text-muted)]">{client.gsc_property.replace(/^sc-domain:/, '')}</p>}
                        </div>
                        <button
                          type="button"
                          aria-label={`Configure ${client.name}`}
                          onClick={() => navigate(`/clients/${client.id}/integrations`)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-stroke bg-white text-body transition-colors hover:border-[#1A72D9]/25 hover:text-[#1A72D9] dark:border-strokedark dark:bg-boxdark dark:text-bodydark shrink-0"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="h-2 cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)} aria-label={`Open ${client.name}`} />

                      {/* Footer: status + integrations summary */}
                      <div className="mt-auto flex items-center justify-between border-t border-[var(--border)]/45 p-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Status</span>
                          <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider w-fit ${
                            client.status === 'active'
                              ? 'bg-emerald-500 text-white border border-emerald-500'
                              : 'bg-slate-500 text-white border border-slate-500'
                          }`}>
                            {client.status === 'active' ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest text-right">
                            Services
                          </span>
                          <span className="text-xs font-semibold text-[var(--brand-accent)] bg-[var(--brand-accent-subtle)] px-2 py-0.5 rounded-md border border-[var(--brand-accent-subtle-border)]">
                            {[hasSEO && 'SEO', hasSEM && 'SEM'].filter(Boolean).join(' + ') || 'Not configured'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
