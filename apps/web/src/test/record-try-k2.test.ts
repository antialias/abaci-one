/**
 * @vitest-environment node
 *
 * Practice-kinds K2 (plan of record §1.3, §3.3, §4 K2): one recorder,
 * `recordTry`, for every try, on `EphemeralDatabase` and through the route.
 *
 * - The superset body and the legacy body for the same try give identical
 *   rows, byte for byte; a `record_try` envelope gives the same row too.
 * - Today's open tabs: verbatim copies of the request bodies today's client
 *   sends (`record`, a skip, `record_redo`) are recorded through the route.
 * - The rollback target: a K2 bundle's superset body sent to the K1 recorder
 *   as it was at 208433adb (`pre-k2/recorders.ts`) stores the row a K2 server
 *   stores from the legacy body.
 * - The server is the only judge (amendment A1), and the response carries the
 *   stored verdict; for a duplicate, the verdict already stored (A11).
 * - `record_try` for a part of kind `zzz`: 409 `unknown_kind`, the row
 *   unchanged, the session still in progress and endable.
 * - The two deliberate status-code changes (R14): a do-over of a divulged
 *   answer and a try for an unknown kind are 409s (the client half, that both
 *   resync quietly, is `hooks/__tests__/useSessionPlan.k2.test.tsx`).
 * - A duplicate `tryId` across the action names is one row.
 * - Four concurrent `recordTry` on one row: one wins per CAS round, no write
 *   is lost (the `session-row-version.test.ts` walk).
 */

import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import * as schema from '@/db/schema'
import { normalizeTries } from '@/db/schema/session-plan-normalize'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SlotResult,
  SlotResultSubmission,
} from '@/db/schema/session-plans'
import { arithmeticKind } from '@/lib/curriculum/parts/arithmetic/server'
import { getCurrentProblemInfo } from '@/lib/curriculum/parts/arithmetic/state'
import {
  type RedoContext,
  type RedoSubmission,
  recordTry,
  type TrySubmission,
  UnknownKindError,
} from '@/lib/curriculum/record-try'
import { ROW_CAS_ATTEMPTS, WriteContentionError } from '@/lib/curriculum/row-cas'
import { getSessionPlan } from '@/lib/curriculum/session-planner'
import { supersetBodyOf } from '@/lib/curriculum/try-wire'
import { sendRecord, sendRecordRedo } from '@/test/fixtures/legacy-try-bodies'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from './journey-simulator/EphemeralDatabase'
import * as k1 from './pre-k2/recorders'

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
vi.mock('@/lib/auth/withAuth', () => ({ withAuth: (handler: unknown) => handler }))
vi.mock('@/lib/viewer', () => ({ getUserId: async () => 'adult' }))
vi.mock('@/lib/classroom', () => ({ canPerformAction: async () => true }))
vi.mock('@/lib/classroom/socket-emitter', () => ({ emitSessionStartedToPlayer: vi.fn() }))

// After the mocks: the route loads `@/db`
const { PATCH } = await import('@/app/api/curriculum/[playerId]/sessions/plans/[planId]/route')

const FIXED = new Date('2026-01-01T00:00:00.000Z')

/** Slot `s` of part 0: `s + 1 + 2 = s + 3`; deterministic, so verbatim bodies can name it. */
function problem(s: number): GeneratedProblem {
  return { terms: [s + 1, 2], answer: s + 3, skillsRequired: ['basic.directAddition'] }
}

function arithmeticPart(slots: number): SessionPart {
  return {
    kind: 'arithmetic',
    partNumber: 1,
    type: 'abacus',
    format: 'vertical',
    useAbacus: true,
    slots: Array.from(
      { length: slots },
      (_, s): ProblemSlot => ({
        slotId: `p0s${s}`,
        index: s,
        purpose: 'focus',
        constraints: {},
        problem: problem(s),
      })
    ),
    estimatedMinutes: 2,
  }
}

/** A part a newer image wrote: a kind this image does not know. */
const unknownPart = {
  kind: 'zzz',
  partNumber: 1,
  content: { items: [{ itemId: 'z0' }, { itemId: 'z1' }] },
  estimatedMinutes: 2,
} as unknown as SessionPart

