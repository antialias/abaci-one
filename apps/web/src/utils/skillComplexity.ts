/**
 * Skill Complexity Budget System
 *
 * Cost = baseCost × masteryMultiplier
 *
 * This architecture separates:
 * 1. BASE_SKILL_COMPLEXITY - intrinsic mechanical complexity (constant)
 * 2. SkillCostCalculator - student-aware cost calculation (pluggable)
 */

import {
  calculateFluencyState,
  FLUENCY_CONFIG,
  type FluencyState,
} from '@/db/schema/player-skill-mastery'

// =============================================================================
// Types
// =============================================================================

/**
 * Mastery state affects how much cognitive load a skill requires
 *
 * - 'not_practicing': Skill not in practice rotation (highest cost)
 * - FluencyState values: 'practicing' | 'effortless' | 'fluent' | 'rusty'
 *
 * Note: "rusty" and "practicing" have the same multiplier because both
 * require similar cognitive effort - one is rebuilding, one is building.
 */
export type MasteryState = FluencyState | 'not_practicing'

/**
 * Multipliers for each mastery state (integers only)
 */
export const MASTERY_MULTIPLIERS: Record<MasteryState, number> = {
  effortless: 1, // Fluent + recently practiced (within 14 days) - automatic
  fluent: 2, // Fluent + practiced 14-30 days ago - solid but warming up
  rusty: 3, // Fluent but >30 days since practice - needs rebuilding
  practicing: 3, // In practice rotation but not yet fluent
  not_practicing: 4, // Not in practice rotation - maximum cognitive load
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
// Base Complexity (Intrinsic to skill mechanics)
// =============================================================================

/**
 * Base complexity for each skill - reflects intrinsic mechanical difficulty
 *
 * 0 = Trivial (basic bead movements, no mental calculation)
 * 1 = Single complement (one mental substitution: +4 = +5-1)
 * 2 = Cross-column (must track carry/borrow across place values)
 * 3 = Multi-column cascading (must track propagation across 2+ columns)
 */
export const BASE_SKILL_COMPLEXITY: Record<string, number> = {
  // Base 0: Trivial operations - just moving beads, no mental math
  'basic.directAddition': 0,
  'basic.directSubtraction': 0,
  'basic.heavenBead': 0,
  'basic.heavenBeadSubtraction': 0,
  'basic.simpleCombinations': 0,
  'basic.simpleCombinationsSub': 0,

  // Base 1: Five complements - single mental substitution
  'fiveComplements.4=5-1': 1,
  'fiveComplements.3=5-2': 1,
  'fiveComplements.2=5-3': 1,
  'fiveComplements.1=5-4': 1,
  'fiveComplementsSub.-4=-5+1': 1,
  'fiveComplementsSub.-3=-5+2': 1,
  'fiveComplementsSub.-2=-5+3': 1,
  'fiveComplementsSub.-1=-5+4': 1,

  // Base 2: Ten complements - cross-column operations
  'tenComplements.9=10-1': 2,
  'tenComplements.8=10-2': 2,
  'tenComplements.7=10-3': 2,
  'tenComplements.6=10-4': 2,
  'tenComplements.5=10-5': 2,
  'tenComplements.4=10-6': 2,
  'tenComplements.3=10-7': 2,
  'tenComplements.2=10-8': 2,
  'tenComplements.1=10-9': 2,
  'tenComplementsSub.-9=+1-10': 2,
  'tenComplementsSub.-8=+2-10': 2,
  'tenComplementsSub.-7=+3-10': 2,
  'tenComplementsSub.-6=+4-10': 2,
  'tenComplementsSub.-5=+5-10': 2,
  'tenComplementsSub.-4=+6-10': 2,
  'tenComplementsSub.-3=+7-10': 2,
  'tenComplementsSub.-2=+8-10': 2,
  'tenComplementsSub.-1=+9-10': 2,

  // Base 3: Multi-column cascading
  'advanced.cascadingCarry': 3,
  'advanced.cascadingBorrow': 3,
}

/**
 * Get base complexity for a skill (defaults to 1 for unknown skills)
 */
export function getBaseComplexity(skillId: string): number {
  return BASE_SKILL_COMPLEXITY[skillId] ?? 1
}

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
 * @deprecated Use computeMasteryState instead. Kept for backwards compatibility.
 *
 * Convert database mastery level to our MasteryState (old 3-state model)
 */
export function dbMasteryToState(
  dbLevel: 'learning' | 'practicing' | 'mastered',
  daysSinceLastPractice?: number
): MasteryState {
  if (dbLevel === 'learning') return 'not_practicing'
  if (dbLevel === 'practicing') return 'practicing'

  // Mastered - check recency of practice
  if (daysSinceLastPractice === undefined) {
    // No practice record (e.g., manually marked mastered via offline work)
    // Treat as fluent - needs verification but not rusty
    return 'fluent'
  }

  if (daysSinceLastPractice <= RECENCY_THRESHOLDS.effortlessDays) {
    return 'effortless' // Recently practiced - automatic recall
  }

  if (daysSinceLastPractice <= RECENCY_THRESHOLDS.fluentDays) {
    return 'fluent' // Practiced within a month - solid but needs warming up
  }

  return 'rusty' // >30 days since practice - needs rebuilding
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

/**
 * @deprecated Use buildStudentSkillHistoryFromRecords instead. Kept for backwards compatibility.
 *
 * Build StudentSkillHistory from database records (old masteryLevel model)
 */
export function buildStudentSkillHistory(
  dbRecords: Array<{
    skillId: string
    masteryLevel: 'learning' | 'practicing' | 'mastered'
    lastPracticedAt?: Date | null
  }>,
  referenceDate: Date = new Date()
): StudentSkillHistory {
  const skills: Record<string, StudentSkillState> = {}

  for (const record of dbRecords) {
    const daysSinceMastery = record.lastPracticedAt
      ? Math.floor(
          (referenceDate.getTime() - record.lastPracticedAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      : undefined

    skills[record.skillId] = {
      skillId: record.skillId,
      masteryState: dbMasteryToState(record.masteryLevel, daysSinceMastery),
    }
  }

  return { skills }
}

// =============================================================================
// Budget Defaults
// =============================================================================

/**
 * Default complexity budgets for different contexts
 *
 * These represent the MAXIMUM total cost allowed per term.
 *
 * For a beginner (all skills at not_practicing/4x multiplier):
 *   budget 4 = allows 1 base-1 skill (1×4=4)
 *   budget 8 = allows 2 base-1 skills or 1 base-2 skill
 *
 * For advanced student (all skills effortless/1x):
 *   budget 4 = allows 4 base-1 skills or 2 base-2 skills
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
}
