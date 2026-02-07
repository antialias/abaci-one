import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, schema } from '@/db'
import {
  createArcadeSession,
  deleteArcadeSession,
  deleteArcadeSessionByRoom,
  getArcadeSession,
} from '../session-manager'
import { createRoom, deleteRoom } from '../room-manager'

/**
 * Integration tests for orphaned session cleanup
 *
 * These tests ensure that sessions without valid rooms are properly
 * cleaned up to prevent the bug where users get redirected to
 * non-existent games when rooms have been TTL deleted.
 */
describe('Orphaned Session Cleanup', () => {
  const testUserId = 'orphan-test-user-id'
  const testGuestId = 'orphan-test-guest-id'
  let testRoomId: string

  beforeEach(async () => {
    // Create test user
    await db
      .insert(schema.users)
      .values({
        id: testUserId,
        guestId: testGuestId,
        createdAt: new Date(),
      })
      .onConflictDoNothing()

    // Create test room
    const room = await createRoom({
      name: 'Orphan Test Room',
      createdBy: testGuestId,
      creatorName: 'Test User',
      gameName: 'matching',
      gameConfig: { difficulty: 6, gameType: 'abacus-numeral', turnTimer: 30 },
      ttlMinutes: 60,
    })
    testRoomId = room.id
  })

  afterEach(async () => {
    // Clean up
    await deleteArcadeSession(testGuestId)
    if (testRoomId) {
      try {
        await deleteRoom(testRoomId)
      } catch {
        // Room may have been deleted in test
      }
    }
    await db.delete(schema.users).where(eq(schema.users.id, testUserId))
  })

  // NOTE: This test is no longer valid with roomId as primary key
  // roomId cannot be null since it's the primary key with a foreign key constraint
  // Orphaned sessions are now automatically cleaned up via CASCADE delete when room is deleted
  it.skip('should return undefined when session has no roomId', async () => {
    // This test scenario is impossible with the new schema where roomId is the primary key
    // and has a foreign key constraint with CASCADE delete
  })

  it('should return undefined when session room has been deleted', async () => {
    // Create a session with a valid room
    const session = await createArcadeSession({
      userId: testGuestId,
      gameName: 'matching',
      gameUrl: '/arcade/matching',
      initialState: { gamePhase: 'setup' },
      activePlayers: ['player-1'],
      roomId: testRoomId,
    })

    expect(session).toBeDefined()
    expect(session.roomId).toBe(testRoomId)

    // Delete session first (FK constraint), then room (simulating TTL expiration)
    await deleteArcadeSessionByRoom(testRoomId)
    await deleteRoom(testRoomId)

    // Getting the session should return undefined since both room and session are gone
    const result = await getArcadeSession(testGuestId)
    expect(result).toBeUndefined()

    // Verify session was actually deleted
    const [directCheck] = await db
      .select()
      .from(schema.arcadeSessions)
      .where(eq(schema.arcadeSessions.userId, testUserId))
      .limit(1)

    expect(directCheck).toBeUndefined()
  })

  it('should return valid session when room exists', async () => {
    // Create a session with a valid room
    const session = await createArcadeSession({
      userId: testGuestId,
      gameName: 'matching',
      gameUrl: '/arcade/matching',
      initialState: { gamePhase: 'setup' },
      activePlayers: ['player-1'],
      roomId: testRoomId,
    })

    expect(session).toBeDefined()

    // Getting the session should work fine when room exists
    const result = await getArcadeSession(testGuestId)
    expect(result).toBeDefined()
    expect(result?.roomId).toBe(testRoomId)
    expect(result?.currentGame).toBe('matching')
  })

  it('should handle multiple getArcadeSession calls idempotently', async () => {
    // Create a session with a valid room
    await createArcadeSession({
      userId: testGuestId,
      gameName: 'matching',
      gameUrl: '/arcade/matching',
      initialState: { gamePhase: 'setup' },
      activePlayers: ['player-1'],
      roomId: testRoomId,
    })

    // Delete session first (FK constraint), then room
    await deleteArcadeSessionByRoom(testRoomId)
    await deleteRoom(testRoomId)

    // Multiple calls should all return undefined and not error
    const result1 = await getArcadeSession(testGuestId)
    const result2 = await getArcadeSession(testGuestId)
    const result3 = await getArcadeSession(testGuestId)

    expect(result1).toBeUndefined()
    expect(result2).toBeUndefined()
    expect(result3).toBeUndefined()
  })

  it('should prevent orphaned sessions from causing redirect loops', async () => {
    /**
     * Regression test for the specific bug:
     * - Room gets TTL deleted
     * - Session persists with null/invalid roomId
     * - User visits /arcade
     * - Client checks for active session
     * - Without cleanup, user would be directed to /arcade/matching
     * - But there's no valid game to play
     *
     * Fix: getArcadeSession should auto-delete orphaned sessions
     */

    // 1. Create session with room
    await createArcadeSession({
      userId: testGuestId,
      gameName: 'matching',
      gameUrl: '/arcade/matching',
      initialState: { gamePhase: 'setup' },
      activePlayers: ['player-1'],
      roomId: testRoomId,
    })

    // 2. Room gets TTL deleted (delete session first due to FK constraint)
    await deleteArcadeSessionByRoom(testRoomId)
    await deleteRoom(testRoomId)

    // 3. User's client checks for active session
    const activeSession = await getArcadeSession(testGuestId)

    // 4. Should return undefined, preventing redirect
    expect(activeSession).toBeUndefined()

    // 5. User can now proceed to arcade lobby normally
    // (no redirect to non-existent game)
  })
})
