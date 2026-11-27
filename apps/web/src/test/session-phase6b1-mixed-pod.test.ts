/**
 * @vitest-environment node
 *
 * Phase 6b-1's rollout and rollback check (session architecture §7 Phase 6,
 * §10 P6b-1, P6b-9, P6b1-6): 6b-0 pods serve beside 6b-1 pods, and a rollback
 * lands on 6b-0, so a 6b-0 pod must read every row 6b-1 writes as 6b-1 does.
 *
 * One session takes every step through the real 6b-1 writers
 * (`recordSlotResult`, `recordRedoResult`, `applySessionFlowEvent`) at a fixed
 * clock. Before every step it is copied twice:
 * - "seen by 6b-0": its `part_states` completed the way a 6b-0 pod reads a
 *   part without an entry, by a verbatim copy of 6b-0's legacy decode over the
 *   row's raw `current_slot_index`/`retry_state` (read through SQL: they are
 *   out of the schema). Every other 6b-0 reader is the code 6b-1 runs (6b-0
 *   read no legacy column but these two, P6b-2..P6b-6), so this twin read by
 *   this code is the row as a 6b-0 pod sees it.
 * - "left by 6b-0": the move-on entry of a part no try has reached taken out,
 *   as a 6b-0 write leaves the row (6b-0 wrote the entry on a part's first
 *   try only): 6b-1 reads that row the same (the reverse direction).
 * Before the step and after it, the views agree: outcome, position, retries,
 * tries (do-overs, resubmits and duplicates), breaks, the session report
 * (single and list), the song's input. Each twin takes the step too, and its
 * outcome agrees. `flowVersion` and `flowUpdatedAt` are not compared (P6b-5).
 *
 * A handover (a session a 6b-0 pod wrote until step k) writes the six legacy
 * columns as 6b-0 would have left them at step k; 6b-1 never writes them
 * again, so each goes stale (checked against that encoding at every step).
 * The plan routes' `breakStartedAt` wire value (`legacyWireFieldsOf`) is the
 * 6b-0 column's instant wherever an old bundle reads it (P6b1-2).
 *
 * Old bundles (D9, P6b1-16): at every point of the walk (from before the first
 * try, through each break state) the plan as the routes send it
 * (`serializePlan`, through JSON) is fed to verbatim copies of the 6a and 6b-0
 * clients' position and break logic (`./old-bundles/`); each shows the item,
 * part states and break state that 6b-1's client logic shows.
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { getNextSlot, isSessionComplete } from '@/db/schema/session-plan-helpers'
import {
  currentBreakOf,
  currentItemOf,
  legacyWireFieldsOf,
  partStateOf,
} from '@/db/schema/session-plan-normalize'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SlotResult,
  SlotResultSubmission,
} from '@/db/schema/session-plans'
import { calculateTotalProblemsWithRetries } from '@/lib/curriculum/parts/arithmetic/report'
import type { ArithmeticState } from '@/lib/curriculum/parts/arithmetic/state'
import { getCurrentProblemInfo } from '@/lib/curriculum/parts/arithmetic/state'
import { serializePlan } from '@/lib/curriculum/plan-wire'
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
import * as phase6a from './old-bundles/phase6a-client'
import * as phase6b0 from './old-bundles/phase6b0-client'

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
/** The six legacy columns, as SQL names (out of the drizzle schema since 6b-1) */
const LEGACY_COLUMNS = [
  'current_slot_index',
  'retry_state',
  'break_started_at',
  'break_reason',
  'break_selected_game',
  'break_results',
] as const
type LegacyColumns = Record<(typeof LEGACY_COLUMNS)[number], unknown>
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

const NAMES = { next: 'mixed-6b1', seen: 'mixed-seen-by-6b0', left: 'mixed-left-by-6b0' }

/** The legacy columns as stored (JSON columns parsed; an empty retry map reads as none). */
function rawLegacyColumns(planId: string): LegacyColumns {
  const raw = eph.sqlite
    .prepare(`SELECT ${LEGACY_COLUMNS.join(', ')} FROM session_plans WHERE id = ?`)
    .get(planId) as Record<string, unknown>
  const json = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : (v ?? null))
  const retry = json(raw.retry_state)
  return {
    ...(raw as LegacyColumns),
    retry_state: retry && Object.keys(retry).length > 0 ? retry : null,
    break_results: json(raw.break_results),
  }
}

function writeLegacyColumns(planId: string, columns: LegacyColumns) {
  const json = (v: unknown) => (v === null ? null : JSON.stringify(v))
  eph.sqlite
    .prepare(
      `UPDATE session_plans SET ${LEGACY_COLUMNS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`
    )
    .run(
      columns.current_slot_index,
      json(columns.retry_state),
      columns.break_started_at,
      columns.break_reason,
      columns.break_selected_game,
      json(columns.break_results),
      planId
    )
}

