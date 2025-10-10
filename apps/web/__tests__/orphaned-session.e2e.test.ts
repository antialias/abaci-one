import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import {
  createArcadeSession,
  getArcadeSession,
} from "../src/lib/arcade/session-manager";
import {
  cleanupExpiredRooms,
  createRoom,
} from "../src/lib/arcade/room-manager";

/**
 * E2E Test: Orphaned Session After Room TTL Deletion
 *
 * This test simulates the exact scenario reported by the user:
 * 1. User creates a game session in a room
 * 2. Room expires via TTL cleanup
 * 3. User navigates to /arcade
 * 4. System should NOT redirect to the orphaned game
 * 5. User should see the arcade lobby normally
 */
describe("E2E: Orphaned Session Cleanup on Navigation", () => {
  const testUserId = "e2e-user-id";
  const testGuestId = "e2e-guest-id";
  let testRoomId: string;

  beforeEach(async () => {
    // Create test user (simulating new or returning visitor)
    await db
      .insert(schema.users)
      .values({
        id: testUserId,
        guestId: testGuestId,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  });

  afterEach(async () => {
    // Clean up test data
    await db
      .delete(schema.arcadeSessions)
      .where(eq(schema.arcadeSessions.userId, testUserId));
    await db.delete(schema.users).where(eq(schema.users.id, testUserId));
    if (testRoomId) {
      try {
        await db
          .delete(schema.arcadeRooms)
          .where(eq(schema.arcadeRooms.id, testRoomId));
      } catch {
        // Room may already be deleted
      }
    }
  });

  it("should not redirect user to orphaned game after room TTL cleanup", async () => {
    // === SETUP PHASE ===
    // User creates or joins a room
    const room = await createRoom({
      name: "My Game Room",
      createdBy: testGuestId,
      creatorName: "Test Player",
      gameName: "matching",
      gameConfig: { difficulty: 6, gameType: "abacus-numeral", turnTimer: 30 },
      ttlMinutes: 1, // Short TTL for testing
    });
    testRoomId = room.id;

    // User starts a game session
    const session = await createArcadeSession({
      userId: testGuestId,
      gameName: "matching",
      gameUrl: "/arcade/matching",
      initialState: {
        gamePhase: "playing",
        cards: [],
        gameCards: [],
        flippedCards: [],
        matchedPairs: 0,
        totalPairs: 6,
        currentPlayer: "player-1",
        difficulty: 6,
        gameType: "abacus-numeral",
        turnTimer: 30,
      },
      activePlayers: ["player-1"],
      roomId: room.id,
    });

    // Verify session was created
    expect(session).toBeDefined();
    expect(session.roomId).toBe(room.id);

    // === TTL EXPIRATION PHASE ===
    // Simulate time passing - room's TTL expires
    // Set lastActivity to past so cleanup detects it
    await db
      .update(schema.arcadeRooms)
      .set({
        lastActivity: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
      })
      .where(eq(schema.arcadeRooms.id, room.id));

    // Run cleanup (simulating background cleanup job)
    const deletedCount = await cleanupExpiredRooms();
    expect(deletedCount).toBeGreaterThan(0); // Room should be deleted

    // === USER NAVIGATION PHASE ===
    // User navigates to /arcade (arcade lobby)
    // The useArcadeRedirect hook calls getArcadeSession to check for active session
    const activeSession = await getArcadeSession(testGuestId);

    // === ASSERTION PHASE ===
    // Expected behavior: NO active session returned
    // This prevents redirect to /arcade/matching which would be broken
    expect(activeSession).toBeUndefined();

    // Verify the orphaned session was cleaned up from database
    const [orphanedSessionCheck] = await db
      .select()
      .from(schema.arcadeSessions)
      .where(eq(schema.arcadeSessions.userId, testUserId))
      .limit(1);

    expect(orphanedSessionCheck).toBeUndefined();
  });

  it("should allow user to start new game after orphaned session cleanup", async () => {
    // === SETUP: Create and orphan a session ===
    const oldRoom = await createRoom({
      name: "Old Room",
      createdBy: testGuestId,
      creatorName: "Test Player",
      gameName: "matching",
      gameConfig: { difficulty: 6 },
      ttlMinutes: 1,
    });

    await createArcadeSession({
      userId: testGuestId,
      gameName: "matching",
      gameUrl: "/arcade/matching",
      initialState: { gamePhase: "setup" },
      activePlayers: ["player-1"],
      roomId: oldRoom.id,
    });

    // Delete room (TTL cleanup)
    await db
      .delete(schema.arcadeRooms)
      .where(eq(schema.arcadeRooms.id, oldRoom.id));

    // === ACTION: User tries to access arcade ===
    const orphanedSession = await getArcadeSession(testGuestId);
    expect(orphanedSession).toBeUndefined(); // Orphan cleaned up

    // === ACTION: User creates new room and session ===
    const newRoom = await createRoom({
      name: "New Room",
      createdBy: testGuestId,
      creatorName: "Test Player",
      gameName: "matching",
      gameConfig: { difficulty: 8 },
      ttlMinutes: 60,
    });
    testRoomId = newRoom.id;

    const newSession = await createArcadeSession({
      userId: testGuestId,
      gameName: "matching",
      gameUrl: "/arcade/matching",
      initialState: { gamePhase: "setup" },
      activePlayers: ["player-1", "player-2"],
      roomId: newRoom.id,
    });

    // === ASSERTION: New session works correctly ===
    expect(newSession).toBeDefined();
    expect(newSession.roomId).toBe(newRoom.id);

    const activeSession = await getArcadeSession(testGuestId);
    expect(activeSession).toBeDefined();
    expect(activeSession?.roomId).toBe(newRoom.id);
  });

  it("should handle race condition: getArcadeSession called while room is being deleted", async () => {
    // Create room and session
    const room = await createRoom({
      name: "Race Condition Room",
      createdBy: testGuestId,
      creatorName: "Test Player",
      gameName: "matching",
      gameConfig: { difficulty: 6 },
      ttlMinutes: 60,
    });
    testRoomId = room.id;

    await createArcadeSession({
      userId: testGuestId,
      gameName: "matching",
      gameUrl: "/arcade/matching",
      initialState: { gamePhase: "setup" },
      activePlayers: ["player-1"],
      roomId: room.id,
    });

    // Simulate race: delete room while getArcadeSession is checking
    await db
      .delete(schema.arcadeRooms)
      .where(eq(schema.arcadeRooms.id, room.id));

    // Should gracefully handle and return undefined
    const result = await getArcadeSession(testGuestId);
    expect(result).toBeUndefined();
  });
});
