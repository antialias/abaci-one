/**
 * @vitest-environment node
 *
 * Tests for getRecentSessions
 *
 * Two roles:
 * 1. Behavioral — verify the transform from session_plans rows to PracticeSession.
 * 2. Projection pin — assert that the column projection stays narrow. Issue #141:
 *    a previous version selected every column (including `parts`, 10–50 KB of
 *    problem-generation traces per row) which blew libsql's HTTP response cap
 *    on heavy users. The pin breaks loudly if anyone re-introduces findMany()
 *    or otherwise widens the projection back to include those columns.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPart, SessionStatus, SlotResult } from '@/db/schema/session-plans'
import {
  createEphemeralDatabase,
  createTestStudent,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
  type EphemeralDbResult,
} from '@/test/journey-simulator/EphemeralDatabase'
import { getRecentSessions } from '../progress-manager'

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
    parts?: SessionPart[]
    results?: SlotResult[]
  }
) {
  const now = new Date()
  await db.insert(schema.sessionPlans).values({
    id: opts.id,
    playerId: opts.playerId,
    status: opts.status ?? 'completed',
    parts: opts.parts ?? [],
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

// ============================================================================
// Tests
// ============================================================================

describe('getRecentSessions', () => {
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

  it('returns empty array when player has no sessions', async () => {
    const result = await getRecentSessions(playerId, 10)
    expect(result).toEqual([])
  })

  it('returns sessions ordered by completedAt desc', async () => {
    await insertSession(ephemeralDb.db, {
      id: 'older',
      playerId,
      completedAt: new Date('2025-01-01T10:00:00Z'),
    })
    await insertSession(ephemeralDb.db, {
      id: 'newer',
      playerId,
      completedAt: new Date('2025-01-02T10:00:00Z'),
    })

    const result = await getRecentSessions(playerId, 10)
    expect(result.map((s) => s.id)).toEqual(['newer', 'older'])
  })

  it('respects the limit', async () => {
    for (let i = 0; i < 5; i++) {
      await insertSession(ephemeralDb.db, {
        id: `s-${i}`,
        playerId,
        completedAt: new Date(Date.UTC(2025, 0, 5 - i, 10, 0, 0)),
      })
    }

    const result = await getRecentSessions(playerId, 3)
    expect(result).toHaveLength(3)
  })

  it('only returns completed and abandoned sessions', async () => {
    const completedAt = new Date('2025-01-01T10:00:00Z')
    for (const status of [
      'draft',
      'approved',
      'in_progress',
      'completed',
      'abandoned',
    ] as SessionStatus[]) {
      await insertSession(ephemeralDb.db, {
        id: `s-${status}`,
        playerId,
        status,
        completedAt,
      })
    }

    const result = await getRecentSessions(playerId, 10)
    const ids = new Set(result.map((s) => s.id))
    expect(ids).toEqual(new Set(['s-completed', 's-abandoned']))
  })

  it('transforms slot results into aggregate stats', async () => {
    const results: SlotResult[] = [
      makeSlotResult({
        slotIndex: 0,
        isCorrect: true,
        responseTimeMs: 4000,
        skillsExercised: ['skill-a'],
      }),
      makeSlotResult({
        slotIndex: 1,
        isCorrect: false,
        responseTimeMs: 6000,
        skillsExercised: ['skill-a', 'skill-b'],
      }),
      makeSlotResult({
        slotIndex: 2,
        isCorrect: true,
        responseTimeMs: 5000,
        skillsExercised: ['skill-b'],
      }),
    ]
    await insertSession(ephemeralDb.db, {
      id: 'session-stats',
      playerId,
      completedAt: new Date('2025-01-01T10:00:00Z'),
      results,
    })

    const [session] = await getRecentSessions(playerId, 10)
    expect(session.problemsAttempted).toBe(3)
    expect(session.problemsCorrect).toBe(2)
    expect(session.totalTimeMs).toBe(15000)
    expect(session.averageTimeMs).toBe(5000)
    expect(new Set(session.skillsUsed)).toEqual(new Set(['skill-a', 'skill-b']))
  })

  it('handles sessions with no results', async () => {
    await insertSession(ephemeralDb.db, {
      id: 'empty',
      playerId,
      completedAt: new Date('2025-01-01T10:00:00Z'),
      results: [],
    })

    const [session] = await getRecentSessions(playerId, 10)
    expect(session.problemsAttempted).toBe(0)
    expect(session.problemsCorrect).toBe(0)
    expect(session.averageTimeMs).toBeNull()
    expect(session.skillsUsed).toEqual([])
  })

  it('falls back to createdAt when startedAt is null', async () => {
    const createdAt = new Date('2025-01-01T09:00:00Z')
    await insertSession(ephemeralDb.db, {
      id: 'no-started',
      playerId,
      createdAt,
      startedAt: null,
      completedAt: new Date('2025-01-01T10:00:00Z'),
    })

    const [session] = await getRecentSessions(playerId, 10)
    expect(session.startedAt.getTime()).toBe(createdAt.getTime())
  })

  // ==========================================================================
  // Projection pin (#141)
  //
  // The dashboard transform consumes only id, playerId, results, startedAt,
  // createdAt, completedAt. The implementation must NOT pull `parts`, `summary`,
  // or any other heavy column off the row, even though Drizzle's relational
  // query API would happily do so by default.
  //
  // We pin this by inserting a session whose `parts` blob is enormous (~30 KB).
  // If a future contributor regresses the projection to findMany(...) without
  // a `columns` filter, the test still passes the behavioral checks above —
  // but the serialized response size assertion below will fail loudly.
  // ==========================================================================

  it('does not include heavy columns (parts, etc.) in the response', async () => {
    // Build a 30 KB+ parts blob: ~100 fake slots with big constraint payloads
    const bigParts: SessionPart[] = [
      {
        partNumber: 1,
        type: 'abacus',
        format: 'vertical',
        useAbacus: true,
        estimatedMinutes: 4,
        slots: Array.from({ length: 100 }, (_, i) => ({
          slotId: `slot-${i}`,
          index: i,
          purpose: 'focus',
          constraints: {
            // Padding to push the row past libsql's threshold
            allowedSkills: Object.fromEntries(
              Array.from({ length: 30 }, (_, j) => [`skill-${j}`, true])
            ),
            targetSkills: Object.fromEntries(
              Array.from({ length: 30 }, (_, j) => [`skill-target-${j}`, 'x'.repeat(50)])
            ),
          },
        })) as any,
      },
    ]

    await insertSession(ephemeralDb.db, {
      id: 'fat',
      playerId,
      completedAt: new Date('2025-01-01T10:00:00Z'),
      parts: bigParts,
      results: [makeSlotResult()],
    })

    // Sanity: the row's `parts` is actually fat (this validates the test fixture)
    const stored = await ephemeralDb.db.query.sessionPlans.findFirst({
      where: (sp, { eq }) => eq(sp.id, 'fat'),
    })
    const partsSize = JSON.stringify(stored!.parts).length
    expect(partsSize).toBeGreaterThan(30_000)

    const [session] = await getRecentSessions(playerId, 10)

    // The returned PracticeSession must not carry parts (or any other heavy
    // column). Asserting the exact key set is the strongest projection pin:
    // any new field that leaks through here trips the test.
    expect(Object.keys(session).sort()).toEqual(
      [
        'averageTimeMs',
        'cleanTotalTimeMs',
        'completedAt',
        'id',
        'phaseId',
        'playerId',
        'problemsAttempted',
        'problemsCorrect',
        'quarantinedTimingCount',
        'unresolvedTimingCount',
        'skillsUsed',
        'startedAt',
        'timedProblemCount',
        'totalTimeMs',
        'visualizationMode',
      ].sort()
    )

    // Belt-and-suspenders: the serialized response is small even though the
    // underlying row is fat. If someone re-introduces findMany() this jumps
    // by 30 KB+ and the assertion fires.
    const serialized = JSON.stringify(session)
    expect(serialized.length).toBeLessThan(2_000)
  })
})
