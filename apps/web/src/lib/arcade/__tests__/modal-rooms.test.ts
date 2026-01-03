import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { addRoomMember, getRoomMember, getUserRooms } from '../room-membership'
import { createRoom, deleteRoom } from '../room-manager'

/**
 * Integration tests for modal room enforcement
 *
 * Tests the database-level unique constraint combined with application-level
 * auto-leave logic to ensure users can only be in one room at a time.
 */
describe('Modal Room Enforcement', () => {
  const testGuestId1 = 'modal-test-guest-1'
  const testGuestId2 = 'modal-test-guest-2'
  const testUserId1 = 'modal-test-user-1'
  const testUserId2 = 'modal-test-user-2'
  let room1Id: string
  let room2Id: string
  let room3Id: string

  beforeEach(async () => {
    // Create test users
    await db
      .insert(schema.users)
      .values([
        {
          id: testUserId1,
          guestId: testGuestId1,
          createdAt: new Date(),
        },
        {
          id: testUserId2,
          guestId: testGuestId2,
          createdAt: new Date(),
        },
      ])
      .onConflictDoNothing()

    // Create test rooms
    const room1 = await createRoom({
      name: 'Modal Test Room 1',
      createdBy: testGuestId1,
      creatorName: 'User 1',
      gameName: 'matching',
      gameConfig: { difficulty: 6 },
      ttlMinutes: 60,
    })
    room1Id = room1.id

    const room2 = await createRoom({
      name: 'Modal Test Room 2',
      createdBy: testGuestId1,
      creatorName: 'User 1',
      gameName: 'matching',
      gameConfig: { difficulty: 8 },
      ttlMinutes: 60,
    })
    room2Id = room2.id

    const room3 = await createRoom({
      name: 'Modal Test Room 3',
      createdBy: testGuestId1,
      creatorName: 'User 1',
      gameName: 'memory-quiz',
      gameConfig: {},
      ttlMinutes: 60,
    })
    room3Id = room3.id
  })

  afterEach(async () => {
    // Clean up
    await db.delete(schema.roomMembers).where(eq(schema.roomMembers.userId, testGuestId1))
    await db.delete(schema.roomMembers).where(eq(schema.roomMembers.userId, testGuestId2))

    try {
      await deleteRoom(room1Id)
      await deleteRoom(room2Id)
      await deleteRoom(room3Id)
    } catch {
      // Rooms may have been deleted in test
    }

    await db.delete(schema.users).where(eq(schema.users.id, testUserId1))
    await db.delete(schema.users).where(eq(schema.users.id, testUserId2))
  })

  it('should allow user to join their first room', async () => {
    const result = await addRoomMember({
      roomId: room1Id,
      userId: testGuestId1,
      displayName: 'Test User',
      isCreator: false,
    })

    expect(result.member).toBeDefined()
    expect(result.member.roomId).toBe(room1Id)
    expect(result.member.userId).toBe(testGuestId1)
    expect(result.autoLeaveResult).toBeUndefined()

    const userRooms = await getUserRooms(testGuestId1)
    expect(userRooms).toHaveLength(1)
    expect(userRooms[0]).toBe(room1Id)
  })

  it('should automatically leave previous room when joining new one', async () => {
    // Join room 1
    await addRoomMember({
      roomId: room1Id,
      userId: testGuestId1,
      displayName: 'Test User',
      isCreator: false,
    })

    let userRooms = await getUserRooms(testGuestId1)
    expect(userRooms).toHaveLength(1)
    expect(userRooms[0]).toBe(room1Id)

    // Join room 2 (should auto-leave room 1)
    const result = await addRoomMember({
      roomId: room2Id,
      userId: testGuestId1,
      displayName: 'Test User',
      isCreator: false,
    })

    expect(result.autoLeaveResult).toBeDefined()
    expect(result.autoLeaveResult?.leftRooms).toHaveLength(1)
    expect(result.autoLeaveResult?.leftRooms[0]).toBe(room1Id)
    expect(result.autoLeaveResult?.previousRoomMembers).toHaveLength(1)

    userRooms = await getUserRooms(testGuestId1)
    expect(userRooms).toHaveLength(1)
    expect(userRooms[0]).toBe(room2Id)

    // Verify user is no longer in room 1
    const room1Member = await getRoomMember(room1Id, testGuestId1)
    expect(room1Member).toBeUndefined()

    // Verify user is in room 2
    const room2Member = await getRoomMember(room2Id, testGuestId1)
    expect(room2Member).toBeDefined()
  })

  it('should handle rejoining the same room without auto-leave', async () => {
    // Join room 1
    const firstJoin = await addRoomMember({
      roomId: room1Id,
      userId: testGuestId1,
      displayName: 'Test User',
      isCreator: false,
    })

    expect(firstJoin.autoLeaveResult).toBeUndefined()

    // "Rejoin" room 1 (should just update status)
    const secondJoin = await addRoomMember({
      roomId: room1Id,
      userId: testGuestId1,
      displayName: 'Test User Updated',
      isCreator: false,
    })

    expect(secondJoin.autoLeaveResult).toBeUndefined()
    expect(secondJoin.member.roomId).toBe(room1Id)

    const userRooms = await getUserRooms(testGuestId1)
    expect(userRooms).toHaveLength(1)
    expect(userRooms[0]).toBe(room1Id)
  })

  it('should allow different users in different rooms simultaneously', async () => {
    // User 1 joins room 1
    await addRoomMember({
      roomId: room1Id,
      userId: testGuestId1,
      displayName: 'User 1',
      isCreator: false,
    })

    // User 2 joins room 2
    await addRoomMember({
      roomId: room2Id,
      userId: testGuestId2,
      displayName: 'User 2',
      isCreator: false,
    })

    const user1Rooms = await getUserRooms(testGuestId1)
    const user2Rooms = await getUserRooms(testGuestId2)

    expect(user1Rooms).toHaveLength(1)
    expect(user1Rooms[0]).toBe(room1Id)

    expect(user2Rooms).toHaveLength(1)
    expect(user2Rooms[0]).toBe(room2Id)
  })

  it('should auto-leave when switching between multiple rooms', async () => {
    // Join room 1
    await addRoomMember({
      roomId: room1Id,
      userId: testGuestId1,
      displayName: 'Test User',
    })

    // Join room 2 (auto-leave room 1)
    const result2 = await addRoomMember({
      roomId: room2Id,
      userId: testGuestId1,
      displayName: 'Test User',
    })
    expect(result2.autoLeaveResult?.leftRooms).toContain(room1Id)

    // Join room 3 (auto-leave room 2)
    const result3 = await addRoomMember({
      roomId: room3Id,
      userId: testGuestId1,
      displayName: 'Test User',
    })
    expect(result3.autoLeaveResult?.leftRooms).toContain(room2Id)

    // Verify only in room 3
    const userRooms = await getUserRooms(testGuestId1)
    expect(userRooms).toHaveLength(1)
    expect(userRooms[0]).toBe(room3Id)
  })

  it('should provide correct auto-leave metadata', async () => {
    // Join room 1
    await addRoomMember({
      roomId: room1Id,
      userId: testGuestId1,
      displayName: 'Original Name',
    })

    // Join room 2 and check metadata
    const result = await addRoomMember({
      roomId: room2Id,
      userId: testGuestId1,
      displayName: 'New Name',
    })

    expect(result.autoLeaveResult).toBeDefined()
    expect(result.autoLeaveResult?.previousRoomMembers).toHaveLength(1)

    const previousMember = result.autoLeaveResult?.previousRoomMembers[0]
    expect(previousMember?.roomId).toBe(room1Id)
    expect(previousMember?.member.userId).toBe(testGuestId1)
    expect(previousMember?.member.displayName).toBe('Original Name')
  })

  it('should enforce unique constraint at database level', async () => {
    // This test verifies the database constraint catches issues even if
    // application logic fails

    // Join room 1
    await addRoomMember({
      roomId: room1Id,
      userId: testGuestId1,
      displayName: 'Test User',
    })

    // Try to directly insert a second membership (bypassing auto-leave logic)
    const directInsert = async () => {
      await db.insert(schema.roomMembers).values({
        roomId: room2Id,
        userId: testGuestId1,
        displayName: 'Test User',
        isCreator: false,
        joinedAt: new Date(),
        lastSeen: new Date(),
        isOnline: true,
      })
    }

    // Should fail due to unique constraint
    await expect(directInsert()).rejects.toThrow()
  })
})
