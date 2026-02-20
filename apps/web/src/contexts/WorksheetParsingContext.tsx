'use client'

/**
 * Worksheet Parsing Context
 *
 * Provides a centralized state management for all worksheet parsing operations.
 * Eliminates prop drilling and ensures a single source of truth for parsing state.
 *
 * Features:
 * - Streaming parse with real-time reasoning display
 * - Selective re-parse of specific problems
 * - Automatic React Query cache invalidation
 * - Cancellation support
 *
 * @example
 * ```tsx
 * // In parent component (e.g., SummaryClient)
 * <WorksheetParsingProvider playerId={studentId} sessionId={sessionId}>
 *   <OfflineWorkSection />
 *   <PhotoViewerEditor />
 * </WorksheetParsingProvider>
 *
 * // In child component
 * const { state, startParse, cancel } = useWorksheetParsingContext()
 * ```
 */

import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import type { Socket } from 'socket.io-client'
import type { ParsingStatus } from '@/db/schema/practice-attachments'
import { api } from '@/lib/queryClient'
import { attachmentKeys, sessionHistoryKeys, sessionPlanKeys } from '@/lib/queryKeys'
import { createSocket } from '@/lib/socket'
import type {
  BoundingBox,
  ProblemCorrection,
  WorksheetParsingResult,
} from '@/lib/worksheet-parsing'
import { extractCompletedProblemsFromPartialJson } from '@/lib/worksheet-parsing/sse-parser'
import {
  getStreamingStatus,
  initialParsingState,
  isAnyParsingActive,
  isParsingAttachment,
  type ParsingContextState,
  type ParsingStats,
  parsingReducer,
  type StreamingStatus,
} from '@/lib/worksheet-parsing/state-machine'

// ============================================================================
// Types
// ============================================================================

/** Options for starting a parse operation */
export interface StartParseOptions {
  attachmentId: string
  /** Optional additional context/hints for the LLM */
  additionalContext?: string
  /** Optional bounding boxes to preserve from user adjustments */
  preservedBoundingBoxes?: Record<number, BoundingBox>
}

/** Options for starting a selective re-parse operation */
export interface StartReparseOptions {
  attachmentId: string
  /** Indices of problems to re-parse (0-based) */
  problemIndices: number[]
  /** Bounding boxes for each problem (must match problemIndices length) */
  boundingBoxes: BoundingBox[]
  /** Optional additional context/hints for the LLM */
  additionalContext?: string
}

/** Response from approve API */
export interface ApproveResponse {
  success: boolean
  sessionId: string
  problemCount: number
  correctCount: number
  accuracy: number | null
  skillsExercised: string[]
  stats: ParsingStats
}

/** Cached session attachments shape for optimistic updates */
interface AttachmentsCache {
  attachments: Array<{
    id: string
    parsingStatus: ParsingStatus | null
    parsingError: string | null
    rawParsingResult: WorksheetParsingResult | null
    confidenceScore: number | null
    needsReview: boolean
    parsedAt: string | null
    sessionCreated: boolean
    createdSessionId: string | null
    [key: string]: unknown
  }>
}

/** Context value exposed to consumers */
export interface WorksheetParsingContextValue {
  // State (read-only)
  state: ParsingContextState

  // Derived helpers
  isParsingAttachment: (attachmentId: string) => boolean
  isAnyParsingActive: () => boolean
  getStreamingStatus: (attachmentId: string) => StreamingStatus | null

  // Streaming actions
  startParse: (options: StartParseOptions) => Promise<void>
  startReparse: (options: StartReparseOptions) => Promise<void>
  /** Cancel parsing for a specific attachment */
  cancel: (attachmentId: string) => void
  /** Cancel all active parsing operations and reset state */
  cancelAll: () => void

  /** Reconnect to an in-progress task (for page reload recovery) */
  reconnectToTask: (attachmentId: string) => Promise<boolean>

  // Non-streaming mutations
  submitCorrection: (
    attachmentId: string,
    corrections: ProblemCorrection[],
    markAsReviewed?: boolean
  ) => Promise<void>
  approve: (attachmentId: string) => Promise<ApproveResponse>
  unapprove: (attachmentId: string) => Promise<void>
}

// ============================================================================
// Context
// ============================================================================

const WorksheetParsingContext = createContext<WorksheetParsingContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface WorksheetParsingProviderProps {
  playerId: string
  sessionId: string
  children: ReactNode
}

