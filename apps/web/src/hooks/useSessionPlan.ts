'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import type { SessionPlan, SlotResult, GameBreakSettings } from '@/db/schema/session-plans'
import type { ProblemGenerationMode } from '@/lib/curriculum/config'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import { api } from '@/lib/queryClient'
import { sessionPlanKeys } from '@/lib/queryKeys'
import { useBackgroundTask } from './useBackgroundTask'

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
 * Error thrown when the weekly session limit is reached (free tier).
 */
export class SessionLimitReachedError extends Error {
  constructor(
    public readonly limit: number,
    public readonly count: number
  ) {
    super(`Weekly session limit reached (${count}/${limit})`)
    this.name = 'SessionLimitReachedError'
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

/** Parameters for generating a session plan */
interface GenerateSessionPlanParams {
  playerId: string
  durationMinutes: number
  abacusTermCount?: { min: number; max: number }
  enabledParts?: EnabledParts
  partTimeWeights?: { abacus: number; visualization: number; linear: number }
  purposeTimeWeights?: { focus: number; reinforce: number; review: number; challenge: number }
  shufflePurposes?: boolean
  problemGenerationMode?: ProblemGenerationMode
  confidenceThreshold?: number
  sessionMode?: SessionMode
  gameBreakSettings?: GameBreakSettings
  comfortAdjustment?: number
}

/**
 * Create a background task for session plan generation.
 * Returns the task ID — subscribe via useBackgroundTask for progress.
 */
async function createSessionPlanTask(params: GenerateSessionPlanParams): Promise<string> {
  const res = await api(`curriculum/${params.playerId}/sessions/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      durationMinutes: params.durationMinutes,
      abacusTermCount: params.abacusTermCount,
      enabledParts: params.enabledParts,
      partTimeWeights: params.partTimeWeights,
      purposeTimeWeights: params.purposeTimeWeights,
      shufflePurposes: params.shufflePurposes,
      problemGenerationMode: params.problemGenerationMode,
      confidenceThreshold: params.confidenceThreshold,
      sessionMode: params.sessionMode,
      gameBreakSettings: params.gameBreakSettings,
      comfortAdjustment: params.comfortAdjustment,
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

    // Handle 403 - session limit reached (free tier)
    if (res.status === 403 && errorData.code === 'SESSION_LIMIT_REACHED') {
      throw new SessionLimitReachedError(errorData.limit, errorData.count)
    }

    throw new Error(errorData.error || 'Failed to generate session plan')
  }
  const data = await res.json()
  return data.taskId
}

async function updateSessionPlan({
  playerId,
  planId,
  action,
  result,
  reason,
  breakFinishReason,
}: {
  playerId: string
  planId: string
  action:
    | 'approve'
    | 'start'
    | 'record'
    | 'end_early'
    | 'abandon'
    | 'part_transition_complete'
    | 'break_finished'
    | 'break_results_acked'
  result?: Omit<SlotResult, 'timestamp' | 'partNumber'>
  reason?: string
  breakFinishReason?: 'timeout' | 'gameFinished' | 'skipped'
}): Promise<SessionPlan> {
  const res = await api(`curriculum/${playerId}/sessions/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, result, reason, breakFinishReason }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || `Failed to ${action} session plan`)
  }
  const data = await res.json()
  return data.plan
}

/**
 * Context for recording a redo result
 */
export interface RedoContext {
  /** Part index of the problem being redone */
  originalPartIndex: number
  /** Slot index of the problem being redone */
  originalSlotIndex: number
  /** Whether the original answer was correct (affects recording logic) */
  originalWasCorrect: boolean
}

