import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Users, Settings2, Sparkles, BarChart2, Search as SearchIcon, ExternalLink } from "lucide-react"
import { getClients } from "@/features/clients/repository"
import { getNotebookIntegrationBadge } from "@/features/clients/integrations"
import { supabase } from "@/lib/supabase"

interface AdsAccount {
  id: string
  name: string
  status: string
}

// SEO clients (from ClientSelector.tsx hardcoded list)
const SEO_CLIENT_NAMES = ['holts', 'holtsgarage']

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  return words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-amber-600',
  'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600',
]

interface MergedClient {
  id: string
  name: string
  initials: string
  color: string
  status: 'active' | 'inactive'
  industry?: string
  levelOfService?: string
  hasSEO: boolean
  hasSEM: boolean
  semAccountId?: string
  isDummy: boolean
}

function matchesAny(norm: string, candidates: string[]): boolean {
  return candidates.some(c => {
    if (norm.length < 4 || c.length < 4) return norm === c
    return norm.includes(c) || c.includes(norm)
  })
}

export function AllClients() {
  const navigate = useNavigate()
  const dummyClients = getClients()
  const [semAccounts, setSemAccounts] = useState<AdsAccount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('sem_accounts')
      .select('id, name, status')
      .order('name')
      .then(({ data }) => {
        setSemAccounts((data || []).filter((a: AdsAccount) => a.status === 'ENABLED'))
        setLoading(false)
      })
  }, [])

  const merged = useMemo<MergedClient[]>(() => {
    const result: MergedClient[] = []
    const seenNorms: string[] = []

    // 1. Start with rich dummy.ts clients
    for (const client of dummyClients) {
      const norm = normalizeName(client.name)
      seenNorms.push(norm)

      const hasSEO = matchesAny(norm, SEO_CLIENT_NAMES)

      const semMatch = semAccounts.find(a => matchesAny(norm, [normalizeName(a.name)]))

      result.push({
        id: client.id,
        name: client.name,
        initials: client.initials,
        color: client.color,
        status: client.status,
        industry: client.industry,
        levelOfService: client.levelOfService,
        hasSEO,
        hasSEM: !!semMatch,
        semAccountId: semMatch?.id,
        isDummy: true,
      })
    }

    // 2. Add SEM accounts not already represented
    let colorIdx = 0
    for (const account of semAccounts) {
      const norm = normalizeName(account.name)
      if (matchesAny(norm, seenNorms)) continue
      seenNorms.push(norm)

      const hasSEO = matchesAny(norm, SEO_CLIENT_NAMES)

      result.push({
        id: `sem-${account.id}`,
        name: account.name,
        initials: getInitials(account.name),
        color: AVATAR_COLORS[colorIdx % AVATAR_COLORS.length],
        status: 'active',
        hasSEO,
        hasSEM: true,
        semAccountId: account.id,
        isDummy: false,
      })
      colorIdx++
    }

    result.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    return result
  }, [dummyClients, semAccounts])

  function openSEM(semAccountId: string, accountName: string) {
    sessionStorage.setItem('xms_sem_selected', JSON.stringify({ accountId: semAccountId }))
    window.dispatchEvent(
      new CustomEvent('sem:account-changed', { detail: { accountId: semAccountId, name: accountName } })
    )
    navigate('/sem')
  }

  function openSEO() {
    navigate('/seo')
  }

  const cardClass =
    "rounded-xl border border-stroke bg-white shadow-default transition-all duration-200 hover:border-[#1A72D9]/25 hover:shadow-xms-glow dark:border-strokedark dark:bg-boxdark"

  const activeCount = merged.filter(c => c.status === 'active').length

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
                {merged.length} total · {activeCount} active
              </p>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="mx-auto max-w-screen-2xl p-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`${cardClass} h-52 animate-pulse`} />
                ))}
              </div>
            ) : merged.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--text-muted)]">
                <Users className="w-8 h-8 opacity-30" />
                <p className="text-sm">No clients found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {merged.map((client, i) => {
                  const notebookConnected = client.isDummy
                    ? getNotebookIntegrationBadge(client.id)
                    : false

                  return (
                    <motion.div
                      key={client.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.05 }}
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
                        {client.isDummy && (
                          <button
                            type="button"
                            aria-label={`Configure ${client.name}`}
                            onClick={() => navigate(`/clients/${client.id}/integrations`)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-stroke bg-white text-body transition-colors hover:border-[#1A72D9]/25 hover:text-[#1A72D9] dark:border-strokedark dark:bg-boxdark dark:text-bodydark shrink-0"
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Client identity */}
                      <div
                        className={`flex items-start gap-3 mb-4 ${client.isDummy ? 'cursor-pointer group/name' : ''}`}
                        onClick={() => client.isDummy && navigate(`/clients/${client.id}`)}
                        role={client.isDummy ? 'button' : undefined}
                      >
                        <div className={`w-11 h-11 rounded-xl ${client.color} flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm`}>
                          {client.initials}
                        </div>
                        <div className="pt-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <h3 className={`font-semibold text-[var(--text-primary)] truncate ${client.isDummy ? 'group-hover/name:text-blue-600 transition-colors' : ''}`}>
                              {client.name}
                            </h3>
                            {client.isDummy && (
                              <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
                            )}
                          </div>
                          {client.industry && (
                            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{client.industry}</p>
                          )}
                        </div>
                      </div>

                      {/* Module action buttons */}
                      {(client.hasSEM || client.hasSEO) && (
                        <div className="flex gap-2 mb-4">
                          {client.hasSEM && (
                            <button
                              onClick={() => openSEM(client.semAccountId!, client.name)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                            >
                              <BarChart2 className="w-3 h-3" />
                              SEM
                            </button>
                          )}
                          {client.hasSEO && (
                            <button
                              onClick={() => openSEO()}
                              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                            >
                              <SearchIcon className="w-3 h-3" />
                              SEO
                            </button>
                          )}
                        </div>
                      )}

                      {/* Footer: status + level of service */}
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
                        {client.levelOfService && (
                          <div className="flex flex-col gap-1 items-end">
                            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest text-right">
                              Level of Service
                            </span>
                            <span className="text-xs font-semibold text-[var(--brand-accent)] bg-[var(--brand-accent-subtle)] px-2 py-0.5 rounded-md border border-[var(--brand-accent-subtle-border)]">
                              {client.levelOfService}
                            </span>
                          </div>
                        )}
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
