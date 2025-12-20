/**
 * Per-Skill Deficiency Profile Generator
 *
 * Creates 32 student profiles - one for each abacus skill being deficient.
 * Each profile has:
 * - All PREREQUISITE skills at high exposure (mastered)
 * - The TARGET skill at 0 exposure (deficient)
 * - The practicingSkills list includes all prerequisites + target skill
 *
 * This enables fair A/B comparison where:
 * - Same student model (Hill function parameters)
 * - Different deficient skill
 * - BKT should identify the specific deficient skill
 * - Adaptive mode should target and improve it faster than classic
 */

import type { StudentProfile } from '../types'

/**
 * Order of skills in curriculum progression
 */
const SKILL_ORDER = [
  // Basic addition
  'basic.directAddition',
  'basic.heavenBead',
  'basic.simpleCombinations',
  // Basic subtraction
  'basic.directSubtraction',
  'basic.heavenBeadSubtraction',
  'basic.simpleCombinationsSub',
  // Five complements addition
  'fiveComplements.4=5-1',
  'fiveComplements.3=5-2',
  'fiveComplements.2=5-3',
  'fiveComplements.1=5-4',
  // Five complements subtraction
  'fiveComplementsSub.-4=-5+1',
  'fiveComplementsSub.-3=-5+2',
  'fiveComplementsSub.-2=-5+3',
  'fiveComplementsSub.-1=-5+4',
  // Ten complements addition
  'tenComplements.9=10-1',
  'tenComplements.8=10-2',
  'tenComplements.7=10-3',
  'tenComplements.6=10-4',
  'tenComplements.5=10-5',
  'tenComplements.4=10-6',
  'tenComplements.3=10-7',
  'tenComplements.2=10-8',
  'tenComplements.1=10-9',
  // Ten complements subtraction
  'tenComplementsSub.-9=+1-10',
  'tenComplementsSub.-8=+2-10',
  'tenComplementsSub.-7=+3-10',
  'tenComplementsSub.-6=+4-10',
  'tenComplementsSub.-5=+5-10',
  'tenComplementsSub.-4=+6-10',
  'tenComplementsSub.-3=+7-10',
  'tenComplementsSub.-2=+8-10',
  'tenComplementsSub.-1=+9-10',
] as const

/**
 * Learner type configurations.
 *
 * Each learner type has different Hill function parameters:
 * - K (halfMaxExposure): Exposures needed for 50% mastery
 * - n (hillCoefficient): Curve steepness (higher = more delayed onset, then steeper)
 * - masteredExposure: Exposures needed for ~90% mastery
 *
 * CALIBRATION NOTES:
 * - With ~26 problems/session and 12 sessions, that's ~312 total problems
 * - A skill getting 1/10 of problems = ~30 exposures over 12 sessions
 * - We want learning to develop GRADUALLY over many sessions
 * - Fast learners should reach 80% around session 6-8
 * - Slow learners should still be improving at session 12
 *
 * Hill function: P(correct) = exposure^n / (K^n + exposure^n)
 */
export const LEARNER_TYPES = {
  fast: {
    name: 'Fast Learner',
    halfMaxExposure: 25,
    hillCoefficient: 2.0,
    /**
     * With K=25, n=2.0:
     * - 10 exposures → 14% (still struggling)
     * - 25 exposures → 50% (halfway)
     * - 50 exposures → 80% (proficient)
     * - 75 exposures → 90% (mastered)
     */
    masteredExposure: 75,
    helpUsageProbabilities: [0.7, 0.2, 0.08, 0.02] as [number, number, number, number],
    helpBonuses: [0, 0.05, 0.12, 0.25] as [number, number, number, number],
    baseResponseTimeMs: 4000,
    responseTimeVariance: 0.25,
  },
  average: {
    name: 'Average Learner',
    halfMaxExposure: 40,
    hillCoefficient: 2.5,
    /**
     * With K=40, n=2.5:
     * - 15 exposures → 5% (struggling)
     * - 30 exposures → 27% (starting to get it)
     * - 40 exposures → 50% (halfway)
     * - 80 exposures → 84% (proficient)
     * - 120 exposures → 94% (mastered)
     */
    masteredExposure: 120,
    helpUsageProbabilities: [0.55, 0.25, 0.15, 0.05] as [number, number, number, number],
    helpBonuses: [0, 0.06, 0.15, 0.3] as [number, number, number, number],
    baseResponseTimeMs: 5500,
    responseTimeVariance: 0.35,
  },
  slow: {
    name: 'Slow Learner',
    halfMaxExposure: 60,
    hillCoefficient: 3.0,
    /**
     * With K=60, n=3.0:
     * - 20 exposures → 4% (struggling)
     * - 40 exposures → 23% (slow progress)
     * - 60 exposures → 50% (halfway)
     * - 100 exposures → 82% (proficient)
     * - 150 exposures → 94% (mastered)
     */
    masteredExposure: 150,
    helpUsageProbabilities: [0.4, 0.3, 0.2, 0.1] as [number, number, number, number],
    helpBonuses: [0, 0.08, 0.18, 0.35] as [number, number, number, number],
    baseResponseTimeMs: 7000,
    responseTimeVariance: 0.4,
  },
} as const

