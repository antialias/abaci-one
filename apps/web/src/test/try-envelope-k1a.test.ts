/**
 * @vitest-environment node
 *
 * Practice-kinds K1a (plan of record §1.3, §3.1, §3.2, §4 K1): the server
 * half of the try envelope, behaviour-identical.
 *
 * - Normalizer fixtures (1)–(4): a K1 row and the same try as a pre-K1 row
 *   read as the same `Try`; a K1 row read by the old bundle's helpers is the
 *   same item and dot (the top-level fields are whole, R1); a skip from a
 *   legacy body keeps today's top-level projection (S4), and a blank
 *   worksheet answer is skipped (R16); `evidence: null` beside absent.
 * - The verdict: K1a stored the client's; since K2 the server's judge is the
 *   only verdict (amendment A1), so a body's `isCorrect` is never stored.
 * - The skill-attempt bump reads `evidence.skills`, which is the row's
 *   `skillsExercised` (not always the problem's `skillsRequired`).
 * - Seeds (a smoke test, not BKT parity): `seededSessionRows`, create-student's
 *   stamping, stamps every row but a legacy-data profile's, and today's BKT,
 *   readiness and gate readers read alike. No K1a reader reads the new
 *   fields, so this cannot catch a wrong `evidence`; K1b proves BKT parity.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import {
  itemSlotIndexOfRow,
  retryRoundOfRow,
  tryKindOfRow,
  tryRoundOfRow,
} from '@/db/schema/legacy-try-fields'
import { isCountedTry } from '@/db/schema/session-plan-helpers'
import {
  envelopeOfRow,
  normalizeTries,
  resolveItemId,
  type Try,
} from '@/db/schema/session-plan-normalize'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SlotResult,
  SlotResultSubmission,
} from '@/db/schema/session-plans'
import { computeBktFromHistory } from '@/lib/curriculum/bkt'
import { deriveLinearGateState } from '@/lib/curriculum/linear-gate'
import { arithmeticKind } from '@/lib/curriculum/parts/arithmetic/server'
import { getCurrentProblemInfo } from '@/lib/curriculum/parts/arithmetic/state'
import { getSessionPlan, type ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { assessAllSkillsReadiness } from '@/lib/curriculum/skill-readiness'
import { generateSlotResults, seededSessionRows } from '@/lib/seed/helpers'
import { TEST_PROFILES } from '@/lib/seed/profiles'
import { convertToSlotResults } from '@/lib/worksheet-parsing/session-converter'
import { historyTryOf } from '@/test/fixtures/history-try'
import { sendRecord, sendRecordRedo } from '@/test/fixtures/legacy-try-bodies'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from './journey-simulator/EphemeralDatabase'

vi.mock('server-only', () => ({}))

vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

vi.mock('@/lib/session-share', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/session-share')>()),
  revokeSharesForSession: vi.fn(async () => {}),
}))

const { recordSkillAttemptsWithHelp } = vi.hoisted(() => ({
  recordSkillAttemptsWithHelp: vi.fn(async () => []),
}))
vi.mock('@/lib/curriculum/progress-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/curriculum/progress-manager')>()),
  recordSkillAttemptsWithHelp,
}))

const ENVELOPE_FIELDS = ['itemId', 'outcome', 'answer', 'evidence', 'payload'] as const

/** The same row as a pre-K1 image writes it: no envelope fields (R13). */
function withoutEnvelope(r: SlotResult): SlotResult {
  const { itemId: _i, outcome: _o, answer: _a, evidence: _e, payload: _p, ...rest } = r
  return rest as SlotResult
}

/** A `Try` without the raw row, for comparing what readers see. */
function seen(t: Try) {
  const { result: _r, ...rest } = t
  return rest
}

const problem = (a: number, b: number, skills: string[]): GeneratedProblem => ({
  terms: [a, b],
  answer: a + b,
  skillsRequired: skills,
})