async function insertPlan(playerId: string, parts: SessionPart[] = [arithmeticPart(3)]) {
  const id = `k2-${Math.random().toString(36).slice(2, 10)}`
  await getCurrentEphemeralDb()
    .insert(schema.sessionPlans)
    .values({
      id,
      playerId,
      targetDurationMinutes: 6,
      estimatedProblemCount: 3,
      avgTimePerProblemSeconds: 20,
      gameBreakSettings: {
        enabled: false,
        maxDurationMinutes: 5,
        selectionMode: 'kid-chooses',
        selectedGame: null,
      },
      parts,
      summary: {} as SessionPlan['summary'],
      masteredSkillIds: [],
      status: 'in_progress',
      flowState: 'practicing',
      flowUpdatedAt: FIXED,
      flowVersion: 0,
      currentPartIndex: 0,
      results: [],
      adjustments: [],
      createdAt: FIXED,
      approvedAt: FIXED,
      startedAt: FIXED,
    })
  return id
}

const tid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

async function row(planId: string): Promise<SessionPlan> {
  return (await getSessionPlan(planId))!
}

/** A try as `handleSubmit` / `handleSkip` build it today (ActiveSession.tsx). */
type Step =
  | { t: 'answer'; correct: boolean; tryId: string }
  | { t: 'skip'; tryId: string }
  | { t: 'redo'; slotIndex: number; correct: boolean; tryId: string }

function legacyBody(plan: SessionPlan, step: Exclude<Step, { t: 'redo' }>): SlotResultSubmission {
  const info = getCurrentProblemInfo(plan)
  if (!info) throw new Error('client shows no problem')
  const correct = step.t === 'answer' && step.correct
  return {
    tryId: step.tryId,
    slotId: info.slotId,
    slotIndex: info.originalSlotIndex,
    epochNumber: info.epochNumber,
    problem: info.problem,
    studentAnswer: step.t === 'skip' || correct ? info.problem.answer : info.problem.answer + 1,
    isCorrect: correct,
    responseTimeMs: 3000,
    skillsExercised: info.problem.skillsRequired,
    usedOnScreenAbacus: false,
    incorrectAttempts: correct ? 0 : 1,
    hadHelp: step.t === 'skip',
    ...(step.t === 'skip' ? { helpTrigger: 'manual' as const } : {}),
    partIndex: plan.currentPartIndex,
  }
}

function legacyRedo(
  plan: SessionPlan,
  step: Extract<Step, { t: 'redo' }>
): [RedoSubmission, RedoContext] {
  const slot = plan.parts[0].slots[step.slotIndex]
  const p = slot.problem!
  return [
    {
      tryId: step.tryId,
      slotId: slot.slotId,
      slotIndex: step.slotIndex,
      epochNumber: 0,
      problem: p,
      studentAnswer: step.correct ? p.answer : p.answer + 1,
      isCorrect: step.correct,
      responseTimeMs: 2500,
      skillsExercised: p.skillsRequired,
      usedOnScreenAbacus: false,
      incorrectAttempts: 0,
      hadHelp: false,
      originalSlotIndex: step.slotIndex,
    },
    {
      itemId: slot.slotId,
      originalPartIndex: 0,
      originalSlotIndex: step.slotIndex,
      originalWasCorrect: false,
    },
  ]
}

/** The same try as a `record_try` envelope (what K4's client will send). */
function envelopeOf(plan: SessionPlan, step: Step): TrySubmission {
  if (step.t === 'redo') {
    const [body] = legacyRedo(plan, step)
    return {
      tryId: step.tryId,
      partIndex: 0,
      itemId: body.slotId,
      mode: 'do_over',
      outcome: 'answered',
      answer: body.studentAnswer,
      payload: { kind: 'arithmetic', usedOnScreenAbacus: false },
      timing: { responseTimeMs: body.responseTimeMs },
      help: { hadHelp: false, incorrectAttempts: 0 },
    }
  }
  const body = legacyBody(plan, step)
  return {
    tryId: step.tryId,
    partIndex: plan.currentPartIndex,
    itemId: body.slotId,
    mode: 'first_or_retry',
    outcome: step.t === 'skip' ? 'skipped' : 'answered',
    answer: step.t === 'skip' ? null : body.studentAnswer,
    payload: { kind: 'arithmetic', usedOnScreenAbacus: false },
    timing: { responseTimeMs: body.responseTimeMs },
    help: { hadHelp: false, incorrectAttempts: body.incorrectAttempts },
  }
}

