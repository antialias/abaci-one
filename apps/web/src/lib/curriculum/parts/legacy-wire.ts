/**
 * The seam between the recorder and the legacy try actions (practice-kinds
 * §3.3, K2, amendment A12).
 *
 * `record` and `record_redo` carry one kind's body by wire: every bundle
 * before K4 sends them, and they were only ever arithmetic's. Turning that
 * body into the row's fields and locating its try by content is therefore
 * the kind's (`arithmetic/legacy-wire.ts`). The recorder (`record-try.ts`)
 * calls it through this interface and names no kind; this file is the one
 * place structure binds the legacy actions to a kind, as `registry.ts` binds
 * part ids to kinds. New kinds use `record_try` and never touch it.
 */

import type { SessionPlan, SlotResult, TryKind, TryOutcome } from '@/db/schema/session-plans'
import { arithmeticLegacyWire } from './arithmetic/legacy-wire'

/** A legacy body after its shape is gone: what the recorder reads of it. */
export interface LegacyTry {
  mode: 'first_or_retry' | 'do_over'
  tryId: string | undefined
  /**
   * The row's own fields from the body: the server's stamps, the legacy try
   * fields and the superset envelope removed, timing sanitized (#156)
   */
  fields: Partial<SlotResult>
  /** The body's explicit outcome (superset), else read from the legacy body */
  outcome: TryOutcome
  /** null unless answered */
  answer: unknown
  /** The item the body named, for logs */
  submittedItemId: string | undefined
}

/** Where a legacy try goes, once located and checked. */
export interface LegacyLocated {
  partIndex: number
  itemId: string
  tryKind: TryKind
  round: number
  practiceOnly: boolean
  /** The kind's top-level fields for the row, beside the body's */
  snapshot: Partial<SlotResult>
}

/**
 * The legacy actions' half of the recorder. `locate` throws the recorder's
 * refusals (`record-try-errors.ts`); a resubmit of a try recorded without a
 * `tryId` (clients from before Phase 1) is the row already stored.
 */
export interface LegacyWire<Body, T extends LegacyTry> {
  normalize(body: Body): T
  locate(plan: SessionPlan, t: T): LegacyLocated | { duplicate: SlotResult }
}

export const legacyWire = arithmeticLegacyWire

export type { LegacySubmission, RedoContext, RedoSubmission } from './arithmetic/legacy-wire'