function partsFixture(): SessionPart[] {
  const types = ['abacus', 'linear'] as const
  return types.map((type, p) => ({
    partNumber: (p + 1) as 1 | 2,
    type,
    format: type === 'linear' ? 'linear' : 'vertical',
    useAbacus: type === 'abacus',
    estimatedMinutes: 2,
    slots: [0, 1, 2].map(
      (s): ProblemSlot => ({
        slotId: `p${p}s${s}`,
        index: s,
        purpose: 'focus',
        constraints: {},
        problem: problem(10 * p + s + 1, s + 2, [
          s % 2 ? 'basic.heavenBead' : 'basic.directAddition',
        ]),
      })
    ),
  }))
}

async function insertPlan(playerId: string): Promise<string> {
  const id = `k1a-${Math.random().toString(36).slice(2, 8)}`
  const FIXED = new Date('2026-01-01T00:00:00.000Z')
  await getCurrentEphemeralDb()!
    .insert(schema.sessionPlans)
    .values({
      id,
      playerId,
      targetDurationMinutes: 4,
      estimatedProblemCount: 6,
      avgTimePerProblemSeconds: 20,
      gameBreakSettings: {
        enabled: false,
        maxDurationMinutes: 5,
        selectionMode: 'kid-chooses',
        selectedGame: null,
        skipSetupPhase: true,
        useAdaptiveSelection: false,
      },
      parts: partsFixture(),
      summary: {} as SessionPlan['summary'],
      masteredSkillIds: [],
      status: 'in_progress',
      flowState: 'practicing',
      flowUpdatedAt: FIXED,
      flowVersion: 0,
      currentPartIndex: 0,
      results: [],
      createdAt: FIXED,
      approvedAt: FIXED,
      startedAt: null,
    })
  return id
}

const tid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** What `handleSubmit` sends (ActiveSession.tsx). */
function answerBody(
  plan: SessionPlan,
  n: number,
  correct: boolean,
  over: Partial<SlotResultSubmission> = {}
): SlotResultSubmission {
  const info = getCurrentProblemInfo(plan)!
  return {
    tryId: tid(n),
    epochNumber: info.epochNumber,
    partIndex: plan.currentPartIndex,
    slotId: info.slotId,
    slotIndex: info.originalSlotIndex,
    problem: info.problem,
    studentAnswer: correct ? info.problem.answer : info.problem.answer + 1,
    isCorrect: correct,
    responseTimeMs: 3000,
    skillsExercised: info.problem.skillsRequired,
    usedOnScreenAbacus: false,
    incorrectAttempts: correct ? 0 : 1,
    hadHelp: false,
    ...over,
  }
}

/** What `handleSkip` sends (ActiveSession.tsx): the correct answer, wrong, manual help. */
function skipBody(plan: SessionPlan, n: number): SlotResultSubmission {
  const info = getCurrentProblemInfo(plan)!
  return {
    ...answerBody(plan, n, false),
    studentAnswer: info.problem.answer,
    isCorrect: false,
    usedOnScreenAbacus: false,
    hadHelp: true,
    helpTrigger: 'manual',
  }
}

