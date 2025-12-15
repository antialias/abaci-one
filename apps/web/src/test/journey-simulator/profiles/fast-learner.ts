/**
 * Fast Learner Profile (Hill Function Model)
 *
 * A student who quickly acquires mastery:
 * - Low K value (reaches 50% mastery with fewer exposures)
 * - Low hill coefficient (smooth learning curve, quick initial gains)
 * - Most skills learned normally, but MISSED the ten complements lesson
 * - Rarely needs help
 *
 * REALISTIC SCENARIO: Student was sick the day ten complements were taught.
 * They're good at basics and five complements, but struggle with ten complements.
 *
 * With K=8, n=1.5:
 * - 20 exposures → P ≈ 86% (strong skills)
 * - 0 exposures → P = 0% (missed skills - will fail until practiced)
 */

import type { StudentProfile } from '../types'

/**
 * Fast learner who missed ten complements lesson.
 * Strong in basics and five complements, weak in ten complements.
 */
const initialExposures: Record<string, number> = {
  // Basic skills - learned normally (20 exposures → ~86%)
  'basic.directAddition': 20,
  'basic.heavenBead': 18,
  'basic.simpleCombinations': 16,
  'basic.directSubtraction': 18,
  'basic.heavenBeadSubtraction': 16,
  'basic.simpleCombinationsSub': 14,
  // Five complements - learned normally (15 exposures → ~77%)
  'fiveComplements.4=5-1': 15,
  'fiveComplements.3=5-2': 14,
  'fiveComplements.2=5-3': 13,
  'fiveComplements.1=5-4': 12,
  // Ten complements - MISSED THIS LESSON (0 exposures → 0%)
  'tenComplements.9=10-1': 0,
  'tenComplements.8=10-2': 0,
  'tenComplements.7=10-3': 0,
  'tenComplements.6=10-4': 0,
  'tenComplements.5=10-5': 0,
}

/** Skills this student is weak at (for test validation) */
export const FAST_LEARNER_WEAK_SKILLS = [
  'tenComplements.9=10-1',
  'tenComplements.8=10-2',
  'tenComplements.7=10-3',
  'tenComplements.6=10-4',
  'tenComplements.5=10-5',
]

export const fastLearnerProfile: StudentProfile = {
  name: 'Fast Learner (Missed Ten Complements)',
  description: 'Strong in basics, missed ten complements lesson, learns quickly',

  // K = 8: Reaches 50% proficiency at 8 exposures (fast)
  halfMaxExposure: 8,

  // n = 1.5: Smooth curve, quick initial gains
  hillCoefficient: 1.5,

  initialExposures,

  // Rarely needs help: 70% no help, 20% hint, 8% decomp, 2% full
  helpUsageProbabilities: [0.7, 0.2, 0.08, 0.02],

  // Help bonuses (additive to probability)
  helpBonuses: [0, 0.05, 0.12, 0.25],

  // Relatively fast responses
  baseResponseTimeMs: 4000,

  // Low variance (consistent)
  responseTimeVariance: 0.25,
}
