/**
 * The recorder's refusals (practice-kinds K2), shared by `record-try.ts` and
 * the legacy-wire adapter (`parts/arithmetic/legacy-wire.ts`), and
 * re-exported by `record-try.ts` and `session-planner.ts`, where routes and
 * tests import them.
 */

import type { SessionPlan } from '@/db/schema/session-plans'
import type { AnyPartKind, DoOverRefusal } from './parts/kind'
import { findPartKind, kindIdOf } from './parts/registry'

/**
 * Why a try was refused as not the one expected (the 409's `reason`, K2):
 * - `not_current`: a first or retry try for another item than the one shown
 *   next (or for none: the part is done);
 * - `unknown_item`: the try names an item (or part) the plan does not have;
 * - `no_try`: a do-over of an item not yet tried;
 * - `divulged`: a do-over of an item whose answer was shown (R14);
 * - `different_problem`: a legacy do-over whose problem is not its item's;
 * - `not_accepted`: a do-over a kind refuses without naming why.
 */
export type MismatchReason = DoOverRefusal | 'not_current' | 'different_problem' | 'not_accepted'

/**
 * A try was submitted for a different item than the one the server expects
 * next, and it is not a resubmit of the try just recorded; or a do-over the
 * kind does not accept. The client's plan is stale; the route answers 409
 * `SLOT_MISMATCH` (with `reason`) and the client refetches.
 */
export class SlotResultMismatchError extends Error {
  constructor(
    public readonly submittedSlotId: string | undefined,
    public readonly expectedSlotId: string | null,
    public readonly reason: MismatchReason
  ) {
    super(
      `Answer is for slot ${submittedSlotId ?? '(none)'}, but the current problem is ${expectedSlotId ?? '(none)'} (${reason})`
    )
    this.name = 'SlotResultMismatchError'
  }
}

/**
 * A do-over whose `itemId` and indices name different items: a client bug, not
 * a stale plan, so the route answers 400 rather than the quiet 409 refetch
 * that would drop the kid's do-over without a word (§10 P5a-7).
 */
export class MalformedDoOverError extends Error {
  constructor(
    public readonly itemId: string,
    public readonly originalPartIndex: number | undefined,
    public readonly originalSlotIndex: number | undefined
  ) {
    super(
      `Do-over names item ${itemId} but part ${originalPartIndex}, slot ${originalSlotIndex}, which is another slot`
    )
    this.name = 'MalformedDoOverError'
  }
}

/**
 * A first or retry try reached a live session that is not `practicing` (a part
 * transition or a break owns the next step). Nothing is recorded; the route
 * answers 409 `not_practicing` with this plan in the body, and the client
 * applies it, which renders the transition or break screen (plan of record
 * §1.1, Phase 3c).
 */
export class NotPracticingError extends Error {
  readonly code = 'not_practicing'
  constructor(public readonly plan: SessionPlan) {
    super(`The session is in ${plan.flowState}, not practicing; the try was not recorded`)
    this.name = 'NotPracticingError'
  }
}

/** Whether a live session's next step is a transition or a break, which takes no first or retry try. */
export function isLiveButNotPracticing(plan: SessionPlan): boolean {
  return plan.status === 'in_progress' && (plan.flowState ?? 'practicing') !== 'practicing'
}

/**
 * A try for a part whose kind this image does not know (a newer image's part,
 * read after a rollback). Nothing is recorded; the route answers 409
 * `unknown_kind`, which the client resyncs quietly (practice-kinds K2, R14).
 */
export class UnknownKindError extends Error {
  readonly code = 'unknown_kind'
  constructor(public readonly kind: string) {
    super(`Unknown part kind: ${kind.slice(0, 40)}; the try was not recorded`)
    this.name = 'UnknownKindError'
  }
}

/** A `record_try` body that is not a `TrySubmission`: a client bug; the route answers 400. */
export class MalformedTrySubmissionError extends Error {
  readonly code = 'MALFORMED_TRY'
  constructor(reason: string) {
    super(`Malformed try submission: ${reason}`)
    this.name = 'MalformedTrySubmissionError'
  }
}

/** The part's kind, or UnknownKindError (409 `unknown_kind`). */
export function knownKindOf(part: SessionPlan['parts'][number]): AnyPartKind {
  const kind = findPartKind(part)
  if (!kind) throw new UnknownKindError(String(kindIdOf(part)))
  return kind
}