describe('K1a: the try envelope through the recorders', () => {
  let eph: EphemeralDbResult
  let playerId: string

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    ;({ playerId } = await createTestStudent(eph.db, 'k1a'))
    recordSkillAttemptsWithHelp.mockClear()
  })
  afterEach(() => {
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  /** A part 1 with a right, a wrong, a skip, its two retry rounds, and a do-over. */
  async function recordedSession(): Promise<SessionPlan> {
    const planId = await insertPlan(playerId)
    let plan = (await getSessionPlan(planId))!
    plan = await sendRecord(planId, answerBody(plan, 1, true))
    plan = await sendRecord(planId, answerBody(plan, 2, false))
    plan = await sendRecord(planId, skipBody(plan, 3))
    // retry round 1: slot 1 right, slot 2 skipped again
    plan = await sendRecord(planId, answerBody(plan, 4, true))
    plan = await sendRecord(planId, skipBody(plan, 5))
    // retry round 2: slot 2 wrong
    plan = await sendRecord(planId, answerBody(plan, 6, false))
    // a do-over of slot 0 (right before: practice-only)
    const slot = plan.parts[0].slots[0]
    plan = await sendRecordRedo(
      planId,
      {
        tryId: tid(7),
        slotId: slot.slotId,
        slotIndex: 0,
        problem: slot.problem!,
        studentAnswer: slot.problem!.answer,
        isCorrect: true,
        responseTimeMs: 2000,
        skillsExercised: slot.problem!.skillsRequired,
        usedOnScreenAbacus: false,
        hadHelp: false,
        incorrectAttempts: 0,
      },
      { itemId: slot.slotId, originalPartIndex: 0, originalSlotIndex: 0 }
    )
    return plan
  }

  it('stamps every try with its envelope; the top-level fields are written as always', async () => {
    const plan = await recordedSession()
    expect(plan.results.map((r) => [r.kind, r.round, r.outcome, r.isCorrect])).toEqual([
      ['first', 0, 'answered', true],
      ['first', 0, 'answered', false],
      ['first', 0, 'skipped', false],
      ['retry', 1, 'answered', true],
      ['retry', 1, 'skipped', false],
      ['retry', 2, 'answered', false],
      ['do_over', 1, 'answered', true],
    ])
    for (const r of plan.results) {
      expect(r.itemId).toBe(r.slotId)
      expect(r.answer).toBe(r.outcome === 'answered' ? r.studentAnswer : null)
      expect(r.payload).toEqual({ kind: 'arithmetic' })
      expect(r.evidence).toEqual({ skills: r.skillsExercised, presentation: 'abacus' })
      // The arithmetic snapshot at top level, on every row (K6, K14)
      for (const f of ['slotId', 'slotIndex', 'problem', 'studentAnswer', 'skillsExercised'])
        expect(r).toHaveProperty(f)
      expect(typeof r.usedOnScreenAbacus).toBe('boolean')
    }
  })

  it('fixture (1): a K1 row and the same try as a pre-K1 row read as the same Try', async () => {
    const plan = await recordedSession()
    const k1 = normalizeTries(plan.id, plan.parts, plan.results)
    const preK1 = normalizeTries(plan.id, plan.parts, plan.results.map(withoutEnvelope))
    // A pre-K1 row cannot say it was skipped: it reads 'answered' (§3.1)
    const answered = (t: Try) => ({ ...seen(t), outcome: 'answered' })
    expect(k1.map(answered)).toEqual(preK1.map(answered))
    expect(k1.filter((t) => t.outcome === 'skipped').map((t) => t.arrayIndex)).toEqual([2, 4])
    // The in-memory payload lifts the snapshot from the top level
    expect(k1[0].payload).toEqual({
      kind: 'arithmetic',
      problem: plan.results[0].problem,
      usedOnScreenAbacus: false,
    })
    // What a writer outside the recorder stamps is what the normalizer derives
    for (const r of plan.results) {
      const derived = envelopeOfRow(withoutEnvelope(r), plan.parts)
      const stamped = envelopeOfRow(r, plan.parts)
      if (r.outcome === 'answered') expect(stamped).toEqual(derived)
      else expect({ ...stamped, outcome: 'answered', answer: r.studentAnswer }).toEqual(derived)
    }
  })

  it("fixture (2): the old bundle's helpers read a K1 row as the same item and dot", async () => {
    const plan = await recordedSession()
    for (const r of plan.results) {
      const old = withoutEnvelope(r)
      expect(itemSlotIndexOfRow(r)).toBe(itemSlotIndexOfRow(old))
      expect(tryKindOfRow(r)).toBe(tryKindOfRow(old))
      expect(tryRoundOfRow(r)).toBe(tryRoundOfRow(old))
      expect(retryRoundOfRow(r)).toBe(retryRoundOfRow(old))
      expect(resolveItemId(r, plan.parts)).toBe(resolveItemId(old, plan.parts))
      expect(isCountedTry(r)).toBe(isCountedTry(old))
      // SessionProgressIndicator's dot: the last counted try by (partNumber, slotIndex)
      expect([r.partNumber, r.slotIndex, r.isCorrect]).toEqual([
        old.partNumber,
        old.slotIndex,
        old.isCorrect,
      ])
    }
  })

  it('fixture (3): a skip from the legacy body keeps the top-level projection handleSkip sends', async () => {
    const planId = await insertPlan(playerId)
    const before = (await getSessionPlan(planId))!
    const body = skipBody(before, 1)
    const plan = await sendRecord(planId, body)
    const row = plan.results[0]
    const { partIndex: _p, epochNumber: _e, ...topLevel } = body
    // Every field the body sent is stored as sent (S4: byte-identical top level)
    expect(row).toMatchObject(topLevel)
    expect(row.studentAnswer).toBe(row.problem.answer)
    expect(row).toMatchObject({
      isCorrect: false,
      hadHelp: true,
      helpTrigger: 'manual',
      outcome: 'skipped',
      answer: null,
    })
    // Still evidence of a wrong try, as today: the skill-attempt bump runs
    expect(recordSkillAttemptsWithHelp).toHaveBeenCalledWith(
      playerId,
      body.skillsExercised.map((skillId) => ({ skillId, isCorrect: false })),
      true,
      3000
    )
  })

  it("the server's verdict is stored, whatever the body's isCorrect says (K2, amendment A1)", async () => {
    const planId = await insertPlan(playerId)
    const before = (await getSessionPlan(planId))!
    // A body that calls a wrong answer right (no client does): not compared, not stored
    const plan = await sendRecord(planId, {
      ...answerBody(before, 1, false),
      isCorrect: true,
    })
    expect(plan.results[0]).toMatchObject({ isCorrect: false, outcome: 'answered' })
    expect(recordSkillAttemptsWithHelp).toHaveBeenCalledWith(
      playerId,
      plan.results[0].skillsExercised.map((skillId) => ({ skillId, isCorrect: false })),
      false,
      3000
    )
  })

  it('a duplicate tryId the recorder ignores, raced or resent, is one row', async () => {
    const planId = await insertPlan(playerId)
    const before = (await getSessionPlan(planId))!
    const body = answerBody(before, 1, false)
    await Promise.allSettled([sendRecord(planId, body), sendRecord(planId, body)])
    await sendRecord(planId, body)
    expect((await getSessionPlan(planId))!.results).toHaveLength(1)
  })

  it("the skill-attempt bump reads evidence.skills: the row's skillsExercised", async () => {
    const planId = await insertPlan(playerId)
    const before = (await getSessionPlan(planId))!
    // The journey simulator sends the skills it challenged, not skillsRequired
    const skillsExercised = ['fiveComplements.4=5-1', 'basic.directAddition']
    const plan = await sendRecord(planId, {
      ...answerBody(before, 1, true),
      skillsExercised,
    })
    expect(plan.results[0].evidence).toEqual({ skills: skillsExercised, presentation: 'abacus' })
    expect(recordSkillAttemptsWithHelp).toHaveBeenCalledWith(
      playerId,
      skillsExercised.map((skillId) => ({ skillId, isCorrect: true })),
      false,
      3000
    )
  })
})

