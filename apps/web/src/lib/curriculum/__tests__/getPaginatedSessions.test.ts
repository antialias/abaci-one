/**
 * @vitest-environment node
 *
 * Tests for getPaginatedSessions
 *
 * Uses an ephemeral in-memory SQLite database to verify:
 * - First-page behavior (with and without more results)
 * - Cursor-based pagination
 * - Session transformation to PracticeSession
 * - Edge cases (empty, exactly limit, single row)
 *
 * The tests run against the real Drizzle query path (db.select / db.query),
 * which is the right level to pin the column-projection behavior introduced
 * in #141: a regression that re-introduced findMany() without a projection
 * would still pass mock-based tests but break the real query.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionStatus, SlotResult } from '@/db/schema/session-plans'
import {
  createEphemeralDatabase,
  createTestStudent,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
  type EphemeralDbResult,
} from '@/test/journey-simulator/EphemeralDatabase'
import { getPaginatedSessions } from '../progress-manager'

vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

// ============================================================================
// Helpers
// ============================================================================

function makeSlotResult(overrides: Partial<SlotResult> = {}): SlotResult {
  return {
    slotId: 'test-slot-0',
    partNumber: 1,
    slotIndex: 0,
    problem: { terms: [1, 2], skillIds: ['basic.directAddition'], id: 'p1' } as any,
    studentAnswer: 3,
    isCorrect: true,
    responseTimeMs: 5000,
    skillsExercised: ['basic.directAddition'],
    usedOnScreenAbacus: false,
    timestamp: new Date(),
    hadHelp: false,
    incorrectAttempts: 0,
    ...overrides,
  }
}

async function insertSession(
  db: ReturnType<typeof getCurrentEphemeralDb>,
  opts: {
    id: string
    playerId: string
    status?: SessionStatus
    completedAt?: Date | null
    createdAt?: Date
    startedAt?: Date | null
    results?: SlotResult[]
  }
) {
  const now = new Date()
  await db.insert(schema.sessionPlans).values({
    id: opts.id,
    playerId: opts.playerId,
    status: opts.status ?? 'completed',
    parts: [],
    results: opts.results ?? [],
    completedAt: opts.completedAt !== undefined ? opts.completedAt : now,
    createdAt: opts.createdAt ?? now,
    startedAt: opts.startedAt !== undefined ? opts.startedAt : (opts.createdAt ?? now),
    targetDurationMinutes: 12,
    estimatedProblemCount: opts.results?.length ?? 0,
    avgTimePerProblemSeconds: 5,
    summary: { parts: [] } as any,
  })
}

/**
 * Insert a sequence of sessions whose completedAt timestamps are strictly
 * decreasing in insertion order, so session-0 is the most recent.
 *
 * Returns the IDs in newest-first order (matching dashboard sort order).
 */
async function insertSessions(
  db: ReturnType<typeof getCurrentEphemeralDb>,
  playerId: string,
  count: number,
  problemsPerSession: number = 10
): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const id = `session-${i}`
    // session-0 most recent, session-(N-1) oldest
    const completedAt = new Date(Date.UTC(2025, 0, count - i, 10, 0, 0))
    const results = Array.from({ length: problemsPerSession }, (_, j) =>
      makeSlotResult({
        slotIndex: j,
        isCorrect: j % 2 === 0,
        responseTimeMs: 3000 + j * 100,
        skillsExercised: [`skill-${j % 3}`],
      })
    )
    await insertSession(db, { id, playerId, completedAt, results })
    ids.push(id)
  }
  return ids
}

// ============================================================================
// Tests
// ============================================================================

