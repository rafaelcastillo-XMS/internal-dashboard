import { describe, expect, it } from 'vitest'
import { completedCount, goalProgress, postsThisWeek, startOfWeek } from './weeklyGoals'
import type { FbPost } from '../hooks/useFacebookData'

function post(date: string, type = 'Image', shares = 0): FbPost {
    return { id: date, date, type, message: '', permalink: '', image: '', shares }
}

// Wednesday 2026-07-29, so the week runs Mon 2026-07-27 → Sun 2026-08-02.
const WEDNESDAY = new Date('2026-07-29T10:00:00')

describe('startOfWeek', () => {
    it('returns Monday for a midweek date', () => {
        expect(startOfWeek(WEDNESDAY).toISOString().slice(0, 10)).toBe('2026-07-27')
    })

    it('treats Sunday as the end of the week that began six days earlier', () => {
        const sunday = new Date('2026-08-02T23:00:00')
        expect(startOfWeek(sunday).toISOString().slice(0, 10)).toBe('2026-07-27')
    })

    it('returns the same day for a Monday', () => {
        const monday = new Date('2026-07-27T08:00:00')
        expect(startOfWeek(monday).toISOString().slice(0, 10)).toBe('2026-07-27')
    })
})

describe('postsThisWeek', () => {
    it('keeps posts from Monday onward and drops earlier ones', () => {
        const posts = [
            post('2026-07-26T12:00:00+0000'), // Sunday, previous week
            post('2026-07-27T09:00:00+0000'), // Monday, boundary
            post('2026-07-29T09:00:00+0000'),
        ]
        expect(postsThisWeek(posts, WEDNESDAY).map(p => p.id)).toEqual([
            '2026-07-27T09:00:00+0000',
            '2026-07-29T09:00:00+0000',
        ])
    })

    it('ignores unparseable dates instead of counting them', () => {
        expect(postsThisWeek([post('not-a-date')], WEDNESDAY)).toHaveLength(0)
    })
})

describe('goalProgress', () => {
    const posts = [
        post('2026-07-27T09:00:00+0000', 'Image', 2),
        post('2026-07-28T09:00:00+0000', 'Video', 3),
        post('2026-07-20T09:00:00+0000', 'Video', 99), // previous week, must not count
    ]

    it('counts posts, videos and shares within the current week only', () => {
        const progress = goalProgress(
            [{ metric: 'posts', target: 3 }, { metric: 'videos', target: 1 }, { metric: 'shares', target: 5 }],
            posts,
            WEDNESDAY,
        )
        expect(progress.map(p => p.actual)).toEqual([2, 1, 5])
        expect(progress.map(p => p.done)).toEqual([false, true, true])
        expect(completedCount(progress)).toBe(2)
    })

    it('does not mark an untracked goal as complete', () => {
        const [goal] = goalProgress([{ metric: 'posts', target: 0 }], [], WEDNESDAY)
        expect(goal.actual).toBe(0)
        expect(goal.done).toBe(false)
    })
})