export type LearnerType = keyof typeof LEARNER_TYPES

const DEFAULT_LEARNER_TYPE: LearnerType = 'average'

/**
 * Generate a student profile deficient in a specific skill.
 *
 * @param deficientSkillId - The skill ID that will be at 0 exposure
 * @param learnerType - Type of learner (fast, average, slow)
 */
export function generateDeficientProfile(
  deficientSkillId: string,
  learnerType: LearnerType = DEFAULT_LEARNER_TYPE
): StudentProfile {
  const config = LEARNER_TYPES[learnerType]

  // Find the index of the deficient skill in SKILL_ORDER
  const deficientIndex = SKILL_ORDER.indexOf(deficientSkillId as (typeof SKILL_ORDER)[number])

  if (deficientIndex === -1) {
    throw new Error(`Unknown skill ID: ${deficientSkillId}. Must be one of SKILL_ORDER.`)
  }

  // Build initial exposures:
  // - All skills BEFORE deficientIndex: high exposure (mastered)
  // - The deficient skill itself: 0 exposure
  // - All skills AFTER deficientIndex: 0 exposure (not yet learned)
  const initialExposures: Record<string, number> = {}

  for (let i = 0; i < SKILL_ORDER.length; i++) {
    const skillId = SKILL_ORDER[i]
    if (i < deficientIndex) {
      // Prerequisite skill - mastered
      initialExposures[skillId] = config.masteredExposure
    } else if (i === deficientIndex) {
      // Deficient skill - 0 exposure
      initialExposures[skillId] = 0
    } else {
      // Future skill - not yet learned (0 exposure)
      // These won't be in practicingSkills anyway
      initialExposures[skillId] = 0
    }
  }

  // Human-readable skill name for profile description
  const skillName = getSkillDisplayName(deficientSkillId)

  return {
    name: `${config.name} - Deficient: ${skillName}`,
    description: `${config.name} proficient in all prerequisites, but deficient in ${skillName}`,
    halfMaxExposure: config.halfMaxExposure,
    hillCoefficient: config.hillCoefficient,
    initialExposures,
    helpUsageProbabilities: config.helpUsageProbabilities,
    helpBonuses: config.helpBonuses,
    baseResponseTimeMs: config.baseResponseTimeMs,
    responseTimeVariance: config.responseTimeVariance,
  }
}

/**
 * Get the practicing skills for a deficient profile.
 * Includes all prerequisites + the deficient skill itself.
 */
export function getPracticingSkillsForDeficiency(deficientSkillId: string): string[] {
  const deficientIndex = SKILL_ORDER.indexOf(deficientSkillId as (typeof SKILL_ORDER)[number])

  if (deficientIndex === -1) {
    throw new Error(`Unknown skill ID: ${deficientSkillId}`)
  }

  // Return all skills up to and including the deficient skill
  return SKILL_ORDER.slice(0, deficientIndex + 1) as string[]
}

/**
 * Generate all 32 per-skill deficiency profiles for a given learner type.
 */
export function generateAllDeficiencyProfiles(
  learnerType: LearnerType = DEFAULT_LEARNER_TYPE
): Array<{
  skillId: string
  learnerType: LearnerType
  profile: StudentProfile
  practicingSkills: string[]
}> {
  return SKILL_ORDER.map((skillId) => ({
    skillId,
    learnerType,
    profile: generateDeficientProfile(skillId, learnerType),
    practicingSkills: getPracticingSkillsForDeficiency(skillId),
  }))
}

/**
 * Generate ALL combinations: 32 skills × 3 learner types = 96 profiles.
 */
export function generateAllSkillLearnerCombinations(): Array<{
  skillId: string
  learnerType: LearnerType
  profile: StudentProfile
  practicingSkills: string[]
}> {
  const combinations: Array<{
    skillId: string
    learnerType: LearnerType
    profile: StudentProfile
    practicingSkills: string[]
  }> = []

  for (const learnerType of Object.keys(LEARNER_TYPES) as LearnerType[]) {
    for (const skillId of SKILL_ORDER) {
      combinations.push({
        skillId,
        learnerType,
        profile: generateDeficientProfile(skillId, learnerType),
        practicingSkills: getPracticingSkillsForDeficiency(skillId),
      })
    }
  }

  return combinations
}

