/**
 * Read-time normalization of a session's tries (session architecture §2, D8).
 *
 * `results` rows are never rewritten: legacy rows stay byte-identical and are
 * read through `normalizeTries`, which derives the try record (`tryId`,
 * `itemId`, `kind`, `round`, practice-only) that rows recorded from Phase 1 on
 * carry as stamped fields.
 *
 * Drizzle-free (only `import type` from schema files): client-safe.
 */

import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import { arithmeticEvidenceOf, arithmeticKind } from '@/lib/curriculum/parts/arithmetic/server'
import {
  type ArithmeticState,
  arithmeticPartStateOf,
  type CurrentPlanItem,
  expectedArithmeticItem,
} from '@/lib/curriculum/parts/arithmetic/state'
import { findPartKind, kindIdOf } from '@/lib/curriculum/parts/registry'
import { itemSlotIndexOfRow, tryKindOfRow, tryRoundOfRow } from './legacy-try-fields'
import { sameProblem } from './session-plan-helpers'
import type {
  BreakRecord,
  SessionAdjustment,
  SessionPart,
  SessionPlan,
  SlotResult,
  TryEvidence,
  TryKind,
  TryOutcome,
  TryPayload,
} from './session-plans'

export interface Try {
  /** Stored `tryId`, else `legacy:<planId>:<arrayIndex>` (the array is append-only) */
  tryId: string
  /** The slot the try answered, resolved by position + content for legacy rows */
  itemId: string
  /** Index of the part in `parts`; -1 when `partNumber` names no part */
  partIndex: number
  partNumber: number
  kind: TryKind
  round: number
  /**
   * The server's stamp, false on legacy rows. The only practice-only flag BKT,
   * readiness and the linear gate read: legacy weight-1.0 evidence is never
   * dropped (§1.2, practiceOnly precedence).
   */
  practiceOnly: boolean
  /** Report-only annotation: the stamp, or for legacy rows the derived flag */
  practiceOnlyDerived: boolean
  /** Voided by worksheet unapproval (Phase 3a): counts nowhere */
  voided: boolean
  isCorrect: boolean
  /**
   * The top-level `studentAnswer`, as every reader of it shows it today (a
   * skip's is the correct answer, the legacy projection, S4). The envelope's
   * `answer` (null unless answered) is `envelopeOfRow(result).answer`; this
   * field moves to it when its readers do (K5b).
   */
  answer: number
  /** Stamped from K1a on; 'answered' for older rows (a skip read from them is wrong either way) */
  outcome: TryOutcome
  /** What the try is evidence of: stamped (null = not counted), else derived (§3.1) */
  evidence: TryEvidence | null
  /** The kind's payload, completed by its `payloadOf` (arithmetic lifts the top-level snapshot) */
  payload: TryPayload
  /** As stored; readers weigh the row through `evidenceWeightOf` (try-weight.ts) */
  masteryWeight: number | undefined
  recordedAt: SlotResult['timestamp']
  arrayIndex: number
  /** The raw row, unchanged */
  result: SlotResult
}

/**
 * A new try id (UUID v4). The client mints one when it shows an item, the
 * server when an old client sent none. `crypto.randomUUID` needs a secure
 * context, so plain-http LAN pages fall back to `getRandomValues`.
 */
export function mintTryId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const CLIENT_TRY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Whether a client-sent `tryId` has the form `mintTryId` produces: a UUID
 * (36 characters, so bounded), never the `legacy:` namespace positional ids
 * live in. Anything else is treated as absent by the server.
 */
export function isClientTryId(value: unknown): value is string {
  return typeof value === 'string' && CLIENT_TRY_ID.test(value)
}

export function legacyTryId(planId: string, arrayIndex: number): string {
  return `legacy:${planId}:${arrayIndex}`
}

/** The try id of the row at `arrayIndex`: its own, else its legacy positional id. */
export function tryIdOf(result: SlotResult, arrayIndex: number, planId: string): string {
  return result.tryId ?? legacyTryId(planId, arrayIndex)
}

/** Index of the row a try id names, or -1. */
export function findTryIndex(
  planId: string,
  results: readonly SlotResult[],
  tryId: string
): number {
  return results.findIndex((r, i) => tryIdOf(r, i, planId) === tryId)
}

/**
 * The item a row answered. Legacy `slotId` is unreliable: an optimistic advance
 * could name the previous slot while `slotIndex` and `problem` came from the
 * slot actually answered (§2). So the slot at (partNumber, originalSlotIndex ??
 * slotIndex) is taken when its problem matches the row's; otherwise the raw
 * `slotId`, and rows without one get `legacy-item:<partNumber>:<slotIndex>`.
 */
