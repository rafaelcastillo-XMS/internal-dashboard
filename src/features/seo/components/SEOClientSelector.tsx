import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Search, Check, ChevronDown, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { SEOClientOption } from '@/features/seo/hooks/useSEODashboardState'
import { fetchClientProfiles } from '@/features/clients/profiles'

const CLIENTS_KEY  = 'xms_seo_clients'
const SELECTED_KEY = 'xms_seo_client'

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

export function SEOClientSelector() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [clients, setClients] = useState<SEOClientOption[]>([])
  const [clientLogos, setClientLogos] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState<string>('')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 })

  const loadClients = () => {
    try {
      const cached: SEOClientOption[] = JSON.parse(sessionStorage.getItem(CLIENTS_KEY) || '[]')
      if (cached.length > 0) {
        setClients(cached)
        return
      }
    } catch { /* ignore */ }
    supabase
      .from('clients')
      .select('id, name, status, gsc_property, ga4_property_id')
      .order('name')
      .then(({ data }) => {
        if (data) {
          setClients(data
            .filter(r => r.status === 'active' && (r.gsc_property || r.ga4_property_id))
            .map(r => ({ id: r.id, name: r.name, gsc: r.gsc_property || '', ga4: r.ga4_property_id || '' })))
        }
      })
  }

  useEffect(() => {
    loadClients()
    let active = true
    fetchClientProfiles()
      .then(profiles => {
        if (!active) return
        setClientLogos(Object.fromEntries(
          profiles.filter(profile => profile.logo_url).map(profile => [profile.client_id, profile.logo_url as string]),
        ))
      })
      .catch(() => { /* Keep the existing initials fallback. */ })
    try {
      const sel = JSON.parse(sessionStorage.getItem(SELECTED_KEY) || 'null')
      if (sel?.clientId) setSelectedId(sel.clientId)
    } catch { /* ignore */ }
    return () => { active = false }
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ clientId: string }>).detail
      if (detail?.clientId) setSelectedId(detail.clientId)
    }
    window.addEventListener('seo:client-changed', handler)
    return () => window.removeEventListener('seo:client-changed', handler)
  }, [])

  const selectedClient = clients.find(c => c.id === selectedId)
  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleOpen = () => {
    loadClients()
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) setPanelPos({ top: rect.top, left: rect.right + 8 })
    setOpen(true)
    setTimeout(() => searchRef.current?.focus(), 80)
  }

  const handleSelect = (client: SEOClientOption) => {
    setSelectedId(client.id)
    sessionStorage.setItem(SELECTED_KEY, JSON.stringify({ clientId: client.id }))
    window.dispatchEvent(new CustomEvent('seo:client-changed', {
      detail: { clientId: client.id, name: client.name }
    }))
    setOpen(false)
    setSearch('')
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="w-full text-left rounded-md border border-[var(--sidebar-border)] bg-[var(--bg-surface)] dark:bg-white/[0.03] px-3 py-2.5 hover:bg-[var(--bg-subtle)] transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-white ring-2 ${selectedClient && clientLogos[selectedClient.id] ? 'bg-white ring-slate-200' : 'bg-[#1A72D9] ring-[#1A72D9]/20'}`}>
            {selectedClient && clientLogos[selectedClient.id] ? (
              <img src={clientLogos[selectedClient.id]} alt={`${selectedClient.name} logo`} className="h-full w-full object-contain p-0.5" />
            ) : selectedClient ? getInitials(selectedClient.name) : <Building2 className="w-3.5 h-3.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-[var(--text-primary)]">
              {selectedClient?.name || 'Select client'}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--sidebar-section-label)] truncate">
              SEO Intelligence
            </p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-[var(--sidebar-section-label)] shrink-0 group-hover:text-[var(--text-primary)] transition-colors" />
        </div>
      </button>

      {open && createPortal(
        <>
          {/* Overlay — behind sidebar (z-45 < sidebar z-50) */}
          <div
            className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-[1px]"
            onClick={() => { setOpen(false); setSearch('') }}
          />

          {/* Floating panel */}
          <div
            className="fixed z-50 w-96 bg-[var(--bg-raised)] border border-[var(--sidebar-border)] dark:border-white/[0.08] shadow-2xl rounded-xl overflow-hidden"
            style={{ top: panelPos.top, left: panelPos.left }}
          >
            {/* Search */}
            <div className="border-b border-[var(--border)] px-1">
              <div className="flex items-center gap-2.5 px-3 py-3">
                <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search clients..."
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
              </div>
            </div>

            {/* Client list */}
            <div className="py-2 px-2 max-h-72 overflow-y-auto custom-scrollbar">
              <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--sidebar-section-label)]">
                Clients
              </p>
              <ul className="space-y-0.5">
                {filtered.map(client => {
                  const isSelected = selectedId === client.id
                  return (
                    <li key={client.id}>
                      <button
                        onClick={() => handleSelect(client)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-[var(--hover-bg)] ${isSelected ? 'font-semibold text-[var(--text-primary)] bg-[var(--hover-bg)]' : 'font-medium text-[var(--text-secondary)]'}`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-white ring-2 ${clientLogos[client.id] ? 'bg-white ring-slate-200' : 'bg-[#1A72D9] ring-[#1A72D9]/20'}`}>
                          {clientLogos[client.id] ? (
                            <img src={clientLogos[client.id]} alt={`${client.name} logo`} className="h-full w-full object-contain p-0.5" />
                          ) : getInitials(client.name)}
                        </div>
                        <span className="flex-1 text-left">{client.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#1A72D9] shrink-0" />}
                      </button>
                    </li>
                  )
                })}
                {filtered.length === 0 && (
                  <li className="px-3 py-4 text-sm text-[var(--text-muted)] text-center">
                    {clients.length === 0 ? 'Loading clients…' : 'No clients found'}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
