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

import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import * as schema from '@/db/schema'
import { currentItemOf, legacyBreaksOf, partStateOf } from '@/db/schema/session-plan-normalize'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SlotResult,
  SlotResultSubmission,
} from '@/db/schema/session-plans'
import { arithmeticKind } from '@/lib/curriculum/parts/arithmetic/server'
import {
  arithmeticPartStateOf,
  getCurrentProblemInfo,
} from '@/lib/curriculum/parts/arithmetic/state'
import { ROW_CAS_ATTEMPTS, WriteContentionError } from '@/lib/curriculum/row-cas'
import { InvalidFlowTransitionError } from '@/lib/curriculum/session-flow'
import {
  abandonSessionPlan,
  applySessionFlowEvent,
  completeSessionPlanEarly,
  getSessionPlan,
  MalformedDoOverError,
  NotPracticingError,
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

const LEGACY_COLUMNS = [
  'current_slot_index',
  'retry_state',
  'break_started_at',
  'break_reason',
  'break_selected_game',
  'break_results',
] as const

/**
 * The six legacy columns as stored. Out of the drizzle schema since 6b-1
 * (nothing reads or writes them, §10 P6b1-1); they stay in the table until
 * 6b-2, so a test reaches them through SQL.
 */
function legacyColumnsOf(planId: string): Record<(typeof LEGACY_COLUMNS)[number], unknown> {
  return getCurrentEphemeralDb().get(
    sql.raw(`SELECT ${LEGACY_COLUMNS.join(', ')} FROM session_plans WHERE id = '${planId}'`)
  )
}

/** Write legacy columns (SQL values: JSON as text), as an older image would. */
async function writeLegacyColumns(
  planId: string,
  columns: Partial<Record<(typeof LEGACY_COLUMNS)[number], string | number | null>>
) {
  const set = Object.entries(columns).map(([c, v]) => sql`${sql.raw(c)} = ${v}`)
  await getCurrentEphemeralDb().run(
    sql`UPDATE session_plans SET ${sql.join(set, sql`, `)} WHERE id = ${planId}`
  )
}

const DEFAULT_LEGACY_COLUMNS = {
  current_slot_index: 0,
  retry_state: null,
  break_started_at: null,
  break_reason: null,
  break_selected_game: null,
  break_results: null,
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
      const redeemed = arithmeticPartStateOf(after, 0).retry?.redeemedSlots ?? []
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

    // Phase 3c: the client renders the transition from flowState, so a try that
    // reaches part_transition or a break is stale: 409 not_practicing with the
    // plan, nothing recorded, no version moved (§1.1)
    it.each([false, true])(
      'a try in part_transition is refused with the plan (breaks %s)',
      async (breaks) => {
        const planId = await insertPlan(playerId, { breaks, slotsPerPart: 1 })
        const transition = await answer(planId, true)
        expect(transition.flowState).toBe('part_transition')

        const refused = await recordSlotResult(planId, submissionFor(transition, true)).catch(
          (e: unknown) => e
        )
        expect(refused).toBeInstanceOf(NotPracticingError)
        const { plan } = refused as NotPracticingError
        expect(plan).toMatchObject({
          id: planId,
          flowState: 'part_transition',
          currentPartIndex: 1,
          flowVersion: transition.flowVersion,
          rowVersion: transition.rowVersion,
        })
        const after = await row(planId)
        expect(after.results).toHaveLength(1)
        expect(after.rowVersion).toBe(transition.rowVersion)
        expect(after.breaks).toEqual([])
        expect(recordSkillAttemptsWithHelp).toHaveBeenCalledTimes(1)

        // Once the client completes the transition, the same try is taken
        await applySessionFlowEvent(planId, { type: 'PART_TRANSITION_COMPLETED' })
        if (breaks) {
          await applySessionFlowEvent(planId, { type: 'BREAK_FINISHED', reason: 'skipped' })
        }
        const taken = await recordSlotResult(planId, submissionFor(await row(planId), true))
        expect(taken.results).toHaveLength(2)
        expect(taken.results[1].slotId).toBe('p1s0')
      }
    )

    it('a resend of the part-ending try in part_transition is still a no-op', async () => {
      const planId = await insertPlan(playerId, { breaks: false, slotsPerPart: 1 })
      const plan = await row(planId)
      const submission = submissionFor(plan, true)
      const transition = await recordSlotResult(planId, submission)
      const resent = await recordSlotResult(planId, submission)
      expect(resent.rowVersion).toBe(transition.rowVersion)
      expect(resent.results).toHaveLength(1)
    })

    it('a do-over in part_transition is still recorded aside', async () => {
      const planId = await insertPlan(playerId, { breaks: false, slotsPerPart: 1 })
      const transition = await answer(planId, true)
      expect(transition.flowState).toBe('part_transition')
      const after = await recordRedoResult(planId, ...doOver(transition, 0, 0, true))
      expect(after.results.at(-1)).toMatchObject({ kind: 'do_over', practiceOnly: true })
      expect(after).toMatchObject({ flowState: 'part_transition', currentPartIndex: 1 })
    })

    it.each(['break_pending', 'break_active', 'break_results'] as const)(
      'a try during %s is refused with the plan (409 not_practicing)',
      async (flowState) => {
        const planId = await insertPlan(playerId, { breaks: true, values: { flowState } })
        const plan = await row(planId)
        const refused = await recordSlotResult(planId, submissionFor(plan, true)).catch(
          (e: unknown) => e
        )
        expect(refused).toBeInstanceOf(NotPracticingError)
        expect((refused as NotPracticingError).plan.flowState).toBe(flowState)
        expect((await row(planId)).results).toHaveLength(0)
      }
    )

    it('a try for another item outside practicing is not_practicing too, not a mismatch', async () => {
      const planId = await insertPlan(playerId, {
        breaks: true,
        values: { flowState: 'break_active' },
      })
      const plan = await row(planId)
      const other = {
        ...submissionFor(plan, true),
        slotIndex: 1,
        problem: plan.parts[0].slots[1].problem!,
      }
      await expect(recordSlotResult(planId, other)).rejects.toBeInstanceOf(NotPracticingError)
    })

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
      // 6b-1: the legacy break columns are never written (§10 P6b1-1)
      expect(legacyColumnsOf(planId)).toEqual(DEFAULT_LEGACY_COLUMNS)
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

    it('part_states holds the cursor and the retry round; the legacy columns are not written (6b-1)', async () => {
      const planId = await insertPlan(playerId, { slotsPerPart: 3 })
      await answer(planId, false)
      await answer(planId, true)
      const after = await answer(planId, true) // -> retry round 1 [s0]
      expect(after.partStates['0']).toMatchObject({ slotIndex: 3, retry: { currentEpoch: 1 } })
      // Until 6b-1 current_slot_index (3) and retry_state were written beside it
      expect(legacyColumnsOf(planId)).toEqual(DEFAULT_LEGACY_COLUMNS)
    })
  })

  describe('legacy rows and rollback', () => {
    // Until 6b-1 a row with no entry (written before Phase 3a) resumed from
    // the legacy columns. Migration 0148 closed every such row still in
    // progress (§10 P6b-7), and 6b-1 stopped reading them (§10 P6b1-3): a
    // part without an entry reads its start (or, before the cursor, its end).
    it('a row with legacy columns but no part_states entry reads the part from its start (6b-1)', async () => {
      const parts = fixtureParts(3)
      const s1 = parts[0].slots[1]
      const planId = await insertPlan(playerId, { slotsPerPart: 3 })
      await writeLegacyColumns(planId, {
        current_slot_index: 3,
        retry_state: JSON.stringify({
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
        }),
      })
      const legacy = await row(planId)
      expect(legacy.partStates).toEqual({})
      expect(getCurrentProblemInfo(legacy)).toMatchObject({ slotId: 'p0s0', epochNumber: 0 })

      const after = await answer(planId, true)
      expect(after.results[0]).toMatchObject({ slotId: 'p0s0', kind: 'first', round: 0 })
      expect(after.partStates['0']).toEqual({ slotIndex: 1 })
      expect(legacyColumnsOf(planId)).toMatchObject({ current_slot_index: 3 }) // not written
    })

    it('game results normalize to one break each, in order; the legacy break columns no longer (6b-0, §10 P6b-4)', () => {
      expect(
        legacyBreaksOf([
          { id: 'g2', gameName: 'b', playedAt: new Date(FIXED.getTime() + 2000), durationMs: 9 },
          { id: 'g1', gameName: 'a', playedAt: new Date(FIXED.getTime() + 1000) },
        ]).map((b) => [b.breakIndex, b.gameResultId, b.game])
      ).toEqual([
        [0, 'g1', 'a'],
        [1, 'g2', 'b'],
      ])
      // Until 6b-0 a row's legacy break columns (breakStartedAt, breakReason,
      // breakSelectedGame) normalized to one estimated break here
      expect(legacyBreaksOf([])).toEqual([])
    })

    // Phase 3a's rollback test, restated for Phase 5a (§10 P5a-6, P5a-8) and
    // again for 6b-0 (§10 P6b-2): an image from before 3a advances the legacy
    // columns alone after 3a code wrote both. Until 6b-0 the legacy cursor won
    // (P5a-8); now the entry does, everywhere, so the server and the client
    // still agree and nothing wedges. No pre-3a image can run beside 6b-0
    // (rollback lands on 6a, which writes both under the CAS).
    it('rollback: new writes, then an old image writes legacy columns only, then 6b-0 resumes at the entry', async () => {
      const planId = await insertPlan(playerId, { slotsPerPart: 3 })
      await answer(planId, false) // s0 wrong (queued)
      const written = await answer(planId, true) // s1 right

      // The old image answers s2 (right): it appends the row and moves the
      // legacy cursor (here into retry round 1 [s0]); it neither checks nor
      // bumps row_version and never touches part_states.
      const info = getCurrentProblemInfo(written)!
      const oldState = arithmeticKind.applyTry(
        written.parts[0].slots,
        arithmeticPartStateOf(written, 0),
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
      })
      await writeLegacyColumns(planId, {
        current_slot_index: oldState.slotIndex,
        retry_state: JSON.stringify({ 0: oldState.retry! }),
      })
      const rolledBack = await row(planId)
      expect(rolledBack.rowVersion).toBe(written.rowVersion) // the old image did not bump it
      expect(rolledBack.partStates['0']).toMatchObject({ slotIndex: 2 }) // stale
      expect(legacyColumnsOf(planId)).toMatchObject({ current_slot_index: 3 })

      // Since 6b-0 the entry is trusted (§10 P6b-2): server and client both
      // read it, so they agree on the item, and nothing warns
      const staleWarnings = () =>
        lostRaces.mock.calls.filter((c) => String(c[0]).startsWith('[partStateOf]'))
      expect(partStateOf(rolledBack, 0)).toEqual(rolledBack.partStates['0'])
      expect(currentItemOf(rolledBack)).toMatchObject({ slotId: 'p0s2', epochNumber: 0 })
      expect(getCurrentProblemInfo(rolledBack)).toMatchObject({ slotId: 'p0s2', epochNumber: 0 })
      expect(staleWarnings()).toHaveLength(0)

      const resumed = await answer(planId, true)
      // Taken: the item answered again (the pre-3a write's progress is not
      // read; no pre-3a image runs beside 6b-0), then retry round 1 as before
      expect(resumed.results).toHaveLength(rolledBack.results.length + 1)
      expect(resumed.results.at(-1)).toMatchObject({ slotId: 'p0s2', kind: 'first', round: 0 })
      expect(resumed.rowVersion).toBe(rolledBack.rowVersion + 1)
      expect(resumed).toMatchObject({ currentPartIndex: 0, flowState: 'practicing' })
      expect(currentItemOf(resumed)).toMatchObject({ slotId: 'p0s0', epochNumber: 1 })
      expect(getCurrentProblemInfo(resumed)).toMatchObject({ slotId: 'p0s0', epochNumber: 1 })
      expect(resumed.partStates['0']).toMatchObject({ slotIndex: 3, retry: { currentEpoch: 1 } })
      // 6b-1 leaves what the old image wrote in the legacy columns
      expect(legacyColumnsOf(planId)).toMatchObject({ current_slot_index: 3 })
    })
  })
})

