'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { api } from '@/lib/queryClient'

// ============================================================================
// Query Key Factory
// ============================================================================

export const sessionPlanKeys = {
  all: ['sessionPlans'] as const,
  lists: () => [...sessionPlanKeys.all, 'list'] as const,
  list: (playerId: string) => [...sessionPlanKeys.lists(), playerId] as const,
  active: (playerId: string) => [...sessionPlanKeys.all, 'active', playerId] as const,
  detail: (planId: string) => [...sessionPlanKeys.all, 'detail', planId] as const,
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchActiveSessionPlan(playerId: string): Promise<SessionPlan | null> {
  const res = await api(`curriculum/${playerId}/sessions/plans`)
  if (!res.ok) throw new Error('Failed to fetch active session plan')
  const data = await res.json()
  return data.plan ?? null
}

async function generateSessionPlan({
  playerId,
  durationMinutes,
}: {
  playerId: string
  durationMinutes: number
}): Promise<SessionPlan> {
  const res = await api(`curriculum/${playerId}/sessions/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durationMinutes }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to generate session plan')
  }
  const data = await res.json()
  return data.plan
}

async function updateSessionPlan({
  playerId,
  planId,
  action,
  result,
  reason,
}: {
  playerId: string
  planId: string
  action: 'approve' | 'start' | 'record' | 'end_early' | 'abandon'
  result?: Omit<SlotResult, 'timestamp' | 'partNumber'>
  reason?: string
}): Promise<SessionPlan> {
  const res = await api(`curriculum/${playerId}/sessions/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, result, reason }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || `Failed to ${action} session plan`)
  }
  const data = await res.json()
  return data.plan
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook: Fetch active session plan for a player
 */
export function useActiveSessionPlan(playerId: string | null) {
  return useQuery({
    queryKey: sessionPlanKeys.active(playerId ?? ''),
    queryFn: () => fetchActiveSessionPlan(playerId!),
    enabled: !!playerId,
  })
}

/**
 * Hook: Generate a new session plan
 */
export function useGenerateSessionPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: generateSessionPlan,
    onSuccess: (plan, { playerId }) => {
      // Update the active plan cache
      queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
      // Also cache by plan ID
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
    },
    onError: (err) => {
      console.error('Failed to generate session plan:', err.message)
    },
  })
}

/**
 * Hook: Approve a session plan (teacher clicks "Let's Go!")
 */
export function useApproveSessionPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ playerId, planId }: { playerId: string; planId: string }) =>
      updateSessionPlan({ playerId, planId, action: 'approve' }),
    onSuccess: (plan, { playerId }) => {
      queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
    },
    onError: (err) => {
      console.error('Failed to approve session plan:', err.message)
    },
  })
}

/**
 * Hook: Start a session plan (begin practice)
 */
export function useStartSessionPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ playerId, planId }: { playerId: string; planId: string }) =>
      updateSessionPlan({ playerId, planId, action: 'start' }),
    onSuccess: (plan, { playerId }) => {
      queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
    },
    onError: (err) => {
      console.error('Failed to start session plan:', err.message)
    },
  })
}

/**
 * Hook: Record a slot result (answer submitted)
 */
export function useRecordSlotResult() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      playerId,
      planId,
      result,
    }: {
      playerId: string
      planId: string
      result: Omit<SlotResult, 'timestamp' | 'partNumber'>
    }) => updateSessionPlan({ playerId, planId, action: 'record', result }),
    onSuccess: (plan, { playerId }) => {
      queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
    },
    onError: (err) => {
      console.error('Failed to record slot result:', err.message)
    },
  })
}

/**
 * Hook: End session early
 */
export function useEndSessionEarly() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      playerId,
      planId,
      reason,
    }: {
      playerId: string
      planId: string
      reason?: string
    }) => updateSessionPlan({ playerId, planId, action: 'end_early', reason }),
    onSuccess: (plan, { playerId }) => {
      queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
      // Invalidate the list to show in history
      queryClient.invalidateQueries({ queryKey: sessionPlanKeys.lists() })
    },
    onError: (err) => {
      console.error('Failed to end session early:', err.message)
    },
  })
}

/**
 * Hook: Abandon session (user navigates away)
 */
export function useAbandonSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ playerId, planId }: { playerId: string; planId: string }) =>
      updateSessionPlan({ playerId, planId, action: 'abandon' }),
    onSuccess: (plan, { playerId }) => {
      queryClient.setQueryData(sessionPlanKeys.active(playerId), null)
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
      queryClient.invalidateQueries({ queryKey: sessionPlanKeys.lists() })
    },
    onError: (err) => {
      console.error('Failed to abandon session:', err.message)
    },
  })
}
