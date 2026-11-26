/**
 * @vitest-environment node
 *
 * Phase 3a of the session architecture (plan of record §7): the row version
 * (`withRowCas`) and the flow machine owning the rhythm.
 *
 * Concurrency here is real, not scripted: the calls run against one SQLite
 * row through the production code path, and better-sqlite3 runs each query
 * when it is awaited, so `Promise.allSettled` interleaves the writers at their
 * awaits. Every writer reads the row before any of them writes, the first
 * write bumps `row_version`, and the others' `UPDATE … WHERE row_version = ?`
 * matches nothing; each test asserts that the CAS retry path actually ran
 * (the "lost a write race" log), not just the end state.
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import * as schema from '@/db/schema'
import { getCurrentProblemInfo } from '@/db/schema/session-plan-helpers'
import { legacyBreaksOf, partStateOf } from '@/db/schema/session-plan-normalize'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SlotResult,
  SlotResultSubmission,
} from '@/db/schema/session-plans'
import { arithmeticKind } from '@/lib/curriculum/parts/arithmetic/server'
import { arithmeticStateOf } from '@/lib/curriculum/parts/arithmetic/state'
import { ROW_CAS_ATTEMPTS, WriteContentionError } from '@/lib/curriculum/row-cas'
import { InvalidFlowTransitionError } from '@/lib/curriculum/session-flow'
import {
  abandonSessionPlan,
  applySessionFlowEvent,
  completeSessionPlanEarly,
  getSessionPlan,
  type RedoContext,
  recordRedoResult,
  recordSlotResult,
  SlotResultMismatchError,
} from '@/lib/curriculum/session-planner'
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

// Held here rather than imported from the mocked module: progress-manager and
// session-planner import each other, and a test that imports progress-manager
// first has the planner bind the real function while the mock factory is still
// loading the original (the golden replay's `skillAttempts` are all [] for this
// reason). Importing only the planner lets it bind the mock.
const { recordSkillAttemptsWithHelp } = vi.hoisted(() => ({
  recordSkillAttemptsWithHelp: vi.fn(async () => []),
}))
vi.mock('@/lib/curriculum/progress-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/curriculum/progress-manager')>()),
  recordSkillAttemptsWithHelp,
}))

// The worksheet routes, without the auth layer
vi.mock('@/lib/auth/withAuth', () => ({ withAuth: (handler: unknown) => handler }))
vi.mock('@/lib/viewer', () => ({ getUserId: async () => 'reviewer' }))
vi.mock('@/lib/classroom', () => ({ canPerformAction: async () => true }))

const FIXED = new Date('2026-01-01T00:00:00.000Z')
const PART_TYPES = [
  { type: 'abacus', format: 'vertical', useAbacus: true },
  { type: 'visualization', format: 'vertical', useAbacus: false },
  { type: 'linear', format: 'linear', useAbacus: false },
] as const

function problem(p: number, s: number): GeneratedProblem {
  const terms = [10 * p + s + 1, s + 2]
  return { terms, answer: terms[0] + terms[1], skillsRequired: ['basic.directAddition'] }
}

function fixtureParts(slotsPerPart: number): SessionPart[] {
  return PART_TYPES.map((t, p) => ({
    kind: 'arithmetic' as const,
    partNumber: (p + 1) as 1 | 2 | 3,
    ...t,
    slots: Array.from(
      { length: slotsPerPart },
      (_, s): ProblemSlot => ({
        slotId: `p${p}s${s}`,
        index: s,
        purpose: 'focus',
        constraints: {},
        problem: problem(p, s),
      })
    ),
    estimatedMinutes: 2,
  }))
}

async function insertPlan(
  playerId: string,
  {
    breaks = false,
    slotsPerPart = 2,
    values = {},
  }: { breaks?: boolean; slotsPerPart?: number; values?: Partial<SessionPlan> } = {}
): Promise<string> {
  const id = `rv-${Math.random().toString(36).slice(2, 10)}`
  await getCurrentEphemeralDb()
    .insert(schema.sessionPlans)
    .values({
      id,
      playerId,
      targetDurationMinutes: 6,
      estimatedProblemCount: slotsPerPart * 3,
      avgTimePerProblemSeconds: 20,
      gameBreakSettings: {
        enabled: breaks,
        maxDurationMinutes: 5,
        selectionMode: 'kid-chooses',
        selectedGame: null,
      },
      parts: fixtureParts(slotsPerPart),
      summary: {} as SessionPlan['summary'],
      masteredSkillIds: [],
      status: 'in_progress',
      flowState: 'practicing',
      flowUpdatedAt: FIXED,
      flowVersion: 0,
      currentPartIndex: 0,
      currentSlotIndex: 0,
      results: [],
      adjustments: [],
      createdAt: FIXED,
      approvedAt: FIXED,
      startedAt: FIXED,
      ...values,
    })
  return id
}

let tryCounter = 0
const tid = () => `00000000-0000-4000-8000-${String(++tryCounter).padStart(12, '0')}`

function submissionFor(plan: SessionPlan, correct: boolean, tryId = tid()): SlotResultSubmission {
  const info = getCurrentProblemInfo(plan)
  if (!info) throw new Error('client shows no problem')
  return {
    tryId,
    epochNumber: info.epochNumber,
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
  tryId = tid()
): [Omit<SlotResult, 'timestamp' | 'partNumber'>, RedoContext] {
  const p = plan.parts[partIndex].slots[slotIndex].problem!
  return [
    {
      tryId,
      slotId: plan.parts[partIndex].slots[slotIndex].slotId,
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
    { originalPartIndex: partIndex, originalSlotIndex: slotIndex },
  ]
}

async function answer(planId: string, correct: boolean): Promise<SessionPlan> {
  const plan = (await getSessionPlan(planId))!
  return recordSlotResult(planId, submissionFor(plan, correct))
}

async function row(planId: string): Promise<SessionPlan> {
  return (await getSessionPlan(planId))!
}

/** Write raw columns, bypassing the CAS, as an image from before Phase 3a would. */
async function writeAsOldImage(planId: string, fields: Partial<SessionPlan>) {
  await getCurrentEphemeralDb()
    .update(schema.sessionPlans)
    .set(fields)
    .where(eq(schema.sessionPlans.id, planId))
}

