/**
 * @vitest-environment node
 *
 * Practice-only do-overs count nowhere (session architecture §1.2, §10 P1-3).
 *
 * The proof is invariance, reader by reader: for every reader that turns tries
 * into a verdict, a count, an accuracy, a streak, a timing statistic or mastery
 * evidence, output(results) deep-equals output(results + practice-only rows),
 * where the practice-only rows are a right AND a wrong do-over of a problem
 * already answered correctly, stamped exactly as recordRedoResult stamps them.
 * The do-overs are chosen to move every statistic if counted: one very fast,
 * one very slow, one wrong after a correct (a verdict flip), on a skill the
 * session exercises.
 *
 * Components are covered through the pure helper they read through
 * (`summarizeTries`, `countedTries`, `buildResultMap`, `getResultForProblem`,
 * the auto-pause and time-estimate calculators).
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculateAutoPauseInfo,
  calculateComplexityScaledThresholds,
  calculateNormalizedResponseTimeStats,
} from '@/components/practice/autoPauseCalculator'
import {
  buildResultMap,
  filterProblemsNeedingAttention,
  getProblemsWithContext,
  getResultForProblem,
} from '@/components/practice/sessionSummaryUtils'
import { PROGRESSIVE_ASSISTANCE_TIMING } from '@/constants/helpTiming'
import * as schema from '@/db/schema'
import {
  calculateSessionHealth,
  countedTries,
  getCompletedProblemCount,
  getSessionPlanAccuracy,
  getSlotRetryStatus,
  summarizeTries,
} from '@/db/schema/session-plan-helpers'
import type {
  GeneratedProblem,
  SessionPart,
  SessionPlan,
  SlotResult,
} from '@/db/schema/session-plans'
import { calculateTimingStats, getSessionTimeEstimate } from '@/hooks/useSessionTimeEstimate'
import { computeBktFromHistory } from '@/lib/curriculum/bkt/compute-bkt'
import { batchGetRecentBktEvidence } from '@/lib/curriculum/bkt/evidence-query'
import { deriveLinearGateState } from '@/lib/curriculum/linear-gate'
import {
  analyzeSkillPerformance,
  getPaginatedSessions,
  getRecentSessions,
  getTimingReviewData,
  type SessionHistoryEntry,
} from '@/lib/curriculum/progress-manager'
import { readTriesSync } from '@/lib/curriculum/read-tries'
import {
  batchGetRecentSessionResults,
  getRecentSessionResults,
  type ProblemResultWithContext,
} from '@/lib/curriculum/session-planner'
import { buildSessionReport } from '@/lib/curriculum/session-report'
import { computeStudentSkillMetrics } from '@/lib/curriculum/skill-metrics'
import { assessAllSkillsReadiness } from '@/lib/curriculum/skill-readiness'
import { calculateSessionTrends } from '@/lib/curriculum/trends'
import { extractSessionStats } from '@/lib/session-song/extract-session-stats'
import { historyTryOf } from '@/test/fixtures/history-try'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from '@/test/journey-simulator/EphemeralDatabase'

vi.mock('server-only', () => ({}))
vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

const A = 'basic.directAddition'
const H = 'basic.heavenBead'
const BASE = new Date('2026-03-02T10:00:00Z').getTime()

const problem = (a: number, b: number, skill: string): GeneratedProblem =>
  ({ terms: [a, b], answer: a + b, skillsRequired: [skill] }) as GeneratedProblem

const P1 = [
  problem(1, 2, A),
  problem(3, 1, A),
  problem(2, 5, H),
  problem(4, 4, A),
  problem(1, 5, H),
  problem(2, 2, A),
]
const P2 = [problem(3, 3, H), problem(1, 1, A), problem(2, 1, A)]

function part(partNumber: 1 | 2, type: SessionPart['type'], problems: GeneratedProblem[]) {
  return {
    partNumber,
    type,
    format: type === 'linear' ? 'linear' : 'vertical',
    useAbacus: type === 'abacus',
    estimatedMinutes: 3,
    slots: problems.map((p, index) => ({
      slotId: `p${partNumber}-s${index}`,
      index,
      purpose: 'focus',
      constraints: {},
      problem: p,
    })),
  } as SessionPart
}

const PARTS = [part(1, 'abacus', P1), part(2, 'linear', P2)]

let tick = 0
function row(partNumber: 1 | 2, slotIndex: number, over: Partial<SlotResult> = {}): SlotResult {
  tick += 1
  const p = (partNumber === 1 ? P1 : P2)[slotIndex]
  const isCorrect = over.isCorrect ?? true
  return {
    tryId: `00000000-0000-4000-8000-${String(tick).padStart(12, '0')}`,
    slotId: `p${partNumber}-s${slotIndex}`,
    partNumber,
    partIndex: partNumber - 1,
    slotIndex,
    problem: p,
    studentAnswer: isCorrect ? p.answer : p.answer + 1,
    isCorrect,
    responseTimeMs: 4000 + tick * 350,
    skillsExercised: p.skillsRequired,
    usedOnScreenAbacus: partNumber === 1,
    timestamp: new Date(BASE + tick * 30_000),
    hadHelp: false,
    incorrectAttempts: 0,
    kind: 'first',
    round: 0,
    practiceOnly: false,
    masteryWeight: isCorrect ? 1 : 0,
    epochNumber: 0,
    isRetry: false,
    originalSlotIndex: slotIndex,
    ...over,
  }
}

/** A finished session: one wrong try redeemed by a retry, one wrong item redone right. */
function baseResults(): SlotResult[] {
  tick = 0
  return [
    row(1, 0),
    row(1, 1, { isCorrect: false }),
    row(1, 2),
    row(1, 3, { isCorrect: false, hadHelp: true }),
    row(1, 4),
    row(1, 5),
    row(1, 1, { kind: 'retry', round: 1, epochNumber: 1, isRetry: true, masteryWeight: 0.5 }),
    // a counted do-over of a wrong item: 1.0, redeems it
    row(1, 3, { kind: 'do_over', round: 1, isManualRedo: true, masteryWeight: 1 }),
    row(2, 0),
    row(2, 1),
    row(2, 2, { isCorrect: false }),
  ]
}

