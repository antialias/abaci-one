/**
 * Skill Complexity Budget System
 *
 * Cost = baseCost × masteryMultiplier
 *
 * This architecture separates:
 * 1. BASE_SKILL_COMPLEXITY - intrinsic mechanical complexity (constant)
 * 2. SkillCostCalculator - student-aware cost calculation (pluggable)
 *
 * TUNING: All tunable constants are in @/lib/curriculum/config/
 */

// Import tunable constants from centralized config
import {
  BASE_SKILL_COMPLEXITY,
  BKT_INTEGRATION_CONFIG,
  calculateBktMultiplier,
  DEFAULT_COMPLEXITY_BUDGETS,
  getBaseComplexity,
  isBktConfident,
  MASTERY_MULTIPLIERS,
  type MasteryState,
  type ProblemGenerationMode,
} from "@/lib/curriculum/config";
import type { SkillBktResult } from "@/lib/curriculum/bkt";

// Re-export for backwards compatibility
export {
  BASE_SKILL_COMPLEXITY,
  DEFAULT_COMPLEXITY_BUDGETS,
  getBaseComplexity,
  MASTERY_MULTIPLIERS,
  type MasteryState,
};

/**
 * Information about a student's relationship with a skill
 */
export interface StudentSkillState {
  skillId: string;
  /** Computed mastery state for cost calculation */
  masteryState: MasteryState;
}

/**
 * Student skill history - all skills and their states
 */
export interface StudentSkillHistory {
  skills: Record<string, StudentSkillState>;
}

/**
 * Options for creating a skill cost calculator
 */
export interface SkillCostCalculatorOptions {
  /**
   * BKT results keyed by skillId.
   * Used for skill targeting in all adaptive modes.
   * Used for cost calculation only in 'adaptive-bkt' mode.
   */
  bktResults?: Map<string, SkillBktResult>;

  /**
   * Problem generation mode:
   * - 'classic': No BKT targeting, discrete cost multipliers (practicing/not_practicing)
   * - 'adaptive': BKT skill targeting, discrete cost multipliers
   * - 'adaptive-bkt': BKT skill targeting, BKT-based continuous multipliers (default)
   */
  mode?: ProblemGenerationMode;
}

/**
 * Interface for calculating skill cost for a student
 * This abstraction allows swapping implementations later
 */
export interface SkillCostCalculator {
  /**
   * Calculate the effective cost of a skill for this student
   */
  calculateSkillCost(skillId: string): number;

  /**
   * Calculate total cost for a set of skills (a term)
   */
  calculateTermCost(skillIds: string[]): number;

  /**
   * Get mastery state for a skill (useful for debug UI)
   */
  getMasteryState(skillId: string): MasteryState;

  /**
   * Get the raw multiplier used for a skill (useful for debug UI)
   */
  getMultiplier(skillId: string): number;

  /**
   * Get BKT result for a skill if available (for transparency)
   */
  getBktResult(skillId: string): SkillBktResult | undefined;

  /**
   * Get the mode being used for this calculator
   */
  getMode(): ProblemGenerationMode;
}

// =============================================================================
// Base Complexity (imported from config)
// =============================================================================
// See @/lib/curriculum/config/skill-costs.ts for BASE_SKILL_COMPLEXITY and getBaseComplexity

// =============================================================================
// Default Implementation: Mastery-Level Based Calculator
// =============================================================================

/**
 * Creates a skill cost calculator based on student's skill history.
 *
 * Cost calculation depends on mode:
 * - 'classic' / 'adaptive': Use discrete multipliers (practicing=3, not_practicing=4)
 * - 'adaptive-bkt': Use BKT P(known) for continuous multipliers (default)
 *
 * Note: In 'adaptive' mode, BKT is used for skill TARGETING but not cost.
 * In 'adaptive-bkt' mode, BKT is used for both targeting AND cost.
 *
 * @param studentHistory - Student's skill history for discrete multipliers fallback
 * @param options - Optional BKT results (for targeting/cost) and mode selection
 */
