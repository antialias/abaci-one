/**
 * @vitest-environment node
 *
 * Practice-kinds K4a (plan of record §3.3, §4 K4, amendments A15-A16): the
 * server half of the client's switch to `record_try`, which K4b makes.
 *
 * - The same screen tries, sent as the K3 client sends them (the superset
 *   body on `record` / `record_redo`) and as the K4b client will
 *   (`envelopeOfScreenTry` on `record_try`), store the same rows: first tries,
 *   retries, a skip, help, an idle cap and do-overs (practice-only and
 *   redeeming), compared deep-equal whatever the key order.
 * - A `record_try` body sets only the fields the server lets it: anything
 *   outside the timing and help whitelist never reaches the row.
 * - `record_try` is traced the way `record` is, with no verdict.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SlotResult,
  SlotResultSubmission,
} from '@/db/schema/session-plans'
import { getCurrentProblemInfo } from '@/lib/curriculum/parts/arithmetic/state'
import { type RedoContext, recordTry, type TrySubmission } from '@/lib/curriculum/record-try'
import { getSessionPlan } from '@/lib/curriculum/session-planner'
import { envelopeOfScreenTry, type ScreenTry, supersetBodyOf } from '@/lib/curriculum/try-wire'
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
vi.mock('@/lib/curriculum/progress-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/curriculum/progress-manager')>()),
  recordSkillAttemptsWithHelp: vi.fn(async () => []),
}))
vi.mock('@/lib/auth/withAuth', () => ({ withAuth: (handler: unknown) => handler }))
vi.mock('@/lib/viewer', () => ({ getUserId: async () => 'adult' }))
vi.mock('@/lib/classroom', () => ({ canPerformAction: async () => true }))
vi.mock('@/lib/classroom/socket-emitter', () => ({ emitSessionStartedToPlayer: vi.fn() }))

const { PATCH } = await import('@/app/api/curriculum/[playerId]/sessions/plans/[planId]/route')

const FIXED = new Date('2026-01-01T00:00:00.000Z')
const tid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

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

async function insertPlan(playerId: string) {
  const id = `k4-${Math.random().toString(36).slice(2, 10)}`
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
      parts: [arithmeticPart(3)],
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

const row = async (planId: string) => (await getSessionPlan(planId))!

/** How the kid answers, and what the screen's guards and help recorded. */
interface Step {
  tryId: string
  /** A do-over of this slot, else what is shown */
  redoSlot?: number
  verdict: 'right' | 'wrong' | 'skip'
  help?: Pick<SlotResult, 'hadHelp' | 'helpTrigger' | 'incorrectAttempts'>
  timing?: Partial<
    Pick<
      SlotResult,
      | 'responseTimeMs'
      | 'responseTimeMsRaw'
      | 'wasIdleCapped'
      | 'capReason'
      | 'capThresholdMs'
      | 'capSource'
      | 'hiddenTimeExcludedMs'
    >
  >
}

/** A try as `handleSubmit` / `handleSkip` build it (ActiveSession.tsx), with its screen-only `isCorrect`. */
function screenTry(plan: SessionPlan, step: Step): ScreenTry & SlotResultSubmission {
  const at =
    step.redoSlot === undefined
      ? getCurrentProblemInfo(plan)!
      : {
          slotId: plan.parts[0].slots[step.redoSlot].slotId,
          originalSlotIndex: step.redoSlot,
          epochNumber: 0,
          problem: plan.parts[0].slots[step.redoSlot].problem!,
        }
  const p = at.problem
  const skip = step.verdict === 'skip'
  return {
    tryId: step.tryId,
    slotId: at.slotId,
    slotIndex: at.originalSlotIndex,
    epochNumber: at.epochNumber,
    problem: p,
    studentAnswer: step.verdict === 'wrong' ? p.answer + 1 : p.answer,
    isCorrect: step.verdict === 'right',
    responseTimeMs: 3000,
    skillsExercised: p.skillsRequired,
    usedOnScreenAbacus: false,
    incorrectAttempts: 0,
    hadHelp: skip,
    ...(skip ? { helpTrigger: 'manual' as const, outcome: 'skipped' as const } : {}),
    ...step.help,
    ...step.timing,
  }
}

/** The K3 client: the superset body on `record`, or on `record_redo` with its context. */
async function sendSuperset(planId: string, step: Step) {
  const plan = await row(planId)
  const t = screenTry(plan, step)
  if (step.redoSlot === undefined) {
    return sendRecord(planId, { ...supersetBodyOf(t), partIndex: plan.currentPartIndex })
  }
  const ctx: RedoContext = {
    itemId: t.slotId,
    originalPartIndex: 0,
    originalSlotIndex: step.redoSlot,
    originalWasCorrect: false,
  }
  return sendRecordRedo(planId, { ...supersetBodyOf(t), originalSlotIndex: step.redoSlot }, ctx)
}

/** The K4b client: every try on `record_try`. */
async function sendEnvelope(planId: string, step: Step) {
  const plan = await row(planId)
  const t = screenTry(plan, step)
  const envelope =
    step.redoSlot === undefined
      ? envelopeOfScreenTry(t, { mode: 'first_or_retry', partIndex: plan.currentPartIndex })
      : envelopeOfScreenTry(t, { mode: 'do_over', partIndex: 0, itemId: t.slotId })
  return (await recordTry(planId, envelope)).plan
}

/**
 * s0 right, idle-capped; s1 wrong with help; s2 skipped; a do-over of s0
 * (practice-only); round 1: s1 right (a retry), s2 wrong; a do-over of s2
 * while it waits for round 2 (it counts and redeems it, ending the part).
 */
