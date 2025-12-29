/**
 * @vitest-environment node
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, schema } from '../src/db'
import type { SessionPart, SessionSummary } from '../src/db/schema/session-plans'
import {
  createSessionShare,
  getSessionShare,
  validateSessionShare,
  incrementShareViewCount,
  revokeSessionShare,
  revokeSharesForSession,
  getActiveSharesForSession,
  isValidShareToken,
  generateShareToken,
} from '../src/lib/session-share'

/**
 * Session Share E2E Tests
 *
 * Tests the session share database operations and validation logic.
 */

// Minimal valid session parts and summary for FK constraint satisfaction
const TEST_SESSION_PARTS: SessionPart[] = [
  {
    partNumber: 1,
    type: 'abacus',
    format: 'vertical',
    useAbacus: true,
    slots: [],
    estimatedMinutes: 5,
  },
]

const TEST_SESSION_SUMMARY: SessionSummary = {
  focusDescription: 'Test session',
  totalProblemCount: 0,
  estimatedMinutes: 5,
  parts: [
    {
      partNumber: 1,
      type: 'abacus',
      description: 'Test part',
      problemCount: 0,
      estimatedMinutes: 5,
    },
  ],
}

describe('Session Share API', () => {
  let testUserId: string
  let testPlayerId: string
  let testSessionId: string
  let testGuestId: string

  beforeEach(async () => {
    // Create a test user
    testGuestId = `test-guest-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const [user] = await db.insert(schema.users).values({ guestId: testGuestId }).returning()
    testUserId = user.id

    // Create a test player
    const [player] = await db
      .insert(schema.players)
      .values({
        userId: testUserId,
        name: 'Test Student',
        emoji: '🧪',
        color: '#FF5733',
      })
      .returning()
    testPlayerId = player.id

    // Create a real session plan (required due to FK constraint on sessionObservationShares)
    const [session] = await db
      .insert(schema.sessionPlans)
      .values({
        playerId: testPlayerId,
        targetDurationMinutes: 15,
        estimatedProblemCount: 10,
        avgTimePerProblemSeconds: 30,
        parts: TEST_SESSION_PARTS,
        summary: TEST_SESSION_SUMMARY,
        status: 'in_progress',
      })
      .returning()
    testSessionId = session.id
  })

  afterEach(async () => {
    // Clean up all test shares first
    await db
      .delete(schema.sessionObservationShares)
      .where(eq(schema.sessionObservationShares.createdBy, testUserId))

    // Clean up session plans (before player due to FK)
    await db.delete(schema.sessionPlans).where(eq(schema.sessionPlans.playerId, testPlayerId))

    // Then clean up user (cascades to player)
    await db.delete(schema.users).where(eq(schema.users.id, testUserId))
  })

  describe('createSessionShare', () => {
    it('creates a share with 1h expiration', async () => {
      const before = Date.now()
      const share = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')
      const after = Date.now()

      expect(share.id).toHaveLength(10)
      expect(isValidShareToken(share.id)).toBe(true)
      expect(share.sessionId).toBe(testSessionId)
      expect(share.playerId).toBe(testPlayerId)
      expect(share.createdBy).toBe(testUserId)
      expect(share.status).toBe('active')
      expect(share.viewCount).toBe(0)

      // Expiration should be ~1 hour from now
      const expectedExpiry = before + 60 * 60 * 1000
      const actualExpiry = share.expiresAt.getTime()
      expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 1000)
      expect(actualExpiry).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 1000)
    })

    it('creates a share with 24h expiration', async () => {
      const before = Date.now()
      const share = await createSessionShare(testSessionId, testPlayerId, testUserId, '24h')
      const after = Date.now()

      // Expiration should be ~24 hours from now
      const expectedExpiry = before + 24 * 60 * 60 * 1000
      const actualExpiry = share.expiresAt.getTime()
      expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 1000)
      expect(actualExpiry).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 1000)
    })

    it('generates unique tokens for each share', async () => {
      const share1 = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')
      const share2 = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')
      const share3 = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')

      expect(share1.id).not.toBe(share2.id)
      expect(share2.id).not.toBe(share3.id)
      expect(share1.id).not.toBe(share3.id)
    })
  })

  describe('getSessionShare', () => {
    it('returns share for valid token', async () => {
      const created = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')

      const retrieved = await getSessionShare(created.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(created.id)
      expect(retrieved!.sessionId).toBe(testSessionId)
    })

    it('returns null for invalid token format', async () => {
      const result = await getSessionShare('invalid!')
      expect(result).toBeNull()
    })

    it('returns null for non-existent token', async () => {
      const result = await getSessionShare('abcdef1234') // Valid format but doesn't exist
      expect(result).toBeNull()
    })
  })

  describe('validateSessionShare', () => {
    it('returns valid for active non-expired share', async () => {
      const share = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')

      const result = await validateSessionShare(share.id)

      expect(result.valid).toBe(true)
      expect(result.share).toBeDefined()
      expect(result.share!.id).toBe(share.id)
      expect(result.error).toBeUndefined()
    })

    it('returns invalid for non-existent token', async () => {
      const result = await validateSessionShare('abcdef1234')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Share link not found')
      expect(result.share).toBeUndefined()
    })

    it('returns invalid for revoked share', async () => {
      const share = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')
      await revokeSessionShare(share.id)

      const result = await validateSessionShare(share.id)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Share link has been revoked')
    })

    it('returns invalid and marks as expired for time-expired share', async () => {
      // Create share and manually set expired time in past
      const share = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')
      await db
        .update(schema.sessionObservationShares)
        .set({ expiresAt: new Date(Date.now() - 1000) }) // 1 second in past
        .where(eq(schema.sessionObservationShares.id, share.id))

      const result = await validateSessionShare(share.id)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Share link has expired')

      // Verify it was marked as expired in DB
      const updated = await getSessionShare(share.id)
      expect(updated!.status).toBe('expired')
    })
  })

  describe('incrementShareViewCount', () => {
    it('increments view count and updates lastViewedAt', async () => {
      const share = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')
      expect(share.viewCount).toBe(0)

      await incrementShareViewCount(share.id)

      const updated = await getSessionShare(share.id)
      expect(updated!.viewCount).toBe(1)
      expect(updated!.lastViewedAt).not.toBeNull()

      await incrementShareViewCount(share.id)
      await incrementShareViewCount(share.id)

      const final = await getSessionShare(share.id)
      expect(final!.viewCount).toBe(3)
    })

    it('does nothing for non-existent token', async () => {
      // Should not throw
      await incrementShareViewCount('abcdef1234')
    })
  })

  describe('revokeSessionShare', () => {
    it('marks share as revoked', async () => {
      const share = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')
      expect(share.status).toBe('active')

      await revokeSessionShare(share.id)

      const updated = await getSessionShare(share.id)
      expect(updated!.status).toBe('revoked')
    })
  })

  describe('revokeSharesForSession', () => {
    it('marks all active shares for session as expired', async () => {
      const share1 = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')
      const share2 = await createSessionShare(testSessionId, testPlayerId, testUserId, '24h')

      await revokeSharesForSession(testSessionId)

      const updated1 = await getSessionShare(share1.id)
      const updated2 = await getSessionShare(share2.id)
      expect(updated1!.status).toBe('expired')
      expect(updated2!.status).toBe('expired')
    })

    it('does not affect already revoked shares', async () => {
      const share = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')
      await revokeSessionShare(share.id)

      await revokeSharesForSession(testSessionId)

      const updated = await getSessionShare(share.id)
      expect(updated!.status).toBe('revoked') // Still revoked, not expired
    })

    it('does not affect shares for other sessions', async () => {
      // Create a second session for isolation test
      const [otherSession] = await db
        .insert(schema.sessionPlans)
        .values({
          playerId: testPlayerId,
          targetDurationMinutes: 15,
          estimatedProblemCount: 10,
          avgTimePerProblemSeconds: 30,
          parts: TEST_SESSION_PARTS,
          summary: TEST_SESSION_SUMMARY,
          status: 'in_progress',
        })
        .returning()

      const share1 = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')
      const share2 = await createSessionShare(otherSession.id, testPlayerId, testUserId, '1h')

      await revokeSharesForSession(testSessionId)

      const updated1 = await getSessionShare(share1.id)
      const updated2 = await getSessionShare(share2.id)
      expect(updated1!.status).toBe('expired')
      expect(updated2!.status).toBe('active') // Unaffected
    })
  })

  describe('getActiveSharesForSession', () => {
    it('returns only active shares for the session', async () => {
      const share1 = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')
      const share2 = await createSessionShare(testSessionId, testPlayerId, testUserId, '24h')
      const share3 = await createSessionShare(testSessionId, testPlayerId, testUserId, '1h')
      await revokeSessionShare(share3.id) // Revoke one

      const active = await getActiveSharesForSession(testSessionId)

      expect(active).toHaveLength(2)
      const ids = active.map((s) => s.id)
      expect(ids).toContain(share1.id)
      expect(ids).toContain(share2.id)
      expect(ids).not.toContain(share3.id)
    })

    it('returns empty array for session with no shares', async () => {
      const active = await getActiveSharesForSession('non-existent-session')
      expect(active).toEqual([])
    })
  })
})
