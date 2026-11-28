/**
 * The session report (session architecture §4, Phase 4a): one set of numbers
 * for every view of a session (summary, share link, observer, dashboard, MCP,
 * song). Views stop counting `results` themselves; they read this.
 *
 * `buildSessionReport` is pure over `{ plan, tries, gameResults, song, now }`.
 * The server loads those (`session-report-server.ts`) and pushes the report
 * after every committed row write; `useSessionReport` reads it.
 *
 * Counting goes through the shared predicates only: `isCountedTry` (practice-
 * only and voided tries never decide a verdict), `isExcludedTry` (an adult's
 * mastery exclusion), and the tries as `normalizeTries` resolves them (item
 * identity for legacy rows included). Nothing here re-decides what counts.
 *
 * Client-safe: no drizzle, no server imports.
 */

import { isCountedTry, isExcludedTry } from '@/db/schema/session-plan-helpers'
import {
  adjustmentsOf,
  type BreakGameResult,
  currentBreakOf,
  distinctBreakResults,
  legacyBreaksOf,
  partStateOf,
  type SessionOutcome,
  sessionOutcome,
  type Try,
} from '@/db/schema/session-plan-normalize'
import type { BreakRecord, SessionFlowState, SessionPlan, TryKind } from '@/db/schema/session-plans'
import { expectedItemOf, findPartKind, kindIdOf, plannedItemCount } from './parts/registry'
import { getEffectiveResponseTimeMs } from './timing/effective-time'

// ============================================================================
// Shape
// ============================================================================

export interface Counts {
  /** Items planned (each part's progress total), whether attempted or not */
  plannedProblems: number
  /** Attempted items: a first try that is not excluded. The accuracy denominator */
  problems: number
  /** Every try that is not voided (practice-only and excluded included) */
  tries: number
  firstTryCorrect: number
  /** firstTryCorrect / problems; null with nothing attempted */
  firstTryAccuracy: number | null
  /** First try wrong, final verdict right */
  fixedInRetries: number
  /** First try wrong, final verdict wrong (divulged included) */
  unresolved: number
  finalCorrect: number
  /** finalCorrect / problems; null with nothing attempted */
  finalAccuracy: number | null
}

export interface PartReportRow extends Counts {
  partIndex: number
  partNumber: number
  /** The part's kind id (absent on old rows = arithmetic) */
  kind: string
  /**
   * Arithmetic's stored presentation type (abacus / visualization / linear),
   * as the part has it; null when it has none. Kept for the open bundles
   * that read it (`SessionHero`, R3); new readers read `presentation`
   */
  type: string | null
  /**
   * The part's resolved presentation id, from its kind (`presentationOf`;
   * practice-kinds K3): it equals `type` whenever `type` is set, and an
   * arithmetic part without one resolves to `'linear'` (as its evidence
   * does). A kind this image does not know: the part's own `presentation`
   * field, else null
   */
  presentation: string | null
  /** Σ effective response time of the part's tries */
  activeMs: number
}

export interface BreakReportRow {
  breakIndex: number
  /** The part the break follows; null when it cannot be told */
  afterPartIndex: number | null
  game: string | null
  startedAt: number | null
  endedAt: number | null
  durationMs: number | null
  reason: string | null
  /** Still running: shown live, never in totals */
  open: boolean
  /** Reconstructed from `game_results` or the legacy break columns */
  estimated: boolean
}

export interface TryRow {
  tryId: string
  itemId: string
  partIndex: number
  kind: TryKind
  round: number
  isCorrect: boolean
  practiceOnly: boolean
  excluded: boolean
  answer: number
  /** The try's contribution to active time; null when it has no timing sample */
  effectiveMs: number | null
  recordedAt: number | null
}

export type Segment =
  | { kind: 'part'; partIndex: number }
  | { kind: 'break'; breakIndex: number; afterPartIndex: number }
  | { kind: 'end' }

export interface SessionReportPosition {
  segment: Segment
  flowState: SessionFlowState
  /** The item the kid is expected to answer next, when the part has one */
  currentItem?: { partIndex: number; itemId: string }
  /** Items done of planned, summed over parts as their kinds count them */
  progress: { done: number; total: number }
}

