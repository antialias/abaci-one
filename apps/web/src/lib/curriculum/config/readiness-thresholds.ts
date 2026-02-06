/**
 * Readiness Thresholds Configuration
 *
 * Multi-dimensional readiness criteria for skill progression.
 * A skill is "solid" (ready to advance past) when ALL four dimensions are met:
 *
 * 1. Mastery: BKT P(known) + confidence
 * 2. Volume: Practice depth (problems + sessions)
 * 3. Speed: Automaticity / muscle memory
 * 4. Consistency: Reliable execution (accuracy + no-help streak)
 *
 * IMPORTANT: These values are designed to be adjustable via admin UI in the future.
 * All code should import from here rather than hardcoding values.
 */

export const READINESS_THRESHOLDS = {
  // --- Mastery dimension ---
  /** P(known) threshold for readiness (raised from BKT_THRESHOLDS.strong = 0.8) */
  pKnownThreshold: 0.85,
  /** Minimum confidence to trust BKT estimate for readiness (raised from 0.3) */
  confidenceThreshold: 0.5,

  // --- Volume dimension ---
  /** Minimum first-attempt problems with the skill */
  minOpportunities: 20,
  /** Minimum distinct sessions where skill appeared */
  minSessions: 3,

  // --- Speed dimension ---
  /** Maximum median seconds per term for automaticity */
  maxMedianSecondsPerTerm: 4.0,
  /** Number of recent problems to compute speed median from */
  speedWindowSize: 10,

  // --- Consistency dimension ---
  /** Last N problems must be help-free */
  noHelpInLastN: 5,
  /** Window size for recent accuracy computation */
  accuracyWindowSize: 15,
  /** Minimum accuracy in the recent window */
  minAccuracy: 0.85,
  /** Last N problems must all be correct */
  lastNAllCorrect: 5,
} as const

export type ReadinessThresholds = typeof READINESS_THRESHOLDS
