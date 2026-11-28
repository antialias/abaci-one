/**
 * @vitest-environment node
 *
 * Retry / do-over attribution: does the server record each try against the
 * problem the student was actually shown?
 *
 * The client picks the problem to show with getCurrentProblemInfo (which skips
 * retry items redeemed by a manual do-over); the server attributes the answer
 * with its own position (the part state's retry.currentEpochItems[currentRetryIndex]).
 * These tests drive both sides the way ActiveSession does and compare.
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  chooseRedoReturnTarget,
  type TransitionTarget,
} from '@/components/practice/redoReturnTarget'
import * as schema from '@/db/schema'
import { DEFAULT_GAME_BREAK_SETTINGS } from '@/db/schema/session-plan-helpers'
import { legacyTryId } from '@/db/schema/session-plan-normalize'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { computeBktFromHistory } from '@/lib/curriculum/bkt/compute-bkt'
import { batchGetRecentBktEvidence } from '@/lib/curriculum/bkt/evidence-query'
import { deriveLinearGateState } from '@/lib/curriculum/linear-gate'
import {
  arithmeticPartStateOf,
  getCurrentProblemInfo,
} from '@/lib/curriculum/parts/arithmetic/state'
import { getAllSkillMastery, setPracticingSkills } from '@/lib/curriculum/progress-manager'
import {
  approveSessionPlan,
  generateSessionPlan,
  getRecentSessionResults,
  getSessionPlan,
  type ProblemResultWithContext,
  recordRedoResult,
  recordSlotResult,
  SlotResultMismatchError,
  startSessionPlan,
} from '@/lib/curriculum/session-planner'
import { applySlotResultReview } from '@/lib/curriculum/session-review'
import { assessAllSkillsReadiness } from '@/lib/curriculum/skill-readiness'
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

const SKILLS = ['basic.directAddition', 'basic.heavenBead']

async function newPlan(
  playerId: string,
  problemsPerPart: number,
  { twoParts = false, breaks = false } = {}
): Promise<SessionPlan> {
  const plan = await generateSessionPlan({
    playerId,
    durationMinutes: 5,
    enabledParts: { abacus: true, visualization: twoParts, linear: false },
    overrideProblemsPerPart: problemsPerPart,
    gameBreakSettings: { ...DEFAULT_GAME_BREAK_SETTINGS, enabled: breaks },
  })
  await approveSessionPlan(plan.id)
  return startSessionPlan(plan.id)
}

/**
 * The retry round and cursor as the row holds them: `part_states` since 6b-1
 * stopped writing `retry_state` and `current_slot_index` (§10 P6b1-1).
 */
const retryOf = (plan: SessionPlan, partIndex = 0) => arithmeticPartStateOf(plan, partIndex).retry
const cursorOf = (plan: SessionPlan) => arithmeticPartStateOf(plan, plan.currentPartIndex).slotIndex

/** The four legacy try fields 6b-1 no longer writes on a new try (§10 P6b1-4). */
const LEGACY_TRY_FIELDS = ['isRetry', 'epochNumber', 'isManualRedo', 'originalSlotIndex'] as const
function expectNoLegacyTryFields(row: object) {
  for (const name of LEGACY_TRY_FIELDS) expect(row).not.toHaveProperty(name)
}

/** A client-shaped try id (UUID) */
const tid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** Answer whatever the client would show right now, the way ActiveSession submits it. */
async function answerShown(
  plan: SessionPlan,
  correct: boolean,
  tryId?: string
): Promise<SessionPlan> {
  const info = getCurrentProblemInfo(plan)
  if (!info) throw new Error('client shows no problem')
  return recordSlotResult(plan.id, {
    tryId,
    slotId: info.slotId,
    slotIndex: info.originalSlotIndex,
    problem: info.problem,
    studentAnswer: correct ? info.problem.answer : info.problem.answer + 1,
    isCorrect: correct,
    responseTimeMs: 3000,
    skillsExercised: info.problem.skillsRequired,
    usedOnScreenAbacus: false,
    hadHelp: false,
    incorrectAttempts: 0,
  })
}

