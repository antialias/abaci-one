/**
 * @vitest-environment node
 *
 * Phase 6b-1 and 6b-2 (session architecture §7 Phase 6, §10 P6b1-3, P6b2-2):
 * finished sessions from before Phase 3a render exactly as they did under
 * 6b-0, now that migration 0149 has dropped their legacy columns.
 *
 * A pre-3a row has no `part_states` entry and no `breaks` record; 6b-0 read a
 * part without an entry through the legacy decode of `current_slot_index` and
 * `retry_state`, and 6b-1 no longer reads them. Every view of a finished
 * session (the report, single and list, its summary, the result grids and plan
 * overview, the song's input, history, the MCP tools) is built here from such
 * rows and compared with the snapshot recorded on 6b-0 (`5bf8a911d`), when the
 * rows still carried the legacy columns as a pre-3a pod left them (cursor,
 * retry rounds, break game and reason; see the test's history). Since 0149 the
 * table has no such columns, so the rows are written without them: the views
 * did not read them, and the snapshot is unchanged. These views never reach a
 * part's state, so this does not test `unenteredArithmeticStateOf` (P6b1-3).
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { GeneratedProblem, SessionPart, SlotResult } from '@/db/schema/session-plans'
import {
  arithmeticItemCells,
  arithmeticPartOverview,
} from '@/lib/curriculum/parts/arithmetic/result-view'
import {
  getPaginatedSessions,
  getRecentSessionDates,
  getRecentSessions,
} from '@/lib/curriculum/progress-manager'
import { getRecentSessionResults, getSessionPlan } from '@/lib/curriculum/session-planner'
import { summarizeSessionReport } from '@/lib/curriculum/session-report'
import { buildSessionReports, reportRowColumns } from '@/lib/curriculum/session-report-batch'
import { loadSessionReport } from '@/lib/curriculum/session-report-server'
import { getPracticeSessions, getRecentErrors, getStudentOverview } from '@/lib/mcp/tools'
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

const T0 = new Date('2026-08-03T15:00:00.000Z').getTime()
const NOW = new Date('2026-08-06T12:00:00.000Z').getTime()
const S = 1000
const PART_TYPES = [
  { type: 'abacus', format: 'vertical', useAbacus: true },
  { type: 'visualization', format: 'vertical', useAbacus: false },
  { type: 'linear', format: 'linear', useAbacus: false },
] as const

function problem(p: number, s: number): GeneratedProblem {
  const terms = [10 * p + s + 1, s + 2]
  return { terms, answer: terms[0] + terms[1], skillsRequired: ['basic.directAddition'] }
}

/** Parts as the planner wrote them; `withKind: false` is a row from before Phase 2 */
function partsOf(withKind: boolean): SessionPart[] {
  return PART_TYPES.map((t, p) => ({
    ...(withKind ? { kind: 'arithmetic' as const } : {}),
    partNumber: (p + 1) as 1 | 2 | 3,
    ...t,
    slots: Array.from({ length: 3 }, (_, s) => ({
      slotId: `p${p}s${s}`,
      index: s,
      purpose: 'focus' as const,
      constraints: {},
      problem: problem(p, s),
    })),
    estimatedMinutes: 2,
  })) as SessionPart[]
}

interface LegacyTry {
  p: number
  s: number
  correct: boolean
  at: number
  /** retry round (legacy `epochNumber`) */
  epoch?: number
  redo?: boolean
}

/** A try as a pre-3a (pre-Phase-1) server stored it: legacy fields only */
function legacyRow(t: LegacyTry): SlotResult {
  const pr = problem(t.p, t.s)
  const epoch = t.epoch ?? 0
  return {
    slotId: `p${t.p}s${t.s}`,
    partNumber: (t.p + 1) as 1 | 2 | 3,
    slotIndex: t.s,
    problem: pr,
    studentAnswer: t.correct ? pr.answer : pr.answer + 1,
    isCorrect: t.correct,
    responseTimeMs: 4000 + 500 * t.s,
    skillsExercised: pr.skillsRequired,
    usedOnScreenAbacus: false,
    timestamp: new Date(T0 + t.at * S),
    hadHelp: false,
    incorrectAttempts: t.correct ? 0 : 1,
    isRetry: epoch > 0,
    epochNumber: epoch,
    masteryWeight: t.correct ? 1 / 2 ** epoch : 0,
    ...(epoch > 0 || t.redo ? { originalSlotIndex: t.s } : {}),
    ...(t.redo ? { isManualRedo: true } : {}),
  } as SlotResult
}

