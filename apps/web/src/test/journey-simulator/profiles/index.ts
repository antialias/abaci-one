/**
 * Student Profiles for Journey Simulation
 *
 * Each profile represents a different type of learner with:
 * - Different learning RATES (K and n parameters in the Hill function)
 * - Different help usage patterns
 * - ALL profiles start with ZERO exposures (blank slate)
 *
 * The difference between fast/average/slow learners is HOW QUICKLY
 * they acquire mastery through exposure, not prior knowledge.
 */

export {
  AVERAGE_LEARNER_WEAK_SKILLS,
  averageLearnerProfile,
} from './average-learner'
export { FAST_LEARNER_WEAK_SKILLS, fastLearnerProfile } from './fast-learner'
// Per-skill deficiency profiles (comprehensive A/B testing)
export {
  generateAllDeficiencyProfiles,
  generateAllSkillLearnerCombinations,
  generateDeficientProfile,
  getPracticingSkillsForDeficiency,
  getRepresentativeProfiles,
  getRepresentativeProfilesAllLearners,
  LEARNER_TYPES,
  type LearnerType,
  SKILL_ORDER,
} from './per-skill-deficiency'
export { SLOW_LEARNER_WEAK_SKILLS, slowLearnerProfile } from './slow-learner'
export {
  STARK_STRONG_SKILLS,
  STARK_WEAK_SKILLS,
  starkContrastProfile,
} from './stark-contrast'
// Legacy profiles for specific test scenarios (not blank slate)
export {
  STRONG_SKILLS,
  unevenSkillsProfile,
  WEAK_SKILLS,
} from './uneven-skills'

/**
 * All skills used across profiles.
 * These are the skills that the simulator can track.
 */
export const ALL_SKILLS = [
  // Basic addition
  'basic.directAddition',
  'basic.heavenBead',
  'basic.simpleCombinations',
  // Basic subtraction
  'basic.directSubtraction',
  'basic.heavenBeadSubtraction',
  'basic.simpleCombinationsSub',
  // Five complements (addition)
  'fiveComplements.4=5-1',
  'fiveComplements.3=5-2',
  'fiveComplements.2=5-3',
  'fiveComplements.1=5-4',
  // Ten complements (addition)
  'tenComplements.9=10-1',
  'tenComplements.8=10-2',
  'tenComplements.7=10-3',
  'tenComplements.6=10-4',
  'tenComplements.5=10-5',
] as const

/**
 * A minimal set of skills for quick tests.
 * Includes one from each category.
 */
export const MINIMAL_SKILLS = [
  'basic.directAddition',
  'basic.heavenBead',
  'fiveComplements.4=5-1',
  'tenComplements.9=10-1',
] as const

/**
 * Basic skills only - for testing students just starting out.
 */
export const BASIC_SKILLS = [
  'basic.directAddition',
  'basic.heavenBead',
  'basic.simpleCombinations',
] as const
