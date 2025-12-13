/**
 * Fluency Threshold Configuration
 *
 * Defines thresholds for determining when a student has achieved
 * fluency in a skill and how fluency decays over time.
 */

// =============================================================================
// Fluency Achievement Thresholds
// =============================================================================

/**
 * Configuration for determining skill fluency.
 *
 * A student is considered "fluent" in a skill when:
 * 1. They have at least `minimumAttempts` attempts
 * 2. Their accuracy is at least `accuracyThreshold`
 * 3. They have `consecutiveForFluency` consecutive correct answers
 */
export const FLUENCY_THRESHOLDS = {
  /** Number of consecutive correct answers required for fluency */
  consecutiveForFluency: 5,

  /** Minimum total attempts before fluency can be achieved */
  minimumAttempts: 10,

  /** Minimum accuracy (correct/attempts) for fluency (0.85 = 85%) */
  accuracyThreshold: 0.85,
} as const

// =============================================================================
// Fluency Decay (Recency)
// =============================================================================

/**
 * How fluency state changes based on time since last practice.
 *
 * - effortless: Recently practiced, automatic recall
 * - fluent: Solid but may need a moment
 * - rusty: Needs rebuilding (wasn't practiced in time)
 */
export const FLUENCY_RECENCY = {
  /** Days since practice to be considered "effortless" */
  effortlessDays: 14,

  /** Days since practice to be considered "fluent" (beyond this = rusty) */
  fluentDays: 30,
} as const

// =============================================================================
// Reinforcement System
// =============================================================================

/**
 * Configuration for the skill reinforcement system.
 *
 * When a student struggles with a skill (needs heavy help or makes errors),
 * the skill is flagged for reinforcement. This config controls:
 * - What triggers reinforcement
 * - How reinforcement is cleared
 * - How help levels affect mastery credit
 */
export const REINFORCEMENT_CONFIG = {
  /**
   * Help level threshold that triggers reinforcement flag.
   * Level 2+ (decomposition or bead arrows) indicates significant help needed.
   */
  helpLevelThreshold: 2,

  /**
   * Number of consecutive correct answers without heavy help to clear reinforcement.
   */
  streakToClear: 3,

  /**
   * Maximum help level that still counts toward clearing reinforcement.
   * Level 1 (hints) is OK, but Level 2+ resets the streak.
   */
  maxHelpLevelToCount: 1,

  /**
   * Mastery credit multipliers based on help level.
   * Used when updating skill mastery after a correct answer.
   *
   * - 0 (no help): 1.0 = full credit
   * - 1 (hint): 1.0 = full credit (hints don't reduce credit)
   * - 2 (decomposition): 0.5 = half credit
   * - 3 (bead arrows): 0.25 = quarter credit
   */
  creditMultipliers: {
    0: 1.0,
    1: 1.0,
    2: 0.5,
    3: 0.25,
  } as Record<0 | 1 | 2 | 3, number>,
} as const

export type FluencyThresholds = typeof FLUENCY_THRESHOLDS
export type FluencyRecency = typeof FLUENCY_RECENCY
export type ReinforcementConfig = typeof REINFORCEMENT_CONFIG
