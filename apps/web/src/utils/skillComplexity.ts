/**
 * Skill Complexity Budget System
 *
 * Cost = baseCost × masteryMultiplier
 *
 * This architecture separates:
 * 1. BASE_SKILL_COMPLEXITY - intrinsic mechanical complexity (constant)
 * 2. SkillCostCalculator - student-aware cost calculation (pluggable)
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Mastery state affects how much cognitive load a skill requires
 */
export type MasteryState = 'effortless' | 'fluent' | 'practicing' | 'learning'

/**
 * Multipliers for each mastery state
 */
export const MASTERY_MULTIPLIERS: Record<MasteryState, number> = {
  effortless: 1, // Automatic, no thought required
  fluent: 2, // Solid but needs some attention
  practicing: 3, // Currently working on, needs focus
  learning: 4, // Just introduced, maximum effort
}

/**
 * Information about a student's relationship with a skill
 */
export interface StudentSkillState {
  skillId: string
  masteryLevel: MasteryState
  // Future extensions:
  // lastPracticedAt?: Date
  // recentAccuracy?: number
  // consecutiveCorrect?: number
  // daysSinceMastery?: number
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
        return 'learning'
      }
      return skillState.masteryLevel
    },
  }
}

/**
 * Get mastery multiplier for a skill based on student history
 */
function getMasteryMultiplier(skillId: string, history: StudentSkillHistory): number {
  const skillState = history.skills[skillId]

  // Unknown skill = treat as learning (maximum cost)
  if (!skillState) {
    return MASTERY_MULTIPLIERS.learning
  }

  return MASTERY_MULTIPLIERS[skillState.masteryLevel]
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert database mastery level to our MasteryState
 *
 * Database has: 'learning' | 'practicing' | 'mastered'
 * We add 'effortless' for long-mastered skills
 */
export function dbMasteryToState(
  dbLevel: 'learning' | 'practicing' | 'mastered',
  daysSinceMastery?: number
): MasteryState {
  if (dbLevel === 'learning') return 'learning'
  if (dbLevel === 'practicing') return 'practicing'

  // Mastered - check how long ago
  if (daysSinceMastery !== undefined && daysSinceMastery > 30) {
    return 'effortless'
  }
  return 'fluent'
}

/**
 * Build StudentSkillHistory from database records
 */
export function buildStudentSkillHistory(
  dbRecords: Array<{
    skillId: string
    masteryLevel: 'learning' | 'practicing' | 'mastered'
    lastPracticedAt?: Date | null
    // Could add more fields for future sophistication
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
      masteryLevel: dbMasteryToState(record.masteryLevel, daysSinceMastery),
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
 * For a beginner (all skills at learning/4x multiplier):
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
