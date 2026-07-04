/**
 * Timing-integrity constants shared across the curriculum timing helpers.
 *
 * This module is the single source of truth for the maximum plausible
 * response-time cap. It has no runtime dependencies and is client-safe.
 */

/**
 * Maximum possible auto-pause clamp (5 minutes).
 *
 * Any measured response time that exceeds this value provably outran the
 * largest auto-pause the client could ever apply, so it is treated as a
 * Tier-1 (provably broken) sample. Also used as the server-side backstop cap.
 *
 * The auto-pause calculator (`components/practice/autoPauseCalculator.ts`)
 * re-exports this as `MAX_PAUSE_THRESHOLD_MS` — one source of truth, no drift.
 */
export const MAX_RESPONSE_TIME_CAP_MS = 300_000
