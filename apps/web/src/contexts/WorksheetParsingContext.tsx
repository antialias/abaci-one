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

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { attachmentKeys, sessionPlanKeys, sessionHistoryKeys } from '@/lib/queryKeys'
import { api } from '@/lib/queryClient'
import {
  parsingReducer,
  initialParsingState,
  isParsingAttachment,
  isAnyParsingActive,
  getStreamingStatus,
  type ParsingContextState,
  type StreamingStatus,
  type ParsingStats,
} from '@/lib/worksheet-parsing/state-machine'
import { extractCompletedProblemsFromPartialJson } from '@/lib/worksheet-parsing/sse-parser'
import type {
  WorksheetParsingResult,
  BoundingBox,
  ProblemCorrection,
} from '@/lib/worksheet-parsing'
import type { ParsingStatus } from '@/db/schema/practice-attachments'

// ============================================================================
// Types
// ============================================================================

/** Options for starting a parse operation */
export interface StartParseOptions {
  attachmentId: string
  /** Optional model config ID - uses default if not specified */
  modelConfigId?: string
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
  /** Optional model config ID */
  modelConfigId?: string
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
  cancel: () => void
  reset: () => void

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
  const socketRef = useRef<Socket | null>(null)
  const currentTaskIdRef = useRef<string | null>(null)

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
   * Subscribe to a task via Socket.IO for real-time updates
   */
  const subscribeToTask = useCallback(
    (taskId: string, attachmentId: string) => {
      // Clean up existing socket
      if (socketRef.current) {
        socketRef.current.emit('task:unsubscribe', currentTaskIdRef.current)
        socketRef.current.disconnect()
      }

      currentTaskIdRef.current = taskId

      const socket = io({
        path: '/api/socket',
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      })
      socketRef.current = socket

      let accumulatedOutput = ''
      const dispatchedProblemNumbers = new Set<number>()

      const handleConnect = () => {
        console.log('[WorksheetParsing] Socket connected, subscribing to task:', taskId)
        socket.emit('task:subscribe', taskId)
      }

      socket.on('connect', handleConnect)
      if (socket.connected) handleConnect()

      socket.on('disconnect', () => {
        console.log('[WorksheetParsing] Socket disconnected')
      })

      socket.on('connect_error', (err) => {
        console.error('[WorksheetParsing] Socket connect error:', err)
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
          console.log(
            '[WorksheetParsing] Received task:state:',
            task.status,
            task.progress,
            task.progressMessage
          )
          // Update progress if task is already running
          if (task.progress > 0 || task.progressMessage) {
            dispatch({
              type: 'STREAM_PROGRESS_MESSAGE',
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

          console.log(
            '[WorksheetParsing] Received task:event:',
            event.eventType,
            event.replayed ? '(replayed)' : '',
            JSON.stringify(event.payload).substring(0, 200)
          )

          const payload = event.payload as Record<string, unknown>

          switch (event.eventType) {
            // === Common events ===
            case 'parsing_started':
            case 'started':
              dispatch({
                type: 'STREAM_PROGRESS_MESSAGE',
                message: 'AI is analyzing the worksheet...',
              })
              break

            case 'reasoning':
              dispatch({
                type: 'STREAM_REASONING',
                text: payload.text as string,
                append: true,
              })
              break

            case 'progress': {
              const message = payload.message as string | undefined
              if (message) {
                dispatch({ type: 'STREAM_PROGRESS_MESSAGE', message })
              }
              break
            }

            case 'error':
            case 'failed':
              dispatch({
                type: 'PARSE_FAILED',
                error: (payload.error as string) ?? (payload.message as string) ?? 'Unknown error',
              })
              updateAttachmentStatus(attachmentId, {
                parsingStatus: 'failed',
                parsingError:
                  (payload.error as string) ?? (payload.message as string) ?? 'Unknown error',
              })
              socket.emit('task:unsubscribe', taskId)
              socket.disconnect()
              socketRef.current = null
              currentTaskIdRef.current = null
              invalidateAttachments()
              break

            case 'cancelled':
              dispatch({ type: 'CANCEL' })
              socket.emit('task:unsubscribe', taskId)
              socket.disconnect()
              socketRef.current = null
              currentTaskIdRef.current = null
              invalidateAttachments()
              break

            // === Initial parse events ===
            case 'output_delta': {
              accumulatedOutput += payload.text as string
              dispatch({ type: 'STREAM_OUTPUT', text: payload.text as string })

              // Extract completed problems for progressive highlighting
              const completedProblems = extractCompletedProblemsFromPartialJson(accumulatedOutput)
              for (const problem of completedProblems) {
                if (!dispatchedProblemNumbers.has(problem.problemNumber)) {
                  dispatchedProblemNumbers.add(problem.problemNumber)
                  dispatch({ type: 'STREAM_PROBLEM_COMPLETE', problem })
                }
              }
              break
            }

            case 'partial': {
              // Update progress message with problem count
              const partial = payload.data as { problems?: unknown[] }
              dispatch({
                type: 'STREAM_PROGRESS_MESSAGE',
                message: `Found ${partial.problems?.length ?? 0} problems...`,
              })
              break
            }

            case 'complete': {
              // Handle both parse and reparse complete events
              const result = payload.data as WorksheetParsingResult | undefined
              const updatedResult = payload.updatedResult as WorksheetParsingResult | undefined
              const finalResult = result ?? updatedResult

              if (finalResult) {
                const stats = payload.stats as ParsingStats | undefined
                const status = (payload.status as ParsingStatus) ?? 'approved'

                dispatch({ type: 'PARSE_COMPLETE', result: finalResult, stats })

                // Update cache with result
                updateAttachmentStatus(attachmentId, {
                  parsingStatus: status,
                  rawParsingResult: finalResult,
                  confidenceScore: finalResult.overallConfidence,
                  needsReview: finalResult.needsReview,
                  parsedAt: new Date().toISOString(),
                })
              }

              // Cleanup
              socket.emit('task:unsubscribe', taskId)
              socket.disconnect()
              socketRef.current = null
              currentTaskIdRef.current = null
              invalidateAttachments()
              break
            }

            // === Reparse-specific events ===
            case 'reparse_started':
              dispatch({
                type: 'STREAM_PROGRESS_MESSAGE',
                message: `Re-parsing ${payload.problemCount} problems...`,
              })
              break

            case 'problem_start':
              dispatch({
                type: 'STREAM_REPARSE_PROGRESS',
                current: payload.currentIndex as number,
                total: payload.totalProblems as number,
              })
              dispatch({
                type: 'STREAM_PROGRESS_MESSAGE',
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
                  problem: {
                    problemNumber: payload.problemNumber as number,
                    problemBoundingBox: problemResult.problemBoundingBox,
                  },
                  problemIndex: payload.problemIndex as number,
                })
              }
              dispatch({
                type: 'STREAM_PROGRESS_MESSAGE',
                message: `Completed problem ${(payload.currentIndex as number) + 1} of ${payload.totalProblems}`,
              })
              break
            }

            case 'problem_error':
              console.error('[WorksheetParsing] Problem error:', payload)
              // Continue with other problems, don't fail the whole operation
              break
          }
        }
      )

      socket.on('task:error', (data: { taskId: string; error: string }) => {
        if (data.taskId === taskId) {
          dispatch({ type: 'PARSE_FAILED', error: data.error })
          socket.disconnect()
          socketRef.current = null
          currentTaskIdRef.current = null
        }
      })
    },
    [updateAttachmentStatus, invalidateAttachments]
  )

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  // ============================================================================
  // Streaming Parse (via Background Task)
  // ============================================================================

  const startParse = useCallback(
    async (options: StartParseOptions) => {
      const { attachmentId, modelConfigId, additionalContext, preservedBoundingBoxes } = options

      // If switching to a different attachment, revert the previous one's status
      const previousAttachmentId = state.activeAttachmentId
      if (previousAttachmentId && previousAttachmentId !== attachmentId) {
        updateAttachmentStatus(previousAttachmentId, {
          parsingStatus: null,
          parsingError: null,
        })
      }

      // Cancel any existing task subscription
      if (socketRef.current && currentTaskIdRef.current) {
        socketRef.current.emit('task:cancel', currentTaskIdRef.current)
        socketRef.current.emit('task:unsubscribe', currentTaskIdRef.current)
        socketRef.current.disconnect()
        socketRef.current = null
        currentTaskIdRef.current = null
      }

      // Start streaming state
      dispatch({
        type: 'START_STREAMING',
        attachmentId,
        streamType: 'initial',
      })

      // Optimistic update
      updateAttachmentStatus(attachmentId, {
        parsingStatus: 'processing',
        parsingError: null,
      })

      try {
        // Start the background task
        console.log('[WorksheetParsing] Starting parse task for attachment:', attachmentId)
        const response = await fetch(
          `/api/curriculum/${playerId}/attachments/${attachmentId}/parse/task`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              modelConfigId,
              additionalContext,
              preservedBoundingBoxes,
            }),
          }
        )

        if (!response.ok) {
          const error = await response.json()
          console.error('[WorksheetParsing] Task API error:', error)
          dispatch({
            type: 'PARSE_FAILED',
            error: error.error ?? 'Failed to start parsing',
          })
          return
        }

        const { taskId, status } = await response.json()
        console.log('[WorksheetParsing] Task API response:', { taskId, status })

        if (status === 'already_running') {
          // Re-subscribe to existing task
          console.log('[WorksheetParsing] Re-subscribing to existing task')
          subscribeToTask(taskId, attachmentId)
        } else {
          // Subscribe to new task
          console.log('[WorksheetParsing] Subscribing to new task')
          subscribeToTask(taskId, attachmentId)
        }
      } catch (error) {
        dispatch({
          type: 'PARSE_FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        invalidateAttachments()
      }
    },
    [
      playerId,
      state.activeAttachmentId,
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
      const { attachmentId, problemIndices, boundingBoxes, additionalContext, modelConfigId } =
        options

      // If switching to a different attachment, revert the previous one's status
      const previousAttachmentId = state.activeAttachmentId
      if (previousAttachmentId && previousAttachmentId !== attachmentId) {
        updateAttachmentStatus(previousAttachmentId, {
          parsingStatus: null,
          parsingError: null,
        })
      }

      // Cancel any existing task subscription
      if (socketRef.current && currentTaskIdRef.current) {
        socketRef.current.emit('task:cancel', currentTaskIdRef.current)
        socketRef.current.emit('task:unsubscribe', currentTaskIdRef.current)
        socketRef.current.disconnect()
        socketRef.current = null
        currentTaskIdRef.current = null
      }

      // Start streaming state
      dispatch({
        type: 'START_STREAMING',
        attachmentId,
        streamType: 'reparse',
        totalProblems: problemIndices.length,
      })

      // Optimistic update
      updateAttachmentStatus(attachmentId, {
        parsingStatus: 'processing',
        parsingError: null,
      })

      try {
        // Start the background task
        console.log('[WorksheetParsing] Starting reparse task for attachment:', attachmentId)
        const response = await fetch(
          `/api/curriculum/${playerId}/attachments/${attachmentId}/parse-selected/task`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              problemIndices,
              boundingBoxes,
              additionalContext,
              modelConfigId,
            }),
          }
        )

