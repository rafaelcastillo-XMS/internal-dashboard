export interface FacebookPageInfo {
  id: string
  name: string
  followers: number | null
  fans: number | null
  talkingAbout: number | null
  ratingCount: number | null
  category: string
  about: string
  link: string
  picture: string
}

export interface FacebookPost {
  id: string
  date: string
  type: string
  message: string
  permalink: string
  image: string
  shares: number
}

export interface FacebookPageSnapshot {
  page: FacebookPageInfo
  posts: FacebookPost[]
  gatedMetrics: {
    reason: string
    permissions: string[]
    metrics: string[]
  }
  fetchedAt: string
}

export class MetaApiError extends Error {
  upstreamStatus: number
}

export function getFacebookPageSnapshot(options: {
  accessToken: string
  pageId: string
  since?: string
  until?: string
  limit?: number
  fetchImpl?: typeof fetch
}): Promise<FacebookPageSnapshot>
