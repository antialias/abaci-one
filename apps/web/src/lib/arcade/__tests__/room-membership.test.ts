import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type schema } from '@/db'
import {
  addRoomMember,
  getOnlineMemberCount,
  getOnlineRoomMembers,
  getRoomMember,
  getRoomMembers,
  getUserRooms,
  isMember,
  removeAllMembers,
  removeMember,
  setMemberOnline,
  touchMember,
  type AddMemberOptions,
} from '../room-membership'

// Mock the database
vi.mock('@/db', () => ({
  db: {
    query: {
      roomMembers: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  schema: {
    roomMembers: {
      id: 'id',
      roomId: 'roomId',
      userId: 'userId',
      isOnline: 'isOnline',
      joinedAt: 'joinedAt',
    },
  },
}))

describe('Room Membership', () => {
  const mockMember: schema.RoomMember = {
    id: 'member-123',
    roomId: 'room-123',
    userId: 'user-1',
    displayName: 'Test User',
    isCreator: false,
    joinedAt: new Date(),
    lastSeen: new Date(),
    isOnline: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('addRoomMember', () => {
    it('adds new member to room', async () => {
      const options: AddMemberOptions = {
        roomId: 'room-123',
        userId: 'user-1',
        displayName: 'Test User',
      }

      // No existing member
      vi.mocked(db.query.roomMembers.findFirst).mockResolvedValue(undefined)

      // Mock insert
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockMember]),
      }
      vi.mocked(db.insert).mockReturnValue(mockInsert as any)

      // Mock getUserRooms to return empty array (no existing rooms)
      vi.mocked(db.query.roomMembers.findMany).mockResolvedValue([])

      const result = await addRoomMember(options)

      expect(result.member).toEqual(mockMember)
      expect(result.autoLeaveResult).toBeUndefined()
      expect(db.insert).toHaveBeenCalled()
    })

    it('updates existing member instead of creating duplicate', async () => {
      const options: AddMemberOptions = {
        roomId: 'room-123',
        userId: 'user-1',
        displayName: 'Test User',
      }

      // Existing member found
      const existingMember = { ...mockMember, isOnline: false }
      vi.mocked(db.query.roomMembers.findFirst).mockResolvedValue(existingMember)

      // Mock update
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ ...existingMember, isOnline: true }]),
      }
      vi.mocked(db.update).mockReturnValue(mockUpdate as any)

      const result = await addRoomMember(options)

      expect(result.member.isOnline).toBe(true)
      expect(result.autoLeaveResult).toBeUndefined()
      expect(db.update).toHaveBeenCalled()
      expect(db.insert).not.toHaveBeenCalled()
    })

    it('sets isCreator flag when specified', async () => {
      const options: AddMemberOptions = {
        roomId: 'room-123',
        userId: 'user-1',
        displayName: 'Test User',
        isCreator: true,
      }

      vi.mocked(db.query.roomMembers.findFirst).mockResolvedValue(undefined)

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ ...mockMember, isCreator: true }]),
      }
      vi.mocked(db.insert).mockReturnValue(mockInsert as any)

      // Mock getUserRooms to return empty array
      vi.mocked(db.query.roomMembers.findMany).mockResolvedValue([])

      const result = await addRoomMember(options)

      expect(result.member.isCreator).toBe(true)
    })

    it('sets isOnline to true by default', async () => {
      const options: AddMemberOptions = {
        roomId: 'room-123',
        userId: 'user-1',
        displayName: 'Test User',
      }

      vi.mocked(db.query.roomMembers.findFirst).mockResolvedValue(undefined)

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockMember]),
      }
      vi.mocked(db.insert).mockReturnValue(mockInsert as any)

      // Mock getUserRooms to return empty array
      vi.mocked(db.query.roomMembers.findMany).mockResolvedValue([])

      const result = await addRoomMember(options)

      expect(result.member.isOnline).toBe(true)
    })
  })

  describe('getRoomMember', () => {
    it('returns member when found', async () => {
      vi.mocked(db.query.roomMembers.findFirst).mockResolvedValue(mockMember)

      const member = await getRoomMember('room-123', 'user-1')

      expect(member).toEqual(mockMember)
    })

    it('returns undefined when not found', async () => {
      vi.mocked(db.query.roomMembers.findFirst).mockResolvedValue(undefined)

      const member = await getRoomMember('room-123', 'user-999')

      expect(member).toBeUndefined()
    })
  })

  describe('getRoomMembers', () => {
    const members = [
      mockMember,
      {
        ...mockMember,
        id: 'member-456',
        userId: 'user-2',
        displayName: 'User 2',
      },
    ]

    it('returns all members in room', async () => {
      vi.mocked(db.query.roomMembers.findMany).mockResolvedValue(members)

      const result = await getRoomMembers('room-123')

      expect(result).toEqual(members)
      expect(result).toHaveLength(2)
    })

    it('returns empty array when no members', async () => {
      vi.mocked(db.query.roomMembers.findMany).mockResolvedValue([])

      const result = await getRoomMembers('room-123')

      expect(result).toEqual([])
    })
  })

  describe('getOnlineRoomMembers', () => {
    const onlineMembers = [
      mockMember,
      { ...mockMember, id: 'member-456', userId: 'user-2', isOnline: true },
    ]

    it('returns only online members', async () => {
      vi.mocked(db.query.roomMembers.findMany).mockResolvedValue(onlineMembers)

      const result = await getOnlineRoomMembers('room-123')

      expect(result).toEqual(onlineMembers)
      expect(result.every((m) => m.isOnline)).toBe(true)
    })

    it('returns empty array when no online members', async () => {
      vi.mocked(db.query.roomMembers.findMany).mockResolvedValue([])

      const result = await getOnlineRoomMembers('room-123')

      expect(result).toEqual([])
    })
  })

  describe('setMemberOnline', () => {
    it('updates member online status to true', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      }
      vi.mocked(db.update).mockReturnValue(mockUpdate as any)

      await setMemberOnline('room-123', 'user-1', true)

      expect(db.update).toHaveBeenCalled()
      const setCall = mockUpdate.set.mock.calls[0][0]
      expect(setCall.isOnline).toBe(true)
      expect(setCall.lastSeen).toBeInstanceOf(Date)
    })

    it('updates member online status to false', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      }
      vi.mocked(db.update).mockReturnValue(mockUpdate as any)

      await setMemberOnline('room-123', 'user-1', false)

      const setCall = mockUpdate.set.mock.calls[0][0]
      expect(setCall.isOnline).toBe(false)
    })

    it('updates lastSeen timestamp', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      }
      vi.mocked(db.update).mockReturnValue(mockUpdate as any)

      await setMemberOnline('room-123', 'user-1', true)

      const setCall = mockUpdate.set.mock.calls[0][0]
      expect(setCall.lastSeen).toBeInstanceOf(Date)
    })
  })

  describe('touchMember', () => {
    it('updates lastSeen timestamp', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      }
      vi.mocked(db.update).mockReturnValue(mockUpdate as any)

      await touchMember('room-123', 'user-1')

      expect(db.update).toHaveBeenCalled()
      const setCall = mockUpdate.set.mock.calls[0][0]
      expect(setCall.lastSeen).toBeInstanceOf(Date)
    })
  })

  describe('removeMember', () => {
    it('removes member from room', async () => {
      const mockDelete = {
        where: vi.fn().mockReturnThis(),
      }
      vi.mocked(db.delete).mockReturnValue(mockDelete as any)

      await removeMember('room-123', 'user-1')

      expect(db.delete).toHaveBeenCalled()
    })
  })

  describe('removeAllMembers', () => {
    it('removes all members from room', async () => {
      const mockDelete = {
        where: vi.fn().mockReturnThis(),
      }
      vi.mocked(db.delete).mockReturnValue(mockDelete as any)

      await removeAllMembers('room-123')

      expect(db.delete).toHaveBeenCalled()
    })
  })

  describe('getOnlineMemberCount', () => {
    it('returns count of online members', async () => {
      const onlineMembers = [
        mockMember,
        { ...mockMember, id: 'member-456', userId: 'user-2' },
        { ...mockMember, id: 'member-789', userId: 'user-3' },
      ]

      vi.mocked(db.query.roomMembers.findMany).mockResolvedValue(onlineMembers)

      const count = await getOnlineMemberCount('room-123')

      expect(count).toBe(3)
    })

    it('returns 0 when no online members', async () => {
      vi.mocked(db.query.roomMembers.findMany).mockResolvedValue([])

      const count = await getOnlineMemberCount('room-123')

      expect(count).toBe(0)
    })
  })

  describe('isMember', () => {
    it('returns true when user is member', async () => {
      vi.mocked(db.query.roomMembers.findFirst).mockResolvedValue(mockMember)

      const result = await isMember('room-123', 'user-1')

      expect(result).toBe(true)
    })

    it('returns false when user is not member', async () => {
      vi.mocked(db.query.roomMembers.findFirst).mockResolvedValue(undefined)

      const result = await isMember('room-123', 'user-999')

      expect(result).toBe(false)
    })
  })

  describe('getUserRooms', () => {
    it('returns list of room IDs user is member of', async () => {
      const memberships = [
        { ...mockMember, roomId: 'room-1' },
        { ...mockMember, roomId: 'room-2' },
        { ...mockMember, roomId: 'room-3' },
      ]

      vi.mocked(db.query.roomMembers.findMany).mockResolvedValue(memberships)

      const rooms = await getUserRooms('user-1')

      expect(rooms).toEqual(['room-1', 'room-2', 'room-3'])
    })

    it('returns empty array when user has no rooms', async () => {
      vi.mocked(db.query.roomMembers.findMany).mockResolvedValue([])

      const rooms = await getUserRooms('user-1')

      expect(rooms).toEqual([])
    })
  })
})
