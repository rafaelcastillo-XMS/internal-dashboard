type BudgetSpendSearch = (accountId: string, query: string, pageToken?: string) => Promise<{
  results?: { metrics?: { costMicros?: string | number } }[]
  nextPageToken?: string
}>

// Budget reports use a small, uncapped cost query, including historical spend
// from paused/removed campaigns. Channel separation avoids counting LSA twice.
export async function fetchBudgetSpend(params: URLSearchParams, search: BudgetSpendSearch) {
  const accountId = (params.get('accountId') ?? '').replace(/-/g, '')
  const startDate = params.get('startDate') ?? ''
  const endDate = params.get('endDate') ?? ''
  const platform = params.get('platform')
  if (!/^\d{10}$/.test(accountId) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate || !['ads', 'guarantee'].includes(platform ?? '')) {
    throw new Error('Invalid budget spend parameters')
  }
  const query = `SELECT metrics.cost_micros FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    AND campaign.advertising_channel_type ${platform === 'guarantee' ? '=' : '!='} 'LOCAL_SERVICES'`
  let micros = 0
  let pageToken: string | undefined
  const cursors = new Set<string>()
  do {
    const page = await search(accountId, query, pageToken)
    for (const row of page.results ?? []) {
      const value = Number(row.metrics?.costMicros ?? 0)
      if (!Number.isFinite(value)) throw new Error('Invalid spend returned by Google Ads')
      micros += value
    }
    pageToken = page.nextPageToken
    if (pageToken && cursors.has(pageToken)) throw new Error('Invalid Google Ads pagination')
    if (pageToken) cursors.add(pageToken)
  } while (pageToken)
  return { spend: Math.round(micros / 10000) / 100, dateRange: { start: startDate, end: endDate }, platform }
}