describe('K1a: the normalizer derives the envelope for old rows', () => {
  const parts = partsFixture()
  const legacyRow = (over: Partial<SlotResult> = {}): SlotResult => ({
    slotId: 'p0s1',
    partNumber: 1,
    slotIndex: 1,
    problem: parts[0].slots[1].problem!,
    studentAnswer: 4,
    isCorrect: false,
    responseTimeMs: 3000,
    skillsExercised: ['basic.heavenBead'],
    usedOnScreenAbacus: true,
    timestamp: new Date('2026-01-01T00:00:00Z'),
    hadHelp: false,
    incorrectAttempts: 1,
    ...over,
  })

  it('fills outcome, evidence and payload; the item as before', () => {
    const [t] = normalizeTries('plan', parts, [legacyRow()])
    expect(t).toMatchObject({
      itemId: 'p0s1',
      outcome: 'answered',
      answer: 4,
      evidence: { skills: ['basic.heavenBead'], presentation: 'abacus' },
      payload: { kind: 'arithmetic', problem: parts[0].slots[1].problem, usedOnScreenAbacus: true },
    })
    expect(envelopeOfRow(legacyRow(), parts).answer).toBe(4)
  })

  it('fixture (4): evidence null beside evidence absent', () => {
    const tries = normalizeTries('plan', parts, [
      legacyRow({ evidence: null }),
      legacyRow({ slotId: 'p0s2', slotIndex: 2, problem: parts[0].slots[2].problem! }),
    ])
    expect(tries.map((t) => t.evidence)).toEqual([
      null,
      { skills: ['basic.heavenBead'], presentation: 'abacus' },
    ])
  })

  it("a row whose part has no type, or names no part, is 'linear', as today", () => {
    const untyped = parts.map((p) => ({ ...p, type: undefined }) as unknown as SessionPart)
    expect(envelopeOfRow(legacyRow(), untyped).evidence?.presentation).toBe('linear')
    expect(envelopeOfRow(legacyRow({ partNumber: 3 as never }), parts).evidence).toEqual({
      skills: ['basic.heavenBead'],
      presentation: 'linear',
    })
  })

  it('a row without a skillsExercised array is not evidence, as every reader skips it today', () => {
    const row = { ...legacyRow(), skillsExercised: undefined } as unknown as SlotResult
    expect(envelopeOfRow(row, parts).evidence).toBeNull()
  })

  it('a part of a kind this image does not know: not evidence, the stored payload kept', () => {
    const zzz = [{ kind: 'zzz', partNumber: 1, estimatedMinutes: 1 } as unknown as SessionPart]
    const row = legacyRow({ payload: { kind: 'zzz', item: 7 } })
    const [t] = normalizeTries('plan', zzz, [row])
    expect(t.evidence).toBeNull()
    expect(t.payload).toEqual({ kind: 'zzz', item: 7 })
  })
})