describe('getPaginatedSessions', () => {
  let ephemeralDb: EphemeralDbResult
  let playerId: string

  beforeEach(async () => {
    ephemeralDb = createEphemeralDatabase()
    setCurrentEphemeralDb(ephemeralDb.db)
    const student = await createTestStudent(ephemeralDb.db, 'test-player')
    playerId = student.playerId
  })

  afterEach(() => {
    setCurrentEphemeralDb(null)
    ephemeralDb.cleanup()
  })

  describe('first page (no cursor)', () => {
    it('should return first page of sessions with hasMore=true when more exist', async () => {
      // 21 sessions, request 20 → expect hasMore + cursor on the 20th
      const ids = await insertSessions(ephemeralDb.db, playerId, 21)

      const result = await getPaginatedSessions(playerId, 20)

      expect(result.sessions).toHaveLength(20)
      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBe(ids[19])
    })

    it('should return all sessions with hasMore=false when fewer than limit', async () => {
      await insertSessions(ephemeralDb.db, playerId, 5)

      const result = await getPaginatedSessions(playerId, 20)

      expect(result.sessions).toHaveLength(5)
      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeNull()
    })

    it('should return empty array when no sessions exist', async () => {
      const result = await getPaginatedSessions(playerId, 20)

      expect(result.sessions).toHaveLength(0)
      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeNull()
    })
  })

  describe('subsequent pages (with cursor)', () => {
    it('should fetch sessions older than cursor', async () => {
      // 30 total, paginate by 20: page 1 returns 20, page 2 returns 10
      const ids = await insertSessions(ephemeralDb.db, playerId, 30)

      const page1 = await getPaginatedSessions(playerId, 20)
      expect(page1.sessions).toHaveLength(20)
      expect(page1.hasMore).toBe(true)
      expect(page1.nextCursor).toBe(ids[19])

      const page2 = await getPaginatedSessions(playerId, 20, page1.nextCursor!)
      expect(page2.sessions).toHaveLength(10)
      expect(page2.hasMore).toBe(false)
      expect(page2.nextCursor).toBeNull()
      // Page 2 should start at session-20 (next-oldest after the cursor)
      expect(page2.sessions[0].id).toBe(ids[20])
    })

    it('should return remaining sessions when cursor is near the end', async () => {
      const ids = await insertSessions(ephemeralDb.db, playerId, 5)
      // Cursor at session-1 (second-newest); should return session-2, -3, -4
      const result = await getPaginatedSessions(playerId, 20, ids[1])

      expect(result.sessions).toHaveLength(3)
      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeNull()
      expect(result.sessions.map((s) => s.id)).toEqual([ids[2], ids[3], ids[4]])
    })

    it('should handle cursor not found gracefully', async () => {
      const result = await getPaginatedSessions(playerId, 20, 'non-existent-cursor')

      // Cursor not found → no cursor condition added → returns first page (empty here)
      expect(result.sessions).toHaveLength(0)
      expect(result.hasMore).toBe(false)
    })
  })

  describe('session transformation', () => {
    it('should correctly transform session data to PracticeSession format', async () => {
      const results: SlotResult[] = Array.from({ length: 10 }, (_, i) =>
        makeSlotResult({
          slotIndex: i,
          isCorrect: i % 2 === 0,
          responseTimeMs: 3000 + i * 100,
          skillsExercised: [`skill-${i % 3}`],
        })
      )
      await insertSession(ephemeralDb.db, {
        id: 'session-1',
        playerId,
        completedAt: new Date('2024-01-15T10:00:00Z'),
        results,
      })

      const result = await getPaginatedSessions(playerId, 20)

      expect(result.sessions).toHaveLength(1)
      const session = result.sessions[0]
      expect(session.id).toBe('session-1')
      expect(session.playerId).toBe(playerId)
      expect(session.problemsAttempted).toBe(10)
      expect(session.problemsCorrect).toBe(5)
      expect(session.skillsUsed).toContain('skill-0')
      expect(session.skillsUsed).toContain('skill-1')
      expect(session.skillsUsed).toContain('skill-2')
    })

    it('should handle sessions with no results', async () => {
      await insertSession(ephemeralDb.db, {
        id: 'session-1',
        playerId,
        completedAt: new Date('2024-01-15T10:00:00Z'),
        results: [],
      })

      const result = await getPaginatedSessions(playerId, 20)

      expect(result.sessions).toHaveLength(1)
      const session = result.sessions[0]
      expect(session.problemsAttempted).toBe(0)
      expect(session.problemsCorrect).toBe(0)
      expect(session.averageTimeMs).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle exactly limit sessions (hasMore should be false)', async () => {
      await insertSessions(ephemeralDb.db, playerId, 20)

      const result = await getPaginatedSessions(playerId, 20)

      expect(result.sessions).toHaveLength(20)
      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeNull()
    })

    it('should handle limit of 1', async () => {
      const ids = await insertSessions(ephemeralDb.db, playerId, 2)

      const result = await getPaginatedSessions(playerId, 1)

      expect(result.sessions).toHaveLength(1)
      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBe(ids[0])
    })

    it('should use default limit of 20 when not specified', async () => {
      await insertSessions(ephemeralDb.db, playerId, 21)

      const result = await getPaginatedSessions(playerId)

      expect(result.sessions).toHaveLength(20)
      expect(result.hasMore).toBe(true)
    })
  })
})