/** A manual do-over of slot `slotIndex` in part 0, the way ActiveSession submits it. */
async function redo(
  plan: SessionPlan,
  slotIndex: number,
  correct: boolean,
  { tryId, originalWasCorrect = false }: { tryId?: string; originalWasCorrect?: boolean } = {}
): Promise<SessionPlan> {
  const slot = plan.parts[0].slots[slotIndex]
  return recordRedoResult(
    plan.id,
    {
      tryId,
      slotId: slot.slotId,
      slotIndex,
      problem: slot.problem!,
      studentAnswer: correct ? slot.problem!.answer : slot.problem!.answer + 1,
      isCorrect: correct,
      responseTimeMs: 3000,
      skillsExercised: slot.problem!.skillsRequired,
      usedOnScreenAbacus: false,
      hadHelp: false,
      incorrectAttempts: 0,
    },
    { originalPartIndex: 0, originalSlotIndex: slotIndex, originalWasCorrect }
  )
}

/** A correct manual do-over of slot `slotIndex` in part 0 whose original was wrong. */
const redoCorrect = (plan: SessionPlan, slotIndex: number) => redo(plan, slotIndex, true)

describe('retry and do-over attribution', () => {
  let eph: EphemeralDbResult
  let playerId: string

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    ;({ playerId } = await createTestStudent(eph.db, 'retry-attr'))
    await setPracticingSkills(playerId, SKILLS)
  })
  afterEach(() => {
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  it('stamps every generated part with its kind (Phase 2)', async () => {
    const plan = await newPlan(playerId, 2, { twoParts: true })
    expect(plan.parts.map((p) => p.kind)).toEqual(['arithmetic', 'arithmetic'])
  })

  it('records the answer against the problem shown after a do-over redeems the current retry', async () => {
    let plan = await newPlan(playerId, 3)
    plan = await answerShown(plan, false) // slot 0 wrong
    plan = await answerShown(plan, false) // slot 1 wrong
    plan = await answerShown(plan, true) // slot 2 right -> retry round 1 = [slot 0, slot 1]
    expect(retryOf(plan)?.currentEpoch).toBe(1)

    plan = await redoCorrect(plan, 0) // kid taps slot 0's dot and gets it right
    const shown = getCurrentProblemInfo(plan)!
    expect(shown.slotId).toBe(plan.parts[0].slots[1].slotId) // client now shows slot 1

    plan = await answerShown(plan, true)
    const last = plan.results.at(-1)!
    expect(last.slotId).toBe(plan.parts[0].slots[1].slotId)
    expect(last.slotIndex).toBe(1) // the try belongs to slot 1
    expect(plan.status).toBe('completed') // nothing left to retry
  })

  it('does not strand the session when every retry is redeemed by do-overs', async () => {
    let plan = await newPlan(playerId, 3)
    plan = await answerShown(plan, false)
    plan = await answerShown(plan, false)
    plan = await answerShown(plan, true)
    plan = await redoCorrect(plan, 0)
    plan = await redoCorrect(plan, 1)

    const shown = getCurrentProblemInfo(plan)
    // Either the client has something to show, or the session has moved on.
    expect(shown !== null || plan.status === 'completed').toBe(true)
  })

  it('ignores a duplicate submit of the same try', async () => {
    let plan = await newPlan(playerId, 3)
    const info = getCurrentProblemInfo(plan)!
    plan = await answerShown(plan, true)
    // Same request again (double tap / network retry): same slotId as the try just recorded.
    plan = await recordSlotResult(plan.id, {
      slotId: info.slotId,
      slotIndex: info.originalSlotIndex,
      problem: info.problem,
      studentAnswer: info.problem.answer,
      isCorrect: true,
      responseTimeMs: 3000,
      skillsExercised: info.problem.skillsRequired,
      usedOnScreenAbacus: false,
      hadHelp: false,
      incorrectAttempts: 0,
    })
    expect(plan.results).toHaveLength(1)
    expect(cursorOf(plan)).toBe(1)
  })

  it('rejects a try for a problem other than the one shown, and records nothing', async () => {
    let plan = await newPlan(playerId, 3)
    plan = await answerShown(plan, true) // slot 0
    const skipped = plan.parts[0].slots[2] // the server expects slot 1
    await expect(
      recordSlotResult(plan.id, {
        slotId: skipped.slotId,
        slotIndex: 2,
        problem: skipped.problem!,
        studentAnswer: skipped.problem!.answer,
        isCorrect: true,
        responseTimeMs: 3000,
        skillsExercised: skipped.problem!.skillsRequired,
        usedOnScreenAbacus: false,
        hadHelp: false,
        incorrectAttempts: 0,
      })
    ).rejects.toBeInstanceOf(SlotResultMismatchError)

    const shown = getCurrentProblemInfo(plan)!
    expect(shown.slotId).toBe(plan.parts[0].slots[1].slotId)
    plan = await answerShown(plan, true) // the right problem still records
    expect(plan.results).toHaveLength(2)
    expect(plan.results.at(-1)!.slotId).toBe(plan.parts[0].slots[1].slotId)
  })

  it('tells a resubmit of an original try from the retry of the same slot that follows it', async () => {
    let plan = await newPlan(playerId, 3)
    plan = await answerShown(plan, true)
    plan = await answerShown(plan, true)
    const last = plan.parts[0].slots[2]
    const tryOf = (epochNumber: number, correct: boolean) => ({
      slotId: last.slotId,
      slotIndex: 2,
      epochNumber,
      problem: last.problem!,
      studentAnswer: correct ? last.problem!.answer : last.problem!.answer + 1,
      isCorrect: correct,
      responseTimeMs: 3000,
      skillsExercised: last.problem!.skillsRequired,
      usedOnScreenAbacus: false,
      hadHelp: false,
      incorrectAttempts: 0,
    })
    plan = await recordSlotResult(plan.id, tryOf(0, false)) // slot 2 wrong -> retry round = [slot 2]
    expect(getCurrentProblemInfo(plan)!.slotId).toBe(last.slotId) // same slot, epoch 1

    plan = await recordSlotResult(plan.id, tryOf(0, false)) // resubmit of the original try
    expect(plan.results).toHaveLength(3)

    plan = await recordSlotResult(plan.id, tryOf(1, true)) // the retry itself
    expect(plan.results).toHaveLength(4)
    expect(plan.results.at(-1)).toMatchObject({ kind: 'retry', round: 1 })
    expect(plan.status).toBe('completed')
  })

  describe('old clients whose slotId lags the answered problem', () => {
    /** The payload an answer to `slotIndex` produces, named with `slotId`. */
    function tryFor(plan: SessionPlan, slotIndex: number, slotId: string, studentAnswer?: number) {
      const problem = plan.parts[0].slots[slotIndex].problem!
      return {
        slotId,
        slotIndex,
        problem,
        studentAnswer: studentAnswer ?? problem.answer,
        isCorrect: (studentAnswer ?? problem.answer) === problem.answer,
        responseTimeMs: 3000,
        skillsExercised: problem.skillsRequired,
        usedOnScreenAbacus: false,
        hadHelp: false,
        incorrectAttempts: 0,
      }
    }

    it('(a) records a lagging payload against the problem answered, with its own slotId', async () => {
      let plan = await newPlan(playerId, 3)
      plan = await answerShown(plan, true) // slot 0
      const slot0 = plan.parts[0].slots[0].slotId
      const slot1 = plan.parts[0].slots[1].slotId
      // Answer to slot 1, built before slot 0's response arrived: slotId still names slot 0
      plan = await recordSlotResult(plan.id, tryFor(plan, 1, slot0))
      expect(plan.results).toHaveLength(2)
      expect(plan.results[1].slotId).toBe(slot1)
      expect(plan.results[1].slotIndex).toBe(1)
      expect(cursorOf(plan)).toBe(2) // advanced once
      // and the next lagging answer (slot 2, named slot 1) goes to slot 2, not slot 1
      plan = await recordSlotResult(plan.id, tryFor(plan, 2, slot1))
      expect(plan.results[2].slotId).toBe(plan.parts[0].slots[2].slotId)
      expect(plan.results[2].slotIndex).toBe(2)
    })

    it('(b) ignores an exact resubmit, but rejects the same slot with a different answer', async () => {
      let plan = await newPlan(playerId, 3)
      const slot0 = plan.parts[0].slots[0].slotId
      plan = await recordSlotResult(plan.id, tryFor(plan, 0, slot0))
      const after = await recordSlotResult(plan.id, tryFor(plan, 0, slot0))
      expect(after.results).toHaveLength(1)
      expect(cursorOf(after)).toBe(1)

      const wrong = plan.parts[0].slots[0].problem!.answer + 1
      await expect(recordSlotResult(plan.id, tryFor(plan, 0, slot0, wrong))).rejects.toBeInstanceOf(
        SlotResultMismatchError
      )
    })

    it('(c) records the genuine next answer after a resubmit', async () => {
      let plan = await newPlan(playerId, 3)
      const slot0 = plan.parts[0].slots[0].slotId
      plan = await recordSlotResult(plan.id, tryFor(plan, 0, slot0))
      plan = await recordSlotResult(plan.id, tryFor(plan, 0, slot0)) // resubmit: no-op
      plan = await answerShown(plan, true) // slot 1
      expect(plan.results.map((r) => r.slotIndex)).toEqual([0, 1])
      expect(plan.results[1].slotId).toBe(plan.parts[0].slots[1].slotId)
      expect(cursorOf(plan)).toBe(2)
    })
  })

  describe('do-overs that move the session on', () => {
    /** slot 0 and 1 wrong, slot 2 right: retry round 1 = [slot 0, slot 1] */
    async function inRetryRound(options?: { twoParts?: boolean; breaks?: boolean }) {
      let plan = await newPlan(playerId, 3, options)
      plan = await answerShown(plan, false)
      plan = await answerShown(plan, false)
      plan = await answerShown(plan, true)
      expect(retryOf(plan)?.currentEpoch).toBe(1)
      return plan
    }

    it("returns the client to the server's next problem when a do-over redeems the current one", async () => {
      const before = await inRetryRound()
      const shownAtSubmit = getCurrentProblemInfo(before)!
      const targetAtSubmit: TransitionTarget = {
        problem: shownAtSubmit.problem,
        slotIndex: shownAtSubmit.originalSlotIndex,
        partIndex: before.currentPartIndex,
        epochNumber: shownAtSubmit.epochNumber,
      }
      expect(targetAtSubmit.slotIndex).toBe(0) // on screen: slot 0's retry

      const after = await redoCorrect(before, 0) // the kid redoes slot 0 itself
      const target = chooseRedoReturnTarget(before, { recorded: true, plan: after }, targetAtSubmit)
      expect(target).toMatchObject({ slotIndex: 1, partIndex: 0, epochNumber: 1 })

      // The answer the client sends from that target is accepted and attributed to slot 1
      const slot = after.parts[target!.partIndex].slots[target!.slotIndex]
      const plan = await recordSlotResult(after.id, {
        slotId: slot.slotId,
        slotIndex: target!.slotIndex,
        partIndex: target!.partIndex,
        epochNumber: target!.epochNumber,
        problem: target!.problem,
        studentAnswer: target!.problem.answer,
        isCorrect: true,
        responseTimeMs: 3000,
        skillsExercised: target!.problem.skillsRequired,
        usedOnScreenAbacus: false,
        hadHelp: false,
        incorrectAttempts: 0,
      })
      expect(plan.results.at(-1)!.slotId).toBe(slot.slotId)
      expect(plan.status).toBe('completed')
    })

    it('hands off to the session state when the do-over ends the session, fails, or is not recorded', async () => {
      let before = await inRetryRound()
      before = await redoCorrect(before, 0)
      const after = await redoCorrect(before, 1)
      expect(chooseRedoReturnTarget(before, { recorded: true, plan: after }, null)).toBeNull()
      expect(chooseRedoReturnTarget(before, { recorded: true, plan: null }, null)).toBeNull()
      const keep: TransitionTarget = {
        problem: after.parts[0].slots[1].problem!,
        slotIndex: 1,
        partIndex: 0,
        epochNumber: 1,
      }
      expect(chooseRedoReturnTarget(before, { recorded: false }, keep)).toBe(keep)
    })

    it('moves to the next part with a break when a do-over empties the round (breaks on)', async () => {
      const before = await inRetryRound({ twoParts: true, breaks: true })
      let plan = await redoCorrect(before, 0)
      expect(plan.currentPartIndex).toBe(0)
      plan = await redoCorrect(plan, 1)
      expect(plan.currentPartIndex).toBe(1)
      expect(cursorOf(plan)).toBe(0)
      expect(plan.flowState).toBe('part_transition')
      expect(plan.flowVersion).toBe((before.flowVersion ?? 0) + 1)
      expect(plan.status).toBe('in_progress')
    })

    it('completes the session when a do-over empties the last part', async () => {
      const before = await inRetryRound()
      vi.mocked(revokeSharesForSession).mockClear()
      let plan = await redoCorrect(before, 0)
      plan = await redoCorrect(plan, 1)
      expect(plan.status).toBe('completed')
      expect(plan.flowState).toBe('completed')
      expect(plan.completedAt).toBeTruthy()
      expect(revokeSharesForSession).toHaveBeenCalledWith(plan.id)
    })

    it('starts retry round 2 when a do-over redeems the rest of round 1 and a retry is pending', async () => {
      let plan = await inRetryRound()
      plan = await answerShown(plan, false) // slot 0 wrong again -> pending round 2 = [slot 0]
      plan = await redoCorrect(plan, 1) // redeem slot 1, the rest of round 1
      expect(retryOf(plan)?.currentEpoch).toBe(2)
      expect(plan.status).toBe('in_progress')
      const shown = getCurrentProblemInfo(plan)!
      expect(shown).toMatchObject({ originalSlotIndex: 0, epochNumber: 2, isRetry: true })
    })

    it('does not move the session while a break or transition owns the next step', async () => {
      let plan = await inRetryRound()
      plan = await redoCorrect(plan, 0)
      await eph.db
        .update(schema.sessionPlans)
        .set({ flowState: 'break_active' })
        .where(eq(schema.sessionPlans.id, plan.id))
      plan = await redoCorrect(plan, 1)
      expect(plan.currentPartIndex).toBe(0)
      expect(plan.status).toBe('in_progress')
    })
  })

  it('stops re-queuing after MAX_RETRY_EPOCHS and ends the part', async () => {
    let plan = await newPlan(playerId, 3)
    plan = await answerShown(plan, false) // slot 0
    plan = await answerShown(plan, true)
    plan = await answerShown(plan, true) // round 1 = [slot 0]
    plan = await answerShown(plan, false) // round 1 wrong -> round 2 = [slot 0]
    expect(retryOf(plan)?.currentEpoch).toBe(2)
    plan = await answerShown(plan, false) // round 2 wrong: answer revealed, not re-queued
    expect(plan.results.map((r) => r.round)).toEqual([0, 0, 0, 1, 2])
    expect(retryOf(plan)?.pendingRetries).toEqual([])
    expect(plan.status).toBe('completed')
  })

  it('rejects an answer whose partIndex names a different part', async () => {
    const plan = await newPlan(playerId, 3)
    const info = getCurrentProblemInfo(plan)!
    await expect(
      recordSlotResult(plan.id, {
        slotId: info.slotId,
        slotIndex: info.originalSlotIndex,
        partIndex: 1,
        problem: info.problem,
        studentAnswer: info.problem.answer,
        isCorrect: true,
        responseTimeMs: 3000,
        skillsExercised: info.problem.skillsRequired,
        usedOnScreenAbacus: false,
        hadHelp: false,
        incorrectAttempts: 0,
      })
    ).rejects.toBeInstanceOf(SlotResultMismatchError)
  })

  describe('the try record (Phase 1)', () => {
    it('stamps kind, round, practiceOnly, partIndex, weight and a tryId on first tries and retries', async () => {
      let plan = await newPlan(playerId, 2)
      plan = await answerShown(plan, false, tid(1)) // slot 0 wrong
      plan = await answerShown(plan, true) // slot 1, old client: no tryId
      plan = await answerShown(plan, true) // retry of slot 0
      const [a, b, c] = plan.results
      expect(a).toMatchObject({ tryId: tid(1), kind: 'first', round: 0, practiceOnly: false })
      // Phase 1w: a wrong first try weighs 1, like a right one
      expect(a).toMatchObject({ partIndex: 0, masteryWeight: 1, slotIndex: 0 })
      expect(b.tryId).toMatch(/^[0-9a-f-]{36}$/) // minted server-side
      expect(b).toMatchObject({ kind: 'first', round: 0, masteryWeight: 1 })
      expect(c).toMatchObject({ kind: 'retry', round: 1, masteryWeight: 0.5, slotIndex: 0 })
      // 6b-1: kind/round/slotIndex carry what the legacy fields did; they are not written
      for (const row of [a, b, c]) expectNoLegacyTryFields(row)
    })

    it('records a tryId once: a resend is a no-op, also for a do-over', async () => {
      let plan = await newPlan(playerId, 3)
      plan = await answerShown(plan, false, tid(2))
      const again = await recordSlotResult(plan.id, {
        ...plan.results[0],
        studentAnswer: plan.results[0].studentAnswer,
        tryId: tid(2),
      })
      expect(again.results).toHaveLength(1)
      expect(cursorOf(again)).toBe(1)

      plan = await redo(plan, 0, true, { tryId: tid(3) })
      expect(plan.results).toHaveLength(2)
      const replayed = await redo(plan, 0, true, { tryId: tid(3) })
      expect(replayed.results).toHaveLength(2)
    })

    it('rejects a different try for a problem other than the current one even with a fresh tryId', async () => {
      let plan = await newPlan(playerId, 3)
      plan = await answerShown(plan, true, tid(2))
      const info = plan.parts[0].slots[0]
      // Same content as the try just recorded, but a new tryId: not a resend
      await expect(
        recordSlotResult(plan.id, {
          tryId: tid(4),
          slotId: info.slotId,
          slotIndex: 0,
          problem: info.problem!,
          studentAnswer: info.problem!.answer,
          isCorrect: true,
          responseTimeMs: 3000,
          skillsExercised: info.problem!.skillsRequired,
          usedOnScreenAbacus: false,
          hadHelp: false,
          incorrectAttempts: 0,
        })
      ).rejects.toBeInstanceOf(SlotResultMismatchError)
    })

    it('treats a tryId not shaped like the client’s (legacy namespace, overlong, not a UUID) as absent', async () => {
      let plan = await newPlan(playerId, 4)
      plan = await answerShown(plan, false)
      // A forged positional id must not become this row's id: it would make
      // tries/legacy:<planId>:0 address the wrong row
      const forged = legacyTryId(plan.id, 0)
      plan = await answerShown(plan, true, forged)
      plan = await answerShown(plan, true, 'x'.repeat(5000))
      plan = await answerShown(plan, true, 'not-a-uuid')
      const ids = plan.results.map((r) => r.tryId)
      expect(ids).toHaveLength(4)
      for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4/)
      expect(new Set(ids).size).toBe(4)
      // The exact-match fallback still makes a resend with a bad id a no-op
      const last = plan.results[3]
      const again = await recordSlotResult(plan.id, { ...last, tryId: 'legacy:resend' })
      expect(again.results).toHaveLength(4)
    })

    it('ignores client-sent stamps (kind, round, practiceOnly, masteryWeight, isRetry)', async () => {
      const plan = await newPlan(playerId, 3)
      const info = getCurrentProblemInfo(plan)!
      const after = await recordSlotResult(plan.id, {
        slotId: info.slotId,
        slotIndex: 0,
        problem: info.problem,
        studentAnswer: info.problem.answer,
        isCorrect: true,
        responseTimeMs: 3000,
        skillsExercised: info.problem.skillsRequired,
        usedOnScreenAbacus: false,
        hadHelp: false,
        incorrectAttempts: 0,
        ...({
          kind: 'do_over',
          round: 7,
          practiceOnly: true,
          masteryWeight: 9,
          isRetry: true,
        } as object),
      })
      expect(after.results[0]).toMatchObject({
        kind: 'first',
        round: 0,
        practiceOnly: false,
        masteryWeight: 1,
      })
      // the client's isRetry is not stored either (6b-1)
      expectNoLegacyTryFields(after.results[0])
    })

    it('a correct do-over of a wrong problem weighs 1/2^round (round 1: 0.5) and redeems it', async () => {
      let plan = await newPlan(playerId, 3)
      plan = await answerShown(plan, true)
      plan = await answerShown(plan, false) // slot 1 wrong -> pending retry
      // The client's originalWasCorrect is not trusted: say "correct", server knows better
      plan = await redo(plan, 1, true, { originalWasCorrect: true })
      const r = plan.results.at(-1)!
      expect(r).toMatchObject({
        kind: 'do_over',
        round: 1,
        practiceOnly: false,
        masteryWeight: 0.5,
        slotId: plan.parts[0].slots[1].slotId,
        slotIndex: 1,
      })
      // 6b-1: a do-over writes none of the legacy fields; the normalizer reads
      // kind 'do_over' where isManualRedo stood (§10 P6b1-4)
      expectNoLegacyTryFields(r)
      expect(retryOf(plan)?.pendingRetries ?? []).toHaveLength(0)
      expect(retryOf(plan)?.redeemedSlots).toContain(1)
      expect(cursorOf(plan)).toBe(2)
    })

    it('counts round over earlier counted tries only: a wrong do-over after a wrong retry is round 2', async () => {
      let plan = await newPlan(playerId, 2)
      plan = await answerShown(plan, false) // slot 0 wrong
      plan = await answerShown(plan, true) // slot 1 -> round 1 = [slot 0]
      plan = await answerShown(plan, false) // retry 1 wrong -> round 2 = [slot 0]
      plan = await redo(plan, 0, false)
      // Phase 1w: a counted do-over weighs 1/2^round, right or wrong
      expect(plan.results.at(-1)).toMatchObject({ kind: 'do_over', round: 2, masteryWeight: 0.25 })
      plan = await redo(plan, 0, true) // round 3 now: three counted tries before it
      expect(plan.results.at(-1)).toMatchObject({ round: 3, masteryWeight: 0.125 })
      expect(plan.results.at(-1)!.practiceOnly).toBe(false)
    })

    it('records a do-over of a correct problem as practice-only, with no effect on position, health, skills or mastery', async () => {
      let plan = await newPlan(playerId, 4)
      plan = await answerShown(plan, true)
      plan = await answerShown(plan, true)
      plan = await answerShown(plan, true) // slot 3 is up
      const healthBefore = plan.sessionHealth
      const skillsBefore = await getAllSkillMastery(playerId)

      plan = await redo(plan, 0, true, { originalWasCorrect: false }) // client flag ignored
      plan = await redo(plan, 1, false)
      plan = await redo(plan, 1, true) // still practice-only: latest counted try is correct
      const doOvers = plan.results.slice(3)
      expect(doOvers).toHaveLength(3)
      for (const r of doOvers) {
        expect(r).toMatchObject({ kind: 'do_over', round: 1, practiceOnly: true, masteryWeight: 0 })
      }
      expect(cursorOf(plan)).toBe(3)
      expect(retryOf(plan)?.pendingRetries ?? []).toHaveLength(0)
      expect(plan.sessionHealth).toMatchObject({
        accuracy: healthBefore!.accuracy,
        currentStreak: healthBefore!.currentStreak,
      })
      // recordSkillAttemptsWithHelp was not called: lastPracticedAt untouched
      expect(await getAllSkillMastery(playerId)).toEqual(skillsBefore)

      plan = await answerShown(plan, true) // slot 3 -> completed
      expect(plan.status).toBe('completed')

      // BKT (both readers), readiness and the linear gate read the same as
      // they would without the practice-only rows
      const read = async () => {
        const history = await getRecentSessionResults(playerId, 10)
        const evidence = (await batchGetRecentBktEvidence([playerId], 10)).get(playerId) ?? []
        return {
          history,
          bkt: computeBktFromHistory(history).skills,
          bktFromEvidence: computeBktFromHistory(evidence).skills,
        }
      }
      const withRows = await read()
      // Raw rows (practice-only included) fed straight to the pure readers
      const raw: ProblemResultWithContext[] = plan.results.map((r) => ({
        ...r,
        sessionId: plan.id,
        sessionCompletedAt: new Date(),
        partType: 'linear',
      }))
      const rawWithout = raw.filter((r) => !r.practiceOnly)
      expect(raw.length).toBeGreaterThan(rawWithout.length)

      await eph.db
        .update(schema.sessionPlans)
        .set({ results: plan.results.filter((r) => !r.practiceOnly) })
        .where(eq(schema.sessionPlans.id, plan.id))
      const without = await read()

      expect(withRows.history).toEqual(without.history)
      expect(withRows.bkt).toEqual(without.bkt)
      expect(withRows.bktFromEvidence).toEqual(without.bktFromEvidence)
      expect(computeBktFromHistory(raw).skills).toEqual(computeBktFromHistory(rawWithout).skills)
      const practicing = new Set(SKILLS)
      expect(assessAllSkillsReadiness(raw, withRows.bkt, practicing)).toEqual(
        assessAllSkillsReadiness(rawWithout, without.bkt, practicing)
      )
      // A small window and floor so one stray try would move the verdict
      const gate = (problemHistory: ProblemResultWithContext[]) =>
        deriveLinearGateState({
          problemHistory,
          categories: ['basic', 'fiveComplements'],
          thresholds: { minAccuracy: 0.85, accuracyWindowSize: 3, minOpportunities: 1 },
        })
      expect(gate(raw)).toEqual(gate(rawWithout))
    })

    it('rejects a do-over of a problem with no try yet', async () => {
      const plan = await newPlan(playerId, 3)
      await expect(redo(plan, 2, true)).rejects.toBeInstanceOf(SlotResultMismatchError)
      expect((await getSessionPlan(plan.id))!.results).toHaveLength(0)
    })

    it('reaches the same row by tryId and by legacy tryId', async () => {
      let plan = await newPlan(playerId, 3)
      plan = await answerShown(plan, false, tid(5))
      plan = await answerShown(plan, false)
      const review = (target: { tryId: string }, at: string) =>
        applySlotResultReview({
          planId: plan.id,
          playerId,
          target,
          reviewerUserId: 'adult',
          action: { action: 'set_time', adjustedResponseTimeMs: 4000 },
          now: new Date(at),
        })
      const byId = await review({ tryId: tid(5) }, '2026-01-01T00:00:00Z')
      expect(byId.results[0].timingReview?.reviewedAt).toBe('2026-01-01T00:00:00.000Z')

      // A row without a stored tryId (recorded before Phase 1) answers to its legacy id
      const legacy: SlotResult[] = byId.results.map(({ tryId: _t, ...r }, i) =>
        i === 1 ? (r as SlotResult) : byId.results[i]
      )
      await eph.db
        .update(schema.sessionPlans)
        .set({ results: legacy })
        .where(eq(schema.sessionPlans.id, plan.id))
      const byLegacy = await review({ tryId: legacyTryId(plan.id, 1) }, '2026-01-03T00:00:00Z')
      expect(byLegacy.results[1].timingReview?.reviewedAt).toBe('2026-01-03T00:00:00.000Z')
      await expect(review({ tryId: 'nope' }, '2026-01-04T00:00:00Z')).rejects.toMatchObject({
        status: 404,
      })

      // mark_correct weighs a stamped try by its kind and round
      const marked = await applySlotResultReview({
        planId: plan.id,
        playerId,
        target: { tryId: tid(5) },
        reviewerUserId: 'adult',
        action: { action: 'mark_correct' },
      })
      expect(marked.results[0]).toMatchObject({ isCorrect: true, masteryWeight: 1 })
    })
  })
})
