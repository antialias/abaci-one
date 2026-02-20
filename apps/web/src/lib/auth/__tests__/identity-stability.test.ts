/**
 * @vitest-environment node
 *
 * End-to-end tests validating that data created as a guest is accessible
 * after authentication, through both the upgrade and merge paths.
 *
 * Uses real DB for data, mocks getViewer() dependencies to simulate
 * auth state transitions.
 */

import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Undo the global @/db mock from test setup so we use the real database
vi.unmock('@/db')

import { db, schema } from '@/db'
import { mergeGuestIntoUser } from '../mergeGuestIntoUser'
import { upgradeGuestToUser } from '../upgradeGuestToUser'
import { ensureTestSchema } from './setupTestDb'

// Run full migrations, then create stub tables for any that don't exist yet
beforeAll(async () => {
  await ensureTestSchema()
  for (const table of ['worksheet_mastery', 'worksheet_attempts', 'problem_attempts']) {
    await db.run(
      sql.raw(
        `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, user_id TEXT NOT NULL)`
      )
    )
  }
})

// Mock next/headers
const mockHeadersGet = vi.fn()
const mockCookiesGet = vi.fn()

vi.mock('next/headers', () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: mockHeadersGet,
    })
  ),
  cookies: vi.fn(() =>
    Promise.resolve({
      get: mockCookiesGet,
    })
  ),
}))

// Mock @/auth
const mockAuth = vi.fn()
vi.mock('@/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args),
}))

// Mock guest-token
vi.mock('@/lib/guest-token', () => ({
  GUEST_COOKIE_NAME: 'guest',
  verifyGuestToken: vi.fn(),
}))

