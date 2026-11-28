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

/**
 * Where a try that waited for its write goes next (a retry round's item, a
 * part's last item): the item the server's plan shows, when it is the next
 * one in the answered item's part and round. Derived from the returned plan
 * alone, through the same pure call the server made, so the screen never
 * waits for a render to learn where the kid is (practice-kinds §6.14).
 *
 * Null hands off to the session state (load whatever the plan shows): the
 * write was dropped or failed (`after` null; the page resyncs), the part
 * ended (a transition, a break, the end), a new round starts (its own screen
 * first), or the plan shows the answered item again.
 */
export function chooseAdvanceTarget(
  answered: { partIndex: number; slotIndex: number; epochNumber: number },
  after: SessionPlan | null
): TransitionTarget | null {
  if (!after) return null
  if (after.currentPartIndex !== answered.partIndex) return null
  if ((after.flowState ?? 'practicing') !== 'practicing') return null
  const shown = getCurrentProblemInfo(after)
  if (!shown || shown.epochNumber !== answered.epochNumber) return null
  if (shown.originalSlotIndex === answered.slotIndex) return null
  return {
    problem: shown.problem,
    slotIndex: shown.originalSlotIndex,
    partIndex: after.currentPartIndex,
    epochNumber: shown.epochNumber,
  }
}
