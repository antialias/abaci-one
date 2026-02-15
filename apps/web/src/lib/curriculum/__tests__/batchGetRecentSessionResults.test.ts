/**
 * @vitest-environment node
 *
 * Tests for batchGetRecentSessionResults
 *
 * Uses an ephemeral in-memory SQLite database to verify:
 * - Correct flattening of session results with partType resolution
 * - Per-player session cap
 * - Multi-player separation
 * - Timestamp sorting
 * - Edge cases (empty inputs, missing completedAt, missing parts)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'
import {
  createEphemeralDatabase,
  createTestStudent,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
  type EphemeralDbResult,
} from '@/test/journey-simulator/EphemeralDatabase'
import { batchGetRecentSessionResults } from '../session-planner'

// Mock the @/db module to use our ephemeral database
vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

// ============================================================================
// Helpers
// ============================================================================

/** Create a minimal SlotResult for testing */
function makeSlotResult(overrides: Partial<SlotResult> & { partNumber: SlotResult['partNumber'] }): SlotResult {
  return {
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

/** Create a minimal SessionPart for testing */
function makeSessionPart(
  partNumber: 1 | 2 | 3,
  type: 'abacus' | 'visualization' | 'linear',
  slotCount = 1
): SessionPart {
  return {
    partNumber,
    type,
    format: type === 'linear' ? 'linear' : 'vertical',
    useAbacus: type === 'abacus',
    slots: Array.from({ length: slotCount }, (_, i) => ({
      slotIndex: i,
      skillId: 'basic.directAddition',
      terms: [1, 2],
      purpose: 'focus' as const,
    })),
    estimatedMinutes: 4,
  }
}

/** Insert a completed session plan directly into the DB */
async function insertSession(
  db: ReturnType<typeof getCurrentEphemeralDb>,
  opts: {
    id: string
    playerId: string
    status?: string
    completedAt?: Date | null
    parts: SessionPart[]
    results: SlotResult[]
  }
) {
  const now = new Date()
  await db.insert(schema.sessionPlans).values({
    id: opts.id,
    playerId: opts.playerId,
    status: opts.status ?? 'completed',
    parts: opts.parts,
    results: opts.results,
    completedAt: opts.completedAt !== undefined ? opts.completedAt : now,
    createdAt: now,
    targetDurationMinutes: 12,
    estimatedProblemCount: opts.results.length,
    avgTimePerProblemSeconds: 5,
    summary: { parts: [] } as any,
  })
}

// ============================================================================
// Tests
// ============================================================================

describe('batchGetRecentSessionResults', () => {
  let ephemeralDb: EphemeralDbResult

  beforeEach(() => {
    ephemeralDb = createEphemeralDatabase()
    setCurrentEphemeralDb(ephemeralDb.db)
  })

  afterEach(() => {
    setCurrentEphemeralDb(null)
    ephemeralDb.cleanup()
  })

  it('returns empty map for empty playerIds', async () => {
    const result = await batchGetRecentSessionResults([])
    expect(result.size).toBe(0)
  })

  it('returns empty map when player has no sessions', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'no-sessions')
    const result = await batchGetRecentSessionResults([playerId])
    expect(result.size).toBe(0)
  })

  it('flattens a single session with correct partType', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'single-session')

    const parts = [makeSessionPart(1, 'abacus'), makeSessionPart(2, 'visualization')]
    const results = [
      makeSlotResult({ partNumber: 1, slotIndex: 0, timestamp: new Date('2025-01-01T10:00:00Z') }),
      makeSlotResult({ partNumber: 2, slotIndex: 0, timestamp: new Date('2025-01-01T10:05:00Z') }),
    ]

    await insertSession(ephemeralDb.db, {
      id: 'session-1',
      playerId,
      parts,
      results,
      completedAt: new Date('2025-01-01T10:10:00Z'),
    })

    const resultMap = await batchGetRecentSessionResults([playerId])
    expect(resultMap.size).toBe(1)

    const playerResults = resultMap.get(playerId)!
    expect(playerResults).toHaveLength(2)

    // Should be sorted most recent first
    expect(playerResults[0].partType).toBe('visualization')
    expect(playerResults[0].sessionId).toBe('session-1')
    expect(playerResults[1].partType).toBe('abacus')
  })

  it('separates results by player', async () => {
    const { playerId: player1 } = await createTestStudent(ephemeralDb.db, 'player-1')
    const { playerId: player2 } = await createTestStudent(ephemeralDb.db, 'player-2')

    const parts = [makeSessionPart(1, 'linear')]
    await insertSession(ephemeralDb.db, {
      id: 'session-p1',
      playerId: player1,
      parts,
      results: [
        makeSlotResult({ partNumber: 1, slotIndex: 0, timestamp: new Date('2025-01-01T10:00:00Z') }),
        makeSlotResult({ partNumber: 1, slotIndex: 1, timestamp: new Date('2025-01-01T10:01:00Z') }),
      ],
      completedAt: new Date('2025-01-01T10:10:00Z'),
    })
    await insertSession(ephemeralDb.db, {
      id: 'session-p2',
      playerId: player2,
      parts,
      results: [
        makeSlotResult({ partNumber: 1, slotIndex: 0, timestamp: new Date('2025-01-02T10:00:00Z') }),
      ],
      completedAt: new Date('2025-01-02T10:10:00Z'),
    })

    const resultMap = await batchGetRecentSessionResults([player1, player2])
    expect(resultMap.size).toBe(2)
    expect(resultMap.get(player1)).toHaveLength(2)
    expect(resultMap.get(player2)).toHaveLength(1)
  })

  it('respects per-player session cap', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'capped')

    const parts = [makeSessionPart(1, 'linear')]
    // Insert 5 sessions
    for (let i = 0; i < 5; i++) {
      await insertSession(ephemeralDb.db, {
        id: `session-${i}`,
        playerId,
        parts,
        results: [
          makeSlotResult({
            partNumber: 1,
            slotIndex: 0,
            timestamp: new Date(`2025-01-0${i + 1}T10:00:00Z`),
          }),
        ],
        completedAt: new Date(`2025-01-0${i + 1}T10:10:00Z`),
      })
    }

    // Cap at 3 sessions
    const resultMap = await batchGetRecentSessionResults([playerId], 3)
    const playerResults = resultMap.get(playerId)!

    // Should have results from only the 3 most recent sessions
    expect(playerResults).toHaveLength(3)
    // Most recent first (session-4 has Jan 5th)
    expect(playerResults[0].sessionId).toBe('session-4')
    expect(playerResults[1].sessionId).toBe('session-3')
    expect(playerResults[2].sessionId).toBe('session-2')
  })

  it('skips sessions without completedAt', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'null-completed')

    const parts = [makeSessionPart(1, 'linear')]
    await insertSession(ephemeralDb.db, {
      id: 'session-null',
      playerId,
      parts,
      results: [
        makeSlotResult({ partNumber: 1, slotIndex: 0, timestamp: new Date('2025-01-01T10:00:00Z') }),
      ],
      completedAt: null,
    })

    const resultMap = await batchGetRecentSessionResults([playerId])
    // Player should not appear in map since the only session has no completedAt
    expect(resultMap.size).toBe(0)
  })

  it('includes recency-refresh sessions', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'recency')

    const parts = [makeSessionPart(1, 'linear')]
    await insertSession(ephemeralDb.db, {
      id: 'session-refresh',
      playerId,
      status: 'recency-refresh',
      parts,
      results: [
        makeSlotResult({
          partNumber: 1,
          slotIndex: 0,
          timestamp: new Date('2025-01-01T10:00:00Z'),
          source: 'recency-refresh',
        } as any),
      ],
      completedAt: new Date('2025-01-01T10:10:00Z'),
    })

    const resultMap = await batchGetRecentSessionResults([playerId])
    expect(resultMap.get(playerId)).toHaveLength(1)
  })

  it('excludes non-completed/non-recency-refresh sessions', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'status-filter')

    const parts = [makeSessionPart(1, 'linear')]
    const result = makeSlotResult({ partNumber: 1, slotIndex: 0, timestamp: new Date('2025-01-01T10:00:00Z') })

    // Insert sessions with various statuses
    for (const status of ['draft', 'approved', 'in_progress', 'abandoned']) {
      await insertSession(ephemeralDb.db, {
        id: `session-${status}`,
        playerId,
        status,
        parts,
        results: [result],
        completedAt: new Date('2025-01-01T10:10:00Z'),
      })
    }

    const resultMap = await batchGetRecentSessionResults([playerId])
    expect(resultMap.size).toBe(0)
  })

  it('falls back to linear partType when part is not found', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'missing-part')

    // Result references partNumber 3 but only part 1 exists
    const parts = [makeSessionPart(1, 'abacus')]
    const results = [
      makeSlotResult({ partNumber: 3, slotIndex: 0, timestamp: new Date('2025-01-01T10:00:00Z') }),
    ]

    await insertSession(ephemeralDb.db, {
      id: 'session-mismatch',
      playerId,
      parts,
      results,
      completedAt: new Date('2025-01-01T10:10:00Z'),
    })

    const resultMap = await batchGetRecentSessionResults([playerId])
    const playerResults = resultMap.get(playerId)!
    expect(playerResults[0].partType).toBe('linear')
  })

  it('sorts results by timestamp descending within each player', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'sorting')

    // Two sessions, each with results at different times
    const parts = [makeSessionPart(1, 'linear')]
    await insertSession(ephemeralDb.db, {
      id: 'session-old',
      playerId,
      parts,
      results: [
        makeSlotResult({ partNumber: 1, slotIndex: 0, timestamp: new Date('2025-01-01T09:00:00Z') }),
        makeSlotResult({ partNumber: 1, slotIndex: 1, timestamp: new Date('2025-01-01T09:05:00Z') }),
      ],
      completedAt: new Date('2025-01-01T09:10:00Z'),
    })
    await insertSession(ephemeralDb.db, {
      id: 'session-new',
      playerId,
      parts,
      results: [
        makeSlotResult({ partNumber: 1, slotIndex: 0, timestamp: new Date('2025-01-02T10:00:00Z') }),
      ],
      completedAt: new Date('2025-01-02T10:10:00Z'),
    })

    const resultMap = await batchGetRecentSessionResults([playerId])
    const playerResults = resultMap.get(playerId)!
    expect(playerResults).toHaveLength(3)

    // Most recent first
    const timestamps = playerResults.map((r) => new Date(r.timestamp).getTime())
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i])
    }
  })

  it('resolves all three part types correctly in a single session', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'three-types')

    const parts = [
      makeSessionPart(1, 'abacus'),
      makeSessionPart(2, 'visualization'),
      makeSessionPart(3, 'linear'),
    ]
    const results = [
      makeSlotResult({ partNumber: 1, slotIndex: 0, timestamp: new Date('2025-01-01T10:00:00Z') }),
      makeSlotResult({ partNumber: 2, slotIndex: 0, timestamp: new Date('2025-01-01T10:02:00Z') }),
      makeSlotResult({ partNumber: 3, slotIndex: 0, timestamp: new Date('2025-01-01T10:04:00Z') }),
    ]

    await insertSession(ephemeralDb.db, {
      id: 'session-3types',
      playerId,
      parts,
      results,
      completedAt: new Date('2025-01-01T10:10:00Z'),
    })

    const resultMap = await batchGetRecentSessionResults([playerId])
    const playerResults = resultMap.get(playerId)!
    expect(playerResults).toHaveLength(3)

    // Sorted by timestamp desc, so linear (10:04) > visualization (10:02) > abacus (10:00)
    expect(playerResults[0].partType).toBe('linear')
    expect(playerResults[1].partType).toBe('visualization')
    expect(playerResults[2].partType).toBe('abacus')
  })

  it('assigns same partType to multiple results from the same part', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'same-part')

    const parts = [makeSessionPart(1, 'abacus', 3)]
    const results = [
      makeSlotResult({ partNumber: 1, slotIndex: 0, timestamp: new Date('2025-01-01T10:00:00Z') }),
      makeSlotResult({ partNumber: 1, slotIndex: 1, timestamp: new Date('2025-01-01T10:01:00Z') }),
      makeSlotResult({ partNumber: 1, slotIndex: 2, timestamp: new Date('2025-01-01T10:02:00Z') }),
    ]

    await insertSession(ephemeralDb.db, {
      id: 'session-same-part',
      playerId,
      parts,
      results,
      completedAt: new Date('2025-01-01T10:10:00Z'),
    })

    const resultMap = await batchGetRecentSessionResults([playerId])
    const playerResults = resultMap.get(playerId)!
    expect(playerResults).toHaveLength(3)
    expect(playerResults.every((r) => r.partType === 'abacus')).toBe(true)
  })

  it('handles session with empty parts array', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'empty-parts')

    await insertSession(ephemeralDb.db, {
      id: 'session-empty-parts',
      playerId,
      parts: [],
      results: [
        makeSlotResult({ partNumber: 1, slotIndex: 0, timestamp: new Date('2025-01-01T10:00:00Z') }),
      ],
      completedAt: new Date('2025-01-01T10:10:00Z'),
    })

    const resultMap = await batchGetRecentSessionResults([playerId])
    const playerResults = resultMap.get(playerId)!
    expect(playerResults).toHaveLength(1)
    // No parts to match, should fall back to 'linear'
    expect(playerResults[0].partType).toBe('linear')
  })

  it('getRecentSessionResults delegates to batch and returns correct results', async () => {
    // Import the single-player wrapper to verify it delegates correctly
    const { getRecentSessionResults } = await import('../session-planner')

    const { playerId } = await createTestStudent(ephemeralDb.db, 'delegate')

    const parts = [makeSessionPart(1, 'abacus')]
    await insertSession(ephemeralDb.db, {
      id: 'session-delegate',
      playerId,
      parts,
      results: [
        makeSlotResult({ partNumber: 1, slotIndex: 0, timestamp: new Date('2025-01-01T10:00:00Z') }),
      ],
      completedAt: new Date('2025-01-01T10:10:00Z'),
    })

    const results = await getRecentSessionResults(playerId, 50)
    expect(results).toHaveLength(1)
    expect(results[0].partType).toBe('abacus')
    expect(results[0].sessionId).toBe('session-delegate')
  })
})