export type SessionSongStatus = 'none' | 'pending' | 'ready' | 'failed'

export interface SessionReportSong {
  status: SessionSongStatus
  songId?: string
  shareCode?: string
  /** The row version the lyrics were built from (stamped by the song task; Phase 4e) */
  snapshotAtRowVersion?: number
}

export interface SessionReport {
  rowVersion: number
  sessionId: string
  playerId: string
  outcome: SessionOutcome
  endedEarly: boolean
  startedAt: number | null
  endedAt: number | null
  time: {
    /** Σ effective response time of the tries */
    activeMs: number
    /** end − start (end: completedAt; last activity when abandoned; now while live) */
    wallMs: number
    /** Σ closed breaks */
    breakMs: number
    pausedMs: number
    /** True when any break's time is reconstructed (`game_results`, legacy columns) */
    estimated: boolean
  }
  totals: Counts
  parts: PartReportRow[]
  breaks: BreakReportRow[]
  song: SessionReportSong
  /** Where the kid is; null unless the session is in progress */
  position: SessionReportPosition | null
  tries: TryRow[]
}

/** The session's song row, as the report reads it. */
export interface SessionReportSongInput {
  id: string
  status: string
  shareCode?: string | null
  snapshotAtRowVersion?: number | null
}

export type ReportPlan = Pick<
  SessionPlan,
  | 'id'
  | 'playerId'
  | 'status'
  | 'parts'
  | 'results'
  | 'flowState'
  | 'currentPartIndex'
  | 'partStates'
  | 'adjustments'
  | 'startedAt'
  | 'completedAt'
> & {
  /** When the flow last changed state: the start of a pending break (§10 P6b-3) */
  flowUpdatedAt?: SessionPlan['flowUpdatedAt'] | string | number | null
  rowVersion?: number | null
  pauses?: SessionPlan['pauses'] | null
  /** The machine's break list (Phase 3a on); absent or empty on older rows */
  breaks?: SessionPlan['breaks'] | null
}

/** A practice-break `game_results` row (plus its report, for the dedupe). */
export type ReportGameResult = BreakGameResult & { fullReport?: unknown }

export interface SessionReportInput {
  plan: ReportPlan
  /** `readTries(plan)` */
  tries: readonly Try[]
  /** The session's `practice-break` game results, any order */
  gameResults?: readonly ReportGameResult[]
  /** The session's latest song row, if any */
  song?: SessionReportSongInput | null
  /** Epoch ms; the end of a live session's wall time */
  now: number
}

// ============================================================================
// Builder
// ============================================================================

const BREAK_STATES: ReadonlySet<SessionFlowState> = new Set([
  'break_pending',
  'break_active',
  'break_results',
])

