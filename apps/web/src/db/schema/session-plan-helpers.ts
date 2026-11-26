/**
 * Session Plan Helpers - Client-safe runtime helpers
 *
 * Extracted from session-plans.ts so that client components can import
 * these without pulling in drizzle-orm (which the schema file requires).
 *
 * Rule: This file must NEVER import from drizzle-orm or any module that
 * does at runtime. Only `import type` from schema files is allowed.
 */

import {
  DEFAULT_SECONDS_PER_PROBLEM,
  PART_TIME_WEIGHTS,
  PURPOSE_COMPLEXITY_BOUNDS,
  PURPOSE_WEIGHTS,
  REVIEW_INTERVAL_DAYS,
  SESSION_TIMEOUT_HOURS,
  TERM_COUNT_RANGES,
} from '@/lib/curriculum/config'

import type {
  GameBreakSettings,
  GeneratedProblem,
  PartRetryState,
  ProblemSlot,
  SessionHealth,
  SessionPlan,
  SlotResult,
} from './session-plans'

// ============================================================================
// Constants
// ============================================================================

/** Default game break settings */
export const DEFAULT_GAME_BREAK_SETTINGS: GameBreakSettings = {
  enabled: true,
  maxDurationMinutes: 5,
  selectionMode: 'kid-chooses',
  selectedGame: null,
  gameConfig: undefined,
  skipSetupPhase: true,
  useAdaptiveSelection: false,
}

/**
 * Default configuration for plan generation.
 *
 * All values are imported from @/lib/curriculum/config for centralized tuning.
 * Edit those config files to change these defaults.
 */
export const DEFAULT_PLAN_CONFIG = {
  focusWeight: PURPOSE_WEIGHTS.focus,
  reinforceWeight: PURPOSE_WEIGHTS.reinforce,
  reviewWeight: PURPOSE_WEIGHTS.review,
  challengeWeight: 0.2,

  partTimeWeights: PART_TIME_WEIGHTS,

  abacusTermCount: TERM_COUNT_RANGES.abacus,
  visualizationTermCount: TERM_COUNT_RANGES.visualization,
  linearTermCount: TERM_COUNT_RANGES.linear,

  defaultSecondsPerProblem: DEFAULT_SECONDS_PER_PROBLEM,
  reviewIntervalDays: REVIEW_INTERVAL_DAYS,
  sessionTimeoutHours: SESSION_TIMEOUT_HOURS,

  purposeComplexityBounds: PURPOSE_COMPLEXITY_BOUNDS,
}

export type PlanGenerationConfig = typeof DEFAULT_PLAN_CONFIG

/** Maximum number of retry epochs (original + 2 retries = 3 total attempts) */
export const MAX_RETRY_EPOCHS = 2

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Whether a try counts: everything except a practice-only do-over (a do-over
 * of a problem whose latest counted try was correct, session architecture
 * §1.2). Every reader that turns tries into a verdict, a count, an accuracy, a
 * streak, a timing statistic or mastery evidence reads through this predicate;
 * only lists of individual tries (attempt history) show practice-only rows.
 */
export function isCountedTry(result: Pick<SlotResult, 'practiceOnly'>): boolean {
  return result.practiceOnly !== true
}

/** The tries that count (see `isCountedTry`), in recorded order. */
export function countedTries<T extends Pick<SlotResult, 'practiceOnly'>>(
  results: readonly T[] | null | undefined
): T[] {
  return (results ?? []).filter(isCountedTry)
}

export interface TryStats {
  /** Counted tries */
  completed: number
  correct: number
  incorrect: number
  /** correct / completed, 0 when nothing counted */
  accuracy: number
  totalTimeMs: number
}

/**
 * Counts, accuracy and time over the tries that count. The one place a
 * session's numbers are summed, so no view can count a practice-only do-over.
 */
