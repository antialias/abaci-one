/**
 * @vitest-environment node
 */

import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, schema } from '../src/db'
import { parentChild } from '../src/db/schema'
import {
  isParentOf,
  getParentedPlayerIds,
  canPerformAction,
  getAccessiblePlayers,
} from '../src/lib/classroom/access-control'

/**
 * Access Control Characterization Tests
 *
 * Captures the current behavior of the access control module so that
 * the refactor (unifying isParent/isParentOf/isValidParentOf into one
 * function) can be verified to preserve semantics.
 */

const TWENTY_FIVE_HOURS_MS = 25 * 60 * 60 * 1000

describe('Access Control', () => {
  // --- Fixtures ---
  let authenticatedUser: { id: string }
  let guestUser: { id: string }

  let ownedPlayer: { id: string }
  let sharedPlayerRecent: { id: string }
  let sharedPlayerExpired: { id: string }
  let orphanedPlayer: { id: string }
  let unlinkedPlayer: { id: string }

  let guestOwnedPlayer: { id: string }
  let guestSharedRecent: { id: string }
  let guestSharedExpired: { id: string }

  // Track user IDs for cleanup
  let otherOwnerId: string

  beforeEach(async () => {
    const ts = Date.now()
    const rand = Math.random().toString(36).slice(2)

    // --- Users ---
    const [authUser] = await db
      .insert(schema.users)
      .values({
        guestId: `test-auth-${ts}-${rand}`,
        upgradedAt: new Date(),
      })
      .returning()
    authenticatedUser = authUser

    const [gUser] = await db
      .insert(schema.users)
      .values({
        guestId: `test-guest-${ts}-${rand}`,
        // upgradedAt is null → guest
      })
      .returning()
    guestUser = gUser

    // A third user to own "shared" and "unlinked" players
    const [otherUser] = await db
      .insert(schema.users)
      .values({
        guestId: `test-other-${ts}-${rand}`,
        upgradedAt: new Date(),
      })
      .returning()
    otherOwnerId = otherUser.id

    // --- Players for authenticated user ---

    // ownedPlayer: user_id = authenticatedUser, parent_child link to authenticatedUser
    const [op] = await db
      .insert(schema.players)
      .values({ userId: authenticatedUser.id, name: 'Owned', emoji: '1', color: '#000' })
      .returning()
    ownedPlayer = op
    await db.insert(parentChild).values({
      parentUserId: authenticatedUser.id,
      childPlayerId: ownedPlayer.id,
    })

    // sharedPlayerRecent: owned by otherUser, parent_child link to authenticatedUser (recent)
    const [spr] = await db
      .insert(schema.players)
      .values({ userId: otherOwnerId, name: 'SharedRecent', emoji: '2', color: '#111' })
      .returning()
    sharedPlayerRecent = spr
    await db.insert(parentChild).values({
      parentUserId: authenticatedUser.id,
      childPlayerId: sharedPlayerRecent.id,
      // linkedAt defaults to now → recent
    })

    // sharedPlayerExpired: owned by otherUser, parent_child link to authenticatedUser (25h ago)
    const [spe] = await db
      .insert(schema.players)
      .values({ userId: otherOwnerId, name: 'SharedExpired', emoji: '3', color: '#222' })
      .returning()
    sharedPlayerExpired = spe
    await db.insert(parentChild).values({
      parentUserId: authenticatedUser.id,
      childPlayerId: sharedPlayerExpired.id,
      linkedAt: new Date(Date.now() - TWENTY_FIVE_HOURS_MS),
    })

    // orphanedPlayer: user_id = authenticatedUser, parent_child link to guestUser (not authenticatedUser)
    const [orph] = await db
      .insert(schema.players)
      .values({ userId: authenticatedUser.id, name: 'Orphaned', emoji: '4', color: '#333' })
      .returning()
    orphanedPlayer = orph
    await db.insert(parentChild).values({
      parentUserId: guestUser.id,
      childPlayerId: orphanedPlayer.id,
    })

    // unlinkedPlayer: owned by otherUser, NO parent_child link to authenticatedUser
    const [up] = await db
      .insert(schema.players)
      .values({ userId: otherOwnerId, name: 'Unlinked', emoji: '5', color: '#444' })
      .returning()
    unlinkedPlayer = up

    // --- Players for guest user ---

    // guestOwnedPlayer: user_id = guestUser, parent_child link to guestUser
    const [gop] = await db
      .insert(schema.players)
      .values({ userId: guestUser.id, name: 'GuestOwned', emoji: '6', color: '#555' })
      .returning()
    guestOwnedPlayer = gop
    await db.insert(parentChild).values({
      parentUserId: guestUser.id,
      childPlayerId: guestOwnedPlayer.id,
    })

    // guestSharedRecent: owned by otherUser, parent_child link to guestUser (recent)
    const [gsr] = await db
      .insert(schema.players)
      .values({ userId: otherOwnerId, name: 'GuestSharedRecent', emoji: '7', color: '#666' })
      .returning()
    guestSharedRecent = gsr
    await db.insert(parentChild).values({
      parentUserId: guestUser.id,
      childPlayerId: guestSharedRecent.id,
    })

    // guestSharedExpired: owned by otherUser, parent_child link to guestUser (25h ago)
    const [gse] = await db
      .insert(schema.players)
      .values({ userId: otherOwnerId, name: 'GuestSharedExpired', emoji: '8', color: '#777' })
      .returning()
    guestSharedExpired = gse
    await db.insert(parentChild).values({
      parentUserId: guestUser.id,
      childPlayerId: guestSharedExpired.id,
      linkedAt: new Date(Date.now() - TWENTY_FIVE_HOURS_MS),
    })
  })

  afterEach(async () => {
    // Delete users — cascade deletes players and parent_child rows
    await db.delete(schema.users).where(eq(schema.users.id, authenticatedUser.id))
    await db.delete(schema.users).where(eq(schema.users.id, guestUser.id))
    await db.delete(schema.users).where(eq(schema.users.id, otherOwnerId))
  })

  // -----------------------------------------------------------------------
  // isParentOf — THE single-player parent check
  // -----------------------------------------------------------------------
  describe('isParentOf', () => {
    it('authenticated user + owned player → true', async () => {
      expect(await isParentOf(authenticatedUser.id, ownedPlayer.id)).toBe(true)
    })

    it('authenticated user + shared recent → true', async () => {
      expect(await isParentOf(authenticatedUser.id, sharedPlayerRecent.id)).toBe(true)
    })

    it('authenticated user + shared expired → true (no guest expiry for authenticated)', async () => {
      expect(await isParentOf(authenticatedUser.id, sharedPlayerExpired.id)).toBe(true)
    })

    it('authenticated user + orphaned player → true (ownership via user_id)', async () => {
      expect(await isParentOf(authenticatedUser.id, orphanedPlayer.id)).toBe(true)
    })

    it('authenticated user + unlinked player → false', async () => {
      expect(await isParentOf(authenticatedUser.id, unlinkedPlayer.id)).toBe(false)
    })

    it('guest user + guest-owned player → true', async () => {
      expect(await isParentOf(guestUser.id, guestOwnedPlayer.id)).toBe(true)
    })

    it('guest user + guest-shared recent → true', async () => {
      expect(await isParentOf(guestUser.id, guestSharedRecent.id)).toBe(true)
    })

    it('guest user + guest-shared expired → false (24h expiry)', async () => {
      expect(await isParentOf(guestUser.id, guestSharedExpired.id)).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // getParentedPlayerIds — THE listing primitive
  // -----------------------------------------------------------------------
  describe('getParentedPlayerIds', () => {
    it('authenticated user → returns owned + shared (no expiry filtering)', async () => {
      const ids = await getParentedPlayerIds(authenticatedUser.id)
      expect(ids).toContain(ownedPlayer.id)
      expect(ids).toContain(sharedPlayerRecent.id)
      expect(ids).toContain(sharedPlayerExpired.id)
      expect(ids).not.toContain(unlinkedPlayer.id)
    })

    it('authenticated user → includes orphaned player (ownership via user_id)', async () => {
      const ids = await getParentedPlayerIds(authenticatedUser.id)
      expect(ids).toContain(orphanedPlayer.id)
    })

    it('guest user → returns owned + recent shared, excludes expired', async () => {
      const ids = await getParentedPlayerIds(guestUser.id)
      expect(ids).toContain(guestOwnedPlayer.id)
      expect(ids).toContain(guestSharedRecent.id)
      // The orphanedPlayer has a link from guestUser, but is owned by authenticatedUser
      // guestUser is a guest, so link age applies — it was created just now → should be included
      expect(ids).toContain(orphanedPlayer.id)
      expect(ids).not.toContain(guestSharedExpired.id)
    })
  })

  // -----------------------------------------------------------------------
  // canPerformAction
  // -----------------------------------------------------------------------
  describe('canPerformAction', () => {
    it("'view' on owned player → true", async () => {
      expect(await canPerformAction(authenticatedUser.id, ownedPlayer.id, 'view')).toBe(true)
    })

    it("'view' on orphaned player → true", async () => {
      expect(await canPerformAction(authenticatedUser.id, orphanedPlayer.id, 'view')).toBe(true)
    })

    it("'view' on unlinked player → false", async () => {
      expect(await canPerformAction(authenticatedUser.id, unlinkedPlayer.id, 'view')).toBe(false)
    })

    it("'start-session' on owned player → true", async () => {
      expect(await canPerformAction(authenticatedUser.id, ownedPlayer.id, 'start-session')).toBe(
        true
      )
    })

    it("'start-session' on unlinked player → false", async () => {
      expect(
        await canPerformAction(authenticatedUser.id, unlinkedPlayer.id, 'start-session')
      ).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // getAccessiblePlayers
  // -----------------------------------------------------------------------
  describe('getAccessiblePlayers', () => {
    it('returns owned + shared players in ownChildren', async () => {
      const result = await getAccessiblePlayers(authenticatedUser.id)
      const childIds = result.ownChildren.map((c) => c.id)
      expect(childIds).toContain(ownedPlayer.id)
      expect(childIds).toContain(sharedPlayerRecent.id)
      expect(childIds).toContain(sharedPlayerExpired.id)
    })

    it('returns orphaned player in ownChildren', async () => {
      const result = await getAccessiblePlayers(authenticatedUser.id)
      const childIds = result.ownChildren.map((c) => c.id)
      expect(childIds).toContain(orphanedPlayer.id)
    })

    it('does not return unlinked player', async () => {
      const result = await getAccessiblePlayers(authenticatedUser.id)
      const childIds = result.ownChildren.map((c) => c.id)
      expect(childIds).not.toContain(unlinkedPlayer.id)
    })
  })
})