export function resolveItemId(result: SlotResult, parts: readonly SessionPart[]): string {
  const slotIndex = itemSlotIndexOfRow(result)
  const part = parts.find((p) => p.partNumber === result.partNumber)
  const slot = Array.isArray(part?.slots) ? part.slots[slotIndex] : undefined
  if (slot?.slotId && sameProblem(slot.problem, result.problem)) return slot.slotId
  if (result.slotId) return result.slotId
  return `legacy-item:${result.partNumber}:${slotIndex}`
}

/** The part a row belongs to: its stamped `partIndex`, else the part its `partNumber` names. */
function partIndexOfRow(
  result: Pick<SlotResult, 'partIndex' | 'partNumber'>,
  parts: readonly { partNumber: number }[]
): number {
  return result.partIndex ?? parts.findIndex((p) => p.partNumber === result.partNumber)
}

/** The envelope fields of a try (practice-kinds plan §1.3, §3.1). */
export type TryEnvelope = Required<
  Pick<SlotResult, 'itemId' | 'outcome' | 'answer' | 'evidence' | 'payload'>
>

/**
 * A row's envelope (practice-kinds plan §3.1). Stamped fields win; a row
 * stored without them (before K1a, or by a pre-K1 image after a rollback,
 * R13) derives them: the item `resolveItemId` names, `outcome: 'answered'`,
 * its `studentAnswer`, its kind's evidence and payload. A row whose part is
 * not in `parts` is a legacy arithmetic row ('linear', as every evidence
 * reader defaults it); a part of a kind this image does not know is not
 * evidence.
 *
 * The writers other than the live recorders (worksheet approval, seeds) stamp
 * what this derives, so their rows read the same stamped or not (R16).
 */
export function envelopeOfRow(result: SlotResult, parts: readonly SessionPart[]): TryEnvelope {
  const part = parts[partIndexOfRow(result, parts)]
  const outcome = result.outcome ?? 'answered'
  return {
    itemId: result.itemId ?? resolveItemId(result, parts),
    outcome,
    answer:
      result.answer !== undefined
        ? result.answer
        : outcome === 'answered'
          ? result.studentAnswer
          : null,
    evidence: evidenceOfRow(result, parts),
    payload: result.payload ?? { kind: part ? kindIdOf(part) : 'arithmetic' },
  }
}

/**
 * What a row's evidence reads of its part. The history and the SQL evidence
 * projection skip the plan's `parts` column (its slots are most of a row's
 * bytes) and hand over only these, so a kind derives evidence from the try,
 * never from the part's content (R9). Only a row stored without `evidence`
 * derives it: every image that knows a kind stamps it (K1a).
 */
export interface EvidencePart {
  partNumber: number
  /** arithmetic's presentation; anything but a string reads as 'linear' */
  type?: unknown
  kind?: string
}

/**
 * The parts as evidence reads them, from the lightweight
 * `[{ n: partNumber, t: type, k: kind }]` projection of a plan's `parts`
 * JSON that the history and the SQL evidence query make, in order: a row's
 * `partIndex` is a position in it, so nothing is dropped (a malformed entry
 * matches no row).
 */
export function evidencePartsOf(json: string | null | undefined): EvidencePart[] {
  let entries: unknown
  try {
    entries = JSON.parse(json || '[]')
  } catch {
    return []
  }
  if (!Array.isArray(entries)) return []
  return entries.map((entry) => {
    const part = (entry && typeof entry === 'object' ? entry : {}) as {
      n?: unknown
      t?: unknown
      k?: unknown
    }
    return {
      partNumber: typeof part.n === 'number' ? part.n : Number.NaN,
      type: part.t,
      kind: typeof part.k === 'string' ? part.k : undefined,
    }
  })
}

/**
 * A row's evidence (practice-kinds plan §3.1): the stamped value (null =
 * recorded, not counted), else derived: a row whose part is not in `parts`
 * is a legacy arithmetic row ('linear', as every evidence reader defaults
 * it); a part of a kind this image does not know is not evidence; else the
 * kind's `evidenceOf`.
 */
export function evidenceOfRow(
  result: SlotResult,
  parts: readonly EvidencePart[]
): TryEvidence | null {
  if (result.evidence !== undefined) return result.evidence
  const part = parts[partIndexOfRow(result, parts)]
  if (!part) return arithmeticEvidenceOf(undefined, result)
  const kind = findPartKind(part)
  if (!kind) return null
  const outcome = result.outcome ?? 'answered'
  return kind.evidenceOf(part, { result, outcome, payload: completedPayloadOf(result, part) })
}

