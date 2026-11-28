/**
 * @vitest-environment node
 *
 * The demo task routes file the task under its starter (so the starter can
 * follow it over the socket, `task-socket-access.ts`), and a visitor with no
 * viewer session (`getUserId` throws for `unknown`) starts an ownerless task
 * instead of a 500.
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createTask, getUserId } = vi.hoisted(() => ({
  createTask: vi.fn(async (..._args: unknown[]) => 'task-1'),
  getUserId: vi.fn(async (): Promise<string> => ''),
}))
vi.mock('@/lib/task-manager', () => ({ createTask }))
vi.mock('@/lib/viewer', () => ({ getUserId }))
vi.mock('@/lib/auth/withAuth', () => ({
  withAuth:
    (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest) =>
      handler(req, { userId: '', userEmail: null, userRole: 'guest', params: Promise.resolve({}) }),
}))

import { POST as refinePOST } from '../refine/route'
import { POST as taskPOST } from '../task/route'

const post = (path: string, body: unknown) =>
  new NextRequest(`http://localhost${path}`, { method: 'POST', body: JSON.stringify(body) })

const routes = [
  ['demo/task', () => taskPOST(post('/api/demo/task', { duration: 1 }))],
  [
    'demo/refine',
    () =>
      refinePOST(
        post('/api/demo/refine', {
          constantId: 'pi',
          startProgress: 0,
          endProgress: 1,
          prompt: 'x',
          selectedSegments: [],
        })
      ),
  ],
] as const

beforeEach(() => {
  createTask.mockClear()
  getUserId.mockReset()
  vi.stubEnv('NODE_ENV', 'development')
})

describe.each(routes)('%s: the task owner', (_name, call) => {
  it('is the viewer when there is one', async () => {
    getUserId.mockResolvedValue('user-1')
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ taskId: 'task-1' })
    expect(createTask.mock.calls[0][3]).toBe('user-1')
  })

  it('is none for an unknown viewer, not a 500', async () => {
    getUserId.mockRejectedValue(new Error('No valid viewer session found'))
    const res = await call()
    expect(res.status).toBe(200)
    expect(createTask).toHaveBeenCalledTimes(1)
    expect(createTask.mock.calls[0][3]).toBeUndefined()
  })
})
