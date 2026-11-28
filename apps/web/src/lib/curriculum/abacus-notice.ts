/**
 * When the kid is told to pick up or put away the physical abacus (owner's
 * decisions of 2026-11-28, practice-kinds plan §8 A19).
 *
 * The notice belongs right before the part it is about. Between two parts the
 * server runs `part_transition`, then a game break when breaks are on
 * (`session-flow.ts`; both read `breaksEnabled`), so:
 * - with a break, the transition screen carries no notice; the shell shows
 *   it after the break, before the next part's first item;
 * - with no break, the transition screen carries it, as before.
 *
 * Whether a part needs the abacus is its presentation's answer
 * (`needsPhysicalAbacus`, through the registry): "with abacus" always means
 * the physical abacus, so a ramp equations part (`useAbacus`) needs it too.
 *
 * Derived from the plan alone, with no flow state of its own: a reload
 * derives it again.
 *
 * Client-safe and kind-blind: kinds are reached through the registry only.
 */

import { breaksEnabled } from '@/db/schema/session-plan-helpers'
import { normalizeTries } from '@/db/schema/session-plan-normalize'
import type { SessionPlan } from '@/db/schema/session-plans'
import type { StoredPart } from './parts/kind'
import { findPartKind } from './parts/registry'

/** What the kid does with the physical abacus before a part */
export type AbacusNotice = 'pick_up' | 'put_away'

/** Whether the kid works this part on the physical abacus; false for a kind this image does not know. */
export function partNeedsPhysicalAbacus(part: StoredPart): boolean {
  const kind = findPartKind(part)
  if (!kind) return false
  return kind.presentationOf(part).needsPhysicalAbacus(part)
}

/**
 * The notice before part `partIndex`: its need of the abacus against the part
 * before it. None for the first part (nothing to change from), a part the
 * plan does not have, or two parts that need the same.
 */
export function abacusNoticeBefore(
  plan: Pick<SessionPlan, 'parts'>,
  partIndex: number
): AbacusNotice | null {
  if (partIndex <= 0) return null
  const previous = plan.parts[partIndex - 1]
  const next = plan.parts[partIndex]
  if (!previous || !next) return null
  const before = partNeedsPhysicalAbacus(previous)
  const after = partNeedsPhysicalAbacus(next)
  if (before === after) return null
  return after ? 'pick_up' : 'put_away'
}

/** The notice the transition screen into part `partIndex` shows: none when a break follows it. */
export function abacusNoticeOnTransition(
  plan: Pick<SessionPlan, 'parts' | 'gameBreakSettings'>,
  partIndex: number
): AbacusNotice | null {
  if (breaksEnabled(plan)) return null
  return abacusNoticeBefore(plan, partIndex)
}

/**
 * The notice the shell shows before the current part's first item: while
 * practicing a part whose gap ran a break (played, skipped or timed out: each
 * leaves its record, `afterPartIndex`) and which has no tries yet. Once the
 * kid has answered in the part there is none, so a reload after the first
 * answer does not show it again; a reload before it does.
 */
export function abacusNoticeAfterBreak(
  plan: Pick<SessionPlan, 'id' | 'parts' | 'results' | 'breaks' | 'flowState' | 'currentPartIndex'>
): AbacusNotice | null {
  if ((plan.flowState ?? 'practicing') !== 'practicing') return null
  const partIndex = plan.currentPartIndex
  const breaks = Array.isArray(plan.breaks) ? plan.breaks : []
  if (!breaks.some((b) => b.afterPartIndex === partIndex - 1)) return null
  const tries = normalizeTries(plan.id, plan.parts ?? [], plan.results ?? [])
  if (tries.some((t) => t.partIndex === partIndex)) return null
  return abacusNoticeBefore(plan, partIndex)
}
