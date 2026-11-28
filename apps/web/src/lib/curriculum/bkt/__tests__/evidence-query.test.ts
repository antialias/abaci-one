/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { normalizeTries } from '@/db/schema/session-plan-normalize'
import type { SessionPart, SessionStatus, SlotResult } from '@/db/schema/session-plans'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from '@/test/journey-simulator/EphemeralDatabase'
import { arithmeticKind } from '../../parts/arithmetic/server'
import { batchGetRecentSessionResults } from '../../session-planner'
import { computeBktFromHistory } from '../compute-bkt'
import { BKT_EVIDENCE_PLAYER_CHUNK_SIZE, batchGetRecentBktEvidence } from '../evidence-query'

vi.mock('server-only', () => ({}))

vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

function makeSlotResult(
  overrides: Partial<SlotResult> & {
    partNumber?: SlotResult['partNumber']
  } = {}
): SlotResult {
  return {
    slotId: 'test-slot',
    partNumber: 1,
    slotIndex: 0,
    problem: {
      terms: [1, 2],
      skillIds: ['basic.directAddition'],
      id: 'problem',
    } as never,
    studentAnswer: 3,
    isCorrect: true,
    responseTimeMs: 5_000,
    skillsExercised: ['basic.directAddition'],
    usedOnScreenAbacus: false,
    timestamp: new Date('2026-01-01T12:00:00Z'),
    hadHelp: false,
    incorrectAttempts: 0,
    ...overrides,
  }
}

function makeSessionPart(
  partNumber: 1 | 2 | 3,
  type: 'abacus' | 'visualization' | 'linear',
  problem: SessionPart['slots'][number]['problem'] = undefined
): SessionPart {
  return {
    partNumber,
    type,
    format: type === 'linear' ? 'linear' : 'vertical',
    useAbacus: type === 'abacus',
    slots: [
      {
        slotId: `slot-${partNumber}`,
        index: 0,
        purpose: 'focus',
        constraints: {},
        problem,
      },
    ],
    estimatedMinutes: 4,
  }
}

async function insertSession(options: {
  id: string
  playerId: string
  results: SlotResult[]
  parts?: SessionPart[]
  status?: SessionStatus
  completedAt?: Date | null
}) {
  const now = new Date()
  await getCurrentEphemeralDb()
    .insert(schema.sessionPlans)
    .values({
      id: options.id,
      playerId: options.playerId,
      status: options.status ?? 'completed',
      parts: options.parts ?? [makeSessionPart(1, 'linear')],
      results: options.results,
      completedAt: options.completedAt === undefined ? now : options.completedAt,
      createdAt: now,
      targetDurationMinutes: 12,
      estimatedProblemCount: options.results.length,
      avgTimePerProblemSeconds: 5,
      summary: { parts: [] } as never,
    })
}

