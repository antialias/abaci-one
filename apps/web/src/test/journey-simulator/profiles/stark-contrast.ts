/**
 * Stark Contrast Profile (Hill Function Model)
 *
 * A student with EXTREME skill gaps designed to trigger weak skill identification:
 * - Very high exposure in basic skills (already mastered)
 * - ZERO exposure in complement skills (never seen before)
 *
 * With K=15, n=2:
 * - 50+ exposures → ~92%+ true probability (strong)
 * - 0 exposures → 0% true probability (will fail every time initially)
 *
 * After ~8 opportunities with consistent failure, BKT should:
 * - Estimate low pKnown (< 0.5)
 * - Build confidence >= 0.3
 * - Trigger weak skill identification
 */

import type { StudentProfile } from '../types'

const initialExposures: Record<string, number> = {
  // Basic skills - VERY HIGH exposure (mastered)
  'basic.directAddition': 60,
  'basic.heavenBead': 55,
  'basic.simpleCombinations': 50,
  'basic.directSubtraction': 55,
  'basic.heavenBeadSubtraction': 50,
  'basic.simpleCombinationsSub': 45,

  // Five complements - ZERO exposure (never seen!)
  // Student will fail these consistently until they get practice
  'fiveComplements.4=5-1': 0,
  'fiveComplements.3=5-2': 0,
  'fiveComplements.2=5-3': 0,
  'fiveComplements.1=5-4': 0,

  // Ten complements - ZERO exposure (never seen!)
  'tenComplements.9=10-1': 0,
  'tenComplements.8=10-2': 0,
  'tenComplements.7=10-3': 0,
  'tenComplements.6=10-4': 0,
  'tenComplements.5=10-5': 0,
}

export const starkContrastProfile: StudentProfile = {
  name: 'Stark Contrast',
  description:
    'Mastered basics (60+ exp), zero complement exposure - designed for weak skill detection',

  // K = 15: Moderate learning rate
  halfMaxExposure: 15,

  // n = 2.0: Standard curve
  hillCoefficient: 2.0,

  initialExposures,

  // Uses less help to make weakness more apparent
  // 70% no help, 30% uses help
  helpUsageProbabilities: [0.7, 0.3],

  // Help bonus: 12% additive when help is used
  helpBonuses: [0, 0.12],

  // Average response time
  baseResponseTimeMs: 5000,

  // Moderate variance
  responseTimeVariance: 0.3,
}

/**
 * Skills that are intentionally WEAK (zero exposure).
 * BKT should identify these after ~8 opportunities with failures.
 */
export const STARK_WEAK_SKILLS = [
  'fiveComplements.4=5-1',
  'fiveComplements.3=5-2',
  'tenComplements.9=10-1',
  'tenComplements.8=10-2',
]

/**
 * Skills that are intentionally STRONG (high exposure).
 * BKT should estimate high pKnown for these.
 */
export const STARK_STRONG_SKILLS = [
  'basic.directAddition',
  'basic.heavenBead',
  'basic.directSubtraction',
]
