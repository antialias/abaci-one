/**
 * BKT Integration Configuration
 *
 * Configuration for integrating Bayesian Knowledge Tracing into
 * adaptive problem generation.
 *
 * BKT is used for both SKILL TARGETING and COST CALCULATION:
 * - BKT identifies weak skills (low P(known)) → prioritize in targetSkills
 * - Cost multipliers use BKT P(known) for continuous scaling when confident
 * - Fallback to discrete multipliers (practicing=3, not_practicing=4) when BKT
 *   confidence is insufficient
 *
 * This ensures:
 * - Difficulty adapts to actual student mastery
 * - Weak skills get MORE practice, not filtered out
 */

// =============================================================================
// Problem Generation Mode
// =============================================================================

/**
 * Problem generation algorithm selection
 * - 'classic': No BKT targeting, discrete cost multipliers (practicing/not_practicing)
 * - 'adaptive': BKT skill targeting, discrete cost multipliers
 * - 'adaptive-bkt': BKT skill targeting, BKT-based continuous cost multipliers (default)
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
// Unified BKT Classification Thresholds
// =============================================================================

/**
 * SINGLE SOURCE OF TRUTH for all BKT classification thresholds.
 *
 * These thresholds determine how skills are classified based on P(known):
 * - P(known) >= strong → "strong" (mastered, ready to advance)
 * - P(known) < weak → "weak" (struggling, needs targeted practice)
 * - weak <= P(known) < strong → "developing" (learning, in progress)
 *
 * The confidence threshold determines when we trust the BKT estimate enough
 * to make classification decisions. Below this, we fall back to discrete
 * multipliers (practicing/not_practicing) or show "insufficient data".
 *
 * IMPORTANT: These values are designed to be adjustable via admin UI in the future.
 * All code should import from here rather than hardcoding values.
 */
export const BKT_THRESHOLDS = {
  /**
   * P(known) threshold for "strong" classification.
   * Skills at or above this are considered mastered.
   */
  strong: 0.8,

  /**
   * P(known) threshold for "weak" classification.
   * Skills below this need targeted practice.
   * Skills between weak and strong are "developing".
   */
  weak: 0.5,

  /**
   * Minimum confidence required to trust BKT estimates.
   * Below this, classification falls back to discrete multipliers.
   *
   * Confidence formula: 1 - exp(-opportunities / 20)
   * - ~7 problems → 0.30 confidence
   * - ~15 problems → 0.53 confidence
   * - ~50 problems → 0.92 confidence
   */
  confidence: 0.3,
} as const

export type BktThresholds = typeof BKT_THRESHOLDS

/**
 * Skill classification based on BKT P(known) estimate.
 * - 'strong': P(known) >= 0.8 - student has mastered this skill
 * - 'developing': 0.5 <= P(known) < 0.8 - student is learning, making progress
 * - 'weak': P(known) < 0.5 - student needs more practice on this skill
 */
export type SkillClassification = 'strong' | 'developing' | 'weak'

/**
 * Classify a skill based on P(known) using unified thresholds.
 *
 * @param pKnown - BKT probability of knowing skill [0, 1]
 * @param confidence - BKT confidence in the estimate [0, 1]
 * @returns Classification or null if confidence is insufficient
 */
export function classifySkill(pKnown: number, confidence: number): SkillClassification | null {
  // Insufficient confidence - can't reliably classify
  if (confidence < BKT_THRESHOLDS.confidence) {
    return null
  }

  if (pKnown >= BKT_THRESHOLDS.strong) {
    return 'strong'
  } else if (pKnown < BKT_THRESHOLDS.weak) {
    return 'weak'
  } else {
    return 'developing'
  }
}

/**
 * Check if a skill should be targeted for extra practice.
 * A skill is targeted when it's confidently classified as "weak".
 *
 * @param pKnown - BKT probability of knowing skill [0, 1]
 * @param confidence - BKT confidence in the estimate [0, 1]
 * @returns true if skill should be targeted for practice
 */
export function shouldTargetSkill(pKnown: number, confidence: number): boolean {
  return confidence >= BKT_THRESHOLDS.confidence && pKnown < BKT_THRESHOLDS.weak
}

// =============================================================================
// BKT Confidence Thresholds (Legacy - uses unified thresholds)
// =============================================================================

/**
 * Configuration for BKT-based complexity calculation
 */
export const BKT_INTEGRATION_CONFIG = {
  /**
   * Confidence threshold for trusting BKT continuous multipliers.
   * Below this, we use discrete multipliers (practicing=3, not_practicing=4).
   * Above this, we use BKT P(known) for continuous scaling.
   *
   * @see BKT_THRESHOLDS.confidence for the unified source of truth
   */
  confidenceThreshold: BKT_THRESHOLDS.confidence,

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
// Weak Skill Identification (Legacy - uses unified thresholds)
// =============================================================================

/**
 * @deprecated Use BKT_THRESHOLDS and shouldTargetSkill() instead.
 *
 * Thresholds for identifying weak skills from BKT estimates.
 * Now delegates to unified BKT_THRESHOLDS.
 */
export const WEAK_SKILL_THRESHOLDS = {
  /**
   * P(known) below this = weak skill that needs practice.
   * @deprecated Use BKT_THRESHOLDS.weak instead
   */
  pKnownThreshold: BKT_THRESHOLDS.weak,

  /**
   * Confidence required to trust BKT assessment for targeting.
   * @deprecated Use BKT_THRESHOLDS.confidence instead
   */
  confidenceThreshold: BKT_THRESHOLDS.confidence,
} as const

export type WeakSkillThresholds = typeof WEAK_SKILL_THRESHOLDS

// =============================================================================
// Type Exports
// =============================================================================

export type BktIntegrationConfig = typeof BKT_INTEGRATION_CONFIG
