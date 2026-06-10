import { useState, useEffect } from 'react'
import { useTrackPageLoading } from '@/context/PageLoadingContext'
import { supabase } from '@/lib/supabase'

export const DATE_PRESETS = [
  { label: 'Last 7 Days',  days: 7  },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
]

export function getDateRange(days: number) {
  const end   = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { startDate: fmt(start), endDate: fmt(end) }
}

export function formatDateLabel(startDate: string, endDate: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  const s = new Date(startDate).toLocaleDateString('en-US', opts)
  const e = new Date(endDate).toLocaleDateString('en-US', opts)
  return `${s} – ${e}`
}

export const SEO_API = 'https://sjpvyxdyleebhqlmqscy.supabase.co/functions/v1/seo'

export interface SEOClientOption {
  id:   string
  name: string
  gsc:  string
  ga4:  string
}

const CLIENTS_KEY  = 'xms_seo_clients'
const SELECTED_KEY = 'xms_seo_client'

function ssGet(key: string) {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') } catch { return null }
}
function ssSet(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

export function useSEODashboardState(defaultPreset = 1) {
  const [selectedPreset, setSelectedPreset] = useState(defaultPreset)
  const [dateRange,      setDateRange]      = useState(getDateRange(DATE_PRESETS[defaultPreset].days))
  const [loading,        setLoading]        = useState(false)
  const [lastUpdated,    setLastUpdated]    = useState<Date | null>(null)
  const [propertiesError, setPropertiesError] = useState<string | null>(null)
  const [propertiesLoaded, setPropertiesLoaded] = useState(false)
  const [propertiesLoading, setPropertiesLoading] = useState(true)

  useTrackPageLoading(loading || propertiesLoading, 'seo-data')

  const [clients, setClients] = useState<SEOClientOption[]>(() => {
    return ssGet(CLIENTS_KEY) || []
  })

  const [selectedClientId, setSelectedClientIdRaw] = useState<string>(() => {
    const sel = ssGet(SELECTED_KEY)
    if (sel?.clientId) return sel.clientId
    const cached: SEOClientOption[] = ssGet(CLIENTS_KEY) || []
    return cached[0]?.id || ''
  })

  // Load SEO clients (with their fixed GSC/GA4 pair) from the clients table
  useEffect(() => {
    setPropertiesLoading(true)
    supabase
      .from('clients')
      .select('id, name, status, gsc_property, ga4_property_id')
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          setPropertiesError(error.message)
        } else {
          const list: SEOClientOption[] = (data || [])
            .filter((r) => r.status === 'active' && (r.gsc_property || r.ga4_property_id))
            .map((r) => ({ id: r.id, name: r.name, gsc: r.gsc_property || '', ga4: r.ga4_property_id || '' }))
          setClients(list)
          ssSet(CLIENTS_KEY, list)
          setSelectedClientIdRaw((prev) => list.some((c) => c.id === prev) ? prev : (list[0]?.id || ''))
        }
        setPropertiesLoaded(true)
        setPropertiesLoading(false)
      })
  }, [])

  // Listen for client changes from external sources (e.g. sidebar selector)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ clientId: string }>).detail
      if (detail?.clientId) {
        setSelectedClientIdRaw(prev => prev !== detail.clientId ? detail.clientId : prev)
      }
    }
    window.addEventListener('seo:client-changed', handler)
    return () => window.removeEventListener('seo:client-changed', handler)
  }, [])

  // Persist selection + notify sidebar
  useEffect(() => {
    if (selectedClientId) {
      const name = clients.find((c) => c.id === selectedClientId)?.name || selectedClientId
      ssSet(SELECTED_KEY, { clientId: selectedClientId })
      window.dispatchEvent(new CustomEvent('seo:client-changed', { detail: { clientId: selectedClientId, name } }))
    }
  }, [selectedClientId, clients])

  function handlePresetChange(idx: number) {
    setSelectedPreset(idx)
    setDateRange(getDateRange(DATE_PRESETS[idx].days))
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null

  return {
    selectedPreset,
    dateRange,
    loading, setLoading,
    lastUpdated, setLastUpdated,
    propertiesError,
    propertiesLoaded,
    clients,
    selectedClientId,
    setSelectedClientId: setSelectedClientIdRaw,
    clientName:      selectedClient?.name || '',
    selectedGscSite: selectedClient?.gsc  || '',
    selectedGa4Id:   selectedClient?.ga4  || '',
    handlePresetChange,
  }
}
