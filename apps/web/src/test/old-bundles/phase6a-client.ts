/**
 * The Phase 6a client's position and break logic, copied verbatim from the
 * 6a bundle (`1e05531f5`), for the old-bundle check in
 * `session-phase6b1-mixed-pod.test.ts` (§10 P6b1-16). Do not edit the copied
 * blocks: they are what a tab still running 6a does with the plan the 6b-1
 * routes send.
 *
 * - `apps/web/src/lib/curriculum/parts/arithmetic/state.ts` lines 24-156:
 *   `MAX_RETRY_EPOCHS` .. `isRoundRunning`, `isInRetryEpoch`,
 *   `arithmeticStateOf`, `expectedArithmeticItem`, `resolveCurrentItem`,
 *   `getCurrentProblemInfo` (what the practice screen shows).
 * - `apps/web/src/db/schema/session-plan-normalize.ts` lines 211-318:
 *   `PartStateSource` .. `canonicalJson`, `contradictsLegacy`,
 *   `warnStalePart`, `partStateOf` (with the P5a-8 stale check: the legacy
 *   fields win over a disagreeing entry), `legacyPartStateOf` (the progress
 *   dots and the observer position read parts through it).
 * - `apps/web/src/app/practice/[studentId]/PracticeClient.tsx` lines 240-253:
 *   the break expressions, in `phase6aBreakView` (the effects' reads, the
 *   setters taken out).
 *
 * `SessionPlan` here is the plan as 6a typed it: the legacy fields included.
 */

import type {
  SessionPlan as CurrentSessionPlan,
  GeneratedProblem,
  PartRetryState,
  ProblemSlot,
  SessionRetryState,
} from '@/db/schema/session-plans'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import { kindIdOf, partKindOf } from '@/lib/curriculum/parts/registry'

export type SessionPlan = CurrentSessionPlan & {
  currentSlotIndex: number
  retryState: SessionRetryState | null
  breakStartedAt: Date | string | number | null
  breakResults: GameResultsReport | null
}

// ---- state.ts lines 24-156, verbatim ----
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

// ---- session-plan-normalize.ts lines 211-318, verbatim ----
/** The plan fields a part's state is read from (`id` names a stale entry in the warning). */
export type PartStateSource = Pick<
  SessionPlan,
  'parts' | 'currentPartIndex' | 'currentSlotIndex' | 'retryState' | 'partStates'
> &
  Partial<Pick<SessionPlan, 'id'>>

/** The part's entry in `part_states`, or undefined when the row has none. */
function storedPartStateOf(plan: PartStateSource, partIndex: number): unknown {
  const states: unknown = plan.partStates
  if (!states || typeof states !== 'object' || Array.isArray(states)) return undefined
  return (states as Record<string, unknown>)[String(partIndex)] ?? undefined
}

/** JSON with sorted keys and undefined members dropped: equality as the column stores it. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/**
 * Whether an arithmetic part's stored entry disagrees with the legacy columns
 * on what they can express: the current part's cursor and retry state; another
 * part's retry state (its slot index is not stored, only inferred).
 */
function contradictsLegacy(
  plan: PartStateSource,
  partIndex: number,
  stored: unknown,
  legacy: ArithmeticState
): boolean {
  const entry = stored as Partial<ArithmeticState> | null
  if (!entry || typeof entry !== 'object') return true
  if (partIndex === plan.currentPartIndex && entry.slotIndex !== legacy.slotIndex) return true
  return canonicalJson(entry.retry) !== canonicalJson(legacy.retry)
}

const warnedStaleParts = new Set<string>()

function warnStalePart(plan: PartStateSource, partIndex: number): void {
  const key = `${plan.id ?? '?'}:${partIndex}`
  if (warnedStaleParts.has(key)) return
  if (warnedStaleParts.size >= 500) warnedStaleParts.clear()
  warnedStaleParts.add(key)
  console.warn(
    '[partStateOf] part_states entry disagrees with the legacy columns; reading legacy',
    {
      planId: plan.id,
      partIndex,
    }
  )
}

/**
 * A part's state (its kind's cursor): its `part_states` entry (Phase 5). A
 * part without one (a row written before Phase 3a, or a part no try has moved
 * since) falls back to `legacyPartStateOf`, which is how Phase 3a read every
 * part.
 *
 * Until Phase 6 an arithmetic entry that disagrees with the legacy columns is
 * stale, and the legacy decode wins (with a warning, once per plan and part).
 * Every writer from 3a on writes both from one state under the row CAS
 * (`partStatePatch`), so a disagreement can only come from an image before 3a,
 * which writes the legacy columns alone and without the CAS: its write was the
 * last, alongside `results`. Trusting the entry there would expect an item the
 * client (which shows the legacy item) never sends: 409 after 409, no heal.
 * The next try rewrites the entry from the legacy state, which heals it.
 * Phase 6 deletes this check with the legacy decode (§10 P5a-8).
 */
export function partStateOf(plan: PartStateSource, partIndex: number): unknown {
  const stored = storedPartStateOf(plan, partIndex)
  if (stored === undefined) return legacyPartStateOf(plan, partIndex)
  if (kindIdOf(plan.parts[partIndex]) !== 'arithmetic') return stored
  const legacy = legacyPartStateOf(plan, partIndex) as ArithmeticState
  if (contradictsLegacy(plan, partIndex, stored, legacy)) {
    warnStalePart(plan, partIndex)
    return legacy
  }
  return stored
}

/**
 * A part's state as Phase 3a read it. Arithmetic parts decode the legacy
 * columns, which every image writes: the current part's cursor is
 * `currentSlotIndex` + `retryState[i]`; a part before it is finished (cursor
 * parked at its end), a part after it not started. Other kinds read
 * `partStates[i]`, else their initial state. The fallback of `partStateOf`;
 * goes with the legacy columns in Phase 6.
 */
export function legacyPartStateOf(plan: PartStateSource, partIndex: number): unknown {
  const part = plan.parts[partIndex]
  if (kindIdOf(part) === 'arithmetic') {
    if (partIndex === plan.currentPartIndex) return arithmeticStateOf(plan, partIndex)
    const state: ArithmeticState = {
      slotIndex: partIndex < plan.currentPartIndex ? (part.slots?.length ?? 0) : 0,
      retry: plan.retryState?.[partIndex],
    }
    return state
  }
  const kind = partKindOf(part)
  return storedPartStateOf(plan, partIndex) ?? kind.initialState(kind.contentOf(part))
}

// ---- PracticeClient.tsx lines 240-253 (the effects at 244-256), the break reads ----
export function phase6aBreakView(currentPlan: SessionPlan) {
  const flowState = currentPlan.flowState ?? 'practicing'
  const showGameBreak = flowState === 'break_pending' || flowState === 'break_active'
  const showGameBreakResults = flowState === 'break_results'
  // useEffect: if (showGameBreak && currentPlan.breakStartedAt) setGameBreakStartTime(...)
  const gameBreakStartTime =
    showGameBreak && currentPlan.breakStartedAt
      ? new Date(currentPlan.breakStartedAt).getTime()
      : null
  // useEffect: if (!showGameBreakResults) return; const persistedResults = ...
  const persistedResults = showGameBreakResults ? (currentPlan.breakResults ?? null) : null
  return { showGameBreak, showGameBreakResults, gameBreakStartTime, persistedResults }
}
