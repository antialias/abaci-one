/**
 * Confidence and Uncertainty Calculations
 *
 * BKT gives us a point estimate of P(known), but we should also
 * communicate how confident we are in that estimate.
 *
 * More data = more confidence
 * Consistent observations = more confidence
 */

/**
 * Calculate confidence in pKnown estimate.
 *
 * Based on:
 * - Number of opportunities (more data = more confidence)
 * - Consistency of observations (extreme success rates = more confidence)
 *
 * @param opportunities - Number of problems involving this skill
 * @param successRate - Proportion of correct answers (0 to 1)
 * @returns Confidence value in [0, 1] where 1 = highly confident
 */
export function calculateConfidence(
  opportunities: number,
  successRate: number,
): number {
  // More data = more confidence (asymptotic to 1)
  // With 20 opportunities, we're ~63% confident from data alone
  // With 50 opportunities, we're ~92% confident from data alone
  const dataConfidence = 1 - Math.exp(-opportunities / 20);

  // Extreme success rates (very high or very low) = more confidence
  // A 95% success rate is more informative than a 50% success rate
  const extremity = Math.abs(successRate - 0.5) * 2; // 0 at 50%, 1 at 0% or 100%
  const consistencyBonus = extremity * 0.2;

  return Math.min(1, dataConfidence + consistencyBonus);
}

/**
 * Get human-readable confidence label for display.
 */
export function getConfidenceLabel(
  confidence: number,
): "confident" | "moderate" | "uncertain" {
  if (confidence > 0.7) return "confident";
  if (confidence > 0.4) return "moderate";
  return "uncertain";
}

/**
 * Calculate uncertainty range around pKnown estimate.
 *
 * When confidence is low, we should show a wider range.
 * This helps communicate that the estimate is uncertain.
 *
 * @param pKnown - Point estimate of P(known)
 * @param confidence - Confidence in the estimate
 * @returns Low and high bounds of the uncertainty range
 */
export function getUncertaintyRange(
  pKnown: number,
  confidence: number,
): { low: number; high: number } {
  // Max uncertainty is ±30% when confidence = 0
  const uncertainty = (1 - confidence) * 0.3;
  return {
    low: Math.max(0, pKnown - uncertainty),
    high: Math.min(1, pKnown + uncertainty),
  };
}

/**
 * Get staleness warning based on days since last practice.
 * This is shown separately from P(known) - we don't apply decay.
 *
 * @param daysSinceLastPractice - Number of days since the skill was practiced
 * @returns Warning message or null if recent enough
 */
export function getStalenessWarning(
  daysSinceLastPractice: number | null,
): string | null {
  if (daysSinceLastPractice === null) return null;
  if (daysSinceLastPractice < 7) return null;
  if (daysSinceLastPractice < 14) return "Not practiced recently";
  if (daysSinceLastPractice < 30) return "Getting rusty";
  return "Very stale - may need review";
}
