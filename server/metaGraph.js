const GRAPH_URL = 'https://graph.facebook.com/v21.0'

// Fields that work with pages_show_list + pages_read_engagement (Standard Access).
// Reach, impressions and like/comment counts need read_insights and
// pages_read_user_content, which require App Review — see gatedMetrics below.
const PAGE_FIELDS = [
  'name',
  'fan_count',
  'followers_count',
  'talking_about_count',
  'rating_count',
  'category',
  'about',
  'link',
  'picture{url}',
].join(',')

const POST_FIELDS = [
  'id',
  'created_time',
  'message',
  'permalink_url',
  'full_picture',
  'attachments{media_type}',
  'shares',
].join(',')

export class MetaApiError extends Error {
  constructor(message, upstreamStatus = 502) {
    super(message)
    this.name = 'MetaApiError'
    this.upstreamStatus = upstreamStatus
  }
}

async function graphGet(path, params, fetchImpl) {
  const url = new URL(`${GRAPH_URL}/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const response = await fetchImpl(url)
  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.error) {
    const error = payload?.error ?? {}
    const status = error.code === 190 ? 401 : response.status
    throw new MetaApiError(error.message ?? `Meta Graph API error (${response.status}).`, status)
  }
  return payload
}

// Page Insights require a Page Access Token; a System User token is rejected
// with error #190. The page token is derived from the system user token and
// inherits its never-expires lifetime.
async function getPageToken(pageId, accessToken, fetchImpl) {
  const data = await graphGet(pageId, { fields: 'access_token', access_token: accessToken }, fetchImpl)
  if (!data.access_token) {
    throw new MetaApiError('The System User has no access to this Page. Assign it in Business Settings.', 403)
  }
  return data.access_token
}

function mediaType(post) {
  const type = post.attachments?.data?.[0]?.media_type
  if (type === 'photo') return 'Image'
  if (type === 'video') return 'Video'
  if (type === 'album') return 'Carousel'
  return 'Post'
}

// Ad accounts are resolved through the Page's business rather than
// /me/adaccounts: that edge only lists accounts explicitly assigned to the
// System User, and returns empty for accounts the business owns but has not
// assigned. Reading through the business needs business_management + ads_read,
// both of which the System User token already carries.
export async function getAdCampaigns({ accessToken, pageId, since, until, fetchImpl = fetch }) {
  if (!accessToken) throw new MetaApiError('META_ACCESS_TOKEN is not configured.', 503)
  if (!pageId) throw new MetaApiError('META_PAGE_ID is not configured.', 503)

  const pageToken = await getPageToken(pageId, accessToken, fetchImpl)
  const pageInfo = await graphGet(pageId, { fields: 'business', access_token: pageToken }, fetchImpl)
  const businessId = pageInfo.business?.id
  if (!businessId) return { account: null, campaigns: [] }

  const accounts = await graphGet(
    `${businessId}/owned_ad_accounts`,
    { fields: 'id,name,currency', access_token: accessToken },
    fetchImpl,
  )
  const account = accounts.data?.[0]
  if (!account) return { account: null, campaigns: [] }

  const timeRange = since && until ? JSON.stringify({ since, until }) : ''
  const insightFields = 'spend,impressions,clicks,ctr,cpc,reach'
  const params = {
    fields: `name,status,objective,insights.fields(${insightFields})${timeRange ? `.time_range(${timeRange})` : ''}`,
    limit: '50',
    access_token: accessToken,
  }

  const campaigns = await graphGet(`${account.id}/campaigns`, params, fetchImpl)

  // Accounts accumulate dormant campaigns, so surface the ones that actually
  // spent in the window first.
  const sortBySpend = (a, b) => b.spend - a.spend

  return {
    account: { id: account.id, name: account.name ?? '', currency: account.currency ?? '' },
    campaigns: (campaigns.data ?? []).map(campaign => {
      const stats = campaign.insights?.data?.[0] ?? {}
      return {
        id: campaign.id,
        name: campaign.name ?? '',
        status: campaign.status ?? '',
        objective: campaign.objective ?? '',
        spend: Number(stats.spend ?? 0),
        impressions: Number(stats.impressions ?? 0),
        clicks: Number(stats.clicks ?? 0),
        reach: Number(stats.reach ?? 0),
        ctr: Number(stats.ctr ?? 0),
        cpc: Number(stats.cpc ?? 0),
      }
    }).sort(sortBySpend),
  }
}

export async function getFacebookPageSnapshot({ accessToken, pageId, since, until, limit = 25, fetchImpl = fetch }) {
  if (!accessToken) throw new MetaApiError('META_ACCESS_TOKEN is not configured.', 503)
  if (!pageId) throw new MetaApiError('META_PAGE_ID is not configured.', 503)

  const pageToken = await getPageToken(pageId, accessToken, fetchImpl)

  const postParams = { fields: POST_FIELDS, limit: String(limit), access_token: pageToken }
  if (since) postParams.since = since
  if (until) postParams.until = until

  const [page, posts] = await Promise.all([
    graphGet(pageId, { fields: PAGE_FIELDS, access_token: pageToken }, fetchImpl),
    graphGet(`${pageId}/published_posts`, postParams, fetchImpl),
  ])

  return {
    page: {
      id: pageId,
      name: page.name ?? '',
      followers: page.followers_count ?? page.fan_count ?? null,
      fans: page.fan_count ?? null,
      talkingAbout: page.talking_about_count ?? null,
      ratingCount: page.rating_count ?? null,
      category: page.category ?? '',
      about: page.about ?? '',
      link: page.link ?? '',
      picture: page.picture?.data?.url ?? '',
    },
    posts: (posts.data ?? []).map(post => ({
      id: post.id,
      date: post.created_time,
      type: mediaType(post),
      message: post.message ?? '',
      permalink: post.permalink_url ?? '',
      image: post.full_picture ?? '',
      shares: post.shares?.count ?? 0,
    })),
    // Surfaced so the UI can explain empty cards instead of showing fake numbers.
    gatedMetrics: {
      reason: 'Requires Meta App Review',
      permissions: ['read_insights', 'pages_read_user_content'],
      metrics: ['reach', 'impressions', 'pageViews', 'likes', 'comments', 'reactions'],
    },
    fetchedAt: new Date().toISOString(),
  }
}
