export function askDashboardAi(input: { query: string; context?: Record<string, unknown> }): Promise<{ response: string }>

export function getTaskInsight(input: {
  task: { name: string; status?: string; priority?: string; dueDate?: string; board?: string }
  updates?: { createdAt: string; creatorName: string; body: string }[]
}): Promise<{ insight: string }>

export function getSemInsights(input: {
  accountName: string
  summary?: Record<string, number>
  campaigns?: Record<string, unknown>[]
}): Promise<Record<string, unknown>>

export function getSeoInsights(input: {
  clientName?: string
  gscSite: string
  gsc?: Record<string, unknown>
  ga4?: Record<string, unknown>
  psiScore?: number | null
}): Promise<Record<string, unknown>>

export function getSocialInsights(input: {
  accountName?: string
  platforms: string[]
  metrics?: Record<string, number>
  posts?: Record<string, unknown>[]
}): Promise<Record<string, unknown>>
