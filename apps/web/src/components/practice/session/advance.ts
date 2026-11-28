/**
 * Where the screen goes after a try (practice-kinds plan §4 K5a-3a, §6.14),
 * kind-blind (K5a-3b): the item a plan shows is the kind's `expectedItem`
 * over the part's state, read through the registry
 * (`expectedItemOf(part, partStateOf(plan, i))`), the same pure call the
 * server makes when it attributes the try. Moved from `redoReturnTarget.ts`,
 * which read arithmetic's `getCurrentProblemInfo`; the decisions are the same.
 */

import { partStateOf } from '@/db/schema/session-plan-normalize'
import type { SessionPlan } from '@/db/schema/session-plans'
import { expectedItemOf } from '@/lib/curriculum/parts/registry'
import type { ItemPosition, ShownItem } from './sessionKind'

/** The item the plan's current part shows, with its position; null when it shows none. */
export function shownItemOf(
  plan: Pick<SessionPlan, 'parts' | 'currentPartIndex' | 'partStates'>
): ShownItem | null {
  const partIndex = plan.currentPartIndex
  const part = plan.parts[partIndex]
  if (!part) return null
  const expected = expectedItemOf(part, partStateOf(plan, partIndex))
  return expected ? { partIndex, ...expected } : null
}

/** What became of the do-over's write. */
export type RedoWriteOutcome =
  /** Not sent (the part has no such item) */
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
  targetAtSubmit: ShownItem | null
): ShownItem | null {
  if (!outcome.recorded) return targetAtSubmit
  const after = outcome.plan
  if (!after) return null
  if (after.currentPartIndex !== before.currentPartIndex) return null
  if ((after.flowState ?? 'practicing') !== (before.flowState ?? 'practicing')) return null
  return shownItemOf(after)
}

/**
 * Where a try that waited for its write goes next (a retry round's item, a
 * part's last item, a skip): the item the server's plan shows, when it is
 * another item in the answered item's part and round. Derived from the
 * returned plan alone, so the screen never waits for a render to learn where
 * the kid is (practice-kinds §6.14).
 *
 * Null hands off to the session state (load whatever the plan shows): the
 * write was dropped or failed (`after` null; the page resyncs), the part
 * ended (a transition, a break, the end), a new round starts (its own screen
 * first), or the plan shows the answered item again.
 */
export function chooseAdvanceTarget(
  answered: ItemPosition,
  after: SessionPlan | null
): ShownItem | null {
  if (!after) return null
  if (after.currentPartIndex !== answered.partIndex) return null
  if ((after.flowState ?? 'practicing') !== 'practicing') return null
  const shown = shownItemOf(after)
  if (!shown || shown.round !== answered.round) return null
  if (shown.itemId === answered.itemId) return null
  return shown
}
