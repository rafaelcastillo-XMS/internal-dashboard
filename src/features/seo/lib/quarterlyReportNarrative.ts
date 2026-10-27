export function describeClicksTrend(delta: number) {
  if (delta > 0) return `an increase of ${delta}%`
  if (delta < 0) return `a change of ${delta}%, highlighting an opportunity to strengthen qualified organic reach`
  return 'a stable result'
}

export function describePositionTrend(delta: number) {
  if (delta > 0) return `improved by ${delta} positions on average`
  if (delta < 0) return `shows an opportunity to recover ${Math.abs(delta)} positions on average`
  return 'held steady'
}

export function getSiteSpeedLabel(score: number) {
  if (score >= 90) return 'Strong experience'
  if (score >= 50) return 'Optimization opportunity'
  return 'Priority optimization opportunity'
}

export function getAuditStatusLabel(status: string) {
  if (status === 'completed') return 'Audit completed'
  if (status === 'error') return 'Audit ready for follow-up'
  return 'Audit in progress'
}
