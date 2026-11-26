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

import { sameProblem } from './session-plan-helpers'
import type { SessionPart, SlotResult, TryKind } from './session-plans'

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
  const slotIndex = result.originalSlotIndex ?? result.slotIndex
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
 * legacy rows derive them: kind from `isManualRedo`/`isRetry`, round from
 * `epochNumber` (do-overs: `doOverStamp`), and a second `first` try of an item
 * (legacy duplicate submit) becomes a derived practice-only do-over.
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
    round = result.round ?? (kind === 'first' ? 0 : (result.epochNumber ?? 0))
    practiceOnlyDerived = result.practiceOnly === true
  } else {
    kind = result.isManualRedo
      ? 'do_over'
      : result.isRetry === true || (result.epochNumber ?? 0) > 0
        ? 'retry'
        : 'first'
    if (kind === 'first' && ofItem.some((t) => t.kind === 'first')) kind = 'do_over'
    if (kind === 'do_over') {
      const stamp = doOverStamp(ofItem)
      round = stamp.round
      practiceOnlyDerived = stamp.practiceOnly
    } else {
      round = result.epochNumber ?? 0
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
