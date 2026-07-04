'use client'

/**
 * Mutations for the timing review & repair tool (#158).
 *
 * These are the write side of the review flow (per-attempt repairs, session
 * soft delete/restore). Each mutation invalidates every cache that surfaces
 * timing/estimate data so banners and estimates refresh immediately:
 * - `timingReviewKeys` — the review page's own flagged-attempt list
 * - `sessionPlanKeys`   — the edited plan detail / summary
 * - `sessionHistoryKeys`— the history list (deleted rows drop out)
 * - `curriculumKeys`    — the curriculum GET embeds the pace assessment (#157)
 *
 * The read side is `useTimingReview` (below): the flagged-attempt list + pace
 * assessment that powers the /review-timings page and its cards. It shares the
 * `timingReviewKeys.detail(playerId)` cache entry the mutations invalidate, so
 * acting on an attempt refetches the list and the recovered estimate together.
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import {
  curriculumKeys,
  sessionHistoryKeys,
  sessionPlanKeys,
  timingReviewKeys,
} from '@/lib/queryKeys'
// Type-only: erased at compile time, so no server runtime is pulled into the
// client bundle. Keeps the request body in sync with the domain module.
import type { SlotResultReviewAction } from '@/lib/curriculum/session-review'
import type { TimingReviewData } from '@/lib/curriculum/timing/review-types'

/**
 * Load the player's flagged/unresolved attempts plus the pace assessment
 * (current estimate + if-repaired preview). Keyed on
 * `timingReviewKeys.detail(playerId)` so every repair/delete/restore mutation's
 * invalidation refetches it.
 */
export function useTimingReview(playerId: string, enabled = true) {
  return useQuery({
    queryKey: timingReviewKeys.detail(playerId),
    queryFn: async (): Promise<TimingReviewData> => {
      const res = await api(`curriculum/${playerId}/timing-review`)
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Failed to load timing review')
      }
      return res.json() as Promise<TimingReviewData>
    },
    enabled: enabled && playerId.length > 0,
  })
}

/** Invalidate every cache that reflects a timing repair / delete / restore. */
function invalidateReviewQueries(
  queryClient: QueryClient,
  playerId: string,
  planId?: string
): void {
  queryClient.invalidateQueries({ queryKey: timingReviewKeys.detail(playerId) })
  queryClient.invalidateQueries({ queryKey: sessionHistoryKeys.list(playerId) })
  queryClient.invalidateQueries({ queryKey: curriculumKeys.detail(playerId) })
  if (planId) {
    queryClient.invalidateQueries({ queryKey: sessionPlanKeys.detail(planId) })
  } else {
    queryClient.invalidateQueries({ queryKey: sessionPlanKeys.all })
  }
}

async function throwOnError(res: Response, fallback: string): Promise<unknown> {
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? fallback)
  }
  return res.json()
}

export interface ReviewSlotResultVars {
  playerId: string
  planId: string
  resultIndex: number
  action: SlotResultReviewAction
}

/**
 * Shared PATCH for one per-attempt review action — the single request builder
 * every review mutation reuses (never forked), so they all hit the same route
 * and error-handling.
 */
function patchReviewAction({
  playerId,
  planId,
  resultIndex,
  action,
}: ReviewSlotResultVars): Promise<unknown> {
  return api(`curriculum/${playerId}/sessions/plans/${planId}/results/${resultIndex}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  }).then((res) => throwOnError(res, 'Failed to review attempt'))
}

/** Apply a per-attempt review action (exclude/include/set_time/…). */
export function useReviewSlotResult() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: patchReviewAction,
    onSuccess: (_data, { playerId, planId }) =>
      invalidateReviewQueries(queryClient, playerId, planId),
  })
}

/** Target for a fixed-action review mutation (the action is baked in). */
export interface TimingReviewTarget {
  playerId: string
  planId: string
  resultIndex: number
}

/**
 * Confirm a flagged timing as genuine ("this time is real — keep it"): the value
 * stays in the estimate but the attempt drops out of the unresolved counts.
 * Invalidates the same key families as {@link useReviewSlotResult}.
 */
export function useConfirmTiming() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (target: TimingReviewTarget) =>
      patchReviewAction({ ...target, action: { action: 'confirm_timing' } }),
    onSuccess: (_data, { playerId, planId }) =>
      invalidateReviewQueries(queryClient, playerId, planId),
  })
}

/** Undo a prior {@link useConfirmTiming}, reopening the flag for review. */
export function useUnconfirmTiming() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (target: TimingReviewTarget) =>
      patchReviewAction({ ...target, action: { action: 'unconfirm_timing' } }),
    onSuccess: (_data, { playerId, planId }) =>
      invalidateReviewQueries(queryClient, playerId, planId),
  })
}

export interface SessionPlanRef {
  playerId: string
  planId: string
}

/** Soft-delete a whole session. */
export function useDeleteSessionPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ playerId, planId }: SessionPlanRef) =>
      api(`curriculum/${playerId}/sessions/plans/${planId}`, { method: 'DELETE' }).then((res) =>
        throwOnError(res, 'Failed to delete session')
      ),
    onSuccess: (_data, { playerId, planId }) =>
      invalidateReviewQueries(queryClient, playerId, planId),
  })
}

/** Restore a soft-deleted session to its prior status. */
export function useRestoreSessionPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ playerId, planId }: SessionPlanRef) =>
      api(`curriculum/${playerId}/sessions/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      }).then((res) => throwOnError(res, 'Failed to restore session')),
    onSuccess: (_data, { playerId, planId }) =>
      invalidateReviewQueries(queryClient, playerId, planId),
  })
}