describe('Phase 3a: row version and the flow machine', () => {
  let eph: EphemeralDbResult
  let playerId: string
  let userId: string
  let lostRaces: MockInstance<Parameters<typeof console.warn>, void>

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    ;({ playerId, userId } = await createTestStudent(eph.db, 'rowversion'))
    vi.mocked(recordSkillAttemptsWithHelp).mockClear()
    const warn = console.warn
    lostRaces = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      if (args[0] !== '[withRowCas] lost a write race; re-reading') warn(...args)
    })
  })
  afterEach(() => {
    lostRaces.mockRestore()
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  const racesLost = () =>
    lostRaces.mock.calls.filter((c) => c[0] === '[withRowCas] lost a write race; re-reading').length

  describe('concurrent writers (P1-10)', () => {
    it('two first tries for one item: one wins, the loser re-reads and sees the next item', async () => {
      const planId = await insertPlan(playerId)
      const plan = await row(planId)
      const [a, b] = await Promise.allSettled([
        recordSlotResult(planId, submissionFor(plan, true)),
        recordSlotResult(planId, submissionFor(plan, true)),
      ])

      expect(racesLost()).toBeGreaterThanOrEqual(1)
      const outcomes = [a.status, b.status].sort()
      expect(outcomes).toEqual(['fulfilled', 'rejected'])
      const loser = (a.status === 'rejected' ? a : b) as PromiseRejectedResult
      expect(loser.reason).toBeInstanceOf(SlotResultMismatchError)
      expect((loser.reason as SlotResultMismatchError).expectedSlotId).toBe('p0s1')

      const after = await row(planId)
      expect(after.results).toHaveLength(1)
      expect(after.rowVersion).toBe(plan.rowVersion + 1)
      expect(getCurrentProblemInfo(after)?.slotId).toBe('p0s1')
      expect(recordSkillAttemptsWithHelp).toHaveBeenCalledTimes(1)
    })

    it('two sends of one tryId at once: one row, one skill-attempt bump', async () => {
      const planId = await insertPlan(playerId)
      const plan = await row(planId)
      const submission = submissionFor(plan, true)
      const settled = await Promise.allSettled([
        recordSlotResult(planId, submission),
        recordSlotResult(planId, { ...submission }),
      ])

      expect(racesLost()).toBeGreaterThanOrEqual(1)
      expect(settled.map((s) => s.status)).toEqual(['fulfilled', 'fulfilled'])
      const after = await row(planId)
      expect(after.results.map((r) => r.tryId)).toEqual([submission.tryId])
      expect(after.rowVersion).toBe(plan.rowVersion + 1)
      expect(recordSkillAttemptsWithHelp).toHaveBeenCalledTimes(1)
    })

    it('four do-overs at once: three land, the fourth exhausts to write_contention, nothing lost', async () => {
      const planId = await insertPlan(playerId, { slotsPerPart: 5 })
      for (let s = 0; s < 4; s++) await answer(planId, false)
      vi.mocked(recordSkillAttemptsWithHelp).mockClear()
      const plan = await row(planId)
      const calls = [0, 1, 2, 3].map((s) => doOver(plan, 0, s, true))

      const settled = await Promise.allSettled(
        calls.map(([result, ctx]) => recordRedoResult(planId, result, ctx))
      )

      const rejected = settled.filter((s) => s.status === 'rejected') as PromiseRejectedResult[]
      expect(rejected).toHaveLength(1)
      expect(rejected[0].reason).toBeInstanceOf(WriteContentionError)
      expect(rejected[0].reason).toMatchObject({ status: 503, code: 'write_contention' })
      expect(racesLost()).toBeGreaterThanOrEqual(ROW_CAS_ATTEMPTS)

      const after = await row(planId)
      const landed = calls
        .filter((_, i) => settled[i].status === 'fulfilled')
        .map(([result]) => result.tryId)
      const lost = calls.find((_, i) => settled[i].status === 'rejected')![0].tryId
      const stored = after.results.filter((r) => r.kind === 'do_over').map((r) => r.tryId)
      expect(stored.sort()).toEqual([...landed].sort())
      expect(stored).not.toContain(lost)
      expect(after.rowVersion).toBe(plan.rowVersion + 3)
      // Every landed do-over redeemed its item; the refused one did not
      const redeemed = after.retryState?.[0]?.redeemedSlots ?? []
      expect(redeemed).toHaveLength(3)
      expect(recordSkillAttemptsWithHelp).toHaveBeenCalledTimes(3)
    })
  })

  describe('adult events land in one write', () => {
    it('end_early: status, flowState, completedAt and the adjustment in one rowVersion', async () => {
      const planId = await insertPlan(playerId, { breaks: true, slotsPerPart: 1 })
      await answer(planId, true) // -> part_transition
      await applySessionFlowEvent(planId, { type: 'PART_TRANSITION_COMPLETED' })
      await applySessionFlowEvent(planId, { type: 'BREAK_STARTED', game: 'memory-quiz' })
      const before = await row(planId)
      expect(before.flowState).toBe('break_active')

      const ended = await completeSessionPlanEarly(planId, 'bedtime')

      expect(ended.rowVersion).toBe(before.rowVersion + 1)
      expect(ended).toMatchObject({ status: 'completed', flowState: 'completed' })
      expect(ended.completedAt).toBeInstanceOf(Date)
      expect(ended.flowVersion).toBe(before.flowVersion + 1)
      expect(ended.adjustments.map((a) => [a.type, a.reason])).toEqual([['ended_early', 'bedtime']])
      // The open break is closed by the end
      expect(ended.breaks).toHaveLength(1)
      expect(ended.breaks[0].endedAt).toBeDefined()

      // Ending again is a no-op, not a second adjustment
      const again = await completeSessionPlanEarly(planId, 'again')
      expect(again.rowVersion).toBe(ended.rowVersion)
      expect(again.adjustments).toHaveLength(1)
    })

    it('abandon: status, flowState and completedAt in one write', async () => {
      const planId = await insertPlan(playerId)
      const before = await row(planId)
      const abandoned = await abandonSessionPlan(planId)
      expect(abandoned.rowVersion).toBe(before.rowVersion + 1)
      expect(abandoned).toMatchObject({ status: 'abandoned', flowState: 'abandoned' })
      expect(abandoned.completedAt).toBeInstanceOf(Date)
    })

    describe('worksheet approve / unapprove (routes)', () => {
      const parsing = {
        problems: [
          { terms: [2, 3], studentAnswer: 5, correctAnswer: 5 },
          { terms: [4, 1], studentAnswer: 6, correctAnswer: 5 },
        ].map((p) => ({ ...p, termsConfidence: 1, studentAnswerConfidence: 1 })),
        warnings: [],
      }

      async function insertAttachment(sessionId: string): Promise<string> {
        const id = `att-${Math.random().toString(36).slice(2, 8)}`
        await getCurrentEphemeralDb()
          .insert(schema.practiceAttachments)
          .values({
            id,
            playerId,
            sessionId,
            filename: 'w.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1,
            parsingStatus: 'needs_review',
            rawParsingResult: parsing as never,
            uploadedBy: userId,
          })
        return id
      }

      async function post(route: 'approve' | 'unapprove', attachmentId: string) {
        const mod =
          route === 'approve'
            ? await import(
                '@/app/api/curriculum/[playerId]/attachments/[attachmentId]/approve/route'
              )
            : await import(
                '@/app/api/curriculum/[playerId]/attachments/[attachmentId]/unapprove/route'
              )
        const res = await (mod.POST as unknown as (r: Request, c: unknown) => Promise<Response>)(
          new Request('http://test/'),
          { params: Promise.resolve({ playerId, attachmentId }) }
        )
        return { status: res.status, body: await res.json() }
      }

      it('approve completes in one write; unapprove voids and reopens a session with nothing else', async () => {
        // A live session that had not started answering
        const planId = await insertPlan(playerId)
        const attachmentId = await insertAttachment(planId)
        const before = await row(planId)

        const approved = await post('approve', attachmentId)
        expect(approved.status).toBe(200)
        expect(approved.body.problemCount).toBe(2)
        const afterApprove = await row(planId)
        expect(afterApprove.rowVersion).toBe(before.rowVersion + 1)
        expect(afterApprove).toMatchObject({ status: 'completed', flowState: 'completed' })
        expect(afterApprove.completedAt).toBeInstanceOf(Date)
        expect(afterApprove.results.map((r) => r.attachmentId)).toEqual([
          attachmentId,
          attachmentId,
        ])
        expect(afterApprove.results.every((r) => typeof r.tryId === 'string')).toBe(true)

        const unapproved = await post('unapprove', attachmentId)
        expect(unapproved.status).toBe(200)
        expect(unapproved.body.problemsRemoved).toBe(2)
        const afterUnapprove = await row(planId)
        expect(afterUnapprove.rowVersion).toBe(afterApprove.rowVersion + 1)
        // Append-only: the tries stay, voided
        expect(afterUnapprove.results).toHaveLength(2)
        expect(afterUnapprove.results.every((r) => r.voided === true)).toBe(true)
        expect(afterUnapprove).toMatchObject({ status: 'in_progress', flowState: 'practicing' })
        expect(afterUnapprove.completedAt).toBeNull()

        // Re-approval appends fresh tries
        const reapproved = await post('approve', attachmentId)
        expect(reapproved.status).toBe(200)
        const afterReapprove = await row(planId)
        expect(afterReapprove.results).toHaveLength(4)
        expect(afterReapprove.results.filter((r) => !r.voided)).toHaveLength(2)
        expect(afterReapprove.status).toBe('completed')
      })

      it('unapprove keeps a session completed when counted tries remain or it is past its last part', async () => {
        // Practice tries remain
        const live = await insertPlan(playerId)
        await answer(live, true)
        const a1 = await insertAttachment(live)
        await post('approve', a1)
        await post('unapprove', a1)
        const liveRow = await row(live)
        expect(liveRow).toMatchObject({ status: 'completed', flowState: 'completed' })
        expect(liveRow.completedAt).toBeInstanceOf(Date)
        expect(liveRow.results.filter((r) => !r.voided)).toHaveLength(1)

        // An offline session (past its last part, nothing else)
        const offline = await insertPlan(playerId, {
          values: { status: 'completed', currentPartIndex: 3, completedAt: FIXED },
        })
        const a2 = await insertAttachment(offline)
        await post('approve', a2)
        await post('unapprove', a2)
        const offlineRow = await row(offline)
        expect(offlineRow).toMatchObject({ status: 'completed', flowState: 'completed' })
        expect(offlineRow.completedAt).toBeInstanceOf(Date)
      })

      // Live practice first (two untagged tries: what the old tail rule would
      // wrongly void), then the worksheet's two tagged tries.
      async function approvedOverPractice() {
        const planId = await insertPlan(playerId, { slotsPerPart: 3 })
        await answer(planId, true)
        await answer(planId, false)
        const attachmentId = await insertAttachment(planId)
        expect((await post('approve', attachmentId)).status).toBe(200)
        return { planId, attachmentId }
      }
      const voidedFlags = async (planId: string) =>
        (await row(planId)).results.map((r) => [r.attachmentId ?? null, r.voided === true])

      it('two concurrent unapproves void the worksheet once and nothing else', async () => {
        const { planId, attachmentId } = await approvedOverPractice()
        const before = await row(planId)

        const settled = await Promise.all([
          post('unapprove', attachmentId),
          post('unapprove', attachmentId),
        ])

        expect(racesLost()).toBeGreaterThanOrEqual(1) // both passed the attachment check
        expect(settled.map((s) => s.status)).toEqual([200, 200])
        expect(settled.map((s) => s.body.problemsRemoved).sort()).toEqual([0, 2])
        expect(await voidedFlags(planId)).toEqual([
          [null, false],
          [null, false],
          [attachmentId, true],
          [attachmentId, true],
        ])
        expect((await row(planId)).rowVersion).toBe(before.rowVersion + 1)
      })

      it('an unapprove retried after its write committed is a no-op', async () => {
        const { planId, attachmentId } = await approvedOverPractice()
        expect((await post('unapprove', attachmentId)).body.problemsRemoved).toBe(2)
        const committed = await row(planId)
        // The retry still sees the attachment as approved (its first request's
        // reply, or the attachment update, was lost)
        await getCurrentEphemeralDb()
          .update(schema.practiceAttachments)
          .set({ sessionCreated: true, createdSessionId: planId })
          .where(eq(schema.practiceAttachments.id, attachmentId))

        const retried = await post('unapprove', attachmentId)

        expect(retried.status).toBe(200)
        expect(retried.body.problemsRemoved).toBe(0)
        expect(await voidedFlags(planId)).toEqual([
          [null, false],
          [null, false],
          [attachmentId, true],
          [attachmentId, true],
        ])
        expect((await row(planId)).rowVersion).toBe(committed.rowVersion)
      })

      it('unapprove of an approval from before Phase 3a voids the last N untagged tries', async () => {
        const planId = await insertPlan(playerId)
        await answer(planId, true)
        const attachmentId = await insertAttachment(planId)
        // What the old approve route wrote: N untagged rows, no tryId
        const plan = await row(planId)
        const legacyRows = parsing.problems.map(
          (p, i): SlotResult => ({
            slotId: `legacy-${i}`,
            partNumber: 1,
            slotIndex: plan.results.length + i,
            problem: { terms: p.terms, answer: p.correctAnswer, skillsRequired: [] },
            studentAnswer: p.studentAnswer,
            isCorrect: p.studentAnswer === p.correctAnswer,
            responseTimeMs: 0,
            skillsExercised: [],
            usedOnScreenAbacus: false,
            hadHelp: false,
            incorrectAttempts: 0,
            source: 'practice',
            timestamp: FIXED,
          })
        )
        await writeAsOldImage(planId, {
          results: [...plan.results, ...legacyRows],
          status: 'completed',
          completedAt: FIXED,
        })
        await getCurrentEphemeralDb()
          .update(schema.practiceAttachments)
          .set({ sessionCreated: true, createdSessionId: planId })
          .where(eq(schema.practiceAttachments.id, attachmentId))

        await post('unapprove', attachmentId)
        const after = await row(planId)
        expect(after.results.map((r) => r.voided === true)).toEqual([false, true, true])
        expect(after.status).toBe('completed')
      })
    })
  })

  describe('the machine owns the rhythm', () => {
    it('enters part_transition after every finished part, breaks or not', async () => {
      const planId = await insertPlan(playerId, { breaks: false, slotsPerPart: 1 })
      const after = await answer(planId, true)
      expect(after).toMatchObject({ flowState: 'part_transition', currentPartIndex: 1 })
      expect(after.flowVersion).toBe(1)
    })

    it('a try in part_transition with breaks off is accepted and transitions', async () => {
      const planId = await insertPlan(playerId, { breaks: false, slotsPerPart: 1 })
      await answer(planId, true)
      const after = await answer(planId, true) // reload during the transition: answers
      expect(after.results).toHaveLength(2)
      expect(after.results[1].slotId).toBe('p1s0')
      // p1 finished too: straight into the next transition
      expect(after).toMatchObject({ flowState: 'part_transition', currentPartIndex: 2 })
      expect(after.breaks).toEqual([])
    })

    it('a try in part_transition with breaks on is accepted and the break is recorded skipped', async () => {
      const planId = await insertPlan(playerId, { breaks: true, slotsPerPart: 2 })
      await answer(planId, true)
      const transition = await answer(planId, true)
      expect(transition.flowState).toBe('part_transition')

      const after = await answer(planId, true)
      expect(after).toMatchObject({ flowState: 'practicing', currentPartIndex: 1 })
      expect(after.flowVersion).toBe(transition.flowVersion + 1)
      expect(after.breaks).toHaveLength(1)
      expect(after.breaks[0]).toMatchObject({
        breakIndex: 0,
        afterPartIndex: 0,
        reason: 'skipped',
        durationMs: 0,
      })
      // Legacy break columns as before Phase 3a
      expect(after.breakReason).toBeNull()
      expect(after.breakStartedAt).toBeNull()
    })

    it.each(['break_pending', 'break_active', 'break_results'] as const)(
      'a try during %s is refused (409)',
      async (flowState) => {
        const planId = await insertPlan(playerId, { breaks: true, values: { flowState } })
        const plan = await row(planId)
        await expect(recordSlotResult(planId, submissionFor(plan, true))).rejects.toBeInstanceOf(
          InvalidFlowTransitionError
        )
        expect((await row(planId)).results).toHaveLength(0)
      }
    )

    it('PART_TRANSITION_COMPLETED ignores the client shouldRunBreak', async () => {
      const on = await insertPlan(playerId, {
        breaks: true,
        values: { flowState: 'part_transition', currentPartIndex: 1 },
      })
      expect(
        (
          await applySessionFlowEvent(on, {
            type: 'PART_TRANSITION_COMPLETED',
            shouldRunBreak: false,
          })
        ).flowState
      ).toBe('break_pending')

      const off = await insertPlan(playerId, {
        breaks: false,
        values: { flowState: 'part_transition', currentPartIndex: 1 },
      })
      expect(
        (
          await applySessionFlowEvent(off, {
            type: 'PART_TRANSITION_COMPLETED',
            shouldRunBreak: true,
          })
        ).flowState
      ).toBe('practicing')
    })

    it('breaks are a list: started, finished, kept after the results are acked', async () => {
      const planId = await insertPlan(playerId, { breaks: true, slotsPerPart: 1 })
      for (let part = 0; part < 2; part++) {
        await answer(planId, true)
        await applySessionFlowEvent(planId, { type: 'PART_TRANSITION_COMPLETED' })
        await applySessionFlowEvent(planId, { type: 'BREAK_STARTED', game: `game-${part}` })
        await applySessionFlowEvent(planId, {
          type: 'BREAK_FINISHED',
          reason: 'gameFinished',
          results: { score: part } as never,
        })
        await applySessionFlowEvent(planId, { type: 'BREAK_RESULTS_ACKED' })
      }
      const after = await row(planId)
      expect(after.breakSelectedGame).toBeNull() // legacy columns cleared, as before
      expect(after.breaks.map((b) => [b.afterPartIndex, b.game, b.reason])).toEqual([
        [0, 'game-0', 'gameFinished'],
        [1, 'game-1', 'gameFinished'],
      ])
      expect(after.breaks.every((b) => b.endedAt !== undefined)).toBe(true)
    })

    it('the flow-events path refuses server-only events', async () => {
      const planId = await insertPlan(playerId)
      await expect(
        applySessionFlowEvent(planId, { type: 'SESSION_ABANDONED' } as never)
      ).rejects.toBeInstanceOf(InvalidFlowTransitionError)
      expect((await row(planId)).status).toBe('in_progress')
    })

    it('every write bumps rowVersion; flowVersion moves only with the flow', async () => {
      const planId = await insertPlan(playerId, { slotsPerPart: 3 })
      const a = await answer(planId, true)
      const b = await answer(planId, false)
      expect([a.rowVersion, b.rowVersion]).toEqual([1, 2])
      expect([a.flowVersion, b.flowVersion]).toEqual([0, 0])
    })

    it('part_states mirrors the legacy cursor it is written beside', async () => {
      const planId = await insertPlan(playerId, { slotsPerPart: 3 })
      await answer(planId, false)
      await answer(planId, true)
      const after = await answer(planId, true) // -> retry round 1 [s0]
      expect(after.partStates['0']).toEqual(arithmeticStateOf(after, 0))
      expect(
        (after.partStates['0'] as { retry: { currentEpoch: number } }).retry.currentEpoch
      ).toBe(1)
    })
  })

  describe('legacy rows and rollback', () => {
    it('an in-flight legacy row (empty part_states) resumes from the legacy columns', async () => {
      // Mid retry round, written before Phase 3a: no part_states, row_version 0
      const parts = fixtureParts(3)
      const s1 = parts[0].slots[1]
      const planId = await insertPlan(playerId, {
        slotsPerPart: 3,
        values: {
          currentSlotIndex: 3,
          retryState: {
            0: {
              currentEpoch: 1,
              pendingRetries: [],
              currentEpochItems: [
                {
                  slotId: s1.slotId,
                  originalSlotIndex: 1,
                  problem: s1.problem!,
                  epochNumber: 1,
                  originalPurpose: 'focus',
                },
              ],
              currentRetryIndex: 0,
            },
          },
        },
      })
      const legacy = await row(planId)
      expect(legacy.partStates).toEqual({})
      expect(legacy.rowVersion).toBe(0)
      expect(getCurrentProblemInfo(legacy)).toMatchObject({ slotId: 'p0s1', epochNumber: 1 })

      const after = await answer(planId, true)
      expect(after.results[0]).toMatchObject({ slotId: 'p0s1', kind: 'retry', round: 1 })
      expect(after).toMatchObject({ currentPartIndex: 1, flowState: 'part_transition' })
      expect(after.rowVersion).toBe(1)
    })

    it('legacy break columns normalize to one break; game results to one each, in order', () => {
      const base = {
        breakStartedAt: FIXED,
        breakReason: 'gameFinished' as const,
        breakSelectedGame: 'memory-quiz',
        breakResults: null,
        flowState: 'break_results' as const,
        currentPartIndex: 2,
      }
      expect(legacyBreaksOf(base)).toEqual([
        {
          breakIndex: 0,
          afterPartIndex: 1,
          startedAt: FIXED.toISOString(),
          reason: 'gameFinished',
          game: 'memory-quiz',
          results: null,
          estimated: true,
        },
      ])
      expect(
        legacyBreaksOf(base, [
          { id: 'g2', gameName: 'b', playedAt: new Date(FIXED.getTime() + 2000), durationMs: 9 },
          { id: 'g1', gameName: 'a', playedAt: new Date(FIXED.getTime() + 1000) },
        ]).map((b) => [b.breakIndex, b.gameResultId, b.game])
      ).toEqual([
        [0, 'g1', 'a'],
        [1, 'g2', 'b'],
      ])
      expect(
        legacyBreaksOf({
          ...base,
          breakStartedAt: null,
          breakReason: null,
          breakSelectedGame: null,
        })
      ).toEqual([])
    })

    it('rollback: new writes, then an old image writes legacy columns only, then the new code resumes', async () => {
      const planId = await insertPlan(playerId, { slotsPerPart: 3 })
      await answer(planId, false) // s0 wrong (queued)
      const written = await answer(planId, true) // s1 right
      expect(written.partStates['0']).toEqual(arithmeticStateOf(written, 0))

      // The old image answers s2 (right): it appends the row and moves the
      // legacy cursor (here into retry round 1 [s0]); it neither checks nor
      // bumps row_version and never touches part_states.
      const info = getCurrentProblemInfo(written)!
      const oldState = arithmeticKind.applyTry(
        written.parts[0].slots,
        arithmeticStateOf(written, 0),
        [],
        { itemId: info.slotId, kind: 'first', round: 0, practiceOnly: false, isCorrect: true }
      )
      await writeAsOldImage(planId, {
        results: [
          ...written.results,
          {
            ...submissionFor(written, true, undefined),
            tryId: undefined,
            partNumber: 1,
            timestamp: new Date(),
            epochNumber: 0,
            masteryWeight: 1,
          } as SlotResult,
        ],
        currentSlotIndex: oldState.slotIndex,
        retryState: { 0: oldState.retry! },
      })
      const rolledBack = await row(planId)
      expect(rolledBack.rowVersion).toBe(written.rowVersion) // the old image did not bump it
      expect(rolledBack.partStates['0']).not.toEqual(arithmeticStateOf(rolledBack, 0)) // stale

      // Roll forward: the new code reads the legacy columns, not part_states
      expect(partStateOf(rolledBack, 0)).toEqual(arithmeticStateOf(rolledBack, 0))
      expect(getCurrentProblemInfo(rolledBack)).toMatchObject({ slotId: 'p0s0', epochNumber: 1 })
      const resumed = await answer(planId, true)
      expect(resumed.results.at(-1)).toMatchObject({ slotId: 'p0s0', kind: 'retry', round: 1 })
      expect(resumed).toMatchObject({ currentPartIndex: 1, flowState: 'part_transition' })
      expect(resumed.rowVersion).toBe(rolledBack.rowVersion + 1)
      // part_states is rewritten from what was read
      expect(resumed.partStates['0']).toMatchObject({ slotIndex: 3 })
    })
  })
})