const roundItem = (p: number, s: number, epoch: number) => ({
  slotId: `p${p}s${s}`,
  originalSlotIndex: s,
  problem: problem(p, s),
  epochNumber: epoch,
  originalPurpose: 'focus',
})

interface Pre3aRow {
  id: string
  status: string
  flowState: string
  currentPartIndex: number
  completedAt: number | null
  withKind: boolean
  tries: LegacyTry[]
  adjustments?: unknown[]
  /** a `practice-break` game result: [played at (s), duration (s)] */
  game?: [number, number]
}

const GAME_REPORT = {
  gameName: 'memory-quiz',
  gameDisplayName: 'Memory Quiz',
  headline: 'Sharp memory!',
  customStats: [],
}

const ROWS: Pre3aRow[] = [
  {
    // Finished: retries in two parts, a manual redo, a played break
    id: 'pre3a-completed',
    status: 'completed',
    flowState: 'completed',
    currentPartIndex: 3,
    completedAt: T0 + 900 * S,
    withKind: true,
    tries: [
      { p: 0, s: 0, correct: false, at: 30 },
      { p: 0, s: 1, correct: true, at: 60 },
      { p: 0, s: 2, correct: true, at: 90 },
      { p: 0, s: 0, correct: true, at: 120, epoch: 1 },
      { p: 1, s: 0, correct: true, at: 450 },
      { p: 1, s: 1, correct: false, at: 480 },
      { p: 1, s: 2, correct: true, at: 510 },
      { p: 1, s: 1, correct: false, at: 540, epoch: 1 },
      { p: 1, s: 1, correct: false, at: 570, epoch: 2 },
      { p: 0, s: 2, correct: true, at: 600, redo: true },
      { p: 2, s: 0, correct: true, at: 800 },
      { p: 2, s: 1, correct: true, at: 830 },
      { p: 2, s: 2, correct: true, at: 860 },
    ],
    game: [420, 240],
  },
  {
    // Auto-abandoned in part 2's retry round, after a skipped break
    id: 'pre3a-abandoned-in-round',
    status: 'abandoned',
    flowState: 'abandoned',
    currentPartIndex: 1,
    completedAt: T0 + 3 * 86_400 * S,
    withKind: true,
    tries: [
      { p: 0, s: 0, correct: true, at: 30 },
      { p: 0, s: 1, correct: true, at: 60 },
      { p: 0, s: 2, correct: true, at: 90 },
      { p: 1, s: 0, correct: false, at: 150 },
      { p: 1, s: 1, correct: true, at: 180 },
      { p: 1, s: 2, correct: false, at: 210 },
      { p: 1, s: 0, correct: true, at: 240, epoch: 1 },
    ],
  },
  {
    // `in_progress` with `completedAt` set: abandoned by the legacy repair, mid part 1
    id: 'pre3a-legacy-abandoned',
    status: 'in_progress',
    flowState: 'practicing',
    currentPartIndex: 0,
    completedAt: T0 + 86_400 * S,
    withKind: false,
    tries: [
      { p: 0, s: 0, correct: true, at: 30 },
      { p: 0, s: 1, correct: false, at: 60 },
    ],
  },
  {
    // Ended early by an adult mid part 2, parts from before Phase 2 (no `kind`)
    id: 'pre3a-ended-early',
    status: 'completed',
    flowState: 'completed',
    currentPartIndex: 1,
    completedAt: T0 + 400 * S,
    withKind: false,
    tries: [
      { p: 0, s: 0, correct: true, at: 30 },
      { p: 0, s: 1, correct: true, at: 60 },
      { p: 0, s: 2, correct: true, at: 90 },
      { p: 1, s: 0, correct: false, at: 300 },
    ],
    adjustments: [
      {
        timestamp: new Date(T0 + 400 * S),
        type: 'ended_early',
        reason: 'teacher ended',
        previousHealth: {
          overall: 'good',
          accuracy: 0.75,
          pacePercent: 100,
          currentStreak: 0,
          avgResponseTimeMs: 4000,
        },
      },
    ],
  },
]

let eph: EphemeralDbResult
let playerId: string

