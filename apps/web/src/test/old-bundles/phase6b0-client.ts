/**
 * The Phase 6b-0 client's position and break logic, copied verbatim from the
 * 6b-0 bundle (`5bf8a911d`), for the old-bundle check in
 * `session-phase6b1-mixed-pod.test.ts` (§10 P6b1-16). Do not edit the copied
 * blocks: they are what a tab still running 6b-0 does with the plan the 6b-1
 * routes send.
 *
 * - `apps/web/src/lib/curriculum/parts/arithmetic/state.ts` lines 25-199:
 *   `MAX_RETRY_EPOCHS` .. `isRoundRunning`, `ArithmeticStateSource`,
 *   `arithmeticPartStateOf` (an entry, else the legacy decode),
 *   `legacyArithmeticStateOf`, `isInRetryEpoch`, `arithmeticStateOf`,
 *   `expectedArithmeticItem`, `resolveCurrentItem`, `getCurrentProblemInfo`.
 * - `apps/web/src/db/schema/session-plan-normalize.ts` lines 388-431:
 *   `CurrentBreakSource`, `CurrentBreak`, `currentBreakOf`.
 * - `apps/web/src/app/practice/[studentId]/PracticeClient.tsx` lines 241-257:
 *   the break expressions, in `phase6b0BreakView` (the setters taken out).
 *
 * `SessionPlan` here is the plan as 6b-0 typed it: the legacy fields included.
 */

import type {
  BreakRecord,
  SessionPlan as CurrentSessionPlan,
  GeneratedProblem,
  PartRetryState,
  ProblemSlot,
  SessionRetryState,
} from '@/db/schema/session-plans'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'

export type SessionPlan = CurrentSessionPlan & {
  currentSlotIndex: number
  retryState: SessionRetryState | null
}

// ---- state.ts lines 25-199, verbatim ----
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

/** The plan fields an arithmetic part's state is read from. */
export type ArithmeticStateSource = Pick<
  SessionPlan,
  'parts' | 'currentPartIndex' | 'currentSlotIndex' | 'retryState'
> &
  Partial<Pick<SessionPlan, 'partStates'>>

/**
 * An arithmetic part's state: its `part_states` entry, else (a row written
 * before Phase 3a, or a part no try has moved since) the legacy decode. An
 * entry is trusted as it stands (Phase 6b-0 removed the P5a-8 stale check:
 * the stale sessions it guarded were closed by migration 0148). An entry that
 * is not an object reads as absent.
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
  return legacyArithmeticStateOf(plan, partIndex)
}

/**
 * The legacy decode, for a part without a `part_states` entry: the current
 * part's cursor is `currentSlotIndex` + `retryState[i]`; a part before it is
 * finished (cursor parked at its end), a part after it not started. The only
 * reader of those two columns; it goes with them in Phase 6b-2.
 */
export function legacyArithmeticStateOf(
  plan: Pick<SessionPlan, 'parts' | 'currentPartIndex' | 'currentSlotIndex' | 'retryState'>,
  partIndex: number
): ArithmeticState {
  if (partIndex === plan.currentPartIndex) return arithmeticStateOf(plan, partIndex)
  return {
    slotIndex: partIndex < plan.currentPartIndex ? (plan.parts[partIndex]?.slots?.length ?? 0) : 0,
    retry: plan.retryState?.[partIndex],
  }
}

/**
 * Check if we're currently in a retry epoch for the given part
 */
export function isInRetryEpoch(plan: ArithmeticStateSource, partIndex: number): boolean {
  return isRoundRunning(arithmeticPartStateOf(plan, partIndex).retry)
}

/** The current part's state, decoded from the plan's legacy position columns (`legacyArithmeticStateOf`). */
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

// ---- session-plan-normalize.ts lines 388-431, verbatim ----
/** The plan fields the break the kid is in is read from. */
export type CurrentBreakSource = Pick<SessionPlan, 'flowState'> & {
  flowUpdatedAt?: Date | string | number | null
  breaks?: readonly BreakRecord[] | null
}

/** The break the kid is in: when it started, its game, and the results it ended with. */
export interface CurrentBreak {
  startedAt: Date | string | number | null
  game: string | null
  results: GameResultsReport | null
}

/**
 * The break the kid is in, from the new columns only (Phase 6b-0); null
 * outside the break states.
 *
 * - `break_pending`: the break has no record yet (BREAK_STARTED, or a skip
 *   before it starts, appends it; §10 P5a-3). It started when the flow
 *   entered `break_pending`, which is `flowUpdatedAt` (§10 P6b-3): the same
 *   instant every writer from 3a on stamped as `breakStartedAt`.
 * - `break_active`: the open record.
 * - `break_results`: the last record, closed with the game's results.
 *
 * A break state with no record to read (a break an image before 3a opened)
 * reads `flowUpdatedAt`, with no game or results.
 */
export function currentBreakOf(plan: CurrentBreakSource): CurrentBreak | null {
  const state = plan.flowState
  if (state !== 'break_pending' && state !== 'break_active' && state !== 'break_results') {
    return null
  }
  const pending: CurrentBreak = {
    startedAt: plan.flowUpdatedAt ?? null,
    game: null,
    results: null,
  }
  if (state === 'break_pending') return pending
  const breaks = Array.isArray(plan.breaks) ? plan.breaks : []
  const last = breaks[breaks.length - 1]
  if (!last) return pending
  if (state === 'break_active' && last.endedAt !== undefined) return pending
  return { startedAt: last.startedAt, game: last.game ?? null, results: last.results ?? null }
}

// ---- PracticeClient.tsx lines 241-257, the break reads ----
export function phase6b0BreakView(currentPlan: SessionPlan) {
  const flowState = currentPlan.flowState ?? 'practicing'
  const showGameBreak = flowState === 'break_pending' || flowState === 'break_active'
  const showGameBreakResults = flowState === 'break_results'
  const currentBreak = currentBreakOf(currentPlan)
  const currentBreakStartMs =
    currentBreak?.startedAt != null ? new Date(currentBreak.startedAt).getTime() : null
  const persistedBreakResults = currentBreak?.results ?? null
  return {
    showGameBreak,
    showGameBreakResults,
    // useEffect: if (showGameBreak && currentBreakStartMs != null && !isNaN) setGameBreakStartTime(...)
    gameBreakStartTime:
      showGameBreak && currentBreakStartMs != null && !Number.isNaN(currentBreakStartMs)
        ? currentBreakStartMs
        : null,
    persistedResults: showGameBreakResults ? persistedBreakResults : null,
  }
}