describe('K1a: arithmetic describe', () => {
  it('names the problem as the song names it', () => {
    const p = problem(12, -5, [])
    const t = {
      result: {} as SlotResult,
      outcome: 'answered' as const,
      payload: { kind: 'arithmetic', problem: p },
    }
    expect(arithmeticKind.describe(partsFixture()[0], t)).toBe('12 - 5 = 7')
    expect(
      arithmeticKind.describe(partsFixture()[0], { ...t, payload: { kind: 'arithmetic' } })
    ).toBe('a problem')
  })
})

describe('K1a: worksheet blanks are skipped (R16)', () => {
  const parsed = (studentAnswer: number | null, terms = [2, -2]) =>
    ({ problemNumber: 1, terms, studentAnswer, correctAnswer: 0, termsConfidence: 1 }) as never

  it('a blank keeps its legacy top level and says skipped; an answered 0 is answered', () => {
    const { slotResults } = convertToSlotResults({ problems: [parsed(null), parsed(0)] } as never)
    const [blank, zero] = slotResults
    // The legacy projection, as today (K14)
    expect(blank).toMatchObject({ studentAnswer: 0, isCorrect: false, incorrectAttempts: 0 })
    expect(blank).toMatchObject({
      outcome: 'skipped',
      answer: null,
      payload: { kind: 'arithmetic' },
    })
    expect(zero).toMatchObject({
      studentAnswer: 0,
      isCorrect: true,
      outcome: 'answered',
      answer: 0,
    })
  })
})