export function summarizeTries(
  results:
    | readonly Pick<SlotResult, 'practiceOnly' | 'isCorrect' | 'responseTimeMs'>[]
    | null
    | undefined
): TryStats {
  const counted = countedTries(results)
  const correct = counted.filter((r) => r.isCorrect).length
  return {
    completed: counted.length,
    correct,
    incorrect: counted.length - correct,
    accuracy: counted.length > 0 ? correct / counted.length : 0,
    totalTimeMs: counted.reduce((sum, r) => sum + (r.responseTimeMs || 0), 0),
  }
}

/**
 * Calculate session accuracy from results
 */
export function getSessionPlanAccuracy(plan: SessionPlan): number {
  return summarizeTries(plan.results).accuracy
}

/**
 * Get the current part
 */
export function getCurrentPart(plan: SessionPlan) {
  return plan.parts[plan.currentPartIndex]
}

/**
 * Get the next incomplete slot in the current part
 */
export function getNextSlot(plan: SessionPlan) {
  const currentPart = getCurrentPart(plan)
  if (!currentPart) return undefined
  return currentPart.slots[plan.currentSlotIndex]
}

/**
 * Get total problem count across all parts
 */
export function getTotalProblemCount(plan: SessionPlan): number {
  return plan.parts.reduce((sum, part) => sum + part.slots.length, 0)
}

/**
 * Get count of completed problems across all parts
 */
export function getCompletedProblemCount(plan: SessionPlan): number {
  return countedTries(plan.results).length
}

/**
 * Check if the current part is complete
 */
export function isPartComplete(plan: SessionPlan): boolean {
  const currentPart = getCurrentPart(plan)
  if (!currentPart) return true
  return plan.currentSlotIndex >= currentPart.slots.length
}

/**
 * Check if the entire session is complete
 */
export function isSessionComplete(plan: SessionPlan): boolean {
  if (plan.status === 'completed') return true
  if (plan.currentPartIndex >= plan.parts.length) return true
  if (plan.currentPartIndex === plan.parts.length - 1) {
    const lastPart = plan.parts[plan.currentPartIndex]
    return plan.currentSlotIndex >= lastPart.slots.length
  }
  return false
}

/**
 * Calculate updated health metrics
 */
export function calculateSessionHealth(plan: SessionPlan, elapsedTimeMs: number): SessionHealth {
  // Practice-only do-overs (of problems already answered correctly) are not evidence
  const results = countedTries(plan.results)
  const completed = results.length
  const expectedCompleted = Math.floor(elapsedTimeMs / 1000 / plan.avgTimePerProblemSeconds)

  const accuracy = completed > 0 ? results.filter((r) => r.isCorrect).length / completed : 1
  const pacePercent = expectedCompleted > 0 ? (completed / expectedCompleted) * 100 : 100
  const avgResponseTimeMs =
    completed > 0 ? results.reduce((sum, r) => sum + r.responseTimeMs, 0) / completed : 0

  let currentStreak = 0
  for (let i = results.length - 1; i >= 0; i--) {
    if (i === results.length - 1) {
      currentStreak = results[i].isCorrect ? 1 : -1
    } else if (results[i].isCorrect === results[i + 1].isCorrect) {
      currentStreak += results[i].isCorrect ? 1 : -1
    } else {
      break
    }
  }

  let overall: 'good' | 'warning' | 'struggling' = 'good'
  if (accuracy < 0.6 || pacePercent < 70 || currentStreak <= -3) {
    overall = 'struggling'
  } else if (accuracy < 0.8 || pacePercent < 90 || currentStreak <= -2) {
    overall = 'warning'
  }

  return { overall, accuracy, pacePercent, currentStreak, avgResponseTimeMs }
}

// ============================================================================
// Retry System Helpers
// ============================================================================

/**
 * Calculate mastery weight for a result based on epoch and correctness.
 */
export function calculateMasteryWeight(isCorrect: boolean, epochNumber: number): number {
  if (!isCorrect) return 0
  return 1.0 / 2 ** epochNumber
}