/** Two do-overs of slot 0 (answered correctly): one right and fast, one wrong and slow. */
function practiceRows(): SlotResult[] {
  const doOver = {
    kind: 'do_over' as const,
    round: 1,
    practiceOnly: true,
    masteryWeight: 0,
    isManualRedo: true,
  }
  return [
    row(1, 0, { ...doOver, responseTimeMs: 300 }),
    row(1, 0, { ...doOver, isCorrect: false, responseTimeMs: 290_000, hadHelp: true }),
    row(2, 1, { ...doOver, isCorrect: false, responseTimeMs: 120_000 }),
  ]
}

function plan(results: SlotResult[], over: Partial<SessionPlan> = {}): SessionPlan {
  return {
    id: 'plan-inv',
    playerId: 'player-inv',
    status: 'completed',
    parts: PARTS,
    results,
    currentPartIndex: 2,
    currentSlotIndex: 0,
    retryState: null,
    avgTimePerProblemSeconds: 6,
    targetDurationMinutes: 6,
    estimatedProblemCount: 9,
    createdAt: new Date(BASE),
    startedAt: new Date(BASE),
    completedAt: new Date(BASE + 3_600_000),
    ...over,
  } as unknown as SessionPlan
}

const base = baseResults()
const withPractice = [...base, ...practiceRows()]

function asHistory(results: SlotResult[]): ProblemResultWithContext[] {
  return results.map((r) =>
    historyTryOf(
      { ...r, sessionId: 'plan-inv', sessionCompletedAt: new Date(BASE + 3_600_000) },
      r.partNumber === 1 ? 'abacus' : 'linear'
    )
  )
}

/** Asserts the reader ignores the practice-only rows. */
function invariant<T>(read: (results: SlotResult[]) => T) {
  expect(read(withPractice)).toEqual(read(base))
}

