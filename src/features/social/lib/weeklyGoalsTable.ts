import { supabase } from '@/lib/supabase'
import { GOAL_LABELS, type GoalMetric, type WeeklyGoal } from './weeklyGoals'

const METRICS = Object.keys(GOAL_LABELS) as GoalMetric[]

export async function fetchWeeklyGoals(clientId: string): Promise<WeeklyGoal[]> {
    const { data, error } = await supabase
        .from('social_weekly_goals')
        .select('metric, target')
        .eq('client_id', clientId)

    if (error) throw error

    const saved = new Map((data ?? []).map(row => [row.metric as GoalMetric, row.target as number]))
    // Always return every metric so a client with no rows yet still renders the
    // full plan, with untracked goals sitting at zero.
    return METRICS.map(metric => ({ metric, target: saved.get(metric) ?? 0 }))
}

export async function saveWeeklyGoal(clientId: string, metric: GoalMetric, target: number): Promise<void> {
    const { error } = await supabase
        .from('social_weekly_goals')
        .upsert(
            { client_id: clientId, metric, target, updated_at: new Date().toISOString() },
            { onConflict: 'client_id,metric' },
        )

    if (error) throw error
}
