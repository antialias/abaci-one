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
import type { SessionPart, SessionStatus, SlotResult } from '@/db/schema/session-plans'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
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
function makeSlotResult(
  overrides: Partial<SlotResult> & { partNumber: SlotResult['partNumber'] }
): SlotResult {
  return {
    slotId: 'test-slot-0',
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
      slotId: `test-${i}`,
      index: i,
      slotIndex: i,
      skillId: 'basic.directAddition',
      terms: [1, 2],
      purpose: 'focus' as const,
      constraints: {},
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
    status?: SessionStatus
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
    expect(playerResults[0].mode).toBe('visualization')
    expect(playerResults[0].sessionId).toBe('session-1')
    expect(playerResults[1].mode).toBe('abacus')
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
        makeSlotResult({
          partNumber: 1,
          slotIndex: 0,
          timestamp: new Date('2025-01-01T10:00:00Z'),
        }),
        makeSlotResult({
          partNumber: 1,
          slotIndex: 1,
          timestamp: new Date('2025-01-01T10:01:00Z'),
        }),
      ],
      completedAt: new Date('2025-01-01T10:10:00Z'),
    })
    await insertSession(ephemeralDb.db, {
      id: 'session-p2',
      playerId: player2,
      parts,
      results: [
        makeSlotResult({
          partNumber: 1,
          slotIndex: 0,
          timestamp: new Date('2025-01-02T10:00:00Z'),
        }),
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
        makeSlotResult({
          partNumber: 1,
          slotIndex: 0,
          timestamp: new Date('2025-01-01T10:00:00Z'),
        }),
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
    const result = makeSlotResult({
      partNumber: 1,
      slotIndex: 0,
      timestamp: new Date('2025-01-01T10:00:00Z'),
    })

    // Insert sessions with various statuses
    for (const status of ['draft', 'approved', 'in_progress', 'abandoned'] as SessionStatus[]) {
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
    expect(playerResults[0].mode).toBe('linear')
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
        makeSlotResult({
          partNumber: 1,
          slotIndex: 0,
          timestamp: new Date('2025-01-01T09:00:00Z'),
        }),
        makeSlotResult({
          partNumber: 1,
          slotIndex: 1,
          timestamp: new Date('2025-01-01T09:05:00Z'),
        }),
      ],
      completedAt: new Date('2025-01-01T09:10:00Z'),
    })
    await insertSession(ephemeralDb.db, {
      id: 'session-new',
      playerId,
      parts,
      results: [
        makeSlotResult({
          partNumber: 1,
          slotIndex: 0,
          timestamp: new Date('2025-01-02T10:00:00Z'),
        }),
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
    expect(playerResults[0].mode).toBe('linear')
    expect(playerResults[1].mode).toBe('visualization')
    expect(playerResults[2].mode).toBe('abacus')
  })

  it('assigns the same mode to multiple results from the same part', async () => {
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
    expect(playerResults.every((r) => r.mode === 'abacus')).toBe(true)
  })

  it('handles session with empty parts array', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'empty-parts')

    await insertSession(ephemeralDb.db, {
      id: 'session-empty-parts',
      playerId,
      parts: [],
      results: [
        makeSlotResult({
          partNumber: 1,
          slotIndex: 0,
          timestamp: new Date('2025-01-01T10:00:00Z'),
        }),
      ],
      completedAt: new Date('2025-01-01T10:10:00Z'),
    })

    const resultMap = await batchGetRecentSessionResults([playerId])
    const playerResults = resultMap.get(playerId)!
    expect(playerResults).toHaveLength(1)
    // No part to match: arithmetic with no type, whose presentation is 'linear'
    expect(playerResults[0].mode).toBe('linear')
  })

  // Practice kinds K0 pinned this filter as "rows whose skillsExercised is an
  // array" (review R1): a try stored without one vanished from readiness with
  // no error, which would drop every try of a kind whose evidence is not a
  // skill list on the row. K1b changes it on purpose (plan of record §4) to
  // "has `evidence` or a `skillsExercised` array": the evidence-only row is
  // now kept. A row with neither is still dropped, and an unstamped row's
  // evidence is still derived from its `skillsExercised` (amendment A4), so
  // the other rows read as before.
  it('keeps rows with evidence or a skillsExercised array (K1b)', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'row-filter')
    const at = new Date('2025-01-01T10:00:00Z')
    const row = (tryId: string, over: Record<string, unknown> = {}) =>
      ({ ...makeSlotResult({ partNumber: 1, timestamp: at }), tryId, ...over }) as SlotResult
    const { skillsExercised: _omitted, ...withoutSkills } = row('no-skills')

    await insertSession(ephemeralDb.db, {
      id: 'session-row-filter',
      playerId,
      parts: [makeSessionPart(1, 'abacus')],
      results: [
        row('with-skills'),
        row('empty-skills', { skillsExercised: [] }),
        withoutSkills as SlotResult,
        row('null-skills', { skillsExercised: null }),
        row('string-skills', { skillsExercised: 'basic.directAddition' }),
        // a row carrying only K1's envelope `evidence` (dropped before K1b)
        row('evidence-only', {
          skillsExercised: undefined,
          evidence: { skills: ['basic.directAddition'], presentation: 'abacus' },
        }),
      ],
      completedAt: new Date('2025-01-01T10:10:00Z'),
    })

    const kept = (await batchGetRecentSessionResults([playerId])).get(playerId) ?? []
    expect(kept.map((r) => r.tryId).sort()).toEqual([
      'empty-skills',
      'evidence-only',
      'with-skills',
    ])
    const evidenceOnly = kept.find((r) => r.tryId === 'evidence-only')
    expect(evidenceOnly?.evidence).toEqual({
      skills: ['basic.directAddition'],
      presentation: 'abacus',
    })
    expect(evidenceOnly?.mode).toBe('abacus')
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
        makeSlotResult({
          partNumber: 1,
          slotIndex: 0,
          timestamp: new Date('2025-01-01T10:00:00Z'),
        }),
      ],
      completedAt: new Date('2025-01-01T10:10:00Z'),
    })

    const results = await getRecentSessionResults(playerId, 50)
    expect(results).toHaveLength(1)
    expect(results[0].mode).toBe('abacus')
    expect(results[0].sessionId).toBe('session-delegate')
  })
})
