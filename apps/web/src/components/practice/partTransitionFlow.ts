/**
 * The part-transition screen renders from the server's `flowState` (session
 * architecture plan of record, Phase 3c), not from a change of
 * `currentPartIndex` the tab happened to see. So a tab reloaded during a
 * transition shows the screen and completes the transition.
 *
 * Completing it is one `PART_TRANSITION_COMPLETED` per (transition, flow
 * version, completion request). A stale token refetches the plan; when the
 * fresh plan is still in the same transition at a newer version, that is a new
 * token and the event goes again with it. Ordering comes from the refetch (a
 * React Query invalidation), never a timer.
 */

import type { SessionPlan } from '@/db/schema/session-plans'

/**
 * Which transition the plan is in: the plan and the part about to start. Null
 * when the plan is not in `part_transition`, or names no part to start.
 */
export function partTransitionKey(
  plan: Pick<SessionPlan, 'id' | 'flowState' | 'currentPartIndex' | 'parts'>
): string | null {
  if (plan.flowState !== 'part_transition') return null
  if (plan.currentPartIndex < 0 || plan.currentPartIndex >= plan.parts.length) return null
  return `${plan.id}:${plan.currentPartIndex}`
}

/**
 * The kid's screen asked to finish a transition: its countdown ran out, or the
 * kid tapped to go on. `n` counts the asks for this transition, so a tap after
 * a failed completion asks again.
 */
export interface TransitionCompletionRequest {
  key: string
  n: number
}

/** The next ask for `key`, after `previous`. */
export function nextCompletionRequest(
  previous: TransitionCompletionRequest | null,
  key: string
): TransitionCompletionRequest {
  return { key, n: previous?.key === key ? previous.n + 1 : 1 }
}

/**
 * The token of the `PART_TRANSITION_COMPLETED` to send now, or null.
 *
 * Sends only for the transition the plan is in, once the screen asked, while
 * no completion is in flight, and never twice for one token. The token holds
 * the flow version, so a refetch that moved the version (a stale token) sends
 * again with the fresh one, and a refetch that did not (the server could not
 * write it) waits for the kid to ask again.
 */
export function transitionCompletionToSend(args: {
  key: string | null
  flowVersion: number
  request: TransitionCompletionRequest | null
  inFlight: boolean
  sent: string | null
}): string | null {
  const { key, flowVersion, request, inFlight, sent } = args
  if (!key || !request || request.key !== key || inFlight) return null
  const token = `${key}@${flowVersion}#${request.n}`
  return token === sent ? null : token
}