/** s0 right, s1 wrong, s2 skipped → round 1 [s1, s2]; a do-over of s0; r1 s1 right, r1 s2 wrong; a do-over of s1. */
const WALK: Step[] = [
  { t: 'answer', correct: true, tryId: tid(1) },
  { t: 'answer', correct: false, tryId: tid(2) },
  { t: 'skip', tryId: tid(3) },
  { t: 'redo', slotIndex: 0, correct: true, tryId: tid(4) },
  { t: 'answer', correct: true, tryId: tid(5) },
  { t: 'answer', correct: false, tryId: tid(6) },
  { t: 'redo', slotIndex: 1, correct: false, tryId: tid(7) },
]

type Sender = (planId: string, plan: SessionPlan, step: Step) => Promise<unknown>

const legacySender: Sender = (planId, plan, step) =>
  step.t === 'redo'
    ? sendRecordRedo(planId, ...legacyRedo(plan, step))
    : sendRecord(planId, legacyBody(plan, step))

const supersetSender: Sender = (planId, plan, step) => {
  if (step.t === 'redo') {
    const [body, ctx] = legacyRedo(plan, step)
    return sendRecordRedo(planId, supersetBodyOf(body), ctx)
  }
  const body = legacyBody(plan, step)
  return sendRecord(
    planId,
    supersetBodyOf(step.t === 'skip' ? { ...body, outcome: 'skipped' as const } : body)
  )
}

const envelopeSender: Sender = (planId, plan, step) => recordTry(planId, envelopeOf(plan, step))

/** The K1 recorder at 208433adb with the K2 bundle's superset body (a rollback). */
const k1SupersetSender: Sender = (planId, plan, step) => {
  if (step.t === 'redo') {
    const [body, ctx] = legacyRedo(plan, step)
    return k1.recordRedoResult(planId, supersetBodyOf(body), ctx)
  }
  const body = legacyBody(plan, step)
  return k1.recordSlotResult(
    planId,
    supersetBodyOf(step.t === 'skip' ? { ...body, outcome: 'skipped' as const } : body)
  )
}

async function walk(playerId: string, send: Sender): Promise<SessionPlan> {
  const planId = await insertPlan(playerId)
  for (const step of WALK) await send(planId, await row(planId), step)
  return row(planId)
}

const masked = (results: SlotResult[]) =>
  results.map((r) => ({ ...r, timestamp: r.timestamp ? '<set>' : '<unset>' }))

