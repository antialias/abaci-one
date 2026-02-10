import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import {
  applyGameMove,
  createArcadeSession,
  deleteArcadeSession,
  getArcadeSession,
  updateSessionActivity,
} from '../session-manager'
import type { GameMove } from '../validation'

// Mock the database
vi.mock('@/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      arcadeRooms: {
        findFirst: vi.fn(),
      },
      roomMembers: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      players: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
        onConflictDoNothing: vi.fn(),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
  },
  schema: {
    users: { guestId: {}, id: {} },
    arcadeSessions: { userId: {}, roomId: {}, version: {} },
    arcadeRooms: { id: {} },
    roomMembers: { roomId: {}, userId: {} },
  },
}))

// Mock the validators module (where getValidator is exported from)
vi.mock('../validators', async () => {
  const actual = await vi.importActual('../validators')
  return {
    ...actual,
    getValidator: vi.fn(() => ({
      validateMove: vi.fn((state, _move) => ({
        valid: true,
        newState: { ...state, validated: true },
      })),
      getInitialState: vi.fn(),
    })),
  }
})

describe('session-manager', () => {
  const mockGuestId = '149e3e7e-4006-4a17-9f9f-28b0ec188c28'
  const mockUserId = 'm2rb9gjhhqp2fky171quf1lj'
  const mockUser = {
    id: mockUserId,
    guestId: mockGuestId,
    name: null,
    createdAt: new Date(),
    upgradedAt: null,
    email: null,
    image: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createArcadeSession', () => {
    it('should look up user by guestId and use the database user.id for FK', async () => {
      // Mock user lookup
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser)

      // Mock session creation
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              userId: mockUserId, // Should use database ID, not guestId
              currentGame: 'matching',
              gameState: {},
              version: 1,
            },
          ]),
        })),
      }))
      vi.mocked(db.insert).mockImplementation(mockInsert as any)

      await createArcadeSession({
        userId: mockGuestId, // Passing guestId
        gameName: 'matching',
        gameUrl: '/arcade/matching',
        initialState: {},
        activePlayers: ['1'],
        roomId: 'test-room-id',
      })

      // Verify user lookup by guestId
      expect(db.query.users.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      )

      // Verify session uses database user.id
      const insertCall = mockInsert.mock.results[0].value
      const valuesCall = insertCall.values.mock.results[0].value
      const returningCall = valuesCall.returning

      expect(returningCall).toHaveBeenCalled()
    })

    it('should create new user if guestId not found', async () => {
      // Mock user not found
      vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined)

      const newUser = { ...mockUser, id: 'new-user-id' }

      // Mock user creation
      const mockInsertUser = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([newUser]),
        })),
      }))

      // Mock session creation
      const mockInsertSession = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              userId: 'new-user-id',
              currentGame: 'matching',
              gameState: {},
              version: 1,
            },
          ]),
        })),
      }))

      let insertCallCount = 0
      vi.mocked(db.insert).mockImplementation((() => {
        insertCallCount++
        return insertCallCount === 1 ? mockInsertUser() : mockInsertSession()
      }) as any)

      await createArcadeSession({
        userId: mockGuestId,
        gameName: 'matching',
        gameUrl: '/arcade/matching',
        initialState: {},
        activePlayers: ['1'],
        roomId: 'test-room-id',
      })

      // Verify user was created
      expect(db.insert).toHaveBeenCalledTimes(2) // user + session
    })
  })

  describe('getArcadeSession', () => {
    it('should translate guestId to user.id before querying', async () => {
      // Mock user lookup
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser)

      // Mock room lookup (getArcadeSession verifies room exists)
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue({
        id: 'test-room-id',
        name: 'Test Room',
        createdBy: mockGuestId,
        creatorName: 'Test User',
        gameName: 'matching',
        gameConfig: {},
        isActive: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        ttlMinutes: 60,
      } as any)

      // Mock session query
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                userId: mockUserId,
                currentGame: 'matching',
                gameState: {},
                version: 1,
                roomId: 'test-room-id',
                expiresAt: new Date(Date.now() + 1000000),
                isActive: true,
              },
            ]),
          }),
        }),
      } as any)

      const session = await getArcadeSession(mockGuestId)

      // Verify user lookup
      expect(db.query.users.findFirst).toHaveBeenCalled()

      // Verify session was found
      expect(session).toBeDefined()
      expect(session?.userId).toBe(mockUserId)
    })

    it('should return undefined if user not found', async () => {
      vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined)

      const session = await getArcadeSession(mockGuestId)

      expect(session).toBeUndefined()
    })
  })

  describe('applyGameMove', () => {
    const mockSession = {
      userId: mockUserId,
      currentGame: 'matching' as const,
      gameState: { matching: { flippedCards: [] } }, // Namespaced format
      version: 1,
      isActive: true,
      expiresAt: new Date(Date.now() + 1000000),
      startedAt: new Date(),
      lastActivityAt: new Date(),
      gameUrl: '/arcade/matching',
      activePlayers: [1] as any,
      roomId: 'test-room-id',
    }

    it('should use session.userId (database ID) for update WHERE clause', async () => {
      // Mock user lookup
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser)

      // Mock room lookup (getArcadeSession verifies room exists)
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue({
        id: 'test-room-id',
        name: 'Test Room',
        createdBy: mockGuestId,
        creatorName: 'Test User',
        gameName: 'matching',
        gameConfig: {},
        isActive: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        ttlMinutes: 60,
      } as any)

      // Mock session query
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockSession]),
          }),
        }),
      } as any)

      // Mock update with proper chain
      const mockReturning = vi.fn().mockResolvedValue([
        {
          ...mockSession,
          version: 2,
        },
      ])
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      })
      const mockSet = vi.fn().mockReturnValue({
        where: mockWhere,
      })

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any)

      const move: GameMove = {
        type: 'FLIP_CARD',
        data: { cardId: '1' },
        playerId: '1',
        userId: mockUserId,
        timestamp: Date.now(),
      }

      await applyGameMove(mockGuestId, move)

      // Verify the chain was called
      expect(mockSet).toHaveBeenCalled()
      expect(mockWhere).toHaveBeenCalled()
      expect(mockReturning).toHaveBeenCalled()
    })
  })

  describe('deleteArcadeSession', () => {
    it('should translate guestId to user.id before deleting', async () => {
      // Mock user lookup
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser)

      // Mock room lookup (getArcadeSession verifies room exists)
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue({
        id: 'test-room-id',
        name: 'Test Room',
        createdBy: mockGuestId,
        creatorName: 'Test User',
        gameName: 'matching',
        gameConfig: {},
        isActive: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        ttlMinutes: 60,
      } as any)

      // Mock session query (getArcadeSession is called internally)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                userId: mockUserId,
                currentGame: 'matching',
                gameState: {},
                version: 1,
                roomId: 'test-room-id',
                expiresAt: new Date(Date.now() + 1000000),
                isActive: true,
              },
            ]),
          }),
        }),
      } as any)

      const mockWhere = vi.fn()
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as any)

      await deleteArcadeSession(mockGuestId)

      // Verify user lookup happened
      expect(db.query.users.findFirst).toHaveBeenCalled()

      // Verify delete was called
      expect(mockWhere).toHaveBeenCalled()
    })

    it('should do nothing if user not found', async () => {
      vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined)

      const mockWhere = vi.fn()
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as any)

      await deleteArcadeSession(mockGuestId)

      // Verify delete was NOT called
      expect(mockWhere).not.toHaveBeenCalled()
    })
  })

  describe('updateSessionActivity', () => {
    it('should translate guestId to user.id before updating', async () => {
      // Mock user lookup
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser)

      // Mock room lookup (getArcadeSession verifies room exists)
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue({
        id: 'test-room-id',
        name: 'Test Room',
        createdBy: mockGuestId,
        creatorName: 'Test User',
        gameName: 'matching',
        gameConfig: {},
        isActive: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        ttlMinutes: 60,
      } as any)

      // Mock session query (getArcadeSession is called internally)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                userId: mockUserId,
                currentGame: 'matching',
                gameState: {},
                version: 1,
                roomId: 'test-room-id',
                expiresAt: new Date(Date.now() + 1000000),
                isActive: true,
              },
            ]),
          }),
        }),
      } as any)

      const mockWhere = vi.fn()
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockWhere,
        }),
      } as any)

      await updateSessionActivity(mockGuestId)

      // Verify user lookup happened
      expect(db.query.users.findFirst).toHaveBeenCalled()

      // Verify update was called
      expect(mockWhere).toHaveBeenCalled()
    })

    it('should do nothing if user not found', async () => {
      vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined)

      const mockWhere = vi.fn()
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockWhere,
        }),
      } as any)

      await updateSessionActivity(mockGuestId)

      // Verify update was NOT called
      expect(mockWhere).not.toHaveBeenCalled()
    })
  })
})
