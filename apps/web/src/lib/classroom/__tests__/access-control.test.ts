// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  playerFindFirst: vi.fn(),
  parentChildFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: {
    query: {
      players: { findFirst: dbMocks.playerFindFirst },
      parentChild: { findFirst: dbMocks.parentChildFindFirst },
      users: { findFirst: dbMocks.userFindFirst },
    },
  },
}))

import { isParentOf } from '../access-control'

describe('isParentOf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.playerFindFirst.mockResolvedValue({ userId: 'owner-1' })
    dbMocks.parentChildFindFirst.mockResolvedValue(null)
    dbMocks.userFindFirst.mockResolvedValue({ upgradedAt: new Date() })
  })

  it('always allows the direct owner', async () => {
    await expect(isParentOf('owner-1', 'player-1')).resolves.toBe(true)
    expect(dbMocks.parentChildFindFirst).not.toHaveBeenCalled()
  })

  it('allows a linked authenticated parent', async () => {
    dbMocks.parentChildFindFirst.mockResolvedValue({ linkedAt: new Date(0) })

    await expect(isParentOf('parent-1', 'player-1')).resolves.toBe(true)
  })

  it('allows a recent link for a guest parent', async () => {
    dbMocks.parentChildFindFirst.mockResolvedValue({ linkedAt: new Date(Date.now() - 60_000) })
    dbMocks.userFindFirst.mockResolvedValue({ upgradedAt: null })

    await expect(isParentOf('guest-1', 'player-1')).resolves.toBe(true)
  })

  it('rejects an expired link for a guest parent', async () => {
    dbMocks.parentChildFindFirst.mockResolvedValue({
      linkedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    })
    dbMocks.userFindFirst.mockResolvedValue({ upgradedAt: null })

    await expect(isParentOf('guest-1', 'player-1')).resolves.toBe(false)
  })
})
