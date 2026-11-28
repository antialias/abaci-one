'use client'

import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GameBreakSettings,
  SessionPlan,
  SkippedPart,
  SlotResult,
  SlotResultSubmission,
} from '@/db/schema/session-plans'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import type { ProblemGenerationMode } from '@/lib/curriculum/config'
import type { TrySubmission } from '@/lib/curriculum/record-try'
import type { SessionFlowEvent } from '@/lib/curriculum/session-flow'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import { envelopeOfScreenTry } from '@/lib/curriculum/try-wire'
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
 * Error thrown when every requested part was gated out by readiness (400 NO_ELIGIBLE_PARTS).
 * Carries the planner's per-part reasons so a UI can explain rather than echo the message.
 */
export class NoEligiblePartsClientError extends Error {
  constructor(
    message: string,
    public readonly skippedParts: SkippedPart[]
  ) {
    super(message)
    this.name = 'NoEligiblePartsClientError'
  }
}

/**
 * Error thrown when a recorded answer was for a different problem than the one
 * the server expects next (409 SLOT_MISMATCH): the client's plan is stale.
 */
export class SlotMismatchClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SlotMismatchClientError'
  }
}

/**
 * A try was sent while the session's next step is a part transition or a break
 * (409 `not_practicing`, Phase 3c). Nothing was recorded. `plan` is the
 * server's plan from the reply; the mutation applies it to the cache, and the
 * screen renders the transition or break from it. Nothing for the kid to read.
 */
export class NotPracticingClientError extends Error {
  constructor(public readonly plan: SessionPlan) {
    super(`Session is in ${plan.flowState}, not practicing`)
    this.name = 'NotPracticingClientError'
  }
}

/**
 * A try for a part whose kind the server does not know (409 `unknown_kind`,
 * practice-kinds K2, R14): a newer image's part read by an older one. Nothing
 * was recorded; the mutation has refetched the plan. Not the kid's fault, so
 * nothing for the kid to read.
 */
export class UnknownKindClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnknownKindClientError'
  }
}

/**
 * A flow event carried a stale `expectedFlowVersion` (409 `STALE_FLOW_VERSION`):
 * the server moved on. The mutation has refetched the active plan; the fresh
 * plan drives the screen. Nothing for the kid to read.
 */
export class StaleFlowVersionClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StaleFlowVersionClientError'
  }
}

/**
 * A write failed twice (network error or 5xx, then the same on its one
 * resend). The plan has been refetched; show the kid a plain message, never
 * the technical cause (which goes to the console). `contention` is set when the
 * last failure was 503 `write_contention` (other writers kept winning the row):
 * the screen resyncs to the refetched plan with no message at all (§3.3).
 */
export class TryNotSavedError extends Error {
  constructor(
    public readonly failure: unknown,
    public readonly contention = false
  ) {
    super(failure instanceof Error ? failure.message : String(failure))
    this.name = 'TryNotSavedError'
  }
}

/**
 * Send a write; on a network error or a 5xx, send the same request once more,
 * immediately (no timer). A second failure throws TryNotSavedError. 4xx answers
 * are returned as they are.
 *
 * Safe for a try because its body carries the `tryId`: the server records a try
 * id once, so a resend after a lost reply is a no-op. Safe for a flow event
 * because its body carries `expectedFlowVersion`: if the first send committed,
 * the resend is stale and is either the no-op of an event that changes nothing
 * from the fresh state or a 409 `STALE_FLOW_VERSION`, which refetches.
 */
async function sendTryWrite(send: () => Promise<Response>): Promise<Response> {
  let lastFailure: unknown
  let contention = false
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await send()
      if (res.status < 500) return res
      const body = await res.json().catch(() => ({}))
      lastFailure = new Error(body.error || `HTTP ${res.status}`)
      contention = res.status === 503 && body.code === 'write_contention'
    } catch (networkError) {
      lastFailure = networkError
      contention = false
    }
    console.warn(`[sessionPlan] write failed (attempt ${attempt + 1} of 2):`, lastFailure)
  }
  throw new TryNotSavedError(lastFailure, contention)
}

