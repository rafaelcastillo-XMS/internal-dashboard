import type { Campaign } from '@/features/social/hooks/useFacebookData'

export interface CampaignHealth {
  score: number
  label: 'Healthy' | 'Needs attention' | 'At risk' | 'Not delivering'
  reasons: string[]
}

// A transparent, client-side heuristic — not an official Meta metric. Built
// only from numbers already shown in the table (CTR, clicks, status), so the
// score can always be explained back to the person reading it.
export function computeCampaignHealth(campaign: Campaign): CampaignHealth {
  const reasons: string[] = []

  if (campaign.impressions === 0) {
    return {
      score: 0,
      label: 'Not delivering',
      reasons: ['No impressions in this date range — the campaign is not serving ads.'],
    }
  }

  let score = 50

  if (campaign.ctr >= 1) {
    score += 25
    reasons.push(`CTR of ${campaign.ctr.toFixed(2)}% is at or above the ~1% rule-of-thumb benchmark for Meta ads.`)
  } else if (campaign.ctr >= 0.5) {
    score += 5
    reasons.push(`CTR of ${campaign.ctr.toFixed(2)}% is below 1% but not critical yet.`)
  } else {
    score -= 15
    reasons.push(`CTR of ${campaign.ctr.toFixed(2)}% is low — creative or targeting may need a refresh.`)
  }

  if (campaign.clicks === 0) {
    score -= 20
    reasons.push('No clicks recorded in this date range.')
  }

  if (campaign.status === 'ACTIVE') {
    score += 10
  } else {
    score -= 10
    reasons.push('Campaign is currently paused.')
  }

  score = Math.max(0, Math.min(100, score))
  const label = score >= 70 ? 'Healthy' : score >= 40 ? 'Needs attention' : 'At risk'
  return { score, label, reasons }
}
