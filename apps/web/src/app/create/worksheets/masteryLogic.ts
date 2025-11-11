/**
 * Mastery Mode Logic
 *
 * Functions for review selection, problem distribution, and mastery worksheet generation.
 * Used by the worksheet generator to mix current skill practice with review problems.
 */

import type { WorksheetMastery } from '@/db/schema'
import { SKILL_DEFINITIONS, type SkillDefinition, type SkillId, getSkillById } from './skills'
import type { WorksheetConfig } from '@/app/create/worksheets/types'

/**
 * Mastery state map: skill ID -> mastery record
 */
export type MasteryStateMap = Map<SkillId, WorksheetMastery>

/**
 * Review selection result
 */
export interface ReviewSelection {
  /** Skills to include in review */
  skills: SkillDefinition[]
  /** Number of problems per skill */
  problemsPerSkill: Map<SkillId, number>
  /** Total review problems */
  totalProblems: number
}

/**
 * Mastery worksheet mix
 */
export interface MasteryWorksheetMix {
  /** Current skill being practiced */
  currentSkill: SkillDefinition
  /** Number of current skill problems */
  currentSkillProblems: number
  /** Review selection */
  review: ReviewSelection
  /** Total problems in worksheet */
  totalProblems: number
  /** Mix ratio (0-1, where 0.25 = 25% review) */
  mixRatio: number
}

/**
 * Get review skills for a given current skill, filtered by mastery state
 *
 * @param currentSkill - The skill being practiced
 * @param masteryStates - Map of skill IDs to mastery records
 * @param selectedReviewSkills - Optional manual override of which review skills to include
 * @returns Array of review skills (only mastered skills from recommendedReview)
 */
export function getReviewSkills(
  currentSkill: SkillDefinition,
  masteryStates: MasteryStateMap,
  selectedReviewSkills?: SkillId[]
): SkillDefinition[] {
  // If user manually selected review skills, use those (filtered by mastery)
  if (selectedReviewSkills && selectedReviewSkills.length > 0) {
    return selectedReviewSkills
      .filter((skillId) => {
        const masteryState = masteryStates.get(skillId)
        return masteryState?.isMastered === true
      })
      .map((skillId) => getSkillById(skillId))
      .filter((skill): skill is SkillDefinition => skill !== undefined)
  }

  // Otherwise, use recommended review skills (filtered by mastery)
  return currentSkill.recommendedReview
    .filter((skillId) => {
      const masteryState = masteryStates.get(skillId)
      return masteryState?.isMastered === true
    })
    .map((skillId) => getSkillById(skillId))
    .filter((skill): skill is SkillDefinition => skill !== undefined)
}

/**
 * Distribute review problem count across review skills
 *
 * @param reviewSkills - Array of review skills
 * @param totalReviewProblems - Total number of review problems to distribute
 * @returns Map of skill ID to problem count
 */
export function distributeReviewProblems(
  reviewSkills: SkillDefinition[],
  totalReviewProblems: number
): Map<SkillId, number> {
  const distribution = new Map<SkillId, number>()

  if (reviewSkills.length === 0) {
    return distribution
  }

  // Simple strategy: distribute evenly, with remainder going to first skills
  const baseCount = Math.floor(totalReviewProblems / reviewSkills.length)
  const remainder = totalReviewProblems % reviewSkills.length

  reviewSkills.forEach((skill, index) => {
    const count = baseCount + (index < remainder ? 1 : 0)
    if (count > 0) {
      distribution.set(skill.id, count)
    }
  })

  return distribution
}

/**
 * Calculate mastery worksheet mix
 *
 * @param currentSkillId - The skill being practiced
 * @param masteryStates - Map of skill IDs to mastery records
 * @param totalProblems - Total problems in worksheet
 * @param mixRatio - Review ratio (0-1, where 0.25 = 25% review)
 * @param selectedReviewSkills - Optional manual override of which review skills to include
 * @returns Mastery worksheet mix breakdown
 */
export function calculateMasteryMix(
  currentSkillId: SkillId,
  masteryStates: MasteryStateMap,
  totalProblems: number,
  mixRatio: number = 0.25,
  selectedReviewSkills?: SkillId[]
): MasteryWorksheetMix {
  const currentSkill = getSkillById(currentSkillId)
  if (!currentSkill) {
    throw new Error(`Skill not found: ${currentSkillId}`)
  }

  // Clamp mix ratio to 0-1
  const clampedRatio = Math.max(0, Math.min(1, mixRatio))

  // Calculate problem counts
  const reviewProblemCount = Math.floor(totalProblems * clampedRatio)
  const currentProblemCount = totalProblems - reviewProblemCount

  // Get review skills
  const reviewSkills = getReviewSkills(currentSkill, masteryStates, selectedReviewSkills)

  // Distribute review problems
  const problemsPerSkill = distributeReviewProblems(reviewSkills, reviewProblemCount)

  return {
    currentSkill,
    currentSkillProblems: currentProblemCount,
    review: {
      skills: reviewSkills,
      problemsPerSkill,
      totalProblems: reviewProblemCount,
    },
    totalProblems,
    mixRatio: clampedRatio,
  }
}

