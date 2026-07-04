/**
 * Wire types for the timing-review read side (#158).
 *
 * Shared by the server data function (`getTimingReviewData`, progress-manager),
 * the timing-review GET route, and the client hook/page so the payload shape has
 * a single definition. Client-safe: type-only imports, no db/server runtime.
 *
 * The estimate numbers (`assessment`) come from `getPaceAssessment` — the single
 * pace producer (shared contract). This module adds only the per-attempt flag
 * list and deleted-session summaries; it never redefines the estimate.
 */

import type { SlotResult } from '@/db/schema/session-plans'
import type { AttemptTimingReason } from './effective-time'
import type { PaceAssessment } from './pace-estimation'

/**
 * A {@link SlotResult} as delivered over JSON: the only `Date` field
 * (`timestamp`) is serialized to an ISO string. `timingReview` already stores
 * ISO strings, so nothing else changes.
 */
export type SerializedSlotResult = Omit<SlotResult, 'timestamp'> & { timestamp: string }

/**
 * One flagged attempt (Tier-1 or Tier-2) with enough context for the review
 * card to render it and target the per-attempt PATCH route (`resultIndex` is the
 * index into the plan's `results` array).
 */
export interface FlaggedAttempt {
  sessionId: string
  completedAt: string | null
  /** Index into the session plan's `results` array (PATCH target). */
  resultIndex: number
  tier: 'tier1' | 'tier2'
  reason?: AttemptTimingReason
  /** Effective timing (ms) this attempt currently contributes, or null if omitted. */
  effectiveMs: number | null
  /**
   * True once the timing flag has been *resolved* — the sample was omitted,
   * given an adjusted time, or confirmed as genuine (`isFlagResolved`). A bare
   * review stamp (e.g. a mastery-only exclusion) or an unconfirm does NOT resolve
   * it, so the attempt still counts as "to review".
   */
  resolved: boolean
  result: SerializedSlotResult
}

/** A soft-deleted session, shown in the review page's "removed sessions" area. */
export interface DeletedSessionSummary {
  sessionId: string
  completedAt: string | null
  deletedAt: string | null
  problemsAttempted: number
  problemsCorrect: number
}

/** Full payload of `GET /api/curriculum/[playerId]/timing-review`. */
export interface TimingReviewData {
  /** Pace statistic from the single producer (`getPaceAssessment`). */
  assessment: PaceAssessment
  /** Flagged attempts across the pace window, worst (slowest) first. */
  flagged: FlaggedAttempt[]
  /** Soft-deleted sessions (restorable), most-recently deleted first. */
  deletedSessions: DeletedSessionSummary[]
}
