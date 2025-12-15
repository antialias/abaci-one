/**
 * Slow Learner Profile (Hill Function Model)
 *
 * A student who needs more practice to acquire mastery:
 * - High K value (needs more exposures to reach 50%)
 * - Higher hill coefficient (delayed onset, then improvement)
 * - Most skills learned (with extra practice), but MISSED subtraction concepts
 * - Uses help more often
 *
 * REALISTIC SCENARIO: Student struggles with subtraction generally.
 * They've had extra practice on addition but subtraction never clicked.
 *
 * With K=15, n=2.5 (reduced K for achievable mastery):
 * - 40 exposures → P ≈ 91% (strong skills - HIGH CONTRAST)
 * - 0 exposures → P = 0% (missed skills)
 *
 * KEY: K=15 instead of K=20 so strong skills can reach 90%+
 */

import type { StudentProfile } from '../types'

/**
 * Slow learner who missed subtraction concepts.
 * Strong in addition (with extra practice), weak in all subtraction.
 */
const initialExposures: Record<string, number> = {
  // Basic addition - well learned with extra practice (45 exposures → ~93%)
  'basic.directAddition': 45,
  'basic.heavenBead': 42,
  'basic.simpleCombinations': 40,
  // Basic subtraction - MISSED/STRUGGLING (0 exposures → 0%)
  'basic.directSubtraction': 0,
  'basic.heavenBeadSubtraction': 0,
  'basic.simpleCombinationsSub': 0,
  // Five complements addition - well learned (40 exposures → ~91%)
  'fiveComplements.4=5-1': 42,
  'fiveComplements.3=5-2': 40,
  'fiveComplements.2=5-3': 38,
  'fiveComplements.1=5-4': 38,
  // Ten complements - well learned (38 exposures → ~89%)
  'tenComplements.9=10-1': 42,
  'tenComplements.8=10-2': 40,
  'tenComplements.7=10-3': 38,
  'tenComplements.6=10-4': 38,
  'tenComplements.5=10-5': 38,
}

/** Skills this student is weak at (for test validation) */
export const SLOW_LEARNER_WEAK_SKILLS = [
  'basic.directSubtraction',
  'basic.heavenBeadSubtraction',
  'basic.simpleCombinationsSub',
]

export const slowLearnerProfile: StudentProfile = {
  name: 'Slow Learner (Missed Subtraction)',
  description: 'Strong in addition, missed subtraction concepts, learns slowly',

  // K = 15: Reaches 50% proficiency at 15 exposures (slow but achievable)
  halfMaxExposure: 15,

  // n = 2.5: Delayed onset - slow start, then improvement kicks in
  hillCoefficient: 2.5,

  initialExposures,

  // Uses help often: 40% no help, 30% hint, 20% decomp, 10% full
  helpUsageProbabilities: [0.4, 0.3, 0.2, 0.1],

  // Higher help bonuses (helps more when used)
  helpBonuses: [0, 0.08, 0.18, 0.35],

  // Takes longer to respond
  baseResponseTimeMs: 8000,

  // More variable (sometimes fast guesses, sometimes slow thinking)
  responseTimeVariance: 0.4,
}
