import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMondayTasksForUser, resolveMondayEmail } from './mondayTasks.js'
const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers })
const users = { data: { users: [{ id: '1', name: 'User', email: 'a@example.test' }] } }
const boards = { data: { boards: [] } }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('Monday task reliability', () => {
  it('coalesces concurrent requests and reads cache before querying users', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(users)).mockResolvedValueOnce(response(boards))
    vi.stubGlobal('fetch', fetch)
    const args = { mondayToken: 'cache-test', sessionEmail: 'a@example.test' }
    await Promise.all([fetchMondayTasksForUser(args), fetchMondayTasksForUser(args)])
    await fetchMondayTasksForUser(args)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('retries HTTP 429 then returns data', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockResolvedValueOnce(response({}, 429, { 'retry-after': '1' })).mockResolvedValueOnce(response(users)).mockResolvedValueOnce(response(boards))
    vi.stubGlobal('fetch', fetch)
    const pending = fetchMondayTasksForUser({ mondayToken: 'retry-test', sessionEmail: 'a@example.test' })
    await vi.runAllTimersAsync()
    expect((await pending).tasks).toEqual([])
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it('does not retry an invalid provider token', async () => {
    const fetch = vi.fn().mockResolvedValue(response({}, 401))
    vi.stubGlobal('fetch', fetch)
    await expect(fetchMondayTasksForUser({ mondayToken: 'bad-token', sessionEmail: 'a@example.test' })).rejects.toThrow('HTTP 401')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('rejects missing identity before calling Monday', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(fetchMondayTasksForUser({ mondayToken: 'token', sessionEmail: '' })).rejects.toMatchObject({ statusCode: 401 })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('derives identity from the verified session instead of the query email', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ email: 'verified@example.test' })))
    expect(await resolveMondayEmail({ authorization: 'Bearer session', email: 'other@example.test', supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' })).toBe('verified@example.test')
  })
})

it('excludes subitem boards before querying items and preserves assigned tasks', async () => {
  const item = {
    id: 'task', name: 'Assigned task', state: 'active', updated_at: '2026-10-16',
    column_values: [{ id: 'person', type: 'people', persons_and_teams: [{ id: '1', kind: 'person' }] }],
  }
  const fetch = vi.fn()
    .mockResolvedValueOnce(response(users))
    .mockResolvedValueOnce(response({ data: { boards: [{ id: 'b1', name: 'Work' }, { id: 'b2', name: 'Subitems of Work' }] } }))
    .mockResolvedValueOnce(response({ data: { boards: [{ id: 'b1', name: 'Work', items_page: { items: [item] } }] } }))
  vi.stubGlobal('fetch', fetch)
  const result = await fetchMondayTasksForUser({ mondayToken: 'batch-test', sessionEmail: 'a@example.test' })
  expect(result.tasks.map(t => t.id)).toEqual(['task'])
  expect(JSON.parse(fetch.mock.calls[2][1].body).variables.ids).toEqual(['b1'])
})