/**
 * A row's payload as readers see it: completed by its kind's `payloadOf`
 * (arithmetic lifts `problem` and `usedOnScreenAbacus`); a row whose part is
 * not in `parts` is legacy arithmetic; a kind this image does not know keeps
 * what is stored.
 */
function completedPayloadOf(
  result: SlotResult,
  part: Pick<EvidencePart, 'kind'> | undefined
): TryPayload {
  const kind = part ? findPartKind(part) : arithmeticKind
  if (kind) return kind.payloadOf(result)
  return result.payload ?? { kind: part ? kindIdOf(part) : 'arithmetic' }
}

/**
 * A do-over's round and practice-only flag from the item's earlier tries:
 * round = prior tries that are not practice-only (M23), practice-only = the
 * latest of those was correct. Shared by the server's stamp and the normalizer.
 */
export function doOverStamp(
  priorTriesOfItem: readonly Pick<Try, 'isCorrect' | 'practiceOnlyDerived'>[]
): { round: number; practiceOnly: boolean } {
  const weighted = priorTriesOfItem.filter((t) => !t.practiceOnlyDerived)
  const latest = weighted[weighted.length - 1]
  return { round: weighted.length, practiceOnly: latest?.isCorrect === true }
}

/**
 * Normalize one row given the normalized tries before it. Stamped fields win;
 * legacy rows derive them from the legacy fields (`tryKindOfRow`,
 * `tryRoundOfRow` in legacy-try-fields.ts; do-overs: `doOverStamp`), and a
 * second `first` try of an item (legacy duplicate submit) becomes a derived
 * practice-only do-over.
 */
export function normalizeTry(
  result: SlotResult,
  arrayIndex: number,
  planId: string,
  parts: readonly SessionPart[],
  prior: readonly Try[]
): Try {
  const envelope = envelopeOfRow(result, parts)
  const itemId = envelope.itemId
  const ofItem = prior.filter((t) => t.itemId === itemId)
  const partIndex = partIndexOfRow(result, parts)

  let kind: TryKind
  let round: number
  let practiceOnlyDerived: boolean
  if (result.kind) {
    kind = result.kind
    round = tryRoundOfRow(result)
    practiceOnlyDerived = result.practiceOnly === true
  } else {
    kind = tryKindOfRow(result)
    if (kind === 'first' && ofItem.some((t) => t.kind === 'first')) kind = 'do_over'
    if (kind === 'do_over') {
      const stamp = doOverStamp(ofItem)
      round = stamp.round
      practiceOnlyDerived = stamp.practiceOnly
    } else {
      round = tryRoundOfRow(result)
      practiceOnlyDerived = false
    }
  }

  return {
    tryId: tryIdOf(result, arrayIndex, planId),
    itemId,
    partIndex,
    partNumber: result.partNumber,
    kind,
    round,
    practiceOnly: result.practiceOnly === true,
    practiceOnlyDerived,
    voided: result.voided === true,
    isCorrect: result.isCorrect,
    answer: result.studentAnswer,
    outcome: envelope.outcome,
    evidence: envelope.evidence,
    payload: completedPayloadOf(result, parts[partIndex]),
    masteryWeight: result.masteryWeight,
    recordedAt: result.timestamp,
    arrayIndex,
    result,
  }
}

/**
 * Every try of a session, in recorded order. `recency-refresh` sentinel rows
 * are not tries and are skipped (their plans' outcome is `sentinel`, §3.2).
 */
export function normalizeTries(
  planId: string,
  parts: readonly SessionPart[],
  results: readonly SlotResult[]
): Try[] {
  const tries: Try[] = []
  results.forEach((result, arrayIndex) => {
    if (!result || result.source === 'recency-refresh') return
    tries.push(normalizeTry(result, arrayIndex, planId, parts, tries))
  })
  return tries
}

// ============================================================================
// Part states (`part_states`, the only position since Phase 6b-1; §5, D5)
// ============================================================================

/** The plan fields a part's state is read from. */
export type PartStateSource = Pick<SessionPlan, 'parts' | 'currentPartIndex' | 'partStates'> &
  Partial<Pick<SessionPlan, 'id'>>

/** The part's entry in `part_states`, or undefined when the row has none. */
function storedPartStateOf(plan: PartStateSource, partIndex: number): unknown {
  const states: unknown = plan.partStates
  if (!states || typeof states !== 'object' || Array.isArray(states)) return undefined
  return (states as Record<string, unknown>)[String(partIndex)] ?? undefined
}

