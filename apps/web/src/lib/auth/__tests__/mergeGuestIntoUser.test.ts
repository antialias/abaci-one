/**
 * @vitest-environment node
 *
 * Integration tests for mergeGuestIntoUser() against real SQLite DB.
 * Validates reparenting across table categories.
 */

import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Undo the global @/db mock from test setup so we use the real database
vi.unmock('@/db')

import { db, schema } from '@/db'
import { mergeGuestIntoUser } from '../mergeGuestIntoUser'
import { ensureTestSchema } from './setupTestDb'

// Run full migrations, then create stub tables for any that don't exist yet
beforeAll(async () => {
  await ensureTestSchema()
  for (const table of ['worksheet_mastery', 'worksheet_attempts', 'problem_attempts']) {
    await db.run(
      sql.raw(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, user_id TEXT NOT NULL)`)
    )
  }
})

function uniqueGuestId(prefix: string) {
  return `test-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

describe('mergeGuestIntoUser', () => {
  let sourceUserId: string
  let targetUserId: string

  beforeEach(async () => {
    const [sourceUser] = await db
      .insert(schema.users)
      .values({ guestId: uniqueGuestId('source') })
      .returning()
    const [targetUser] = await db
      .insert(schema.users)
      .values({ guestId: uniqueGuestId('target') })
      .returning()

    sourceUserId = sourceUser.id
    targetUserId = targetUser.id
  })

  afterEach(async () => {
    // Source may already be deleted by merge, so catch errors
    await db
      .delete(schema.users)
      .where(eq(schema.users.id, sourceUserId))
      .catch(() => {})
    await db
      .delete(schema.users)
      .where(eq(schema.users.id, targetUserId))
      .catch(() => {})
  })

  it('no-ops when sourceUserId === targetUserId', async () => {
    const [player] = await db
      .insert(schema.players)
      .values({
        userId: sourceUserId,
        name: 'Test Player',
        emoji: '😀',
        color: '#3b82f6',
      })
      .returning()

    await mergeGuestIntoUser(sourceUserId, sourceUserId)

    // Player should still belong to source user
    const found = await db.query.players.findFirst({
      where: eq(schema.players.id, player.id),
    })
    expect(found).toBeDefined()
    expect(found!.userId).toBe(sourceUserId)

    // Source user should still exist
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, sourceUserId),
    })
    expect(user).toBeDefined()
  })

  it('reparents players from source to target', async () => {
    const [player] = await db
      .insert(schema.players)
      .values({
        userId: sourceUserId,
        name: 'Guest Player',
        emoji: '🎮',
        color: '#ff0000',
      })
      .returning()

    await mergeGuestIntoUser(sourceUserId, targetUserId)

    const found = await db.query.players.findFirst({
      where: eq(schema.players.id, player.id),
    })
    expect(found).toBeDefined()
    expect(found!.userId).toBe(targetUserId)
  })

  it('reparents arcade_rooms.created_by', async () => {
    const code = `T${Date.now().toString(36).slice(-5).toUpperCase()}`
    const [room] = await db
      .insert(schema.arcadeRooms)
      .values({
        code,
        name: 'Test Room',
        createdBy: sourceUserId,
        creatorName: 'Guest',
        ttlMinutes: 60,
      })
      .returning()

    try {
      await mergeGuestIntoUser(sourceUserId, targetUserId)

      const found = await db.query.arcadeRooms.findFirst({
        where: eq(schema.arcadeRooms.id, room.id),
      })
      expect(found).toBeDefined()
      expect(found!.createdBy).toBe(targetUserId)
    } finally {
      await db.delete(schema.arcadeRooms).where(eq(schema.arcadeRooms.id, room.id))
    }
  })

  it('reparents room_members.user_id', async () => {
    const code = `T${Date.now().toString(36).slice(-5).toUpperCase()}`
    const [room] = await db
      .insert(schema.arcadeRooms)
      .values({
        code,
        name: 'Test Room',
        createdBy: targetUserId,
        creatorName: 'Target',
        ttlMinutes: 60,
      })
      .returning()

    const [member] = await db
      .insert(schema.roomMembers)
      .values({
        roomId: room.id,
        userId: sourceUserId,
        displayName: 'Guest',
      })
      .returning()

    try {
      await mergeGuestIntoUser(sourceUserId, targetUserId)

      const found = await db.query.roomMembers.findFirst({
        where: eq(schema.roomMembers.id, member.id),
      })
      expect(found).toBeDefined()
      expect(found!.userId).toBe(targetUserId)
    } finally {
      await db.delete(schema.arcadeRooms).where(eq(schema.arcadeRooms.id, room.id))
    }
  })

  it('reparents room_bans for both user_id and banned_by', async () => {
    const code = `T${Date.now().toString(36).slice(-5).toUpperCase()}`
    const [room] = await db
      .insert(schema.arcadeRooms)
      .values({
        code,
        name: 'Test Room',
        createdBy: targetUserId,
        creatorName: 'Target',
        ttlMinutes: 60,
      })
      .returning()

    // Source user is the banned user
    const [ban] = await db
      .insert(schema.roomBans)
      .values({
        roomId: room.id,
        userId: sourceUserId,
        userName: 'Guest',
        bannedBy: sourceUserId,
        bannedByName: 'Guest',
        reason: 'spam',
      })
      .returning()

    try {
      await mergeGuestIntoUser(sourceUserId, targetUserId)

      const found = await db.query.roomBans.findFirst({
        where: eq(schema.roomBans.id, ban.id),
      })
      expect(found).toBeDefined()
      expect(found!.userId).toBe(targetUserId)
      expect(found!.bannedBy).toBe(targetUserId)
    } finally {
      await db.delete(schema.arcadeRooms).where(eq(schema.arcadeRooms.id, room.id))
    }
  })

  it('transfers abacus_settings when target has none', async () => {
    await db.insert(schema.abacusSettings).values({
      userId: sourceUserId,
      colorScheme: 'heaven-earth',
      beadShape: 'circle',
    })

    await mergeGuestIntoUser(sourceUserId, targetUserId)

    const found = await db.query.abacusSettings.findFirst({
      where: eq(schema.abacusSettings.userId, targetUserId),
    })
    expect(found).toBeDefined()
    expect(found!.colorScheme).toBe('heaven-earth')
    expect(found!.beadShape).toBe('circle')
  })

  it('keeps target abacus_settings and drops source when both exist', async () => {
    await db.insert(schema.abacusSettings).values({
      userId: sourceUserId,
      colorScheme: 'heaven-earth',
      beadShape: 'circle',
    })
    await db.insert(schema.abacusSettings).values({
      userId: targetUserId,
      colorScheme: 'monochrome',
      beadShape: 'square',
    })

    await mergeGuestIntoUser(sourceUserId, targetUserId)

    const found = await db.query.abacusSettings.findFirst({
      where: eq(schema.abacusSettings.userId, targetUserId),
    })
    expect(found).toBeDefined()
    expect(found!.colorScheme).toBe('monochrome')
    expect(found!.beadShape).toBe('square')

    // Source settings should be gone
    const sourceSetting = await db.query.abacusSettings.findFirst({
      where: eq(schema.abacusSettings.userId, sourceUserId),
    })
    expect(sourceSetting).toBeUndefined()
  })

  it('deletes source user after merge', async () => {
    await mergeGuestIntoUser(sourceUserId, targetUserId)

    const found = await db.query.users.findFirst({
      where: eq(schema.users.id, sourceUserId),
    })
    expect(found).toBeUndefined()
  })

  it('cascade-deletes source auth_accounts', async () => {
    const [account] = await db
      .insert(schema.authAccounts)
      .values({
        userId: sourceUserId,
        provider: 'google',
        providerAccountId: `test-provider-${Date.now()}`,
        type: 'oauth',
      })
      .returning()

    await mergeGuestIntoUser(sourceUserId, targetUserId)

    const found = await db.query.authAccounts.findFirst({
      where: eq(schema.authAccounts.id, account.id),
    })
    expect(found).toBeUndefined()
  })
})