async function patch(playerId: string, planId: string, body: unknown) {
  const res = await PATCH(
    new Request(`http://test/api/curriculum/${playerId}/sessions/plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ playerId, planId }) } as never
  )
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

describe('K2: one recorder', () => {
  let eph: EphemeralDbResult
  let playerId: string
  let warn: MockInstance<Parameters<typeof console.warn>, void>

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    ;({ playerId } = await createTestStudent(eph.db, 'k2'))
    recordSkillAttemptsWithHelp.mockClear()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  describe('one row whatever the body', () => {
    it('the superset body and the legacy body give identical rows, byte for byte', async () => {
      const legacy = await walk(playerId, legacySender)
      const superset = await walk(playerId, supersetSender)
      expect(legacy.results.map((r) => [r.kind, r.round, r.outcome, r.isCorrect])).toEqual([
        ['first', 0, 'answered', true],
        ['first', 0, 'answered', false],
        ['first', 0, 'skipped', false],
        ['do_over', 1, 'answered', true],
        ['retry', 1, 'answered', true],
        ['retry', 1, 'answered', false],
        ['do_over', 2, 'answered', false],
      ])
      expect(JSON.stringify(masked(superset.results))).toBe(JSON.stringify(masked(legacy.results)))
      expect(superset.partStates).toEqual(legacy.partStates)
      // Nothing of the superset envelope is stored verbatim
      for (const r of superset.results) expect(r).not.toHaveProperty('clientVerdict')
    })

    it('a record_try envelope gives the same row as the legacy body', async () => {
      const legacy = await walk(playerId, legacySender)
      const envelope = await walk(playerId, envelopeSender)
      expect(masked(envelope.results)).toEqual(masked(legacy.results))
      expect(envelope.partStates).toEqual(legacy.partStates)
    })

    it('rollback: the K1 recorder (208433adb) stores from the superset body the row K2 stores from the legacy body', async () => {
      const k2 = await walk(playerId, legacySender)
      const k1Rows = await walk(playerId, k1SupersetSender)
      expect(masked(k1Rows.results)).toEqual(masked(k2.results))
      expect(k1Rows.partStates).toEqual(k2.partStates)
    })
  })

  describe("today's open tabs: verbatim request bodies of today's client", () => {
    // `JSON.stringify` of what useSessionPlan (208433adb) sends for a
    // handleSubmit answer, a handleSkip and a doOverWriteOf do-over (key order
    // and all), the problems those of `arithmeticPart(3)`
    const RECORD_RIGHT = `{"action":"record","result":{"tryId":"00000000-0000-4000-8000-000000000011","slotId":"p0s0","slotIndex":0,"epochNumber":0,"problem":{"terms":[1,2],"answer":3,"skillsRequired":["basic.directAddition"]},"studentAnswer":3,"isCorrect":true,"responseTimeMs":2875,"skillsExercised":["basic.directAddition"],"usedOnScreenAbacus":false,"incorrectAttempts":0,"hadHelp":false,"partIndex":0}}`
    const RECORD_SKIP = `{"action":"record","result":{"tryId":"00000000-0000-4000-8000-000000000012","slotId":"p0s1","slotIndex":1,"epochNumber":0,"partIndex":0,"problem":{"terms":[2,2],"answer":4,"skillsRequired":["basic.directAddition"]},"studentAnswer":4,"isCorrect":false,"responseTimeMs":5120,"skillsExercised":["basic.directAddition"],"usedOnScreenAbacus":false,"incorrectAttempts":0,"hadHelp":true,"helpTrigger":"manual"}}`
    const RECORD_REDO = `{"action":"record_redo","result":{"tryId":"00000000-0000-4000-8000-000000000013","slotId":"p0s0","slotIndex":0,"epochNumber":0,"problem":{"terms":[1,2],"answer":3,"skillsRequired":["basic.directAddition"]},"studentAnswer":3,"isCorrect":true,"responseTimeMs":1990,"skillsExercised":["basic.directAddition"],"usedOnScreenAbacus":false,"incorrectAttempts":0,"hadHelp":false,"originalSlotIndex":0},"redoContext":{"itemId":"p0s0","originalPartIndex":0,"originalSlotIndex":0,"originalWasCorrect":true}}`

    it('records each through the route, judged by the server, with the verdict in the reply', async () => {
      const planId = await insertPlan(playerId)
      const right = await patch(playerId, planId, RECORD_RIGHT)
      expect(right.status).toBe(200)
      expect(right.json.try).toEqual({
        tryId: tid(11),
        isCorrect: true,
        outcome: 'answered',
      })
      const skip = await patch(playerId, planId, RECORD_SKIP)
      expect(skip.json.try).toEqual({ tryId: tid(12), isCorrect: false, outcome: 'skipped' })
      const redo = await patch(playerId, planId, RECORD_REDO)
      expect(redo.json.try).toEqual({ tryId: tid(13), isCorrect: true, outcome: 'answered' })

      const stored = await row(planId)
      expect(stored.results.map((r) => [r.tryId, r.kind, r.outcome, r.isCorrect])).toEqual([
        [tid(11), 'first', 'answered', true],
        [tid(12), 'first', 'skipped', false],
        [tid(13), 'do_over', 'answered', true],
      ])
      // The legacy top level as the body sent it (S4), the envelope stamped
      expect(stored.results[1]).toMatchObject({
        studentAnswer: 4,
        hadHelp: true,
        helpTrigger: 'manual',
        answer: null,
        itemId: 'p0s1',
        payload: { kind: 'arithmetic' },
      })
      // The do-over of a right answer is practice-only, as before
      expect(stored.results[2]).toMatchObject({ practiceOnly: true, masteryWeight: 0 })
      // The reply's plan is the stored plan, as the old bundle reads it
      expect((right.json.plan as SessionPlan).id).toBe(planId)
    })
  })

  describe('the server is the only judge (amendment A1, A11)', () => {
    it("stores and returns the judge's verdict, not the body's", async () => {
      const planId = await insertPlan(playerId)
      const body = {
        ...legacyBody(await row(planId), { t: 'answer', correct: false, tryId: tid(1) }),
      }
      const { status, json } = await patch(playerId, planId, {
        action: 'record',
        result: { ...body, isCorrect: true },
      })
      expect(status).toBe(200)
      expect(json.try).toEqual({ tryId: tid(1), isCorrect: false, outcome: 'answered' })
      const stored = (await row(planId)).results[0]
      expect(stored.isCorrect).toBe(false)
      // A wrong first try opens the retry queue, whatever the body said
      expect(getCurrentProblemInfo(await row(planId))?.slotId).toBe('p0s1')
      // Nothing compares the two
      expect(warn.mock.calls.filter((c) => String(c[0]).includes('judge'))).toEqual([])
    })

    it('a duplicate tryId returns the verdict already stored, not a new one', async () => {
      const planId = await insertPlan(playerId)
      const first = legacyBody(await row(planId), { t: 'answer', correct: true, tryId: tid(1) })
      await patch(playerId, planId, { action: 'record', result: first })
      // The same tryId again with another answer: the stored verdict comes back
      const again = await patch(playerId, planId, {
        action: 'record',
        result: { ...first, studentAnswer: 99 },
      })
      expect(again.status).toBe(200)
      expect(again.json.try).toEqual({ tryId: tid(1), isCorrect: true, outcome: 'answered' })
      // And through record_try
      const viaTry = await patch(playerId, planId, {
        action: 'record_try',
        result: { ...envelopeOf(await row(planId), { t: 'skip', tryId: tid(1) }) },
      })
      expect(viaTry.json.try).toEqual({ tryId: tid(1), isCorrect: true, outcome: 'answered' })
      expect((await row(planId)).results).toHaveLength(1)
    })
  })

  describe('a part of a kind this image does not know (R14)', () => {
    it('record_try is 409 unknown_kind; the row unchanged; the session in progress and endable', async () => {
      const planId = await insertPlan(playerId, [unknownPart])
      const before = await row(planId)
      const submission: TrySubmission = {
        tryId: tid(1),
        partIndex: 0,
        itemId: 'z0',
        mode: 'first_or_retry',
        outcome: 'answered',
        answer: 3,
        payload: { kind: 'zzz' },
        timing: { responseTimeMs: 1000 },
        help: { hadHelp: false, incorrectAttempts: 0 },
      }
      await expect(recordTry(planId, submission)).rejects.toBeInstanceOf(UnknownKindError)
      const viaRoute = await patch(playerId, planId, { action: 'record_try', result: submission })
      expect(viaRoute.status).toBe(409)
      expect(viaRoute.json.code).toBe('unknown_kind')

      const after = await row(planId)
      expect(after.rowVersion).toBe(before.rowVersion)
      expect(after.results).toEqual([])
      expect(after.status).toBe('in_progress')
      expect(recordSkillAttemptsWithHelp).not.toHaveBeenCalled()

      const ended = await patch(playerId, planId, { action: 'end_early', reason: 'test' })
      expect(ended.status).toBe(200)
      expect((ended.json.plan as SessionPlan).status).toBe('completed')
    })

    it('a legacy do-over named by indices into it: 409 unknown_kind, where K1 answered 500', async () => {
      const planId = await insertPlan(playerId, [arithmeticPart(2), unknownPart])
      const [body, ctx] = legacyRedo(await row(planId), {
        t: 'redo',
        slotIndex: 0,
        correct: true,
        tryId: tid(1),
      })
      const { status, json } = await patch(playerId, planId, {
        action: 'record_redo',
        result: body,
        redoContext: { originalPartIndex: 1, originalSlotIndex: 0 },
      })
      expect(ctx.itemId).toBe('p0s0')
      expect(status).toBe(409)
      expect(json.code).toBe('unknown_kind')
    })
  })

  it('a do-over of a divulged answer: 409 SLOT_MISMATCH, where K1 answered 500 (R14)', async () => {
    const planId = await insertPlan(playerId, [arithmeticPart(2)])
    // s0 wrong, s1 right -> round 1 [s0] wrong -> round 2 [s0] wrong: divulged, done
    for (const correct of [false, true, false, false]) {
      const plan = await row(planId)
      await sendRecord(
        planId,
        legacyBody(plan, { t: 'answer', correct, tryId: tid(100 + plan.results.length) })
      )
    }
    const before = await row(planId)
    expect(before.status).toBe('completed')
    const [body, ctx] = legacyRedo(before, {
      t: 'redo',
      slotIndex: 0,
      correct: true,
      tryId: tid(1),
    })
    const { status, json } = await patch(playerId, planId, {
      action: 'record_redo',
      result: body,
      redoContext: ctx,
    })
    expect(status).toBe(409)
    expect(json.code).toBe('SLOT_MISMATCH')
    expect((await row(planId)).results).toHaveLength(before.results.length)
    // The kind refuses it; the item answered right on its first try it takes
    const content = arithmeticKind.contentOf(before.parts[0] as never)
    const kindTries = normalizeTries(planId, before.parts, before.results).map((t) => ({
      itemId: t.itemId,
      kind: t.kind,
      round: t.round,
      practiceOnly: t.practiceOnly,
      isCorrect: t.isCorrect,
    }))
    expect(arithmeticKind.acceptsDoOver(content, null as never, kindTries, 'p0s0')).toBe(false)
    expect(arithmeticKind.acceptsDoOver(content, null as never, kindTries, 'p0s1')).toBe(true)
  })

  it('a duplicate tryId across the action names is one row', async () => {
    const planId = await insertPlan(playerId)
    const plan = await row(planId)
    const body = legacyBody(plan, { t: 'answer', correct: true, tryId: tid(1) })
    await patch(playerId, planId, { action: 'record', result: body })
    // The same try id as an envelope, and as a do-over of the item it answered
    await patch(playerId, planId, {
      action: 'record_try',
      result: envelopeOf(await row(planId), { t: 'answer', correct: true, tryId: tid(1) }),
    })
    const [redo, ctx] = legacyRedo(await row(planId), {
      t: 'redo',
      slotIndex: 0,
      correct: true,
      tryId: tid(1),
    })
    await patch(playerId, planId, { action: 'record_redo', result: redo, redoContext: ctx })
    // And the other way round: record_try first, then record
    const second = envelopeOf(await row(planId), { t: 'answer', correct: false, tryId: tid(2) })
    await patch(playerId, planId, { action: 'record_try', result: second })
    await patch(playerId, planId, {
      action: 'record',
      result: legacyBody(await row(planId), { t: 'answer', correct: true, tryId: tid(2) }),
    })
    const stored = await row(planId)
    expect(stored.results.map((r) => r.tryId)).toEqual([tid(1), tid(2)])
    expect(recordSkillAttemptsWithHelp).toHaveBeenCalledTimes(2)
  })

  it('four concurrent recordTry on one row: one wins per CAS round, no write lost', async () => {
    const planId = await insertPlan(playerId, [arithmeticPart(5)])
    for (let s = 0; s < 4; s++) {
      const plan = await row(planId)
      await sendRecord(
        planId,
        legacyBody(plan, { t: 'answer', correct: false, tryId: tid(10 + s) })
      )
    }
    recordSkillAttemptsWithHelp.mockClear()
    const plan = await row(planId)
    const steps = [0, 1, 2, 3].map(
      (s): Extract<Step, { t: 'redo' }> => ({
        t: 'redo',
        slotIndex: s,
        correct: true,
        tryId: tid(20 + s),
      })
    )
    // One of each body: legacy, superset, and two envelopes
    const senders: Sender[] = [legacySender, supersetSender, envelopeSender, envelopeSender]
    const settled = await Promise.allSettled(steps.map((step, i) => senders[i](planId, plan, step)))

    const rejected = settled.filter((s) => s.status === 'rejected') as PromiseRejectedResult[]
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toBeInstanceOf(WriteContentionError)
    const racesLost = warn.mock.calls.filter(
      (c) => c[0] === '[withRowCas] lost a write race; re-reading'
    ).length
    expect(racesLost).toBeGreaterThanOrEqual(ROW_CAS_ATTEMPTS)

    const after = await row(planId)
    const landed = steps.filter((_, i) => settled[i].status === 'fulfilled').map((s) => s.tryId)
    const stored = after.results.filter((r) => r.kind === 'do_over').map((r) => r.tryId)
    expect(stored.sort()).toEqual([...landed].sort())
    // one write per CAS round: three rounds, three landed
    expect(after.rowVersion).toBe(plan.rowVersion + 3)
    expect(recordSkillAttemptsWithHelp).toHaveBeenCalledTimes(3)
  })
})
