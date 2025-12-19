/**
 * Skill Cost Configuration
 *
 * Defines the base complexity costs for each abacus skill and
 * the multipliers applied based on student mastery level.
 *
 * Total term cost = Σ(baseCost × masteryMultiplier) for all skills in the term
 *
 * Fine-grained mastery is handled by BKT (Bayesian Knowledge Tracing).
 * When BKT confidence is sufficient, it provides continuous multipliers (1-4).
 * These discrete states are fallbacks when BKT data is insufficient.
 */

// =============================================================================
// Mastery Multipliers
// =============================================================================

/**
 * Simplified mastery states for cost calculation fallback.
 *
 * BKT handles fine-grained mastery estimation. These states are only used
 * when BKT confidence is insufficient (not enough practice data).
 *
 * - 'practicing': Skill is in student's active practice rotation
 * - 'not_practicing': Skill is not in rotation - maximum cognitive load
 */
export type MasteryState = "practicing" | "not_practicing";

/**
 * Multipliers applied to base skill costs based on mastery state.
 *
 * These are fallback values when BKT confidence is insufficient.
 * When BKT is confident, it provides continuous multipliers based on P(known):
 * - P(known) = 1.0 → multiplier ~1.0 (mastered)
 * - P(known) = 0.5 → multiplier ~2.5 (developing)
 * - P(known) = 0.0 → multiplier ~4.0 (unknown)
 *
 * Lower = easier cognitive load for this student.
 * Higher = more mental effort required.
 */
export const MASTERY_MULTIPLIERS: Record<MasteryState, number> = {
  /** In practice rotation - moderate default until BKT has enough data */
  practicing: 3,
  /** Not in practice rotation - maximum cognitive load */
  not_practicing: 4,
};

// =============================================================================
// Base Skill Complexity
// =============================================================================

/**
 * Base complexity for each skill - reflects intrinsic mechanical difficulty.
 * This is constant regardless of student mastery.
 *
 * Scale:
 * - 0 = Trivial (basic bead movements, no mental calculation)
 * - 1 = Single complement (one mental substitution: +4 = +5-1)
 * - 2 = Cross-column (must track carry/borrow across place values)
 * - 3 = Multi-column cascading (must track propagation across 2+ columns)
 */
export const BASE_SKILL_COMPLEXITY: Record<string, number> = {
  // -------------------------------------------------------------------------
  // Base 0: Trivial operations - just moving beads, no mental math
  // -------------------------------------------------------------------------
  "basic.directAddition": 0,
  "basic.directSubtraction": 0,
  "basic.heavenBead": 0,
  "basic.heavenBeadSubtraction": 0,
  "basic.simpleCombinations": 0,
  "basic.simpleCombinationsSub": 0,

  // -------------------------------------------------------------------------
  // Base 1: Five complements - single mental substitution
  // -------------------------------------------------------------------------
  "fiveComplements.4=5-1": 1,
  "fiveComplements.3=5-2": 1,
  "fiveComplements.2=5-3": 1,
  "fiveComplements.1=5-4": 1,
  "fiveComplementsSub.-4=-5+1": 1,
  "fiveComplementsSub.-3=-5+2": 1,
  "fiveComplementsSub.-2=-5+3": 1,
  "fiveComplementsSub.-1=-5+4": 1,

  // -------------------------------------------------------------------------
  // Base 2: Ten complements - cross-column operations
  // -------------------------------------------------------------------------
  "tenComplements.9=10-1": 2,
  "tenComplements.8=10-2": 2,
  "tenComplements.7=10-3": 2,
  "tenComplements.6=10-4": 2,
  "tenComplements.5=10-5": 2,
  "tenComplements.4=10-6": 2,
  "tenComplements.3=10-7": 2,
  "tenComplements.2=10-8": 2,
  "tenComplements.1=10-9": 2,
  "tenComplementsSub.-9=+1-10": 2,
  "tenComplementsSub.-8=+2-10": 2,
  "tenComplementsSub.-7=+3-10": 2,
  "tenComplementsSub.-6=+4-10": 2,
  "tenComplementsSub.-5=+5-10": 2,
  "tenComplementsSub.-4=+6-10": 2,
  "tenComplementsSub.-3=+7-10": 2,
  "tenComplementsSub.-2=+8-10": 2,
  "tenComplementsSub.-1=+9-10": 2,

  // -------------------------------------------------------------------------
  // Base 3: Multi-column cascading
  // -------------------------------------------------------------------------
  "advanced.cascadingCarry": 3,
  "advanced.cascadingBorrow": 3,
};

/**
 * Default base cost for unknown skills.
 * Conservative assumption: treat unknown skills as moderately complex.
 */
export const DEFAULT_BASE_COMPLEXITY = 1;

/**
 * Get base complexity for a skill (defaults to DEFAULT_BASE_COMPLEXITY for unknown skills).
 */
export function getBaseComplexity(skillId: string): number {
  return BASE_SKILL_COMPLEXITY[skillId] ?? DEFAULT_BASE_COMPLEXITY;
}
