/**
 * Session Timing Configuration
 *
 * Controls timing-related parameters for practice sessions.
 * Adjust these to tune pacing and session management.
 */

/**
 * Default seconds per problem if no student history exists.
 * Used for initial session planning before we have timing data.
 */
export const DEFAULT_SECONDS_PER_PROBLEM = 45;

/**
 * Minimum seconds per problem for session planning.
 *
 * Even if a student's historical average is faster, we clamp to this minimum
 * to prevent generating an excessive number of problems. This guards against:
 * - Data anomalies (e.g., session timing bugs)
 * - Students who rush through problems without learning
 * - Unrealistic session lengths that overwhelm students
 *
 * A 5-minute session with 10 sec/problem = 30 problems (reasonable)
 * A 5-minute session with 2 sec/problem = 150 problems (too many!)
 */
export const MIN_SECONDS_PER_PROBLEM = 10;

/**
 * How long before an inactive session is auto-abandoned (hours).
 * Sessions older than this are cleaned up when the student returns.
 */
export const SESSION_TIMEOUT_HOURS = 24;

/**
 * Spaced repetition intervals for skill review.
 *
 * - mastered: How often to revisit mastered skills (days)
 * - practicing: How often to revisit skills being learned (days)
 */
export const REVIEW_INTERVAL_DAYS = {
  /** Days between reviews for mastered skills */
  mastered: 7,
  /** Days between reviews for skills still being practiced */
  practicing: 3,
} as const;

export type ReviewIntervalDays = typeof REVIEW_INTERVAL_DAYS;
