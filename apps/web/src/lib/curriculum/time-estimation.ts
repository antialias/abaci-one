/**
 * Time Estimation Utilities
 *
 * Provides sophisticated time estimation for practice sessions based on:
 * - Historical response times from completed problems
 * - Problem complexity (number of terms, digits, skill difficulty)
 * - Part type modifiers (abacus vs visualization vs linear)
 *
 * ## Key Concepts
 *
 * ### Seconds per Term (SPT)
 * The average time it takes to process one term in a problem.
 * A problem like "45 + 27 + 13" has 3 terms, so:
 * - Total time = SPT × 3 + base overhead
 *
 * ### Complexity Units
 * A more advanced metric that accounts for skill difficulty:
 * - Simple direct operations: 1 unit
 * - Five complement: 1.5 units
 * - Ten complement: 2 units
 * - Multi-digit carries: additional units per digit
 *
 * ### Part Type Modifiers
 * Different part types have different time characteristics:
 * - Abacus: 1.0x (baseline - student uses physical abacus)
 * - Visualization: 1.3x (mental imagery takes longer)
 * - Linear: 0.8x (no visual processing, just mental math)
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   estimateProblemTimeMs,
 *   estimateSessionProblemCount,
 * } from '@/lib/curriculum/time-estimation'
 *
 * // Estimate time for a specific problem at a given seconds-per-term pace
 * const timeMs = estimateProblemTimeMs(problem, secondsPerTerm)
 *
 * // Estimate how many problems fit in a duration
 * const count = estimateSessionProblemCount(durationMinutes, avgTermsPerProblem, secondsPerTerm)
 * ```
 *
 * NOTE: The historical-fit estimators (seconds-per-term / complexity-unit means)
 * were removed once `getPaceAssessment` (progress-manager, #157) became the single
 * producer of the pace statistic. This module now only holds the pure sizing math
 * the Start-Practice modal uses to turn a pace into a problem count.
 */

import type { SessionPart } from '@/db/schema/session-plans'

// ============================================================================
// Constants and Configuration
// ============================================================================

/**
 * Default time estimation values (in seconds)
 */
export const TIME_ESTIMATION_DEFAULTS = {
  /** Default seconds per term when no historical data is available */
  secondsPerTerm: 8,

  /** Minimum reasonable seconds per term (prevents unrealistic estimates) */
  minSecondsPerTerm: 3,

  /** Maximum reasonable seconds per term (caps outliers) */
  maxSecondsPerTerm: 30,

  /** Base overhead per problem (thinking time, reading, etc.) in seconds */
  problemOverheadSeconds: 2,

  /** Minimum problems per part to ensure meaningful practice */
  minProblemsPerPart: 2,
} as const

/**
 * Part type time multipliers
 *
 * These adjust time estimates based on the cognitive load of each part type:
 * - Abacus: Physical manipulation is relatively fast once learned
 * - Visualization: Mental imagery requires more processing time
 * - Linear: No visual processing, fastest for practiced students
 */
export const PART_TYPE_MULTIPLIERS: Record<SessionPart['type'], number> = {
  abacus: 1.0,
  visualization: 1.3,
  linear: 0.85,
}

/**
 * Skill complexity weights
 *
 * Used to weight time estimates based on which skills a problem exercises.
 * Higher weights = more complex = takes longer.
 */
export const SKILL_COMPLEXITY_WEIGHTS: Record<string, number> = {
  // Direct operations (simplest)
  'add.direct': 1.0,
  'sub.direct': 1.0,

  // Five complement operations
  'add.five': 1.5,
  'sub.five': 1.5,

  // Ten complement operations (most complex single-digit)
  'add.ten': 2.0,
  'sub.ten': 2.0,

  // Multi-digit operations add complexity
  carry: 1.5,
  borrow: 1.5,
}

// ============================================================================
// Core Calculation Functions
// ============================================================================

/**
 * Estimate time in milliseconds for a specific problem
 *
 * @param problem - Problem with terms array
 * @param secondsPerTerm - Average seconds per term
 * @param partType - Part type for modifier (optional)
 * @returns Estimated time in milliseconds
 */
export function estimateProblemTimeMs(
  problem: { terms: number[] },
  secondsPerTerm: number,
  partType?: SessionPart['type']
): number {
  const termCount = problem.terms.length
  const baseSeconds = termCount * secondsPerTerm + TIME_ESTIMATION_DEFAULTS.problemOverheadSeconds

  const modifier = partType ? PART_TYPE_MULTIPLIERS[partType] : 1.0

  return Math.round(baseSeconds * modifier * 1000)
}

/**
 * Estimate time in seconds for a specific problem
 *
 * @param problem - Problem with terms array
 * @param secondsPerTerm - Average seconds per term
 * @param partType - Part type for modifier (optional)
 * @returns Estimated time in seconds
 */
