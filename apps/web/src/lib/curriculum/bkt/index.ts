/**
 * BKT (Bayesian Knowledge Tracing) Module
 *
 * Provides epistemologically honest skill mastery estimates using
 * Conjunctive Bayesian Knowledge Tracing.
 *
 * Key concepts:
 * - P(known): Probability that the student has mastered a skill
 * - Confidence: How certain we are about the P(known) estimate
 * - Conjunctive model: For multi-skill problems, correct = all skills worked,
 *   incorrect = at least one failed (blame distributed probabilistically)
 *
 * Usage:
 * ```typescript
 * import { computeBktFromHistory } from '@/lib/curriculum/bkt'
 *
 * const results = await getRecentSessionResults(playerId, 50)
 * const bkt = computeBktFromHistory(results)
 *
 * // Access results
 * console.log(bkt.skills)            // All skills with P(known)
 * console.log(bkt.interventionNeeded) // Skills that need attention
 * console.log(bkt.strengths)          // Mastered skills
 * ```
 */

// Main computation
export {
  type BktComputeExtendedOptions,
  computeBktFromHistory,
  DEFAULT_BKT_OPTIONS,
  recomputeWithOptions,
} from './compute-bkt'

// Types
export type {
  BktComputeOptions,
  BktComputeResult,
  BktParams,
  BktSkillState,
  BlameDistribution,
  MasteryClassification,
  SkillBktRecord,
  SkillBktResult,
} from './types'

// Confidence utilities
export {
  calculateConfidence,
  getConfidenceLabel,
  getStalenessWarning,
  getUncertaintyRange,
} from './confidence'

// Skill priors
export { getDefaultParams, getSkillCategory } from './skill-priors'

// Evidence quality (for advanced use cases)
export {
  combinedEvidenceWeight,
  helpLevelWeight,
  responseTimeWeight,
} from './evidence-quality'

// Core BKT (for testing/advanced use)
export { applyLearning, bktUpdate } from './bkt-core'
export {
  bayesianUpdateOnIncorrect,
  updateOnCorrect,
  updateOnIncorrect,
  updateOnIncorrectWithMethod,
  type BlameMethod,
} from './conjunctive-bkt'
