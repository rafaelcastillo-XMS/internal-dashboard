import { useState, useEffect, useCallback } from 'react'
import { useTrackPageLoading } from '@/context/PageLoadingContext'

function normalizeDomain(str: string): string {
  return str
    .toLowerCase()
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\/(?:www\.)?/, '')
    .replace(/\.(com|net|org|io|co|us|info|biz|dev|app).*$/, '')
    .replace(/[^a-z0-9]/g, '')
}

function findBestGa4Match(gscSite: string, ga4Properties: { id: string; name?: string }[]): string {
  const domain = normalizeDomain(gscSite)
  if (domain.length < 4) return ''
  let bestId = ''
  let bestScore = 0
  for (const prop of ga4Properties) {
    const propNorm = normalizeDomain(prop.name || prop.id)
    const score = propNorm.includes(domain) ? domain.length
                : domain.includes(propNorm) && propNorm.length >= 4 ? propNorm.length
                : 0
    if (score > bestScore) { bestScore = score; bestId = prop.id }
  }
  return bestScore >= 4 ? bestId : ''
}

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

const PROPS_KEY    = 'xms_properties'
const SELECTED_KEY = 'xms_selected'

function ssGet(key: string) {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') } catch { return null }
}
function ssSet(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch {}
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

  const [properties, setProperties] = useState<{ gscSites: { url: string }[]; ga4Properties: { id: string; name?: string }[] }>(() => {
    return ssGet(PROPS_KEY) || { gscSites: [], ga4Properties: [] }
  })

  const [selectedGscSite, setSelectedGscSite] = useState<string>(() => {
    const sel = ssGet(SELECTED_KEY)
    if (sel?.gsc) return sel.gsc
    const cached = ssGet(PROPS_KEY)
    return cached?.gscSites?.[0]?.url || ''
  })

  const [selectedGa4Id, setSelectedGa4Id] = useState<string>(() => {
    const sel = ssGet(SELECTED_KEY)
    if (sel?.ga4) return sel.ga4
    const cached = ssGet(PROPS_KEY)
    return cached?.ga4Properties?.[0]?.id || ''
  })

  useEffect(() => {
    setPropertiesLoading(true)
    fetch(`${SEO_API}/properties`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setPropertiesError(d.error); setPropertiesLoaded(true); return }
        const next = {
          gscSites: Array.isArray(d.gscSites) ? d.gscSites : [],
          ga4Properties: Array.isArray(d.ga4Properties) ? d.ga4Properties : [],
        }
        setProperties(next)
        ssSet(PROPS_KEY, next)
        setSelectedGscSite((prev) => next.gscSites.some((s: { url: string }) => s.url === prev) ? prev : next.gscSites[0]?.url || '')
        setSelectedGa4Id((prev)   => next.ga4Properties.some((p: { id: string }) => p.id === prev) ? prev : next.ga4Properties[0]?.id || '')
        setPropertiesLoaded(true)
      })
      .catch((err: Error) => { setPropertiesError(err.message); setPropertiesLoaded(true) })
      .finally(() => setPropertiesLoading(false))
  }, [])

  useEffect(() => {
    if (selectedGscSite || selectedGa4Id) {
      ssSet(SELECTED_KEY, { gsc: selectedGscSite, ga4: selectedGa4Id })
      window.dispatchEvent(new CustomEvent('seo:site-changed', { detail: { gsc: selectedGscSite } }))
    }
  }, [selectedGscSite, selectedGa4Id])

  // Auto-link GA4 when properties first load (if no saved GA4 selection)
  useEffect(() => {
    if (!selectedGscSite || !properties.ga4Properties.length) return
    const saved = ssGet(SELECTED_KEY)
    if (saved?.ga4 && properties.ga4Properties.some((p) => p.id === saved.ga4)) return // respect valid saved preference
    const match = findBestGa4Match(selectedGscSite, properties.ga4Properties)
    if (match) setSelectedGa4Id(match)
  }, [properties.ga4Properties]) // eslint-disable-line react-hooks/exhaustive-deps

  // Wrapped setter: selecting a GSC site also auto-links the matching GA4 property
  const selectGscSite = useCallback((site: string) => {
    setSelectedGscSite(site)
    const match = findBestGa4Match(site, properties.ga4Properties)
    if (match) setSelectedGa4Id(match)
  }, [properties.ga4Properties])

  function handlePresetChange(idx: number) {
    setSelectedPreset(idx)
    setDateRange(getDateRange(DATE_PRESETS[idx].days))
  }

  const gscOptions = properties.gscSites
    .map((s) => ({ value: s.url, label: s.url.replace(/^https?:\/\//, '').replace(/\/$/, '') }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const ga4Options = properties.ga4Properties
    .map((p) => ({ value: p.id, label: p.name ? `${p.name} (${p.id})` : p.id }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return {
    selectedPreset,
    dateRange,
    loading, setLoading,
    lastUpdated, setLastUpdated,
    propertiesError,
    propertiesLoaded,
    selectedGscSite, setSelectedGscSite: selectGscSite,
    selectedGa4Id,   setSelectedGa4Id,
    gscOptions, ga4Options,
    handlePresetChange,
  }
}
