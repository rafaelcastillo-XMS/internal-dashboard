export const DATE_PRESETS = [
  { label: '7d',  days: 7  },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export type SocialPlatform = 'instagram' | 'youtube' | 'facebook' | 'tiktok' | 'linkedin'

export const PLATFORMS: { id: SocialPlatform; label: string; color: string; bg: string }[] = [
  { id: 'facebook',  label: 'Facebook',  color: '#1877F2', bg: 'bg-[#1877F2]' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C', bg: 'bg-[#E1306C]' },
  { id: 'youtube',   label: 'YouTube',   color: '#FF0000', bg: 'bg-[#FF0000]' },
  { id: 'tiktok',    label: 'TikTok',    color: '#010101', bg: 'bg-[#010101]' },
  { id: 'linkedin',  label: 'LinkedIn',  color: '#0A66C2', bg: 'bg-[#0A66C2]' },
]

export const ACCOUNT_OPTIONS = [
  { value: 'xms-ai', label: 'XMS Ai' },
]

export function getDateRange(days: number) {
  const end   = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { startDate: fmt(start), endDate: fmt(end) }
}
