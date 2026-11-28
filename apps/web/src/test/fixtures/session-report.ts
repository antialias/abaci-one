/**
 * The shared session report fixture (session architecture §7 Phase 4a; the
 * example of `docs/session-architecture/findings.md`, "Views"): a session of
 * 10 problems in three parts, 3 first tries wrong and every one fixed in its
 * retry round, and one 5-minute game break after part 1.
 *
 * Phases 4b–4e render every view from `tenProblemSessionReport()` and snapshot
 * it, so every screen shows the same numbers:
 *   problems 10, tries 13, first try 7/10 (70 %), fixed in retries 3,
 *   unresolved 0, final 10/10 (100 %), active 58 s (Σ effective response
 *   time), wall 12 min (end − start), one closed 5-minute break.
 *
 * Variants: abandoned (wall from last activity), pre-Phase-1 legacy rows,
 * offline (slot-less parts), recency-refresh sentinel. Pure data: no DB.
 */

import type {
  BreakRecord,
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SlotResult,
} from '@/db/schema/session-plans'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import { readTriesSync } from '@/lib/curriculum/read-tries'
import {
  buildSessionReport,
  type ReportGameResult,
  type SessionReport,
  type SessionReportSongInput,
} from '@/lib/curriculum/session-report'

/** Session start: 2026-01-05 15:00:00 UTC */
export const T0 = Date.parse('2026-01-05T15:00:00.000Z')
const S = 1000
const MIN = 60 * S

/** "Now" for live variants; the ended fixtures ignore it */
export const SESSION_REPORT_NOW = T0 + 60 * MIN

export const TEN_PROBLEM_EXPECTED = {
  plannedProblems: 10,
  problems: 10,
  tries: 13,
  firstTryCorrect: 7,
  firstTryAccuracy: 0.7,
  fixedInRetries: 3,
  unresolved: 0,
  finalCorrect: 10,
  finalAccuracy: 1,
  /** 10 first tries × 4 s + 3 retries × 6 s */
  activeMs: 58 * S,
  /** completedAt − startedAt */
  wallMs: 12 * MIN,
  breakMs: 5 * MIN,
} as const

const PART_SHAPES = [
  { type: 'abacus', format: 'vertical', useAbacus: true, slots: 4 },
  { type: 'visualization', format: 'vertical', useAbacus: false, slots: 3 },
  { type: 'linear', format: 'linear', useAbacus: false, slots: 3 },
] as const

function problemOf(partIndex: number, slotIndex: number): GeneratedProblem {
  const terms = [10 * (partIndex + 1) + slotIndex, slotIndex + 3]
  return { terms, answer: terms[0] + terms[1], skillsRequired: ['basic.directAddition'] }
}

export function fixtureParts(): SessionPart[] {
  return PART_SHAPES.map((shape, partIndex) => ({
    kind: 'arithmetic' as const,
    partNumber: (partIndex + 1) as 1 | 2 | 3,
    type: shape.type,
    format: shape.format,
    useAbacus: shape.useAbacus,
    estimatedMinutes: 3,
    slots: Array.from(
      { length: shape.slots },
      (_, slotIndex): ProblemSlot => ({
        slotId: `fx-p${partIndex}s${slotIndex}`,
        index: slotIndex,
        purpose: 'focus',
        constraints: {},
        problem: problemOf(partIndex, slotIndex),
      })
    ),
  }))
}

interface TrySpec {
  partIndex: number
  slotIndex: number
  correct: boolean
  /** retry round (0 = first try) */
  round?: number
  at: number
  ms: number
  /** Write the pre-Phase-1 shape (no tryId/kind/round), as old rows are */
  legacy?: boolean
}