/** Throw the client error a failed try write maps to (4xx after sendTryWrite). */
async function throwTryWriteError(res: Response, fallback: string): Promise<never> {
  const error = await res.json().catch(() => ({}))
  if (res.status === 409 && error.code === 'SLOT_MISMATCH') {
    throw new SlotMismatchClientError(error.error || 'Answer was for a different problem')
  }
  if (res.status === 409 && error.code === 'not_practicing' && error.plan) {
    throw new NotPracticingClientError(error.plan as SessionPlan)
  }
  if (res.status === 409 && error.code === 'unknown_kind') {
    throw new UnknownKindClientError(
      error.error || 'Answer was for a part this server cannot record'
    )
  }
  throw new Error(error.error || fallback)
}

/**
 * Whether a failed try write needs no word to the kid: the screen resyncs to
 * the server's plan (already applied or refetched by the mutation) and that is
 * the whole story. A stale answer (409 `SLOT_MISMATCH`, which since K2 includes
 * a do-over of an answer already divulged), a try while a transition or break
 * owns the next step (409 `not_practicing`), a try for a part of a kind the
 * server does not know (409 `unknown_kind`, K2), and a try the server could
 * not write for contention after its one resend (503).
 */
export function isQuietTryWriteFailure(err: unknown): boolean {
  return (
    err instanceof SlotMismatchClientError ||
    err instanceof NotPracticingClientError ||
    err instanceof UnknownKindClientError ||
    (err instanceof TryNotSavedError && err.contention)
  )
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

    // Handle 400 - every requested part gated out by readiness
    if (res.status === 400 && errorData.code === 'NO_ELIGIBLE_PARTS') {
      throw new NoEligiblePartsClientError(errorData.error, errorData.skippedParts ?? [])
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
  reason,
  breakFinishReason,
}: {
  playerId: string
  planId: string
  action:
    | 'approve'
    | 'start'
    | 'end_early'
    | 'abandon'
    | 'part_transition_complete'
    | 'break_finished'
    | 'break_results_acked'
  reason?: string
  breakFinishReason?: 'timeout' | 'gameFinished' | 'skipped'
}): Promise<SessionPlan> {
  const res = await api(`curriculum/${playerId}/sessions/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reason, breakFinishReason }),
  })
  if (!res.ok) await throwTryWriteError(res, `Failed to ${action} session plan`)
  const data = await res.json()
  return data.plan
}

async function applySessionFlowEvent({
  playerId,
  planId,
  event,
  expectedFlowVersion,
}: {
  playerId: string
  planId: string
  event: SessionFlowEvent
  expectedFlowVersion?: number
}): Promise<SessionPlan> {
  // Resent once on a network error or 5xx; the version token makes that safe
  const res = await sendTryWrite(() =>
    api(`curriculum/${playerId}/sessions/plans/${planId}/flow-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, expectedFlowVersion }),
    })
  )
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    if (res.status === 409 && error.code === 'STALE_FLOW_VERSION') {
      throw new StaleFlowVersionClientError(error.error || `Stale flow event: ${event.type}`)
    }
    throw new Error(error.error || `Failed to apply flow event: ${event.type}`)
  }
  const data = await res.json()
  return data.plan
}

/**
 * Context for recording a redo result
 */
export interface RedoContext {
  /**
   * The item being redone (Phase 5b). A server from Phase 5a on matches the
   * do-over by it (the indices beside it must agree); the indices stay for
   * servers before it during the rollout.
   */
  itemId?: string
  /** Part index of the problem being redone */
  originalPartIndex: number
  /** Slot index of the problem being redone */
  originalSlotIndex: number
  /** Whether the original answer was correct. Read only by servers from before Phase 1. */
  originalWasCorrect: boolean
}

/**
 * Record a try in the envelope (`record_try`, practice-kinds §1.3, K4): every
 * try the client sends, a first try, a retry and a do-over. Resent once on a
 * network error or 5xx (same `tryId`). The server answers 409 `unknown_kind`
 * for a part it does not know.
 */
