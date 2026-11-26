/**
 * @vitest-environment node
 *
 * Retry / do-over attribution: does the server record each try against the
 * problem the student was actually shown?
 *
 * The client picks the problem to show with getCurrentProblemInfo (which skips
 * retry items redeemed by a manual do-over); the server attributes the answer
 * with its own position (retryState.currentEpochItems[currentRetryIndex]).
 * These tests drive both sides the way ActiveSession does and compare.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPlan } from '@/db/schema/session-plans'
import {
  DEFAULT_GAME_BREAK_SETTINGS,
  getCurrentProblemInfo,
} from '@/db/schema/session-plan-helpers'
import {
  approveSessionPlan,
  generateSessionPlan,
  recordRedoResult,
  recordSlotResult,
  SlotResultMismatchError,
  startSessionPlan,
} from '@/lib/curriculum/session-planner'
import { setPracticingSkills } from '@/lib/curriculum/progress-manager'
import {
  createEphemeralDatabase,
  createTestStudent,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
  type EphemeralDbResult,
} from './journey-simulator/EphemeralDatabase'

vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

const SKILLS = ['basic.directAddition', 'basic.heavenBead']

async function newPlan(playerId: string, problemsPerPart: number): Promise<SessionPlan> {
  const plan = await generateSessionPlan({
    playerId,
    durationMinutes: 5,
    enabledParts: { abacus: true, visualization: false, linear: false },
    overrideProblemsPerPart: problemsPerPart,
    gameBreakSettings: { ...DEFAULT_GAME_BREAK_SETTINGS, enabled: false },
  })
  await approveSessionPlan(plan.id)
  return startSessionPlan(plan.id)
}

/** Answer whatever the client would show right now, the way ActiveSession submits it. */
async function answerShown(plan: SessionPlan, correct: boolean): Promise<SessionPlan> {
  const info = getCurrentProblemInfo(plan)
  if (!info) throw new Error('client shows no problem')
  return recordSlotResult(plan.id, {
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

/** A correct manual do-over of slot `slotIndex` in part 0 whose original was wrong. */
async function redoCorrect(plan: SessionPlan, slotIndex: number): Promise<SessionPlan> {
  const slot = plan.parts[0].slots[slotIndex]
  return recordRedoResult(
    plan.id,
    {
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
    },
    { originalPartIndex: 0, originalSlotIndex: slotIndex, originalWasCorrect: false }
  )
}

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

  it('records the answer against the problem shown after a do-over redeems the current retry', async () => {
    let plan = await newPlan(playerId, 3)
    plan = await answerShown(plan, false) // slot 0 wrong
    plan = await answerShown(plan, false) // slot 1 wrong
    plan = await answerShown(plan, true) // slot 2 right -> retry round 1 = [slot 0, slot 1]
    expect(plan.retryState?.[0]?.currentEpoch).toBe(1)

    plan = await redoCorrect(plan, 0) // kid taps slot 0's dot and gets it right
    const shown = getCurrentProblemInfo(plan)!
    expect(shown.slotId).toBe(plan.parts[0].slots[1].slotId) // client now shows slot 1

    plan = await answerShown(plan, true)
    const last = plan.results.at(-1)!
    expect(last.slotId).toBe(plan.parts[0].slots[1].slotId)
    expect(last.originalSlotIndex).toBe(1) // the try belongs to slot 1
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
    expect(plan.currentSlotIndex).toBe(1)
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
    expect(plan.results.at(-1)!.epochNumber).toBe(1)
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
      expect(plan.results[1].originalSlotIndex).toBe(1)
      expect(plan.currentSlotIndex).toBe(2) // advanced once
      // and the next lagging answer (slot 2, named slot 1) goes to slot 2, not slot 1
      plan = await recordSlotResult(plan.id, tryFor(plan, 2, slot1))
      expect(plan.results[2].slotId).toBe(plan.parts[0].slots[2].slotId)
      expect(plan.results[2].originalSlotIndex).toBe(2)
    })

    it('(b) ignores an exact resubmit, but rejects the same slot with a different answer', async () => {
      let plan = await newPlan(playerId, 3)
      const slot0 = plan.parts[0].slots[0].slotId
      plan = await recordSlotResult(plan.id, tryFor(plan, 0, slot0))
      const after = await recordSlotResult(plan.id, tryFor(plan, 0, slot0))
      expect(after.results).toHaveLength(1)
      expect(after.currentSlotIndex).toBe(1)

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
      expect(plan.results.map((r) => r.originalSlotIndex)).toEqual([0, 1])
      expect(plan.results[1].slotId).toBe(plan.parts[0].slots[1].slotId)
      expect(plan.currentSlotIndex).toBe(2)
    })
  })
})
