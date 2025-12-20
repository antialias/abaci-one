/**
 * Reinforcement System Configuration
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

export type ReinforcementConfig = typeof REINFORCEMENT_CONFIG
