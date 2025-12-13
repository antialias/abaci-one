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

import { calculateFluencyState, FLUENCY_CONFIG } from '@/db/schema/player-skill-mastery'

// Import tunable constants from centralized config
import {
  BASE_SKILL_COMPLEXITY,
  DEFAULT_COMPLEXITY_BUDGETS,
  getBaseComplexity,
  MASTERY_MULTIPLIERS,
  type MasteryState,
} from '@/lib/curriculum/config'

// Re-export for backwards compatibility
export {
  BASE_SKILL_COMPLEXITY,
  DEFAULT_COMPLEXITY_BUDGETS,
  getBaseComplexity,
  MASTERY_MULTIPLIERS,
  type MasteryState,
}

/**
 * Thresholds for determining mastery state from recency
 * @deprecated Use FLUENCY_CONFIG from player-skill-mastery.ts instead
 */
export const RECENCY_THRESHOLDS = {
  /** Days since practice to still be considered "effortless" */
  effortlessDays: FLUENCY_CONFIG.effortlessDays,
  /** Days since practice to still be considered "fluent" (before becoming rusty) */
  fluentDays: FLUENCY_CONFIG.fluentDays,
}

/**
 * Information about a student's relationship with a skill
 */
export interface StudentSkillState {
  skillId: string
  /** Computed mastery state for cost calculation */
  masteryState: MasteryState
}

/**
 * Student skill history - all skills and their states
 */
export interface StudentSkillHistory {
  skills: Record<string, StudentSkillState>
}

/**
 * Interface for calculating skill cost for a student
 * This abstraction allows swapping implementations later
 */
export interface SkillCostCalculator {
  /**
   * Calculate the effective cost of a skill for this student
   */
  calculateSkillCost(skillId: string): number

  /**
   * Calculate total cost for a set of skills (a term)
   */
  calculateTermCost(skillIds: string[]): number

  /**
   * Get mastery state for a skill (useful for debug UI)
   */
  getMasteryState(skillId: string): MasteryState
}

// =============================================================================
// Base Complexity (imported from config)
// =============================================================================
// See @/lib/curriculum/config/skill-costs.ts for BASE_SKILL_COMPLEXITY and getBaseComplexity

// =============================================================================
// Default Implementation: Mastery-Level Based Calculator
// =============================================================================

/**
 * Creates a skill cost calculator based on student's skill history
 *
 * This is the default implementation that uses mastery levels.
 * Can be replaced with more sophisticated implementations later.
 */
export function createSkillCostCalculator(
  studentHistory: StudentSkillHistory
): SkillCostCalculator {
  return {
    calculateSkillCost(skillId: string): number {
      const baseCost = getBaseComplexity(skillId)
      const multiplier = getMasteryMultiplier(skillId, studentHistory)
      return baseCost * multiplier
    },

    calculateTermCost(skillIds: string[]): number {
      return skillIds.reduce((total, skillId) => {
        return total + this.calculateSkillCost(skillId)
      }, 0)
    },

    getMasteryState(skillId: string): MasteryState {
      const skillState = studentHistory.skills[skillId]
      if (!skillState) {
        return 'not_practicing'
      }
      return skillState.masteryState
    },
  }
}

/**
 * Get mastery multiplier for a skill based on student history
 */
function getMasteryMultiplier(skillId: string, history: StudentSkillHistory): number {
  const skillState = history.skills[skillId]

  // Unknown skill = treat as not_practicing (maximum cost)
  if (!skillState) {
    return MASTERY_MULTIPLIERS.not_practicing
  }

  return MASTERY_MULTIPLIERS[skillState.masteryState]
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
export function calculateMaxSkillCost(calculator: SkillCostCalculator, skillIds: string[]): number {
  if (skillIds.length === 0) {
    return 0
  }

  return Math.max(...skillIds.map((id) => calculator.calculateSkillCost(id)))
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Database record shape for skill mastery (new isPracticing model)
 */
export interface DbSkillRecord {
  skillId: string
  isPracticing: boolean
  attempts: number
  correct: number
  consecutiveCorrect: number
  lastPracticedAt?: Date | null
}

/**
 * Compute MasteryState from database record using the new isPracticing model.
 *
 * - If isPracticing is false → 'not_practicing' (highest cost)
 * - If isPracticing is true → compute fluency from practice history
 *
 * @param isPracticing - Whether the skill is in the student's practice rotation
 * @param attempts - Total number of attempts
 * @param correct - Number of correct answers
 * @param consecutiveCorrect - Current consecutive correct streak
 * @param daysSinceLastPractice - Days since last practiced (undefined = never practiced)
 */
export function computeMasteryState(
  isPracticing: boolean,
  attempts: number,
  correct: number,
  consecutiveCorrect: number,
  daysSinceLastPractice?: number
): MasteryState {
  // Not in practice rotation = highest cost
  if (!isPracticing) {
    return 'not_practicing'
  }

  // In practice rotation - compute fluency state from history
  return calculateFluencyState(attempts, correct, consecutiveCorrect, daysSinceLastPractice)
}

/**
 * Build StudentSkillHistory from database records (new isPracticing model)
 */
export function buildStudentSkillHistoryFromRecords(
  dbRecords: DbSkillRecord[],
  referenceDate: Date = new Date()
): StudentSkillHistory {
  const skills: Record<string, StudentSkillState> = {}

  for (const record of dbRecords) {
    const daysSinceLastPractice = record.lastPracticedAt
      ? Math.floor(
          (referenceDate.getTime() - record.lastPracticedAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      : undefined

    skills[record.skillId] = {
      skillId: record.skillId,
      masteryState: computeMasteryState(
        record.isPracticing,
        record.attempts,
        record.correct,
        record.consecutiveCorrect,
        daysSinceLastPractice
      ),
    }
  }

  return { skills }
}

// =============================================================================
// Budget Defaults (imported from config)
// =============================================================================
// See @/lib/curriculum/config/complexity-budgets.ts for DEFAULT_COMPLEXITY_BUDGETS
