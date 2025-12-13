/**
 * Complexity Budget Configuration
 *
 * Controls the "cognitive load budget" system that ensures problems
 * are appropriately challenging for each student's skill level.
 *
 * Budget = Σ(baseCost × masteryMultiplier) per term
 *
 * A term's cost reflects how hard it is for THIS student:
 * - Expert at ten complements: +9 costs 2 (base 2 × effortless 1)
 * - Beginner at ten complements: +9 costs 8 (base 2 × learning 4)
 */

import type { SessionPartType } from '@/db/schema/session-plans'

// =============================================================================
// General Budget Defaults
// =============================================================================

/**
 * Default complexity budgets for common scenarios.
 * Used when no specific purpose/part constraints apply.
 */
export const DEFAULT_COMPLEXITY_BUDGETS = {
  /** No limit - full complexity allowed */
  unlimited: Number.POSITIVE_INFINITY,

  /** Use abacus mode - high budget (physical abacus reduces cognitive load) */
  useAbacus: 12,

  /** Visualization beginner - conservative */
  visualizationDefault: 6,

  /** Linear mode */
  linearDefault: 8,
} as const

// =============================================================================
// Per-Purpose, Per-Part Complexity Bounds
// =============================================================================

/**
 * Complexity bounds per purpose and part type.
 *
 * Each slot purpose can have different min/max complexity requirements.
 * null = no constraint (unlimited)
 *
 * - min: Minimum cost per term (ensures terms aren't trivial)
 * - max: Maximum cost per term (caps cognitive load)
 *
 * Example scenarios:
 * - focus/visualization max:3 = cap complexity for mental math
 * - challenge min:1 = every term must use at least one five-complement
 */
export const PURPOSE_COMPLEXITY_BOUNDS: Record<
  'focus' | 'reinforce' | 'review' | 'challenge',
  Record<SessionPartType, { min: number | null; max: number | null }>
> = {
  focus: {
    abacus: { min: null, max: null },
    visualization: { min: null, max: 3 },
    linear: { min: null, max: null },
  },
  reinforce: {
    abacus: { min: null, max: null },
    visualization: { min: null, max: 3 },
    linear: { min: null, max: null },
  },
  review: {
    abacus: { min: null, max: null },
    visualization: { min: null, max: 3 },
    linear: { min: null, max: null },
  },
  challenge: {
    /** Challenge problems require at least some skill complexity */
    abacus: { min: 1, max: null },
    visualization: { min: 1, max: null },
    linear: { min: 1, max: null },
  },
}

/**
 * Get complexity bounds for a specific purpose and part type.
 */
export function getComplexityBounds(
  purpose: 'focus' | 'reinforce' | 'review' | 'challenge',
  partType: SessionPartType
): { min: number | null; max: number | null } {
  return PURPOSE_COMPLEXITY_BOUNDS[purpose][partType]
}

export type PurposeComplexityBounds = typeof PURPOSE_COMPLEXITY_BOUNDS
