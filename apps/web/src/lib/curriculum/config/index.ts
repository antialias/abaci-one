/**
 * Curriculum Configuration
 *
 * Centralized tuning parameters for the daily practice system.
 * Adjust these values to tune difficulty, pacing, and progression.
 *
 * This directory contains:
 *
 * - session-timing.ts - Session duration, timing, review intervals
 * - slot-distribution.ts - Problem distribution across purposes and parts
 * - complexity-budgets.ts - Cognitive load budget system
 * - skill-costs.ts - Base skill complexity and mastery multipliers
 * - fluency-thresholds.ts - When skills become fluent, reinforcement rules
 */

// Session Timing
export {
  DEFAULT_SECONDS_PER_PROBLEM,
  REVIEW_INTERVAL_DAYS,
  SESSION_TIMEOUT_HOURS,
  type ReviewIntervalDays,
} from './session-timing'

// Slot Distribution
export {
  CHALLENGE_RATIO_BY_PART_TYPE,
  getTermCountRange,
  PART_TIME_WEIGHTS,
  PURPOSE_WEIGHTS,
  TERM_COUNT_RANGES,
  type PartTimeWeights,
  type PurposeWeights,
} from './slot-distribution'

// Complexity Budgets
export {
  DEFAULT_COMPLEXITY_BUDGETS,
  getComplexityBounds,
  LEGACY_PART_BUDGETS,
  PURPOSE_COMPLEXITY_BOUNDS,
  type PurposeComplexityBounds,
} from './complexity-budgets'

// Skill Costs
export {
  BASE_SKILL_COMPLEXITY,
  DEFAULT_BASE_COMPLEXITY,
  getBaseComplexity,
  MASTERY_MULTIPLIERS,
  type MasteryState,
} from './skill-costs'

// Fluency Thresholds
export {
  FLUENCY_RECENCY,
  FLUENCY_THRESHOLDS,
  REINFORCEMENT_CONFIG,
  type FluencyRecency,
  type FluencyThresholds,
  type ReinforcementConfig,
} from './fluency-thresholds'
