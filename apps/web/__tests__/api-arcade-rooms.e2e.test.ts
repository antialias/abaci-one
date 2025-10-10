/**
 * @vitest-environment node
 */

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "../src/db";
import { createRoom } from "../src/lib/arcade/room-manager";
import { addRoomMember } from "../src/lib/arcade/room-membership";

/**
 * Arcade Rooms API E2E Tests
 *
 * Tests the full arcade room system:
 * - Room CRUD operations
 * - Member management
 * - Access control
 * - Room code lookups
 */

describe("Arcade Rooms API", () => {
  let testUserId1: string;
  let testUserId2: string;
  let testGuestId1: string;
  let testGuestId2: string;
  let testRoomId: string;

  beforeEach(async () => {
    // Create test users
    testGuestId1 = `test-guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testGuestId2 = `test-guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const [user1] = await db
      .insert(schema.users)
      .values({ guestId: testGuestId1 })
      .returning();
    const [user2] = await db
      .insert(schema.users)
      .values({ guestId: testGuestId2 })
      .returning();

    testUserId1 = user1.id;
    testUserId2 = user2.id;
  });

  afterEach(async () => {
    // Clean up rooms (cascade deletes members)
    if (testRoomId) {
      await db
        .delete(schema.arcadeRooms)
        .where(eq(schema.arcadeRooms.id, testRoomId));
    }

    // Clean up users
    await db.delete(schema.users).where(eq(schema.users.id, testUserId1));
    await db.delete(schema.users).where(eq(schema.users.id, testUserId2));
  });

  describe("Room Creation", () => {
    it("creates a room with valid data", async () => {
      const room = await createRoom({
        name: "Test Room",
        createdBy: testGuestId1,
        creatorName: "Test User",
        gameName: "matching",
        gameConfig: { difficulty: 6 },
      });

      testRoomId = room.id;

      expect(room).toBeDefined();
      expect(room.name).toBe("Test Room");
      expect(room.createdBy).toBe(testGuestId1);
      expect(room.gameName).toBe("matching");
      expect(room.status).toBe("lobby");
      expect(room.isLocked).toBe(false);
      expect(room.ttlMinutes).toBe(60);
      expect(room.code).toMatch(/^[A-Z0-9]{6}$/);
    });

    it("creates room with custom TTL", async () => {
      const room = await createRoom({
        name: "Custom TTL Room",
        createdBy: testGuestId1,
        creatorName: "Test User",
        gameName: "matching",
        gameConfig: {},
        ttlMinutes: 120,
      });

      testRoomId = room.id;

      expect(room.ttlMinutes).toBe(120);
    });

    it("generates unique room codes", async () => {
      const room1 = await createRoom({
        name: "Room 1",
        createdBy: testGuestId1,
        creatorName: "User 1",
        gameName: "matching",
        gameConfig: {},
      });

      const room2 = await createRoom({
        name: "Room 2",
        createdBy: testGuestId2,
        creatorName: "User 2",
        gameName: "matching",
        gameConfig: {},
      });

      // Clean up both rooms
      testRoomId = room1.id;
      await db
        .delete(schema.arcadeRooms)
        .where(eq(schema.arcadeRooms.id, room2.id));

      expect(room1.code).not.toBe(room2.code);
    });
  });

  describe("Room Retrieval", () => {
    beforeEach(async () => {
      // Create a test room
      const room = await createRoom({
        name: "Retrieval Test Room",
        createdBy: testGuestId1,
        creatorName: "Test User",
        gameName: "matching",
        gameConfig: {},
      });
      testRoomId = room.id;
    });

    it("retrieves room by ID", async () => {
      const room = await db.query.arcadeRooms.findFirst({
        where: eq(schema.arcadeRooms.id, testRoomId),
      });

      expect(room).toBeDefined();
      expect(room?.id).toBe(testRoomId);
      expect(room?.name).toBe("Retrieval Test Room");
    });

    it("retrieves room by code", async () => {
      const createdRoom = await db.query.arcadeRooms.findFirst({
        where: eq(schema.arcadeRooms.id, testRoomId),
      });

      const room = await db.query.arcadeRooms.findFirst({
        where: eq(schema.arcadeRooms.code, createdRoom!.code),
      });

      expect(room).toBeDefined();
      expect(room?.id).toBe(testRoomId);
    });

    it("returns undefined for non-existent room", async () => {
      const room = await db.query.arcadeRooms.findFirst({
        where: eq(schema.arcadeRooms.id, "nonexistent-room-id"),
      });

      expect(room).toBeUndefined();
    });
  });

  describe("Room Updates", () => {
    beforeEach(async () => {
      const room = await createRoom({
        name: "Update Test Room",
        createdBy: testGuestId1,
        creatorName: "Test User",
        gameName: "matching",
        gameConfig: {},
      });
      testRoomId = room.id;
    });

    it("updates room name", async () => {
      const [updated] = await db
        .update(schema.arcadeRooms)
        .set({ name: "Updated Name" })
        .where(eq(schema.arcadeRooms.id, testRoomId))
        .returning();

      expect(updated.name).toBe("Updated Name");
    });

    it("locks room", async () => {
      const [updated] = await db
        .update(schema.arcadeRooms)
        .set({ isLocked: true })
        .where(eq(schema.arcadeRooms.id, testRoomId))
        .returning();

      expect(updated.isLocked).toBe(true);
    });

    it("updates room status", async () => {
      const [updated] = await db
        .update(schema.arcadeRooms)
        .set({ status: "playing" })
        .where(eq(schema.arcadeRooms.id, testRoomId))
        .returning();

      expect(updated.status).toBe("playing");
    });

    it("updates lastActivity on any change", async () => {
      const originalRoom = await db.query.arcadeRooms.findFirst({
        where: eq(schema.arcadeRooms.id, testRoomId),
      });

      // Wait a bit to ensure different timestamp (at least 1 second for SQLite timestamp resolution)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const [updated] = await db
        .update(schema.arcadeRooms)
        .set({ name: "Activity Test", lastActivity: new Date() })
        .where(eq(schema.arcadeRooms.id, testRoomId))
        .returning();

      expect(updated.lastActivity.getTime()).toBeGreaterThan(
        originalRoom!.lastActivity.getTime(),
      );
    });
  });

  describe("Room Deletion", () => {
    it("deletes room", async () => {
      const room = await createRoom({
        name: "Delete Test Room",
        createdBy: testGuestId1,
        creatorName: "Test User",
        gameName: "matching",
        gameConfig: {},
      });

      await db
        .delete(schema.arcadeRooms)
        .where(eq(schema.arcadeRooms.id, room.id));

      const deleted = await db.query.arcadeRooms.findFirst({
        where: eq(schema.arcadeRooms.id, room.id),
      });

      expect(deleted).toBeUndefined();
    });

    it("cascades delete to room members", async () => {
      const room = await createRoom({
        name: "Cascade Test Room",
        createdBy: testGuestId1,
        creatorName: "Test User",
        gameName: "matching",
        gameConfig: {},
      });

      // Add member
      await addRoomMember({
        roomId: room.id,
        userId: testGuestId1,
        displayName: "Test User",
      });

      // Verify member exists
      const membersBefore = await db.query.roomMembers.findMany({
        where: eq(schema.roomMembers.roomId, room.id),
      });
      expect(membersBefore).toHaveLength(1);

      // Delete room
      await db
        .delete(schema.arcadeRooms)
        .where(eq(schema.arcadeRooms.id, room.id));

      // Verify members deleted
      const membersAfter = await db.query.roomMembers.findMany({
        where: eq(schema.roomMembers.roomId, room.id),
      });
      expect(membersAfter).toHaveLength(0);
    });
  });

  describe("Room Members", () => {
    beforeEach(async () => {
      const room = await createRoom({
        name: "Members Test Room",
        createdBy: testGuestId1,
        creatorName: "Test User 1",
        gameName: "matching",
        gameConfig: {},
      });
      testRoomId = room.id;
    });

    it("adds member to room", async () => {
      const result = await addRoomMember({
        roomId: testRoomId,
        userId: testGuestId1,
        displayName: "Test User 1",
        isCreator: true,
      });

      expect(result.member).toBeDefined();
      expect(result.member.roomId).toBe(testRoomId);
      expect(result.member.userId).toBe(testGuestId1);
      expect(result.member.displayName).toBe("Test User 1");
      expect(result.member.isCreator).toBe(true);
      expect(result.member.isOnline).toBe(true);
    });

    it("adds multiple members to room", async () => {
      await addRoomMember({
        roomId: testRoomId,
        userId: testGuestId1,
        displayName: "User 1",
      });

      await addRoomMember({
        roomId: testRoomId,
        userId: testGuestId2,
        displayName: "User 2",
      });

      const members = await db.query.roomMembers.findMany({
        where: eq(schema.roomMembers.roomId, testRoomId),
      });

      expect(members).toHaveLength(2);
    });

    it("updates existing member instead of creating duplicate", async () => {
      // Add member first time
      await addRoomMember({
        roomId: testRoomId,
        userId: testGuestId1,
        displayName: "First Time",
      });

      // Add same member again
      await addRoomMember({
        roomId: testRoomId,
        userId: testGuestId1,
        displayName: "Second Time",
      });

      const members = await db.query.roomMembers.findMany({
        where: eq(schema.roomMembers.roomId, testRoomId),
      });

      // Should still only have 1 member
      expect(members).toHaveLength(1);
    });

    it("removes member from room", async () => {
      const result = await addRoomMember({
        roomId: testRoomId,
        userId: testGuestId1,
        displayName: "Test User",
      });

      await db
        .delete(schema.roomMembers)
        .where(eq(schema.roomMembers.id, result.member.id));

      const members = await db.query.roomMembers.findMany({
        where: eq(schema.roomMembers.roomId, testRoomId),
      });

      expect(members).toHaveLength(0);
    });

    it("tracks online status", async () => {
      const result = await addRoomMember({
        roomId: testRoomId,
        userId: testGuestId1,
        displayName: "Test User",
      });

      expect(result.member.isOnline).toBe(true);

      // Set offline
      const [updated] = await db
        .update(schema.roomMembers)
        .set({ isOnline: false })
        .where(eq(schema.roomMembers.id, result.member.id))
        .returning();

      expect(updated.isOnline).toBe(false);
    });
  });

  describe("Access Control", () => {
    beforeEach(async () => {
      const room = await createRoom({
        name: "Access Test Room",
        createdBy: testGuestId1,
        creatorName: "Creator",
        gameName: "matching",
        gameConfig: {},
      });
      testRoomId = room.id;
    });

    it("identifies room creator correctly", async () => {
      const room = await db.query.arcadeRooms.findFirst({
        where: eq(schema.arcadeRooms.id, testRoomId),
      });

      expect(room?.createdBy).toBe(testGuestId1);
    });

    it("distinguishes creator from other users", async () => {
      const room = await db.query.arcadeRooms.findFirst({
        where: eq(schema.arcadeRooms.id, testRoomId),
      });

      expect(room?.createdBy).not.toBe(testGuestId2);
    });
  });

  describe("Room Listing", () => {
    beforeEach(async () => {
      // Create multiple test rooms
      const room1 = await createRoom({
        name: "Matching Room",
        createdBy: testGuestId1,
        creatorName: "User 1",
        gameName: "matching",
        gameConfig: {},
      });

      const room2 = await createRoom({
        name: "Memory Quiz Room",
        createdBy: testGuestId2,
        creatorName: "User 2",
        gameName: "memory-quiz",
        gameConfig: {},
      });

      testRoomId = room1.id;

      // Clean up room2 after test
      afterEach(async () => {
        await db
          .delete(schema.arcadeRooms)
          .where(eq(schema.arcadeRooms.id, room2.id));
      });
    });

    it("lists all active rooms", async () => {
      const rooms = await db.query.arcadeRooms.findMany({
        where: eq(schema.arcadeRooms.status, "lobby"),
      });

      expect(rooms.length).toBeGreaterThanOrEqual(2);
    });

    it("excludes locked rooms from listing", async () => {
      // Lock one room
      await db
        .update(schema.arcadeRooms)
        .set({ isLocked: true })
        .where(eq(schema.arcadeRooms.id, testRoomId));

      const unlockedRooms = await db.query.arcadeRooms.findMany({
        where: eq(schema.arcadeRooms.isLocked, false),
      });

      expect(unlockedRooms.every((r) => !r.isLocked)).toBe(true);
    });
  });
});
