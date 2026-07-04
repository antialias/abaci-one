/**
 * Adult review & repair domain logic (#158).
 *
 * Single home for the per-attempt review mutations invoked by the results
 * PATCH route and the timing-review UI, plus session-level soft delete /
 * restore. Kept out of the route so the mutation logic is unit-testable and
 * shared with any other caller (never forked).
 *
 * Design (per the shared #156/#157/#158 contract):
 * - `responseTimeMs` and `responseTimeMsRaw` are NEVER mutated by review.
 *   Manual replacements live in `timingReview.adjustedResponseTimeMs`; the
 *   original measurement is always preserved.
 * - Scopes are independent: mastery exclusion = `source: 'teacher-excluded'`
 *   (+ `originalSource` for restore); timing omission = `omitFromTiming`.
 * - `timingReview` doubles as the review-audit stamp: every action records the
 *   acting adult (`reviewedBy`) and time (`reviewedAt`), even a mastery-only
 *   change, since `SlotResult` has no other per-attempt reviewer field.
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type {
  SessionPlan,
  SessionStatus,
  SlotResult,
  SlotResultSource,
  SlotTimingReview,
} from '@/db/schema/session-plans'
import { getSessionPlan, updateSessionPlanResults } from './session-planner'

/**
 * Bounds for a manually-entered response time (`set_time`): 1 second to 24
 * hours. The upper bound is deliberately generous (not a 30-minute cap) so an
 * adult can "count the full recorded time" — restore a Tier-1 raw value that
 * legitimately exceeds the auto-pause clamp; that adjusted value re-enters the
 * estimate and is never re-classified.
 */
export const SET_TIME_MIN_MS = 1_000
export const SET_TIME_MAX_MS = 24 * 60 * 60 * 1000 // 86_400_000

/** Statuses a session may be soft-deleted from (only finished sessions). */
const SOFT_DELETABLE_STATUSES: readonly SessionStatus[] = ['completed', 'abandoned']

/**
 * Error carrying the HTTP status a route should surface. The route catches
 * this and maps it directly to a `NextResponse`, so the domain layer owns the
 * validation semantics while staying framework-free.
 */
export class SessionReviewError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'SessionReviewError'
  }
}

/** Which axis (or both) a scoped exclude/include acts on. */
export type SlotReviewScope = 'timing' | 'mastery' | 'both'

/**
 * A single per-attempt review action.
 *
 * `exclude`/`include` default to `scope: 'mastery'` for backward compatibility
 * with the pre-#158 route (`{ action: 'exclude' }` sets `teacher-excluded`).
 */
export type SlotResultReviewAction =
  | { action: 'mark_correct' }
  | { action: 'exclude'; scope?: SlotReviewScope }
  | { action: 'include'; scope?: SlotReviewScope }
  | { action: 'set_time'; adjustedResponseTimeMs: number }
  | { action: 'clear_time' }
  | { action: 'confirm_timing' }
  | { action: 'unconfirm_timing' }

export type SlotResultReviewActionName = SlotResultReviewAction['action']

/** Legacy shape: the pre-#158 route stored the pre-exclusion source here. */
type LegacyOriginalSource = SlotResult & { _originalSource?: SlotResultSource }

/**
 * Resolve the source an excluded attempt should restore to, tolerating the
 * legacy untyped `_originalSource` key written by the pre-#158 route.
 */
function readOriginalSource(result: SlotResult): SlotResultSource | undefined {
  if (result.originalSource != null) return result.originalSource
  return (result as LegacyOriginalSource)._originalSource ?? undefined
}

/**
 * Merge a patch into the attempt's `timingReview`, always (re)stamping the
 * acting adult and timestamp. Clearing a field is expressed by passing it as
 * `undefined` in the patch (JSON serialization drops it, and every reader uses
 * `!= null`).
 */
function stampTimingReview(
  result: SlotResult,
  patch: Partial<Omit<SlotTimingReview, 'reviewedBy' | 'reviewedAt'>>,
  reviewerUserId: string,
  now: Date
): SlotTimingReview {
  return {
    ...result.timingReview,
    ...patch,
    reviewedBy: reviewerUserId,
    reviewedAt: now.toISOString(),
  }
}

