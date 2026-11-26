/**
 * @vitest-environment node
 *
 * Golden replay for Phase 2 of the session architecture (plan of record §7):
 * the part-kind extraction is behaviour-identical.
 *
 * Each scenario replays a fixed try sequence through `recordSlotResult` /
 * `recordRedoResult` on a deterministic three-part plan and records, after
 * every step, the stored row (results, position, retry state, flow fields,
 * health), what the client would show next (`getCurrentProblemInfo`), the
 * skill-attempt writes and the share revocations. The snapshot beside this
 * file was recorded on origin/main `bbc801c48`, before the extraction (the
 * "old path"); the extracted code (the "new path") must reproduce it byte for
 * byte. Never update the snapshot to make this pass: a difference is a
 * behaviour change and needs its own decision.
 *
 * Phase 1w was such a decision (§8 Q10, §10 P1w-1, P1w-3) and re-recorded it:
 * only stored `masteryWeight` values changed (a wrong try 1/2^round instead of
 * 0, a counted do-over 1/2^round instead of 1.0); every other line is as
 * recorded on `bbc801c48`.
 *
 * Until `f613c293c` the `skillAttempts` capture was vacuous (every step read
 * [], see the mock below); it was re-recorded on that code with only this
 * test changed, so the `skillAttempts` lines are new and every other line is
 * as before.
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { getCurrentProblemInfo } from '@/db/schema/session-plan-helpers'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionFlowState,
  SessionPart,
  SessionPlan,
  SlotResult,
  SlotResultSubmission,
} from '@/db/schema/session-plans'
import {
  getSessionPlan,
  type RedoContext,
  recordRedoResult,
  recordSlotResult,
} from '@/lib/curriculum/session-planner'
import { revokeSharesForSession } from '@/lib/session-share'
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

// The spy is held here, not imported from the mocked module. progress-manager
// and session-planner import each other: a test that imports progress-manager
// first runs this factory's importOriginal, which loads the planner, and the
// planner binds the real function, so every `skillAttempts` read [] (as they
// did until this was fixed). Importing only the planner lets it bind the mock.
const { recordSkillAttemptsWithHelp } = vi.hoisted(() => ({
  recordSkillAttemptsWithHelp: vi.fn(async () => []),
}))
vi.mock('@/lib/curriculum/progress-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/curriculum/progress-manager')>()),
  recordSkillAttemptsWithHelp,
}))

const FIXED = new Date('2026-01-01T00:00:00.000Z')
const PART_TYPES = [
  { type: 'abacus', format: 'vertical', useAbacus: true },
  { type: 'visualization', format: 'vertical', useAbacus: false },
  { type: 'linear', format: 'linear', useAbacus: false },
] as const

function problem(p: number, s: number): GeneratedProblem {
  const terms = [10 * p + s + 1, s + 2]
  return {
    terms,
    answer: terms[0] + terms[1],
    skillsRequired: s % 2 === 0 ? ['basic.directAddition'] : ['basic.heavenBead'],
  }
}

/** Three parts of three slots each, fully deterministic. */
function fixtureParts(withKind: boolean): SessionPart[] {
  return PART_TYPES.map((t, p) => {
    const slots: ProblemSlot[] = [0, 1, 2].map((s) => ({
      slotId: `p${p}s${s}`,
      index: s,
      purpose: s === 2 ? 'review' : 'focus',
      constraints: {},
      problem: problem(p, s),
    }))
    return {
      ...(withKind ? { kind: 'arithmetic' as const } : {}),
      partNumber: (p + 1) as 1 | 2 | 3,
      ...t,
      slots,
      estimatedMinutes: 2,
    }
  })
}

