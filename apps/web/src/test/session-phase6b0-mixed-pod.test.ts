/**
 * @vitest-environment node
 *
 * Phase 6b-0's acceptance (session architecture §7 Phase 6, §10 P6b-1): a 6b-0
 * pod reads a row 6b-1 wrote exactly as it reads a dual-written one.
 *
 * Twin sessions, one per twin student, take the same steps through the real
 * writers (`recordSlotResult`, `recordRedoResult`, `applySessionFlowEvent`) at
 * the same clock. "dual" is left as 6b-0 writes it. From its handover step on,
 * "6b-1" is put into the shape 6b-1 will write after every step: the six
 * legacy columns frozen at their values at the handover (their defaults for a
 * session 6b-1 created), the legacy try fields (`isRetry`, `epochNumber`,
 * `isManualRedo`, `originalSlotIndex`) stripped from each new try, and, when
 * the cursor moves into a part, that part's initial `part_states` entry
 * written (6b-1's requirement, P6b-1). At every step the outcome, position,
 * retries, tries (do-overs, resubmits and duplicates), breaks, the session
 * report (single and list) and the song's input agree. `flowVersion` and
 * `flowUpdatedAt` are not compared (P6b-5).
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { getNextSlot, isSessionComplete } from '@/db/schema/session-plan-helpers'
import { currentBreakOf, currentItemOf, partStateOf } from '@/db/schema/session-plan-normalize'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SlotResult,
  SlotResultSubmission,
} from '@/db/schema/session-plans'
import { calculateTotalProblemsWithRetries } from '@/lib/curriculum/parts/arithmetic/report'
import { getCurrentProblemInfo } from '@/lib/curriculum/parts/arithmetic/state'
import { readTriesSync } from '@/lib/curriculum/read-tries'
import {
  applySessionFlowEvent,
  getSessionPlan,
  type RedoContext,
  recordRedoResult,
  recordSlotResult,
} from '@/lib/curriculum/session-planner'
import { buildSessionReports, reportRowColumns } from '@/lib/curriculum/session-report-batch'
import { loadSessionReport } from '@/lib/curriculum/session-report-server'
import { buildSongPromptInput } from '@/lib/tasks/session-song'
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

// As in session-row-version.test.ts: hold the mock here so the planner binds it
const { recordSkillAttemptsWithHelp } = vi.hoisted(() => ({
  recordSkillAttemptsWithHelp: vi.fn(async () => []),
}))
vi.mock('@/lib/curriculum/progress-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/curriculum/progress-manager')>()),
  recordSkillAttemptsWithHelp,
}))

const T0 = new Date('2026-12-01T15:00:00.000Z').getTime()
const PART_TYPES = [
  { type: 'abacus', format: 'vertical', useAbacus: true },
  { type: 'visualization', format: 'vertical', useAbacus: false },
  { type: 'linear', format: 'linear', useAbacus: false },
] as const
const LEGACY_COLUMNS = [
  'currentSlotIndex',
  'retryState',
  'breakStartedAt',
  'breakReason',
  'breakSelectedGame',
  'breakResults',
] as const
const LEGACY_TRY_FIELDS = ['isRetry', 'epochNumber', 'isManualRedo', 'originalSlotIndex'] as const

function problem(p: number, s: number): GeneratedProblem {
  const terms = [10 * p + s + 1, s + 2]
  return { terms, answer: terms[0] + terms[1], skillsRequired: ['basic.directAddition'] }
}

function fixtureParts(): SessionPart[] {
  return PART_TYPES.map((t, p) => ({
    kind: 'arithmetic' as const,
    partNumber: (p + 1) as 1 | 2 | 3,
    ...t,
    slots: Array.from(
      { length: 3 },
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

async function insertPlan(id: string, playerId: string) {
  await getCurrentEphemeralDb()
    .insert(schema.sessionPlans)
    .values({
      id,
      playerId,
      targetDurationMinutes: 6,
      estimatedProblemCount: 9,
      avgTimePerProblemSeconds: 20,
      gameBreakSettings: {
        enabled: true,
        maxDurationMinutes: 5,
        selectionMode: 'kid-chooses',
        selectedGame: null,
      },
      parts: fixtureParts(),
      summary: {} as SessionPlan['summary'],
      masteredSkillIds: [],
      status: 'in_progress',
      flowState: 'practicing',
      flowUpdatedAt: new Date(T0),
      flowVersion: 0,
      currentPartIndex: 0,
      currentSlotIndex: 0,
      results: [],
      adjustments: [],
      createdAt: new Date(T0),
      approvedAt: new Date(T0),
      startedAt: new Date(T0),
    })
}

async function row(planId: string): Promise<SessionPlan> {
  return (await getSessionPlan(planId))!
}

async function writeRaw(planId: string, fields: Partial<SessionPlan>) {
  await getCurrentEphemeralDb()
    .update(schema.sessionPlans)
    .set(fields)
    .where(eq(schema.sessionPlans.id, planId))
}

let tryCounter = 0
const tid = () => `00000000-0000-4000-8000-${String(++tryCounter).padStart(12, '0')}`

/** The submission of the item a client shows (the twins show the same item, checked every step) */
function submissionFor(plan: SessionPlan, correct: boolean): SlotResultSubmission {
  const info = getCurrentProblemInfo(plan)
  if (!info) throw new Error('client shows no problem')
  return {
    tryId: tid(),
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
  correct: boolean
): [Omit<SlotResult, 'timestamp' | 'partNumber'>, RedoContext] {
  const slot = plan.parts[partIndex].slots[slotIndex]
  const p = slot.problem!
  return [
    {
      tryId: tid(),
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
    { originalPartIndex: partIndex, originalSlotIndex: slotIndex },
  ]
}

const GAME_REPORT = {
  gameName: 'memory-quiz',
  gameDisplayName: 'Memory Quiz',
  headline: 'Sharp memory!',
  customStats: [],
} as never

/** A step: given the dual twin's row (the input both clients see), what each twin's call does */
type Step = (dual: SessionPlan) => (planId: string) => Promise<unknown>

let lastSubmission: SlotResultSubmission | null = null
const first =
  (correct: boolean): Step =>
  (dual) => {
    const submission = submissionFor(dual, correct)
    lastSubmission = submission
    return (planId) => recordSlotResult(planId, submission)
  }
/** The last first-try sent again with its tryId (a resend after a lost reply) */
const resend: Step = () => {
  const submission = lastSubmission!
  return (planId) => recordSlotResult(planId, submission)
}
/** The last first-try sent again without a tryId (a client from before tryIds double-submitting) */
const resubmitWithoutTryId: Step = () => {
  const { tryId: _, ...submission } = lastSubmission!
  return (planId) => recordSlotResult(planId, submission as SlotResultSubmission)
}
const redo =
  (partIndex: number, slotIndex: number, correct: boolean): Step =>
  (dual) => {
    const args = doOver(dual, partIndex, slotIndex, correct)
    return (planId) => recordRedoResult(planId, ...args)
  }
const flow =
  (event: Parameters<typeof applySessionFlowEvent>[1]): Step =>
  () =>
  (planId) =>
    applySessionFlowEvent(planId, event)

const STEPS: [string, Step][] = [
  ['p0 s0 wrong', first(false)],
  ['p0 s1 right', first(true)],
  ['p0 s2 wrong -> round 1 [s0, s2]', first(false)],
  ['resend of that try (same tryId)', resend],
  ['resubmit of that try without a tryId', resubmitWithoutTryId],
  ['p0 r1 s0 wrong -> s0 again in round 2', first(false)],
  ['p0 r1 s2 right', first(true)],
  ['resubmit of the retry without a tryId', resubmitWithoutTryId],
  ['p0 r2 s0 wrong: answer divulged, part ends -> part_transition', first(false)],
  ['redo p0 s0 (divulged): refused', redo(0, 0, true)],
  ['redo p0 s2 right in part_transition (practice-only, aside)', redo(0, 2, true)],
  ['transition completed -> break_pending', flow({ type: 'PART_TRANSITION_COMPLETED' })],
  ['break started', flow({ type: 'BREAK_STARTED', game: 'memory-quiz' })],
  ['break started again (repeat)', flow({ type: 'BREAK_STARTED', game: 'memory-quiz' })],
  ['game changed', flow({ type: 'BREAK_STARTED', game: 'type-racer-jr' })],
  ['game changed back', flow({ type: 'BREAK_STARTED', game: 'memory-quiz' })],
  [
    'break finished with results',
    flow({ type: 'BREAK_FINISHED', reason: 'gameFinished', results: GAME_REPORT }),
  ],
  [
    'break finished again (repeat)',
    flow({ type: 'BREAK_FINISHED', reason: 'gameFinished', results: GAME_REPORT }),
  ],
  ['results acked', flow({ type: 'BREAK_RESULTS_ACKED' })],
  ['results acked again', flow({ type: 'BREAK_RESULTS_ACKED' })],
  ['p1 s0 right', first(true)],
  ['redo p0 s1 right (earlier part, practice-only)', redo(0, 1, true)],
  ['resubmit of p1 s0 without a tryId, a do-over since', resubmitWithoutTryId],
  ['p1 s1 wrong', first(false)],
  ['p1 s2 right -> round 1 [s1]', first(true)],
  ['redo p1 s1 right mid round 1: redeems -> part_transition', redo(1, 1, true)],
  ['transition completed -> break_pending', flow({ type: 'PART_TRANSITION_COMPLETED' })],
  ['break skipped before it started', flow({ type: 'BREAK_FINISHED', reason: 'skipped' })],
  ['break skipped again', flow({ type: 'BREAK_FINISHED', reason: 'skipped' })],
  ['stray results ack after a skipped break', flow({ type: 'BREAK_RESULTS_ACKED' })],
  ['p2 s0 right', first(true)],
  ['p2 s1 wrong', first(false)],
  ['p2 s2 right -> round 1 [s1]', first(true)],
  ['p2 r1 s1 right -> completed', first(true)],
]

const NAMES = { dual: 'mixed-dual', next: 'mixed-6b1' }

/** Everything a 6b-0 reader derives from a row, the twin's ids replaced */
async function readView(planId: string, now: number) {
  const p = await row(planId)
  const item = currentItemOf(p)
  const shown = getCurrentProblemInfo(p)
  const currentBreak = currentBreakOf(p)
  const [listRow] = await getCurrentEphemeralDb()
    .select(reportRowColumns())
    .from(schema.sessionPlans)
    .where(eq(schema.sessionPlans.id, planId))
  const [listReport] = await buildSessionReports([listRow as never], now)
  const song = await buildSongPromptInput({
    sessionPlanId: planId,
    playerId: p.playerId,
    triggerSource: 'auto',
  })
  const view = {
    status: p.status,
    flowState: p.flowState,
    rowVersion: p.rowVersion,
    currentPartIndex: p.currentPartIndex,
    partStates: p.parts.map((_, i) => partStateOf(p, i)),
    item: item && { partIndex: item.partIndex, slotId: item.slotId, epochNumber: item.epochNumber },
    shown: shown && {
      slotId: shown.slotId,
      epochNumber: shown.epochNumber,
      originalSlotIndex: shown.originalSlotIndex,
    },
    nextSlot: getNextSlot(p)?.slotId ?? null,
    complete: isSessionComplete(p),
    totalWithRetries: calculateTotalProblemsWithRetries(p),
    // a try's raw row keeps whatever fields were stored; no reader reads the
    // legacy ones (legacy-try-fields-gate.test.ts), so they are not compared
    tries: readTriesSync(p).map((t) => ({
      ...t,
      result: Object.fromEntries(
        Object.entries(t.result ?? {}).filter(
          ([k]) => !(LEGACY_TRY_FIELDS as readonly string[]).includes(k)
        )
      ),
    })),
    breaks: p.breaks,
    currentBreak: currentBreak && {
      ...currentBreak,
      startedAt: currentBreak.startedAt && new Date(currentBreak.startedAt).getTime(),
    },
    completedAt: p.completedAt ? new Date(p.completedAt).getTime() : null,
    report: await loadSessionReport(p, now),
    listReport,
    song: song.promptInput,
  }
  return JSON.parse(
    JSON.stringify(view).replaceAll(planId, '<plan>').replaceAll(p.playerId, '<player>')
  )
}

/** The paths where two JSON values differ, with both values */
function diffPaths(a: unknown, b: unknown, at = ''): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return []
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    return [...keys].flatMap((k) =>
      diffPaths((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${at}.${k}`)
    )
  }
  return [`${at}: ${JSON.stringify(a)} | ${JSON.stringify(b)}`]
}

let eph: EphemeralDbResult
let dualPlayer: string
let nextPlayer: string

beforeEach(async () => {
  eph = createEphemeralDatabase()
  setCurrentEphemeralDb(eph.db)
  ;({ playerId: dualPlayer } = await createTestStudent(eph.db, 'twin-dual'))
  ;({ playerId: nextPlayer } = await createTestStudent(eph.db, 'twin-6b1'))
  await insertPlan(NAMES.dual, dualPlayer)
  await insertPlan(NAMES.next, nextPlayer)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  setCurrentEphemeralDb(null)
  eph.cleanup()
})

interface Walk {
  /** Step index from which the 6b-1 twin is kept in 6b-1 shape (0: 6b-1 created it) */
  handover: number
  /** Whether 6b-1 writes a part's initial entry when the cursor moves into it */
  moveOnEntry: boolean
}

/** Walk the twins; the first step whose views differ, or null. */
async function walk({ handover, moveOnEntry }: Walk) {
  let frozen: Partial<SessionPlan> | null = null
  let strippedThrough = 0
  const outcomes: string[] = []
  /** Steps after which the twins' legacy columns differ (the 6b-1 shape was real) */
  const staleColumns = new Set<string>()

  const enforce6b1Shape = async () => {
    const p = await row(NAMES.next)
    if (!frozen) {
      frozen = Object.fromEntries(LEGACY_COLUMNS.map((k) => [k, p[k]])) as Partial<SessionPlan>
      strippedThrough = p.results.length
    }
    const results = p.results.map((r, i) => {
      if (i < strippedThrough) return r
      const stripped = { ...r } as Record<string, unknown>
      for (const k of LEGACY_TRY_FIELDS) delete stripped[k]
      return stripped as unknown as SlotResult
    })
    strippedThrough = results.length
    const partStates = { ...p.partStates }
    if (moveOnEntry && p.currentPartIndex < p.parts.length && !(p.currentPartIndex in partStates)) {
      partStates[p.currentPartIndex] = { slotIndex: 0 }
    }
    await writeRaw(NAMES.next, { ...frozen, results, partStates })
  }

  const run = async (call: (planId: string) => Promise<unknown>, planId: string) => {
    try {
      await call(planId)
      return 'ok'
    } catch (error) {
      return (error as Error).name === 'Error' ? (error as Error).message : (error as Error).name
    }
  }

  for (let k = 0; k <= STEPS.length; k++) {
    if (k === handover) await enforce6b1Shape()
    const now = T0 + k * 60_000
    vi.setSystemTime(now)
    const dualView = await readView(NAMES.dual, now)
    const nextView = await readView(NAMES.next, now)
    const label = k === 0 ? 'start' : STEPS[k - 1][0]
    const [dualRow, nextRow] = [await row(NAMES.dual), await row(NAMES.next)]
    for (const column of LEGACY_COLUMNS) {
      if (JSON.stringify(dualRow[column]) !== JSON.stringify(nextRow[column]))
        staleColumns.add(column)
    }
    if (JSON.stringify(dualView) !== JSON.stringify(nextView)) {
      return { divergedAt: label, diff: diffPaths(dualView, nextView), nextView, outcomes }
    }
    if (k === STEPS.length) break

    const [stepLabel, step] = STEPS[k]
    const call = step(await row(NAMES.dual))
    const outcome = await run(call, NAMES.dual)
    const nextOutcome = await run(call, NAMES.next)
    if (outcome !== nextOutcome) {
      return {
        divergedAt: `${stepLabel} (outcome)`,
        diff: [`outcome: ${outcome} | ${nextOutcome}`],
        nextView: null,
        outcomes,
      }
    }
    outcomes.push(`${stepLabel}: ${outcome}`)
    if (stepLabel === 'break finished with results') {
      // The client stores the game's result beside the break (the same for both)
      for (const [planId, playerId] of [
        [NAMES.dual, dualPlayer],
        [NAMES.next, nextPlayer],
      ]) {
        await getCurrentEphemeralDb()
          .insert(schema.gameResults)
          .values({
            id: `g-${planId}`,
            playerId,
            gameName: 'memory-quiz',
            gameDisplayName: 'Memory Quiz',
            sessionType: 'practice-break',
            sessionId: planId,
            normalizedScore: 80,
            accuracy: 90,
            playedAt: new Date(now),
            fullReport: GAME_REPORT,
          })
      }
    }
    if (k + 1 >= handover) await enforce6b1Shape()
  }
  return { divergedAt: null, outcomes, staleColumns: [...staleColumns].sort() }
}

describe('Phase 6b-0: rows in 6b-1 shape read as dual-written rows', () => {
  it.each([
    ['a session 6b-1 created (legacy columns at their defaults)', 0],
    ['a session handed over mid-part (cursor frozen at s2)', 2],
    ['a session handed over in retry round 1 (retry state frozen)', 4],
    ['a session handed over in a break (break columns frozen)', 13],
  ])('%s', async (_, handover) => {
    const result = await walk({ handover, moveOnEntry: true })
    expect(result.divergedAt, JSON.stringify(result.diff?.slice(0, 30), null, 1)).toBeNull()
    // The walk reached every reader: repeats were no-ops, the refusals were refused
    expect(result.outcomes.filter((o) => !o.endsWith(': ok'))).toEqual([
      expect.stringMatching(
        /^redo p0 s0 \(divulged\): refused: Cannot redo slot 0 in part 0: answer was already revealed/
      ),
      'stray results ack after a skipped break: InvalidFlowTransitionError',
    ])
    const done = await row(NAMES.next)
    expect(done).toMatchObject({ status: 'completed', flowState: 'completed' })
    // the 6b-1 twin really was in 6b-1 shape: every legacy column was stale at
    // some step, and its new tries carry no legacy fields
    expect(result.staleColumns).toEqual([...LEGACY_COLUMNS].sort())
    expect(done.results.slice(-1)[0]).not.toHaveProperty('epochNumber')
    expect(done.breaks.map((b) => [b.game, b.reason])).toEqual([
      ['memory-quiz', 'gameFinished'],
      [null, 'skipped'],
    ])
  })

  it('without the initial entry when the cursor moves into a part, the stale cursor is read (6b-1 must write it, P6b-1)', async () => {
    const result = await walk({ handover: 2, moveOnEntry: false })
    // the try that ends part 0 moves the cursor into part 1, whose position
    // then comes from the frozen cursor (s2) instead of its start
    expect(result.divergedAt).toBe('p0 r2 s0 wrong: answer divulged, part ends -> part_transition')
    expect(result.nextView).toMatchObject({
      partStates: [expect.anything(), { slotIndex: 2 }, expect.anything()],
    })
  })
})
