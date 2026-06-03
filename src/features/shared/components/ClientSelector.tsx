import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Search, Check, ChevronDown, Building2 } from 'lucide-react'

const CLIENTS = [
  { id: 'holts', name: 'Holts', initials: 'HO', color: 'bg-amber-700' },
]

interface ClientSelectorProps {
  activeName: string
  subtitle: string
  onSelect: (name: string) => void
}

export function ClientSelector({ activeName, subtitle, onSelect }: ClientSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (open) {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (rect) {
        setPanelPos({ top: rect.top, left: rect.right + 8 })
      }
      setTimeout(() => searchRef.current?.focus(), 80)
    } else {
      setSearch('')
    }
  }, [open])

  const filtered = CLIENTS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-md border border-[var(--sidebar-border)] bg-[var(--bg-surface)] dark:bg-white/[0.03] px-3 py-2.5 hover:bg-[var(--bg-subtle)] transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          {(() => {
            const client = CLIENTS.find(c => c.name === activeName)
            return (
              <div className={`w-8 h-8 rounded-full ${client?.color ?? 'bg-[#1A72D9]'} flex items-center justify-center text-white text-[10px] font-bold shrink-0 ring-2 ring-current/20`}>
                {client ? client.initials : activeName ? activeName.substring(0, 2).toUpperCase() : <Building2 className="w-3.5 h-3.5" />}
              </div>
            )
          })()}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-[var(--text-primary)]">
              {activeName || 'Select a client'}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--sidebar-section-label)] truncate">{subtitle}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-[var(--sidebar-section-label)] shrink-0 group-hover:text-[var(--text-primary)] transition-colors" />
        </div>
      </button>

      {open && createPortal(
        <>
          {/* Overlay — sits behind the sidebar (z-45 < sidebar z-50) */}
          <div
            className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
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
                  const isSelected = activeName === client.name
                  return (
                    <li key={client.id}>
                      <button
                        onClick={() => { onSelect(client.name); setOpen(false) }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-[var(--hover-bg)] ${isSelected ? 'font-semibold text-[var(--text-primary)] bg-[var(--hover-bg)]' : 'font-medium text-[var(--text-secondary)]'}`}
                      >
                        <div className={`w-8 h-8 rounded-full ${client.color} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                          {client.initials}
                        </div>
                        <span className="flex-1 text-left">{client.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[var(--brand-accent)] shrink-0" />}
                      </button>
                    </li>
                  )
                })}
                {filtered.length === 0 && (
                  <li className="px-3 py-4 text-sm text-[var(--text-muted)] text-center">No clients found</li>
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
