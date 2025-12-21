/**
 * Evidence Quality Modifiers
 *
 * Not all observations are equally informative. We adjust the weight
 * of evidence based on:
 * - Help level: Using help = less confident the student really knows it
 * - Response time: Fast correct = strong mastery, slow correct = struggled
 */

import type { HelpLevel } from '@/db/schema/session-plans'

/**
 * Adjust observation weight based on whether help was used.
 * Using help = less confident the student really knows it.
 *
 * @param helpLevel - 0 = no help, 1 = help used
 * @returns Weight multiplier [0.5, 1.0]
 */
export function helpLevelWeight(helpLevel: HelpLevel): number {
  // Guard against unexpected values (legacy data, JSON parsing issues)
  if (helpLevel !== 0 && helpLevel !== 1) {
    return 1.0
  }
  // 0 = no help (full evidence), 1 = used help (50% evidence)
  return helpLevel === 0 ? 1.0 : 0.5
}

/**
 * Adjust observation weight based on response time.
 *
 * The intuition:
 * - Fast correct → strong evidence of mastery (automatic recall)
 * - Slow correct → might have struggled (mastery less certain)
 * - Fast incorrect → careless slip (don't penalize too much)
 * - Slow incorrect → genuine confusion (stronger negative evidence)
 *
 * @param responseTimeMs - Time to answer in milliseconds
 * @param isCorrect - Whether the answer was correct
 * @param expectedTimeMs - Expected response time (default 5000ms)
 * @returns Weight multiplier for the observation
 */
export function responseTimeWeight(
  responseTimeMs: number,
  isCorrect: boolean,
  expectedTimeMs: number = 5000
): number {
  // Guard against invalid values that would produce NaN
  if (
    typeof responseTimeMs !== 'number' ||
    !Number.isFinite(responseTimeMs) ||
    responseTimeMs <= 0
  ) {
    return 1.0 // Neutral weight for invalid data
  }

  const ratio = responseTimeMs / expectedTimeMs

  if (isCorrect) {
    if (ratio < 0.5) return 1.2 // Very fast - strong mastery
    if (ratio > 2.0) return 0.8 // Very slow - struggled
    return 1.0
  } else {
    if (ratio < 0.3) return 0.5 // Very fast error - careless slip
    if (ratio > 2.0) return 1.2 // Very slow error - genuine confusion
    return 1.0
  }
}

/**
 * Combined evidence weight from help and response time.
 */
export function combinedEvidenceWeight(
  helpLevel: HelpLevel,
  responseTimeMs: number,
  isCorrect: boolean,
  expectedTimeMs: number = 5000
): number {
  return helpLevelWeight(helpLevel) * responseTimeWeight(responseTimeMs, isCorrect, expectedTimeMs)
}