/**
 * A part's state (its kind's cursor): its `part_states` entry, trusted as it
 * stands (Phase 6b-0, §10 P6b-2). A part without one reads the state its
 * place in the session implies: arithmetic through
 * `unenteredArithmeticStateOf` (finished before the cursor, not started at or
 * after it), any other kind its initial state, a kind this image does not
 * know undefined. Since Phase 6b-1 no legacy column is read (§10 P6b1-3).
 */
export function partStateOf(plan: PartStateSource, partIndex: number): unknown {
  const part = plan.parts[partIndex]
  if (kindIdOf(part) === 'arithmetic') return arithmeticPartStateOf(plan, partIndex)
  const stored = storedPartStateOf(plan, partIndex)
  if (stored !== undefined) return stored
  // A kind this image does not know (a newer image's part, read after a
  // rollback) has no initial state here: undefined, never a throw (R2).
  const kind = findPartKind(part)
  return kind ? kind.initialState(kind.contentOf(part)) : undefined
}

/**
 * The item the student is on in the plan's current arithmetic part, from that
 * part's state (`partStateOf`): what a first or retry try must answer
 * (`recordSlotResult`). The same decision, from the same state, as
 * `resolveCurrentItem`, which the client shows (`getCurrentProblemInfo`).
 * Null past the last part, when the part has nothing to show, or when the
 * current part is not arithmetic.
 */
export function currentItemOf(plan: PartStateSource): CurrentPlanItem | null {
  const partIndex = plan.currentPartIndex
  const part = plan.parts[partIndex]
  if (!part || kindIdOf(part) !== 'arithmetic') return null
  const state = partStateOf(plan, partIndex) as ArithmeticState
  const item = expectedArithmeticItem(part.slots, state)
  return item ? { partIndex, ...item } : null
}

/**
 * `part_states` after a try in part `partIndex`: its new state (or
 * `undefined` when the try left it unchanged), and, when the session cursor
 * moves on into part `nextPartIndex`, that part's initial state. The move-on
 * entry is what lets a 6b-0 pod, which decodes a part without an entry from
 * the legacy cursor 6b-1 no longer writes, read the new part as not started
 * (§10 P6b-1 (1)); it is the state this image reads for it anyway.
 */
export function partStatesPatch(
  plan: PartStateSource,
  partIndex: number,
  nextState: unknown,
  nextPartIndex: number
): { partStates: Record<string, unknown> } {
  const partStates: Record<string, unknown> = { ...(plan.partStates ?? {}) }
  if (nextState !== undefined) partStates[String(partIndex)] = nextState
  const next = plan.parts[nextPartIndex]
  if (nextPartIndex !== plan.currentPartIndex && next && !(String(nextPartIndex) in partStates)) {
    // No entry for a kind this image does not know: the image that knows it
    // reads a missing entry as its initial state (`partStateOf`), so the part
    // before it still finishes (R2).
    const kind = findPartKind(next)
    if (kind) partStates[String(nextPartIndex)] = kind.initialState(kind.contentOf(next))
  }
  return { partStates }
}

// ============================================================================
// Breaks (§3.1)
// ============================================================================

/**
 * One row per break: the game-results route inserts without a dedupe, so a
 * double POST (or a re-fired completion) stores the same break twice. A break
 * is its game and its end time (`played_at` is the report's `endedAt`, P3b-5).
 * Shared by the song (3b) and the session report (4a).
 */
export function distinctBreakResults<
  T extends {
    gameName?: string | null
    playedAt?: Date | string | number | null
    fullReport?: unknown
  },
