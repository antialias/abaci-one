/**
 * @vitest-environment node
 *
 * Practice kinds K0 (plan of record §4 "K0 — Coexistence holes", review R2):
 * an image that does not know a part's kind still finishes the part before
 * it, and a session can end early from inside that part.
 *
 * The plan is `arithmetic → zzz → arithmetic`; this image's registry has no
 * `zzz` (it knows only arithmetic), which is exactly a newer image's plan read
 * after a rollback. Runs the production path on `EphemeralDatabase`: the
 * planner's `recordSlotResult` through the flow machine's `TRY_RECORDED` and
 * `withRowCas`. Folded into the K4 conformance suite later.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SlotResultSubmission,
} from '@/db/schema/session-plans'
import { getCurrentProblemInfo } from '@/lib/curriculum/parts/arithmetic/state'
import { findPartKind, isPartPlayable } from '@/lib/curriculum/parts/registry'
import {
  applySessionFlowEvent,
  completeSessionPlanEarly,
  getSessionPlan,
} from '@/lib/curriculum/session-planner'
import { getSessionReport } from '@/lib/curriculum/session-report-server'
import { sendRecord } from '@/test/fixtures/legacy-try-bodies'
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

// As in session-row-version.test.ts: hoisted so the planner binds the mock.
const { recordSkillAttemptsWithHelp } = vi.hoisted(() => ({
  recordSkillAttemptsWithHelp: vi.fn(async () => []),
}))
vi.mock('@/lib/curriculum/progress-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/curriculum/progress-manager')>()),
  recordSkillAttemptsWithHelp,
}))

const FIXED = new Date('2026-01-01T00:00:00.000Z')
const UNKNOWN_KIND = 'zzz'

function problem(p: number, s: number): GeneratedProblem {
  const terms = [10 * p + s + 1, s + 2]
  return { terms, answer: terms[0] + terms[1], skillsRequired: ['basic.directAddition'] }
}

function arithmeticPart(p: number, slotsPerPart: number): SessionPart {
  return {
    kind: 'arithmetic',
    partNumber: (p + 1) as 1 | 2 | 3,
    type: 'abacus',
    format: 'vertical',
    useAbacus: true,
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
  }
}

/** A part a newer image wrote: a kind id this image does not know, its own content, no slots. */
const unknownPart = {
  kind: UNKNOWN_KIND,
  partNumber: 2,
  content: { items: [{ itemId: 'z0' }, { itemId: 'z1' }] },
  estimatedMinutes: 2,
} as unknown as SessionPart

async function insertPlan(playerId: string): Promise<string> {
  const id = `uk-${Math.random().toString(36).slice(2, 10)}`
  await getCurrentEphemeralDb()
    .insert(schema.sessionPlans)
    .values({
      id,
      playerId,
      targetDurationMinutes: 6,
      estimatedProblemCount: 6,
      avgTimePerProblemSeconds: 20,
      gameBreakSettings: {
        enabled: false,
        maxDurationMinutes: 5,
        selectionMode: 'kid-chooses',
        selectedGame: null,
      },
      parts: [arithmeticPart(0, 2), unknownPart, arithmeticPart(2, 2)],
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

let tryCounter = 0
const tid = () => `00000000-0000-4000-8000-${String(++tryCounter).padStart(12, '0')}`

function correctSubmission(plan: SessionPlan): SlotResultSubmission {
  const info = getCurrentProblemInfo(plan)
  if (!info) throw new Error('client shows no problem')
  return {
    tryId: tid(),
    epochNumber: info.epochNumber,
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
  }
}

async function row(planId: string): Promise<SessionPlan> {
  return (await getSessionPlan(planId))!
}

describe('K0: a part of a kind this image does not know (R2)', () => {
  let eph: EphemeralDbResult
  let playerId: string

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    ;({ playerId } = await createTestStudent(eph.db, 'unknownkind'))
  })
  afterEach(() => {
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  it('the registry under test lacks the kind', () => {
    expect(findPartKind(unknownPart)).toBeUndefined()
  })

  it('finishes the part before it, ends early from inside it, reports it 0/0', async () => {
    const planId = await insertPlan(playerId)

    // Part 1: both items right. The second is the part's last try.
    await sendRecord(planId, correctSubmission(await row(planId)))
    const afterLast = await sendRecord(planId, correctSubmission(await row(planId)))

    // The last try committed and moved the cursor into the unknown part.
    const stored = await row(planId)
    expect(stored.results).toHaveLength(2)
    expect(stored.results.map((r) => r.tryId)).toEqual(afterLast.results.map((r) => r.tryId))
    expect(stored.currentPartIndex).toBe(1)
    expect(stored.flowState).toBe('part_transition')
    // No entry for the part this image cannot give an initial state.
    expect(stored.partStates ?? {}).toHaveProperty('0')
    expect(stored.partStates ?? {}).not.toHaveProperty('1')

    // Into part 2 (no breaks), then end early from inside it.
    const inPart2 = await applySessionFlowEvent(planId, { type: 'PART_TRANSITION_COMPLETED' })
    expect(inPart2.flowState).toBe('practicing')
    expect(inPart2.currentPartIndex).toBe(1)

    const ended = await completeSessionPlanEarly(planId, 'test')
    expect(ended.status).toBe('completed')
    expect(ended.flowState).toBe('completed')

    const report = (await getSessionReport(planId))!
    expect(report.endedEarly).toBe(true)
    const part2 = report.parts.find((p) => p.partIndex === 1)!
    expect(part2.kind).toBe(UNKNOWN_KIND)
    expect(part2.plannedProblems).toBe(0)
    expect(part2.problems).toBe(0)
    expect(part2.tries).toBe(0)
    const part1 = report.parts.find((p) => p.partIndex === 0)!
    expect(part1.problems).toBe(2)
    expect(part1.firstTryCorrect).toBe(2)

    // Not this image's to abandon.
    expect(isPartPlayable(unknownPart)).toBe(true)
  })
})