describe('K1a smoke: seeded profiles through the real seed stamping (BKT parity proper is K1b)', () => {
  const T0 = new Date('2026-11-01T10:00:00Z')

  /** A profile's rows and its one linear part, stamped by `seededSessionRows` as create-student does. */
  function seeded(profile: (typeof TEST_PROFILES)[number]) {
    const rows = profile.skillHistory.flatMap((config) =>
      generateSlotResults(config, 0, T0).map((result) => ({
        result,
        simulateLegacyData: config.simulateLegacyData === true,
      }))
    )
    rows.forEach((r, idx) => {
      r.result = { ...r.result, slotIndex: idx }
    })
    const parts: SessionPart[] = [
      {
        partNumber: 1,
        type: 'linear',
        format: 'linear',
        useAbacus: false,
        estimatedMinutes: 30,
        slots: rows.map((r, idx) => ({
          slotId: `seed-${idx}`,
          index: idx,
          purpose: 'focus',
          constraints: {},
          problem: r.result.problem,
        })),
      },
    ]
    return { rows, parts, stored: seededSessionRows(rows, parts) }
  }

  // K1a has no reader of the new fields, so this cannot see a wrong
  // `evidence`: it checks the stamping runs and leaves today's readers
  // whole. K1b, whose readers read `evidence`, proves BKT parity (§4 K1).
  it('stamps every row, and BKT, readiness and the linear gate read as without it', () => {
    for (const profile of TEST_PROFILES) {
      const { rows, parts, stored } = seeded(profile)
      const context = (r: SlotResult): ProblemResultWithContext =>
        historyTryOf({ ...r, sessionId: 'seed', sessionCompletedAt: T0 }, 'linear')
      const before = rows.map((r) => context(r.result))
      const after = stored.map(context)
      rows.forEach((r, idx) => {
        if (r.simulateLegacyData) return
        for (const f of ENVELOPE_FIELDS) expect(after[idx], profile.name).toHaveProperty(f)
      })

      const bkt = (h: ProblemResultWithContext[]) => computeBktFromHistory(h, { applyDecay: false })
      expect(bkt(after), profile.name).toEqual(bkt(before))
      const skillIds = new Set(rows.flatMap((r) => r.result.skillsExercised))
      expect(
        Object.fromEntries(assessAllSkillsReadiness(after, bkt(after).skills, skillIds)),
        profile.name
      ).toEqual(Object.fromEntries(assessAllSkillsReadiness(before, bkt(before).skills, skillIds)))
      const categories = [...new Set([...skillIds].map((s) => s.split('.')[0]))]
      const gate = (h: ProblemResultWithContext[]) =>
        deriveLinearGateState({
          problemHistory: h,
          categories,
          thresholds: { minAccuracy: 0.6, accuracyWindowSize: 5, minOpportunities: 1 },
        })
      expect(gate(after), profile.name).toEqual(gate(before))
      // Stamped or derived, the in-memory evidence is today's: skillsExercised, 'linear'
      for (const t of normalizeTries('seed', parts, after))
        expect(t.evidence).toEqual({ skills: t.result.skillsExercised, presentation: 'linear' })
    }
  }, 60_000)

  it('leaves a legacy-data profile pre-K1, so it exercises the derive path', () => {
    const legacy = TEST_PROFILES.filter((p) => p.skillHistory.some((c) => c.simulateLegacyData))
    expect(legacy.length).toBeGreaterThan(0)
    for (const profile of legacy) {
      const { rows, stored } = seeded(profile)
      stored.forEach((r, idx) => {
        const isLegacy = rows[idx].simulateLegacyData === true
        expect(
          ENVELOPE_FIELDS.some((f) => f in r),
          profile.name
        ).toBe(!isLegacy)
        if (isLegacy) expect(r).toBe(rows[idx].result)
      })
      expect(rows.some((r) => r.simulateLegacyData)).toBe(true)
      expect(rows.some((r) => !r.simulateLegacyData)).toBe(true)
    }
  })
})
