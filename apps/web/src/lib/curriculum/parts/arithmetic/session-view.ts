/**
 * What the session screens read of an arithmetic part (session architecture
 * §1.2, "UI lives in a client-only module"; Phase 5b).
 *
 * Structural screens (the practice page, its HUD, the observer broadcast)
 * know a session by its parts, the server's `flowState` and the report's
 * `position`. They never read an arithmetic part's slots or the legacy
 * encoding of its cursor (`currentSlotIndex`, `retryState`, §1.1): where they
 * show something only arithmetic has (its per-slot dots, a problem's number
 * in the dots, the size of a retry round, the observer's dots), they
 * ask this module.
 *
 * The cursor is read through `partStateOf`, so it follows the server's read
 * of `part_states` (Phase 5a), with the legacy decode only for a part
 * without an entry (Phase 6b-0).
 *
 * Client-safe: no drizzle, no server imports.
 */

import { isValidPracticeTypeId } from '@/constants/practiceTypes'
import { getSlotRetryStatus, sameProblem } from '@/db/schema/session-plan-helpers'
import { partStateOf } from '@/db/schema/session-plan-normalize'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPartType,
  SessionPlan,
} from '@/db/schema/session-plans'
import type { ObserverPosition, PracticeItemRef } from '@/lib/classroom/socket-events'
import { arithmeticPresentations } from './presentations'
import { arithmeticPresentationOf } from './server'
import type { ArithmeticState } from './state'

/** The plan fields this module reads (position through `partStateOf`). */
export type ArithmeticViewPlan = Pick<
  SessionPlan,
  'id' | 'parts' | 'currentPartIndex' | 'partStates' | 'results'
>

/** The item on the kid's screen, as the session screens name it. */
export interface OnScreenItem extends PracticeItemRef {
  /** A do-over of an earlier item (tapped on its dot), not the item the plan expects */
  doOver: boolean
}

function slotsOf(part: SessionPart | undefined): readonly ProblemSlot[] {
  return part?.slots ?? []
}

/** The original slot cursor of a part (parked at its end during retry rounds). */
function cursorOf(plan: ArithmeticViewPlan, partIndex: number): number {
  if (!plan.parts[partIndex]) return 0
  const state = partStateOf(plan, partIndex) as ArithmeticState | undefined
  return state?.slotIndex ?? 0
}

/** The slot at `slotIndex` of part `partIndex`. */
export function arithmeticSlotAt(
  parts: readonly SessionPart[],
  partIndex: number,
  slotIndex: number
): ProblemSlot | undefined {
  return slotsOf(parts[partIndex])[slotIndex]
}

/** The slot an item names in a part, with its index; null when the part has no such item. */
export function arithmeticSlotOf(
  part: SessionPart | undefined,
  itemId: string
): { slotIndex: number; slot: ProblemSlot } | null {
  const slots = slotsOf(part)
  const slotIndex = slots.findIndex((s) => s.slotId === itemId)
  return slotIndex < 0 ? null : { slotIndex, slot: slots[slotIndex] }
}

/**
 * The slot whose problem this is, in part `partIndex` (a problem sliding off
 * the screen carries its problem, not its slot); undefined when none matches.
 */
export function arithmeticSlotOfProblem(
  parts: readonly SessionPart[],
  partIndex: number,
  problem: Pick<GeneratedProblem, 'terms' | 'answer'>
): ProblemSlot | undefined {
  return slotsOf(parts[partIndex]).find((s) => sameProblem(s.problem, problem))
}

/** The dots' coordinate: a slot's 0-based index across every part's slots. */
export function arithmeticLinearIndex(
  parts: readonly SessionPart[],
  partIndex: number,
  slotIndex: number
): number {
  let index = 0
  for (let i = 0; i < partIndex && i < parts.length; i++) index += slotsOf(parts[i]).length
  return index + slotIndex
}

/**
 * The original slot cursor of the plan's current part (through `partStateOf`):
 * what the legacy `currentSlotIndex` column held, for the structural readers
 * that still name it (the classroom's active sessions, trace logs).
 */
export function arithmeticCursorSlotIndex(plan: ArithmeticViewPlan): number {
  return cursorOf(plan, plan.currentPartIndex)
}

/** The dots' index of the plan's cursor: the "current" dot, and "Back to #N" from a do-over. */
export function arithmeticCursorLinearIndex(plan: ArithmeticViewPlan): number {
  return arithmeticLinearIndex(
    plan.parts,
    plan.currentPartIndex,
    cursorOf(plan, plan.currentPartIndex)
  )
}

