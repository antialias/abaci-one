import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { getCurrentProblemInfo } from '@/lib/curriculum/parts/arithmetic/state'

/** The problem a submit slides to next. */
export type TransitionTarget = {
  problem: SlotResult['problem']
  slotIndex: number
  partIndex: number
  /** Retry round of the problem (0 = original slot) */
  epochNumber: number
}

/** What became of the do-over's write. */
export type RedoWriteOutcome =
  /** Not sent (the original was correct: pure practice) */
  | { recorded: false }
  /** Sent; `plan` is the server's answer, or null when the write failed or was dropped */
  | { recorded: true; plan: SessionPlan | null }

/**
 * Where to return after a do-over. A recorded do-over can redeem the current
 * retry item, start the next round, end the part or complete the session, so
 * the target comes from the server's plan, not the one on screen at submit.
 * Null means hand off to the session state (load whatever the plan shows).
 */
export function chooseRedoReturnTarget(
  before: Pick<SessionPlan, 'currentPartIndex' | 'flowState'>,
  outcome: RedoWriteOutcome,
  targetAtSubmit: TransitionTarget | null
): TransitionTarget | null {
  if (!outcome.recorded) return targetAtSubmit
  const after = outcome.plan
  if (!after) return null
  if (after.currentPartIndex !== before.currentPartIndex) return null
  if ((after.flowState ?? 'practicing') !== (before.flowState ?? 'practicing')) return null
  const shown = getCurrentProblemInfo(after)
  if (!shown) return null
  return {
    problem: shown.problem,
    slotIndex: shown.originalSlotIndex,
    partIndex: after.currentPartIndex,
    epochNumber: shown.epochNumber,
  }
}