async function insertPlan(
  playerId: string,
  { breaks = false, withKind = false } = {}
): Promise<string> {
  const id = `golden-${breaks ? 'b' : 'n'}-${withKind ? 'k' : 'l'}-${Math.random().toString(36).slice(2, 8)}`
  await getCurrentEphemeralDb()!
    .insert(schema.sessionPlans)
    .values({
      id,
      playerId,
      targetDurationMinutes: 6,
      estimatedProblemCount: 9,
      avgTimePerProblemSeconds: 20,
      gameBreakSettings: {
        enabled: breaks,
        maxDurationMinutes: 5,
        selectionMode: 'kid-chooses',
        selectedGame: null,
        skipSetupPhase: true,
        useAdaptiveSelection: false,
      },
      parts: fixtureParts(withKind),
      summary: {} as SessionPlan['summary'],
      masteredSkillIds: [],
      status: 'in_progress',
      flowState: 'practicing',
      flowUpdatedAt: FIXED,
      flowVersion: 0,
      currentPartIndex: 0,
      currentSlotIndex: 0,
      results: [],
      createdAt: FIXED,
      approvedAt: FIXED,
      startedAt: null,
    })
  return id
}

/** A client-shaped try id (UUID) */
const tid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const CLIENT_TRY_IDS = new Set(Array.from({ length: 200 }, (_, i) => tid(i)))

function submissionFor(
  plan: SessionPlan,
  correct: boolean,
  opts: { tryId?: string; sendEpoch?: boolean; sendPartIndex?: boolean } = {}
): SlotResultSubmission {
  const info = getCurrentProblemInfo(plan)
  if (!info) throw new Error('client shows no problem')
  return {
    ...(opts.tryId ? { tryId: opts.tryId } : {}),
    ...(opts.sendEpoch ? { epochNumber: info.epochNumber } : {}),
    ...(opts.sendPartIndex ? { partIndex: plan.currentPartIndex } : {}),
    slotId: info.slotId,
    slotIndex: info.originalSlotIndex,
    problem: info.problem,
    studentAnswer: correct ? info.problem.answer : info.problem.answer + 1,
    isCorrect: correct,
    responseTimeMs: 3000,
    skillsExercised: info.problem.skillsRequired,
    usedOnScreenAbacus: false,
    hadHelp: false,
    incorrectAttempts: correct ? 0 : 1,
  }
}

function doOver(
  plan: SessionPlan,
  partIndex: number,
  slotIndex: number,
  correct: boolean,
  tryId?: string
): [Omit<SlotResult, 'timestamp' | 'partNumber'>, RedoContext] {
  const slot = plan.parts[partIndex].slots[slotIndex]
  const p = slot.problem!
  return [
    {
      ...(tryId ? { tryId } : {}),
      slotId: slot.slotId,
      slotIndex,
      problem: p,
      studentAnswer: correct ? p.answer : p.answer + 1,
      isCorrect: correct,
      responseTimeMs: 2500,
      skillsExercised: p.skillsRequired,
      usedOnScreenAbacus: false,
      hadHelp: false,
      incorrectAttempts: 0,
    },
    { originalPartIndex: partIndex, originalSlotIndex: slotIndex, originalWasCorrect: false },
  ]
}

function maskResult(r: SlotResult) {
  const { timestamp, tryId, ...rest } = r
  return {
    ...rest,
    tryId: tryId === undefined ? '<none>' : CLIENT_TRY_IDS.has(tryId) ? tryId : '<minted>',
    timestamp: timestamp ? '<set>' : '<unset>',
  }
}

function projectRow(row: SessionPlan) {
  return {
    status: row.status,
    flowState: row.flowState,
    flowVersion: row.flowVersion,
    flowUpdatedAtMoved: row.flowUpdatedAt.getTime() !== FIXED.getTime(),
    currentPartIndex: row.currentPartIndex,
    currentSlotIndex: row.currentSlotIndex,
    retryState: row.retryState,
    breakStartedAt: row.breakStartedAt,
    breakResults: row.breakResults,
    breakReason: row.breakReason,
    breakSelectedGame: row.breakSelectedGame,
    completedAt: row.completedAt ? '<set>' : null,
    sessionHealth: row.sessionHealth,
    results: row.results.map(maskResult),
    parts: JSON.stringify(row.parts),
    shown: getCurrentProblemInfo(row),
  }
}

