/**
 * Arithmetic part state: the cursor through a part's slots and its retry
 * rounds, and how a try moves it (session architecture §1.2, Phase 2).
 *
 * The state is the legacy encoding itself (§1.1): the plan's
 * `currentSlotIndex` plus `retryState[partIndex]`. Position is still written
 * to those columns; Phase 3a adds `part_states`.
 *
 * Moved here from `db/schema/session-plan-helpers.ts`, which re-exports the
 * plan-level helpers until Phase 5. Every function here is pure; the moved
 * ones are unchanged.
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

/** Maximum number of retry epochs (original + 2 retries = 3 total attempts) */
export const MAX_RETRY_EPOCHS = 2

/** An arithmetic part's content: its slots. */
export type ArithmeticContent = ProblemSlot[]

/** An arithmetic part's cursor (legacy encoding: `currentSlotIndex` + `retryState[i]`). */
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

/**
 * Check if we're currently in a retry epoch for the given part
 */
export function isInRetryEpoch(plan: Pick<SessionPlan, 'retryState'>, partIndex: number): boolean {
  return isRoundRunning(plan.retryState?.[partIndex])
}

/** A part's state, decoded from the plan's legacy position columns. */
export function arithmeticStateOf(
  plan: Pick<SessionPlan, 'currentSlotIndex' | 'retryState'>,
  partIndex: number
): ArithmeticState {
  return { slotIndex: plan.currentSlotIndex, retry: plan.retryState?.[partIndex] }
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
  const { retry } = state
  if (isRoundRunning(retry)) {
    const items = retry.currentEpochItems
    for (let retryIndex = retry.currentRetryIndex; retryIndex < items.length; retryIndex++) {
      const item = items[retryIndex]
      if (retry.redeemedSlots?.includes(item.originalSlotIndex)) continue
      return {
        slotId: item.slotId,
        originalSlotIndex: item.originalSlotIndex,
        epochNumber: item.epochNumber,
        retryIndex,
        problem: item.problem,
        purpose: item.originalPurpose,
      }
    }
    return null
  }

  const slot = slots[state.slotIndex]
  if (!slot) return null
  return {
    slotId: slot.slotId,
    originalSlotIndex: state.slotIndex,
    epochNumber: 0,
    retryIndex: null,
    problem: slot.problem,
    purpose: slot.purpose,
  }
}

/**
 * The item the student is on in the plan's current part. Null when the
 * session is past its last part, or the current part has nothing to show.
 *
 * The client shows this (getCurrentProblemInfo) and the server attributes each
 * try to it (recordSlotResult). Never fork it.
 */
export function resolveCurrentItem(
  plan: Pick<SessionPlan, 'parts' | 'currentPartIndex' | 'currentSlotIndex' | 'retryState'>
): CurrentPlanItem | null {
  const partIndex = plan.currentPartIndex
  const part = plan.parts[partIndex]
  if (!part) return null
  const item = expectedArithmeticItem(part.slots, arithmeticStateOf(plan, partIndex))
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
  partNumber: 1 | 2 | 3
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
 * Initialize retry state for a part if not already present
 */
export function initRetryState(plan: SessionPlan, partIndex: number): PartRetryState {
  if (!plan.retryState) {
    plan.retryState = {}
  }
  if (!plan.retryState[partIndex]) {
    plan.retryState[partIndex] = emptyRetryState()
  }
  return plan.retryState[partIndex]
}

function emptyRetryState(): PartRetryState {
  return {
    currentEpoch: 0,
    pendingRetries: [],
    currentEpochItems: [],
    currentRetryIndex: 0,
  }
}

/**
 * Check if the current part needs retry transition
 */
export function needsRetryTransition(plan: SessionPlan): boolean {
  const partIndex = plan.currentPartIndex
  if (partIndex >= plan.parts.length) return false

  const part = plan.parts[partIndex]
  const retryState = plan.retryState?.[partIndex]

  if (plan.currentSlotIndex < part.slots.length) return false

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

// ============================================================================
// How a try moves the cursor (pure; recordSlotResult/recordRedoResult write the result)
// ============================================================================

/**
 * Settle a cursor that may have nothing left to show: when the original slots
 * are done and the current retry round has no unredeemed item left, start the
 * next retry round; when none can start, clear the rounds (the part is done,
 * `expectedArithmeticItem` is null).
 */
export function settleArithmetic(
  slots: ArithmeticContent,
  state: ArithmeticState
): ArithmeticState {
  const { slotIndex } = state
  let retry = state.retry
  for (;;) {
    if (expectedArithmeticItem(slots, { slotIndex, retry })) return { slotIndex, retry }
    if (!retry || retry.pendingRetries.length === 0 || retry.currentEpoch >= MAX_RETRY_EPOCHS) {
      break
    }
    // Start the next retry round. Slot index stays at the end (original slots done).
    retry = {
      ...retry,
      currentEpoch: retry.currentEpoch + 1,
      currentEpochItems: [...retry.pendingRetries],
      pendingRetries: [],
      currentRetryIndex: 0,
    }
  }

  // No more retries (all correct, redeemed, or max rounds reached): the part is done.
  if (retry) {
    retry = { ...retry, currentEpochItems: [], currentRetryIndex: 0, pendingRetries: [] }
  }
  return { slotIndex, retry }
}

/**
 * Step past the item just answered (a first try or a retry), then settle. A
 * wrong answer queues the same problem for the next retry round; past the last
 * round it is not re-queued (definitively wrong, the answer is divulged).
 */
export function stepPastItem(
  slots: ArithmeticContent,
  state: ArithmeticState,
  item: ArithmeticItem,
  isCorrect: boolean
): ArithmeticState {
  let retry = state.retry
  if (!isCorrect && item.epochNumber < MAX_RETRY_EPOCHS) {
    const queued: RetryItem = {
      slotId: item.slotId,
      originalSlotIndex: item.originalSlotIndex,
      problem: item.problem!,
      epochNumber: item.epochNumber + 1,
      originalPurpose: item.purpose,
    }
    const base = retry ?? emptyRetryState()
    retry = { ...base, pendingRetries: [...base.pendingRetries, queued] }
  }
  if (item.retryIndex !== null) {
    retry = { ...retry!, currentRetryIndex: item.retryIndex + 1 }
  }
  return settleArithmetic(slots, {
    slotIndex: state.slotIndex + (item.retryIndex === null ? 1 : 0),
    retry,
  })
}

/**
 * A correct do-over of a wrong item redeems it: it leaves the queue and is
 * skipped in a running round. No settle (the caller decides; see
 * `arithmeticKind.applyTry`). Unchanged state (same object) when the part has
 * no retry state.
 */
export function redeemSlot(state: ArithmeticState, slotIndex: number): ArithmeticState {
  const { retry } = state
  if (!retry) return state
  const redeemed = retry.redeemedSlots || []
  return {
    slotIndex: state.slotIndex,
    retry: {
      ...retry,
      pendingRetries: retry.pendingRetries.filter((item) => item.originalSlotIndex !== slotIndex),
      redeemedSlots: redeemed.includes(slotIndex) ? [...redeemed] : [...redeemed, slotIndex],
    },
  }
}