describe('batchGetRecentBktEvidence', () => {
  let ephemeralDb: EphemeralDbResult

  beforeEach(() => {
    ephemeralDb = createEphemeralDatabase()
    setCurrentEphemeralDb(ephemeralDb.db)
  })

  afterEach(() => {
    setCurrentEphemeralDb(null)
    ephemeralDb.cleanup()
  })

  it('returns empty results without querying for empty inputs or a zero limit', async () => {
    expect(await batchGetRecentBktEvidence([])).toEqual(new Map())
    expect(await batchGetRecentBktEvidence(['unused'], 0)).toEqual(new Map())
  })

  it('projects every field BKT uses and resolves the practice mode', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'projection')
    const timingReview = {
      adjustedResponseTimeMs: 2_500,
      reviewedBy: 'adult',
      reviewedAt: '2026-01-01T13:00:00Z',
    }
    await insertSession({
      id: 'projection-session',
      playerId,
      parts: [makeSessionPart(1, 'abacus')],
      results: [
        makeSlotResult({
          isCorrect: false,
          responseTimeMs: 30_000,
          skillsExercised: ['fiveComplement.add.4'],
          hadHelp: true,
          masteryWeight: 0.5,
          source: 'teacher-corrected',
          originalSource: 'practice',
          timingReview,
        }),
      ],
    })

    const evidence = (await batchGetRecentBktEvidence([playerId])).get(playerId)

    expect(evidence).toEqual([
      expect.objectContaining({
        skillsExercised: ['fiveComplement.add.4'],
        isCorrect: false,
        responseTimeMs: 30_000,
        hadHelp: true,
        masteryWeight: 0.5,
        source: 'teacher-corrected',
        originalSource: 'practice',
        timingReview,
        partType: 'abacus',
      }),
    ])
    expect('problem' in evidence![0]).toBe(false)
    expect('sessionId' in evidence![0]).toBe(false)
  })

  it('enforces the recent-session limit per player inside the query', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'bounded')

    for (let day = 1; day <= 4; day++) {
      await insertSession({
        id: `session-${day}`,
        playerId,
        completedAt: new Date(`2026-01-0${day}T13:00:00Z`),
        results: [
          makeSlotResult({
            skillsExercised: [`skill-${day}`],
            timestamp: new Date(`2026-01-0${day}T12:00:00Z`),
          }),
        ],
      })
    }

    const evidence = (await batchGetRecentBktEvidence([playerId], 2)).get(playerId)!
    expect(evidence.map((item) => item.skillsExercised[0])).toEqual(['skill-4', 'skill-3'])
  })

  it('filters session status and null completion dates before ranking', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'statuses')
    const statuses: SessionStatus[] = ['draft', 'approved', 'in_progress', 'abandoned', 'deleted']

    for (const status of statuses) {
      await insertSession({
        id: `excluded-${status}`,
        playerId,
        status,
        results: [makeSlotResult({ skillsExercised: [status] })],
      })
    }
    await insertSession({
      id: 'null-completed',
      playerId,
      completedAt: null,
      results: [makeSlotResult({ skillsExercised: ['null-completed'] })],
    })
    await insertSession({
      id: 'completed',
      playerId,
      results: [makeSlotResult({ skillsExercised: ['completed'] })],
    })
    await insertSession({
      id: 'refresh',
      playerId,
      status: 'recency-refresh',
      results: [
        makeSlotResult({
          skillsExercised: ['refresh'],
          source: 'recency-refresh',
          responseTimeMs: 0,
        }),
      ],
    })

    const evidence = (await batchGetRecentBktEvidence([playerId])).get(playerId)!
    expect(evidence.map((item) => item.skillsExercised[0]).sort()).toEqual(['completed', 'refresh'])
  })

  it('chunks large player lists without losing or mixing evidence', async () => {
    const playerIds: string[] = []

    for (let index = 0; index <= BKT_EVIDENCE_PLAYER_CHUNK_SIZE; index++) {
      const { playerId } = await createTestStudent(ephemeralDb.db, `chunk-${index}`)
      playerIds.push(playerId)
      await insertSession({
        id: `chunk-session-${index}`,
        playerId,
        results: [makeSlotResult({ skillsExercised: [`chunk-skill-${index}`] })],
      })
    }

    const result = await batchGetRecentBktEvidence([...playerIds, playerIds[0]])
    expect(result.size).toBe(playerIds.length)
    playerIds.forEach((playerId, index) => {
      expect(result.get(playerId)?.[0].skillsExercised).toEqual([`chunk-skill-${index}`])
    })
  })

  it('produces the same BKT state as the full historical result query', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'semantic-parity')
    const parts = [makeSessionPart(1, 'abacus'), makeSessionPart(2, 'visualization')]

    await insertSession({
      id: 'parity-completed',
      playerId,
      parts,
      completedAt: new Date('2026-01-03T13:00:00Z'),
      results: [
        makeSlotResult({
          partNumber: 1,
          timestamp: new Date('2026-01-01T12:00:00Z'),
          skillsExercised: ['fiveComplement.add.4'],
        }),
        makeSlotResult({
          partNumber: 2,
          timestamp: new Date('2026-01-02T12:00:00Z'),
          skillsExercised: ['fiveComplement.add.4', 'tenComplement.add.9'],
          isCorrect: false,
          hadHelp: true,
          masteryWeight: 0.5,
          timingReview: {
            adjustedResponseTimeMs: 8_000,
            reviewedBy: 'adult',
            reviewedAt: '2026-01-02T13:00:00Z',
          },
        }),
        makeSlotResult({
          partNumber: 2,
          timestamp: new Date('2026-01-03T12:00:00Z'),
          skillsExercised: ['tenComplement.add.9'],
          source: 'teacher-excluded',
          originalSource: 'practice',
        }),
      ],
    })
    await insertSession({
      id: 'parity-refresh',
      playerId,
      status: 'recency-refresh',
      completedAt: new Date('2026-01-04T13:00:00Z'),
      results: [
        makeSlotResult({
          timestamp: new Date('2026-01-04T12:00:00Z'),
          skillsExercised: ['fiveComplement.add.4'],
          source: 'recency-refresh',
          responseTimeMs: 0,
        }),
      ],
    })

    const full = (await batchGetRecentSessionResults([playerId], 100)).get(playerId)!
    const lean = (await batchGetRecentBktEvidence([playerId], 100)).get(playerId)!

    expect(computeBktFromHistory(lean)).toEqual(computeBktFromHistory(full))
  })

  it('does not return large problem or generation-trace payloads', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'large-payload')
    const generationTrace = 'large-trace-'.repeat(100_000)
    const largeProblem = {
      id: 'large-problem',
      terms: [1, 2],
      skillIds: ['basic.directAddition'],
      generationTrace,
    }

    await insertSession({
      id: 'large-payload-session',
      playerId,
      parts: [makeSessionPart(1, 'linear', largeProblem as never)],
      results: [makeSlotResult({ problem: largeProblem as never })],
    })

    const evidence = (await batchGetRecentBktEvidence([playerId])).get(playerId)!
    expect(JSON.stringify(evidence).length).toBeLessThan(1_000)
    expect(JSON.stringify(evidence)).not.toContain('large-trace')
  })

  it('weighs legacy wrong rows stored at 0 the same way on both paths (Phase 1w, retroactive)', async () => {
    const skill = 'fiveComplement.add.4'
    const history = (wrong: SlotResult[]) => [
      ...[1, 2, 3, 4].map((i) =>
        makeSlotResult({
          skillsExercised: [skill],
          masteryWeight: 1,
          timestamp: new Date(`2026-01-01T12:0${i}:00Z`),
        })
      ),
      ...wrong,
    ]
    // Main's wrong rows: weight 0, no Phase 1 stamps (a first try, a round-1
    // retry, a do-over, which stays 0), then a Phase 1 row stamped kind/round with weight 0
    const legacyWrong = [
      makeSlotResult({ skillsExercised: [skill], isCorrect: false, masteryWeight: 0 }),
      makeSlotResult({
        skillsExercised: [skill],
        isCorrect: false,
        isRetry: true,
        epochNumber: 1,
        masteryWeight: 0,
      }),
      makeSlotResult({
        skillsExercised: [skill],
        isCorrect: false,
        isManualRedo: true,
        epochNumber: 0,
        masteryWeight: 0,
      }),
      makeSlotResult({
        skillsExercised: [skill],
        isCorrect: false,
        kind: 'retry',
        round: 2,
        practiceOnly: false,
        masteryWeight: 0,
      }),
    ].map((r, i) => ({ ...r, timestamp: new Date(`2026-01-01T12:1${i}:00Z`) }))

    const { playerId: withWrong } = await createTestStudent(ephemeralDb.db, 'legacy-wrong')
    await insertSession({ id: 'legacy-wrong', playerId: withWrong, results: history(legacyWrong) })
    const { playerId: without } = await createTestStudent(ephemeralDb.db, 'no-wrong')
    await insertSession({ id: 'no-wrong', playerId: without, results: history([]) })

    const lean = (await batchGetRecentBktEvidence([withWrong], 100)).get(withWrong)!
    const full = (await batchGetRecentSessionResults([withWrong], 100)).get(withWrong)!
    const leanWithout = (await batchGetRecentBktEvidence([without], 100)).get(without)!

    expect(lean.filter((e) => !e.isCorrect)).toEqual([
      expect.objectContaining({ kind: 'retry', round: 2 }),
      expect.objectContaining({ isManualRedo: true, epochNumber: 0 }),
      expect.objectContaining({ isRetry: true, epochNumber: 1 }),
      expect.objectContaining({ masteryWeight: 0 }),
    ])
    const pKnown = (e: Parameters<typeof computeBktFromHistory>[0]) =>
      computeBktFromHistory(e, { applyDecay: false }).skills.find((s) => s.skillId === skill)!
        .pKnown
    expect(computeBktFromHistory(lean)).toEqual(computeBktFromHistory(full))
    // Each of these wrong rows would have left pKnown alone at weight 0; three now count
    expect(pKnown(lean)).toBeLessThan(pKnown(leanWithout) - 0.02)
  })

  it('keeps legacy rows whose practice-only flag is derived only (Phase 6a: the stamp only)', async () => {
    const skill = 'fiveComplement.add.4'
    const problem = { terms: [4, 1], answer: 5, skillsRequired: [skill] } as never
    const at = (i: number) => new Date(`2026-01-01T12:0${i}:00Z`)
    const base = { slotId: 'slot-1', slotIndex: 0, problem, skillsExercised: [skill] }
    // Pre-Phase-1 rows of one item: right, then the same original submitted
    // again wrong (bug 3), then a do-over of the item already right
    const results = [
      makeSlotResult({
        ...base,
        masteryWeight: 1,
        isRetry: false,
        epochNumber: 0,
        timestamp: at(1),
      }),
      makeSlotResult({
        ...base,
        isCorrect: false,
        studentAnswer: 0,
        masteryWeight: 0,
        isRetry: false,
        epochNumber: 0,
        timestamp: at(2),
      }),
      makeSlotResult({
        ...base,
        masteryWeight: 1,
        isManualRedo: true,
        isRetry: false,
        epochNumber: 0,
        timestamp: at(3),
      }),
    ]
    const parts = [makeSessionPart(1, 'abacus', problem)]
    expect(
      normalizeTries('derived-only', parts, results).map((t) => [
        t.practiceOnly,
        t.practiceOnlyDerived,
      ])
    ).toEqual([
      [false, false],
      [false, true],
      [false, true],
    ])

    const { playerId } = await createTestStudent(ephemeralDb.db, 'derived-only')
    await insertSession({ id: 'derived-only', playerId, results, parts })
    const lean = (await batchGetRecentBktEvidence([playerId], 100)).get(playerId)!
    const full = (await batchGetRecentSessionResults([playerId], 100)).get(playerId)!
    expect(lean).toHaveLength(3)
    expect(computeBktFromHistory(lean)).toEqual(computeBktFromHistory(full))
    expect(
      computeBktFromHistory(lean, { applyDecay: false }).skills.map((s) => [
        s.opportunities,
        s.successCount,
      ])
    ).toEqual([[3, 2]])
  })

  it('weighs rows written without the legacy fields as rows with them (Phase 6a)', async () => {
    const skill = 'fiveComplement.add.4'
    const at = (i: number) => new Date(`2026-01-01T12:${String(10 + i)}:00Z`)
    // As the writers record them: a wrong first try, its wrong round-1 retry,
    // a counted wrong do-over, a practice-only do-over, a right retry
    const written = [
      makeSlotResult({
        kind: 'first',
        round: 0,
        isCorrect: false,
        masteryWeight: 1,
        isRetry: false,
        epochNumber: 0,
        originalSlotIndex: 0,
      }),
      makeSlotResult({
        kind: 'retry',
        round: 1,
        isCorrect: false,
        masteryWeight: 0.5,
        isRetry: true,
        epochNumber: 1,
        originalSlotIndex: 0,
      }),
      makeSlotResult({
        kind: 'do_over',
        round: 2,
        isCorrect: false,
        masteryWeight: 0.25,
        isManualRedo: true,
        isRetry: false,
        epochNumber: 0,
        originalSlotIndex: 0,
      }),
      makeSlotResult({
        kind: 'do_over',
        round: 2,
        practiceOnly: true,
        masteryWeight: 0,
        isManualRedo: true,
        isRetry: false,
        epochNumber: 0,
        originalSlotIndex: 0,
      }),
      makeSlotResult({
        kind: 'retry',
        round: 2,
        masteryWeight: 0.25,
        isRetry: true,
        epochNumber: 2,
        originalSlotIndex: 0,
      }),
    ].map((r, i) => ({
      ...r,
      practiceOnly: r.practiceOnly ?? false,
      skillsExercised: [skill],
      timestamp: at(i),
    }))
    const stripped = written.map(
      ({ isRetry: _r, epochNumber: _e, isManualRedo: _m, originalSlotIndex: _o, ...rest }) =>
        rest as SlotResult
    )

    const { playerId: a } = await createTestStudent(ephemeralDb.db, 'with-fields')
    await insertSession({ id: 'with-fields', playerId: a, results: written })
    const { playerId: b } = await createTestStudent(ephemeralDb.db, 'without-fields')
    await insertSession({ id: 'without-fields', playerId: b, results: stripped })

    const bkt = async (playerId: string) =>
      computeBktFromHistory((await batchGetRecentBktEvidence([playerId], 100)).get(playerId)!, {
        applyDecay: false,
      }).skills
    expect(await bkt(b)).toEqual(await bkt(a))
    expect((await bkt(a))[0].opportunities).toBe(4)
  })

  // Practice kinds K0 (plan of record §4, reviews R1 and S2): the SQL path's
  // `toBktEvidence` guard (`if (!Array.isArray(raw.skillsExercised)) return
  // null`) pinned as it stands, beside the same pin on
  // `batchGetRecentSessionResults`. K1b changes it knowingly (to "has
  // `evidence` or a `skillsExercised` array") and updates this test with the reason.
  it('yields no evidence for a row without a skillsExercised array; [] is evidence (pinned before K1b)', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'skills-guard')
    const { skillsExercised: _omitted, ...withoutSkills } = makeSlotResult({
      responseTimeMs: 1_001,
    })
    await insertSession({
      id: 'skills-guard-session',
      playerId,
      results: [
        makeSlotResult({ responseTimeMs: 1_000, skillsExercised: [] }),
        withoutSkills as SlotResult,
        makeSlotResult({ responseTimeMs: 1_002, skillsExercised: null as never }),
        makeSlotResult({ responseTimeMs: 1_003, skillsExercised: 'basic.directAddition' as never }),
        // a row carrying only K1's envelope `evidence` yields none today
        {
          ...withoutSkills,
          responseTimeMs: 1_004,
          evidence: { skills: ['basic.directAddition'], presentation: 'linear' },
        } as unknown as SlotResult,
      ],
    })

    const evidence = (await batchGetRecentBktEvidence([playerId])).get(playerId) ?? []
    expect(evidence).toHaveLength(1)
    expect(evidence[0]).toMatchObject({ skillsExercised: [], responseTimeMs: 1_000 })
  })

  describe("the part kind's bktMode decides the mode (Phase 2)", () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('excludes rows of a part whose kind answers bktMode null; keeps the rest', async () => {
      const { playerId } = await createTestStudent(ephemeralDb.db, 'bkt-mode-null')
      const nullKindPart = { kind: 'read_abacus', partNumber: 2, content: { items: [] } }
      await insertSession({
        id: 'bkt-mode-null-session',
        playerId,
        parts: [makeSessionPart(1, 'abacus'), nullKindPart as never],
        results: [
          makeSlotResult({ partNumber: 1, skillsExercised: ['basic.directAddition'] }),
          makeSlotResult({ partNumber: 2, skillsExercised: ['basic.heavenBead'] }),
        ],
      })

      // 'read_abacus' is no kind this image knows: bktModeOf answers null
      const evidence = (await batchGetRecentBktEvidence([playerId])).get(playerId)!
      expect(evidence.map((e) => [e.skillsExercised, e.partType])).toEqual([
        [['basic.directAddition'], 'abacus'],
      ])
    })

    it('excludes every row of a registered kind whose bktMode is null', async () => {
      const { playerId } = await createTestStudent(ephemeralDb.db, 'bkt-mode-null-registered')
      await insertSession({
        id: 'bkt-mode-null-registered-session',
        playerId,
        parts: [
          makeSessionPart(1, 'abacus'),
          { ...makeSessionPart(2, 'linear'), kind: 'arithmetic' },
        ],
        results: [makeSlotResult({ partNumber: 1 }), makeSlotResult({ partNumber: 2 })],
      })
      vi.spyOn(arithmeticKind, 'bktMode').mockReturnValue(null)

      expect((await batchGetRecentBktEvidence([playerId])).get(playerId)).toEqual([])
    })

    it("arithmetic parts, with or without kind, keep their type; rows naming no part keep 'linear'", async () => {
      const { playerId } = await createTestStudent(ephemeralDb.db, 'bkt-mode-arithmetic')
      await insertSession({
        id: 'bkt-mode-arithmetic-session',
        playerId,
        parts: [
          makeSessionPart(1, 'abacus'),
          { ...makeSessionPart(2, 'visualization'), kind: 'arithmetic' },
        ],
        results: [
          makeSlotResult({ partNumber: 1 }),
          makeSlotResult({ partNumber: 2 }),
          makeSlotResult({ partNumber: 3 }),
        ],
      })

      const modes = (await batchGetRecentBktEvidence([playerId]))
        .get(playerId)!
        .map((e) => e.partType)
        .sort()
      expect(modes).toEqual(['abacus', 'linear', 'visualization'])
    })

    it("an arithmetic part stored without a type stays evidence, as 'linear' (main's default)", async () => {
      const { playerId } = await createTestStudent(ephemeralDb.db, 'bkt-mode-untyped')
      const { type: _t1, ...untyped1 } = makeSessionPart(1, 'abacus')
      const { type: _t2, ...untyped2 } = makeSessionPart(2, 'abacus')
      await insertSession({
        id: 'bkt-mode-untyped-session',
        playerId,
        parts: [untyped1 as never, { ...untyped2, kind: 'arithmetic' } as never],
        results: [makeSlotResult({ partNumber: 1 }), makeSlotResult({ partNumber: 2 })],
      })

      const modes = (await batchGetRecentBktEvidence([playerId]))
        .get(playerId)!
        .map((e) => e.partType)
      expect(modes).toEqual(['linear', 'linear'])
    })
  })
})
