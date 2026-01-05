'use client'

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import type { SessionPlan, SlotResult, GameBreakSettings } from '@/db/schema/session-plans'
import type { ProblemGenerationMode } from '@/lib/curriculum/config'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import { api } from '@/lib/queryClient'
import { sessionPlanKeys } from '@/lib/queryKeys'

// Re-export query keys for consumers
export { sessionPlanKeys } from '@/lib/queryKeys'

// ============================================================================
// API Functions
// ============================================================================

async function fetchActiveSessionPlan(playerId: string): Promise<SessionPlan | null> {
  const res = await api(`curriculum/${playerId}/sessions/plans`)
  if (!res.ok) throw new Error('Failed to fetch active session plan')
  const data = await res.json()
  return data.plan ?? null
}

/**
 * Error thrown when trying to generate a plan but one already exists.
 * Contains the existing plan so callers can recover.
 */
export class ActiveSessionExistsClientError extends Error {
  constructor(public readonly existingPlan: SessionPlan) {
    super('Active session already exists')
    this.name = 'ActiveSessionExistsClientError'
  }
}

/**
 * Error thrown when trying to generate a plan but no skills are enabled.
 */
export class NoSkillsEnabledClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NoSkillsEnabledClientError'
  }
}

/**
 * Which session parts to include
 */
interface EnabledParts {
  abacus: boolean
  visualization: boolean
  linear: boolean
}

async function generateSessionPlan({
  playerId,
  durationMinutes,
  abacusTermCount,
  enabledParts,
  problemGenerationMode,
  confidenceThreshold,
  sessionMode,
  gameBreakSettings,
}: {
  playerId: string
  durationMinutes: number
  abacusTermCount?: { min: number; max: number }
  enabledParts?: EnabledParts
  problemGenerationMode?: ProblemGenerationMode
  confidenceThreshold?: number
  sessionMode?: SessionMode
  gameBreakSettings?: GameBreakSettings
}): Promise<SessionPlan> {
  const res = await api(`curriculum/${playerId}/sessions/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      durationMinutes,
      abacusTermCount,
      enabledParts,
      problemGenerationMode,
      confidenceThreshold,
      sessionMode,
      gameBreakSettings,
    }),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))

    // Handle 409 conflict - active session exists
    if (
      res.status === 409 &&
      errorData.code === 'ACTIVE_SESSION_EXISTS' &&
      errorData.existingPlan
    ) {
      throw new ActiveSessionExistsClientError(errorData.existingPlan)
    }

    // Handle 400 - no skills enabled
    if (res.status === 400 && errorData.code === 'NO_SKILLS_ENABLED') {
      throw new NoSkillsEnabledClientError(errorData.error)
    }

    throw new Error(errorData.error || 'Failed to generate session plan')
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
 *
 * @param playerId - The player ID to fetch the session for
 * @param initialData - Optional initial data from server-side props (avoids loading state on direct page load)
 */
export function useActiveSessionPlan(playerId: string | null, initialData?: SessionPlan | null) {
  return useQuery({
    queryKey: sessionPlanKeys.active(playerId ?? ''),
    queryFn: () => fetchActiveSessionPlan(playerId!),
    enabled: !!playerId,
    // Use server-provided data as initial cache value
    // This prevents a loading flash on direct page loads while still allowing refetch
    initialData: initialData ?? undefined,
    // Don't refetch on mount if we have initial data - trust the server
    // The query will still refetch on window focus or after stale time
    staleTime: initialData ? 30000 : 0, // 30s stale time if we have initial data
  })
}

/**
 * Hook: Fetch active session plan with Suspense (for SSR contexts)
 */
export function useActiveSessionPlanSuspense(playerId: string) {
  return useSuspenseQuery({
    queryKey: sessionPlanKeys.active(playerId),
    queryFn: () => fetchActiveSessionPlan(playerId),
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
