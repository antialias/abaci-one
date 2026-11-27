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

import {
  type ArithmeticState,
  arithmeticStateOf,
  type CurrentPlanItem,
  expectedArithmeticItem,
} from '@/lib/curriculum/parts/arithmetic/state'
import { kindIdOf, partKindOf } from '@/lib/curriculum/parts/registry'
import { itemSlotIndexOfRow, tryKindOfRow, tryRoundOfRow } from './legacy-try-fields'
import { sameProblem } from './session-plan-helpers'
import type {
  BreakRecord,
  SessionAdjustment,
  SessionPart,
  SessionPlan,
  SessionRetryState,
  SlotResult,
  TryKind,
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
  answer: number
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
  const itemId = resolveItemId(result, parts)
  const ofItem = prior.filter((t) => t.itemId === itemId)

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
    partIndex: result.partIndex ?? parts.findIndex((p) => p.partNumber === result.partNumber),
    partNumber: result.partNumber,
    kind,
    round,
    practiceOnly: result.practiceOnly === true,
    practiceOnlyDerived,
    voided: result.voided === true,
    isCorrect: result.isCorrect,
    answer: result.studentAnswer,
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
// Part states (written to `part_states` and the legacy columns since Phase 3a;
// read from `part_states` since Phase 5, legacy fallback; plan of record §5, D5)
// ============================================================================

/** The plan fields a part's state is read from (`id` names a stale entry in the warning). */
export type PartStateSource = Pick<
  SessionPlan,
  'parts' | 'currentPartIndex' | 'currentSlotIndex' | 'retryState' | 'partStates'
> &
  Partial<Pick<SessionPlan, 'id'>>

/** The part's entry in `part_states`, or undefined when the row has none. */
function storedPartStateOf(plan: PartStateSource, partIndex: number): unknown {
  const states: unknown = plan.partStates
  if (!states || typeof states !== 'object' || Array.isArray(states)) return undefined
  return (states as Record<string, unknown>)[String(partIndex)] ?? undefined
}

/** JSON with sorted keys and undefined members dropped: equality as the column stores it. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/**
 * Whether an arithmetic part's stored entry disagrees with the legacy columns
 * on what they can express: the current part's cursor and retry state; another
 * part's retry state (its slot index is not stored, only inferred).
 */
function contradictsLegacy(
  plan: PartStateSource,
  partIndex: number,
  stored: unknown,
  legacy: ArithmeticState
): boolean {
  const entry = stored as Partial<ArithmeticState> | null
  if (!entry || typeof entry !== 'object') return true
  if (partIndex === plan.currentPartIndex && entry.slotIndex !== legacy.slotIndex) return true
  return canonicalJson(entry.retry) !== canonicalJson(legacy.retry)
}

const warnedStaleParts = new Set<string>()

function warnStalePart(plan: PartStateSource, partIndex: number): void {
  const key = `${plan.id ?? '?'}:${partIndex}`
  if (warnedStaleParts.has(key)) return
  if (warnedStaleParts.size >= 500) warnedStaleParts.clear()
  warnedStaleParts.add(key)
  console.warn(
    '[partStateOf] part_states entry disagrees with the legacy columns; reading legacy',
    {
      planId: plan.id,
      partIndex,
    }
  )
}

/**
 * A part's state (its kind's cursor): its `part_states` entry (Phase 5). A
 * part without one (a row written before Phase 3a, or a part no try has moved
 * since) falls back to `legacyPartStateOf`, which is how Phase 3a read every
 * part.
 *
 * Until Phase 6 an arithmetic entry that disagrees with the legacy columns is
 * stale, and the legacy decode wins (with a warning, once per plan and part).
 * Every writer from 3a on writes both from one state under the row CAS
 * (`partStatePatch`), so a disagreement can only come from an image before 3a,
 * which writes the legacy columns alone and without the CAS: its write was the
 * last, alongside `results`. Trusting the entry there would expect an item the
 * client (which shows the legacy item) never sends: 409 after 409, no heal.
 * The next try rewrites the entry from the legacy state, which heals it.
 * Phase 6 deletes this check with the legacy decode (§10 P5a-8).
 */
export function partStateOf(plan: PartStateSource, partIndex: number): unknown {
  const stored = storedPartStateOf(plan, partIndex)
  if (stored === undefined) return legacyPartStateOf(plan, partIndex)
  if (kindIdOf(plan.parts[partIndex]) !== 'arithmetic') return stored
  const legacy = legacyPartStateOf(plan, partIndex) as ArithmeticState
  if (contradictsLegacy(plan, partIndex, stored, legacy)) {
    warnStalePart(plan, partIndex)
    return legacy
  }
  return stored
}

/**
 * A part's state as Phase 3a read it. Arithmetic parts decode the legacy
 * columns, which every image writes: the current part's cursor is
 * `currentSlotIndex` + `retryState[i]`; a part before it is finished (cursor
 * parked at its end), a part after it not started. Other kinds read
 * `partStates[i]`, else their initial state. The fallback of `partStateOf`;
 * goes with the legacy columns in Phase 6.
 */
export function legacyPartStateOf(plan: PartStateSource, partIndex: number): unknown {
  const part = plan.parts[partIndex]
  if (kindIdOf(part) === 'arithmetic') {
    if (partIndex === plan.currentPartIndex) return arithmeticStateOf(plan, partIndex)
    const state: ArithmeticState = {
      slotIndex: partIndex < plan.currentPartIndex ? (part.slots?.length ?? 0) : 0,
      retry: plan.retryState?.[partIndex],
    }
    return state
  }
  const kind = partKindOf(part)
  return storedPartStateOf(plan, partIndex) ?? kind.initialState(kind.contentOf(part))
}

/**
 * The item the student is on in the plan's current arithmetic part, from that
 * part's state (`partStateOf`: `part_states`, the legacy cursor for a row
 * without it or with a stale entry): what a first or retry
 * try must answer (`recordSlotResult`). The same decision as
 * `resolveCurrentItem`, which the client still feeds from the legacy columns.
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

/** The row fields that store a part's state: `part_states` and its legacy encoding. */
export interface PartStatePatch {
  partStates: Record<string, unknown>
  retryState?: SessionRetryState
  currentSlotIndex?: number
}

/**
 * The fields to write for part `partIndex` after a try: its new state (or
 * `undefined` when the try left it unchanged) and where the session cursor
 * lands (`nextPartIndex`). Arithmetic also writes its legacy encoding exactly
 * as the code before Phase 3a did: `retryState` is always rewritten (a copy,
 * `{}` for a row without one), `currentSlotIndex` is the current part's slot
 * cursor, 0 once the session moves to the next part, untouched for a try in
 * another part.
 */
export function partStatePatch(
  plan: PartStateSource,
  partIndex: number,
  nextState: unknown,
  nextPartIndex: number
): PartStatePatch {
  const changed = nextState !== undefined
  const partStates = changed
    ? { ...(plan.partStates ?? {}), [String(partIndex)]: nextState }
    : { ...(plan.partStates ?? {}) }
  const movedOn = nextPartIndex !== plan.currentPartIndex
  if (kindIdOf(plan.parts[partIndex]) !== 'arithmetic') {
    return movedOn ? { partStates, currentSlotIndex: 0 } : { partStates }
  }
  const state = nextState as ArithmeticState | undefined
  const retryState: SessionRetryState = plan.retryState ? { ...plan.retryState } : {}
  if (state?.retry) retryState[partIndex] = state.retry
  if (movedOn) return { partStates, retryState, currentSlotIndex: 0 }
  if (changed && partIndex === plan.currentPartIndex) {
    return { partStates, retryState, currentSlotIndex: state!.slotIndex }
  }
  return { partStates, retryState }
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
 * `practice-break` game result (in played order), else the four legacy break
 * columns as at most one break. The session report and the song still read
 * this; their move to `plan.breaks` is outside Phase 5a's files (§10 P5a-4).
 */
export function legacyBreaksOf(
  plan: Pick<
    SessionPlan,
    | 'breakStartedAt'
    | 'breakReason'
    | 'breakSelectedGame'
    | 'breakResults'
    | 'flowState'
    | 'currentPartIndex'
  >,
  gameResults: readonly BreakGameResult[] = []
): BreakRecord[] {
  if (gameResults.length > 0) {
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
  const hasBreak =
    plan.breakStartedAt != null ||
    plan.breakReason != null ||
    plan.breakSelectedGame != null ||
    plan.breakResults != null
  if (!hasBreak) return []
  const open =
    plan.flowState === 'break_pending' ||
    plan.flowState === 'break_active' ||
    plan.flowState === 'break_results'
  return [
    {
      breakIndex: 0,
      afterPartIndex: open ? plan.currentPartIndex - 1 : null,
      startedAt: isoOf(plan.breakStartedAt),
      ...(plan.breakReason ? { reason: plan.breakReason } : {}),
      game: plan.breakSelectedGame ?? null,
      results: plan.breakResults ?? null,
      estimated: true,
    },
  ]
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
