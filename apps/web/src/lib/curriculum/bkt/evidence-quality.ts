/**
 * Evidence Quality Modifiers
 *
 * Not all observations are equally informative. We adjust the weight
 * of evidence based on:
 * - Help level: More help = less confident the student really knows it
 * - Response time: Fast correct = strong mastery, slow correct = struggled
 */

/**
 * Adjust observation weight based on help level.
 * More help = less confident the student really knows it.
 *
 * @param helpLevel - Amount of help provided (0 = none, 3 = full solution)
 * @returns Weight multiplier [0, 1]
 */
export function helpLevelWeight(helpLevel: 0 | 1 | 2 | 3): number {
  switch (helpLevel) {
    case 0:
      return 1.0 // No help - full evidence
    case 1:
      return 0.8 // Minor hint - slight reduction
    case 2:
      return 0.5 // Significant help - halve evidence
    case 3:
      return 0.5 // Full help - halve evidence
  }
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
  helpLevel: 0 | 1 | 2 | 3,
  responseTimeMs: number,
  isCorrect: boolean,
  expectedTimeMs: number = 5000
): number {
  return helpLevelWeight(helpLevel) * responseTimeWeight(responseTimeMs, isCorrect, expectedTimeMs)
}