async function recordTryWrite({
  playerId,
  planId,
  submission,
}: {
  playerId: string
  planId: string
  submission: TrySubmission
}): Promise<SessionPlan> {
  const res = await sendTryWrite(() =>
    api(`curriculum/${playerId}/sessions/plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'record_try', result: submission }),
    })
  )
  if (!res.ok) await throwTryWriteError(res, 'Failed to record try')
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

/** Refetch a session plan after a failed write (active + detail queries). */
function refetchPlan(queryClient: QueryClient, playerId: string, planId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: sessionPlanKeys.active(playerId) }),
    queryClient.invalidateQueries({ queryKey: sessionPlanKeys.detail(planId) }),
  ])
}

/**
 * After a failed try write the screen is ahead of the server. A 409
 * `not_practicing` carries the server's plan: apply it. Anything else:
 * refetch. Returned so the mutation settles (and mutateAsync rejects) only once
 * the cache holds the server's plan; the write queue holds the next answer
 * until then.
 */
function resyncAfterTryWriteError(
  queryClient: QueryClient,
  err: Error,
  playerId: string,
  planId: string
) {
  if (err instanceof NotPracticingClientError) {
    queryClient.setQueryData(sessionPlanKeys.active(playerId), err.plan)
    queryClient.setQueryData(sessionPlanKeys.detail(planId), err.plan)
    return Promise.resolve()
  }
  return refetchPlan(queryClient, playerId, planId)
}

/** Apply a flow event's reply: the server's plan, into both caches. */
function applyFlowEventPlan(queryClient: QueryClient, plan: SessionPlan, playerId: string) {
  queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
  queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
}

/**
 * The plan as the server holds it now, by id: also once it is no longer the
 * player's active plan (an adult ended it, say), which the active query would
 * answer with null. Written into both caches; on failure both are refetched.
 */
async function resyncPlanById(queryClient: QueryClient, playerId: string, planId: string) {
  try {
    const res = await api(`curriculum/${playerId}/sessions/plans/${planId}`)
    if (res.ok) {
      const data = await res.json()
      if (data.plan) {
        applyFlowEventPlan(queryClient, data.plan as SessionPlan, playerId)
        return data.plan as SessionPlan
      }
    }
  } catch {
    // Fall back to the refetch below
  }
  await refetchPlan(queryClient, playerId, planId)
  return null
}

/** Flow-event failures the kid is not told about: see `onFlowEventError`. */
const quietFlowEventFailures = new WeakSet<Error>()

/**
 * A flow-event failure the screen resolved by itself: the fresh plan drives
 * it, and there is nothing for the kid to read.
 */
export function isQuietFlowEventFailure(err: unknown): boolean {
  return (
    err instanceof StaleFlowVersionClientError ||
    (err instanceof Error && quietFlowEventFailures.has(err))
  )
}

/**
 * Any failed flow event: fetch the plan as the server holds it, and that plan
 * drives the screen (§3.3, Phase 3c, §10 P3c-9). The failure is quiet unless
 * the fresh plan still shows the kid the step the event was for (`from`): then
 * it was a real failure the kid can act on (tap again). A stale token, or a
 * plan that moved on (an adult ended the session during the countdown), is
 * quiet. Returned so mutateAsync rejects only once the plan is in.
 */
async function onFlowEventError(
  queryClient: QueryClient,
  what: string,
  from: readonly SessionPlan['flowState'][],
  err: Error,
  playerId: string,
  planId: string
) {
  if (err instanceof StaleFlowVersionClientError) {
    console.warn(`[sessionPlan] ${what}: stale flow token; resyncing`, err.message)
  } else {
    console.error(`Failed to ${what}:`, err.message)
  }
  const fresh = await resyncPlanById(queryClient, playerId, planId)
  if (fresh && (fresh.status !== 'in_progress' || !from.includes(fresh.flowState))) {
    quietFlowEventFailures.add(err)
  }
}

/**
 * Hook: Record a slot result (answer submitted): a first try or a retry,
 * sent as `record_try` (K4)
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
      /** The part of the problem answered and the try's id: the envelope names both */
      result: SlotResultSubmission & { partIndex: number; tryId: string }
    }) =>
      recordTryWrite({
        playerId,
        planId,
        submission: envelopeOfScreenTry(result, {
          mode: 'first_or_retry',
          partIndex: result.partIndex,
        }),
      }),
    onSuccess: (plan, { playerId }) => {
      queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
    },
    // Any failed write leaves the screen ahead of the server: resync.
    onError: (err, { playerId, planId }) => {
      if (!isQuietTryWriteFailure(err)) {
        console.error('Failed to record slot result:', err.message)
      }
      return resyncAfterTryWriteError(queryClient, err, playerId, planId)
    },
  })
}

/**
 * Hook: Record a try in the envelope (`record_try`, practice-kinds §1.3), as
 * the kind's shell will (K5). Today's screen goes through
 * `useRecordSlotResult` / `useRecordRedoResult`, which send the same action.
 */
export function useRecordTry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: recordTryWrite,
    onSuccess: (plan, { playerId }) => {
      queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
    },
    onError: (err, { playerId, planId }) => {
      if (!isQuietTryWriteFailure(err)) {
        console.error('Failed to record try:', err.message)
      }
      return resyncAfterTryWriteError(queryClient, err, playerId, planId)
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
    mutationFn: ({
      playerId,
      planId,
      expectedFlowVersion,
      shouldRunBreak,
    }: {
      playerId: string
      planId: string
      expectedFlowVersion?: number
      shouldRunBreak: boolean
    }) =>
      applySessionFlowEvent({
        playerId,
        planId,
        expectedFlowVersion,
        event: { type: 'PART_TRANSITION_COMPLETED', shouldRunBreak },
      }),
    onSuccess: (plan, { playerId }) => applyFlowEventPlan(queryClient, plan, playerId),
    onError: (err, { playerId, planId }) =>
      onFlowEventError(
        queryClient,
        'complete part transition',
        ['part_transition'],
        err,
        playerId,
        planId
      ),
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
      breakResults,
      expectedFlowVersion,
    }: {
      playerId: string
      planId: string
      breakFinishReason: 'timeout' | 'gameFinished' | 'skipped'
      breakResults?: GameResultsReport | null
      expectedFlowVersion?: number
    }) =>
      applySessionFlowEvent({
        playerId,
        planId,
        expectedFlowVersion,
        event: {
          type: 'BREAK_FINISHED',
          reason: breakFinishReason,
          results: breakResults ?? null,
        },
      }),
    onSuccess: (plan, { playerId }) => applyFlowEventPlan(queryClient, plan, playerId),
    onError: (err, { playerId, planId }) =>
      onFlowEventError(
        queryClient,
        'finish game break',
        ['break_pending', 'break_active'],
        err,
        playerId,
        planId
      ),
  })
}

/**
 * Hook: Mark game break as started and persist selected game.
 */
export function useStartGameBreak() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      playerId,
      planId,
      game,
      expectedFlowVersion,
    }: {
      playerId: string
      planId: string
      game?: string | null
      expectedFlowVersion?: number
    }) =>
      applySessionFlowEvent({
        playerId,
        planId,
        expectedFlowVersion,
        event: { type: 'BREAK_STARTED', game },
      }),
    onSuccess: (plan, { playerId }) => applyFlowEventPlan(queryClient, plan, playerId),
    onError: (err, { playerId, planId }) =>
      onFlowEventError(queryClient, 'start game break', ['break_pending'], err, playerId, planId),
  })
}

/**
 * Hook: Acknowledge game break results screen and return to practicing.
 */
export function useAcknowledgeGameBreakResults() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      playerId,
      planId,
      expectedFlowVersion,
    }: {
      playerId: string
      planId: string
      expectedFlowVersion?: number
    }) =>
      applySessionFlowEvent({
        playerId,
        planId,
        expectedFlowVersion,
        event: { type: 'BREAK_RESULTS_ACKED' },
      }),
    onSuccess: (plan, { playerId }) => applyFlowEventPlan(queryClient, plan, playerId),
    onError: (err, { playerId, planId }) =>
      onFlowEventError(
        queryClient,
        'acknowledge game break results',
        ['break_results'],
        err,
        playerId,
        planId
      ),
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
 * - A do-over of a problem already answered correctly is recorded practice-only
 *   (weight 0): it changes no score, verdict or mastery
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
      result: Omit<SlotResult, 'timestamp' | 'partNumber'> & { tryId: string }
      redoContext: RedoContext
    }) =>
      recordTryWrite({
        playerId,
        planId,
        submission: envelopeOfScreenTry(result, {
          mode: 'do_over',
          partIndex: redoContext.originalPartIndex,
          itemId: redoContext.itemId,
        }),
      }),
    onSuccess: (plan, { playerId }) => {
      queryClient.setQueryData(sessionPlanKeys.active(playerId), plan)
      queryClient.setQueryData(sessionPlanKeys.detail(plan.id), plan)
    },
    onError: (err, { playerId, planId }) => {
      if (!isQuietTryWriteFailure(err)) {
        console.error('Failed to record redo result:', err.message)
      }
      return resyncAfterTryWriteError(queryClient, err, playerId, planId)
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
