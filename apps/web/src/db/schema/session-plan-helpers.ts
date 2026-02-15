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
  SessionHealth,
  SessionPlan,
  SessionRetryState,
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
 * Calculate session accuracy from results
 */
export function getSessionPlanAccuracy(plan: SessionPlan): number {
  if (plan.results.length === 0) return 0
  const correct = plan.results.filter((r) => r.isCorrect).length
  return correct / plan.results.length
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
  return plan.results.length
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
  const results = plan.results
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

/**
 * Check if we're currently in a retry epoch for the given part
 */
export function isInRetryEpoch(plan: SessionPlan, partIndex: number): boolean {
  const retryState = plan.retryState?.[partIndex]
  if (!retryState) return false
  return retryState.currentEpochItems.length > 0 && retryState.currentEpoch > 0
}

/**
 * Get the current problem to display (either from original slots or retry queue)
 */
export function getCurrentProblemInfo(plan: SessionPlan): {
  problem: GeneratedProblem
  isRetry: boolean
  epochNumber: number
  originalSlotIndex: number
  purpose: 'focus' | 'reinforce' | 'review' | 'challenge'
  partNumber: 1 | 2 | 3
} | null {
  const partIndex = plan.currentPartIndex
  if (partIndex >= plan.parts.length) return null

  const part = plan.parts[partIndex]
  const retryState = plan.retryState?.[partIndex]

  if (retryState && retryState.currentEpochItems.length > 0 && retryState.currentEpoch > 0) {
    let itemIndex = retryState.currentRetryIndex
    while (itemIndex < retryState.currentEpochItems.length) {
      const item = retryState.currentEpochItems[itemIndex]
      if (retryState.redeemedSlots?.includes(item.originalSlotIndex)) {
        itemIndex++
        continue
      }
      return {
        problem: item.problem,
        isRetry: true,
        epochNumber: item.epochNumber,
        originalSlotIndex: item.originalSlotIndex,
        purpose: item.originalPurpose,
        partNumber: part.partNumber,
      }
    }
    return null
  }

  if (plan.currentSlotIndex >= part.slots.length) return null

  const slot = part.slots[plan.currentSlotIndex]
  if (!slot.problem) return null

  return {
    problem: slot.problem,
    isRetry: false,
    epochNumber: 0,
    originalSlotIndex: plan.currentSlotIndex,
    purpose: slot.purpose,
    partNumber: part.partNumber,
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

  const latestResult = slotResults[slotResults.length - 1]
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
