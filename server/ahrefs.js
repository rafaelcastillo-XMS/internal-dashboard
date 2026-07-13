const AHREFS_BATCH_URL = 'https://api.ahrefs.com/v3/batch-analysis/batch-analysis'

const SNAPSHOT_FIELDS = [
  'domain_rating',
  'ahrefs_rank',
  'org_keywords',
  'org_traffic',
  'backlinks',
  'refdomains',
]

export class AhrefsApiError extends Error {
  constructor(message, upstreamStatus = 502) {
    super(message)
    this.name = 'AhrefsApiError'
    this.upstreamStatus = upstreamStatus
  }
}

export function normalizeAhrefsTarget(value) {
  const raw = String(value ?? '').trim().replace(/^sc-domain:/i, '')
  if (!raw) return ''

  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return parsed.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function publicAhrefsMessage(status) {
  if (status === 401) return 'Ahrefs rejected the API key. Verify AHREFS_API_KEY.'
  if (status === 403) return 'This Ahrefs account does not have access to the requested API data.'
  if (status === 429) return 'Ahrefs API usage limit reached. Try again later.'
  return `Ahrefs API error (${status}).`
}

export async function getAhrefsSnapshot({ apiKey, target, fetchImpl = fetch }) {
  if (!apiKey) throw new AhrefsApiError('AHREFS_API_KEY is not configured.', 503)

  const domain = normalizeAhrefsTarget(target)
  if (!domain) throw new AhrefsApiError('A valid target domain is required.', 400)

  const response = await fetchImpl(AHREFS_BATCH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      select: SNAPSHOT_FIELDS,
      targets: [{ url: domain, mode: 'domain', protocol: 'both' }],
      output: 'json',
    }),
  })

  if (!response.ok) {
    throw new AhrefsApiError(publicAhrefsMessage(response.status), response.status)
  }

  const data = await response.json()
  const row = data?.targets?.[0]
  if (!row) throw new AhrefsApiError('Ahrefs returned no data for this domain.', 502)

  return {
    domain,
    snapshot_date: new Date().toISOString().slice(0, 10),
    domain_rating: row.domain_rating ?? null,
    ahrefs_rank: row.ahrefs_rank ?? null,
    organic_keywords: row.org_keywords ?? null,
    organic_traffic: row.org_traffic ?? null,
    backlinks: row.backlinks ?? null,
    referring_domains: row.refdomains ?? null,
  }
}
