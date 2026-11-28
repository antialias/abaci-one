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
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from '@/test/journey-simulator/EphemeralDatabase'
import { readAbacusKind } from '../parts/__tests__/fixtures/read-abacus-kind'
import type { AnyPartKind } from '../parts/kind'
import { partKinds } from '../parts/registry'
import { getRecentSessionDates, getRecentSessions } from '../progress-manager'
import { buildSessionReports } from '../session-report-batch'

// Pass-through spy: the pin below reads the rows the query handed the builder
vi.mock('../session-report-batch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../session-report-batch')>()
  return { ...actual, buildSessionReports: vi.fn(actual.buildSessionReports) }
})

vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

// ============================================================================
// Helpers
// ============================================================================

// One item per slot index: the session report counts items, and an item is
// its slot (Phase 4d), so tries of different slots carry different ids
function makeSlotResult(overrides: Partial<SlotResult> = {}): SlotResult {
  return {
    slotId: `test-slot-${overrides.slotIndex ?? 0}`,
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
        'completedAt',
        'id',
        'phaseId',
        'playerId',
        'problemsAttempted',
        'problemsCorrect',
        // The session report's headline numbers (Phase 4d), not its rows
        'report',
        'unresolvedTimingCount',
        'skillsUsed',
        'startedAt',
        'totalTimeMs',
        'visualizationMode',
      ].sort()
    )

    // Belt-and-suspenders: the serialized response is small even though the
    // underlying row is fat. If someone re-introduces findMany() this jumps
    // by 30 KB+ and the assertion fires.
    const serialized = JSON.stringify(session)
    expect(serialized.length).toBeLessThan(2_000)

    // The query itself never pulls the full `parts` (#141): what the builder
    // received is the slim SQL projection. Selecting the full column (or
    // findMany) hands it the 30 KB blob and this fires.
    const rows = vi.mocked(buildSessionReports).mock.calls.at(-1)![0]
    const fat = rows.find((r) => r.id === 'fat')!
    expect(JSON.stringify(fat.parts).length).toBeLessThan(5_000)
    expect(fat.parts[0].slots).toHaveLength(100)
    expect(fat.parts[0].slots.map((slot) => slot.index)).toEqual(
      Array.from({ length: 100 }, (_, i) => i)
    )
  })

  // Practice-kinds K3: the slim projection works by kind. An arithmetic part is
  // reduced to its slots; a part of another kind passes whole, for its kind to
  // count (`items()`), and an unknown kind's part counts nothing and breaks nothing.
  it('slim parts by kind: an arithmetic part and a read_abacus part both count', async () => {
    const registry = partKinds as Map<string, AnyPartKind>
    registry.set(readAbacusKind.id, readAbacusKind as unknown as AnyPartKind)
    try {
      const arithmetic: SessionPart = {
        partNumber: 1,
        type: 'abacus',
        format: 'vertical',
        useAbacus: true,
        estimatedMinutes: 4,
        slots: Array.from({ length: 3 }, (_, i) => ({
          slotId: `slot-${i}`,
          index: i,
          purpose: 'focus',
          constraints: { allowedSkills: { heavy: true } },
          problem: { terms: [i, 1], answer: i + 1, skillsRequired: [] },
        })) as SessionPart['slots'],
      }
      const reading = {
        kind: 'read_abacus',
        partNumber: 2,
        presentation: 'static',
        content: {
          items: Array.from({ length: 4 }, (_, i) => ({
            itemId: `r${i}`,
            beadState: [i],
            expectedValue: i,
            skillsRequired: [],
          })),
        },
      }
      const unknown = { kind: 'zzz', partNumber: 3, content: { items: [{ itemId: 'z0' }] } }
      await insertSession(ephemeralDb.db, {
        id: 'mixed',
        playerId,
        parts: [arithmetic, reading, unknown] as unknown as SessionPart[],
        results: [makeSlotResult({ slotId: 'slot-0' })],
      })
      const [session] = await getRecentSessions(playerId, 10)
      expect(session.report.totals.plannedProblems).toBe(3 + 4)

      const rows = vi.mocked(buildSessionReports).mock.calls.at(-1)![0]
      const slim = rows.find((r) => r.id === 'mixed')!.parts as unknown[]
      // Arithmetic: slots only, the constraints left behind; the others whole
      expect(slim[0]).toEqual({
        kind: null,
        partNumber: 1,
        type: 'abacus',
        presentation: null,
        slots: [0, 1, 2].map((i) => ({
          slotId: `slot-${i}`,
          index: i,
          problem: { terms: [i, 1], answer: i + 1 },
        })),
      })
      expect(slim[1]).toEqual(reading)
      expect(slim[2]).toEqual(unknown)
    } finally {
      registry.delete(readAbacusKind.id)
    }
  })

  it('getRecentSessionDates: the same sessions, ids and dates only', async () => {
    await insertSession(ephemeralDb.db, {
      id: 'a',
      playerId,
      completedAt: new Date('2025-01-01T10:00:00Z'),
      results: [makeSlotResult()],
    })
    await insertSession(ephemeralDb.db, {
      id: 'b',
      playerId,
      completedAt: new Date('2025-01-02T10:00:00Z'),
      results: [makeSlotResult()],
    })
    const dates = await getRecentSessionDates(playerId, 10)
    const full = await getRecentSessions(playerId, 10)
    expect(dates.map((d) => d.id)).toEqual(full.map((s) => s.id))
    expect(dates.map((d) => Object.keys(d).sort())).toEqual([
      ['completedAt', 'id', 'startedAt'],
      ['completedAt', 'id', 'startedAt'],
    ])
    expect(dates.map((d) => d.startedAt.getTime())).toEqual(full.map((s) => s.startedAt.getTime()))
  })
})
