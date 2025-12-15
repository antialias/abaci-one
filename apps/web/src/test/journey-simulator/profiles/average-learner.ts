/**
 * Average Learner Profile (Hill Function Model)
 *
 * A student with typical learning characteristics:
 * - Medium K value (reaches 50% mastery at 12 exposures)
 * - Standard hill coefficient (balanced curve)
 * - Most skills learned normally, but MISSED the five complements lesson
 * - Moderate help usage
 *
 * REALISTIC SCENARIO: Student wasn't paying attention during five complements.
 * They understand basics and can do ten complements, but five complements confuse them.
 *
 * With K=12, n=2.0:
 * - 36+ exposures → P ≈ 90%+ (strong skills - HIGH CONTRAST)
 * - 0 exposures → P = 0% (missed skills)
 *
 * KEY: Strong skills must be ~90%+ for BKT to distinguish from weak (0%)
 */

import type { StudentProfile } from '../types'

/**
 * Average learner who missed five complements lesson.
 * Strong in basics and ten complements, weak in five complements.
 */
const initialExposures: Record<string, number> = {
  // Basic skills - well learned (40 exposures → ~92%)
  'basic.directAddition': 40,
  'basic.heavenBead': 38,
  'basic.simpleCombinations': 36,
  'basic.directSubtraction': 38,
  'basic.heavenBeadSubtraction': 36,
  'basic.simpleCombinationsSub': 35,
  // Five complements - MISSED THIS LESSON (0 exposures → 0%)
  'fiveComplements.4=5-1': 0,
  'fiveComplements.3=5-2': 0,
  'fiveComplements.2=5-3': 0,
  'fiveComplements.1=5-4': 0,
  // Ten complements - well learned (36 exposures → ~90%)
  'tenComplements.9=10-1': 40,
  'tenComplements.8=10-2': 38,
  'tenComplements.7=10-3': 36,
  'tenComplements.6=10-4': 36,
  'tenComplements.5=10-5': 36,
}

/** Skills this student is weak at (for test validation) */
export const AVERAGE_LEARNER_WEAK_SKILLS = [
  'fiveComplements.4=5-1',
  'fiveComplements.3=5-2',
  'fiveComplements.2=5-3',
  'fiveComplements.1=5-4',
]

export const averageLearnerProfile: StudentProfile = {
  name: 'Average Learner (Missed Five Complements)',
  description: 'Strong in basics and tens, missed five complements lesson',

  // K = 12: Reaches 50% proficiency at 12 exposures (average)
  halfMaxExposure: 12,

  // n = 2.0: Standard curve with balanced onset
  hillCoefficient: 2.0,

  initialExposures,

  // Moderate help usage: 55% no help, 25% hint, 15% decomp, 5% full
  helpUsageProbabilities: [0.55, 0.25, 0.15, 0.05],

  // Standard help bonuses
  helpBonuses: [0, 0.06, 0.15, 0.3],

  // Average response time
  baseResponseTimeMs: 5500,

  // Moderate variance
  responseTimeVariance: 0.35,
}