/** A first or retry try of a named slot, built without reading the plan's cursor. */
function submissionForSlot(
  plan: SessionPlan,
  partIndex: number,
  slotIndex: number,
  epochNumber = 0
): SlotResultSubmission {
  const slot = plan.parts[partIndex].slots[slotIndex]
  return {
    tryId: tid(),
    epochNumber,
    slotId: slot.slotId,
    slotIndex,
    problem: slot.problem!,
    studentAnswer: slot.problem!.answer,
    isCorrect: true,
    responseTimeMs: 3000,
    skillsExercised: slot.problem!.skillsRequired,
    usedOnScreenAbacus: false,
    hadHelp: false,
    incorrectAttempts: 0,
  }
}

describe('Phase 5a: the server reads part_states and breaks', () => {
  let eph: EphemeralDbResult
  let playerId: string

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    ;({ playerId } = await createTestStudent(eph.db, 'phase5a'))
  })
  afterEach(() => {
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  // Phase 5a's rollback test (every row it wrote read the same through Phase
  // 3a's readers) is retired in 6b-1: a rollback from 6b-1 lands on 6b-0,
  // never on 3a–5a, and src/test/session-phase6b1-mixed-pod.test.ts walks
  // the same steps through the real 6b-1 writers against 6b-0's readers
  // (§10 P6b1-6).

  describe('the try expectation reads part_states', () => {
    it('the entry names the item; a stale legacy cursor is neither read nor written (6b-1 shape)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        const planId = await insertPlan(playerId, {
          slotsPerPart: 3,
          values: { partStates: { '0': { slotIndex: 1 } } },
        })
        const plan = await row(planId)
        expect(legacyColumnsOf(planId)).toMatchObject({ current_slot_index: 0 })

        // Until 6b-0 the legacy cursor (s0) won here (§10 P5a-8)
        const legacyItem = await recordSlotResult(planId, submissionForSlot(plan, 0, 0)).catch(
          (e: unknown) => e
        )
        expect(legacyItem).toBeInstanceOf(SlotResultMismatchError)

        const after = await recordSlotResult(planId, submissionForSlot(plan, 0, 1))
        expect(after.results).toHaveLength(1)
        expect(after.results[0]).toMatchObject({ slotId: 'p0s1', slotIndex: 1, kind: 'first' })
        expect(after.partStates['0']).toEqual({ slotIndex: 2 })
        // Until 6b-1 the legacy write followed the entry (2)
        expect(legacyColumnsOf(planId)).toMatchObject({ current_slot_index: 0 })
        expect(warn).not.toHaveBeenCalledWith(
          expect.stringContaining('[partStateOf]'),
          expect.anything()
        )
      } finally {
        warn.mockRestore()
      }
    })

    it('a part without an entry expects its first item, whatever the legacy cursor says (6b-1, §10 P6b1-3)', async () => {
      const planId = await insertPlan(playerId, { slotsPerPart: 3 })
      await writeLegacyColumns(planId, { current_slot_index: 1 })
      const plan = await row(planId)
      expect(plan.partStates).toEqual({})
      // Until 6b-1 the legacy cursor named s1 here
      const refused = await recordSlotResult(planId, submissionForSlot(plan, 0, 1)).catch(
        (e: unknown) => e
      )
      expect(refused).toBeInstanceOf(SlotResultMismatchError)
      const after = await recordSlotResult(planId, submissionForSlot(plan, 0, 0))
      expect(after.results[0]).toMatchObject({ slotId: 'p0s0', kind: 'first' })
    })
  })

  describe('a do-over names its item by itemId (for Phase 5b)', () => {
    async function withWrongS0() {
      const planId = await insertPlan(playerId, { slotsPerPart: 3 })
      await answer(planId, false) // s0 wrong
      await answer(planId, true) // s1 right
      return planId
    }

    it('records the do-over against the slot itemId names', async () => {
      const planId = await withWrongS0()
      const plan = await row(planId)
      const [submission] = doOver(plan, 0, 0, true)
      // itemId alone, as a client could send once the indices go (Phase 6)
      const after = await recordRedoResult(planId, submission, {
        itemId: 'p0s0',
      } as RedoContext)
      expect(after.results.at(-1)).toMatchObject({
        kind: 'do_over',
        slotId: 'p0s0',
        slotIndex: 0,
        partIndex: 0,
        practiceOnly: false,
        round: 1,
      })
    })

    it('accepts indices sent beside it when they name the same slot', async () => {
      const planId = await withWrongS0()
      const plan = await row(planId)
      const [submission, context] = doOver(plan, 0, 0, true)
      const after = await recordRedoResult(planId, submission, { ...context, itemId: 'p0s0' })
      expect(after.results.at(-1)).toMatchObject({ kind: 'do_over', slotId: 'p0s0' })
    })

    it('an itemId the indices disagree with is malformed (400); one no slot has is a mismatch (409)', async () => {
      const planId = await withWrongS0()
      const plan = await row(planId)
      const [submission, context] = doOver(plan, 0, 0, true)
      const send = (redoContext: RedoContext) =>
        recordRedoResult(planId, { ...submission, tryId: tid() }, redoContext)
          .then(() => null)
          .catch((e: unknown) => e)
      expect(await send({ ...context, itemId: 'p0s1' })).toBeInstanceOf(MalformedDoOverError)
      expect(await send({ ...context, itemId: 'nope' })).toBeInstanceOf(SlotResultMismatchError)
      expect((await row(planId)).results).toHaveLength(2)
    })
  })
})