/**
 * Pure transformation: apply a review action to one attempt and return the new
 * result. Throws {@link SessionReviewError} on invalid/no-op requests. Never
 * mutates the input or the stored `responseTimeMs`/`responseTimeMsRaw`.
 */
export function computeReviewedResult(
  result: SlotResult,
  action: SlotResultReviewAction,
  reviewerUserId: string,
  now: Date = new Date()
): SlotResult {
  switch (action.action) {
    case 'mark_correct': {
      if (result.isCorrect) {
        throw new SessionReviewError('Result is already correct', 400)
      }
      const epochNumber = result.epochNumber ?? 0
      const masteryWeight = 1.0 / 2 ** epochNumber
      return {
        ...result,
        isCorrect: true,
        masteryWeight,
        source: 'teacher-corrected',
        timingReview: stampTimingReview(result, {}, reviewerUserId, now),
      }
    }

    case 'exclude': {
      const scope = action.scope ?? 'mastery'
      const wantMastery = scope === 'mastery' || scope === 'both'
      const wantTiming = scope === 'timing' || scope === 'both'
      const next: SlotResult = { ...result }
      const timingPatch: Partial<Omit<SlotTimingReview, 'reviewedBy' | 'reviewedAt'>> = {}
      let changed = false

      if (wantMastery && next.source !== 'teacher-excluded') {
        // Preserve the pre-exclusion source (may be undefined = 'practice') so
        // include() can restore it exactly.
        next.originalSource = next.source
        next.source = 'teacher-excluded'
        changed = true
      }
      if (wantTiming && !next.timingReview?.omitFromTiming) {
        timingPatch.omitFromTiming = true
        changed = true
      }
      if (!changed) {
        throw new SessionReviewError('Result is already excluded for the requested scope', 400)
      }

      next.timingReview = stampTimingReview(result, timingPatch, reviewerUserId, now)
      return next
    }

    case 'include': {
      const scope = action.scope ?? 'mastery'
      const wantMastery = scope === 'mastery' || scope === 'both'
      const wantTiming = scope === 'timing' || scope === 'both'
      const next: SlotResult = { ...result }
      const timingPatch: Partial<Omit<SlotTimingReview, 'reviewedBy' | 'reviewedAt'>> = {}
      let changed = false

      if (wantMastery && next.source === 'teacher-excluded') {
        next.source = readOriginalSource(result) ?? 'practice'
        delete next.originalSource
        delete (next as LegacyOriginalSource)._originalSource
        changed = true
      }
      if (wantTiming && next.timingReview?.omitFromTiming) {
        timingPatch.omitFromTiming = false
        changed = true
      }
      if (!changed) {
        throw new SessionReviewError('Result is not excluded for the requested scope', 400)
      }

      next.timingReview = stampTimingReview(next, timingPatch, reviewerUserId, now)
      return next
    }

    case 'set_time': {
      const value = action.adjustedResponseTimeMs
      if (!Number.isInteger(value) || value < SET_TIME_MIN_MS || value > SET_TIME_MAX_MS) {
        throw new SessionReviewError(
          `adjustedResponseTimeMs must be an integer between ${SET_TIME_MIN_MS} and ${SET_TIME_MAX_MS} ms`,
          400
        )
      }
      return {
        ...result,
        // responseTimeMs is preserved untouched; the replacement lives here.
        // Also clear any prior `omitFromTiming`: in the resolution order omit
        // wins over an adjusted value, so leaving both set would make the manual
        // value dead. Entering an explicit time means "count THIS value", so
        // setting a time from an omitted state re-includes the sample.
        timingReview: stampTimingReview(
          result,
          { adjustedResponseTimeMs: value, omitFromTiming: false },
          reviewerUserId,
          now
        ),
      }
    }

    case 'clear_time': {
      if (result.timingReview?.adjustedResponseTimeMs == null) {
        throw new SessionReviewError('Result has no adjusted time to clear', 400)
      }
      return {
        ...result,
        timingReview: stampTimingReview(
          result,
          { adjustedResponseTimeMs: undefined },
          reviewerUserId,
          now
        ),
      }
    }

    case 'confirm_timing': {
      return {
        ...result,
        timingReview: stampTimingReview(result, { timingConfirmed: true }, reviewerUserId, now),
      }
    }

    case 'unconfirm_timing': {
      return {
        ...result,
        timingReview: stampTimingReview(result, { timingConfirmed: false }, reviewerUserId, now),
      }
    }

    default: {
      const _exhaustive: never = action
      throw new SessionReviewError(
        `Unknown review action: ${String((_exhaustive as { action?: string }).action)}`,
        400
      )
    }
  }
}

