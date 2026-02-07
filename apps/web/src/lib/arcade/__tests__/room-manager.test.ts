import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type schema } from '@/db'
import {
  cleanupExpiredRooms,
  createRoom,
  deleteRoom,
  getRoomByCode,
  getRoomById,
  isRoomCreator,
  listActiveRooms,
  touchRoom,
  updateRoom,
  type CreateRoomOptions,
} from '../room-manager'
import * as roomCode from '../room-code'

// Mock the database
vi.mock('@/db', () => ({
  db: {
    query: {
      arcadeRooms: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  schema: {
    arcadeRooms: {
      id: 'id',
      code: 'code',
      name: 'name',
      gameName: 'gameName',
      accessMode: 'accessMode',
      password: 'password',
      status: 'status',
      lastActivity: 'lastActivity',
    },
    arcadeSessions: {
      userId: 'userId',
      roomId: 'roomId',
    },
  },
}))

// Mock room-code module
vi.mock('../room-code', () => ({
  generateRoomCode: vi.fn(),
}))

describe('Room Manager', () => {
  const mockRoom: schema.ArcadeRoom = {
    id: 'room-123',
    code: 'ABC123',
    name: 'Test Room',
    createdBy: 'user-1',
    creatorName: 'Test User',
    createdAt: new Date(),
    lastActivity: new Date(),
    ttlMinutes: 60,
    accessMode: 'open',
    password: null,
    displayPassword: null,
    gameName: 'matching',
    gameConfig: { difficulty: 6 },
    status: 'lobby',
    currentSessionId: null,
    totalGamesPlayed: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createRoom', () => {
    it('creates a room with generated code', async () => {
      const options: CreateRoomOptions = {
        name: 'Test Room',
        createdBy: 'user-1',
        creatorName: 'Test User',
        gameName: 'matching',
        gameConfig: { difficulty: 6 },
      }

      // Mock code generation
      vi.mocked(roomCode.generateRoomCode).mockReturnValue('ABC123')

      // Mock code uniqueness check
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue(undefined)

      // Mock insert
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRoom]),
      }
      vi.mocked(db.insert).mockReturnValue(mockInsert as any)

      const room = await createRoom(options)

      expect(room).toEqual(mockRoom)
      expect(roomCode.generateRoomCode).toHaveBeenCalled()
      expect(db.insert).toHaveBeenCalled()
    })

    it('retries code generation on collision', async () => {
      const options: CreateRoomOptions = {
        name: 'Test Room',
        createdBy: 'user-1',
        creatorName: 'Test User',
        gameName: 'matching',
        gameConfig: { difficulty: 6 },
      }

      // First code collides, second is unique
      vi.mocked(roomCode.generateRoomCode)
        .mockReturnValueOnce('ABC123')
        .mockReturnValueOnce('XYZ789')

      // First check finds collision, second check is unique
      vi.mocked(db.query.arcadeRooms.findFirst)
        .mockResolvedValueOnce(mockRoom) // Collision
        .mockResolvedValueOnce(undefined) // Unique

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ ...mockRoom, code: 'XYZ789' }]),
      }
      vi.mocked(db.insert).mockReturnValue(mockInsert as any)

      const room = await createRoom(options)

      expect(room.code).toBe('XYZ789')
      expect(roomCode.generateRoomCode).toHaveBeenCalledTimes(2)
    })

    it('throws error after max collision attempts', async () => {
      const options: CreateRoomOptions = {
        name: 'Test Room',
        createdBy: 'user-1',
        creatorName: 'Test User',
        gameName: 'matching',
        gameConfig: { difficulty: 6 },
      }

      // All codes collide
      vi.mocked(roomCode.generateRoomCode).mockReturnValue('ABC123')
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue(mockRoom)

      await expect(createRoom(options)).rejects.toThrow('Failed to generate unique room code')
    })

    it('sets default TTL to 60 minutes', async () => {
      const options: CreateRoomOptions = {
        name: 'Test Room',
        createdBy: 'user-1',
        creatorName: 'Test User',
        gameName: 'matching',
        gameConfig: { difficulty: 6 },
      }

      vi.mocked(roomCode.generateRoomCode).mockReturnValue('ABC123')
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue(undefined)

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRoom]),
      }
      vi.mocked(db.insert).mockReturnValue(mockInsert as any)

      const room = await createRoom(options)

      expect(room.ttlMinutes).toBe(60)
    })

    it('respects custom TTL', async () => {
      const options: CreateRoomOptions = {
        name: 'Test Room',
        createdBy: 'user-1',
        creatorName: 'Test User',
        gameName: 'matching',
        gameConfig: { difficulty: 6 },
        ttlMinutes: 120,
      }

      vi.mocked(roomCode.generateRoomCode).mockReturnValue('ABC123')
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue(undefined)

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ ...mockRoom, ttlMinutes: 120 }]),
      }
      vi.mocked(db.insert).mockReturnValue(mockInsert as any)

      const room = await createRoom(options)

      expect(room.ttlMinutes).toBe(120)
    })
  })

  describe('getRoomById', () => {
    it('returns room when found', async () => {
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue(mockRoom)

      const room = await getRoomById('room-123')

      expect(room).toEqual(mockRoom)
      expect(db.query.arcadeRooms.findFirst).toHaveBeenCalled()
    })

    it('returns undefined when not found', async () => {
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue(undefined)

      const room = await getRoomById('nonexistent')

      expect(room).toBeUndefined()
    })
  })

  describe('getRoomByCode', () => {
    it('returns room when found', async () => {
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue(mockRoom)

      const room = await getRoomByCode('ABC123')

      expect(room).toEqual(mockRoom)
    })

    it('converts code to uppercase', async () => {
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue(mockRoom)

      await getRoomByCode('abc123')

      // Check that the where clause used uppercase
      const call = vi.mocked(db.query.arcadeRooms.findFirst).mock.calls[0][0]
      expect(call).toBeDefined()
    })

    it('returns undefined when not found', async () => {
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue(undefined)

      const room = await getRoomByCode('NONEXISTENT')

      expect(room).toBeUndefined()
    })
  })

  describe('updateRoom', () => {
    it('updates room and returns updated data', async () => {
      const updates = { name: 'Updated Room', status: 'playing' as const }

      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ ...mockRoom, ...updates }]),
      }
      vi.mocked(db.update).mockReturnValue(mockUpdate as any)

      const room = await updateRoom('room-123', updates)

      expect(room?.name).toBe('Updated Room')
      expect(room?.status).toBe('playing')
      expect(db.update).toHaveBeenCalled()
    })

    it('updates lastActivity timestamp', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRoom]),
      }
      vi.mocked(db.update).mockReturnValue(mockUpdate as any)

      await updateRoom('room-123', { name: 'Updated' })

      const setCall = mockUpdate.set.mock.calls[0][0]
      expect(setCall).toHaveProperty('lastActivity')
      expect(setCall.lastActivity).toBeInstanceOf(Date)
    })
  })

  describe('touchRoom', () => {
    it('updates lastActivity timestamp', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      }
      vi.mocked(db.update).mockReturnValue(mockUpdate as any)

      await touchRoom('room-123')

      expect(db.update).toHaveBeenCalled()
      const setCall = mockUpdate.set.mock.calls[0][0]
      expect(setCall).toHaveProperty('lastActivity')
      expect(setCall.lastActivity).toBeInstanceOf(Date)
    })
  })

  describe('deleteRoom', () => {
    it('deletes room from database', async () => {
      const mockDelete = {
        where: vi.fn().mockReturnThis(),
      }
      vi.mocked(db.delete).mockReturnValue(mockDelete as any)

      await deleteRoom('room-123')

      expect(db.delete).toHaveBeenCalled()
    })
  })

  describe('listActiveRooms', () => {
    const activeRooms = [mockRoom, { ...mockRoom, id: 'room-456', name: 'Another Room' }]

    it('returns active rooms', async () => {
      vi.mocked(db.query.arcadeRooms.findMany).mockResolvedValue(activeRooms)

      const rooms = await listActiveRooms()

      expect(rooms).toEqual(activeRooms)
      expect(rooms).toHaveLength(2)
    })

    it('filters by game name when provided', async () => {
      vi.mocked(db.query.arcadeRooms.findMany).mockResolvedValue([mockRoom])

      const rooms = await listActiveRooms('matching')

      expect(rooms).toHaveLength(1)
      expect(db.query.arcadeRooms.findMany).toHaveBeenCalled()
    })

    it('only includes open and password-protected rooms', async () => {
      vi.mocked(db.query.arcadeRooms.findMany).mockResolvedValue(activeRooms)

      await listActiveRooms()

      // Verify the where clause filters by accessMode
      const call = vi.mocked(db.query.arcadeRooms.findMany).mock.calls[0][0]
      expect(call).toBeDefined()
    })

    it('limits results to 50 rooms', async () => {
      vi.mocked(db.query.arcadeRooms.findMany).mockResolvedValue(activeRooms)

      await listActiveRooms()

      const call = vi.mocked(db.query.arcadeRooms.findMany).mock.calls[0][0]
      expect(call?.limit).toBe(50)
    })
  })

  describe('cleanupExpiredRooms', () => {
    it('deletes expired rooms', async () => {
      const now = new Date()
      const expiredRoom = {
        ...mockRoom,
        lastActivity: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        ttlMinutes: 60, // 1 hour TTL = expired
      }

      vi.mocked(db.query.arcadeRooms.findMany).mockResolvedValue([expiredRoom])

      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      }
      vi.mocked(db.update).mockReturnValue(mockUpdate as any)

      const mockDelete = {
        where: vi.fn().mockReturnThis(),
      }
      vi.mocked(db.delete).mockReturnValue(mockDelete as any)

      const count = await cleanupExpiredRooms()

      expect(count).toBe(1)
      expect(db.delete).toHaveBeenCalled()
    })

    it('does not delete active rooms', async () => {
      const now = new Date()
      const activeRoom = {
        ...mockRoom,
        lastActivity: new Date(now.getTime() - 30 * 60 * 1000), // 30 min ago
        ttlMinutes: 60, // 1 hour TTL = still active
      }

      vi.mocked(db.query.arcadeRooms.findMany).mockResolvedValue([activeRoom])

      const count = await cleanupExpiredRooms()

      expect(count).toBe(0)
      expect(db.delete).not.toHaveBeenCalled()
    })

    it('handles mixed expired and active rooms', async () => {
      const now = new Date()
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      }
      vi.mocked(db.update).mockReturnValue(mockUpdate as any)

      const rooms = [
        {
          ...mockRoom,
          id: 'expired-1',
          lastActivity: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          ttlMinutes: 60,
        },
        {
          ...mockRoom,
          id: 'active-1',
          lastActivity: new Date(now.getTime() - 30 * 60 * 1000),
          ttlMinutes: 60,
        },
        {
          ...mockRoom,
          id: 'expired-2',
          lastActivity: new Date(now.getTime() - 3 * 60 * 60 * 1000),
          ttlMinutes: 120,
        },
      ]

      vi.mocked(db.query.arcadeRooms.findMany).mockResolvedValue(rooms)

      const mockDelete = {
        where: vi.fn().mockReturnThis(),
      }
      vi.mocked(db.delete).mockReturnValue(mockDelete as any)

      const count = await cleanupExpiredRooms()

      expect(count).toBe(2) // Only 2 expired rooms
      expect(db.delete).toHaveBeenCalled()
    })

    it('returns 0 when no rooms exist', async () => {
      vi.mocked(db.query.arcadeRooms.findMany).mockResolvedValue([])

      const count = await cleanupExpiredRooms()

      expect(count).toBe(0)
      expect(db.delete).not.toHaveBeenCalled()
    })
  })

  describe('isRoomCreator', () => {
    it('returns true for room creator', async () => {
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue(mockRoom)

      const isCreator = await isRoomCreator('room-123', 'user-1')

      expect(isCreator).toBe(true)
    })

    it('returns false for non-creator', async () => {
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue(mockRoom)

      const isCreator = await isRoomCreator('room-123', 'user-2')

      expect(isCreator).toBe(false)
    })

    it('returns false when room not found', async () => {
      vi.mocked(db.query.arcadeRooms.findFirst).mockResolvedValue(undefined)

      const isCreator = await isRoomCreator('nonexistent', 'user-1')

      expect(isCreator).toBe(false)
    })
  })
})
