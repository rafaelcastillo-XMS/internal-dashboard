import type { FbPost } from '../hooks/useFacebookData'

export type GoalMetric = 'posts' | 'videos' | 'shares'

export interface WeeklyGoal {
    metric: GoalMetric
    target: number
}

export interface GoalProgress extends WeeklyGoal {
    label: string
    actual: number
    done: boolean
}

export const GOAL_LABELS: Record<GoalMetric, string> = {
    posts:  'Publish posts',
    videos: 'Publish videos or reels',
    shares: 'Earn shares',
}

/** Monday 00:00 of the week containing `now`, in local time. */
export function startOfWeek(now: Date): Date {
    const start = new Date(now)
    // getDay() is 0 for Sunday, which belongs to the week that began 6 days earlier.
    const daysSinceMonday = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - daysSinceMonday)
    start.setHours(0, 0, 0, 0)
    return start
}

export function postsThisWeek(posts: FbPost[], now: Date): FbPost[] {
    const from = startOfWeek(now).getTime()
    return posts.filter(post => {
        const time = new Date(post.date).getTime()
        return !Number.isNaN(time) && time >= from
    })
}

export function goalProgress(goals: WeeklyGoal[], posts: FbPost[], now: Date): GoalProgress[] {
    const week = postsThisWeek(posts, now)

    const actualFor = (metric: GoalMetric): number => {
        if (metric === 'posts')  return week.length
        if (metric === 'videos') return week.filter(p => p.type === 'Video').length
        return week.reduce((sum, p) => sum + p.shares, 0)
    }

    return goals.map(goal => {
        const actual = actualFor(goal.metric)
        return {
            ...goal,
            label: GOAL_LABELS[goal.metric],
            actual,
            // A target of 0 means "not tracked", which should not read as complete.
            done: goal.target > 0 && actual >= goal.target,
        }
    })
}

export function completedCount(progress: GoalProgress[]): number {
    return progress.filter(p => p.done).length
}