/** Insert a row as a pre-3a pod left it, after 0149 dropped its legacy columns (raw SQL) */
function insertPre3a(r: Pre3aRow) {
  const sec = (ms: number | null) => (ms == null ? null : Math.floor(ms / 1000))
  eph.sqlite
    .prepare(
      `INSERT INTO session_plans (
        id, player_id, target_duration_minutes, estimated_problem_count,
        avg_time_per_problem_seconds, game_break_settings, parts, summary, mastered_skill_ids,
        status, flow_state, flow_updated_at, flow_version, current_part_index,
        adjustments, results, row_version, breaks, part_states, pauses,
        is_paused, created_at, approved_at, started_at, completed_at
      ) VALUES (?, ?, 6, 9, 20, ?, ?, '{}', '[]', ?, ?, ?, 4, ?, ?, ?, 0, '[]', '{}', '[]', 0, ?, ?, ?, ?)`
    )
    .run(
      r.id,
      playerId,
      JSON.stringify({
        enabled: true,
        maxDurationMinutes: 5,
        selectionMode: 'kid-chooses',
        selectedGame: null,
      }),
      JSON.stringify(partsOf(r.withKind)),
      r.status,
      r.flowState,
      sec(r.completedAt ?? T0),
      r.currentPartIndex,
      JSON.stringify(r.adjustments ?? []),
      JSON.stringify(r.tries.map(legacyRow)),
      sec(T0 - 300 * S),
      sec(T0 - 60 * S),
      sec(T0),
      sec(r.completedAt)
    )
  if (r.game) {
    const [at, duration] = r.game
    eph.sqlite
      .prepare(
        `INSERT INTO game_results (id, player_id, game_name, game_display_name, session_type,
          session_id, normalized_score, accuracy, duration_ms, played_at, full_report, created_at)
         VALUES (?, ?, 'memory-quiz', 'Memory Quiz', 'practice-break', ?, 80, 90, ?, ?, ?, ?)`
      )
      .run(
        `g-${r.id}`,
        playerId,
        r.id,
        duration * S,
        sec(T0 + at * S),
        JSON.stringify({ ...GAME_REPORT, endedAt: T0 + at * S }),
        sec(T0 + at * S)
      )
  }
}

beforeEach(async () => {
  eph = createEphemeralDatabase()
  setCurrentEphemeralDb(eph.db)
  ;({ playerId } = await createTestStudent(eph.db, 'pre3a-kid'))
  for (const r of ROWS) insertPre3a(r)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  setCurrentEphemeralDb(null)
  eph.cleanup()
})

/**
 * JSON with the generated player id replaced, so the snapshot is stable, and
 * without the glitch fields (practice-kinds K5a-3c R1, additive), which these
 * rows have none of: asserted empty here, so the 6b-0 snapshot stays as
 * recorded.
 */
function stable(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value).replaceAll(playerId, '<player>'), (key, v) => {
    if (key !== 'glitches') return v
    expect(v === 0 || (v as { count?: number }).count === 0).toBe(true)
    return undefined
  })
}

describe('Phase 6b-1: finished pre-3a sessions render as they did under 6b-0', () => {
  it('every per-session view', async () => {
    const views: Record<string, unknown> = {}
    for (const r of ROWS) {
      const plan = (await getSessionPlan(r.id))!
      const report = await loadSessionReport(plan, NOW)
      const [listRow] = await getCurrentEphemeralDb()
        .select(reportRowColumns())
        .from(schema.sessionPlans)
        .where(eq(schema.sessionPlans.id, r.id))
      const [listReport] = await buildSessionReports([listRow as never], NOW)
      const song = await buildSongPromptInput({
        sessionPlanId: r.id,
        playerId,
        triggerSource: 'auto',
      })
      views[r.id] = {
        report,
        summary: summarizeSessionReport(report),
        listReport,
        grid: arithmeticItemCells(plan, report),
        overview: plan.parts.map((part) => arithmeticPartOverview(part)),
        song: song.promptInput,
      }
    }
    expect(stable(views)).toMatchSnapshot()
  })

  it('history and the MCP tools', async () => {
    const views = {
      recentSessions: await getRecentSessions(playerId, 10),
      paginated: await getPaginatedSessions(playerId, 20),
      recentDates: await getRecentSessionDates(playerId, 10),
      recentResults: await getRecentSessionResults(playerId, 100),
      mcpPracticeSessions: await getPracticeSessions(playerId, 14),
      mcpRecentErrors: await getRecentErrors(playerId, 7),
      mcpOverview: await getStudentOverview(playerId),
    }
    expect(stable(views)).toMatchSnapshot()
  })
})
