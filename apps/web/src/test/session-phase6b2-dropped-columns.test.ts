/**
 * @vitest-environment node
 *
 * Phase 6b-2's rollout and rollback check (session architecture §7 Phase 6,
 * §10 P6b2-3): migration 0149 drops the six legacy columns
 * (`current_slot_index`, `retry_state`, `break_started_at`, `break_reason`,
 * `break_selected_game`, `break_results`). On prod the Argo PreSync Job
 * (`node dist/db/migrate.js`, from the image being deployed) applies 0149
 * before any 6b-2 pod exists, so while 6b-2 rolls out 6b-2a pods serve the
 * dropped table; a rollback from 6b-2 goes to 6b-2a, not 6b-1, because 6b-2a
 * is the newest release whose Job passes on it (6b-1's post-migration check
 * still requires the `break_*` columns; §10 P6b2a-1). 6b-2a's application
 * code is 6b-1's and 6b-2's is 6b-2a's, so the writers and readers here are
 * the ones both serve with.
 *
 * The table is migrated through 0149 (checked: none of the six is left, and
 * the post-migration check 6b-2a and 6b-2 share passes on it). One
 * session takes every step through the real writers (`recordSlotResult`,
 * `recordRedoResult`, `applySessionFlowEvent`) at a fixed clock; every write
 * and read succeeds where it did on the full table (the outcomes). Before
 * every step it is also copied to a twin "left by 6b-0": the move-on entry of
 * a part no try has reached taken out, as a 6b-0 write left the row (6b-0
 * wrote the entry on a part's first try only), for sessions 6b-0 wrote before
 * 6b-1 took over. Before and after each step the two agree: outcome,
 * position, retries, tries (do-overs, resubmits and duplicates), breaks, the
 * session report (single and list), the song's input. `flowVersion` and
 * `flowUpdatedAt` are not compared (P6b-5).
 *
 * The walk passes through every flow state. Its old-bundle check (the plan as
 * the routes sent it, fed to copies of the 6a and 6b-0 clients) went with the
 * derived legacy wire fields (§10 P6b1-16, removed).
 *
 * This file was `session-phase6b1-mixed-pod.test.ts` (P6b1-6). Its 6b-0 twin,
 * which read the raw legacy columns, and its handovers, which wrote them, are
 * gone with the columns: 6b-0 cannot run on this table (P6b2-4, P6b2-5).
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateCriticalSessionPlanColumns } from '@/db/migrate-checks'
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
/** The six legacy columns, as SQL names (dropped by migration 0149) */
const LEGACY_COLUMNS = [
  'current_slot_index',
  'retry_state',
  'break_started_at',
  'break_reason',
  'break_selected_game',
  'break_results',
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

const NAMES = { next: 'session-6b2', left: 'session-left-by-6b0' }

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

/** Everything a reader derives from a row, the twin's ids replaced */
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
const players = { next: '', left: '' }

beforeEach(async () => {
  eph = createEphemeralDatabase()
  setCurrentEphemeralDb(eph.db)
  for (const twin of ['next', 'left'] as const) {
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

/** Walk the session; the first step at which the twin's view or outcome differs, or null. */
async function walk() {
  const outcomes: string[] = []
  let entriesLeftOut = 0
  const flowStates = new Set<string>()

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
    flowStates.add((await row(NAMES.next)).flowState)
    const nextView = await readView(NAMES.next, now)
    const view = await readView(NAMES.left, now)
    if (JSON.stringify(view) !== JSON.stringify(nextView)) {
      return { divergedAt: `${label} (left)`, diff: diffPaths(nextView, view), view }
    }
    return null
  }

  for (let k = 0; k <= STEPS.length; k++) {
    const now = T0 + k * 60_000
    vi.setSystemTime(now)
    await leftBy6b0()
    const label = k === 0 ? 'start' : STEPS[k - 1][0]
    const before = await compare(label, now)
    if (before) return { ...before, outcomes }
    if (k === STEPS.length) break

    const [stepLabel, step] = STEPS[k]
    const call = step(await row(NAMES.next))
    const outcome = await run(call, NAMES.next)
    const twinOutcome = await run(call, NAMES.left)
    if (twinOutcome !== outcome) {
      return {
        divergedAt: `${stepLabel} (left outcome)`,
        diff: [`outcome: ${outcome} | ${twinOutcome}`],
        view: null,
        outcomes,
      }
    }
    outcomes.push(`${stepLabel}: ${outcome}`)
    // The twins' writes from the same view leave the same row
    const after = await compare(`${stepLabel} (written)`, now)
    if (after) return { ...after, outcomes }

    if (stepLabel === 'break finished with results') {
      // The client stores the game's result beside the break (the same for each twin)
      for (const twin of ['next', 'left'] as const) {
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
  }
  return { divergedAt: null, outcomes, entriesLeftOut, flowStates }
}

describe('Phase 6b-2: 6b-1 writes and reads a session on the table 0149 dropped the columns from', () => {
  it('the migrated table has none of the six columns; naming one fails; the PreSync check passes', async () => {
    const columns = (
      eph.sqlite.prepare('PRAGMA table_info(session_plans)').all() as { name: string }[]
    ).map((c) => c.name)
    expect(columns).toEqual(expect.not.arrayContaining([...LEGACY_COLUMNS]))
    expect(columns).toEqual(expect.arrayContaining(['part_states', 'breaks', 'flow_state']))
    // what a pod naming one would meet (why the walk below shows none does)
    for (const column of LEGACY_COLUMNS) {
      expect(() => eph.sqlite.prepare(`UPDATE session_plans SET ${column} = NULL`).run()).toThrow(
        /no such column/
      )
    }
    // the post-migration check 6b-2a and 6b-2 run in the PreSync Job (P6b2a-1)
    await expect(validateCriticalSessionPlanColumns(eph.db)).resolves.toBeUndefined()
  })

  it('every step of the walk: the same outcomes and views', async () => {
    const result = await walk()
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
    for (const r of done.results) {
      for (const field of LEGACY_TRY_FIELDS) expect(r).not.toHaveProperty(field)
    }
    // the reverse direction was exercised (parts 1 and 2)
    expect(result.entriesLeftOut).toBeGreaterThanOrEqual(2)
    expect(done.breaks.map((b) => [b.game, b.reason])).toEqual([
      ['memory-quiz', 'gameFinished'],
      [null, 'skipped'],
    ])
    // The walk went through every flow state
    expect([...result.flowStates!].sort()).toEqual([
      'break_active',
      'break_pending',
      'break_results',
      'completed',
      'part_transition',
      'practicing',
    ])
  })
})
