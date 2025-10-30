/**
 * @vitest-environment node
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, schema } from '@/db'
import {
  createInvitation,
  getUserPendingInvitations,
  getInvitation,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
} from '../room-invitations'
import { createRoom } from '../room-manager'

/**
 * Room Invitations Unit Tests
 *
 * Tests the invitation system:
 * - Creating invitations
 * - Accepting/declining invitations
 * - Invitation status transitions
 */

describe('Room Invitations', () => {
  let testUserId1: string
  let testUserId2: string
  let testGuestId1: string
  let testGuestId2: string
  let testRoomId: string

  beforeEach(async () => {
    // Create test users
    testGuestId1 = `test-guest-${Date.now()}-${Math.random().toString(36).slice(2)}`
    testGuestId2 = `test-guest-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const [user1] = await db.insert(schema.users).values({ guestId: testGuestId1 }).returning()
    const [user2] = await db.insert(schema.users).values({ guestId: testGuestId2 }).returning()

    testUserId1 = user1.id
    testUserId2 = user2.id

    // Create test room
    const room = await createRoom({
      name: 'Test Room',
      createdBy: testGuestId1,
      creatorName: 'Host User',
      gameName: 'matching',
      gameConfig: {},
      accessMode: 'restricted',
    })
    testRoomId = room.id
  })

  afterEach(async () => {
    // Clean up invitations (should cascade, but be explicit)
    await db.delete(schema.roomInvitations).where(eq(schema.roomInvitations.roomId, testRoomId))

    // Clean up room
    if (testRoomId) {
      await db.delete(schema.arcadeRooms).where(eq(schema.arcadeRooms.id, testRoomId))
    }

    // Clean up users
    await db.delete(schema.users).where(eq(schema.users.id, testUserId1))
    await db.delete(schema.users).where(eq(schema.users.id, testUserId2))
  })

  describe('Creating Invitations', () => {
    it('creates a new invitation', async () => {
      const invitation = await createInvitation({
        roomId: testRoomId,
        userId: testUserId2,
        userName: 'Guest User',
        invitedBy: testUserId1,
        invitedByName: 'Host User',
        invitationType: 'manual',
      })

      expect(invitation).toBeDefined()
      expect(invitation.roomId).toBe(testRoomId)
      expect(invitation.userId).toBe(testUserId2)
      expect(invitation.status).toBe('pending')
      expect(invitation.invitationType).toBe('manual')
    })

    it('updates existing invitation instead of creating duplicate', async () => {
      // Create first invitation
      const invitation1 = await createInvitation({
        roomId: testRoomId,
        userId: testUserId2,
        userName: 'Guest User',
        invitedBy: testUserId1,
        invitedByName: 'Host User',
        invitationType: 'manual',
        message: 'First invite',
      })

      // Create second invitation for same user/room
      const invitation2 = await createInvitation({
        roomId: testRoomId,
        userId: testUserId2,
        userName: 'Guest User Updated',
        invitedBy: testUserId1,
        invitedByName: 'Host User',
        invitationType: 'manual',
        message: 'Second invite',
      })

      // Should have same ID (updated, not created)
      expect(invitation2.id).toBe(invitation1.id)
      expect(invitation2.message).toBe('Second invite')
      expect(invitation2.status).toBe('pending') // Reset to pending

      // Verify only one invitation exists
      const allInvitations = await db
        .select()
        .from(schema.roomInvitations)
        .where(eq(schema.roomInvitations.userId, testUserId2))

      expect(allInvitations).toHaveLength(1)
    })
  })

  describe('Accepting Invitations', () => {
    it('marks invitation as accepted', async () => {
      // Create invitation
      const invitation = await createInvitation({
        roomId: testRoomId,
        userId: testUserId2,
        userName: 'Guest User',
        invitedBy: testUserId1,
        invitedByName: 'Host User',
        invitationType: 'manual',
      })

      expect(invitation.status).toBe('pending')

      // Accept invitation
      const accepted = await acceptInvitation(invitation.id)

      expect(accepted.status).toBe('accepted')
      expect(accepted.respondedAt).toBeDefined()
      expect(accepted.respondedAt).toBeInstanceOf(Date)
    })

    it('removes invitation from pending list after acceptance', async () => {
      // Create invitation
      await createInvitation({
        roomId: testRoomId,
        userId: testUserId2,
        userName: 'Guest User',
        invitedBy: testUserId1,
        invitedByName: 'Host User',
        invitationType: 'manual',
      })

      // Verify it's in pending list
      let pending = await getUserPendingInvitations(testUserId2)
      expect(pending).toHaveLength(1)

      // Accept it
      await acceptInvitation(pending[0].id)

      // Verify it's no longer in pending list
      pending = await getUserPendingInvitations(testUserId2)
      expect(pending).toHaveLength(0)
    })

    it('BUG FIX: invitation stays pending if not explicitly accepted', async () => {
      // This test verifies the bug we fixed
      const invitation = await createInvitation({
        roomId: testRoomId,
        userId: testUserId2,
        userName: 'Guest User',
        invitedBy: testUserId1,
        invitedByName: 'Host User',
        invitationType: 'manual',
      })

      // Get invitation (simulating join API checking it)
      const retrieved = await getInvitation(testRoomId, testUserId2)
      expect(retrieved?.status).toBe('pending')

      // WITHOUT calling acceptInvitation, invitation stays pending
      const stillPending = await getInvitation(testRoomId, testUserId2)
      expect(stillPending?.status).toBe('pending')

      // This is the bug: user joined but invitation not marked accepted
      // Now verify the fix works
      await acceptInvitation(invitation.id)
      const nowAccepted = await getInvitation(testRoomId, testUserId2)
      expect(nowAccepted?.status).toBe('accepted')
    })
  })

  describe('Declining Invitations', () => {
    it('marks invitation as declined', async () => {
      const invitation = await createInvitation({
        roomId: testRoomId,
        userId: testUserId2,
        userName: 'Guest User',
        invitedBy: testUserId1,
        invitedByName: 'Host User',
        invitationType: 'manual',
      })

      const declined = await declineInvitation(invitation.id)

      expect(declined.status).toBe('declined')
      expect(declined.respondedAt).toBeDefined()
    })

    it('removes invitation from pending list after declining', async () => {
      const invitation = await createInvitation({
        roomId: testRoomId,
        userId: testUserId2,
        userName: 'Guest User',
        invitedBy: testUserId1,
        invitedByName: 'Host User',
        invitationType: 'manual',
      })

      // Decline
      await declineInvitation(invitation.id)

      // Verify no longer pending
      const pending = await getUserPendingInvitations(testUserId2)
      expect(pending).toHaveLength(0)
    })
  })

  describe('Canceling Invitations', () => {
    it('deletes invitation completely', async () => {
      await createInvitation({
        roomId: testRoomId,
        userId: testUserId2,
        userName: 'Guest User',
        invitedBy: testUserId1,
        invitedByName: 'Host User',
        invitationType: 'manual',
      })

      // Cancel
      await cancelInvitation(testRoomId, testUserId2)

      // Verify deleted
      const invitation = await getInvitation(testRoomId, testUserId2)
      expect(invitation).toBeUndefined()
    })
  })

  describe('Retrieving Invitations', () => {
    it('gets pending invitations for a user', async () => {
      // Create invitations for multiple rooms
      const room2 = await createRoom({
        name: 'Room 2',
        createdBy: testGuestId1,
        creatorName: 'Host',
        gameName: 'matching',
        gameConfig: {},
        accessMode: 'restricted',
      })

      await createInvitation({
        roomId: testRoomId,
        userId: testUserId2,
        userName: 'Guest',
        invitedBy: testUserId1,
        invitedByName: 'Host',
        invitationType: 'manual',
      })

      await createInvitation({
        roomId: room2.id,
        userId: testUserId2,
        userName: 'Guest',
        invitedBy: testUserId1,
        invitedByName: 'Host',
        invitationType: 'manual',
      })

      const pending = await getUserPendingInvitations(testUserId2)
      expect(pending).toHaveLength(2)

      // Clean up
      await db.delete(schema.arcadeRooms).where(eq(schema.arcadeRooms.id, room2.id))
    })

    it('only returns pending invitations, not accepted/declined', async () => {
      const inv1 = await createInvitation({
        roomId: testRoomId,
        userId: testUserId2,
        userName: 'Guest',
        invitedBy: testUserId1,
        invitedByName: 'Host',
        invitationType: 'manual',
      })

      // Create second room and invitation
      const room2 = await createRoom({
        name: 'Room 2',
        createdBy: testGuestId1,
        creatorName: 'Host',
        gameName: 'matching',
        gameConfig: {},
        accessMode: 'restricted',
      })

      const inv2 = await createInvitation({
        roomId: room2.id,
        userId: testUserId2,
        userName: 'Guest',
        invitedBy: testUserId1,
        invitedByName: 'Host',
        invitationType: 'manual',
      })

      // Accept first, decline second
      await acceptInvitation(inv1.id)
      await declineInvitation(inv2.id)

      // Should have no pending
      const pending = await getUserPendingInvitations(testUserId2)
      expect(pending).toHaveLength(0)

      // Clean up
      await db.delete(schema.arcadeRooms).where(eq(schema.arcadeRooms.id, room2.id))
    })
  })
})
