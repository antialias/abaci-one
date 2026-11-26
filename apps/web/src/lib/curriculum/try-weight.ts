/**
 * How much a try counts as mastery evidence (session architecture §1.2, Phase 1w).
 *
 * A try weighs 1/2^round, right or wrong:
 * - a first try 1;
 * - a retry of round r 1/2^r (0.5, 0.25);
 * - a counted do-over (of an item whose latest counted try was wrong) 1/2^round,
 *   round = the item's earlier counted tries, so the first do-over of a
 *   once-wrong item weighs 0.5 like its first retry (§1.2; deferred from Phase 1
 *   by §10 P1-9);
 * - a practice-only do-over (of an item already answered correctly) 0.
 *
 * A wrong try with a non-zero weight lets BKT's slip update apply
 * (`compute-bkt.ts` blends old and updated pKnown by this weight), so a wrong
 * answer lowers pKnown instead of only failing to raise it (§8 Q10).
 *
 * Retroactive (the owner's decision, §10 P1w-1): the server stamps
 * `masteryWeight = weightOfTry(...)` on every row it records, and every reader
 * weighs a row through `evidenceWeightOf`, which re-derives a wrong row's weight
 * from the row itself instead of trusting the 0 stamped before Phase 1w.
 *
 * Client-safe: no server imports.
 */

import type { SlotResult, TryKind } from '@/db/schema/session-plans'

export interface TryWeightInput {
  kind: TryKind
  /** first 0; retry 1..MAX; do_over = prior non-practiceOnly tries of the item */
  round: number
  /** Not part of the weight since Phase 1w; kept so a caller states the whole try */
  isCorrect: boolean
  practiceOnly: boolean
}

export function weightOfTry(t: TryWeightInput): number {
  if (t.practiceOnly) return 0
  // A first try weighs as round 0 whatever round it carries
  const round = t.kind === 'first' ? 0 : Math.max(0, t.round)
  return 1 / 2 ** round
}

/** The fields of a stored row that its evidence weight reads */
export type WeighedRow = Pick<
  SlotResult,
  | 'isCorrect'
  | 'masteryWeight'
  | 'kind'
  | 'round'
  | 'practiceOnly'
  | 'isRetry'
  | 'epochNumber'
  | 'isManualRedo'
>

/**
 * The weight a stored row carries as evidence, read from the row alone (BKT,
 * the SQL evidence projection, the in-JS history path and the review panel
 * all read it here, so they agree):
 * - practice-only: 0;
 * - correct: the stored weight (`?? 1.0`, as before). Rows recorded before
 *   Phase 1w keep theirs, so a pre-Phase-1 correct do-over stays 1.0: its
 *   round needs the item's earlier tries, which a row does not hold;
 * - wrong: `weightOfTry` of the row's kind and round, whatever was stored. A
 *   row without the Phase 1 stamps takes its kind from the legacy fields
 *   (`isRetry`/`epochNumber` retry, else first) and its round from
 *   `epochNumber`. The exception: a wrong do-over without the Phase 1 stamps
 *   stays 0. Before Phase 1, a redo of an item already answered right was
 *   recorded like any other redo, unstamped, so a row alone cannot tell it
 *   from a failed redemption, and today's rule makes that redo practice-only
 *   (never evidence). Keeping every such row at main's 0 never turns practice
 *   into a slip (review of Phase 1w; §10 P1w-1).
 */
export function evidenceWeightOf(r: WeighedRow): number {
  if (r.practiceOnly === true) return 0
  if (r.isCorrect) return r.masteryWeight ?? 1.0
  if (r.kind == null && r.isManualRedo === true) return 0
  const kind: TryKind =
    r.kind ?? (r.isRetry === true || (r.epochNumber ?? 0) > 0 ? 'retry' : 'first')
  const round = r.round ?? r.epochNumber ?? 0
  return weightOfTry({ kind, round, isCorrect: false, practiceOnly: false })
}
