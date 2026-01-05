/**
 * Uneven Skills Profile (Hill Function Model)
 *
 * A student with significant gaps in their skill exposure:
 * - High exposure in basic skills (already practiced)
 * - Low exposure in complement skills (newly introduced)
 *
 * This profile is ideal for testing BKT's ability to:
 * 1. Identify weak skills (low exposure → low P(correct))
 * 2. Adapt problem generation to focus on weak areas
 * 3. Improve weak skills over time through targeted practice
 */

import type { StudentProfile } from "../types";

/**
 * Uneven exposures - strong in basics, weak in complements.
 * Using Hill function with K=12, n=2.0:
 * - 0 exposures → P = 0%
 * - 3 exposures → P ≈ 5%
 * - 6 exposures → P ≈ 20%
 * - 12 exposures → P = 50% (by definition of K)
 * - 20 exposures → P ≈ 74%
 * - 30 exposures → P ≈ 86%
 */
const initialExposures: Record<string, number> = {
  // Basic skills - HIGH exposure (already proficient)
  "basic.directAddition": 35,
  "basic.heavenBead": 30,
  "basic.simpleCombinations": 25,
  "basic.directSubtraction": 32,
  "basic.heavenBeadSubtraction": 28,
  "basic.simpleCombinationsSub": 22,

  // Five complements - LOW exposure (newly introduced, struggling)
  "fiveComplements.4=5-1": 5,
  "fiveComplements.3=5-2": 4,
  "fiveComplements.2=5-3": 2, // Extra weak
  "fiveComplements.1=5-4": 2, // Extra weak

  // Ten complements - VERY LOW exposure (confusing, errors often)
  "tenComplements.9=10-1": 2,
  "tenComplements.8=10-2": 1,
  "tenComplements.7=10-3": 1,
  "tenComplements.6=10-4": 0, // Never seen
  "tenComplements.5=10-5": 0, // Never seen
};

export const unevenSkillsProfile: StudentProfile = {
  name: "Uneven Skills",
  description:
    "Strong in basics (30+ exposures), weak in complements (0-5 exposures)",

  // K = 12: Reaches 50% proficiency at 12 exposures (average)
  halfMaxExposure: 12,

  // n = 2.0: Standard curve with some delayed onset
  hillCoefficient: 2.0,

  initialExposures,

  // Moderate help usage: 55% no help, 45% uses help
  helpUsageProbabilities: [0.55, 0.45],

  // Help bonus: 15% additive when help is used
  helpBonuses: [0, 0.15],

  // Average response time
  baseResponseTimeMs: 5500,

  // Moderate variance
  responseTimeVariance: 0.35,
};

/**
 * Skills that are intentionally weak in this profile (low exposure).
 * Useful for validation tests to check if BKT identifies these.
 *
 * With K=12, n=2.0:
 * - 0 exposures → P = 0%
 * - 2 exposures → P ≈ 2.7%
 */
export const WEAK_SKILLS = [
  "fiveComplements.2=5-3", // 2 exposures → ~2.7%
  "fiveComplements.1=5-4", // 2 exposures → ~2.7%
  "tenComplements.6=10-4", // 0 exposures → 0%
  "tenComplements.5=10-5", // 0 exposures → 0%
];

/**
 * Skills that are strong in this profile (high exposure).
 *
 * With K=12, n=2.0:
 * - 30+ exposures → P ≈ 86%+
 */
export const STRONG_SKILLS = [
  "basic.directAddition", // 35 exposures → ~89%
  "basic.heavenBead", // 30 exposures → ~86%
  "basic.directSubtraction", // 32 exposures → ~88%
];