function rowOf(parts: SessionPart[], spec: TrySpec, n: number): SlotResult {
  const part = parts[spec.partIndex]
  const slot = part.slots[spec.slotIndex]
  const problem = slot.problem!
  const round = spec.round ?? 0
  const base: SlotResult = {
    slotId: slot.slotId,
    partNumber: part.partNumber,
    slotIndex: spec.slotIndex,
    problem,
    studentAnswer: spec.correct ? problem.answer : problem.answer + 1,
    isCorrect: spec.correct,
    responseTimeMs: spec.ms,
    skillsExercised: problem.skillsRequired,
    usedOnScreenAbacus: false,
    timestamp: new Date(spec.at),
    hadHelp: false,
    incorrectAttempts: spec.correct ? 0 : 1,
    isRetry: round > 0,
    epochNumber: round,
    masteryWeight: 1 / 2 ** round,
    ...(round > 0 ? { originalSlotIndex: spec.slotIndex } : {}),
  }
  if (spec.legacy) {
    // Before Phase 1 a wrong try was stamped 0 and nothing else was written
    return { ...base, masteryWeight: spec.correct ? 1 / 2 ** round : 0 }
  }
  return {
    ...base,
    tryId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    kind: round > 0 ? 'retry' : 'first',
    round,
    practiceOnly: false,
    partIndex: spec.partIndex,
    // The try envelope, as the recorders stamp it from K1a on (practice-kinds
    // plan §1.3): every report built from these rows reads as before
    itemId: slot.slotId,
    outcome: 'answered',
    answer: base.studentAnswer,
    evidence: { skills: base.skillsExercised, presentation: part.type },
    payload: { kind: 'arithmetic' },
  }
}

/** The ten-problem session's tries, in order, as specs. */
function tenProblemTries(legacy = false): TrySpec[] {
  const f = (partIndex: number, slotIndex: number, correct: boolean, at: number): TrySpec => ({
    partIndex,
    slotIndex,
    correct,
    at: T0 + at * S,
    ms: 4 * S,
    legacy,
  })
  const r = (partIndex: number, slotIndex: number, at: number): TrySpec => ({
    partIndex,
    slotIndex,
    correct: true,
    round: 1,
    at: T0 + at * S,
    ms: 6 * S,
    legacy,
  })
  return [
    f(0, 0, true, 30),
    f(0, 1, false, 60),
    f(0, 2, true, 90),
    f(0, 3, true, 120),
    r(0, 1, 150),
    // break: 180 s → 480 s
    f(1, 0, true, 510),
    f(1, 1, false, 540),
    f(1, 2, true, 570),
    r(1, 1, 600),
    f(2, 0, false, 630),
    f(2, 1, true, 660),
    f(2, 2, true, 690),
    r(2, 0, 720),
  ]
}

function planOf(
  id: string,
  parts: SessionPart[],
  results: SlotResult[],
  overrides: Partial<SessionPlan> = {}
): SessionPlan {
  return {
    id,
    playerId: 'fx-player',
    targetDurationMinutes: 10,
    estimatedProblemCount: 10,
    avgTimePerProblemSeconds: 30,
    gameBreakSettings: {
      enabled: true,
      maxDurationMinutes: 5,
      selectionMode: 'kid-chooses',
      selectedGame: null,
    },
    parts,
    summary: {} as SessionPlan['summary'],
    masteredSkillIds: [],
    status: 'completed',
    flowState: 'completed',
    flowUpdatedAt: new Date(T0 + 720 * S),
    flowVersion: 9,
    currentPartIndex: parts.length,
    sessionHealth: null,
    adjustments: [],
    results,
    rowVersion: 14,
    breaks: [],
    partStates: {},
    pauses: [],
    remoteCameraSessionId: null,
    isPaused: false,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    createdAt: new Date(T0 - 5 * MIN),
    approvedAt: new Date(T0 - MIN),
    startedAt: new Date(T0),
    completedAt: new Date(T0 + 720 * S),
    statusBeforeDeletion: null,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  } as SessionPlan
}

export interface SessionReportFixture {
  plan: SessionPlan
  gameResults: ReportGameResult[]
  song: SessionReportSongInput | null
  now: number
}

/** The 5-minute break: its game result row (`played_at` = when it ended). */
export function fixtureBreakGameResult(sessionId: string): ReportGameResult {
  return {
    id: `${sessionId}-break-0`,
    gameName: 'memory-quiz',
    playedAt: new Date(T0 + 480 * S),
    durationMs: 5 * MIN,
    fullReport: { gameName: 'memory-quiz', endedAt: T0 + 480 * S },
  }
}

/** The findings' session: 10 problems, 3 wrong fixed in retries, one 5-minute break. */
export function tenProblemSession(): SessionReportFixture {
  const id = 'fx-ten-problems'
  const parts = fixtureParts()
  const results = tenProblemTries().map((spec, i) => rowOf(parts, spec, i + 1))
  return {
    plan: planOf(id, parts, results),
    gameResults: [fixtureBreakGameResult(id)],
    song: { id: 'fx-song', status: 'completed', shareCode: 'fxShare001' },
    now: SESSION_REPORT_NOW,
  }
}