export interface ApplySlotResultReviewParams {
  planId: string
  /** Expected owner; enforced against the loaded plan (returns 404 on mismatch). */
  playerId: string
  resultIndex: number
  /** User ID of the acting adult (stamped into the audit fields). */
  reviewerUserId: string
  action: SlotResultReviewAction
  now?: Date
}

/**
 * Load the plan, verify ownership + index, apply the review action, and persist
 * via `updateSessionPlanResults`. Restricted to finished sessions is enforced
 * by the caller (the results route only exposes this for review); the plan
 * itself may be in any status here since the review UI targets history.
 */
export async function applySlotResultReview(
  params: ApplySlotResultReviewParams
): Promise<SessionPlan> {
  const { planId, playerId, resultIndex, reviewerUserId, action, now = new Date() } = params

  const plan = await getSessionPlan(planId)
  if (!plan || plan.playerId !== playerId) {
    // Don't distinguish "missing" from "not yours".
    throw new SessionReviewError('Plan not found', 404)
  }
  if (!Number.isInteger(resultIndex) || resultIndex < 0 || resultIndex >= plan.results.length) {
    throw new SessionReviewError('Result index out of bounds', 400)
  }

  const updatedResults = [...plan.results]
  updatedResults[resultIndex] = computeReviewedResult(
    updatedResults[resultIndex],
    action,
    reviewerUserId,
    now
  )

  return updateSessionPlanResults(planId, updatedResults)
}

/**
 * Soft-delete a finished session (status → 'deleted'), preserving the prior
 * status for exact restore. Raw results are kept (they feed BKT history) and
 * the row stays loadable by ID so the session page can show a restore banner.
 *
 * NOTE (v1 scope): the denormalized `player_skill_mastery` counters and
 * `lastPracticedAt` written at record time are NOT unwound here. BKT pKnown
 * recomputes live from status-filtered history so it self-corrects on the next
 * plan; the counters are a documented follow-up.
 */
export async function softDeleteSessionPlan(params: {
  planId: string
  playerId: string
  deletedByUserId: string
  now?: Date
}): Promise<SessionPlan> {
  const { planId, playerId, deletedByUserId, now = new Date() } = params

  const plan = await getSessionPlan(planId)
  if (!plan || plan.playerId !== playerId) {
    throw new SessionReviewError('Plan not found', 404)
  }
  if (plan.status === 'deleted') {
    throw new SessionReviewError('Session is already deleted', 400)
  }
  if (!SOFT_DELETABLE_STATUSES.includes(plan.status)) {
    throw new SessionReviewError(
      `Only completed or abandoned sessions can be deleted (status: ${plan.status})`,
      409
    )
  }

  const [updated] = await db
    .update(schema.sessionPlans)
    .set({
      status: 'deleted',
      statusBeforeDeletion: plan.status,
      deletedAt: now,
      deletedBy: deletedByUserId,
    })
    .where(eq(schema.sessionPlans.id, planId))
    .returning()

  if (!updated) {
    throw new SessionReviewError('Plan not found', 404)
  }
  return updated
}

/**
 * Restore a soft-deleted session to its prior status (recorded at delete time).
 */
export async function restoreSessionPlan(params: {
  planId: string
  playerId: string
}): Promise<SessionPlan> {
  const { planId, playerId } = params

  const plan = await getSessionPlan(planId)
  if (!plan || plan.playerId !== playerId) {
    throw new SessionReviewError('Plan not found', 404)
  }
  if (plan.status !== 'deleted') {
    throw new SessionReviewError('Session is not deleted', 400)
  }

  // Fall back to 'completed' for legacy rows deleted before this column existed.
  const restoredStatus: SessionStatus = plan.statusBeforeDeletion ?? 'completed'

  const [updated] = await db
    .update(schema.sessionPlans)
    .set({
      status: restoredStatus,
      statusBeforeDeletion: null,
      deletedAt: null,
      deletedBy: null,
    })
    .where(eq(schema.sessionPlans.id, planId))
    .returning()

  if (!updated) {
    throw new SessionReviewError('Plan not found', 404)
  }
  return updated
}
