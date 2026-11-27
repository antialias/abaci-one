/**
 * The only reader of a stored try's legacy fields (`isRetry`, `epochNumber`,
 * `isManualRedo`, `originalSlotIndex`) outside the writers (session
 * architecture §7 Phase 6a). Part of the normalizer: `normalizeTry` derives a
 * legacy row's try record from these, and every reader that needs a row's
 * kind, round or item position without a whole plan (BKT evidence, readiness,
 * the linear gate, the weight rule) asks here instead of reading the fields.
 *
 * A row recorded from Phase 1 on carries the stamps (`kind`, `round`), so it
 * reads the same with or without the legacy fields; that is what lets Phase
 * 6(b) stop writing them (`src/test/legacy-try-fields-gate.test.ts` keeps
 * every other read out).
 *
 * Why the legacy readings are exact on every stored row: since the retry
 * system (`0bbd5c54d`, 2025-12-29) the server has stamped
 * `isRetry: epochNumber > 0` on every first try and retry, and since do-overs
 * (`e91f06a79`, 2026-01-13) `isManualRedo: true, isRetry: false,
 * epochNumber: 0` on every do-over; rows from before carry none of them (§10
 * P6a-1).
 *
 * No runtime imports (client-safe, and no cycle with the helpers or the weight
 * rule, which both read it).
 */

import type { SlotResult, TryKind } from './session-plans'

/** The fields a row's kind and round are read from */
export type TryKindFields = Pick<
  SlotResult,
  'kind' | 'round' | 'isRetry' | 'epochNumber' | 'isManualRedo'
>

/**
 * A row's kind from the row alone: the stamp, else the legacy fields (a
 * do-over flag wins; a retry flag or a retry round > 0 is a retry). The
 * normalizer also re-reads a legacy duplicate `first` as a do-over, which
 * needs the item's earlier tries (`normalizeTry`); a reader that weighs or
 * filters one row reads it as stored (§10 P1w-1).
 */
export function tryKindOfRow(r: TryKindFields): TryKind {
  if (r.kind) return r.kind
  if (r.isManualRedo) return 'do_over'
  return r.isRetry === true || (r.epochNumber ?? 0) > 0 ? 'retry' : 'first'
}

/**
 * A row's round from the row alone: the stamp (a stamped row without one:
 * first 0, else its retry round), else the legacy retry round. A legacy
 * do-over reads 0 here: its round needs the item's earlier tries, which only
 * `normalizeTry` has.
 */
export function tryRoundOfRow(r: TryKindFields): number {
  if (r.kind) return r.round ?? (r.kind === 'first' ? 0 : (r.epochNumber ?? 0))
  return r.epochNumber ?? 0
}

/** Whether the row is a do-over recorded before Phase 1 (no stamps): its round and practice-only flag are unknown from the row */
export function isUnstampedDoOver(r: TryKindFields): boolean {
  return r.kind == null && r.isManualRedo === true
}

/**
 * The retry round the row was answered in, as the legacy `epochNumber` reads:
 * a retry's round, 0 for a first try or a do-over (a do-over is not a
 * retry-round try, §10 P1-1). A stamped row answers from its stamps; a legacy
 * row from its field, so a row from before the retry system answers
 * undefined, as its missing field did.
 */
export function retryRoundOfRow(r: TryKindFields): number | undefined {
  if (r.kind) return r.kind === 'retry' ? tryRoundOfRow(r) : 0
  return r.epochNumber
}

/**
 * The slot index of the item the row answered, within its part. Before the
 * attribution fix (#238) `slotIndex` could be the cursor's and
 * `originalSlotIndex` the retried item's; every row since stores the item's
 * index in both.
 */
export function itemSlotIndexOfRow(r: Pick<SlotResult, 'slotIndex' | 'originalSlotIndex'>): number {
  return r.originalSlotIndex ?? r.slotIndex
}

/**
 * The legacy fields of a raw JSON projection of a row (SQLite's json_extract
 * gives booleans as 1/0), typed, unread: the BKT evidence query hands them on
 * to `evidenceWeightOf` like the in-JS path hands it the whole row.
 */
export function legacyTryFieldsOfProjection(
  raw: Readonly<Record<string, unknown>>
): Pick<SlotResult, 'isRetry' | 'epochNumber' | 'isManualRedo'> {
  return {
    isRetry: projectedBoolean(raw.isRetry),
    epochNumber: projectedNumber(raw.epochNumber),
    isManualRedo: projectedBoolean(raw.isManualRedo),
  }
}

function projectedNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function projectedBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 1) return true
  if (value === false || value === 0) return false
  return undefined
}