/** The same session written by a server before Phase 1 (no tryId/kind/round). */
export function legacyTenProblemSession(): SessionReportFixture {
  const id = 'fx-legacy'
  const parts = fixtureParts()
  const results = tenProblemTries(true).map((spec, i) => rowOf(parts, spec, i + 1))
  return {
    plan: planOf(id, parts, results, { rowVersion: 0 }),
    gameResults: [fixtureBreakGameResult(id)],
    song: null,
    now: SESSION_REPORT_NOW,
  }
}

/**
 * Abandoned after part 2 (its last try at 10 min), auto-abandoned three days
 * later: wall time runs to the last activity, not to `completedAt`.
 */
export function abandonedSession(): SessionReportFixture {
  const id = 'fx-abandoned'
  const parts = fixtureParts()
  const results = tenProblemTries()
    .slice(0, 9)
    .map((spec, i) => rowOf(parts, spec, i + 1))
  return {
    plan: planOf(id, parts, results, {
      status: 'abandoned',
      flowState: 'abandoned',
      currentPartIndex: 2,
      completedAt: new Date(T0 + 3 * 24 * 60 * MIN),
    }),
    gameResults: [fixtureBreakGameResult(id)],
    song: null,
    now: SESSION_REPORT_NOW,
  }
}

/**
 * The ten-problem session live, at the start of part 3 (Phase 4d's active
 * cards): parts 1 and 2 done with their retries, the break over. Expected:
 * progress 7/10, problems 7, tries 9, first try 5/7, fixed 2, final 7/7.
 */
export function liveTenProblemSession(): SessionReportFixture {
  const id = 'fx-live'
  const parts = fixtureParts()
  const results = tenProblemTries()
    .slice(0, 9)
    .map((spec, i) => rowOf(parts, spec, i + 1))
  return {
    plan: planOf(id, parts, results, {
      status: 'in_progress',
      flowState: 'practicing',
      currentPartIndex: 2,
      completedAt: null,
      rowVersion: 11,
    }),
    gameResults: [fixtureBreakGameResult(id)],
    song: null,
    now: T0 + 620 * S,
  }
}

/**
 * The ten-problem session live in part 1 (Phase 5b, the kid's HUD): three
 * first tries made (slot 1 wrong, its retry still to come), the cursor on
 * part 1's last slot. Expected: progress 3/10, the later parts plan 3 + 3, so
 * 7 left and 1 until the break.
 */
export function liveMidPartOneSession(): SessionReportFixture {
  const id = 'fx-live-p1'
  const parts = fixtureParts()
  const results = tenProblemTries()
    .slice(0, 3)
    .map((spec, i) => rowOf(parts, spec, i + 1))
  return {
    plan: planOf(id, parts, results, {
      status: 'in_progress',
      flowState: 'practicing',
      currentPartIndex: 0,
      partStates: { 0: { slotIndex: 3 } },
      completedAt: null,
      rowVersion: 4,
    }),
    gameResults: [],
    song: null,
    now: T0 + 100 * S,
  }
}

/** An offline session as `offline-sessions/route.ts` inserts it: slot-less parts, index past the end. */
export function offlineSession(): SessionReportFixture {
  const parts = fixtureParts().map((p) => ({ ...p, slots: [] }))
  return {
    plan: planOf('fx-offline', parts, [], {
      targetDurationMinutes: 0,
      estimatedProblemCount: 0,
      currentPartIndex: 3,
      startedAt: null,
      completedAt: new Date(T0),
      rowVersion: 0,
    }),
    gameResults: [],
    song: null,
    now: SESSION_REPORT_NOW,
  }
}