function uniqueGuestId(prefix: string) {
  return `test-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

describe('identity stability across auth transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(null)
    mockHeadersGet.mockReturnValue(null)
    mockCookiesGet.mockReturnValue(undefined)
  })

  describe('same-device upgrade', () => {
    let userId: string
    let guestId: string

    beforeEach(async () => {
      guestId = uniqueGuestId('upgrade')
      const [user] = await db.insert(schema.users).values({ guestId }).returning()
      userId = user.id
    })

    afterEach(async () => {
      await db.delete(schema.users).where(eq(schema.users.id, userId)).catch(() => {})
    })

    it('player created as guest is found via getDbUserId after upgrade', async () => {
      // Create a player while in guest state
      const [player] = await db
        .insert(schema.players)
        .values({
          userId,
          name: 'Guest Player',
          emoji: '🎮',
          color: '#ff0000',
        })
        .returning()

      // Simulate guest viewer
      mockHeadersGet.mockReturnValue(guestId)

      const { getDbUserId } = await import('@/lib/viewer')
      const guestDbUserId = await getDbUserId()
      expect(guestDbUserId).toBe(userId)

      // Upgrade guest to authenticated user
      await upgradeGuestToUser({
        guestId,
        email: `upgraded-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        provider: 'google',
        providerAccountId: `google-${Date.now()}`,
        providerType: 'oauth',
      })

      // Now simulate authenticated viewer
      mockHeadersGet.mockReturnValue(null)
      mockAuth.mockResolvedValue({
        user: { id: userId },
        expires: new Date(Date.now() + 86400000).toISOString(),
      })

      const authDbUserId = await getDbUserId()
      expect(authDbUserId).toBe(userId)

      // Player should still be accessible under the same user.id
      const players = await db.query.players.findMany({
        where: eq(schema.players.userId, authDbUserId),
      })
      expect(players).toHaveLength(1)
      expect(players[0].id).toBe(player.id)
      expect(players[0].name).toBe('Guest Player')
    })

    it('abacus_settings saved as guest persist after upgrade', async () => {
      // Save settings as guest
      await db.insert(schema.abacusSettings).values({
        userId,
        colorScheme: 'heaven-earth',
        beadShape: 'circle',
      })

      // Simulate guest viewer
      mockHeadersGet.mockReturnValue(guestId)

      const { getDbUserId } = await import('@/lib/viewer')
      const guestDbUserId = await getDbUserId()
      expect(guestDbUserId).toBe(userId)

      // Upgrade guest to authenticated user
      await upgradeGuestToUser({
        guestId,
        email: `upgraded-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        provider: 'google',
        providerAccountId: `google-${Date.now()}`,
        providerType: 'oauth',
      })

      // Now simulate authenticated viewer
      mockHeadersGet.mockReturnValue(null)
      mockAuth.mockResolvedValue({
        user: { id: userId },
        expires: new Date(Date.now() + 86400000).toISOString(),
      })

      const authDbUserId = await getDbUserId()
      expect(authDbUserId).toBe(userId)

      // Settings should still be accessible
      const settings = await db.query.abacusSettings.findFirst({
        where: eq(schema.abacusSettings.userId, authDbUserId),
      })
      expect(settings).toBeDefined()
      expect(settings!.colorScheme).toBe('heaven-earth')
      expect(settings!.beadShape).toBe('circle')
    })
  })

  describe('cross-device merge', () => {
    let sourceUserId: string
    let targetUserId: string
    let sourceGuestId: string

    beforeEach(async () => {
      sourceGuestId = uniqueGuestId('merge-source')
      const targetGuestId = uniqueGuestId('merge-target')

      const [sourceUser] = await db
        .insert(schema.users)
        .values({ guestId: sourceGuestId })
        .returning()
      const [targetUser] = await db
        .insert(schema.users)
        .values({ guestId: targetGuestId })
        .returning()

      sourceUserId = sourceUser.id
      targetUserId = targetUser.id
    })

    afterEach(async () => {
      await db.delete(schema.users).where(eq(schema.users.id, sourceUserId)).catch(() => {})
      await db.delete(schema.users).where(eq(schema.users.id, targetUserId)).catch(() => {})
    })

    it('player created as guest is found via getDbUserId after merge', async () => {
      // Create player as guest on source device
      const [player] = await db
        .insert(schema.players)
        .values({
          userId: sourceUserId,
          name: 'Guest Player',
          emoji: '🎮',
          color: '#ff0000',
        })
        .returning()

      // Simulate guest viewer on source device
      mockHeadersGet.mockReturnValue(sourceGuestId)

      const { getDbUserId } = await import('@/lib/viewer')
      const guestDbUserId = await getDbUserId()
      expect(guestDbUserId).toBe(sourceUserId)

      // Merge guest into existing auth user (simulating sign-in on new device)
      await mergeGuestIntoUser(sourceUserId, targetUserId)

      // Now simulate authenticated viewer (post-merge)
      mockHeadersGet.mockReturnValue(null)
      mockAuth.mockResolvedValue({
        user: { id: targetUserId },
        expires: new Date(Date.now() + 86400000).toISOString(),
      })

      const authDbUserId = await getDbUserId()
      expect(authDbUserId).toBe(targetUserId)

      // Player should now belong to target user
      const players = await db.query.players.findMany({
        where: eq(schema.players.userId, authDbUserId),
      })
      expect(players).toHaveLength(1)
      expect(players[0].id).toBe(player.id)
      expect(players[0].name).toBe('Guest Player')
    })

    it('arcade room created as guest has createdBy updated to auth user', async () => {
      const code = `T${Date.now().toString(36).slice(-5).toUpperCase()}`
      const [room] = await db
        .insert(schema.arcadeRooms)
        .values({
          code,
          name: 'Guest Room',
          createdBy: sourceUserId,
          creatorName: 'Guest',
          ttlMinutes: 60,
        })
        .returning()

      try {
        // Merge guest into auth user
        await mergeGuestIntoUser(sourceUserId, targetUserId)

        // Simulate authenticated viewer
        mockHeadersGet.mockReturnValue(null)
        mockAuth.mockResolvedValue({
          user: { id: targetUserId },
          expires: new Date(Date.now() + 86400000).toISOString(),
        })

        const { getDbUserId } = await import('@/lib/viewer')
        const authDbUserId = await getDbUserId()
        expect(authDbUserId).toBe(targetUserId)

        // Room should now belong to target user
        const found = await db.query.arcadeRooms.findFirst({
          where: eq(schema.arcadeRooms.id, room.id),
        })
        expect(found).toBeDefined()
        expect(found!.createdBy).toBe(authDbUserId)
      } finally {
        await db.delete(schema.arcadeRooms).where(eq(schema.arcadeRooms.id, room.id))
      }
    })
  })
})
