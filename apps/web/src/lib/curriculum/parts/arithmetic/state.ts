/**
 * Arithmetic part state: the cursor through a part's slots and its retry
 * rounds, and how a try moves it (session architecture §1.2, Phase 2).
 *
 * A part's state is its `part_states` entry (Phase 3a on). Its legacy
 * encoding, the plan's `current_slot_index` plus `retry_state[partIndex]`, is
 * neither written nor read since Phase 6b-1 (§10 P6b1-3): a part without an
 * entry reads the state its place in the session implies
 * (`unenteredArithmeticStateOf`).
 *
 * Moved here from `db/schema/session-plan-helpers.ts`, which re-exports the
 * plan-level helpers until Phase 5. Every function here is pure.
 *
 * Since practice-kinds K3 the cursor is the shared one
 * (`parts/cursor/retry-rounds.ts`), composed here over the slots: the stored
 * state is byte-identical (its encoding is this kind's old field names), and
 * a queued retry still carries the slot's `problem` and `originalPurpose`,
 * which a pre-K3 image reads from the queue (`expectedArithmeticItem` there).
 *
 * Client-safe: only `import type` from schema files.
 */

import type {
  GeneratedProblem,
  PartRetryState,
  ProblemSlot,
  RetryItem,
  SessionPlan,
} from '@/db/schema/session-plans'
import {
  DEFAULT_MAX_ROUNDS,
  type QueuedRetry,
  type RetryRoundItem,
  retryRoundsCursor,
} from '../cursor/retry-rounds'

/** Maximum number of retry epochs (original + 2 retries = 3 total attempts) */
export const MAX_RETRY_EPOCHS = DEFAULT_MAX_ROUNDS

/** An arithmetic part's content: its slots. */
export type ArithmeticContent = ProblemSlot[]

/** An arithmetic part's cursor (its `part_states` entry). */
export interface ArithmeticState {
  /** Index of the next original slot; parked at `slots.length` during retry rounds */
  slotIndex: number
  /** Absent until the part's first wrong answer */
  retry: PartRetryState | undefined
}

/** The item the student is on: an original slot, or an item of the running retry round. */
export interface ArithmeticItem {
  slotId: string
  originalSlotIndex: number
  /** 0 for the original slot, 1+ for a retry round */
  epochNumber: number
  /** Index into the round's currentEpochItems; null for an original slot */
  retryIndex: number | null
  problem: GeneratedProblem | undefined
  purpose: ProblemSlot['purpose']
}

/** An arithmetic item located in a plan. */
export interface CurrentPlanItem extends ArithmeticItem {
  partIndex: number
}

/** Whether a retry round is running in this part's retry state. */
function isRoundRunning(retry: PartRetryState | undefined): retry is PartRetryState {
  if (!retry) return false
  return retry.currentEpochItems.length > 0 && retry.currentEpoch > 0
}

/** The plan fields an arithmetic part's state is read from. */
export type ArithmeticStateSource = Pick<SessionPlan, 'parts' | 'currentPartIndex'> &
  Partial<Pick<SessionPlan, 'partStates'>>

/**
 * An arithmetic part's state: its `part_states` entry, trusted as it stands
 * (Phase 6b-0 removed the P5a-8 stale check: the stale sessions it guarded
 * were closed by migration 0148), else `unenteredArithmeticStateOf`. An entry
 * that is not an object reads as absent.
 */
export function arithmeticPartStateOf(
  plan: ArithmeticStateSource,
  partIndex: number
): ArithmeticState {
  const states: unknown = plan.partStates
  if (states && typeof states === 'object' && !Array.isArray(states)) {
    const entry: unknown = (states as Record<string, unknown>)[String(partIndex)]
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) return entry as ArithmeticState
  }
  return unenteredArithmeticStateOf(plan, partIndex)
}

/**
 * The state of a part without a `part_states` entry, from its place in the
 * session alone (Phase 6b-1, §10 P6b1-3): a part before the cursor is
 * finished (cursor parked at its end), the cursor's part and a part after it
 * not started. No column is read.
 *
 * Until 6b-1 the cursor's part decoded `current_slot_index` +
 * `retry_state[i]`, and a finished part kept `retry_state[i]`. On every row a
 * live session can have, that is this: the cursor moves into a part with its
 * entry written (6b-1), or with the legacy cursor reset to 0 and no retry
 * state for the new part (6b-0 and before, 3a on); a finished part's retry
 * state is settled (no round running, nothing queued). The rows where it
 * differs are finished sessions from before 3a (0148 closed the open ones),
 * and no view of a finished session reads a part's state (the report has no
 * position; trying is refused): `session-phase6b1-pre3a-parity.test.ts`.
 */
export function unenteredArithmeticStateOf(
  plan: Pick<SessionPlan, 'parts' | 'currentPartIndex'>,
  partIndex: number
): ArithmeticState {
  return {
    slotIndex: partIndex < plan.currentPartIndex ? (plan.parts[partIndex]?.slots?.length ?? 0) : 0,
    retry: undefined,
  }
}

/**
 * Check if we're currently in a retry epoch for the given part
 */
export function isInRetryEpoch(plan: ArithmeticStateSource, partIndex: number): boolean {
  return isRoundRunning(arithmeticPartStateOf(plan, partIndex).retry)
}