/** Same problem: same terms and answer. */
export function sameProblem(
  a: Pick<GeneratedProblem, 'terms' | 'answer'> | undefined,
  b: Pick<GeneratedProblem, 'terms' | 'answer'> | undefined
): boolean {
  if (!a || !b || !Array.isArray(a.terms) || !Array.isArray(b.terms)) return false
  return (
    a.answer === b.answer &&
    a.terms.length === b.terms.length &&
    a.terms.every((t, i) => t === b.terms[i])
  )
}

/**
 * Check if we're currently in a retry epoch for the given part
 */
export function isInRetryEpoch(plan: Pick<SessionPlan, 'retryState'>, partIndex: number): boolean {
  const retryState = plan.retryState?.[partIndex]
  if (!retryState) return false
  return retryState.currentEpochItems.length > 0 && retryState.currentEpoch > 0
}

/** The item the student is on: an original slot, or an item of the running retry round. */
export interface CurrentPlanItem {
  partIndex: number
  slotId: string
  originalSlotIndex: number
  /** 0 for the original slot, 1+ for a retry round */
  epochNumber: number
  /** Index into the round's currentEpochItems; null for an original slot */
  retryIndex: number | null
  problem: GeneratedProblem | undefined
  purpose: ProblemSlot['purpose']
}

/**
 * The one place that decides which item the student is on. Retry-round items
 * redeemed by a do-over are skipped. Null when the position has nothing to
 * show: the session is past its last part, or the current retry round has no
 * unredeemed item left.
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

  const retryState = plan.retryState?.[partIndex]
  if (retryState && isInRetryEpoch(plan, partIndex)) {
    const items = retryState.currentEpochItems
    for (let retryIndex = retryState.currentRetryIndex; retryIndex < items.length; retryIndex++) {
      const item = items[retryIndex]
      if (retryState.redeemedSlots?.includes(item.originalSlotIndex)) continue
      return {
        partIndex,
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

  const slot = part.slots[plan.currentSlotIndex]
  if (!slot) return null
  return {
    partIndex,
    slotId: slot.slotId,
    originalSlotIndex: plan.currentSlotIndex,
    epochNumber: 0,
    retryIndex: null,
    problem: slot.problem,
    purpose: slot.purpose,
  }
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
    plan.retryState[partIndex] = {
      currentEpoch: 0,
      pendingRetries: [],
      currentEpochItems: [],
      currentRetryIndex: 0,
    }
  }
  return plan.retryState[partIndex]
}

/**
 * Get retry status for a specific slot (for UI display)
 */
export function getSlotRetryStatus(
  plan: SessionPlan,
  partIndex: number,
  slotIndex: number
): {
  hasBeenAttempted: boolean
  isCorrect: boolean | null
  attemptCount: number
  finalMasteryWeight: number | null
} {
  const partNumber = plan.parts[partIndex]?.partNumber
  if (!partNumber) {
    return { hasBeenAttempted: false, isCorrect: null, attemptCount: 0, finalMasteryWeight: null }
  }

  const slotResults = plan.results.filter(
    (r) => r.partNumber === partNumber && (r.originalSlotIndex ?? r.slotIndex) === slotIndex
  )

  if (slotResults.length === 0) {
    return { hasBeenAttempted: false, isCorrect: null, attemptCount: 0, finalMasteryWeight: null }
  }

  // The verdict is the latest counted try: a practice-only do-over never changes it
  const counted = countedTries(slotResults)
  const verdictPool = counted.length > 0 ? counted : slotResults
  const latestResult = verdictPool[verdictPool.length - 1]
  return {
    hasBeenAttempted: true,
    isCorrect: latestResult.isCorrect,
    attemptCount: slotResults.length,
    finalMasteryWeight: latestResult.masteryWeight ?? null,
  }
}

/**
 * Calculate total problems including pending retries for progress display
 */
export function calculateTotalProblemsWithRetries(plan: SessionPlan): number {
  let total = 0
  for (let partIndex = 0; partIndex < plan.parts.length; partIndex++) {
    const part = plan.parts[partIndex]
    total += part.slots.length
    const retryState = plan.retryState?.[partIndex]
    if (retryState) {
      total += retryState.currentEpochItems.length
      total += retryState.pendingRetries.length
    }
  }
  return total
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