/** An item's 1-based number in the dots; null when part `partIndex` has no such item. */
export function arithmeticItemNumber(
  parts: readonly SessionPart[],
  partIndex: number,
  itemId: string
): number | null {
  const found = arithmeticSlotOf(parts[partIndex], itemId)
  return found ? arithmeticLinearIndex(parts, partIndex, found.slotIndex) + 1 : null
}

/**
 * Tries recorded for an item so far (practice-only do-overs included: they are
 * tries); 0 when part `partIndex` has no such item. The video timeline's
 * attempt number is this plus one.
 */
export function arithmeticTryCount(
  plan: Pick<SessionPlan, 'parts' | 'results'>,
  partIndex: number,
  itemId: string
): number {
  const found = arithmeticSlotOf(plan.parts[partIndex], itemId)
  if (!found) return 0
  return getSlotRetryStatus(plan as SessionPlan, partIndex, found.slotIndex).attemptCount
}

/** Slots planned across the session (the dots' count). */
export function arithmeticSlotTotal(parts: readonly SessionPart[]): number {
  return parts.reduce((sum, part) => sum + slotsOf(part).length, 0)
}

/** Items in the retry round running in part `partIndex` (the retry intro's count); 0 when none runs. */
export function arithmeticRetryRoundSize(plan: ArithmeticViewPlan, partIndex: number): number {
  const state = plan.parts[partIndex]
    ? (partStateOf(plan, partIndex) as ArithmeticState | undefined)
    : undefined
  return state?.retry?.currentEpochItems?.length ?? 0
}

/** The props of the arithmetic dots (`SessionProgressIndicator`) for a plan. */
export interface ArithmeticDotsPosition {
  parts: SessionPart[]
  results: SessionPlan['results']
  currentPartIndex: number
  currentSlotIndex: number
}

export function arithmeticDotsPosition(plan: ArithmeticViewPlan): ArithmeticDotsPosition {
  return {
    parts: plan.parts,
    results: plan.results,
    currentPartIndex: plan.currentPartIndex,
    currentSlotIndex: cursorOf(plan, plan.currentPartIndex),
  }
}

/**
 * The position fields of a `practice-state` broadcast, from the server's plan
 * and the item on the kid's screen: the plan's parts and tries (the observer's
 * dots and its try list, the stats feed) and `currentItem`, the item on screen
 * (a do-over's own item, else the one the plan expects), by which observers
 * place the current dot (`arithmeticObserverDotsOf`).
 */
export function arithmeticObserverPosition(
  plan: ArithmeticViewPlan,
  item: OnScreenItem | null
): ObserverPosition {
  return {
    sessionParts: plan.parts,
    slotResults: plan.results,
    ...(item ? { currentItem: { partIndex: item.partIndex, itemId: item.itemId } } : {}),
  }
}

/** How the transition screen shows an arithmetic part. */
export interface ArithmeticTransitionView {
  kind: 'arithmetic'
  label: string
  emoji: string
  /** Abacus parts are worked on the physical abacus */
  needsPhysicalAbacus: boolean
  /**
   * The arithmetic presentation, which picks the screen's message; absent
   * for one this image does not register (the screen's plain headline)
   */
  presentation?: SessionPartType
}

/**
 * Label and emoji from the part's presentation (`presentationOf`'s id:
 * `presentation`, else `type`; `presentations.ts`).
 *
 * The physical abacus (amendment A10, decided in K3): the screen keeps
 * asking whether the presentation is `abacus`, not the presentation's
 * `needsPhysicalAbacus(part)`. They differ only for a linear part on the
 * ramp (`useAbacus`), where the presentation's answer would newly show
 * "Grab your abacus" (and drop "Put your abacus away" after an abacus
 * part): a change the kid sees, which K3 may not make. Switching is the
 * owner's call, with the screen's move onto the registry (K5b).
 */
export function arithmeticTransitionView(
  part: Pick<SessionPart, 'type'> & Partial<Pick<SessionPart, 'presentation'>>
): ArithmeticTransitionView {
  const id = arithmeticPresentationOf(part)
  const presentation = arithmeticPresentations.get(id)
  return {
    kind: 'arithmetic',
    label: presentation?.label ?? id,
    emoji: presentation?.emoji ?? '⭐',
    needsPhysicalAbacus: id === 'abacus',
    ...(presentation && isValidPracticeTypeId(id) ? { presentation: id } : {}),
  }
}