/** A recency-refresh sentinel (`progress-manager.ts` `refreshSkillRecency`). */
export function sentinelSession(): SessionReportFixture {
  const sentinel: SlotResult = {
    slotId: 'fx-sentinel-slot',
    partNumber: 1,
    slotIndex: 0,
    problem: { terms: [0], answer: 0, skillsRequired: ['basic.directAddition'] },
    studentAnswer: 0,
    isCorrect: true,
    responseTimeMs: 0,
    skillsExercised: ['basic.directAddition'],
    usedOnScreenAbacus: false,
    timestamp: new Date(T0),
    hadHelp: false,
    incorrectAttempts: 0,
    source: 'recency-refresh',
  }
  return {
    plan: planOf('fx-sentinel', [], [sentinel], {
      status: 'recency-refresh',
      currentPartIndex: 0,
      startedAt: new Date(T0),
      completedAt: new Date(T0),
      rowVersion: 0,
    }),
    gameResults: [],
    song: null,
    now: SESSION_REPORT_NOW,
  }
}

/** The report of a fixture, as the server builds it. */
export function reportOf(fixture: SessionReportFixture): SessionReport {
  return buildSessionReport({
    plan: fixture.plan,
    tries: readTriesSync(fixture.plan),
    gameResults: fixture.gameResults,
    song: fixture.song,
    now: fixture.now,
  })
}

/** The shared report every view snapshots (Phases 4b–4e). */
export function tenProblemSessionReport(): SessionReport {
  return reportOf(tenProblemSession())
}

/**
 * The ten-problem session paused in part 3's retry round (Phase 4b, the
 * paused modal): every first try made (12 tries, part 3's slot 0 awaiting its
 * retry), so `position.progress` is 10 of 10 while `results` holds 12 rows.
 */
export function pausedTenProblemSession(): SessionReportFixture {
  const id = 'fx-paused'
  const parts = fixtureParts()
  const results = tenProblemTries()
    .slice(0, 12)
    .map((spec, i) => rowOf(parts, spec, i + 1))
  const wrong = parts[2].slots[0]
  return {
    plan: planOf(id, parts, results, {
      status: 'in_progress',
      flowState: 'practicing',
      currentPartIndex: 2,
      partStates: {
        2: {
          slotIndex: 3,
          retry: {
            currentEpoch: 1,
            pendingRetries: [],
            currentEpochItems: [
              {
                slotId: wrong.slotId,
                originalSlotIndex: 0,
                problem: wrong.problem!,
                epochNumber: 1,
                originalPurpose: 'focus',
              },
            ],
            currentRetryIndex: 0,
          },
        },
      },
      isPaused: true,
      pausedAt: new Date(T0 + 700 * S),
      pausedBy: 'kid',
      pauseReason: 'manual',
      completedAt: null,
    }),
    gameResults: [fixtureBreakGameResult(id)],
    song: null,
    now: T0 + 710 * S,
  }
}

/** The paused session's report (Phase 4b). */
export function pausedTenProblemSessionReport(): SessionReport {
  return reportOf(pausedTenProblemSession())
}

/**
 * An offline (worksheet) session with problems (Phase 4b): ten first tries,
 * 7 right, no timing (`startedAt` null, every `responseTimeMs` 0).
 */
export function offlineWorksheetSession(): SessionReportFixture {
  const id = 'fx-offline-worksheet'
  const parts = fixtureParts()
  const results = tenProblemTries()
    .filter((spec) => (spec.round ?? 0) === 0)
    .map((spec, i) => rowOf(parts, { ...spec, ms: 0 }, i + 1))
  return {
    plan: planOf(id, parts, results, { startedAt: null, completedAt: new Date(T0) }),
    gameResults: [],
    song: null,
    now: SESSION_REPORT_NOW,
  }
}

/**
 * The ten-problem session with every try's `slotId` stale (Phase 4d): the
 * rows name slots the parts no longer carry, so item identity must come from
 * the part's slot and its problem (`resolveItemId`). Same report as the
 * ten-problem session.
 */
export function mismatchedSlotIdSession(): SessionReportFixture {
  const base = tenProblemSession()
  const results = base.plan.results.map((r) => ({ ...r, slotId: `stale-${r.slotId}` }))
  const id = 'fx-mismatched-slot'
  return {
    ...base,
    plan: { ...base.plan, id, results },
    gameResults: [fixtureBreakGameResult(id)],
    song: null,
  }
}

/** The ten-problem session written without `slotId` on its tries (Phase 4d). */
export function missingSlotIdSession(): SessionReportFixture {
  const base = tenProblemSession()
  const results = base.plan.results.map(({ slotId: _slotId, ...r }) => r as SlotResult)
  const id = 'fx-missing-slot'
  return {
    ...base,
    plan: { ...base.plan, id, results },
    gameResults: [fixtureBreakGameResult(id)],
    song: null,
  }
}

