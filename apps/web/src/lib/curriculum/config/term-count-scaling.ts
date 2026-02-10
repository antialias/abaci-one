/**
 * Term Count Scaling Configuration
 *
 * Dynamic term-count ranges based on student mastery (comfort level).
 * Replaces static term-count ranges with mastery-derived computation.
 *
 * When comfortable → more terms (harder problems)
 * When struggling → fewer terms (focus on the skill itself)
 * Parent/teacher override acts as a ceiling, not the primary source.
 */

import type { SessionPartType } from '@/db/schema/session-plans'

// =============================================================================
// Scaling Configuration
// =============================================================================

/**
 * Per-part-type floor/ceiling for term count ranges.
 *
 * - floor: what a struggling student (comfort = 0) gets
 * - ceiling: what a fully mastered student (comfort = 1) gets
 *
 * The actual range is linearly interpolated between floor and ceiling
 * based on the student's comfort level.
 */
export const TERM_COUNT_SCALING: Record<
  SessionPartType,
  {
    floor: { min: number; max: number }
    ceiling: { min: number; max: number }
  }
> = {
  abacus: { floor: { min: 2, max: 3 }, ceiling: { min: 4, max: 8 } },
  visualization: { floor: { min: 2, max: 2 }, ceiling: { min: 4, max: 8 } },
  linear: { floor: { min: 2, max: 2 }, ceiling: { min: 4, max: 8 } },
}

// =============================================================================
// Explanation Data (for UI tooltips)
// =============================================================================

/**
 * Explanation data attached to each slot so tooltips can show reasoning.
 *
 * This captures the full computation chain from BKT data → comfort level →
 * dynamic range → final range (after override), allowing the UI to explain
 * exactly why a student got a particular term count range.
 */
export interface TermCountExplanation {
  /** Comfort level (0-1) used for interpolation (after adjustment) */
  comfortLevel: number
  /** Individual factors that produced the comfort level */
  factors: {
    /** Weighted pKnown average across practicing skills (null = no BKT data) */
    avgMastery: number | null
    /** Session mode name */
    sessionMode: string
    /** Mode-based multiplier: remediation=0.6, progression=0.85, maintenance=1.0 */
    modeMultiplier: number
    /** Bonus for breadth of skill experience (0-0.15) */
    skillCountBonus: number
  }
  /** Dynamic range before any override is applied */
  dynamicRange: { min: number; max: number }
  /** Parent/teacher cap, if any was applied */
  override: { min: number; max: number } | null
  /** Final range after override applied */
  finalRange: { min: number; max: number }
  /** Comfort adjustment from problem length preference (shorter=-0.3, recommended=0, longer=+0.2) */
  comfortAdjustment?: number
  /** Raw comfort level before adjustment was applied */
  rawComfortLevel?: number
}

// =============================================================================
// Computation
// =============================================================================

/**
 * Compute the term count range for a part type based on comfort level.
 *
 * Uses linear interpolation between the floor and ceiling for the given
 * part type. Result is clamped and rounded to integers.
 *
 * @param partType - The session part type (abacus, visualization, linear)
 * @param comfortLevel - Student comfort level (0-1), from computeComfortLevel()
 * @returns { min, max } term count range
 */
export function computeTermCountRange(
  partType: SessionPartType,
  comfortLevel: number
): { min: number; max: number } {
  const scaling = TERM_COUNT_SCALING[partType]
  const clamped = Math.max(0, Math.min(1, comfortLevel))

  const min = Math.round(scaling.floor.min + (scaling.ceiling.min - scaling.floor.min) * clamped)
  const max = Math.round(scaling.floor.max + (scaling.ceiling.max - scaling.floor.max) * clamped)

  // Ensure min <= max and both >= 2
  return {
    min: Math.max(2, min),
    max: Math.max(Math.max(2, min), max),
  }
}
