/**
 * BKT Integration Configuration
 *
 * Configuration for integrating Bayesian Knowledge Tracing into
 * adaptive problem generation.
 *
 * IMPORTANT: BKT is used for SKILL TARGETING, not cost calculation.
 * - BKT identifies weak skills (low P(known)) → prioritize in targetSkills
 * - Cost calculation uses fluency-based multipliers (see skillComplexity.ts)
 *
 * This separation ensures:
 * - Difficulty control works correctly (mastery multipliers)
 * - Weak skills get MORE practice, not filtered out
 */

// =============================================================================
// Problem Generation Mode
// =============================================================================

/**
 * Problem generation algorithm selection
 * - 'classic': No BKT targeting, fluency-based cost multipliers
 * - 'adaptive': BKT skill targeting, fluency-based cost multipliers (current default)
 * - 'adaptive-bkt': BKT skill targeting, BKT-based cost multipliers (experimental)
 */
export type ProblemGenerationMode = 'classic' | 'adaptive' | 'adaptive-bkt'

/**
 * Default problem generation mode for new sessions
 *
 * 'adaptive-bkt' uses BKT for both skill targeting AND cost multipliers.
 * This is the most data-driven approach, using full learning history.
 */
export const DEFAULT_PROBLEM_GENERATION_MODE: ProblemGenerationMode = 'adaptive-bkt'

// =============================================================================
// BKT Confidence Thresholds
// =============================================================================

/**
 * Configuration for BKT-based complexity calculation
 */
export const BKT_INTEGRATION_CONFIG = {
  /**
   * Confidence threshold for trusting BKT over fluency fallback.
   * Below this, we use fluency-based discrete multipliers.
   * Above this, we use BKT P(known) for continuous scaling.
   *
   * Confidence formula: 1 - exp(-opportunities / 20)
   * With ~5 problems per skill, confidence reaches ~0.22
   * With ~7 problems per skill, confidence reaches ~0.30
   * With ~15 problems per skill, confidence reaches ~0.53
   * With ~50 problems per skill, confidence reaches ~0.92
   *
   * Threshold 0.30 requires ~7 opportunities per skill to engage BKT,
   * allowing adaptive behavior to emerge in shorter sessions.
   */
  confidenceThreshold: 0.3,

  /**
   * Minimum multiplier (when pKnown = 1.0, fully mastered)
   * Lower multiplier = skill costs less budget = easier problems allowed
   */
  minMultiplier: 1.0,

  /**
   * Maximum multiplier (when pKnown = 0.0, not known at all)
   * Higher multiplier = skill costs more budget = harder problems restricted
   */
  maxMultiplier: 4.0,

  /**
   * Number of recent sessions to load for BKT computation.
   * More sessions = more accurate but slower.
   */
  sessionHistoryDepth: 50,
} as const

// =============================================================================
// Multiplier Calculation
// =============================================================================

/**
 * Calculate complexity multiplier from BKT P(known) estimate.
 *
 * Non-linear (square) mapping: pKnown [0,1] → multiplier [max, min]
 * Using pKnown² instead of pKnown spreads out the multiplier range
 * in the high P(known) region, making the system more sensitive:
 *
 * Linear (old):
 * - pKnown = 0.80 → multiplier = 1.60
 * - pKnown = 0.90 → multiplier = 1.30
 * - pKnown = 0.95 → multiplier = 1.15
 * - pKnown = 1.00 → multiplier = 1.00
 *
 * Non-linear (new):
 * - pKnown = 0.80 → multiplier = 2.08 (0.64 squared)
 * - pKnown = 0.90 → multiplier = 1.57 (0.81 squared)
 * - pKnown = 0.95 → multiplier = 1.29 (0.90 squared)
 * - pKnown = 1.00 → multiplier = 1.00
 *
 * This ensures skills at 80% P(known) are treated distinctly different
 * from skills at 95% P(known), enabling meaningful differentiation
 * in problem selection.
 *
 * @param pKnown - BKT probability of knowing skill [0, 1]
 * @returns Complexity multiplier [minMultiplier, maxMultiplier]
 */
export function calculateBktMultiplier(pKnown: number): number {
  const { minMultiplier, maxMultiplier } = BKT_INTEGRATION_CONFIG

  // Non-linear (square) interpolation: pKnown²=0 → max, pKnown²=1 → min
  // This spreads out the high P(known) range for better differentiation
  const effectivePKnown = pKnown * pKnown
  const multiplier = maxMultiplier - effectivePKnown * (maxMultiplier - minMultiplier)

  // Clamp to valid range (shouldn't be needed but defensive)
  return Math.max(minMultiplier, Math.min(maxMultiplier, multiplier))
}

/**
 * Check if BKT confidence is sufficient to trust the P(known) estimate.
 *
 * @param confidence - BKT confidence in the P(known) estimate [0, 1]
 * @returns true if confidence meets threshold for BKT-based scaling
 */
export function isBktConfident(confidence: number): boolean {
  return confidence >= BKT_INTEGRATION_CONFIG.confidenceThreshold
}

// =============================================================================
// Weak Skill Identification
// =============================================================================

/**
 * Thresholds for identifying weak skills from BKT estimates.
 *
 * A skill is considered "weak" and prioritized for practice when:
 * - BKT confidence >= confidenceThreshold (we trust the estimate)
 * - BKT P(known) < pKnownThreshold (skill needs more practice)
 */
export const WEAK_SKILL_THRESHOLDS = {
  /**
   * P(known) below this = weak skill that needs practice.
   * 0.5 means skills the student has <50% chance of knowing correctly.
   */
  pKnownThreshold: 0.5,

  /**
   * Confidence required to trust BKT assessment for targeting.
   * Uses same threshold as general BKT confidence.
   */
  confidenceThreshold: BKT_INTEGRATION_CONFIG.confidenceThreshold,
} as const

export type WeakSkillThresholds = typeof WEAK_SKILL_THRESHOLDS

// =============================================================================
// Type Exports
// =============================================================================

export type BktIntegrationConfig = typeof BKT_INTEGRATION_CONFIG