/**
 * The ten-problem session plus one practice-only do-over of its first item,
 * after the last retry (Phase 4d): a try that counts in tries and active time
 * but changes no verdict.
 */
export function doOverSession(): SessionReportFixture {
  const base = tenProblemSession()
  const parts = base.plan.parts
  const doOver: SlotResult = {
    ...rowOf(parts, { partIndex: 0, slotIndex: 0, correct: true, at: T0 + 710 * S, ms: 3 * S }, 14),
    kind: 'do_over',
    round: 1,
    practiceOnly: true,
    masteryWeight: 0,
    isManualRedo: true,
  }
  const results = [...base.plan.results]
  results.splice(results.length - 1, 0, doOver)
  const id = 'fx-do-over'
  return {
    ...base,
    plan: { ...base.plan, id, results },
    gameResults: [fixtureBreakGameResult(id)],
    song: null,
  }
}

// ============================================================================
// Phase 5c: result grids and every break
// ============================================================================

/**
 * Expected totals of `gridSession` (Phase 5c, the result grids). Its cells:
 * 4 right (final verdict correct), 2 wrong (unresolved), 1 not counted (first
 * try excluded by an adult), 3 not answered (part 3).
 */
export const GRID_EXPECTED = {
  plannedProblems: 10,
  problems: 6,
  tries: 9,
  firstTryCorrect: 4,
  fixedInRetries: 0,
  unresolved: 2,
  finalCorrect: 4,
  cells: { correct: 4, incorrect: 2, 'not-counted': 1, 'practice-only': 0, unanswered: 3 },
} as const

/**
 * Abandoned in part 2 (Phase 5c, the result grids): in part 1 slot 1 was
 * wrong and an adult excluded its right retry, so it stays wrong; in part 2
 * an adult excluded slot 0's try, slot 1 stayed wrong after its retry, slot 2
 * right; part 3 not reached.
 */
export function gridSession(): SessionReportFixture {
  const id = 'fx-grid'
  const parts = fixtureParts()
  const specs = tenProblemTries().slice(0, 9)
  specs[8] = { ...specs[8], correct: false }
  const results = specs.map((spec, i) => rowOf(parts, spec, i + 1))
  results[4] = { ...results[4], source: 'teacher-excluded' }
  results[5] = { ...results[5], source: 'teacher-excluded' }
  return {
    plan: planOf(id, parts, results, {
      status: 'abandoned',
      flowState: 'abandoned',
      currentPartIndex: 1,
      completedAt: new Date(T0 + 700 * S),
    }),
    gameResults: [fixtureBreakGameResult(id)],
    song: null,
    now: SESSION_REPORT_NOW,
  }
}

/** A break the machine recorded (`plan.breaks`), closed. */
function closedBreak(
  breakIndex: number,
  afterPartIndex: number,
  fromS: number,
  toS: number,
  over: Partial<BreakRecord>
): BreakRecord {
  return {
    breakIndex,
    afterPartIndex,
    startedAt: new Date(T0 + fromS * S).toISOString(),
    endedAt: new Date(T0 + toS * S).toISOString(),
    durationMs: (toS - fromS) * S,
    ...over,
  }
}

/**
 * The ten-problem session with two breaks the machine recorded in `breaks`
 * and no game result row (Phase 5c, P5a-4): after part 1 the 5-minute break
 * timed out in memory-quiz; after part 2 a 20-second break in matching was
 * skipped. The legacy columns hold only the last break, as the machine
 * leaves them. Expected: two breaks, 5 min 20 s, not estimated; the song
 * names each once.
 */
export function skippedAndTimedOutBreaksSession(): SessionReportFixture {
  const id = 'fx-breaks-skip-timeout'
  const base = tenProblemSession()
  return {
    plan: {
      ...base.plan,
      id,
      breaks: [
        closedBreak(0, 0, 180, 480, { reason: 'timeout', game: 'memory-quiz' }),
        closedBreak(1, 1, 605, 625, { reason: 'skipped', game: 'matching' }),
      ],
    },
    gameResults: [],
    song: null,
    now: SESSION_REPORT_NOW,
  }
}