export function WorksheetParsingProvider({
  playerId,
  sessionId,
  children,
}: WorksheetParsingProviderProps) {
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(parsingReducer, initialParsingState)
  // Maps for per-attachment socket and task tracking (supports concurrent parses)
  const socketsRef = useRef<Map<string, Socket>>(new Map())
  const taskIdsRef = useRef<Map<string, string>>(new Map())

  // Query key for this session's attachments
  const queryKey = useMemo(() => attachmentKeys.session(playerId, sessionId), [playerId, sessionId])

  // ============================================================================
  // Cache Helpers
  // ============================================================================

  /**
   * Invalidate attachment cache after mutations
   */
  const invalidateAttachments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  /**
   * Optimistically update attachment status in cache
   */
  const updateAttachmentStatus = useCallback(
    (attachmentId: string, updates: Partial<AttachmentsCache['attachments'][0]>) => {
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey)
      if (previous) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...previous,
          attachments: previous.attachments.map((a) =>
            a.id === attachmentId ? { ...a, ...updates } : a
          ),
        })
      }
      return previous
    },
    [queryClient, queryKey]
  )

  // ============================================================================
  // Socket.IO Task Subscription
  // ============================================================================

  /**
   * Clean up socket and task tracking for a specific attachment
   */
  const cleanupAttachmentSocket = useCallback((attachmentId: string) => {
    const socket = socketsRef.current.get(attachmentId)
    const taskId = taskIdsRef.current.get(attachmentId)
    if (socket) {
      if (taskId) {
        socket.emit('task:unsubscribe', taskId)
      }
      socket.disconnect()
      socketsRef.current.delete(attachmentId)
    }
    taskIdsRef.current.delete(attachmentId)
  }, [])

  /**
   * Subscribe to a task via Socket.IO for real-time updates
   */
  const subscribeToTask = useCallback(
    (taskId: string, attachmentId: string) => {
      // Clean up any existing socket for this attachment
      cleanupAttachmentSocket(attachmentId)

      // Track the task ID for this attachment
      taskIdsRef.current.set(attachmentId, taskId)

      const socket = createSocket({
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      })
      socketsRef.current.set(attachmentId, socket)

      let accumulatedOutput = ''
      const dispatchedProblemNumbers = new Set<number>()

      const handleConnect = () => {
        console.log(`[Parse:${attachmentId.slice(-6)}] Socket connected, task=${taskId.slice(-8)}`)
        socket.emit('task:subscribe', taskId)
      }

      socket.on('connect', handleConnect)
      if (socket.connected) handleConnect()

      socket.on('disconnect', () => {
        console.log(`[Parse:${attachmentId.slice(-6)}] Socket disconnected`)
      })

      socket.on('connect_error', (err) => {
        console.error(`[Parse:${attachmentId.slice(-6)}] Socket connect error:`, err.message)
      })

      // Handle initial task state from server
      socket.on(
        'task:state',
        (task: {
          id: string
          status: string
          progress: number
          progressMessage: string | null
        }) => {
          // Update progress if task is already running
          if (task.progress > 0 || task.progressMessage) {
            dispatch({
              type: 'STREAM_PROGRESS_MESSAGE',
              attachmentId,
              message: task.progressMessage || `Progress: ${task.progress}%`,
            })
          }
        }
      )

      // Handle task events
      socket.on(
        'task:event',
        (event: { taskId: string; eventType: string; payload: unknown; replayed?: boolean }) => {
          if (event.taskId !== taskId) return

          const payload = event.payload as Record<string, unknown>

          switch (event.eventType) {
            // === Lifecycle events (emitted by task-manager) ===
            case 'progress': {
              const message = payload.message as string | undefined
              if (message) {
                dispatch({ type: 'STREAM_PROGRESS_MESSAGE', attachmentId, message })
              }
              break
            }

            case 'failed':
              dispatch({
                type: 'PARSE_FAILED',
                attachmentId,
                error: (payload.error as string) ?? (payload.message as string) ?? 'Unknown error',
              })
              updateAttachmentStatus(attachmentId, {
                parsingStatus: 'failed',
                parsingError:
                  (payload.error as string) ?? (payload.message as string) ?? 'Unknown error',
              })
              cleanupAttachmentSocket(attachmentId)
              invalidateAttachments()
              break

            case 'cancelled':
              dispatch({ type: 'CANCEL', attachmentId })
              cleanupAttachmentSocket(attachmentId)
              invalidateAttachments()
              break

            // === Initial parse domain events ===
            case 'parse_started':
            case 'parse_llm_started':
              dispatch({
                type: 'STREAM_PROGRESS_MESSAGE',
                attachmentId,
                message: 'AI is analyzing the worksheet...',
              })
              break

            case 'parse_progress':
              dispatch({
                type: 'STREAM_PROGRESS_MESSAGE',
                attachmentId,
                message: (payload.message as string) ?? 'Processing...',
              })
              break

            case 'reasoning':
              dispatch({
                type: 'STREAM_REASONING',
                attachmentId,
                text: payload.text as string,
                append: true,
              })
              break

            case 'output_delta': {
              accumulatedOutput += payload.text as string
              dispatch({ type: 'STREAM_OUTPUT', attachmentId, text: payload.text as string })

              // Extract completed problems for progressive highlighting
              const completedProblems = extractCompletedProblemsFromPartialJson(accumulatedOutput)
              for (const problem of completedProblems) {
                if (!dispatchedProblemNumbers.has(problem.problemNumber)) {
                  dispatchedProblemNumbers.add(problem.problemNumber)
                  dispatch({ type: 'STREAM_PROBLEM_COMPLETE', attachmentId, problem })
                }
              }
              break
            }

            case 'parse_error':
              dispatch({
                type: 'PARSE_FAILED',
                attachmentId,
                error: (payload.error as string) ?? 'Unknown error',
              })
              updateAttachmentStatus(attachmentId, {
                parsingStatus: 'failed',
                parsingError: (payload.error as string) ?? 'Unknown error',
              })
              cleanupAttachmentSocket(attachmentId)
              invalidateAttachments()
              break

            case 'parse_complete': {
              const result = payload.data as WorksheetParsingResult
              const stats = payload.stats as ParsingStats | undefined
              const status = (payload.status as ParsingStatus) ?? 'approved'

              dispatch({ type: 'PARSE_COMPLETE', attachmentId, result, stats })

              // Update cache with result
              updateAttachmentStatus(attachmentId, {
                parsingStatus: status,
                rawParsingResult: result,
                confidenceScore: result.overallConfidence,
                needsReview: result.needsReview,
                parsedAt: new Date().toISOString(),
              })

              // Cleanup
              cleanupAttachmentSocket(attachmentId)
              invalidateAttachments()
              break
            }

            // === Reparse domain events ===
            case 'reparse_started':
              dispatch({
                type: 'STREAM_PROGRESS_MESSAGE',
                attachmentId,
                message: `Re-parsing ${payload.problemCount} problems...`,
              })
              break

            case 'problem_start':
              dispatch({
                type: 'STREAM_REPARSE_PROGRESS',
                attachmentId,
                current: payload.currentIndex as number,
                total: payload.totalProblems as number,
              })
              dispatch({
                type: 'STREAM_PROGRESS_MESSAGE',
                attachmentId,
                message: `Analyzing problem ${(payload.currentIndex as number) + 1} of ${payload.totalProblems}...`,
              })
              break

            case 'problem_complete': {
              const problemResult = payload.result as {
                problemBoundingBox?: BoundingBox
              }
              if (problemResult?.problemBoundingBox) {
                dispatch({
                  type: 'STREAM_PROBLEM_COMPLETE',
                  attachmentId,
                  problem: {
                    problemNumber: payload.problemNumber as number,
                    problemBoundingBox: problemResult.problemBoundingBox,
                  },
                  problemIndex: payload.problemIndex as number,
                })
              }
              dispatch({
                type: 'STREAM_PROGRESS_MESSAGE',
                attachmentId,
                message: `Completed problem ${(payload.currentIndex as number) + 1} of ${payload.totalProblems}`,
              })
              break
            }

            case 'problem_error':
              console.error(`[Parse:${attachmentId.slice(-6)}] Problem error:`, payload)
              // Continue with other problems, don't fail the whole operation
              break

            case 'reparse_complete': {
              // Reparse results are already saved to DB by the handler.
              // Transition state machine to complete, then cleanup.
              dispatch({ type: 'PARSE_COMPLETE', attachmentId, result: null, stats: undefined })
              cleanupAttachmentSocket(attachmentId)
              invalidateAttachments()
              break
            }

            // === Lifecycle safety net ===
            case 'completed': {
              // The task-manager emits 'completed' after the handler calls handle.complete().
              // Domain events (parse_complete / reparse_complete) normally handle this first,
              // but if they were missed (race, reconnect), this ensures state is cleaned up.
              if (state.activeStreams.has(attachmentId)) {
                dispatch({ type: 'PARSE_COMPLETE', attachmentId, result: null, stats: undefined })
                cleanupAttachmentSocket(attachmentId)
                invalidateAttachments()
              }
              break
            }
          }
        }
      )

      socket.on('task:error', (data: { taskId: string; error: string }) => {
        if (data.taskId === taskId) {
          dispatch({ type: 'PARSE_FAILED', attachmentId, error: data.error })
          cleanupAttachmentSocket(attachmentId)
        }
      })
    },
    [cleanupAttachmentSocket, updateAttachmentStatus, invalidateAttachments]
  )

  // Cleanup all sockets on unmount
  useEffect(() => {
    return () => {
      for (const [attachmentId, socket] of socketsRef.current.entries()) {
        const taskId = taskIdsRef.current.get(attachmentId)
        if (taskId) {
          socket.emit('task:unsubscribe', taskId)
        }
        socket.disconnect()
      }
      socketsRef.current.clear()
      taskIdsRef.current.clear()
    }
  }, [])

  // ============================================================================
  // Streaming Parse (via Background Task)
  // ============================================================================

  const startParse = useCallback(
    async (options: StartParseOptions) => {
      const { attachmentId, additionalContext, preservedBoundingBoxes } = options
      const shortId = attachmentId.slice(-6)

      // Log current state for debugging concurrent parsing
      const activeCount = state.activeStreams.size
      console.log(
        `[Parse:${shortId}] startParse called. Active streams: ${activeCount}`,
        activeCount > 0
          ? `[${[...state.activeStreams.keys()].map((k) => k.slice(-6)).join(', ')}]`
          : ''
      )

      // If this attachment already has an active parse, cancel it first
      if (isParsingAttachment(state, attachmentId)) {
        console.log(`[Parse:${shortId}] Cancelling existing parse for same attachment`)
        cleanupAttachmentSocket(attachmentId)
        dispatch({ type: 'CANCEL', attachmentId })
      }

      // Start streaming state
      dispatch({
        type: 'START_STREAMING',
        attachmentId,
        streamType: 'initial',
      })

      // Clear any previous error (streaming state tracks in-progress)
      updateAttachmentStatus(attachmentId, {
        parsingError: null,
      })

      try {
        const response = await fetch(
          `/api/curriculum/${playerId}/attachments/${attachmentId}/parse/task`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              additionalContext,
              preservedBoundingBoxes,
            }),
          }
        )

        if (!response.ok) {
          const error = await response.json()
          console.error(`[Parse:${shortId}] API error:`, error.error || error)
          // Update attachment status to reflect the failure
          if (response.status === 403) {
            updateAttachmentStatus(attachmentId, {
              parsingError: error.error ?? 'Forbidden',
            })
          }
          dispatch({
            type: 'PARSE_FAILED',
            attachmentId,
            error: error.error ?? 'Failed to start parsing',
            code: error.code,
          })
          return
        }

        const { taskId, status } = await response.json()
        console.log(`[Parse:${shortId}] Task created: ${taskId.slice(-8)} (${status})`)
        subscribeToTask(taskId, attachmentId)
      } catch (error) {
        console.error(`[Parse:${shortId}] Network error:`, error)
        dispatch({
          type: 'PARSE_FAILED',
          attachmentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        invalidateAttachments()
      }
    },
    [
      playerId,
      state,
      cleanupAttachmentSocket,
      updateAttachmentStatus,
      invalidateAttachments,
      subscribeToTask,
    ]
  )

  // ============================================================================
  // Streaming Reparse (via Background Task)
  // ============================================================================

  const startReparse = useCallback(
    async (options: StartReparseOptions) => {
      const { attachmentId, problemIndices, boundingBoxes, additionalContext } = options
      const shortId = attachmentId.slice(-6)

      // Log current state for debugging concurrent parsing
      const activeCount = state.activeStreams.size
      console.log(
        `[Reparse:${shortId}] startReparse called (${problemIndices.length} problems). Active streams: ${activeCount}`
      )

      // If this attachment already has an active parse, cancel it first
      if (isParsingAttachment(state, attachmentId)) {
        console.log(`[Reparse:${shortId}] Cancelling existing parse for same attachment`)
        cleanupAttachmentSocket(attachmentId)
        dispatch({ type: 'CANCEL', attachmentId })
      }

      // Start streaming state
      dispatch({
        type: 'START_STREAMING',
        attachmentId,
        streamType: 'reparse',
        totalProblems: problemIndices.length,
      })

      // Clear any previous error (streaming state tracks in-progress)
      updateAttachmentStatus(attachmentId, {
        parsingError: null,
      })

      try {
        const response = await fetch(
          `/api/curriculum/${playerId}/attachments/${attachmentId}/parse-selected/task`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              problemIndices,
              boundingBoxes,
              additionalContext,
            }),
          }
        )

        if (!response.ok) {
          const error = await response.json()
          console.error(`[Reparse:${shortId}] API error:`, error.error || error)
          if (response.status === 403) {
            updateAttachmentStatus(attachmentId, {
              parsingError: error.error ?? 'Forbidden',
            })
          }
          dispatch({
            type: 'PARSE_FAILED',
            attachmentId,
            error: error.error ?? 'Failed to start re-parsing',
            code: error.code,
          })
          return
        }

        const { taskId, status } = await response.json()
        console.log(`[Reparse:${shortId}] Task created: ${taskId.slice(-8)} (${status})`)
        subscribeToTask(taskId, attachmentId)
      } catch (error) {
        console.error(`[Reparse:${shortId}] Network error:`, error)
        dispatch({
          type: 'PARSE_FAILED',
          attachmentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        invalidateAttachments()
      }
    },
    [
      playerId,
      state,
      cleanupAttachmentSocket,
      updateAttachmentStatus,
      invalidateAttachments,
      subscribeToTask,
    ]
  )

  // ============================================================================
  // Cancel / Reset
  // ============================================================================

  /**
   * Cancel parsing for a specific attachment
   */
  const cancel = useCallback(
    (attachmentId: string) => {
      const shortId = attachmentId.slice(-6)
      console.log(`[Parse:${shortId}] Cancel requested`)

      // Cancel the task on the server
      const socket = socketsRef.current.get(attachmentId)
      const taskId = taskIdsRef.current.get(attachmentId)
      if (socket && taskId) {
        socket.emit('task:cancel', taskId)
      }

      // Clean up socket and local state
      cleanupAttachmentSocket(attachmentId)
      dispatch({ type: 'CANCEL', attachmentId })
    },
    [cleanupAttachmentSocket]
  )

  /**
   * Cancel all active parsing operations and reset state
   */
  const cancelAll = useCallback(() => {
    const count = socketsRef.current.size
    console.log(`[Parse] cancelAll called, cancelling ${count} active streams`)

    // Cancel all tasks on the server
    for (const [attachmentId, socket] of socketsRef.current.entries()) {
      const taskId = taskIdsRef.current.get(attachmentId)
      if (taskId) {
        socket.emit('task:cancel', taskId)
        socket.emit('task:unsubscribe', taskId)
      }
      socket.disconnect()
    }
    socketsRef.current.clear()
    taskIdsRef.current.clear()
    dispatch({ type: 'CANCEL_ALL' })
  }, [])

  // ============================================================================
  // Reconnect to In-Progress Task (for page reload recovery)
  // ============================================================================

  const reconnectToTask = useCallback(
    async (attachmentId: string): Promise<boolean> => {
      // Don't reconnect if we're already tracking this attachment
      if (isParsingAttachment(state, attachmentId)) {
        return true
      }

      // Don't reconnect if we already have an active socket for this attachment
      if (socketsRef.current.has(attachmentId)) {
        return false
      }

      try {
        // Query for active task
        const response = await fetch(
          `/api/curriculum/${playerId}/attachments/${attachmentId}/parse/task`,
          { method: 'GET' }
        )

        if (!response.ok) {
          return false
        }

        const { taskId, status } = await response.json()

        if (!taskId || status === 'none') {
          return false
        }

        // Set up streaming state for reconnection
        dispatch({
          type: 'START_STREAMING',
          attachmentId,
          streamType: 'initial',
        })

        // Subscribe to the task
        subscribeToTask(taskId, attachmentId)
        return true
      } catch (error) {
        console.error(`[Parse:${attachmentId.slice(-6)}] Reconnect failed:`, error)
        return false
      }
    },
    [playerId, state, subscribeToTask]
  )

  // ============================================================================
  // Non-Streaming Mutations
  // ============================================================================

  const submitCorrection = useCallback(
    async (attachmentId: string, corrections: ProblemCorrection[], markAsReviewed = false) => {
      const response = await api(`curriculum/${playerId}/attachments/${attachmentId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ corrections, markAsReviewed }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error ?? 'Failed to submit corrections')
      }
      invalidateAttachments()
    },
    [playerId, invalidateAttachments]
  )

  const approve = useCallback(
    async (attachmentId: string): Promise<ApproveResponse> => {
      // Optimistic update
      updateAttachmentStatus(attachmentId, {
        sessionCreated: true,
      })

      try {
        const response = await api(`curriculum/${playerId}/attachments/${attachmentId}/approve`, {
          method: 'POST',
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error ?? 'Failed to approve worksheet')
        }

        const result = (await response.json()) as ApproveResponse

        // Update cache with session ID
        updateAttachmentStatus(attachmentId, {
          sessionCreated: true,
          createdSessionId: result.sessionId,
          parsingStatus: 'approved',
        })

        // Invalidate related queries
        queryClient.invalidateQueries({
          queryKey: sessionPlanKeys.list(playerId),
        })
        queryClient.invalidateQueries({
          queryKey: sessionHistoryKeys.list(playerId),
        })
        invalidateAttachments()

        return result
      } catch (error) {
        // Revert optimistic update
        updateAttachmentStatus(attachmentId, {
          sessionCreated: false,
        })
        throw error
      }
    },
    [playerId, queryClient, updateAttachmentStatus, invalidateAttachments]
  )

  const unapprove = useCallback(
    async (attachmentId: string) => {
      // Optimistic update
      const previous = updateAttachmentStatus(attachmentId, {
        sessionCreated: false,
        parsingStatus: 'needs_review',
      })

      try {
        const response = await api(`curriculum/${playerId}/attachments/${attachmentId}/unapprove`, {
          method: 'POST',
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error ?? 'Failed to unapprove worksheet')
        }

        // Invalidate related queries
        queryClient.invalidateQueries({
          queryKey: sessionPlanKeys.list(playerId),
        })
        queryClient.invalidateQueries({
          queryKey: sessionHistoryKeys.list(playerId),
        })
        invalidateAttachments()
      } catch (error) {
        // Revert optimistic update
        if (previous) {
          queryClient.setQueryData(queryKey, previous)
        }
        throw error
      }
    },
    [playerId, queryClient, queryKey, updateAttachmentStatus, invalidateAttachments]
  )

  // ============================================================================
  // Context Value
  // ============================================================================

  const value = useMemo<WorksheetParsingContextValue>(
    () => ({
      state,
      isParsingAttachment: (attachmentId: string) => isParsingAttachment(state, attachmentId),
      isAnyParsingActive: () => isAnyParsingActive(state),
      getStreamingStatus: (attachmentId: string) => getStreamingStatus(state, attachmentId),
      startParse,
      startReparse,
      cancel,
      cancelAll,
      reconnectToTask,
      submitCorrection,
      approve,
      unapprove,
    }),
    [
      state,
      startParse,
      startReparse,
      cancel,
      cancelAll,
      reconnectToTask,
      submitCorrection,
      approve,
      unapprove,
    ]
  )

  return (
    <WorksheetParsingContext.Provider value={value}>{children}</WorksheetParsingContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access worksheet parsing context
 *
 * Must be used within a WorksheetParsingProvider
 *
 * @throws Error if used outside of WorksheetParsingProvider
 */
export function useWorksheetParsingContext(): WorksheetParsingContextValue {
  const context = useContext(WorksheetParsingContext)
  if (!context) {
    throw new Error('useWorksheetParsingContext must be used within a WorksheetParsingProvider')
  }
  return context
}

/**
 * Optional hook that returns null if outside provider (instead of throwing)
 *
 * Useful for components that might be used both inside and outside the provider
 */
export function useWorksheetParsingContextOptional(): WorksheetParsingContextValue | null {
  return useContext(WorksheetParsingContext)
}