        if (!response.ok) {
          const error = await response.json()
          console.error('[WorksheetParsing] Reparse task API error:', error)
          dispatch({
            type: 'PARSE_FAILED',
            error: error.error ?? 'Failed to start re-parsing',
          })
          return
        }

        const { taskId, status } = await response.json()
        console.log('[WorksheetParsing] Reparse task API response:', { taskId, status })

        if (status === 'already_running') {
          // Re-subscribe to existing task
          console.log('[WorksheetParsing] Re-subscribing to existing reparse task')
          subscribeToTask(taskId, attachmentId)
        } else {
          // Subscribe to new task
          console.log('[WorksheetParsing] Subscribing to new reparse task')
          subscribeToTask(taskId, attachmentId)
        }
      } catch (error) {
        dispatch({
          type: 'PARSE_FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        invalidateAttachments()
      }
    },
    [
      playerId,
      state.activeAttachmentId,
      updateAttachmentStatus,
      invalidateAttachments,
      subscribeToTask,
    ]
  )

  // ============================================================================
  // Cancel / Reset
  // ============================================================================

  const cancel = useCallback(() => {
    // Cancel task-based parse/reparse
    if (socketRef.current && currentTaskIdRef.current) {
      socketRef.current.emit('task:cancel', currentTaskIdRef.current)
      socketRef.current.emit('task:unsubscribe', currentTaskIdRef.current)
      socketRef.current.disconnect()
      socketRef.current = null
      currentTaskIdRef.current = null
    }
    dispatch({ type: 'CANCEL' })
  }, [])

  const reset = useCallback(() => {
    // Cancel task-based parse/reparse
    if (socketRef.current && currentTaskIdRef.current) {
      socketRef.current.emit('task:cancel', currentTaskIdRef.current)
      socketRef.current.emit('task:unsubscribe', currentTaskIdRef.current)
      socketRef.current.disconnect()
      socketRef.current = null
      currentTaskIdRef.current = null
    }
    dispatch({ type: 'RESET' })
  }, [])

  // ============================================================================
  // Reconnect to In-Progress Task (for page reload recovery)
  // ============================================================================

  const reconnectToTask = useCallback(
    async (attachmentId: string): Promise<boolean> => {
      // Don't reconnect if we're already tracking this attachment
      if (state.activeAttachmentId === attachmentId) {
        return true
      }

      // Don't reconnect if we already have an active socket
      if (socketRef.current && currentTaskIdRef.current) {
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
        console.error('[WorksheetParsing] Failed to reconnect:', error)
        return false
      }
    },
    [playerId, state.activeAttachmentId, subscribeToTask]
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
      reset,
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
      reset,
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
