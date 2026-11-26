/**
 * How much a try counts as mastery evidence (session architecture §1.2).
 *
 * The server stamps `masteryWeight = weightOfTry(...)` on every row it records;
 * readers keep `masteryWeight ?? 1.0` and never refold history. Phase 1
 * reproduces today's stored numbers exactly, on new rows as on old:
 * - a correct first try 1, a correct retry of round r 1/2^r
 *   (`calculateMasteryWeight`);
 * - a correct do-over of a once-wrong item 1.0, as `recordRedoResult` has always
 *   stored it (the plan's 1/2^round for do-overs is Phase 1w, behind the owner's
 *   re-baseline table; §10 P1-9);
 * - any wrong try 0, so it never lowers pKnown (changing that is Phase 1w, §8 Q10);
 * - a practice-only do-over (of an item already answered correctly) 0.
 *
 * Client-safe: no server imports.
 */

import { calculateMasteryWeight } from '@/db/schema/session-plan-helpers'
import type { TryKind } from '@/db/schema/session-plans'

export interface TryWeightInput {
  kind: TryKind
  /** first 0; retry 1..MAX; do_over = prior non-practiceOnly tries of the item */
  round: number
  isCorrect: boolean
  practiceOnly: boolean
}

export function weightOfTry(t: TryWeightInput): number {
  if (t.practiceOnly) return 0
  // Only a retry's round scales its weight today; first tries and do-overs weigh as round 0
  return calculateMasteryWeight(t.isCorrect, t.kind === 'retry' ? t.round : 0)
}