/** The game's report of the played break of `playedAndSkippedBreaksSession`. */
function playedBreakReport(): GameResultsReport {
  return {
    gameName: 'memory-quiz',
    gameDisplayName: 'Memory Quiz',
    gameIcon: '🧠',
    durationMs: 5 * MIN,
    completedNormally: true,
    startedAt: T0 + 180 * S,
    endedAt: T0 + 480 * S,
    gameMode: 'single-player',
    playerCount: 1,
    playerResults: [],
    headline: 'Remembered every card!',
  } as unknown as GameResultsReport
}

/**
 * The ten-problem session with a played break (its report on the record and
 * its game result row) and a break skipped before a game was chosen (Phase
 * 5c). Expected: two breaks in the report; the song names the played one
 * once, from its row, and not the one without a game (as before).
 */
export function playedAndSkippedBreaksSession(): SessionReportFixture {
  const id = 'fx-breaks-played-skip'
  const base = tenProblemSession()
  const report = playedBreakReport()
  return {
    plan: {
      ...base.plan,
      id,
      breaks: [
        closedBreak(0, 0, 180, 480, {
          reason: 'gameFinished',
          game: 'memory-quiz',
          results: report,
        }),
        closedBreak(1, 1, 605, 610, { reason: 'skipped', game: null }),
      ],
    },
    gameResults: [
      {
        id: `${id}-break-0`,
        gameName: 'memory-quiz',
        playedAt: new Date(T0 + 480 * S),
        durationMs: 5 * MIN,
        fullReport: report,
        // The row's own column: only the row has it (the song reads it from there)
        accuracy: 0.92,
      } as ReportGameResult,
    ],
    song: null,
    now: SESSION_REPORT_NOW,
  }
}

/**
 * The ten-problem session written before slots carried ids (Phase 5c): its
 * tries name their slots by `slotId`, its parts' slots have none, so a grid
 * finds each item where its tries were recorded.
 */
export function slotIdlessPlanSession(): SessionReportFixture {
  const base = tenProblemSession()
  const parts = base.plan.parts.map((part) => ({
    ...part,
    slots: part.slots.map(({ slotId: _slotId, ...slot }) => slot as ProblemSlot),
  }))
  const id = 'fx-slot-idless'
  return {
    ...base,
    plan: { ...base.plan, id, parts },
    gameResults: [fixtureBreakGameResult(id)],
    song: null,
  }
}

/**
 * A session straddling Phase 3a's deploy (Phase 5c, §10 P5c-7): its first
 * break (after part 1) was played before `breaks` existed and has only its
 * game result row; its second (after part 2, skipped in matching) is a
 * `breaks` record. Expected: both breaks, the first estimated.
 */
export function straddleBreaksSession(): SessionReportFixture {
  const id = 'fx-breaks-straddle'
  const base = tenProblemSession()
  return {
    plan: {
      ...base.plan,
      id,
      breaks: [closedBreak(0, 1, 605, 625, { reason: 'skipped', game: 'matching' })],
    },
    gameResults: [
      {
        ...fixtureBreakGameResult(id),
        fullReport: { ...playedBreakReport(), headline: 'Every pair found!' },
        accuracy: 0.8,
      } as ReportGameResult,
    ],
    song: null,
    now: SESSION_REPORT_NOW,
  }
}

/**
 * Abandoned during a break (Phase 5c, §10 P5c-13): the session of
 * `abandonedSession` (last try at 10 min), its first break played and
 * recorded, the kid in a second break from 10 min 5 s, auto-abandoned three
 * days later. The machine closed the open break at the abandonment, with no
 * reason. Expected: the session ends at its last try, as on the legacy path,
 * and the second break adds no time.
 */
export function abandonedInBreakSession(): SessionReportFixture {
  const base = abandonedSession()
  const abandonedAt = T0 + 3 * 24 * 60 * MIN
  return {
    plan: {
      ...base.plan,
      id: 'fx-abandoned-in-break',
      breaks: [
        closedBreak(0, 0, 180, 480, { reason: 'gameFinished', game: 'memory-quiz' }),
        {
          breakIndex: 1,
          afterPartIndex: 1,
          startedAt: new Date(T0 + 605 * S).toISOString(),
          endedAt: new Date(abandonedAt).toISOString(),
          durationMs: abandonedAt - (T0 + 605 * S),
          game: 'matching',
        },
      ],
    },
    gameResults: [],
    song: null,
    now: SESSION_REPORT_NOW,
  }
}
