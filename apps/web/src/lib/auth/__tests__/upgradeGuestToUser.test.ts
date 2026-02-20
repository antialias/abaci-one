/**
 * @vitest-environment node
 *
 * Integration tests for upgradeGuestToUser() against real SQLite DB.
 * Validates the same-device guest→authenticated upgrade path.
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Undo the global @/db mock from test setup so we use the real database
vi.unmock('@/db')

import { db, schema } from '@/db'
import { upgradeGuestToUser } from '../upgradeGuestToUser'
import { ensureTestSchema } from './setupTestDb'

beforeAll(async () => {
  await ensureTestSchema()
})

function uniqueId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

describe('upgradeGuestToUser', () => {
  let testUserId: string
  let testGuestId: string
  let testEmail: string

  beforeEach(async () => {
    testGuestId = `test-guest-${uniqueId()}`
    testEmail = `test-${uniqueId()}@example.com`
    const [user] = await db.insert(schema.users).values({ guestId: testGuestId }).returning()
    testUserId = user.id
  })

  afterEach(async () => {
    await db.delete(schema.users).where(eq(schema.users.id, testUserId)).catch(() => {})
  })

  it('updates guest user row with email, name, image', async () => {
    await upgradeGuestToUser({
      guestId: testGuestId,
      email: testEmail,
      name: 'Test User',
      image: 'https://example.com/photo.jpg',
      provider: 'google',
      providerAccountId: `google-${uniqueId()}`,
      providerType: 'oauth',
    })

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, testUserId),
    })
    expect(user).toBeDefined()
    expect(user!.email).toBe(testEmail)
    expect(user!.name).toBe('Test User')
    expect(user!.image).toBe('https://example.com/photo.jpg')
  })

  it('sets upgradedAt timestamp', async () => {
    // Truncate to second precision — SQLite stores timestamps as integer seconds
    const before = new Date(Math.floor(Date.now() / 1000) * 1000)

    await upgradeGuestToUser({
      guestId: testGuestId,
      email: testEmail,
      provider: 'google',
      providerAccountId: `google-${uniqueId()}`,
      providerType: 'oauth',
    })

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, testUserId),
    })
    expect(user).toBeDefined()
    expect(user!.upgradedAt).toBeDefined()
    expect(user!.upgradedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })

  it('creates auth_accounts link for provider', async () => {
    const providerAccountId = `google-${uniqueId()}`

    await upgradeGuestToUser({
      guestId: testGuestId,
      email: testEmail,
      provider: 'google',
      providerAccountId,
      providerType: 'oauth',
    })

    const accounts = await db.query.authAccounts.findMany({
      where: eq(schema.authAccounts.userId, testUserId),
    })
    expect(accounts).toHaveLength(1)
    expect(accounts[0].provider).toBe('google')
    expect(accounts[0].providerAccountId).toBe(providerAccountId)
    expect(accounts[0].type).toBe('oauth')
  })

  it('preserves existing players (user.id unchanged)', async () => {
    const [player] = await db
      .insert(schema.players)
      .values({
        userId: testUserId,
        name: 'Guest Player',
        emoji: '🎮',
        color: '#ff0000',
      })
      .returning()

    const result = await upgradeGuestToUser({
      guestId: testGuestId,
      email: testEmail,
      provider: 'google',
      providerAccountId: `google-${uniqueId()}`,
      providerType: 'oauth',
    })

    // user.id should be unchanged
    expect(result).toBe(testUserId)

    // Player should still be accessible
    const found = await db.query.players.findFirst({
      where: eq(schema.players.id, player.id),
    })
    expect(found).toBeDefined()
    expect(found!.userId).toBe(testUserId)
    expect(found!.name).toBe('Guest Player')
  })

  it('returns user.id on success', async () => {
    const result = await upgradeGuestToUser({
      guestId: testGuestId,
      email: testEmail,
      provider: 'google',
      providerAccountId: `google-${uniqueId()}`,
      providerType: 'oauth',
    })

    expect(result).toBe(testUserId)
  })

  it('returns null if guestId not found', async () => {
    const result = await upgradeGuestToUser({
      guestId: 'nonexistent-guest-id',
      email: testEmail,
      provider: 'google',
      providerAccountId: `google-${uniqueId()}`,
      providerType: 'oauth',
    })

    expect(result).toBeNull()
  })
})
