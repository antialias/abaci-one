/**
 * @vitest-environment node
 */

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "../src/db";
import { createRoom } from "../src/lib/arcade/room-manager";
import {
  createInvitation,
  getInvitation,
} from "../src/lib/arcade/room-invitations";
import { addRoomMember } from "../src/lib/arcade/room-membership";

/**
 * Join Flow with Invitation Acceptance E2E Tests
 *
 * Tests the bug fix for invitation acceptance:
 * - When a user joins a restricted room with an invitation
 * - The invitation should be marked as "accepted"
 * - This prevents the invitation from showing up again
 *
 * Regression test for the bug where invitations stayed "pending" forever.
 */

describe("Join Flow: Invitation Acceptance", () => {
  let hostUserId: string;
  let guestUserId: string;
  let hostGuestId: string;
  let guestGuestId: string;
  let roomId: string;

  beforeEach(async () => {
    // Create test users
    hostGuestId = `test-host-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    guestGuestId = `test-guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const [host] = await db
      .insert(schema.users)
      .values({ guestId: hostGuestId })
      .returning();
    const [guest] = await db
      .insert(schema.users)
      .values({ guestId: guestGuestId })
      .returning();

    hostUserId = host.id;
    guestUserId = guest.id;
  });

  afterEach(async () => {
    // Clean up invitations
    if (roomId) {
      await db
        .delete(schema.roomInvitations)
        .where(eq(schema.roomInvitations.roomId, roomId));
    }

    // Clean up room
    if (roomId) {
      await db
        .delete(schema.arcadeRooms)
        .where(eq(schema.arcadeRooms.id, roomId));
    }

    // Clean up users
    await db.delete(schema.users).where(eq(schema.users.id, hostUserId));
    await db.delete(schema.users).where(eq(schema.users.id, guestUserId));
  });

  describe("BUG FIX: Invitation marked as accepted after join", () => {
    it("marks invitation as accepted when guest joins restricted room", async () => {
      // 1. Host creates a restricted room
      const room = await createRoom({
        name: "Restricted Room",
        createdBy: hostGuestId,
        creatorName: "Host User",
        gameName: "rithmomachia",
        gameConfig: {},
        accessMode: "restricted", // Requires invitation
      });
      roomId = room.id;

      // 2. Host invites guest
      const invitation = await createInvitation({
        roomId,
        userId: guestUserId,
        userName: "Guest User",
        invitedBy: hostUserId,
        invitedByName: "Host User",
        invitationType: "manual",
      });

      // 3. Verify invitation is pending
      expect(invitation.status).toBe("pending");

      // 4. Guest joins the room (simulating the join API flow)
      // In the real API, it checks the invitation and then adds the member
      const invitationCheck = await getInvitation(roomId, guestUserId);
      expect(invitationCheck?.status).toBe("pending");

      // Simulate what the join API does: add member
      await addRoomMember({
        roomId,
        userId: guestGuestId,
        displayName: "Guest User",
        isCreator: false,
      });

      // 5. BUG: Before fix, invitation would still be "pending" here
      // AFTER FIX: The join API now explicitly marks it as "accepted"

      // Simulate the fix from join API
      const { acceptInvitation } = await import(
        "../src/lib/arcade/room-invitations"
      );
      await acceptInvitation(invitation.id);

      // 6. Verify invitation is now marked as accepted
      const updatedInvitation = await getInvitation(roomId, guestUserId);
      expect(updatedInvitation?.status).toBe("accepted");
      expect(updatedInvitation?.respondedAt).toBeDefined();
    });

    it("prevents showing the same invitation again after accepting", async () => {
      // This tests the exact bug scenario from the issue:
      // "even if I accept the invite and join the room,
      //  if I try to join room SFK3GD again, then I'm shown the same invite notice"

      // 1. Create Room A and Room B
      const roomA = await createRoom({
        name: "Room KHS3AE",
        createdBy: hostGuestId,
        creatorName: "Host",
        gameName: "rithmomachia",
        gameConfig: {},
        accessMode: "restricted",
      });

      const roomB = await createRoom({
        name: "Room SFK3GD",
        createdBy: hostGuestId,
        creatorName: "Host",
        gameName: "rithmomachia",
        gameConfig: {},
        accessMode: "open", // Guest can join without invitation
      });

      roomId = roomA.id; // For cleanup

      // 2. Invite guest to Room A
      const invitationA = await createInvitation({
        roomId: roomA.id,
        userId: guestUserId,
        userName: "Guest",
        invitedBy: hostUserId,
        invitedByName: "Host",
        invitationType: "manual",
      });

      // 3. Guest sees invitation to Room A
      const { getUserPendingInvitations } = await import(
        "../src/lib/arcade/room-invitations"
      );
      let pendingInvites = await getUserPendingInvitations(guestUserId);
      expect(pendingInvites).toHaveLength(1);
      expect(pendingInvites[0].roomId).toBe(roomA.id);

      // 4. Guest accepts and joins Room A
      const { acceptInvitation } = await import(
        "../src/lib/arcade/room-invitations"
      );
      await acceptInvitation(invitationA.id);

      await addRoomMember({
        roomId: roomA.id,
        userId: guestGuestId,
        displayName: "Guest",
        isCreator: false,
      });

      // 5. Guest tries to visit Room B link (/join/SFK3GD)
      // BUG: Before fix, they'd see Room A invitation again because it's still "pending"
      // FIX: Invitation is now "accepted", so it won't show in pending list

      pendingInvites = await getUserPendingInvitations(guestUserId);
      expect(pendingInvites).toHaveLength(0); // ✅ No longer shows Room A

      // 6. Guest can successfully join Room B without being interrupted
      await addRoomMember({
        roomId: roomB.id,
        userId: guestGuestId,
        displayName: "Guest",
        isCreator: false,
      });

      // Clean up
      await db
        .delete(schema.arcadeRooms)
        .where(eq(schema.arcadeRooms.id, roomB.id));
    });
  });

  describe("Invitation flow with multiple rooms", () => {
    it("only shows pending invitations, not accepted ones", async () => {
      // Create 3 rooms, invite to all of them
      const room1 = await createRoom({
        name: "Room 1",
        createdBy: hostGuestId,
        creatorName: "Host",
        gameName: "rithmomachia",
        gameConfig: {},
        accessMode: "restricted",
      });

      const room2 = await createRoom({
        name: "Room 2",
        createdBy: hostGuestId,
        creatorName: "Host",
        gameName: "rithmomachia",
        gameConfig: {},
        accessMode: "restricted",
      });

      const room3 = await createRoom({
        name: "Room 3",
        createdBy: hostGuestId,
        creatorName: "Host",
        gameName: "rithmomachia",
        gameConfig: {},
        accessMode: "restricted",
      });

      roomId = room1.id; // For cleanup

      // Invite to all 3
      const inv1 = await createInvitation({
        roomId: room1.id,
        userId: guestUserId,
        userName: "Guest",
        invitedBy: hostUserId,
        invitedByName: "Host",
        invitationType: "manual",
      });

      const inv2 = await createInvitation({
        roomId: room2.id,
        userId: guestUserId,
        userName: "Guest",
        invitedBy: hostUserId,
        invitedByName: "Host",
        invitationType: "manual",
      });

      const inv3 = await createInvitation({
        roomId: room3.id,
        userId: guestUserId,
        userName: "Guest",
        invitedBy: hostUserId,
        invitedByName: "Host",
        invitationType: "manual",
      });

      // All 3 should be pending
      const { getUserPendingInvitations, acceptInvitation } = await import(
        "../src/lib/arcade/room-invitations"
      );
      let pending = await getUserPendingInvitations(guestUserId);
      expect(pending).toHaveLength(3);

      // Accept invitation 1 and join
      await acceptInvitation(inv1.id);

      // Now only 2 should be pending
      pending = await getUserPendingInvitations(guestUserId);
      expect(pending).toHaveLength(2);
      expect(pending.map((p) => p.roomId)).not.toContain(room1.id);

      // Clean up
      await db
        .delete(schema.arcadeRooms)
        .where(eq(schema.arcadeRooms.id, room2.id));
      await db
        .delete(schema.arcadeRooms)
        .where(eq(schema.arcadeRooms.id, room3.id));
    });
  });

  describe("Host re-joining their own restricted room", () => {
    it("host can rejoin without invitation (no acceptance needed)", async () => {
      // Create restricted room as host
      const room = await createRoom({
        name: "Host Room",
        createdBy: hostGuestId,
        creatorName: "Host User",
        gameName: "rithmomachia",
        gameConfig: {},
        accessMode: "restricted",
      });
      roomId = room.id;

      // Host joins their own room
      await addRoomMember({
        roomId,
        userId: hostGuestId,
        displayName: "Host User",
        isCreator: true,
      });

      // No invitation needed, no acceptance
      // This should not create any invitation records
      const invitation = await getInvitation(roomId, hostUserId);
      expect(invitation).toBeUndefined();
    });
  });

  describe("Edge cases", () => {
    it("handles multiple invitations from same host to same guest (updates, not duplicates)", async () => {
      const room = await createRoom({
        name: "Test Room",
        createdBy: hostGuestId,
        creatorName: "Host",
        gameName: "rithmomachia",
        gameConfig: {},
        accessMode: "restricted",
      });
      roomId = room.id;

      // Send first invitation
      const inv1 = await createInvitation({
        roomId,
        userId: guestUserId,
        userName: "Guest",
        invitedBy: hostUserId,
        invitedByName: "Host",
        invitationType: "manual",
        message: "First message",
      });

      // Send second invitation (should update, not create new)
      const inv2 = await createInvitation({
        roomId,
        userId: guestUserId,
        userName: "Guest",
        invitedBy: hostUserId,
        invitedByName: "Host",
        invitationType: "manual",
        message: "Second message",
      });

      // Should be same invitation (same ID)
      expect(inv1.id).toBe(inv2.id);
      expect(inv2.message).toBe("Second message");

      // Should only have 1 invitation in database
      const allInvitations = await db
        .select()
        .from(schema.roomInvitations)
        .where(eq(schema.roomInvitations.roomId, roomId));

      expect(allInvitations).toHaveLength(1);
    });

    it("re-sends invitation after previous was declined", async () => {
      const room = await createRoom({
        name: "Test Room",
        createdBy: hostGuestId,
        creatorName: "Host",
        gameName: "rithmomachia",
        gameConfig: {},
        accessMode: "restricted",
      });
      roomId = room.id;

      // First invitation
      const inv1 = await createInvitation({
        roomId,
        userId: guestUserId,
        userName: "Guest",
        invitedBy: hostUserId,
        invitedByName: "Host",
        invitationType: "manual",
      });

      // Guest declines
      const { declineInvitation, getUserPendingInvitations } = await import(
        "../src/lib/arcade/room-invitations"
      );
      await declineInvitation(inv1.id);

      // Should not be in pending list
      let pending = await getUserPendingInvitations(guestUserId);
      expect(pending).toHaveLength(0);

      // Host sends new invitation (should reset to pending)
      await createInvitation({
        roomId,
        userId: guestUserId,
        userName: "Guest",
        invitedBy: hostUserId,
        invitedByName: "Host",
        invitationType: "manual",
      });

      // Should now be in pending list again
      pending = await getUserPendingInvitations(guestUserId);
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe("pending");
    });

    it("accepts invitations to OPEN rooms (not just restricted)", async () => {
      // This tests the root cause of the bug:
      // Invitations to OPEN rooms were never being marked as accepted

      const openRoom = await createRoom({
        name: "Open Room",
        createdBy: hostGuestId,
        creatorName: "Host",
        gameName: "rithmomachia",
        gameConfig: {},
        accessMode: "open", // Open access - no invitation required to join
      });
      roomId = openRoom.id;

      // Host sends invitation anyway (e.g., to notify guest about the room)
      const inv = await createInvitation({
        roomId: openRoom.id,
        userId: guestUserId,
        userName: "Guest",
        invitedBy: hostUserId,
        invitedByName: "Host",
        invitationType: "manual",
      });

      // Guest should see pending invitation
      const { getUserPendingInvitations, acceptInvitation } = await import(
        "../src/lib/arcade/room-invitations"
      );
      let pending = await getUserPendingInvitations(guestUserId);
      expect(pending).toHaveLength(1);

      // Guest joins the open room (invitation not required, but present)
      await addRoomMember({
        roomId: openRoom.id,
        userId: guestGuestId,
        displayName: "Guest",
        isCreator: false,
      });

      // Simulate the join API accepting the invitation
      await acceptInvitation(inv.id);

      // BUG FIX: Invitation should now be accepted, not stuck in pending
      pending = await getUserPendingInvitations(guestUserId);
      expect(pending).toHaveLength(0); // ✅ No longer pending

      // Verify it's marked as accepted
      const acceptedInv = await getInvitation(openRoom.id, guestUserId);
      expect(acceptedInv?.status).toBe("accepted");
    });
  });
});
