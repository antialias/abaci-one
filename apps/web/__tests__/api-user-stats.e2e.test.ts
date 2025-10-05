/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db, schema } from '../src/db'
import { eq } from 'drizzle-orm'

/**
 * API User Stats E2E Tests
 *
 * These tests verify the user-stats API endpoints work correctly.
 */

describe('User Stats API', () => {
  let testUserId: string
  let testGuestId: string

  beforeEach(async () => {
    // Create a test user with unique guest ID
    testGuestId = `test-guest-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const [user] = await db
      .insert(schema.users)
      .values({ guestId: testGuestId })
      .returning()
    testUserId = user.id
  })

  afterEach(async () => {
    // Clean up: delete test user (cascade deletes stats)
    await db.delete(schema.users).where(eq(schema.users.id, testUserId))
  })

  describe('GET /api/user-stats', () => {
    it('creates stats with defaults if none exist', async () => {
      const [stats] = await db
        .insert(schema.userStats)
        .values({ userId: testUserId })
        .returning()

      expect(stats).toBeDefined()
      expect(stats.gamesPlayed).toBe(0)
      expect(stats.totalWins).toBe(0)
      expect(stats.favoriteGameType).toBeNull()
      expect(stats.bestTime).toBeNull()
      expect(stats.highestAccuracy).toBe(0)
    })

    it('returns existing stats', async () => {
      // Create stats
      await db.insert(schema.userStats).values({
        userId: testUserId,
        gamesPlayed: 10,
        totalWins: 7,
        favoriteGameType: 'abacus-numeral',
        bestTime: 5000,
        highestAccuracy: 0.95,
      })

      const stats = await db.query.userStats.findFirst({
        where: eq(schema.userStats.userId, testUserId),
      })

      expect(stats).toBeDefined()
      expect(stats?.gamesPlayed).toBe(10)
      expect(stats?.totalWins).toBe(7)
      expect(stats?.favoriteGameType).toBe('abacus-numeral')
      expect(stats?.bestTime).toBe(5000)
      expect(stats?.highestAccuracy).toBe(0.95)
    })
  })

  describe('PATCH /api/user-stats', () => {
    it('creates new stats if none exist', async () => {
      const [stats] = await db
        .insert(schema.userStats)
        .values({
          userId: testUserId,
          gamesPlayed: 1,
          totalWins: 1,
        })
        .returning()

      expect(stats).toBeDefined()
      expect(stats.gamesPlayed).toBe(1)
      expect(stats.totalWins).toBe(1)
    })

    it('updates existing stats', async () => {
      // Create initial stats
      await db.insert(schema.userStats).values({
        userId: testUserId,
        gamesPlayed: 5,
        totalWins: 3,
      })

      // Update
      const [updated] = await db
        .update(schema.userStats)
        .set({
          gamesPlayed: 6,
          totalWins: 4,
          favoriteGameType: 'complement-pairs',
        })
        .where(eq(schema.userStats.userId, testUserId))
        .returning()

      expect(updated.gamesPlayed).toBe(6)
      expect(updated.totalWins).toBe(4)
      expect(updated.favoriteGameType).toBe('complement-pairs')
    })

    it('updates only provided fields', async () => {
      // Create initial stats
      await db.insert(schema.userStats).values({
        userId: testUserId,
        gamesPlayed: 10,
        totalWins: 5,
        bestTime: 3000,
      })

      // Update only gamesPlayed
      const [updated] = await db
        .update(schema.userStats)
        .set({ gamesPlayed: 11 })
        .where(eq(schema.userStats.userId, testUserId))
        .returning()

      expect(updated.gamesPlayed).toBe(11)
      expect(updated.totalWins).toBe(5) // unchanged
      expect(updated.bestTime).toBe(3000) // unchanged
    })

    it('allows setting favoriteGameType', async () => {
      await db.insert(schema.userStats).values({
        userId: testUserId,
      })

      const [updated] = await db
        .update(schema.userStats)
        .set({ favoriteGameType: 'abacus-numeral' })
        .where(eq(schema.userStats.userId, testUserId))
        .returning()

      expect(updated.favoriteGameType).toBe('abacus-numeral')
    })

    it('allows setting bestTime and highestAccuracy', async () => {
      await db.insert(schema.userStats).values({
        userId: testUserId,
      })

      const [updated] = await db
        .update(schema.userStats)
        .set({
          bestTime: 2500,
          highestAccuracy: 0.98,
        })
        .where(eq(schema.userStats.userId, testUserId))
        .returning()

      expect(updated.bestTime).toBe(2500)
      expect(updated.highestAccuracy).toBe(0.98)
    })
  })

  describe('Cascade delete behavior', () => {
    it('deletes stats when user is deleted', async () => {
      // Create stats
      await db.insert(schema.userStats).values({
        userId: testUserId,
        gamesPlayed: 10,
        totalWins: 5,
      })

      // Verify stats exist
      let stats = await db.query.userStats.findFirst({
        where: eq(schema.userStats.userId, testUserId),
      })
      expect(stats).toBeDefined()

      // Delete user
      await db.delete(schema.users).where(eq(schema.users.id, testUserId))

      // Verify stats are gone
      stats = await db.query.userStats.findFirst({
        where: eq(schema.userStats.userId, testUserId),
      })
      expect(stats).toBeUndefined()
    })
  })
})