/**
 * The legacy columns as 6b-0 writes them for this row (its `partStatePatch`
 * and break writes, 5bf8a911d): the current part's cursor; every part's
 * retry round; the break columns by flow state (pending: the start; active:
 * the open break's start and game; results: the last break's game, reason
 * and results; otherwise cleared). Seconds, as drizzle's timestamp mode.
 */
function legacyEncodingOf(p: SessionPlan): LegacyColumns {
  const states = p.parts.map((_, i) => partStateOf(p, i) as ArithmeticState)
  const retry = Object.fromEntries(
    states.flatMap((s, i) => (s.retry ? [[String(i), s.retry]] : []))
  )
  const last = p.breaks.at(-1)
  const seconds = (at: string | Date | null | undefined) =>
    at ? Math.floor(new Date(at).getTime() / 1000) : null
  const none = {
    break_started_at: null,
    break_reason: null,
    break_selected_game: null,
    break_results: null,
  }
  const breaks =
    p.flowState === 'break_pending'
      ? { ...none, break_started_at: seconds(p.flowUpdatedAt) }
      : p.flowState === 'break_active'
        ? {
            ...none,
            break_started_at: seconds(last?.startedAt),
            break_selected_game: last?.game ?? null,
          }
        : p.flowState === 'break_results'
          ? {
              ...none,
              break_selected_game: last?.game ?? null,
              break_reason: last?.reason ?? null,
              break_results: last?.results ?? null,
            }
          : none
  return {
    current_slot_index: states[p.currentPartIndex]?.slotIndex ?? 0,
    retry_state: Object.keys(retry).length > 0 ? JSON.parse(JSON.stringify(retry)) : null,
    ...breaks,
  }
}

/**
 * Phase 6b-0's position read for an arithmetic part, copied verbatim
 * (`arithmeticPartStateOf`, `legacyArithmeticStateOf`, `arithmeticStateOf`
 * from 5bf8a911d:apps/web/src/lib/curriculum/parts/arithmetic/state.ts), the
 * two legacy columns passed in as read raw. Every fixture part is arithmetic.
 */
function phase6b0ArithmeticPartStateOf(
  plan: SessionPlan,
  legacy: { currentSlotIndex: number; retryState: Record<string, ArithmeticState['retry']> | null },
  partIndex: number
): ArithmeticState {
  const states: unknown = plan.partStates
  if (states && typeof states === 'object' && !Array.isArray(states)) {
    const entry: unknown = (states as Record<string, unknown>)[String(partIndex)]
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) return entry as ArithmeticState
  }
  if (partIndex === plan.currentPartIndex)
    return { slotIndex: legacy.currentSlotIndex, retry: legacy.retryState?.[partIndex] }
  return {
    slotIndex: partIndex < plan.currentPartIndex ? (plan.parts[partIndex]?.slots?.length ?? 0) : 0,
    retry: legacy.retryState?.[partIndex],
  }
}

/** Copy the session's row onto a twin (its own student), its `part_states` replaced. */
async function copyRow(
  to: string,
  partStates: (p: SessionPlan) => Record<string, unknown>
): Promise<void> {
  const [src] = await getCurrentEphemeralDb()
    .select()
    .from(schema.sessionPlans)
    .where(eq(schema.sessionPlans.id, NAMES.next))
  const { id: _, playerId: __, ...fields } = src
  await writeRaw(to, { ...fields, partStates: partStates(src as SessionPlan) })
}

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
const players = { next: '', seen: '', left: '' }

