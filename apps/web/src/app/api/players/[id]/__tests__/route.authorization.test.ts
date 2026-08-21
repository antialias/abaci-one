// @vitest-environment node

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isParentOf } from '@/lib/classroom/access-control'

vi.mock('@/db', () => ({
  db: {},
  schema: {},
}))

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (handler: unknown) => handler,
}))

vi.mock('@/lib/viewer', () => ({
  getUserId: vi.fn(async () => 'viewer-1'),
}))

vi.mock('@/lib/classroom/access-control', () => ({
  isParentOf: vi.fn(async () => false),
}))

import { DELETE, PATCH } from '../route'

const isParentOfMock = vi.mocked(isParentOf)
const context = { params: Promise.resolve({ id: 'player-1' }) } as any

describe('player mutation authorization', () => {
  beforeEach(() => {
    isParentOfMock.mockReset()
    isParentOfMock.mockResolvedValue(false)
  })

  it('PATCH delegates to the canonical parent-access rule', async () => {
    const request = new NextRequest('http://localhost/api/players/player-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isArchived: true }),
    })

    const response = await PATCH(request, context)

    expect(response.status).toBe(404)
    expect(isParentOfMock).toHaveBeenCalledWith('viewer-1', 'player-1')
  })

  it('DELETE delegates to the canonical parent-access rule', async () => {
    const request = new NextRequest('http://localhost/api/players/player-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, context)

    expect(response.status).toBe(404)
    expect(isParentOfMock).toHaveBeenCalledWith('viewer-1', 'player-1')
  })
})