type Step = (plan: SessionPlan) => Promise<unknown>

/** Run steps against one plan; record the row after every step and the side effects. */
async function replay(planId: string, steps: [label: string, step: Step][]) {
  const trace: unknown[] = []
  for (const [label, step] of steps) {
    const before = (await getSessionPlan(planId))!
    recordSkillAttemptsWithHelp.mockClear()
    vi.mocked(revokeSharesForSession).mockClear()
    let outcome: string
    try {
      await step(before)
      outcome = 'ok'
    } catch (error) {
      outcome = `${(error as Error).name}: ${(error as Error).message}`
    }
    const after = (await getSessionPlan(planId))!
    trace.push({
      label,
      outcome,
      skillAttempts: recordSkillAttemptsWithHelp.mock.calls.map((c) => (c as unknown[]).slice(1)),
      revoked: vi.mocked(revokeSharesForSession).mock.calls.length,
      row: projectRow(after),
    })
  }
  // Guard against the capture going vacuous again: every scenario records at
  // least one counted try, so at least one step must show its skill attempts.
  expect(
    trace.some((t) => (t as { skillAttempts: unknown[] }).skillAttempts.length > 0),
    'no step captured a skill-attempt write: the recordSkillAttemptsWithHelp mock is not the one the planner calls'
  ).toBe(true)
  return trace
}

const answer =
  (correct: boolean, opts: Parameters<typeof submissionFor>[2] = {}): Step =>
  (plan) =>
    recordSlotResult(plan.id, submissionFor(plan, correct, opts))

const redo =
  (partIndex: number, slotIndex: number, correct: boolean, tryId?: string): Step =>
  (plan) =>
    recordRedoResult(plan.id, ...doOver(plan, partIndex, slotIndex, correct, tryId))

const setFlowState =
  (flowState: SessionFlowState): Step =>
  async (plan) => {
    await getCurrentEphemeralDb()!
      .update(schema.sessionPlans)
      .set({ flowState })
      .where(eq(schema.sessionPlans.id, plan.id))
  }