async function recordRedoResult({
  playerId,
  planId,
  result,
  redoContext,
}: {
  playerId: string
  planId: string
  result: Omit<SlotResult, 'timestamp' | 'partNumber'>
  redoContext: RedoContext
}): Promise<SessionPlan> {
  const res = await api(`curriculum/${playerId}/sessions/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'record_redo', result, redoContext }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to record redo result')
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

/** Output from the session-plan background task */
interface SessionPlanTaskOutput {
  plan: SessionPlan
}

/**
 * Hook: Generate a new session plan via background task
 *
 * Returns a mutation to start generation plus real-time progress tracking.
 * The mutation resolves with the task ID; the plan is delivered via Socket.IO.
 */
export function useGenerateSessionPlan() {
  const queryClient = useQueryClient()
  const [taskId, setTaskId] = useState<string | null>(null)
  const task = useBackgroundTask<SessionPlanTaskOutput>(taskId)

  // Track the playerId for cache updates when task completes
  const playerIdRef = useRef<string | null>(null)
  // Track whether we've already processed this task completion
  const processedTaskIdRef = useRef<string | null>(null)

  // When task completes, extract plan and update React Query cache
  useEffect(() => {
    if (
      task.state?.status === 'completed' &&
      task.state.output?.plan &&
      taskId &&
      processedTaskIdRef.current !== taskId
    ) {
      processedTaskIdRef.current = taskId
      const plan = task.state.output.plan
      const playerId = playerIdRef.current
      if (playerId) {
        queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
        queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
      }
    }
  }, [task.state?.status, task.state?.output, taskId, queryClient])

  const mutation = useMutation({
    mutationFn: async (params: GenerateSessionPlanParams) => {
      playerIdRef.current = params.playerId
      processedTaskIdRef.current = null
      const id = await createSessionPlanTask(params)
      setTaskId(id)
      return id
    },
    onError: (err) => {
      console.error('Failed to generate session plan:', err.message)
    },
  })

  const reset = useCallback(() => {
    mutation.reset()
    setTaskId(null)
    processedTaskIdRef.current = null
  }, [mutation])

  return {
    ...mutation,
    reset,
    taskId,
    taskState: task.state,
    progress: task.state?.progress ?? 0,
    progressMessage: task.state?.progressMessage ?? null,
    /** The generated plan, available when task completes */
    plan: task.state?.status === 'completed' ? (task.state.output?.plan ?? null) : null,
    /** Whether the background task is actively running */
    isGenerating: mutation.isPending || (!!taskId && task.state?.status === 'running'),
    /** Whether the plan generation is complete */
    isComplete: task.state?.status === 'completed',
    /** Error from the background task (if it failed) */
    taskError: task.state?.status === 'failed' ? task.state.error : null,
  }
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
 * Hook: Mark part transition complete and advance flow state.
 */
export function useCompletePartTransition() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ playerId, planId }: { playerId: string; planId: string }) =>
      updateSessionPlan({ playerId, planId, action: 'part_transition_complete' }),
    onSuccess: (plan, { playerId }) => {
      queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
    },
    onError: (err) => {
      console.error('Failed to complete part transition:', err.message)
    },
  })
}

/**
 * Hook: Persist game break completion and advance flow state.
 */
export function useFinishGameBreak() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      playerId,
      planId,
      breakFinishReason,
    }: {
      playerId: string
      planId: string
      breakFinishReason: 'timeout' | 'gameFinished' | 'skipped'
    }) => updateSessionPlan({ playerId, planId, action: 'break_finished', breakFinishReason }),
    onSuccess: (plan, { playerId }) => {
      queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
    },
    onError: (err) => {
      console.error('Failed to finish game break:', err.message)
    },
  })
}

/**
 * Hook: Acknowledge game break results screen and return to practicing.
 */
export function useAcknowledgeGameBreakResults() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ playerId, planId }: { playerId: string; planId: string }) =>
      updateSessionPlan({ playerId, planId, action: 'break_results_acked' }),
    onSuccess: (plan, { playerId }) => {
      queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
    },
    onError: (err) => {
      console.error('Failed to acknowledge game break results:', err.message)
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

/**
 * Hook: Record a redo result (student re-attempts a previously completed problem)
 *
 * This is different from useRecordSlotResult because:
 * - It doesn't advance the session position (student returns to where they were)
 * - It can "redeem" incorrect answers (remove from retry queue if original was wrong and redo is correct)
 * - If original was correct and redo is wrong, no result is recorded (avoid penalty)
 */
export function useRecordRedoResult() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      playerId,
      planId,
      result,
      redoContext,
    }: {
      playerId: string
      planId: string
      result: Omit<SlotResult, 'timestamp' | 'partNumber'>
      redoContext: RedoContext
    }) => recordRedoResult({ playerId, planId, result, redoContext }),
    onSuccess: (plan, { playerId }) => {
      queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
    },
    onError: (err) => {
      console.error('Failed to record redo result:', err.message)
    },
  })
}

/**
 * Update the remote camera session ID for a session plan
 */
async function setRemoteCameraSession({
  playerId,
  planId,
  remoteCameraSessionId,
}: {
  playerId: string
  planId: string
  remoteCameraSessionId: string | null
}): Promise<SessionPlan> {
  const res = await api(`curriculum/${playerId}/sessions/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'set_remote_camera',
      remoteCameraSessionId,
    }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to set remote camera session')
  }
  const data = await res.json()
  return data.plan
}

/**
 * Hook: Set the remote camera session ID for a session plan
 * Used when setting up phone camera for vision-based practice
 */
export function useSetRemoteCameraSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: setRemoteCameraSession,
    onSuccess: (plan, { playerId }) => {
      queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
    },
    onError: (err) => {
      console.error('Failed to set remote camera session:', err.message)
    },
  })
}
