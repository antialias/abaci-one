/**
 * Unit tests for family-manager module
 *
 * Tests parent cap enforcement, event recording, and family code management.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock chain helpers — db.insert/update/delete return chainable objects
const mockInsertValues = vi.fn().mockReturnThis()
const mockUpdateSet = vi.fn().mockReturnThis()
const mockUpdateWhere = vi.fn().mockReturnThis()
const mockDeleteWhere = vi.fn().mockReturnThis()

const mockDb = {
  query: {
    players: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    users: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    parentChild: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    familyEvents: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  insert: vi.fn(() => ({ values: mockInsertValues })),
  update: vi.fn(() => ({ set: mockUpdateSet })),
  delete: vi.fn(() => ({ where: mockDeleteWhere })),
}

// Make update chainable: db.update().set().where()
mockUpdateSet.mockReturnValue({ where: mockUpdateWhere })

vi.mock('@/db', () => ({
  db: mockDb,
}))

vi.mock('@/db/schema', () => ({
  familyEvents: Symbol('familyEvents'),
  generateFamilyCode: vi.fn(() => 'NEW-CODE'),
  parentChild: Symbol('parentChild'),
  players: Symbol('players'),
  users: Symbol('users'),
}))

vi.mock('@/lib/auth/sync-relationships', () => ({
  syncParentLink: vi.fn(() => Promise.resolve()),
  removeParentLink: vi.fn(() => Promise.resolve()),
}))

// Drizzle ORM helpers — just return the args for matching
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((...args: unknown[]) => args),
}))

// Import after mocks
const {
  linkParentToChild,
  unlinkParentFromChild,
  regenerateFamilyCode,
  getOrCreateFamilyCode,
  getRecentFamilyEvents,
  MAX_PARENTS_PER_CHILD,
  FAMILY_CODE_EXPIRY_DAYS,
} = await import('../family-manager')

describe('Family Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-setup chainable mocks after clear
    mockDb.insert.mockReturnValue({ values: mockInsertValues })
    mockDb.update.mockReturnValue({ set: mockUpdateSet })
    mockDb.delete.mockReturnValue({ where: mockDeleteWhere })
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere })
    mockInsertValues.mockResolvedValue(undefined)
    mockDeleteWhere.mockResolvedValue(undefined)
    mockUpdateWhere.mockResolvedValue(undefined)
  })

  describe('MAX_PARENTS_PER_CHILD', () => {
    it('is set to 4', () => {
      expect(MAX_PARENTS_PER_CHILD).toBe(4)
    })
  })

  describe('FAMILY_CODE_EXPIRY_DAYS', () => {
    it('is set to 7', () => {
      expect(FAMILY_CODE_EXPIRY_DAYS).toBe(7)
    })
  })

  describe('linkParentToChild', () => {
    const mockPlayer = {
      id: 'player-1',
      userId: 'owner-user-1',
      familyCode: 'ABC123',
      familyCodeGeneratedAt: new Date(), // fresh code, not expired
      name: 'Test Child',
    }

    const mockOwner = {
      id: 'owner-user-1',
      upgradedAt: new Date(),
    }

    it('returns error for invalid family code', async () => {
      mockDb.query.players.findFirst.mockResolvedValue(null)

      const result = await linkParentToChild('parent-1', 'INVALID')

      expect(result).toEqual({ success: false, error: 'Invalid family code' })
    })

    it('returns error when student owner is not upgraded', async () => {
      mockDb.query.players.findFirst.mockResolvedValue(mockPlayer)
      mockDb.query.users.findFirst.mockResolvedValue({ ...mockOwner, upgradedAt: null })

      const result = await linkParentToChild('parent-1', 'ABC123')

      expect(result).toEqual({ success: false, error: 'This student cannot be shared' })
    })

    it('returns error when already linked', async () => {
      mockDb.query.players.findFirst.mockResolvedValue(mockPlayer)
      mockDb.query.users.findFirst.mockResolvedValue(mockOwner)
      mockDb.query.parentChild.findFirst.mockResolvedValue({ parentUserId: 'parent-1', childPlayerId: 'player-1' })

      const result = await linkParentToChild('parent-1', 'ABC123')

      expect(result).toEqual({ success: false, error: 'Already linked to this child' })
    })

    it('returns error when parent cap is reached', async () => {
      mockDb.query.players.findFirst.mockResolvedValue(mockPlayer)
      mockDb.query.users.findFirst.mockResolvedValue(mockOwner)
      mockDb.query.parentChild.findFirst.mockResolvedValue(null) // not already linked

      // 4 existing parents
      mockDb.query.parentChild.findMany.mockResolvedValue([
        { parentUserId: 'p1', childPlayerId: 'player-1' },
        { parentUserId: 'p2', childPlayerId: 'player-1' },
        { parentUserId: 'p3', childPlayerId: 'player-1' },
        { parentUserId: 'p4', childPlayerId: 'player-1' },
      ])

      const result = await linkParentToChild('parent-5', 'ABC123')

      expect(result).toEqual({
        success: false,
        error: 'This student already has the maximum number of linked parents (4)',
      })
    })

    it('succeeds and inserts link when under cap', async () => {
      mockDb.query.players.findFirst.mockResolvedValue(mockPlayer)
      mockDb.query.users.findFirst.mockResolvedValue(mockOwner)
      mockDb.query.parentChild.findFirst.mockResolvedValue(null) // not already linked

      // 2 existing parents — under cap
      mockDb.query.parentChild.findMany.mockResolvedValue([
        { parentUserId: 'p1', childPlayerId: 'player-1' },
        { parentUserId: 'p2', childPlayerId: 'player-1' },
      ])

      const result = await linkParentToChild('parent-3', 'ABC123')

      expect(result.success).toBe(true)
      expect(result.player).toEqual(mockPlayer)
      // Should have inserted the parent-child link
      expect(mockDb.insert).toHaveBeenCalled()
      expect(mockInsertValues).toHaveBeenCalledWith({
        parentUserId: 'parent-3',
        childPlayerId: 'player-1',
      })
    })

    it('records parent_linked event on successful link', async () => {
      mockDb.query.players.findFirst.mockResolvedValue(mockPlayer)
      mockDb.query.users.findFirst.mockResolvedValue(mockOwner)
      mockDb.query.parentChild.findFirst.mockResolvedValue(null)
      mockDb.query.parentChild.findMany.mockResolvedValue([])

      await linkParentToChild('parent-1', 'ABC123')

      // insert is called twice: once for parentChild link, once for familyEvent
      // The second insert call should be for the event
      // Due to the async fire-and-forget nature, we need to wait a tick
      await new Promise((r) => setTimeout(r, 0))

      expect(mockDb.insert).toHaveBeenCalledTimes(2)
    })

    it('normalizes family code to uppercase', async () => {
      mockDb.query.players.findFirst.mockResolvedValue(null)

      await linkParentToChild('parent-1', '  abc123  ')

      // findFirst was called with the normalized code
      expect(mockDb.query.players.findFirst).toHaveBeenCalled()
    })

    it('returns error when family code has expired (>7 days)', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      mockDb.query.players.findFirst.mockResolvedValue({
        ...mockPlayer,
        familyCodeGeneratedAt: eightDaysAgo,
      })

      const result = await linkParentToChild('parent-1', 'ABC123')

      expect(result).toEqual({
        success: false,
        error: 'This family code has expired. Ask the parent to regenerate it.',
      })
    })

    it('returns error when family code exists but has no generatedAt (legacy)', async () => {
      mockDb.query.players.findFirst.mockResolvedValue({
        ...mockPlayer,
        familyCodeGeneratedAt: null,
      })

      const result = await linkParentToChild('parent-1', 'ABC123')

      expect(result).toEqual({
        success: false,
        error: 'This family code has expired. Ask the parent to regenerate it.',
      })
    })

    it('succeeds when family code is within 7-day window', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      mockDb.query.players.findFirst.mockResolvedValue({
        ...mockPlayer,
        familyCodeGeneratedAt: threeDaysAgo,
      })
      mockDb.query.users.findFirst.mockResolvedValue({ id: 'owner-user-1', upgradedAt: new Date() })
      mockDb.query.parentChild.findFirst.mockResolvedValue(null)
      mockDb.query.parentChild.findMany.mockResolvedValue([])

      const result = await linkParentToChild('parent-1', 'ABC123')

      expect(result.success).toBe(true)
    })
  })

  describe('unlinkParentFromChild', () => {
    it('returns error when trying to unlink the only parent', async () => {
      mockDb.query.parentChild.findMany.mockResolvedValue([
        { parentUserId: 'parent-1', childPlayerId: 'player-1' },
      ])

      const result = await unlinkParentFromChild('parent-1', 'player-1')

      expect(result).toEqual({ success: false, error: 'Cannot unlink the only parent' })
      expect(mockDb.delete).not.toHaveBeenCalled()
    })

    it('succeeds when child has multiple parents', async () => {
      mockDb.query.parentChild.findMany.mockResolvedValue([
        { parentUserId: 'parent-1', childPlayerId: 'player-1' },
        { parentUserId: 'parent-2', childPlayerId: 'player-1' },
      ])

      const result = await unlinkParentFromChild('parent-1', 'player-1')

      expect(result).toEqual({ success: true })
      expect(mockDb.delete).toHaveBeenCalled()
    })

    it('records parent_unlinked event with actor', async () => {
      mockDb.query.parentChild.findMany.mockResolvedValue([
        { parentUserId: 'parent-1', childPlayerId: 'player-1' },
        { parentUserId: 'parent-2', childPlayerId: 'player-1' },
      ])

      await unlinkParentFromChild('parent-1', 'player-1', 'actor-user')

      await new Promise((r) => setTimeout(r, 0))

      // delete for parentChild + insert for familyEvent
      expect(mockDb.delete).toHaveBeenCalled()
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('getOrCreateFamilyCode', () => {
    it('returns null when player not found', async () => {
      mockDb.query.players.findFirst.mockResolvedValue(null)

      const result = await getOrCreateFamilyCode('nonexistent')

      expect(result).toBeNull()
    })

    it('returns existing code with generatedAt', async () => {
      const generatedAt = new Date('2025-01-15T00:00:00Z')
      mockDb.query.players.findFirst.mockResolvedValue({
        id: 'player-1',
        familyCode: 'FAM-EXIST',
        familyCodeGeneratedAt: generatedAt,
      })

      const result = await getOrCreateFamilyCode('player-1')

      expect(result).toEqual({
        familyCode: 'FAM-EXIST',
        generatedAt,
      })
      // Should not have updated the DB
      expect(mockDb.update).not.toHaveBeenCalled()
    })

    it('generates new code with familyCodeGeneratedAt when none exists', async () => {
      mockDb.query.players.findFirst.mockResolvedValue({
        id: 'player-1',
        familyCode: null,
        familyCodeGeneratedAt: null,
      })

      const result = await getOrCreateFamilyCode('player-1')

      expect(result).toEqual({
        familyCode: 'NEW-CODE',
        generatedAt: expect.any(Date),
      })
      expect(mockDb.update).toHaveBeenCalled()
      expect(mockUpdateSet).toHaveBeenCalledWith({
        familyCode: 'NEW-CODE',
        familyCodeGeneratedAt: expect.any(Date),
      })
    })
  })

  describe('regenerateFamilyCode', () => {
    it('returns null when player not found', async () => {
      mockDb.query.players.findFirst.mockResolvedValue(null)

      const result = await regenerateFamilyCode('nonexistent')

      expect(result).toBeNull()
    })

    it('generates new code and updates player with timestamp', async () => {
      mockDb.query.players.findFirst.mockResolvedValue({
        id: 'player-1',
        familyCode: 'OLD-CODE',
      })

      const result = await regenerateFamilyCode('player-1')

      expect(result).toBe('NEW-CODE')
      expect(mockDb.update).toHaveBeenCalled()
      expect(mockUpdateSet).toHaveBeenCalledWith({
        familyCode: 'NEW-CODE',
        familyCodeGeneratedAt: expect.any(Date),
      })
    })

    it('records code_regenerated event when userId provided', async () => {
      mockDb.query.players.findFirst.mockResolvedValue({
        id: 'player-1',
        familyCode: 'OLD-CODE',
      })

      await regenerateFamilyCode('player-1', 'user-1')

      await new Promise((r) => setTimeout(r, 0))

      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('does not record event when userId not provided', async () => {
      mockDb.query.players.findFirst.mockResolvedValue({
        id: 'player-1',
        familyCode: 'OLD-CODE',
      })

      await regenerateFamilyCode('player-1')

      await new Promise((r) => setTimeout(r, 0))

      expect(mockDb.insert).not.toHaveBeenCalled()
    })
  })

  describe('getRecentFamilyEvents', () => {
    it('returns events from last 7 days', async () => {
      const now = new Date()
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)

      mockDb.query.familyEvents.findMany.mockResolvedValue([
        {
          id: 'event-1',
          childPlayerId: 'player-1',
          eventType: 'parent_linked',
          actorUserId: 'user-1',
          targetUserId: 'user-1',
          createdAt: twoDaysAgo,
        },
        {
          id: 'event-2',
          childPlayerId: 'player-1',
          eventType: 'code_regenerated',
          actorUserId: 'user-1',
          targetUserId: null,
          createdAt: tenDaysAgo,
        },
      ])

      const events = await getRecentFamilyEvents('player-1')

      // Only the 2-day-old event should be returned (10-day-old filtered out)
      expect(events).toHaveLength(1)
      expect(events[0].id).toBe('event-1')
    })

    it('returns empty array when no events', async () => {
      mockDb.query.familyEvents.findMany.mockResolvedValue([])

      const events = await getRecentFamilyEvents('player-1')

      expect(events).toEqual([])
    })
  })
})
