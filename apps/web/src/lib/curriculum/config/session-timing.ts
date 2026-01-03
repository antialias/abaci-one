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
export const DEFAULT_SECONDS_PER_PROBLEM = 45

/**
 * How long before an inactive session is auto-abandoned (hours).
 * Sessions older than this are cleaned up when the student returns.
 */
export const SESSION_TIMEOUT_HOURS = 24

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
} as const

export type ReviewIntervalDays = typeof REVIEW_INTERVAL_DAYS