/**
 * Get a subset of profiles for faster testing.
 * Selects one skill from each category.
 */
export function getRepresentativeProfiles(learnerType: LearnerType = DEFAULT_LEARNER_TYPE): Array<{
  skillId: string
  learnerType: LearnerType
  profile: StudentProfile
  practicingSkills: string[]
}> {
  const representativeSkills = [
    // Basic (1 from each sub-type)
    'basic.directAddition',
    'basic.heavenBead',
    'basic.simpleCombinations',
    'basic.directSubtraction',
    // Five complements (2 total)
    'fiveComplements.3=5-2',
    'fiveComplementsSub.-3=-5+2',
    // Ten complements (4 total - early, mid, late)
    'tenComplements.9=10-1',
    'tenComplements.5=10-5',
    'tenComplementsSub.-9=+1-10',
    'tenComplementsSub.-5=+5-10',
  ]

  return representativeSkills.map((skillId) => ({
    skillId,
    learnerType,
    profile: generateDeficientProfile(skillId, learnerType),
    practicingSkills: getPracticingSkillsForDeficiency(skillId),
  }))
}

/**
 * Get representative profiles for ALL learner types.
 * Returns 10 skills × 3 learner types = 30 profiles.
 */
export function getRepresentativeProfilesAllLearners(): Array<{
  skillId: string
  learnerType: LearnerType
  profile: StudentProfile
  practicingSkills: string[]
}> {
  const allProfiles: Array<{
    skillId: string
    learnerType: LearnerType
    profile: StudentProfile
    practicingSkills: string[]
  }> = []

  for (const learnerType of Object.keys(LEARNER_TYPES) as LearnerType[]) {
    allProfiles.push(...getRepresentativeProfiles(learnerType))
  }

  return allProfiles
}

/**
 * Human-readable skill names
 */
function getSkillDisplayName(skillId: string): string {
  const names: Record<string, string> = {
    'basic.directAddition': 'Direct Addition',
    'basic.heavenBead': 'Heaven Bead',
    'basic.simpleCombinations': 'Simple Combinations',
    'basic.directSubtraction': 'Direct Subtraction',
    'basic.heavenBeadSubtraction': 'Heaven Bead Subtraction',
    'basic.simpleCombinationsSub': 'Simple Combinations Sub',
    'fiveComplements.4=5-1': '+4 (5-1)',
    'fiveComplements.3=5-2': '+3 (5-2)',
    'fiveComplements.2=5-3': '+2 (5-3)',
    'fiveComplements.1=5-4': '+1 (5-4)',
    'fiveComplementsSub.-4=-5+1': '-4 (-5+1)',
    'fiveComplementsSub.-3=-5+2': '-3 (-5+2)',
    'fiveComplementsSub.-2=-5+3': '-2 (-5+3)',
    'fiveComplementsSub.-1=-5+4': '-1 (-5+4)',
    'tenComplements.9=10-1': '+9 (10-1)',
    'tenComplements.8=10-2': '+8 (10-2)',
    'tenComplements.7=10-3': '+7 (10-3)',
    'tenComplements.6=10-4': '+6 (10-4)',
    'tenComplements.5=10-5': '+5 (10-5)',
    'tenComplements.4=10-6': '+4 (10-6)',
    'tenComplements.3=10-7': '+3 (10-7)',
    'tenComplements.2=10-8': '+2 (10-8)',
    'tenComplements.1=10-9': '+1 (10-9)',
    'tenComplementsSub.-9=+1-10': '-9 (+1-10)',
    'tenComplementsSub.-8=+2-10': '-8 (+2-10)',
    'tenComplementsSub.-7=+3-10': '-7 (+3-10)',
    'tenComplementsSub.-6=+4-10': '-6 (+4-10)',
    'tenComplementsSub.-5=+5-10': '-5 (+5-10)',
    'tenComplementsSub.-4=+6-10': '-4 (+6-10)',
    'tenComplementsSub.-3=+7-10': '-3 (+7-10)',
    'tenComplementsSub.-2=+8-10': '-2 (+8-10)',
    'tenComplementsSub.-1=+9-10': '-1 (+9-10)',
  }
  return names[skillId] || skillId
}

/**
 * Export the skill order for tests
 */
export { SKILL_ORDER }