describe('part-kind golden replay (old path = snapshot recorded before the extraction)', () => {
  let eph: EphemeralDbResult
  let playerId: string
  let n = 0
  const next = () => tid(++n)

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    ;({ playerId } = await createTestStudent(eph.db, 'golden'))
    n = 0
  })
  afterEach(() => {
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  it('first tries through every part, with breaks: transitions and completion', async () => {
    const planId = await insertPlan(playerId, { breaks: true })
    const steps: [string, Step][] = []
    for (let p = 0; p < 3; p++) {
      for (let s = 0; s < 3; s++) {
        steps.push([`p${p}s${s} right`, answer(true, { tryId: next(), sendEpoch: true })])
      }
    }
    expect(await replay(planId, steps)).toMatchSnapshot()
  })

  it('first tries without breaks, an old plan written with kind, old clients (no tryId/epoch)', async () => {
    const planId = await insertPlan(playerId, { withKind: true })
    const steps: [string, Step][] = []
    // p0: right, wrong, right, retry right; p1: right, right, wrong, retry right; p2: right x3
    const pattern = [true, false, true, true, true, true, false, true, true, true, true]
    pattern.forEach((right, i) => {
      steps.push([`answer ${i} ${right ? 'right' : 'wrong'}`, answer(right)])
    })
    expect(await replay(planId, steps)).toMatchSnapshot()
  })

  it('retry rounds 1 and 2, then the answer is divulged and the part ends', async () => {
    const planId = await insertPlan(playerId)
    const o = { sendEpoch: true, sendPartIndex: true }
    expect(
      await replay(planId, [
        ['s0 wrong', answer(false, { ...o, tryId: next() })],
        ['s1 wrong', answer(false, { ...o, tryId: next() })],
        ['s2 right -> round 1 [s0, s1]', answer(true, { ...o, tryId: next() })],
        ['r1 s0 wrong', answer(false, { ...o, tryId: next() })],
        ['r1 s1 right -> round 2 [s0]', answer(true, { ...o, tryId: next() })],
        ['r2 s0 wrong -> divulged, part 2', answer(false, { ...o, tryId: next() })],
        ['redo of divulged s0 refused', redo(0, 0, true, next())],
        ['p1 s0 wrong', answer(false, { ...o, tryId: next() })],
        ['p1 s1 right', answer(true, { ...o, tryId: next() })],
        ['p1 s2 wrong -> round 1 [s0, s2]', answer(false, { ...o, tryId: next() })],
        ['p1 r1 s0 right', answer(true, { ...o, tryId: next() })],
        ['p1 r1 s2 right -> part 3', answer(true, { ...o, tryId: next() })],
      ])
    ).toMatchSnapshot()
  })

  it('a wrong-item do-over that redeems: while queued, and the last item of a running round', async () => {
    const planId = await insertPlan(playerId, { breaks: true })
    expect(
      await replay(planId, [
        ['s0 wrong (queued)', answer(false, { tryId: next() })],
        ['redo s0 right while queued: redeems', redo(0, 0, true, next())],
        ['s1 wrong', answer(false, { tryId: next() })],
        ['s2 wrong -> round 1 [s1, s2]', answer(false, { tryId: next() })],
        ['redo s2 wrong: counted, no redemption', redo(0, 2, false, next())],
        ['redo s1 right: skips s1 in the round', redo(0, 1, true, next())],
        ['r1 s2 right -> transition', answer(true, { tryId: next(), sendEpoch: true })],
        ['p1 s0 wrong', answer(false, { tryId: next() })],
        ['p1 s1 right', answer(true, { tryId: next() })],
        ['p1 s2 right -> round 1 [s0]', answer(true, { tryId: next() })],
        ['redo p1 s0 right: empties the round -> transition', redo(1, 0, true, next())],
        ['p2 s0 right', answer(true, { tryId: next() })],
        ['p2 s1 wrong', answer(false, { tryId: next() })],
        ['p2 s2 right -> round 1 [s1]', answer(true, { tryId: next() })],
        ['redo p2 s1 right: last item of the last part -> completed', redo(2, 1, true, next())],
      ])
    ).toMatchSnapshot()
  })

  it('a correct-item do-over is practice-only; one outside the practiced part never settles', async () => {
    const planId = await insertPlan(playerId, { breaks: true })
    expect(
      await replay(planId, [
        ['s0 right', answer(true, { tryId: next() })],
        ['redo s0 right: practice-only', redo(0, 0, true, next())],
        ['redo s0 wrong: practice-only', redo(0, 0, false, next())],
        ['s1 wrong', answer(false, { tryId: next() })],
        ['s2 wrong -> round 1 [s1, s2]', answer(false, { tryId: next() })],
        ['r1 s1 right', answer(true, { tryId: next() })],
        ['flowState forced to break_active (legacy edge)', setFlowState('break_active')],
        ['redo s2 right while not practicing: redeems, no settle', redo(0, 2, true, next())],
        ['flowState back to practicing', setFlowState('practicing')],
        ['redo s1 right again: practice-only, no settle', redo(0, 1, true, next())],
        ['redo s1 wrong: practice-only, no settle', redo(0, 1, false, next())],
        ['client shows nothing (stuck legacy edge)', answer(true, { tryId: next() })],
        ['redo of an unanswered slot refused', redo(1, 0, true, next())],
      ])
    ).toMatchSnapshot()
  })

  it('fast and double submits, and a stale tab', async () => {
    const planId = await insertPlan(playerId, { breaks: true })
    const dup = next()
    let held: SlotResultSubmission | null = null
    let heldRedo: ReturnType<typeof doOver> | null = null
    expect(
      await replay(planId, [
        [
          's0 right (held for resend)',
          (plan) => {
            held = submissionFor(plan, true, { tryId: dup, sendEpoch: true })
            return recordSlotResult(plan.id, held)
          },
        ],
        ['same tryId again: no-op', (plan) => recordSlotResult(plan.id, held!)],
        [
          'same try without tryId: exact-match no-op',
          (plan) => {
            const { tryId: _t, ...noId } = held!
            return recordSlotResult(plan.id, noId)
          },
        ],
        [
          'stale tab: s0 again with another answer',
          (plan) =>
            recordSlotResult(plan.id, {
              ...held!,
              tryId: next(),
              studentAnswer: held!.studentAnswer + 5,
            }),
        ],
        [
          'stale tab: lagged slotId but s1 content (stored with its own id)',
          (plan) =>
            recordSlotResult(plan.id, {
              ...submissionFor(plan, false, { tryId: next() }),
              slotId: plan.parts[0].slots[0].slotId,
            }),
        ],
        [
          'wrong round sent: mismatch',
          (plan) =>
            recordSlotResult(plan.id, {
              ...submissionFor(plan, true, { tryId: next() }),
              epochNumber: 1,
            }),
        ],
        [
          'redo s1 right (held for resend)',
          (plan) => {
            heldRedo = doOver(plan, 0, 1, true, next())
            return recordRedoResult(plan.id, ...heldRedo)
          },
        ],
        ['same redo tryId again: no-op', (plan) => recordRedoResult(plan.id, ...heldRedo!)],
        ['s2 right -> transition', answer(true, { tryId: next() })],
        ['redo p0 s0 during part_transition: practice-only', redo(0, 0, true, next())],
        [
          'resend of the part-ending try without tryId: no-op',
          async (plan) => {
            const last = plan.results.at(-1)!
            return recordSlotResult(plan.id, {
              slotId: last.slotId,
              slotIndex: last.slotIndex,
              problem: last.problem,
              studentAnswer: last.studentAnswer,
              isCorrect: last.isCorrect,
              responseTimeMs: 3000,
              skillsExercised: last.skillsExercised,
              usedOnScreenAbacus: false,
              hadHelp: false,
              incorrectAttempts: 0,
            })
          },
        ],
        ['p1 s0 right during part_transition (reload)', answer(true, { tryId: next() })],
        ['p1 s1 right', answer(true, { tryId: next() })],
        ['p1 s2 right -> transition', answer(true, { tryId: next() })],
        ['p2 s0 right', answer(true, { tryId: next() })],
        ['p2 s1 right', answer(true, { tryId: next() })],
        ['p2 s2 right -> completed', answer(true, { tryId: next() })],
        [
          'resend of the final try (same tryId) after completion: no-op',
          (plan) => {
            const last = plan.results.at(-1)!
            return recordSlotResult(plan.id, {
              tryId: last.tryId,
              slotId: last.slotId,
              slotIndex: last.slotIndex,
              problem: last.problem,
              studentAnswer: last.studentAnswer,
              isCorrect: true,
              responseTimeMs: 3000,
              skillsExercised: last.skillsExercised,
              usedOnScreenAbacus: false,
              hadHelp: false,
              incorrectAttempts: 0,
            })
          },
        ],
        [
          'a new answer after completion: mismatch',
          (plan) => {
            const last = plan.results.at(-1)!
            return recordSlotResult(plan.id, {
              tryId: next(),
              slotId: last.slotId,
              slotIndex: last.slotIndex,
              problem: last.problem,
              studentAnswer: last.studentAnswer + 1,
              isCorrect: false,
              responseTimeMs: 3000,
              skillsExercised: last.skillsExercised,
              usedOnScreenAbacus: false,
              hadHelp: false,
              incorrectAttempts: 0,
            })
          },
        ],
      ])
    ).toMatchSnapshot()
  })
})