beforeEach(async () => {
  eph = createEphemeralDatabase()
  setCurrentEphemeralDb(eph.db)
  for (const twin of ['next', 'seen', 'left'] as const) {
    ;({ playerId: players[twin] } = await createTestStudent(eph.db, `twin-${twin}`))
    await insertPlan(NAMES[twin], players[twin])
  }
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
  /** Step index at which a 6b-0 pod hands the session over (0: 6b-1 created it) */
  handover: number
  /**
   * The negative case: take out the entry 6b-1 writes when the cursor moves
   * into a part, as if it did not write it
   */
  dropMoveOnEntry?: boolean
}

interface OldBundleCoverage {
  points: number
  flowStates: Set<string>
  /** Points where a retry item was shown */
  retries: number
  /** Points where the results screen restores persisted results */
  results: number
}

/**
 * 6b-1's client break reads (PracticeClient, the same expressions as 6b-0's,
 * over this image's `currentBreakOf`).
 */
function breakView(currentPlan: SessionPlan) {
  const flowState = currentPlan.flowState ?? 'practicing'
  const showGameBreak = flowState === 'break_pending' || flowState === 'break_active'
  const showGameBreakResults = flowState === 'break_results'
  const currentBreak = currentBreakOf(currentPlan)
  const currentBreakStartMs =
    currentBreak?.startedAt != null ? new Date(currentBreak.startedAt).getTime() : null
  return {
    showGameBreak,
    showGameBreakResults,
    gameBreakStartTime:
      showGameBreak && currentBreakStartMs != null && !Number.isNaN(currentBreakStartMs)
        ? currentBreakStartMs
        : null,
    persistedResults: showGameBreakResults ? (currentBreak?.results ?? null) : null,
  }
}

/**
 * The plan as the routes send it, read by the 6a and 6b-0 bundles' copied
 * logic: the same item, part states and break as 6b-1's client logic reads.
 */
function checkOldBundles(label: string, plan: SessionPlan, coverage: OldBundleCoverage) {
  const wire = JSON.parse(JSON.stringify(serializePlan(plan)))
  const shown = getCurrentProblemInfo(wire)
  expect(phase6a.getCurrentProblemInfo(wire), `${label}: 6a shows`).toEqual(shown)
  expect(phase6b0.getCurrentProblemInfo(wire), `${label}: 6b-0 shows`).toEqual(shown)
  for (let i = 0; i < wire.parts.length; i++) {
    expect(phase6a.partStateOf(wire, i), `${label}: 6a part ${i}`).toEqual(partStateOf(wire, i))
    expect(phase6b0.arithmeticPartStateOf(wire, i), `${label}: 6b-0 part ${i}`).toEqual(
      partStateOf(wire, i)
    )
  }
  const view = breakView(wire)
  expect(phase6a.phase6aBreakView(wire), `${label}: 6a break`).toEqual(view)
  expect(phase6b0.phase6b0BreakView(wire), `${label}: 6b-0 break`).toEqual(view)
  coverage.points++
  coverage.flowStates.add(wire.flowState)
  if (shown?.isRetry) coverage.retries++
  if (view.persistedResults) coverage.results++
}

/** Walk the session; the first step at which a twin's view or outcome differs, or null. */
async function walk({ handover, dropMoveOnEntry = false }: Walk) {
  const outcomes: string[] = []
  /** Legacy columns that differed from 6b-0's encoding of the row at some step */
  const staleColumns = new Set<string>()
  let frozen: LegacyColumns | null = null
  let entriesLeftOut = 0
  let wireChecked = 0
  const oldBundles: OldBundleCoverage = { points: 0, flowStates: new Set(), retries: 0, results: 0 }

  const seenBy6b0 = () =>
    copyRow(NAMES.seen, (p) => {
      const raw = rawLegacyColumns(NAMES.next)
      const legacy = {
        currentSlotIndex: raw.current_slot_index as number,
        retryState: raw.retry_state as Record<string, ArithmeticState['retry']> | null,
      }
      return Object.fromEntries(
        p.parts.map((_, i) => [String(i), phase6b0ArithmeticPartStateOf(p, legacy, i)])
      )
    })
  const leftBy6b0 = () =>
    copyRow(NAMES.left, (p) => {
      const states = { ...(p.partStates ?? {}) }
      const i = p.currentPartIndex
      const reached = p.results.some((r) => r.partNumber === p.parts[i]?.partNumber)
      if (i > 0 && !reached && JSON.stringify(states[String(i)]) === '{"slotIndex":0}') {
        delete states[String(i)]
        entriesLeftOut++
      }
      return states
    })

  const run = async (call: (planId: string) => Promise<unknown>, planId: string) => {
    try {
      await call(planId)
      return 'ok'
    } catch (error) {
      return (error as Error).name === 'Error' ? (error as Error).message : (error as Error).name
    }
  }

  const compare = async (label: string, now: number) => {
    const p = await row(NAMES.next)
    if (frozen) {
      const raw = rawLegacyColumns(NAMES.next)
      const encoding = legacyEncodingOf(p)
      for (const column of LEGACY_COLUMNS) {
        if (JSON.stringify(raw[column]) !== JSON.stringify(encoding[column]))
          staleColumns.add(column)
      }
      // 6b-1 never writes them: still what the handover left
      expect(raw, label).toEqual(frozen)
      if (p.flowState === 'break_pending' || p.flowState === 'break_active') {
        expect(Math.floor(legacyWireFieldsOf(p).breakStartedAt! / 1000), label).toBe(
          encoding.break_started_at
        )
        wireChecked++
      }
    }
    checkOldBundles(label, p, oldBundles)
    const nextView = await readView(NAMES.next, now)
    for (const twin of ['seen', 'left'] as const) {
      const view = await readView(NAMES[twin], now)
      if (JSON.stringify(view) !== JSON.stringify(nextView)) {
        return { divergedAt: `${label} (${twin})`, diff: diffPaths(nextView, view), view }
      }
    }
    return null
  }

  for (let k = 0; k <= STEPS.length; k++) {
    const now = T0 + k * 60_000
    vi.setSystemTime(now)
    if (k === handover) {
      if (k > 0) writeLegacyColumns(NAMES.next, legacyEncodingOf(await row(NAMES.next)))
      frozen = rawLegacyColumns(NAMES.next)
    }
    await seenBy6b0()
    await leftBy6b0()
    const label = k === 0 ? 'start' : STEPS[k - 1][0]
    const before = await compare(label, now)
    if (before) return { ...before, outcomes }
    if (k === STEPS.length) break

    const [stepLabel, step] = STEPS[k]
    const call = step(await row(NAMES.next))
    const movedFrom = (await row(NAMES.next)).currentPartIndex
    const outcome = await run(call, NAMES.next)
    for (const twin of ['seen', 'left'] as const) {
      const twinOutcome = await run(call, NAMES[twin])
      if (twinOutcome !== outcome) {
        return {
          divergedAt: `${stepLabel} (${twin} outcome)`,
          diff: [`outcome: ${outcome} | ${twinOutcome}`],
          view: null,
          outcomes,
        }
      }
    }
    outcomes.push(`${stepLabel}: ${outcome}`)
    // The twins' writes from the same view leave the same row
    const after = await compare(`${stepLabel} (written)`, now)
    if (after) return { ...after, outcomes }

    if (stepLabel === 'break finished with results') {
      // The client stores the game's result beside the break (the same for each twin)
      for (const twin of ['next', 'seen', 'left'] as const) {
        await getCurrentEphemeralDb()
          .insert(schema.gameResults)
          .values({
            id: `g-${NAMES[twin]}`,
            playerId: players[twin],
            gameName: 'memory-quiz',
            gameDisplayName: 'Memory Quiz',
            sessionType: 'practice-break',
            sessionId: NAMES[twin],
            normalizedScore: 80,
            accuracy: 90,
            playedAt: new Date(now),
            fullReport: GAME_REPORT,
          })
      }
    }
    const p = await row(NAMES.next)
    if (dropMoveOnEntry && p.currentPartIndex !== movedFrom) {
      const { [String(p.currentPartIndex)]: _, ...rest } = p.partStates
      await writeRaw(NAMES.next, { partStates: rest })
    }
  }
  return {
    divergedAt: null,
    outcomes,
    staleColumns: [...staleColumns].sort(),
    entriesLeftOut,
    wireChecked,
    oldBundles,
  }
}

describe('Phase 6b-1: a 6b-0 pod reads every row 6b-1 writes as 6b-1 does', () => {
  it.each([
    ['a session 6b-1 created (legacy columns at their defaults)', 0],
    ['a session handed over mid-part (cursor frozen at s2)', 2],
    ['a session handed over in retry round 1 (retry state frozen)', 4],
    ['a session handed over in a break (break columns frozen)', 13],
  ])('%s', async (_, handover) => {
    const result = await walk({ handover })
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
    // The rows really were in 6b-1 shape: every legacy column went stale
    // against 6b-0's encoding, no try carries a legacy field, the reverse
    // direction was exercised (parts 1 and 2), and the wire value was checked
    expect(result.staleColumns).toEqual([...LEGACY_COLUMNS].sort())
    for (const r of done.results) {
      for (const field of LEGACY_TRY_FIELDS) expect(r).not.toHaveProperty(field)
    }
    expect(result.entriesLeftOut).toBeGreaterThanOrEqual(2)
    expect(result.wireChecked).toBeGreaterThan(0)
    // Old bundles were checked at every point, through every break state, a
    // retry round and a restored results screen
    expect(result.oldBundles.points).toBe(2 * STEPS.length + 1)
    expect([...result.oldBundles.flowStates].sort()).toEqual([
      'break_active',
      'break_pending',
      'break_results',
      'completed',
      'part_transition',
      'practicing',
    ])
    expect(result.oldBundles.retries).toBeGreaterThan(0)
    expect(result.oldBundles.results).toBeGreaterThan(0)
    expect(done.breaks.map((b) => [b.game, b.reason])).toEqual([
      ['memory-quiz', 'gameFinished'],
      [null, 'skipped'],
    ])
  })

  it('without the initial entry when the cursor moves into a part, 6b-0 reads the stale cursor (why 6b-1 writes it, P6b-1 (1))', async () => {
    const result = await walk({ handover: 2, dropMoveOnEntry: true })
    // the try that ends part 0 moves the cursor into part 1, whose position a
    // 6b-0 pod then takes from the frozen cursor (s2) instead of its start
    expect(result.divergedAt).toBe(
      'p0 r2 s0 wrong: answer divulged, part ends -> part_transition (seen)'
    )
    expect(result.view).toMatchObject({
      partStates: [expect.anything(), { slotIndex: 2 }, expect.anything()],
    })
  })
})