describe('practice-only do-overs: pure readers are invariant', () => {
  it('the fixture would move every statistic if the rows counted', () => {
    expect(withPractice.length).toBe(base.length + 3)
    expect(summarizeTries(withPractice)).toEqual(summarizeTries(base))
    // sanity: without the predicate the numbers do differ
    expect(withPractice.filter((r) => r.isCorrect).length).not.toBe(
      base.filter((r) => r.isCorrect).length
    )
  })

  it('shared helpers', () => {
    invariant((r) => countedTries(r))
    invariant((r) => summarizeTries(r))
    invariant((r) => getSessionPlanAccuracy(plan(r)))
    invariant((r) => getCompletedProblemCount(plan(r)))
    invariant((r) => calculateSessionHealth(plan(r), 120_000))
  })

  it('slot verdicts (progress dots, getSlotRetryStatus), excluding the per-problem try count', () => {
    for (let p = 0; p < PARTS.length; p++) {
      for (let s = 0; s < PARTS[p].slots.length; s++) {
        invariant((r) => {
          const { attemptCount: _tries, ...verdict } = getSlotRetryStatus(plan(r), p, s)
          return verdict
        })
      }
    }
  })

  it('summary verdicts: problems with context, needs-attention, result map, browse verdict', () => {
    invariant((r) => getProblemsWithContext(plan(r)))
    invariant((r) => filterProblemsNeedingAttention(getProblemsWithContext(plan(r)), 60_000))
    invariant((r) => [...buildResultMap(r)])
    for (const p of PARTS) {
      for (const slot of p.slots) {
        invariant((r) => getResultForProblem(r, p.partNumber, slot.index))
      }
    }
  })

  it('timing: auto-pause, normalized stats, progressive thresholds, time estimates', () => {
    invariant((r) => calculateAutoPauseInfo(r))
    invariant((r) => calculateNormalizedResponseTimeStats(r))
    invariant((r) =>
      calculateComplexityScaledThresholds(r, PROGRESSIVE_ASSISTANCE_TIMING.production, 2)
    )
    invariant((r) => calculateTimingStats(r, PARTS, 'abacus'))
    // The estimate reads the report (Phase 5c): its progress and its tries' times
    invariant((r) => {
      const p = plan(r)
      const report = buildSessionReport({
        plan: p,
        tries: readTriesSync(p),
        gameResults: [],
        song: null,
        now: Date.parse('2026-01-05T16:00:00.000Z'),
      })
      return getSessionTimeEstimate(report, 'abacus')
    })
  })

  it('mastery: BKT, readiness, linear gate, skill metrics', () => {
    const bkt = (r: SlotResult[]) => computeBktFromHistory(asHistory(r), { applyDecay: false })
    invariant((r) => bkt(r))
    invariant((r) => assessAllSkillsReadiness(asHistory(r), bkt(r).skills, new Set([A, H])))
    invariant((r) =>
      deriveLinearGateState({
        problemHistory: asHistory(r),
        categories: ['basic'],
        thresholds: { minAccuracy: 0.85, accuracyWindowSize: 3, minOpportunities: 1 },
      })
    )
    invariant((r) => {
      const { computedAt: _at, ...metrics } = computeStudentSkillMetrics(
        asHistory(countedTries(r)),
        [plan(r)]
      )
      return metrics
    })
  })

  it('trends and the session song', () => {
    invariant((r) => calculateSessionTrends(plan(r), plan(base, { id: 'prev' }), [plan(r)]))
    invariant((r) => extractSessionStats(plan(r), { name: 'Kid', emoji: '🌟' } as never, []))
  })
})

describe('practice-only do-overs: database readers are invariant', () => {
  let eph: EphemeralDbResult
  let playerId: string

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    playerId = (await createTestStudent(eph.db, 'invariance')).playerId
    await eph.db.insert(schema.sessionPlans).values({
      id: 'plan-inv',
      playerId,
      status: 'completed',
      parts: PARTS,
      results: base,
      completedAt: new Date(BASE + 3_600_000),
      startedAt: new Date(BASE),
      createdAt: new Date(BASE),
      targetDurationMinutes: 6,
      estimatedProblemCount: 9,
      avgTimePerProblemSeconds: 6,
      summary: { parts: [] } as never,
    })
  })

  afterEach(() => {
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  function verdictsOf(rows: SessionHistoryEntry[]) {
    return rows.map(
      ({
        averageTimeMs: _a,
        totalTimeMs: _t,
        report: { time: _time, totals, ...report },
        ...row
      }) => {
        const { tries: _tries, ...verdicts } = totals
        return { ...row, report: { ...report, totals: verdicts } }
      }
    )
  }

  async function readAll() {
    const timing = await getTimingReviewData(playerId)
    return {
      history: await getRecentSessionResults(playerId, 10),
      batch: [...(await batchGetRecentSessionResults([playerId], 10))],
      evidence: [...(await batchGetRecentBktEvidence([playerId], 10))],
      // Session lists read the report (Phase 4d): its `tries` and active time
      // count practice-only tries by definition (§4, P4a-2: time the kid
      // spent, not a verdict), so only the verdicts must be invariant
      recent: verdictsOf(await getRecentSessions(playerId, 10)),
      paginated: verdictsOf((await getPaginatedSessions(playerId, 10)).sessions),
      timingAssessment: timing.assessment,
      timingFlagged: timing.flagged,
      deleted: timing.deletedSessions,
      skillPerformance: await analyzeSkillPerformance(playerId),
    }
  }

  it('history source, BKT evidence projection, session lists, timing review, skill performance', async () => {
    const before = await readAll()
    expect(before.history.length).toBe(base.length)
    await eph.db
      .update(schema.sessionPlans)
      .set({ results: withPractice })
      .where(eq(schema.sessionPlans.id, 'plan-inv'))
    expect(await readAll()).toEqual(before)
  })
})