>(results: readonly T[]): T[] {
  const seen = new Set<string>()
  return results.filter((result) => {
    const report = result.fullReport as { endedAt?: number; gameName?: string } | null | undefined
    const endedAt =
      report?.endedAt ?? (result.playedAt ? new Date(result.playedAt).getTime() : null)
    if (endedAt == null) return true
    const key = `${result.gameName ?? report?.gameName}|${endedAt}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** A `game_results` row of a practice break, as the legacy break path reads it. */
export interface BreakGameResult {
  id: string
  gameName?: string | null
  playedAt: Date | string | number
  durationMs?: number | null
}

function isoOf(value: Date | string | number | null | undefined): string | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * A session's breaks by the legacy path (§3.1): one estimated record per
 * `practice-break` game result, in played order. The session report and the
 * song read this for a row with no `breaks` records (`sessionBreaksOf`).
 * Until Phase 6b-0 a row without game results also read the four legacy break
 * columns as at most one break; 6b-0 stopped reading them (§10 P6b-4): the
 * break the kid is in comes from `currentBreakOf`.
 */
export function legacyBreaksOf(gameResults: readonly BreakGameResult[] = []): BreakRecord[] {
  return [...gameResults]
    .sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime())
    .map((g, breakIndex) => ({
      breakIndex,
      afterPartIndex: null,
      // `played_at` is when the game ended (P3b-5); the start is that less its duration
      startedAt: isoOf(
        g.durationMs != null ? new Date(g.playedAt).getTime() - g.durationMs : g.playedAt
      ),
      ...(isoOf(g.playedAt) ? { endedAt: isoOf(g.playedAt) as string } : {}),
      game: g.gameName ?? null,
      gameResultId: g.id,
      ...(g.durationMs != null ? { durationMs: g.durationMs } : {}),
      estimated: true,
    }))
}

/** The plan fields the break the kid is in is read from. */
export type CurrentBreakSource = Pick<SessionPlan, 'flowState'> & {
  flowUpdatedAt?: Date | string | number | null
  breaks?: readonly BreakRecord[] | null
}

/** The break the kid is in: when it started, its game, and the results it ended with. */
export interface CurrentBreak {
  startedAt: Date | string | number | null
  game: string | null
  results: GameResultsReport | null
}

/**
 * The break the kid is in, from the new columns only (Phase 6b-0); null
 * outside the break states.
 *
 * - `break_pending`: the break has no record yet (BREAK_STARTED, or a skip
 *   before it starts, appends it; §10 P5a-3). It started when the flow
 *   entered `break_pending`, which is `flowUpdatedAt` (§10 P6b-3): the same
 *   instant every writer from 3a on stamped as `breakStartedAt`.
 * - `break_active`: the open record.
 * - `break_results`: the last record, closed with the game's results.
 *
 * A break state with no record to read (a break an image before 3a opened)
 * reads `flowUpdatedAt`, with no game or results.
 */
export function currentBreakOf(plan: CurrentBreakSource): CurrentBreak | null {
  const state = plan.flowState
  if (state !== 'break_pending' && state !== 'break_active' && state !== 'break_results') {
    return null
  }
  const pending: CurrentBreak = {
    startedAt: plan.flowUpdatedAt ?? null,
    game: null,
    results: null,
  }
  if (state === 'break_pending') return pending
  const breaks = Array.isArray(plan.breaks) ? plan.breaks : []
  const last = breaks[breaks.length - 1]
  if (!last) return pending
  if (state === 'break_active' && last.endedAt !== undefined) return pending
  return { startedAt: last.startedAt, game: last.game ?? null, results: last.results ?? null }
}

// ============================================================================
// Completion (§3.2)
// ============================================================================

export type SessionOutcome =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'deleted'
  | 'sentinel'

/**
 * What became of a session, from `status`, with one legacy repair: a row
 * `in_progress` with `completedAt` set was abandoned (what
 * `getActiveSessionPlan` already does). List views show `completed |
 * abandoned`, live views `in_progress`; `sentinel` and `not_started` never
 * render as sessions.
 */
export function sessionOutcome(plan: Pick<SessionPlan, 'status' | 'completedAt'>): SessionOutcome {
  switch (plan.status) {
    case 'in_progress':
      return plan.completedAt != null ? 'abandoned' : 'in_progress'
    case 'completed':
      return 'completed'
    case 'abandoned':
      return 'abandoned'
    case 'deleted':
      return 'deleted'
    case 'recency-refresh':
      return 'sentinel'
    default:
      return 'not_started'
  }
}

/** Whether the session has ended (completed or abandoned). */
export function isEndedOutcome(outcome: SessionOutcome): boolean {
  return outcome === 'completed' || outcome === 'abandoned'
}

/**
 * A row's teacher adjustments, always an array of adjustment objects. Rows
 * inserted without `adjustments` got the column's default, `'[]'`, run
 * through the JSON mode: they store the JSON string `"[]"` and read back as
 * the string `'[]'`, so `.some` threw and a spread appended the characters
 * `'['` and `']'`. Anything that is not an adjustment object reads as none,
 * which also cleans up rows an early end corrupted that way.
 */
export function adjustmentsOf(plan: Pick<SessionPlan, 'adjustments'>): SessionAdjustment[] {
  const raw: unknown = plan.adjustments
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (a): a is SessionAdjustment =>
      typeof a === 'object' && a !== null && typeof (a as { type?: unknown }).type === 'string'
  )
}