/**
 * Convert skill definition to WorksheetConfig for problem generation
 *
 * This is the bridge between mastery mode and smart mode.
 * Each skill's configuration (digitRange, regrouping, scaffolding) maps directly
 * to a Smart Mode configuration.
 *
 * @param skill - Skill definition
 * @param problemCount - Number of problems to generate for this skill
 * @returns WorksheetConfig for problem generation
 */
export function skillToConfig(
  skill: SkillDefinition,
  problemCount: number
): Partial<WorksheetConfig> {
  return {
    version: 4,
    mode: 'smart',

    // Digit range from skill
    digitRange: skill.digitRange,

    // Regrouping configuration from skill
    pAnyStart: skill.regroupingConfig.pAnyStart,
    pAllStart: skill.regroupingConfig.pAllStart,

    // Scaffolding from skill
    displayRules: skill.recommendedScaffolding,

    // Problem count
    problemsPerPage: problemCount,

    // Operator from skill
    operator: skill.operator,
  }
}

/**
 * Generate worksheet configuration for mastery mode
 *
 * This function takes a mastery mix and converts it into a configuration
 * that can be used to generate problems. It's the final step before problem generation.
 *
 * @param mix - Mastery worksheet mix
 * @returns WorksheetConfig for the entire worksheet
 */
export function generateMasteryWorksheetConfig(
  mix: MasteryWorksheetMix
): Partial<WorksheetConfig> & {
  _masteryMix?: {
    currentSkillId: SkillId
    currentSkillProblems: number
    reviewProblems: number
    reviewSkills: SkillId[]
    reviewProblemCounts: Record<string, number>
    mixRatio: number
  }
} {
  // Start with current skill config
  const config = skillToConfig(mix.currentSkill, mix.totalProblems)

  // Add mastery-specific metadata for UI observability
  // (This is stored separately and not persisted to the schema)
  return {
    ...config,

    // Store review breakdown for observability
    // (This can be used by the UI to show what's in the mix)
    _masteryMix: {
      currentSkillId: mix.currentSkill.id,
      currentSkillProblems: mix.currentSkillProblems,
      reviewProblems: mix.review.totalProblems,
      reviewSkills: mix.review.skills.map((s) => s.id),
      reviewProblemCounts: Object.fromEntries(mix.review.problemsPerSkill),
      mixRatio: mix.mixRatio,
    },
  }
}

/**
 * Helper: Get mastery state for a skill (or create default if not exists)
 *
 * @param skillId - Skill ID
 * @param masteryStates - Map of skill IDs to mastery records
 * @returns Mastery state (or default state if not found)
 */
export function getMasteryState(
  skillId: SkillId,
  masteryStates: MasteryStateMap
): WorksheetMastery | { isMastered: false } {
  return masteryStates.get(skillId) || { isMastered: false }
}

/**
 * Helper: Check if a skill's prerequisites are met
 *
 * @param skill - Skill definition
 * @param masteryStates - Map of skill IDs to mastery records
 * @returns True if all prerequisites are mastered
 */
export function arePrerequisitesMet(
  skill: SkillDefinition,
  masteryStates: MasteryStateMap
): boolean {
  return skill.prerequisites.every((prereqId) => {
    const state = getMasteryState(prereqId, masteryStates)
    return state.isMastered === true
  })
}

/**
 * Helper: Get next available skill (first skill with unmet prerequisites or not mastered)
 *
 * @param operator - "addition" or "subtraction"
 * @param masteryStates - Map of skill IDs to mastery records
 * @returns Next skill to practice, or undefined if all mastered
 */
export function getNextAvailableSkill(
  operator: 'addition' | 'subtraction',
  masteryStates: MasteryStateMap
): SkillDefinition | undefined {
  const skills = SKILL_DEFINITIONS.filter((s) => s.operator === operator)

  // Find first skill that is not mastered
  return skills.find((skill) => {
    const state = getMasteryState(skill.id, masteryStates)
    return state.isMastered !== true
  })
}