export function createSkillCostCalculator(
  studentHistory: StudentSkillHistory,
  options: SkillCostCalculatorOptions = {},
): SkillCostCalculator {
  const { bktResults, mode = "adaptive" } = options;

  /**
   * Get multiplier for a skill.
   *
   * Uses BKT P(known) for continuous multipliers when confident.
   * Falls back to discrete multipliers based on isPracticing status
   * when BKT confidence is insufficient.
   */
  function getMultiplierForSkill(skillId: string): number {
    // Use BKT for cost calculation if confident
    if (bktResults) {
      const bktResult = bktResults.get(skillId);
      if (bktResult && isBktConfident(bktResult.confidence)) {
        return calculateBktMultiplier(bktResult.pKnown);
      }
    }

    // Fallback: use discrete multiplier based on isPracticing status
    const skillState = studentHistory.skills[skillId];
    if (!skillState || skillState.masteryState === "not_practicing") {
      return MASTERY_MULTIPLIERS.not_practicing;
    }
    // For practicing skills without confident BKT, use "practicing" multiplier (3.0)
    // This represents "developing/learning" - a reasonable default
    return MASTERY_MULTIPLIERS.practicing;
  }

  return {
    calculateSkillCost(skillId: string): number {
      const baseCost = getBaseComplexity(skillId);
      const multiplier = getMultiplierForSkill(skillId);
      return baseCost * multiplier;
    },

    calculateTermCost(skillIds: string[]): number {
      return skillIds.reduce((total, skillId) => {
        return total + this.calculateSkillCost(skillId);
      }, 0);
    },

    getMasteryState(skillId: string): MasteryState {
      const skillState = studentHistory.skills[skillId];
      if (!skillState) {
        return "not_practicing";
      }
      return skillState.masteryState;
    },

    getMultiplier(skillId: string): number {
      return getMultiplierForSkill(skillId);
    },

    getBktResult(skillId: string): SkillBktResult | undefined {
      return bktResults?.get(skillId);
    },

    getMode(): ProblemGenerationMode {
      return mode;
    },
  };
}

/**
 * Calculate the maximum effective skill cost for a student.
 *
 * This is used to set dynamic budgets - e.g., visualization max budget
 * should be at least as high as the student's most expensive skill,
 * so that skill can appear in visualization practice.
 *
 * @param calculator - The student's cost calculator
 * @param skillIds - List of skill IDs to check (e.g., all mastered skills)
 * @returns The maximum effective cost across all provided skills
 */
export function calculateMaxSkillCost(
  calculator: SkillCostCalculator,
  skillIds: string[],
): number {
  if (skillIds.length === 0) {
    return 0;
  }

  return Math.max(...skillIds.map((id) => calculator.calculateSkillCost(id)));
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Database record shape for skill mastery (new isPracticing model)
 */
export interface DbSkillRecord {
  skillId: string;
  isPracticing: boolean;
  attempts: number;
  correct: number;
  consecutiveCorrect: number;
  lastPracticedAt?: Date | null;
}

/**
 * Compute MasteryState from database record.
 *
 * Simplified: now just returns 'practicing' or 'not_practicing' based on isPracticing flag.
 * BKT handles fine-grained mastery estimation; this is only used as a fallback
 * when BKT confidence is insufficient.
 *
 * @param isPracticing - Whether the skill is in the student's practice rotation
 * @param _attempts - (unused, kept for API compatibility)
 * @param _correct - (unused, kept for API compatibility)
 * @param _consecutiveCorrect - (unused, kept for API compatibility)
 * @param _daysSinceLastPractice - (unused, kept for API compatibility)
 */
export function computeMasteryState(
  isPracticing: boolean,
  _attempts: number,
  _correct: number,
  _consecutiveCorrect: number,
  _daysSinceLastPractice?: number,
): MasteryState {
  // BKT handles fine-grained mastery; this just tracks rotation status
  return isPracticing ? "practicing" : "not_practicing";
}

/**
 * Build StudentSkillHistory from database records (new isPracticing model)
 */
export function buildStudentSkillHistoryFromRecords(
  dbRecords: DbSkillRecord[],
  referenceDate: Date = new Date(),
): StudentSkillHistory {
  const skills: Record<string, StudentSkillState> = {};

  for (const record of dbRecords) {
    const daysSinceLastPractice = record.lastPracticedAt
      ? Math.floor(
          (referenceDate.getTime() - record.lastPracticedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : undefined;

    skills[record.skillId] = {
      skillId: record.skillId,
      masteryState: computeMasteryState(
        record.isPracticing,
        record.attempts,
        record.correct,
        record.consecutiveCorrect,
        daysSinceLastPractice,
      ),
    };
  }

  return { skills };
}

// =============================================================================
// Budget Defaults (imported from config)
// =============================================================================
// See @/lib/curriculum/config/complexity-budgets.ts for DEFAULT_COMPLEXITY_BUDGETS