/**
 * A slot as the shared cursor sees it: its id, and the slot itself. A retry
 * is shown from its queued entry (`queuedSlotItem`), which may name a slot
 * the part no longer holds at that index: then `slot` is whatever is there.
 */
interface SlotItem {
  itemId: string
  slot: ProblemSlot | undefined
}

const slotItems = (slots: ArithmeticContent): SlotItem[] =>
  slots.map((slot) => ({ itemId: slot.slotId, slot }))

/**
 * The queued retry: the positional fields and, between them as stored before
 * K3, the problem and the slot's purpose (a pre-K3 image shows a retry from
 * the queue, `item.problem`). The key order is the stored bytes.
 */
function queuedRetryOf(shown: RetryRoundItem<SlotItem, RetryItem>, at: QueuedRetry): RetryItem {
  const item = toArithmeticItem(shown)
  return {
    slotId: at.slotId,
    originalSlotIndex: at.originalSlotIndex,
    problem: item.problem!,
    epochNumber: at.epochNumber,
    originalPurpose: item.purpose,
  }
}

/**
 * A retry is the queued entry itself, as before K3: its id and index, its
 * problem and purpose (`toArithmeticItem`), never a lookup of the slot, so a
 * hand-built or stale queue (an id the slot at that index does not carry)
 * shows what it always showed.
 */
function queuedSlotItem(list: readonly SlotItem[], queued: RetryItem): SlotItem {
  return { itemId: queued.slotId, slot: list[queued.originalSlotIndex]?.slot }
}

/** The shared cursor over a part's slots (practice-kinds K3; `arithmeticKind` composes it). */
export const arithmeticCursor = retryRoundsCursor<ArithmeticContent, SlotItem, RetryItem>(
  slotItems,
  { maxRounds: MAX_RETRY_EPOCHS, queue: queuedRetryOf, queuedItemOf: queuedSlotItem }
)

/** The cursor's item as this kind has always shown it: a retry's problem and purpose from the queue. */
function toArithmeticItem(shown: RetryRoundItem<SlotItem, RetryItem>): ArithmeticItem {
  return {
    slotId: shown.itemId,
    originalSlotIndex: shown.itemIndex,
    epochNumber: shown.round,
    retryIndex: shown.retryIndex,
    problem: shown.queued ? shown.queued.problem : shown.slot!.problem,
    purpose: shown.queued ? shown.queued.originalPurpose : shown.slot!.purpose,
  }
}

/**
 * The one place that decides which item the student is on. Retry-round items
 * redeemed by a do-over are skipped. Null when the part has nothing to show:
 * the current retry round has no unredeemed item left, or the original slots
 * are done and no round is running.
 */
export function expectedArithmeticItem(
  slots: ArithmeticContent,
  state: ArithmeticState
): ArithmeticItem | null {
  const shown = arithmeticCursor.expectedItem(slots, state)
  return shown ? toArithmeticItem(shown) : null
}

/**
 * The item the student is on in the plan's current part. Null when the
 * session is past its last part, or the current part has nothing to show.
 *
 * The client shows this (getCurrentProblemInfo) and the server attributes each
 * try to the same decision through `currentItemOf` (recordSlotResult); both
 * read the part's state through `arithmeticPartStateOf`. Never fork it.
 */
export function resolveCurrentItem(plan: ArithmeticStateSource): CurrentPlanItem | null {
  const partIndex = plan.currentPartIndex
  const part = plan.parts[partIndex]
  if (!part) return null
  const item = expectedArithmeticItem(part.slots, arithmeticPartStateOf(plan, partIndex))
  return item ? { partIndex, ...item } : null
}

/**
 * Get the current problem to display (either from original slots or retry queue)
 */
export function getCurrentProblemInfo(plan: SessionPlan): {
  problem: GeneratedProblem
  isRetry: boolean
  epochNumber: number
  originalSlotIndex: number
  slotId: string
  purpose: 'focus' | 'reinforce' | 'review' | 'challenge'
  partNumber: number
} | null {
  const current = resolveCurrentItem(plan)
  if (!current?.problem) return null
  return {
    problem: current.problem,
    isRetry: current.retryIndex !== null,
    epochNumber: current.epochNumber,
    originalSlotIndex: current.originalSlotIndex,
    slotId: current.slotId,
    purpose: current.purpose,
    partNumber: plan.parts[current.partIndex].partNumber,
  }
}

/**
 * Check if the current part needs retry transition
 */
export function needsRetryTransition(plan: SessionPlan): boolean {
  const partIndex = plan.currentPartIndex
  if (partIndex >= plan.parts.length) return false

  const part = plan.parts[partIndex]
  const state = arithmeticPartStateOf(plan, partIndex)
  const retryState = state.retry

  if (state.slotIndex < part.slots.length) return false

  if (retryState && retryState.pendingRetries.length > 0 && retryState.currentEpoch === 0) {
    return true
  }

  if (
    retryState &&
    retryState.currentEpochItems.length > 0 &&
    retryState.currentRetryIndex >= retryState.currentEpochItems.length &&
    retryState.pendingRetries.length > 0 &&
    retryState.currentEpoch < MAX_RETRY_EPOCHS
  ) {
    return true
  }

  return false
}
