/**
 * Complexity Budget Configuration
 *
 * Controls the "cognitive load budget" system that ensures problems
 * are appropriately challenging for each student's skill level.
 *
 * Budget = Σ(baseCost × masteryMultiplier) per term
 *
 * A term's cost reflects how hard it is for THIS student:
 * - Practiced ten complements: +9 costs 6 (base 2 × practicing 3)
 * - Unpracticed ten complements: +9 costs 8 (base 2 × not_practicing 4)
 */

import type { SessionPartType } from "@/db/schema/session-plans";

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
} as const;

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
/**
 * Complexity bounds per purpose and part type.
 *
 * Each slot purpose can have different min/max complexity requirements.
 * null = no constraint (unlimited)
 *
 * - min: Minimum cost per term (ensures terms aren't trivial)
 * - max: Maximum cost per term (caps cognitive load)
 *
 * The max budget interacts with BKT multipliers:
 * - Adaptive-BKT mode: weak skills have high multipliers (up to 4x), so their terms
 *   are more likely to exceed max budget and be filtered out
 * - Classic/Adaptive mode: uses discrete multipliers (practicing=3x), more lenient
 *
 * Example with max=7 and base_cost=2 (complement skill):
 * - Adaptive (pKnown=0): 2 × 4.0 = 8.0 → filtered (exceeds max)
 * - Classic (practicing): 2 × 3.0 = 6.0 → allowed (under max)
 *
 * This differentiation is key to BKT-driven adaptive problem selection.
 */
export const PURPOSE_COMPLEXITY_BOUNDS: Record<
  "focus" | "reinforce" | "review" | "challenge",
  Record<SessionPartType, { min: number | null; max: number | null }>
> = {
  focus: {
    abacus: { min: null, max: 7 }, // Added max to enable adaptive differentiation
    visualization: { min: null, max: 5 },
    linear: { min: null, max: 7 }, // Added max to enable adaptive differentiation
  },
  reinforce: {
    abacus: { min: null, max: 7 },
    visualization: { min: null, max: 5 },
    linear: { min: null, max: 7 },
  },
  review: {
    abacus: { min: null, max: 7 },
    visualization: { min: null, max: 5 },
    linear: { min: null, max: 7 },
  },
  challenge: {
    /** Challenge problems require at least some skill complexity */
    abacus: { min: 1, max: null },
    visualization: { min: 1, max: null },
    linear: { min: 1, max: null },
  },
};

/**
 * Get complexity bounds for a specific purpose and part type.
 */
export function getComplexityBounds(
  purpose: "focus" | "reinforce" | "review" | "challenge",
  partType: SessionPartType,
): { min: number | null; max: number | null } {
  return PURPOSE_COMPLEXITY_BOUNDS[purpose][partType];
}

export type PurposeComplexityBounds = typeof PURPOSE_COMPLEXITY_BOUNDS;
