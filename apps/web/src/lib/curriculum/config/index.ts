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
 * - skill-costs.ts - Base skill complexity and rotation multipliers
 * - bkt-integration.ts - Bayesian Knowledge Tracing integration
 */

// Session Timing
export {
  DEFAULT_SECONDS_PER_PROBLEM,
  MIN_SECONDS_PER_PROBLEM,
  REVIEW_INTERVAL_DAYS,
  SESSION_TIMEOUT_HOURS,
  type ReviewIntervalDays,
} from "./session-timing";

// Slot Distribution
export {
  CHALLENGE_RATIO_BY_PART_TYPE,
  getTermCountRange,
  PART_TIME_WEIGHTS,
  PURPOSE_WEIGHTS,
  TERM_COUNT_RANGES,
  type PartTimeWeights,
  type PurposeWeights,
} from "./slot-distribution";

// Complexity Budgets
export {
  DEFAULT_COMPLEXITY_BUDGETS,
  getComplexityBounds,
  PURPOSE_COMPLEXITY_BOUNDS,
  type PurposeComplexityBounds,
} from "./complexity-budgets";

// Skill Costs
export {
  BASE_SKILL_COMPLEXITY,
  DEFAULT_BASE_COMPLEXITY,
  getBaseComplexity,
  ROTATION_MULTIPLIERS,
} from "./skill-costs";

// BKT Integration
export {
  // Unified thresholds (preferred)
  BKT_THRESHOLDS,
  classifySkill,
  shouldTargetSkill,
  type BktThresholds,
  type SkillClassification,
  // Legacy exports (use unified thresholds internally)
  BKT_INTEGRATION_CONFIG,
  calculateBktMultiplier,
  DEFAULT_PROBLEM_GENERATION_MODE,
  isBktConfident,
  WEAK_SKILL_THRESHOLDS,
  type BktIntegrationConfig,
  type ProblemGenerationMode,
  type WeakSkillThresholds,
} from "./bkt-integration";