function msOf(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

function emptyCounts(plannedProblems: number): Counts {
  return {
    plannedProblems,
    problems: 0,
    tries: 0,
    firstTryCorrect: 0,
    firstTryAccuracy: null,
    fixedInRetries: 0,
    unresolved: 0,
    finalCorrect: 0,
    finalAccuracy: null,
  }
}

function finishCounts(c: Counts): Counts {
  return {
    ...c,
    firstTryAccuracy: ratio(c.firstTryCorrect, c.problems),
    finalAccuracy: ratio(c.finalCorrect, c.problems),
  }
}

function addCounts(a: Counts, b: Counts): Counts {
  return {
    plannedProblems: a.plannedProblems + b.plannedProblems,
    problems: a.problems + b.problems,
    tries: a.tries + b.tries,
    firstTryCorrect: a.firstTryCorrect + b.firstTryCorrect,
    firstTryAccuracy: null,
    fixedInRetries: a.fixedInRetries + b.fixedInRetries,
    unresolved: a.unresolved + b.unresolved,
    finalCorrect: a.finalCorrect + b.finalCorrect,
    finalAccuracy: null,
  }
}

/** Whether a try can carry a verdict: counted (`isCountedTry`) and not excluded. */
function isVerdictTry(t: Try): boolean {
  return isCountedTry(t) && !isExcludedTry(t.result)
}

/**
 * An item's first try (§4): its `first` try, else (odd legacy rows) its
 * earliest counted try. One rule for the totals and for views of `tries`.
 */
function firstTryOfItem<T extends { kind: string }>(
  group: readonly T[],
  counted: (t: T) => boolean
): T | undefined {
  return group.find((t) => t.kind === 'first') ?? group.find(counted)
}

/** `isVerdictTry` on a report row: counted (not practice-only; voided rows are never listed) and not excluded. */
export function isVerdictTryRow(row: Pick<TryRow, 'practiceOnly' | 'excluded'>): boolean {
  return isCountedTry({ practiceOnly: row.practiceOnly }) && !row.excluded
}

/**
 * Each item's first-try row in `tries`, by the totals' rule (`firstTryOfItem`):
 * `first` holds every item's first try, `verdict` those that carry the item's
 * first-try verdict (the ones `totals.problems` counts). Views that list
 * first tries use these sets, so their rows agree with the totals.
 */
export function firstTryRows(rows: readonly TryRow[]): {
  first: Set<string>
  verdict: Set<string>
} {
  const byItem = new Map<string, TryRow[]>()
  for (const r of rows) {
    const group = byItem.get(r.itemId)
    if (group) group.push(r)
    else byItem.set(r.itemId, [r])
  }
  const first = new Set<string>()
  const verdict = new Set<string>()
  for (const group of byItem.values()) {
    const row = firstTryOfItem(group, (r) => isCountedTry({ practiceOnly: r.practiceOnly }))
    if (!row) continue
    first.add(row.tryId)
    if (isVerdictTryRow(row)) verdict.add(row.tryId)
  }
  return { first, verdict }
}

interface ItemVerdict {
  partIndex: number
  attempted: boolean
  firstCorrect: boolean
  finalCorrect: boolean
}

/**
 * One verdict per item (§4): the first try is the `first` try (else, for odd
 * legacy rows, the item's earliest counted try); the item is attempted when
 * that try exists, counts and is not excluded; the final verdict is the
 * item's last counted, non-excluded try.
 */
function itemVerdicts(live: readonly Try[]): ItemVerdict[] {
  const byItem = new Map<string, Try[]>()
  for (const t of live) {
    const group = byItem.get(t.itemId)
    if (group) group.push(t)
    else byItem.set(t.itemId, [t])
  }
  const verdicts: ItemVerdict[] = []
  for (const group of byItem.values()) {
    const first = firstTryOfItem(group, isCountedTry)
    const attempted = !!first && isVerdictTry(first)
    const weighted = group.filter(isVerdictTry)
    const final = weighted[weighted.length - 1]
    verdicts.push({
      partIndex: (first ?? group[0]).partIndex,
      attempted,
      firstCorrect: attempted && first.isCorrect,
      finalCorrect: attempted && final.isCorrect,
    })
  }
  return verdicts
}

function countsOf(
  plannedProblems: number,
  live: readonly Try[],
  verdicts: readonly ItemVerdict[]
): Counts {
  const c = emptyCounts(plannedProblems)
  c.tries = live.length
  for (const v of verdicts) {
    if (!v.attempted) continue
    c.problems++
    if (v.firstCorrect) c.firstTryCorrect++
    if (v.finalCorrect) c.finalCorrect++
    if (!v.firstCorrect && v.finalCorrect) c.fixedInRetries++
    if (!v.firstCorrect && !v.finalCorrect) c.unresolved++
  }
  return finishCounts(c)
}

function effectiveMsOf(t: Try): number | null {
  return getEffectiveResponseTimeMs(t.result)
}

/** The kind's progress for one part; 0/0 for a kind this image does not know or a broken part. */
function partProgress(
  plan: ReportPlan,
  partIndex: number,
  live: readonly Try[]
): { done: number; total: number } {
  const part = plan.parts[partIndex]
  const kind = findPartKind(part)
  if (!kind) return { done: 0, total: 0 }
  try {
    const content = kind.contentOf(part)
    const state = partStateOf(plan, partIndex)
    return kind.progress(
      content,
      state,
      live.filter((t) => t.partIndex === partIndex)
    )
  } catch {
    return { done: 0, total: 0 }
  }
}

function plannedOf(plan: ReportPlan, partIndex: number): number {
  try {
    return plannedItemCount(plan.parts[partIndex])
  } catch {
    return 0
  }
}

function currentItemOf(plan: ReportPlan): SessionReportPosition['currentItem'] {
  const partIndex = plan.currentPartIndex
  const part = plan.parts[partIndex]
  if (!part) return undefined
  try {
    const expected = expectedItemOf(part, partStateOf(plan, partIndex))
    return expected ? { partIndex, itemId: expected.itemId } : undefined
  } catch {
    return undefined
  }
}

/** A part's presentation id through its kind; a kind this image does not know: the part's own field. */
function presentationIdOf(part: ReportPlan['parts'][number]): string | null {
  const kind = findPartKind(part)
  if (kind) {
    try {
      return kind.presentationOf(part).id
    } catch {
      return null
    }
  }
  const own: unknown = (part as { presentation?: unknown }).presentation
  return typeof own === 'string' ? own : null
}

/** Where a session's breaks were read from (§3.1). */
export type BreakSource = 'breaks' | 'legacy'

/**
 * A session's breaks (§3.1; Phase 5c, §10 P5a-4): the machine's list,
 * `plan.breaks`, when it holds any (every break from Phase 3a on: played,
 * skipped or timed out, open or closed); else the legacy path for rows written
 * before it: one per distinct `practice-break` game result (`legacyBreaksOf`;
 * Phase 6b-0 stopped reading the legacy break columns, §10 P6b-4). The report
 * and the song both read this, so they name the same breaks.
 *
 * A session that straddles Phase 3a's deploy (§10 P5c-7) has `breaks` records
 * only for its later breaks: its earlier ones are the game result rows played
 * before the first record started, listed first. A row a record already names
 * (by id, or by its game's report) is never listed twice.
 */
export function sessionBreaksOf(
  plan: Pick<ReportPlan, 'breaks'>,
  gameResults: readonly ReportGameResult[]
): { source: BreakSource; records: BreakRecord[] } {
  const records = Array.isArray(plan.breaks) ? plan.breaks : []
  const distinct = distinctBreakResults(gameResults)
  if (records.length === 0) return { source: 'legacy', records: legacyBreaksOf(distinct) }
  const firstStart = msOf(records[0].startedAt)
  const earlier =
    firstStart == null
      ? []
      : distinct.filter((g) => {
          const playedAt = msOf(g.playedAt)
          return playedAt != null && playedAt < firstStart && !records.some((r) => names(r, g))
        })
  if (earlier.length === 0) return { source: 'breaks', records }
  const before = legacyBreaksOf(earlier)
  return {
    source: 'breaks',
    records: [...before, ...records].map((r, breakIndex) => ({ ...r, breakIndex })),
  }
}

/** Whether a `breaks` record is the break a game result row reports. */
function names(record: BreakRecord, row: ReportGameResult): boolean {
  if (record.gameResultId != null && record.gameResultId === row.id) return true
  const stored = row.fullReport as { gameName?: unknown; endedAt?: unknown } | null | undefined
  return (
    record.results != null &&
    stored != null &&
    stored.endedAt === record.results.endedAt &&
    stored.gameName === record.results.gameName
  )
}

/**
 * The report's break rows: `sessionBreaksOf`, plus the break the kid is in
 * when it has no record yet. From `breaks`, a record is open while it has no
 * end and the session is in a break state; the break of `break_pending` gets
 * its record only when it starts or is skipped (§10 P5a-3), so it shows as an
 * open row from `currentBreakOf` (its start is `flowUpdatedAt`, §10 P6b-3).
 * From the legacy path (§10 P3b-1, P4a-3): a game result row closes a break,
 * and in a break state the break running now, not yet reported by a result
 * row, is an open row.
 */
function breakRows(
  plan: ReportPlan,
  gameResults: readonly ReportGameResult[],
  live: readonly Try[]
): { rows: BreakReportRow[]; closedByAbandon: ReadonlySet<number> } {
  const { source, records } = sessionBreaksOf(plan, gameResults)
  return source === 'breaks'
    ? machineBreakRows(plan, records, live)
    : {
        rows: legacyBreakRows(plan, records, distinctBreakResults(gameResults), live),
        closedByAbandon: new Set<number>(),
      }
}

/**
 * The machine closes a break that is open when the session is abandoned at
 * the moment of abandonment (`closeOpenBreak`), and auto-abandon can land
 * days later (§10 P5c-13). Such a record (closed, no finish / skip / timeout
 * reason, in an abandoned session) ends, for the report, at the session's
 * last activity: its last try or the end of a break that did end. It never
 * moves the session's end. The stored record keeps its abandon-time close.
 */
function abandonClampOf(
  plan: ReportPlan,
  records: readonly BreakRecord[],
  live: readonly Try[]
): { clampTo: number | null; closedByAbandon: (b: BreakRecord) => boolean } {
  if (sessionOutcome(plan) !== 'abandoned') {
    return { clampTo: null, closedByAbandon: () => false }
  }
  const closedByAbandon = (b: BreakRecord) => b.endedAt != null && b.reason == null
  let clampTo: number | null = null
  for (const t of live) {
    const at = msOf(t.recordedAt)
    if (at != null && (clampTo == null || at > clampTo)) clampTo = at
  }
  for (const b of records) {
    const end = msOf(b.endedAt)
    if (!closedByAbandon(b) && end != null && (clampTo == null || end > clampTo)) clampTo = end
  }
  return { clampTo, closedByAbandon }
}

function machineBreakRows(
  plan: ReportPlan,
  records: readonly BreakRecord[],
  live: readonly Try[]
): { rows: BreakReportRow[]; closedByAbandon: Set<number> } {
  const inBreak = BREAK_STATES.has(plan.flowState)
  const clamp = abandonClampOf(plan, records, live)
  const closedByAbandon = new Set<number>()
  const rows: BreakReportRow[] = records.map((b, breakIndex) => {
    const startedAt = msOf(b.startedAt)
    let endedAt = msOf(b.endedAt)
    // An end the record never got (only a writer that skipped the machine
    // leaves one) is unknown, not running, outside a break state
    const open = endedAt == null && inBreak && breakIndex === records.length - 1
    let durationMs =
      endedAt == null
        ? null
        : (b.durationMs ?? (startedAt != null ? Math.max(0, endedAt - startedAt) : null))
    if (endedAt != null && clamp.closedByAbandon(b)) {
      closedByAbandon.add(breakIndex)
      const bound = clamp.clampTo ?? startedAt ?? endedAt
      endedAt = Math.max(startedAt ?? bound, Math.min(endedAt, bound))
      durationMs = startedAt != null ? Math.max(0, endedAt - startedAt) : 0
    }
    return {
      breakIndex,
      afterPartIndex: b.afterPartIndex ?? afterPartIndexOf(startedAt, live),
      game: b.game ?? null,
      startedAt,
      endedAt,
      durationMs,
      reason: b.reason ?? null,
      open,
      estimated: b.estimated === true,
    }
  })
  const pending =
    (plan.flowState === 'break_pending' || plan.flowState === 'break_active') &&
    !rows.some((r) => r.open)
  if (pending) {
    const running = currentBreakOf(plan)
    rows.push({
      breakIndex: rows.length,
      afterPartIndex: plan.currentPartIndex - 1,
      game: running?.game ?? null,
      startedAt: msOf(running?.startedAt),
      endedAt: null,
      durationMs: null,
      reason: null,
      open: true,
      estimated: false,
    })
  }
  return { rows, closedByAbandon }
}

/**
 * Break rows by the legacy path (§10 P3b-1, P4a-3): one closed row per game
 * result row, and, in a break state, the break running now while no result
 * row reports it. Until Phase 6b-0 that running break came from the legacy
 * break columns (a column record when no result row existed, else an added
 * row); it now comes from `currentBreakOf`, the same row on every row 3a or
 * later wrote (§10 P6b-4).
 */
function legacyBreakRows(
  plan: ReportPlan,
  records: readonly BreakRecord[],
  distinct: readonly ReportGameResult[],
  live: readonly Try[]
): BreakReportRow[] {
  const inBreak = BREAK_STATES.has(plan.flowState)
  const rows: BreakReportRow[] = records.map((b) => {
    const startedAt = msOf(b.startedAt)
    const endedAt = msOf(b.endedAt)
    const durationMs =
      b.durationMs ?? (startedAt != null && endedAt != null ? endedAt - startedAt : null)
    return {
      breakIndex: b.breakIndex,
      afterPartIndex: b.afterPartIndex ?? afterPartIndexOf(startedAt, live),
      game: b.game ?? null,
      startedAt,
      endedAt,
      durationMs,
      reason: b.reason ?? null,
      open: false,
      estimated: b.estimated === true,
    }
  })

  // A break running now whose game has not written a result row yet
  const running = inBreak ? currentBreakOf(plan) : null
  const breakStart = msOf(running?.startedAt)
  const reported =
    breakStart != null &&
    distinct.some((g) => {
      const playedAt = msOf(g.playedAt)
      return playedAt != null && playedAt >= breakStart
    })
  if (running && !reported) {
    rows.push({
      breakIndex: rows.length,
      afterPartIndex: plan.currentPartIndex - 1,
      game: running.game,
      startedAt: breakStart,
      endedAt: null,
      durationMs: null,
      reason: null,
      open: true,
      estimated: true,
    })
  }
  return rows
}

/** The part of the last try recorded before `at` (null when none). */
function afterPartIndexOf(at: number | null, live: readonly Try[]): number | null {
  if (at == null) return null
  let partIndex: number | null = null
  for (const t of live) {
    const recordedAt = msOf(t.recordedAt)
    if (recordedAt != null && recordedAt <= at) partIndex = t.partIndex
  }
  return partIndex
}

function segmentOf(plan: ReportPlan, breaks: readonly BreakReportRow[]): Segment {
  if (BREAK_STATES.has(plan.flowState)) {
    const open = breaks.find((b) => b.open)
    return {
      kind: 'break',
      breakIndex: open?.breakIndex ?? Math.max(0, breaks.length - 1),
      afterPartIndex: plan.currentPartIndex - 1,
    }
  }
  if (plan.currentPartIndex >= plan.parts.length) return { kind: 'end' }
  return { kind: 'part', partIndex: plan.currentPartIndex }
}

function songOf(song: SessionReportSongInput | null | undefined): SessionReportSong {
  if (!song) return { status: 'none' }
  const status: SessionSongStatus =
    song.status === 'completed' ? 'ready' : song.status === 'failed' ? 'failed' : 'pending'
  return {
    status,
    songId: song.id,
    ...(song.shareCode ? { shareCode: song.shareCode } : {}),
    ...(song.snapshotAtRowVersion != null
      ? { snapshotAtRowVersion: song.snapshotAtRowVersion }
      : {}),
  }
}

export function buildSessionReport(input: SessionReportInput): SessionReport {
  const { plan, now } = input
  const parts = plan.parts ?? []
  const outcome = sessionOutcome(plan)
  // Voided tries count nowhere, not even in `tries` (§4)
  const live = input.tries.filter((t) => !t.voided)
  const verdicts = itemVerdicts(live)

  const partRows: PartReportRow[] = parts.map((part, partIndex) => {
    const partTries = live.filter((t) => t.partIndex === partIndex)
    const counts = countsOf(
      plannedOf(plan, partIndex),
      partTries,
      verdicts.filter((v) => v.partIndex === partIndex)
    )
    return {
      partIndex,
      partNumber: part.partNumber,
      kind: kindIdOf(part),
      type: typeof part.type === 'string' ? part.type : null,
      presentation: presentationIdOf(part),
      activeMs: partTries.reduce((sum, t) => sum + (effectiveMsOf(t) ?? 0), 0),
      ...counts,
    }
  })
  // Tries naming no part (legacy residue) still count in the totals
  const totals = finishCounts(
    [
      ...partRows,
      countsOf(
        0,
        live.filter((t) => t.partIndex < 0 || t.partIndex >= parts.length),
        verdicts.filter((v) => v.partIndex < 0 || v.partIndex >= parts.length)
      ),
    ].reduce<Counts>((sum, row) => addCounts(sum, row), emptyCounts(0))
  )

  const { rows: breaks, closedByAbandon } = breakRows(plan, input.gameResults ?? [], live)
  const closedBreaks = breaks.filter((b) => !b.open)
  const breakMs = closedBreaks.reduce((sum, b) => sum + (b.durationMs ?? 0), 0)
  const pausedMs = (plan.pauses ?? []).reduce((sum, p) => {
    const from = msOf(p.pausedAt)
    const to = msOf(p.resumedAt)
    return from != null && to != null ? sum + Math.max(0, to - from) : sum
  }, 0)

  const activeMs = live.reduce((sum, t) => sum + (effectiveMsOf(t) ?? 0), 0)
  const startedAt = msOf(plan.startedAt)
  const completedAt = msOf(plan.completedAt)
  let end: number | null
  if (outcome === 'in_progress') {
    end = now
  } else if (outcome === 'abandoned') {
    // Auto-abandon can land days late: the session ended at its last activity
    const lastTry = live.reduce<number | null>((max, t) => {
      const at = msOf(t.recordedAt)
      return at != null && (max == null || at > max) ? at : max
    }, null)
    // A break the abandonment closed is not activity (§10 P5c-13)
    const lastBreak = closedBreaks
      .filter((b) => !closedByAbandon.has(b.breakIndex))
      .reduce<number | null>(
        (max, b) => (b.endedAt != null && (max == null || b.endedAt > max) ? b.endedAt : max),
        null
      )
    end = lastTry == null && lastBreak == null ? startedAt : Math.max(lastTry ?? 0, lastBreak ?? 0)
  } else {
    end = completedAt
  }
  const wallMs = startedAt != null && end != null ? Math.max(0, end - startedAt) : 0

  const position: SessionReportPosition | null =
    outcome === 'in_progress'
      ? {
          segment: segmentOf(plan, breaks),
          flowState: plan.flowState,
          currentItem: currentItemOf(plan),
          progress: parts.reduce(
            (sum, _part, partIndex) => {
              const p = partProgress(plan, partIndex, live)
              return { done: sum.done + p.done, total: sum.total + p.total }
            },
            { done: 0, total: 0 }
          ),
        }
      : null

  return {
    rowVersion: plan.rowVersion ?? 0,
    sessionId: plan.id,
    playerId: plan.playerId,
    outcome,
    endedEarly: adjustmentsOf(plan).some((a) => a.type === 'ended_early'),
    startedAt,
    // The same instant wall time ends at: `completedAt` when completed, the
    // last activity when abandoned (so endedAt − startedAt === wallMs)
    endedAt: outcome === 'completed' || outcome === 'abandoned' ? end : null,
    time: {
      activeMs,
      wallMs,
      breakMs,
      pausedMs,
      estimated: breaks.some((b) => b.estimated),
    },
    totals,
    parts: partRows,
    breaks,
    song: songOf(input.song),
    position,
    tries: live.map((t) => ({
      tryId: t.tryId,
      itemId: t.itemId,
      partIndex: t.partIndex,
      kind: t.kind,
      round: t.round,
      isCorrect: t.isCorrect,
      practiceOnly: t.practiceOnly,
      excluded: isExcludedTry(t.result),
      answer: t.answer,
      effectiveMs: effectiveMsOf(t),
      recordedAt: msOf(t.recordedAt),
    })),
  }
}

// ============================================================================
// Summary projection (lists, active cards, MCP; Phase 4d)
// ============================================================================

/**
 * The report's headline numbers, without the per-part, per-break and per-try
 * rows: what a list row, an active card or an MCP answer shows. A projection
 * of a built report, never a second count, so a list and the summary of the
 * same session cannot disagree.
 */
export type SessionReportSummary = Pick<
  SessionReport,
  | 'rowVersion'
  | 'sessionId'
  | 'playerId'
  | 'outcome'
  | 'endedEarly'
  | 'startedAt'
  | 'endedAt'
  | 'time'
  | 'totals'
  | 'position'
>

export function summarizeSessionReport(report: SessionReport): SessionReportSummary {
  return {
    rowVersion: report.rowVersion,
    sessionId: report.sessionId,
    playerId: report.playerId,
    outcome: report.outcome,
    endedEarly: report.endedEarly,
    startedAt: report.startedAt,
    endedAt: report.endedAt,
    time: report.time,
    totals: report.totals,
    position: report.position,
  }
}
