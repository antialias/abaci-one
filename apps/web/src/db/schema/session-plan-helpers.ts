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
import { evidenceWeightOf } from '@/lib/curriculum/try-weight'

import type {
  GameBreakSettings,
  GeneratedProblem,
  SessionHealth,
  SessionPlan,
  SlotResult,
} from './session-plans'

// The arithmetic part kind's plan-level helpers moved to lib/curriculum/parts/
// (session architecture Phase 2); re-exported here until Phase 5 so existing
// imports keep working. Both modules are client-safe.
export { calculateTotalProblemsWithRetries } from '@/lib/curriculum/parts/arithmetic/report'
export {
  type CurrentPlanItem,
  getCurrentProblemInfo,
  initRetryState,
  isInRetryEpoch,
  MAX_RETRY_EPOCHS,
  needsRetryTransition,
  resolveCurrentItem,
} from '@/lib/curriculum/parts/arithmetic/state'

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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Whether a try counts: everything except a practice-only do-over (a do-over
 * of a problem whose latest counted try was correct, session architecture
 * §1.2) and a voided try (worksheet unapproval, Phase 3a). Every reader that
 * turns tries into a verdict, a count, an accuracy, a streak, a timing
 * statistic or mastery evidence reads through this predicate; only lists of
 * individual tries (attempt history) show practice-only rows.
 */
export function isCountedTry(result: Pick<SlotResult, 'practiceOnly' | 'voided'>): boolean {
  return result.practiceOnly !== true && result.voided !== true
}

/**
 * Whether an adult excluded the try from mastery (`source: 'teacher-excluded'`,
 * session-review `exclude`). The session report (§4) still lists it and counts
 * it in `tries`, but drops it from every accuracy numerator and denominator.
 */
export function isExcludedTry(result: Pick<SlotResult, 'source'>): boolean {
  return result.source === 'teacher-excluded'
}

/** The tries that count (see `isCountedTry`), in recorded order. */
export function countedTries<T extends Pick<SlotResult, 'practiceOnly' | 'voided'>>(
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
    // The weight BKT reads for it (a wrong row's re-derived, Phase 1w)
    finalMasteryWeight: evidenceWeightOf(latestResult),
  }
}
