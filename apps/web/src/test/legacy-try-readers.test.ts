/**
 * @vitest-environment node
 *
 * Phase 6(a) (session architecture §7 Phase 6): every reader of a try's
 * legacy fields (`isRetry`, `epochNumber`, `isManualRedo`,
 * `originalSlotIndex`) reads them through the normalizer, so
 *
 * 1. a row as the writers record it today reads the same once those fields are
 *    gone (what Phase 6(b) will write): BKT, readiness, the linear gate, a
 *    slot's retry status, the normalized tries and the weight rule;
 * 2. legacy rows whose practice-only flag only the normalizer derives (a
 *    duplicate original, a pre-Phase-1 do-over of an item already answered
 *    right) keep counting: pKnown, readiness and the gate read the stamp
 *    only (§1.2, "practiceOnly precedence"). The inline snapshots were
 *    recorded by this file against the readers before Phase 6(a) (main
 *    `97868b634`) and pass unchanged after it.
 *
 * The attempt panel, the progress dots and the song's moments carry their own
 * strip cases (AttemptHistoryPanel.legacy.test.tsx,
 * SessionProgressIndicator.test.tsx, extract-session-stats.test.ts); the SQL
 * evidence path carries its own in evidence-query.test.ts.
 */

import { describe, expect, it } from 'vitest'
import { getSlotRetryStatus } from '@/db/schema/session-plan-helpers'
import { normalizeTries } from '@/db/schema/session-plan-normalize'
import type { SessionPart, SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { computeBktFromHistory } from '@/lib/curriculum/bkt'
import { deriveLinearGateState } from '@/lib/curriculum/linear-gate'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { assessAllSkillsReadiness } from '@/lib/curriculum/skill-readiness'
import { evidenceWeightOf } from '@/lib/curriculum/try-weight'

const A = 'basic.directAddition'
const F = 'fiveComplements.4=5-1'
const BASE_TS = new Date('2026-11-01T10:00:00Z').getTime()

/** A row without the four legacy fields, as Phase 6(b) will write it */
function stripLegacy<T extends Partial<SlotResult>>(row: T): T {
  const { isRetry: _r, epochNumber: _e, isManualRedo: _m, originalSlotIndex: _o, ...rest } = row
  return rest as T
}

function problemOf(partNumber: number, slotIndex: number) {
  const a = partNumber * 10 + slotIndex
  return { terms: [a, 1], answer: a + 1, skillsRequired: [] } as never
}

function partsOf(spec: { partNumber: number; type: string; slots: number }[]): SessionPart[] {
  return spec.map(
    ({ partNumber, type, slots }) =>
      ({
        partNumber,
        type,
        format: 'vertical',
        useAbacus: type === 'abacus',
        estimatedMinutes: 5,
        slots: Array.from({ length: slots }, (_, i) => ({
          slotId: `p${partNumber}s${i}`,
          index: i,
          purpose: 'focus',
          constraints: {},
          problem: problemOf(partNumber, i),
        })),
      }) as SessionPart
  )
}

let n = 0
function row(
  sessionId: string,
  partNumber: number,
  slotIndex: number,
  over: Partial<ProblemResultWithContext>
): ProblemResultWithContext {
  n += 1
  const problem = problemOf(partNumber, slotIndex) as { answer: number }
  const isCorrect = over.isCorrect ?? true
  return {
    slotId: `p${partNumber}s${slotIndex}`,
    partNumber: partNumber as never,
    slotIndex,
    problem: problem as never,
    studentAnswer: isCorrect ? problem.answer : 0,
    isCorrect,
    responseTimeMs: 4000,
    skillsExercised: [A],
    usedOnScreenAbacus: false,
    hadHelp: false,
    incorrectAttempts: 0,
    sessionId,
    sessionCompletedAt: new Date(BASE_TS + 3_600_000),
    partType: partNumber === 1 ? 'abacus' : 'linear',
    timestamp: new Date(BASE_TS + n * 60_000),
    ...over,
  }
}

// ---------------------------------------------------------------------------
// 1. Rows as the writers record them, and the same rows without legacy fields
// ---------------------------------------------------------------------------

const STAMPED_PARTS = partsOf([
  { partNumber: 1, type: 'abacus', slots: 4 },
  { partNumber: 2, type: 'linear', slots: 3 },
])

/** What `recordSlotResult` writes for a first try or a retry */
function attempt(
  partNumber: number,
  slotIndex: number,
  round: number,
  over: Partial<ProblemResultWithContext> = {}
): ProblemResultWithContext {
  const isCorrect = over.isCorrect ?? true
  return row('stamped-1', partNumber, slotIndex, {
    tryId: `00000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`,
    kind: round > 0 ? 'retry' : 'first',
    round,
    practiceOnly: false,
    partIndex: partNumber - 1,
    masteryWeight: 1 / 2 ** round,
    isRetry: round > 0,
    epochNumber: round,
    originalSlotIndex: slotIndex,
    isCorrect,
    ...over,
  })
}

/** What `recordRedoResult` writes for a do-over */
function doOver(
  partNumber: number,
  slotIndex: number,
  round: number,
  practiceOnly: boolean,
  over: Partial<ProblemResultWithContext> = {}
): ProblemResultWithContext {
  return row('stamped-1', partNumber, slotIndex, {
    tryId: `00000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`,
    kind: 'do_over',
    round,
    practiceOnly,
    partIndex: partNumber - 1,
    masteryWeight: practiceOnly ? 0 : 1 / 2 ** round,
    isManualRedo: true,
    epochNumber: 0,
    isRetry: false,
    originalSlotIndex: slotIndex,
    ...over,
  })
}

function stampedSession(): ProblemResultWithContext[] {
  n = 0
  return [
    attempt(1, 0, 0),
    attempt(1, 1, 0, { isCorrect: false, skillsExercised: [F] }),
    attempt(1, 2, 0, { skillsExercised: [A, F] }),
    attempt(1, 3, 0, { isCorrect: false }),
    attempt(1, 1, 1, { isCorrect: false, skillsExercised: [F] }),
    attempt(1, 3, 1),
    // the answer is shown after round 2: the dot takes no do-over
    attempt(1, 1, 2, { isCorrect: false, skillsExercised: [F] }),
    // a do-over of an item already right: practice-only, counts nowhere
    doOver(1, 0, 1, true, { isCorrect: false }),
    attempt(2, 0, 0, { isCorrect: false, skillsExercised: [F] }),
    attempt(2, 1, 0),
    attempt(2, 2, 0, { isCorrect: false }),
    // a counted do-over of a once-wrong item, before its retry round
    doOver(2, 2, 1, false),
    attempt(2, 0, 1, { skillsExercised: [F] }),
  ]
}

const roundedBkt = (history: ProblemResultWithContext[]) =>
  computeBktFromHistory(history, { applyDecay: false }).skills.map((s) => ({
    skillId: s.skillId,
    pKnown: Number(s.pKnown.toFixed(10)),
    confidence: Number(s.confidence.toFixed(10)),
    opportunities: s.opportunities,
    successCount: s.successCount,
  }))

const readinessOf = (history: ProblemResultWithContext[]) => {
  const skills = computeBktFromHistory(history, { applyDecay: false }).skills
  return Object.fromEntries(assessAllSkillsReadiness(history, skills, new Set([A, F])))
}

const gateOf = (history: ProblemResultWithContext[]) =>
  deriveLinearGateState({
    problemHistory: history,
    categories: ['basic', 'fiveComplements'],
    thresholds: { minAccuracy: 0.6, accuracyWindowSize: 5, minOpportunities: 1 },
  })

function planOf(id: string, parts: SessionPart[], results: SlotResult[]): SessionPlan {
  return { id, parts, results } as unknown as SessionPlan
}

describe('Phase 6(a): a row reads the same without its legacy fields', () => {
  it('BKT', () => {
    const history = stampedSession()
    expect(roundedBkt(history.map(stripLegacy))).toEqual(roundedBkt(history))
  })

  it('readiness (a retry stays out of it)', () => {
    const history = stampedSession()
    expect(readinessOf(history.map(stripLegacy))).toEqual(readinessOf(history))
  })

  it('the linear gate (a linear retry stays out of it)', () => {
    const history = stampedSession()
    expect(gateOf(history.map(stripLegacy))).toEqual(gateOf(history))
  })

  it("each slot's retry status", () => {
    const history = stampedSession()
    const plan = planOf('stamped-1', STAMPED_PARTS, history)
    const stripped = planOf('stamped-1', STAMPED_PARTS, history.map(stripLegacy))
    STAMPED_PARTS.forEach((part, partIndex) => {
      part.slots.forEach((_, slotIndex) => {
        expect(getSlotRetryStatus(stripped, partIndex, slotIndex)).toEqual(
          getSlotRetryStatus(plan, partIndex, slotIndex)
        )
      })
    })
  })

  it('the normalized tries and the weight of every row', () => {
    const history = stampedSession()
    const project = (rows: SlotResult[]) =>
      normalizeTries('stamped-1', STAMPED_PARTS, rows).map((t) => ({
        tryId: t.tryId,
        itemId: t.itemId,
        kind: t.kind,
        round: t.round,
        practiceOnly: t.practiceOnly,
        practiceOnlyDerived: t.practiceOnlyDerived,
        weight: evidenceWeightOf(t.result),
      }))
    expect(project(history.map(stripLegacy))).toEqual(project(history))
  })

  it('the fixture exercises what the legacy fields used to tell (retries in both parts)', () => {
    const history = stampedSession()
    const readiness = readinessOf(history)
    // Readiness and the gate leave every retry out: F has 3 non-retry tries, not 5
    expect(readiness[F].dimensions.volume.opportunities).toBe(3)
    expect(gateOf(history).get('fiveComplements')?.opportunities).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 2. Legacy rows whose practice-only flag is derived only
// ---------------------------------------------------------------------------

const LEGACY_PARTS = partsOf([
  { partNumber: 1, type: 'abacus', slots: 3 },
  { partNumber: 2, type: 'linear', slots: 3 },
])

/** A pre-Phase-1 row: no kind, round, practiceOnly or tryId */
function legacyRow(
  partNumber: number,
  slotIndex: number,
  over: Partial<ProblemResultWithContext> = {}
): ProblemResultWithContext {
  const isCorrect = over.isCorrect ?? true
  const epochNumber = over.epochNumber ?? 0
  return row('legacy-1', partNumber, slotIndex, {
    isRetry: epochNumber > 0,
    epochNumber,
    originalSlotIndex: slotIndex,
    masteryWeight: isCorrect ? 1 / 2 ** epochNumber : 0,
    ...over,
  })
}

function derivedOnlySession(): ProblemResultWithContext[] {
  n = 0
  return [
    legacyRow(1, 0, { skillsExercised: [F] }),
    // bug 3: the same original submitted twice, wrong the second time
    legacyRow(1, 0, { skillsExercised: [F], isCorrect: false }),
    legacyRow(1, 1, { skillsExercised: [F], isCorrect: false }),
    legacyRow(1, 1, { skillsExercised: [F], epochNumber: 1 }),
    // a pre-Phase-1 do-over of an item already right (stored 0 / weight 1.0)
    legacyRow(1, 1, {
      skillsExercised: [F],
      isManualRedo: true,
      isRetry: false,
      epochNumber: 0,
      masteryWeight: 1,
    }),
    legacyRow(1, 2, { skillsExercised: [A, F] }),
    legacyRow(2, 0, { skillsExercised: [F] }),
    // bug 3 in the linear part: a wrong duplicate of a right original
    legacyRow(2, 0, { skillsExercised: [F], isCorrect: false }),
    legacyRow(2, 1, { skillsExercised: [F] }),
    legacyRow(2, 2, { skillsExercised: [A, F], isCorrect: false }),
    legacyRow(2, 2, { skillsExercised: [A, F], epochNumber: 1 }),
  ]
}

describe('Phase 6(a): legacy rows with a derived-only practice-only flag keep counting', () => {
  it('the fixture: the normalizer derives practice-only on three rows, none is stamped', () => {
    const tries = normalizeTries('legacy-1', LEGACY_PARTS, derivedOnlySession())
    expect(tries.filter((t) => t.practiceOnly)).toEqual([])
    expect(tries.filter((t) => t.practiceOnlyDerived).map((t) => t.arrayIndex)).toEqual([1, 4, 7])
  })

  it('pKnown is unchanged (the derived rows are evidence)', () => {
    expect(roundedBkt(derivedOnlySession())).toMatchInlineSnapshot(`
      [
        {
          "confidence": 0.2059586902,
          "opportunities": 3,
          "pKnown": 0.6047148625,
          "skillId": "basic.directAddition",
          "successCount": 2,
        },
        {
          "confidence": 0.4775956442,
          "opportunities": 11,
          "pKnown": 0.9979920557,
          "skillId": "fiveComplements.4=5-1",
          "successCount": 7,
        },
      ]
    `)
  })

  it('readiness is unchanged', () => {
    const readiness = readinessOf(derivedOnlySession())
    expect(
      Object.fromEntries(
        Object.entries(readiness).map(([skill, r]) => [
          skill,
          {
            isSolid: r.isSolid,
            mastery: r.dimensions.mastery.met,
            volume: r.dimensions.volume,
            consistency: r.dimensions.consistency,
          },
        ])
      )
    ).toMatchInlineSnapshot(`
      {
        "basic.directAddition": {
          "consistency": {
            "lastFiveAllCorrect": false,
            "met": false,
            "recentAccuracy": 0.5,
            "recentHelpCount": 0,
          },
          "isSolid": false,
          "mastery": false,
          "volume": {
            "met": false,
            "opportunities": 2,
            "sessionCount": 1,
          },
        },
        "fiveComplements.4=5-1": {
          "consistency": {
            "lastFiveAllCorrect": false,
            "met": false,
            "recentAccuracy": 0.5555555555555556,
            "recentHelpCount": 0,
          },
          "isSolid": false,
          "mastery": false,
          "volume": {
            "met": false,
            "opportunities": 9,
            "sessionCount": 1,
          },
        },
      }
    `)
  })

  it('the linear gate is unchanged', () => {
    expect(gateOf(derivedOnlySession())).toMatchInlineSnapshot(`
      Map {
        "basic" => {
          "category": "basic",
          "opportunities": 1,
          "passed": false,
          "recentAccuracy": 0,
        },
        "fiveComplements" => {
          "category": "fiveComplements",
          "opportunities": 4,
          "passed": false,
          "recentAccuracy": 0.5,
        },
      }
    `)
  })

  it('reading the derived flag would move them (so the snapshots pin the stamp-only rule)', () => {
    const history = derivedOnlySession()
    const tries = normalizeTries('legacy-1', LEGACY_PARTS, history)
    const derivedDropped = history.filter(
      (_, i) => !tries.find((t) => t.arrayIndex === i)?.practiceOnlyDerived
    )
    expect(roundedBkt(derivedDropped)).not.toEqual(roundedBkt(history))
    expect(readinessOf(derivedDropped)).not.toEqual(readinessOf(history))
    expect(gateOf(derivedDropped)).not.toEqual(gateOf(history))
  })
})