const WALK: Step[] = [
  {
    tryId: tid(1),
    verdict: 'right',
    timing: {
      responseTimeMs: 60_000,
      responseTimeMsRaw: 400_000,
      wasIdleCapped: true,
      capReason: 'idle-exceeded',
      capThresholdMs: 60_000,
      capSource: 'client',
      hiddenTimeExcludedMs: 1200,
    },
  },
  {
    tryId: tid(2),
    verdict: 'wrong',
    help: { hadHelp: true, helpTrigger: 'auto-errors', incorrectAttempts: 2 },
  },
  { tryId: tid(3), verdict: 'skip' },
  { tryId: tid(4), redoSlot: 0, verdict: 'right' },
  { tryId: tid(5), verdict: 'right' },
  { tryId: tid(6), verdict: 'wrong', timing: { hiddenTimeExcludedMs: 500 } },
  { tryId: tid(7), redoSlot: 2, verdict: 'right' },
]

const masked = (results: SlotResult[]) =>
  results.map((r) => ({ ...r, timestamp: r.timestamp ? '<set>' : '<unset>' }))

/** Keys sorted all the way down, so a comparison ignores key order and nothing else. */
function sorted(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sorted)
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sorted((v as Record<string, unknown>)[k])])
    )
  }
  return v
}

async function patch(playerId: string, planId: string, body: unknown) {
  const res = await PATCH(
    new Request(`http://test/api/curriculum/${playerId}/sessions/plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ playerId, planId }) } as never
  )
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

describe('K4a: record_try as the K4b client will send it', () => {
  let eph: EphemeralDbResult
  let playerId: string
  let log: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    ;({ playerId } = await createTestStudent(eph.db, 'k4'))
    log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  it('stores the rows the superset body stores, try for try', async () => {
    const viaSuperset = await insertPlan(playerId)
    const viaEnvelope = await insertPlan(playerId)
    for (const step of WALK) {
      await sendSuperset(viaSuperset, step)
      await sendEnvelope(viaEnvelope, step)
      const [a, b] = [await row(viaSuperset), await row(viaEnvelope)]
      expect(sorted(masked(b.results)), step.tryId).toStrictEqual(sorted(masked(a.results)))
      expect(b.partStates).toStrictEqual(a.partStates)
      expect([b.currentPartIndex, b.flowState, b.status]).toEqual([
        a.currentPartIndex,
        a.flowState,
        a.status,
      ])
    }
    // The walk reached every case it names
    const done = await row(viaEnvelope)
    expect(done.results.map((r) => [r.kind, r.round, r.outcome, r.practiceOnly])).toEqual([
      ['first', 0, 'answered', false],
      ['first', 0, 'answered', false],
      ['first', 0, 'skipped', false],
      ['do_over', 1, 'answered', true],
      ['retry', 1, 'answered', false],
      ['retry', 1, 'answered', false],
      ['do_over', 2, 'answered', false],
    ])
    expect(done.results[0]).toMatchObject({ wasIdleCapped: true, responseTimeMsRaw: 400_000 })
    expect(done.results[1]).toMatchObject({ hadHelp: true, helpTrigger: 'auto-errors' })
    expect(done.status).toBe('completed')
  })

  it('stores no field a body names outside the timing and help whitelist', async () => {
    const planId = await insertPlan(playerId)
    const plan = await row(planId)
    const envelope = envelopeOfScreenTry(screenTry(plan, { tryId: tid(1), verdict: 'wrong' }), {
      mode: 'first_or_retry',
      partIndex: 0,
    })
    const smuggled = {
      ...envelope,
      isCorrect: true,
      voided: true,
      timing: {
        ...envelope.timing,
        voided: true,
        attachmentId: 'att-1',
        source: 'worksheet',
        masteryWeight: 1,
        isCorrect: true,
        capReason: 42,
      },
      help: { ...envelope.help, practiceOnly: true, voided: true, helpTrigger: 7 },
    } as unknown as TrySubmission
    const res = await patch(playerId, planId, { action: 'record_try', result: smuggled })
    expect(res.status).toBe(200)
    const [stored] = (await row(planId)).results
    expect(stored).toMatchObject({ isCorrect: false, practiceOnly: false, masteryWeight: 1 })
    for (const key of ['voided', 'attachmentId', 'source', 'capReason', 'helpTrigger']) {
      expect(stored, key).not.toHaveProperty(key)
    }
  })

  it('traces record_try as record is traced, with no verdict', async () => {
    const planId = await insertPlan(playerId)
    const plan = await row(planId)
    const envelope = envelopeOfScreenTry(screenTry(plan, { tryId: tid(1), verdict: 'right' }), {
      mode: 'first_or_retry',
      partIndex: 0,
    })
    expect((await patch(playerId, planId, { action: 'record_try', result: envelope })).status).toBe(
      200
    )
    const traces = log.mock.calls.filter((c) => c[0] === '[GBTRACE][server]')
    const request = traces.find((c) => c[1] === 'patch-record-try-request')
    expect(request?.[2]).toMatchObject({
      planId,
      tryId: tid(1),
      partIndex: 0,
      itemId: 'p0s0',
      mode: 'first_or_retry',
      round: 0,
      outcome: 'answered',
    })
    expect(JSON.stringify(request?.[2])).not.toMatch(/isCorrect|answer"/)
    expect(traces.some((c) => c[1] === 'patch-record-response')).toBe(true)
  })
})
