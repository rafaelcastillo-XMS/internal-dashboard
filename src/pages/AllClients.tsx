import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Users, Settings2, Sparkles, BarChart2, Search as SearchIcon, ExternalLink, Plus, X } from "lucide-react"
import { fetchClientRecords, createClientRecord, type ClientRecord } from "@/features/clients/clientsTable"
import { clientColor, clientInitials } from "@/features/clients/useClientRecord"

export function AllClients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newClientName, setNewClientName] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const loadClients = useCallback(() => {
    setLoading(true)
    fetchClientRecords()
      .then(rows => { setClients(rows); setLoadError(null) })
      .catch(err => setLoadError(err instanceof Error ? err.message : "Unable to load clients."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  function openSEM(client: ClientRecord) {
    if (!client.sem_account_id) return
    sessionStorage.setItem('xms_sem_selected', JSON.stringify({ accountId: client.sem_account_id }))
    window.dispatchEvent(
      new CustomEvent('sem:account-changed', { detail: { accountId: client.sem_account_id, name: client.name } })
    )
    navigate('/sem')
  }

  function openSEO(client: ClientRecord) {
    sessionStorage.setItem('xms_seo_client', JSON.stringify({ clientId: client.id }))
    window.dispatchEvent(
      new CustomEvent('seo:client-changed', { detail: { clientId: client.id, name: client.name } })
    )
    navigate('/seo')
  }

  async function handleCreateClient() {
    const name = newClientName.trim()
    if (!name || creating) return
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createClientRecord(name)
      setShowAddModal(false)
      setNewClientName("")
      navigate(`/clients/${created.id}/integrations`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unable to create client.")
    } finally {
      setCreating(false)
    }
  }

  const cardClass =
    "rounded-xl border border-stroke bg-white shadow-default transition-all duration-200 hover:border-[#1A72D9]/25 hover:shadow-xms-glow dark:border-strokedark dark:bg-boxdark"

  const activeCount = clients.filter(c => c.status === 'active').length

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
                {clients.length} total · {activeCount} active
              </p>
            </div>
            <button
              onClick={() => { setShowAddModal(true); setCreateError(null) }}
              className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Client
            </button>
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
                  const notebookConnected = client.notebooklm_enabled && !!client.notebooklm_id
                  const hasSEO = !!client.gsc_property || !!client.ga4_property_id
                  const hasSEM = !!client.sem_account_id

                  return (
                    <motion.div
                      key={client.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.6) }}
                      className={`${cardClass} flex flex-col relative overflow-hidden p-4`}
                    >
                      {/* Top: notebook badge + settings */}
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                          notebookConnected
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                        }`}>
                          <Sparkles className="h-3.5 w-3.5" />
                          {notebookConnected ? 'NotebookLM Ready' : 'No live integrations'}
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

                      {/* Client identity */}
                      <div
                        className="flex items-start gap-3 mb-4 cursor-pointer group/name"
                        onClick={() => navigate(`/clients/${client.id}`)}
                        role="button"
                      >
                        <div className={`w-11 h-11 rounded-xl ${clientColor(client.id)} flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm`}>
                          {clientInitials(client.name)}
                        </div>
                        <div className="pt-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <h3 className="font-semibold text-[var(--text-primary)] truncate group-hover/name:text-blue-600 transition-colors">
                              {client.name}
                            </h3>
                            <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
                          </div>
                          {client.gsc_property && (
                            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                              {client.gsc_property.replace(/^sc-domain:/, '')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Module action buttons */}
                      {(hasSEM || hasSEO) && (
                        <div className="flex gap-2 mb-4">
                          {hasSEM && (
                            <button
                              onClick={() => openSEM(client)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                            >
                              <BarChart2 className="w-3 h-3" />
                              SEM
                            </button>
                          )}
                          {hasSEO && (
                            <button
                              onClick={() => openSEO(client)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                            >
                              <SearchIcon className="w-3 h-3" />
                              SEO
                            </button>
                          )}
                        </div>
                      )}

                      {/* Footer: status + integrations summary */}
                      <div className="mt-auto flex items-center justify-between pt-4 border-t border-[var(--border)]">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Status</span>
                          <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider w-fit ${
                            client.status === 'active'
                              ? 'bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)]'
                              : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border)]'
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

      {/* Add Client modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-stroke bg-white p-6 shadow-2xl dark:border-strokedark dark:bg-boxdark"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Add Client</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Client name</label>
            <input
              autoFocus
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleCreateClient() }}
              placeholder="e.g. Holt's Reliable Garage Door Repair"
              className="mt-1.5 h-11 w-full rounded-xl border border-stroke bg-white px-4 text-sm text-[var(--text-primary)] outline-none transition focus:border-blue-400 dark:border-strokedark dark:bg-boxdark"
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              After creating the client you'll be taken to its integrations page to link GSC, GA4, Google Ads and NotebookLM.
            </p>
            {createError && <p className="mt-2 text-xs text-red-500">{createError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-[var(--text-secondary)] dark:border-strokedark dark:bg-boxdark"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreateClient()}
                disabled={!newClientName.trim() || creating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create Client'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
