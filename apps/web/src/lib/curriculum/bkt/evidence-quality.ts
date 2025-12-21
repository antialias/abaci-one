/**
 * Evidence Quality Modifiers
 *
 * Not all observations are equally informative. We adjust the weight
 * of evidence based on:
 * - Help usage: Using help = less confident the student really knows it
 * - Response time: Fast correct = strong mastery, slow correct = struggled
 */

/**
 * Adjust observation weight based on whether help was used.
 * Using help = less confident the student really knows it.
 *
 * @param hadHelp - true if help was used, false otherwise
 * @returns Weight multiplier [0.5, 1.0]
 */
export function helpWeight(hadHelp: boolean): number {
  return hadHelp ? 0.5 : 1.0
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
 * Combined evidence weight from help usage and response time.
 */
export function combinedEvidenceWeight(
  hadHelp: boolean,
  responseTimeMs: number,
  isCorrect: boolean,
  expectedTimeMs: number = 5000
): number {
  return helpWeight(hadHelp) * responseTimeWeight(responseTimeMs, isCorrect, expectedTimeMs)
}
