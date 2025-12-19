/**
 * Slot Distribution Configuration
 *
 * Controls how problems are distributed across purposes (focus, reinforce, review, challenge)
 * and how session time is divided across part types (abacus, visualization, linear).
 */

import type { SessionPartType } from '@/db/schema/session-plans'

// =============================================================================
// Problem Purpose Distribution
// =============================================================================

/**
 * Base weights for slot purposes (should sum to 1.0 before challenge adjustment).
 *
 * These weights apply to the non-challenge portion of each part.
 * Challenge slots are allocated FIRST based on challengeRatioByPartType,
 * then remaining slots are distributed using these weights.
 *
 * - focus: Current phase skill practice (most important)
 * - reinforce: Skills flagged as needing reinforcement
 * - review: Spaced repetition of mastered skills
 */
export const PURPOSE_WEIGHTS = {
  /** Primary practice on current curriculum focus */
  focus: 0.6,
  /** Reinforce struggling skills */
  reinforce: 0.2,
  /** Spaced repetition of mastered skills */
  review: 0.15,
  // Note: Challenge slots are allocated using CHALLENGE_RATIO_BY_PART_TYPE (per part type),
  // not a fixed weight. See session-planner.ts for the allocation logic.
} as const

/**
 * Challenge problem ratios by part type.
 *
 * Different part types have different challenge densities:
 * - abacus: Higher ratio (25%) - physical abacus reduces cognitive load
 * - visualization: Lower ratio (15%) - mental math is harder
 * - linear: Medium ratio (20%) - middle ground
 *
 * Challenge slots are allocated FIRST, then remaining slots use PURPOSE_WEIGHTS.
 */
export const CHALLENGE_RATIO_BY_PART_TYPE: Record<SessionPartType, number> = {
  /** ~2-3 challenge problems per 10 (physical abacus makes harder problems manageable) */
  abacus: 0.25,
  /** ~1-2 challenge problems per 10 (mental math is harder, fewer challenges) */
  visualization: 0.15,
  /** ~2 challenge problems per 10 (middle ground) */
  linear: 0.2,
} as const

// =============================================================================
// Session Part Time Distribution
// =============================================================================

/**
 * How session time is distributed across part types (should sum to 1.0).
 *
 * Part 1 (abacus): 50% - This is where new skills are built
 * Part 2 (visualization): 30% - Mental math with visualization
 * Part 3 (linear): 20% - Mental math in sentence format
 */
export const PART_TIME_WEIGHTS: Record<SessionPartType, number> = {
  abacus: 0.5,
  visualization: 0.3,
  linear: 0.2,
} as const

// =============================================================================
// Term Count Ranges
// =============================================================================

/**
 * How many terms (numbers) per problem for each part type.
 * More terms = more complex multi-step problems.
 *
 * Example: { min: 3, max: 6 } means problems like "23 + 14 + 8" to "12 + 5 + 9 + 3 + 7 + 2"
 */
export const TERM_COUNT_RANGES: Record<SessionPartType, { min: number; max: number } | null> = {
  /** Base term count - physical abacus allows more complex problems */
  abacus: { min: 3, max: 6 },
  /** null = derive from abacus (typically 75% of abacus range) */
  visualization: null,
  /** null = same as abacus by default */
  linear: null,
} as const

/**
 * Get effective term count range for a part type.
 * Falls back to abacus range (or adjusted) if null.
 */
export function getTermCountRange(partType: SessionPartType): {
  min: number
  max: number
} {
  const explicit = TERM_COUNT_RANGES[partType]
  if (explicit) return explicit

  // Fall back to abacus range
  const abacusRange = TERM_COUNT_RANGES.abacus ?? { min: 3, max: 6 }

  if (partType === 'visualization') {
    // Visualization uses 75% of abacus range (mental math is harder)
    return {
      min: Math.max(2, Math.floor(abacusRange.min * 0.75)),
      max: Math.max(3, Math.floor(abacusRange.max * 0.75)),
    }
  }

  // Linear uses same as abacus
  return abacusRange
}

export type PurposeWeights = typeof PURPOSE_WEIGHTS
export type PartTimeWeights = typeof PART_TIME_WEIGHTS
