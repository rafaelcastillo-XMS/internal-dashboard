export interface SemFinding {
  area: 'account' | 'search_terms' | 'ads_assets' | 'tracking' | 'landing_pages'
  title: string
  evidence: string
  whyItMatters: string
  recommendation: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
  requiresClientApproval: boolean
}

export interface SemAnalysis {
  analysis: string
  findings: SemFinding[]
  notVerified: string[]
  followUpQuestion: string
}

export function isSemAnalysis(value: unknown): value is SemAnalysis {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.analysis === 'string' && !!v.analysis.trim() &&
    typeof v.followUpQuestion === 'string' && !!v.followUpQuestion.trim() &&
    Array.isArray(v.notVerified) && v.notVerified.every(item => typeof item === 'string') &&
    Array.isArray(v.findings) && v.findings.length <= 5 && v.findings.every(item => {
      if (!item || typeof item !== 'object') return false
      const f = item as Record<string, unknown>
      return ['title', 'evidence', 'whyItMatters', 'recommendation'].every(key => typeof f[key] === 'string' && !!(f[key] as string).trim()) &&
        ['account', 'search_terms', 'ads_assets', 'tracking', 'landing_pages'].includes(String(f.area)) &&
        ['critical', 'high', 'medium', 'low'].includes(String(f.severity)) &&
        ['low', 'medium', 'high'].includes(String(f.effort)) && typeof f.requiresClientApproval === 'boolean'
    })
}