export function estimateProblemTimeSeconds(
  problem: { terms: number[] },
  secondsPerTerm: number,
  partType?: SessionPart['type']
): number {
  return estimateProblemTimeMs(problem, secondsPerTerm, partType) / 1000
}

// ============================================================================
// Session Planning Functions
// ============================================================================

/**
 * Estimate the number of problems that can fit in a given duration
 *
 * @param durationMinutes - Target session duration in minutes
 * @param avgTermsPerProblem - Average number of terms per problem (default: 3)
 * @param secondsPerTerm - Seconds per term (default: from constants)
 * @param partType - Part type for modifier (optional)
 * @returns Estimated problem count
 */
export function estimateSessionProblemCount(
  durationMinutes: number,
  avgTermsPerProblem: number = 3,
  secondsPerTerm: number = TIME_ESTIMATION_DEFAULTS.secondsPerTerm,
  partType?: SessionPart['type']
): number {
  const totalSeconds = durationMinutes * 60
  const modifier = partType ? PART_TYPE_MULTIPLIERS[partType] : 1.0

  const secondsPerProblem =
    (avgTermsPerProblem * secondsPerTerm + TIME_ESTIMATION_DEFAULTS.problemOverheadSeconds) *
    modifier

  const count = Math.floor(totalSeconds / secondsPerProblem)
  return Math.max(TIME_ESTIMATION_DEFAULTS.minProblemsPerPart, count)
}

/**
 * Estimate total session duration given problem count and complexity
 *
 * @param problemCount - Number of problems
 * @param avgTermsPerProblem - Average terms per problem
 * @param secondsPerTerm - Seconds per term
 * @returns Estimated duration in minutes
 */
export function estimateSessionDurationMinutes(
  problemCount: number,
  avgTermsPerProblem: number = 3,
  secondsPerTerm: number = TIME_ESTIMATION_DEFAULTS.secondsPerTerm
): number {
  const secondsPerProblem =
    avgTermsPerProblem * secondsPerTerm + TIME_ESTIMATION_DEFAULTS.problemOverheadSeconds

  return Math.round((problemCount * secondsPerProblem) / 60)
}

/**
 * Convert seconds per term to approximate seconds per problem
 *
 * Useful for UI display and backwards compatibility with existing code
 * that expects "seconds per problem" as input.
 *
 * @param secondsPerTerm - Seconds per term
 * @param avgTermsPerProblem - Average terms per problem (default: 3)
 * @returns Approximate seconds per problem
 */
export function convertSptToSecondsPerProblem(
  secondsPerTerm: number,
  avgTermsPerProblem = 3
): number {
  return Math.round(
    avgTermsPerProblem * secondsPerTerm + TIME_ESTIMATION_DEFAULTS.problemOverheadSeconds
  )
}

/**
 * Convert seconds per problem to approximate seconds per term
 *
 * Useful for converting legacy data or user input to the new model.
 *
 * @param secondsPerProblem - Seconds per problem
 * @param avgTermsPerProblem - Average terms per problem (default: 3)
 * @returns Approximate seconds per term
 */
export function convertSecondsPerProblemToSpt(
  secondsPerProblem: number,
  avgTermsPerProblem = 3
): number {
  const netTime = Math.max(0, secondsPerProblem - TIME_ESTIMATION_DEFAULTS.problemOverheadSeconds)
  return netTime / avgTermsPerProblem
}

// ============================================================================
// Advanced: Complexity-Weighted Estimation
// ============================================================================

/**
 * Calculate complexity units for a problem based on skills required
 *
 * This provides a more nuanced estimate than just counting terms.
 *
 * @param skillsRequired - Array of skill IDs the problem exercises
 * @returns Total complexity units
 */
export function calculateProblemComplexityUnits(skillsRequired: string[]): number {
  if (skillsRequired.length === 0) return 1 // Minimum complexity

  let totalComplexity = 0
  for (const skill of skillsRequired) {
    // Check for exact match first
    if (SKILL_COMPLEXITY_WEIGHTS[skill]) {
      totalComplexity += SKILL_COMPLEXITY_WEIGHTS[skill]
      continue
    }

    // Check for partial match (e.g., "add.+5.direct" matches "add.direct")
    const parts = skill.split('.')
    const operation = parts[0] // add, sub
    const technique = parts[parts.length - 1] // direct, five, ten

    const partialKey = `${operation}.${technique}`
    if (SKILL_COMPLEXITY_WEIGHTS[partialKey]) {
      totalComplexity += SKILL_COMPLEXITY_WEIGHTS[partialKey]
    } else {
      // Default complexity for unknown skills
      totalComplexity += 1.0
    }
  }

  return totalComplexity
}
