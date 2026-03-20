import { useState, useEffect } from 'react'
import { useTrackPageLoading } from '@/context/PageLoadingContext'

export const DATE_PRESETS = [
  { label: '7d',  days: 7  },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export type SocialPlatform = 'instagram' | 'youtube' | 'facebook' | 'tiktok' | 'linkedin'

export const PLATFORMS: { id: SocialPlatform; label: string; color: string; bg: string }[] = [
  { id: 'instagram', label: 'Instagram', color: '#E1306C', bg: 'bg-[#E1306C]' },
  { id: 'youtube',   label: 'YouTube',   color: '#FF0000', bg: 'bg-[#FF0000]' },
  { id: 'facebook',  label: 'Facebook',  color: '#1877F2', bg: 'bg-[#1877F2]' },
  { id: 'tiktok',    label: 'TikTok',    color: '#010101', bg: 'bg-[#010101]' },
  { id: 'linkedin',  label: 'LinkedIn',  color: '#0A66C2', bg: 'bg-[#0A66C2]' },
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

export const SOCIAL_API = '/api/social'

export const ACCOUNT_OPTIONS = [
  { value: 'xms-demo', label: 'XMS Demo Account' },
]

const SELECTED_KEY = 'xms_social_selected'

function ssGet(key: string) {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') } catch { return null }
}
function ssSet(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export function useSocialDashboardState(defaultPreset = 1) {
  const [selectedPreset, setSelectedPreset]       = useState(defaultPreset)
  const [dateRange, setDateRange]                 = useState(getDateRange(DATE_PRESETS[defaultPreset].days))
  const [loading, setLoading]                     = useState(false)
  const [lastUpdated, setLastUpdated]             = useState<Date | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState(ACCOUNT_OPTIONS[0].value)

  const [selectedPlatforms, setSelectedPlatformsRaw] = useState<SocialPlatform[]>(() => {
    const saved = ssGet(SELECTED_KEY)
    return saved?.platforms ?? ['instagram', 'youtube', 'facebook', 'tiktok', 'linkedin']
  })

  useTrackPageLoading(loading, 'social-data')

  useEffect(() => {
    ssSet(SELECTED_KEY, { platforms: selectedPlatforms })
    window.dispatchEvent(new CustomEvent('social:platforms-changed', { detail: { platforms: selectedPlatforms } }))
  }, [selectedPlatforms])

  function togglePlatform(p: SocialPlatform) {
    setSelectedPlatformsRaw((prev) => {
      if (prev.includes(p)) {
        if (prev.length === 1) return prev // keep at least one
        return prev.filter((x) => x !== p)
      }
      return [...prev, p]
    })
  }

  function handlePresetChange(idx: number) {
    setSelectedPreset(idx)
    setDateRange(getDateRange(DATE_PRESETS[idx].days))
  }

  return {
    selectedPreset,
    dateRange,
    loading, setLoading,
    lastUpdated, setLastUpdated,
    selectedPlatforms,
    togglePlatform,
    handlePresetChange,
    selectedAccountId, setSelectedAccountId,
    accountOptions: ACCOUNT_OPTIONS,
  }
}
