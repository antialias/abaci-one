'use client'

/**
 * React Query hooks for worksheet parsing workflow
 *
 * Provides mutations for:
 * - Starting worksheet parsing (POST /parse)
 * - Submitting corrections (PATCH /review)
 * - Approving and creating session (POST /approve)
 * - Re-parsing selected problems (POST /parse-selected)
 *
 * Includes optimistic updates for immediate UI feedback.
 *
 * NOTE: For streaming parsing with SSE, use WorksheetParsingContext instead.
 * The streaming hooks (useStreamingParse, useStreamingReparse) have been
 * replaced by the context-based approach for centralized state management.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ParsingStatus } from '@/db/schema/practice-attachments'
import { api } from '@/lib/queryClient'
import { attachmentKeys, sessionHistoryKeys, sessionPlanKeys } from '@/lib/queryKeys'
import type {
  computeParsingStats,
  WorksheetParsingResult,
  ReviewProgress,
  ParsedProblem,
  BoundingBox,
} from '@/lib/worksheet-parsing'
import type { CompletedProblem } from './usePartialJsonParser'

// Re-export for use by components
export type { CompletedProblem }

/** Stats returned from parsing */
type ParsingStats = ReturnType<typeof computeParsingStats>

// ============================================================================
// Types
// ============================================================================

/** Extended attachment data with parsing fields */
export interface AttachmentWithParsing {
  id: string
  filename: string
  originalFilename: string | null
  mimeType: string
  fileSize: number
  uploadedAt: string
  url: string
  originalUrl: string | null
  corners: Array<{ x: number; y: number }> | null
  rotation: 0 | 90 | 180 | 270
  // Parsing fields
  parsingStatus: ParsingStatus | null
  parsedAt: string | null
  parsingError: string | null
  rawParsingResult: WorksheetParsingResult | null
  approvedResult: WorksheetParsingResult | null
  confidenceScore: number | null
  needsReview: boolean
  sessionCreated: boolean
  createdSessionId: string | null
}

/** Response from parse API */
interface ParseResponse {
  success: boolean
  status: ParsingStatus
  result?: WorksheetParsingResult
  stats?: ParsingStats
  error?: string
  attempts?: number
}

/** Response from approve API */
interface ApproveResponse {
  success: boolean
  sessionId: string
  problemCount: number
  correctCount: number
  accuracy: number | null
  skillsExercised: string[]
  stats: ParsingStats
}

/** Cached session attachments shape */
interface AttachmentsCache {
  attachments: AttachmentWithParsing[]
}

// ============================================================================
// Hooks
// ============================================================================

/** Options for starting parsing */
export interface StartParsingOptions {
  attachmentId: string
  /** Optional model config ID - uses default if not specified */
  modelConfigId?: string
  /** Optional additional context/hints for re-parsing */
  additionalContext?: string
  /** Optional bounding boxes to preserve from user adjustments (keyed by problem index) */
  preservedBoundingBoxes?: Record<number, { x: number; y: number; width: number; height: number }>
}

/**
 * Hook to start parsing a worksheet attachment
 */
export function useStartParsing(playerId: string, sessionId: string) {
  const queryClient = useQueryClient()
  const queryKey = attachmentKeys.session(playerId, sessionId)

  return useMutation({
    mutationFn: async (options: StartParsingOptions | string) => {
      // Support both old (string) and new (object) signature for backwards compatibility
      const { attachmentId, modelConfigId, additionalContext, preservedBoundingBoxes } =
        typeof options === 'string'
          ? {
              attachmentId: options,
              modelConfigId: undefined,
              additionalContext: undefined,
              preservedBoundingBoxes: undefined,
            }
          : options

      // Build request body if we have any options
      const body =
        modelConfigId || additionalContext || preservedBoundingBoxes
          ? JSON.stringify({
              modelConfigId,
              additionalContext,
              preservedBoundingBoxes,
            })
          : undefined

      const res = await api(`curriculum/${playerId}/attachments/${attachmentId}/parse`, {
        method: 'POST',
        body,
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to start parsing')
      }
      return res.json() as Promise<ParseResponse>
    },

    onMutate: async (options) => {
      const attachmentId = typeof options === 'string' ? options : options.attachmentId

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot current state
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey)

      // Optimistic update: mark as processing
      if (previous) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...previous,
          attachments: previous.attachments.map((a) =>
            a.id === attachmentId
              ? {
                  ...a,
                  parsingStatus: 'processing' as ParsingStatus,
                  parsingError: null,
                }
              : a
          ),
        })
      }

      return { previous }
    },

    onError: (_err, _options, context) => {
      // Revert on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },

    onSuccess: (data, options) => {
      const attachmentId = typeof options === 'string' ? options : options.attachmentId

      // Update cache with actual result
      const current = queryClient.getQueryData<AttachmentsCache>(queryKey)
      if (current && data.success) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...current,
          attachments: current.attachments.map((a) =>
            a.id === attachmentId
              ? {
                  ...a,
                  parsingStatus: data.status,
                  rawParsingResult: data.result ?? null,
                  confidenceScore: data.result?.overallConfidence ?? null,
                  needsReview: data.result?.needsReview ?? false,
                  parsedAt: new Date().toISOString(),
                }
              : a
          ),
        })
      }
    },

    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

// ============================================================================
// Streaming State Management
// ============================================================================

// NOTE: Streaming state is now managed via WorksheetParsingContext.
// See src/contexts/WorksheetParsingContext.tsx for the context provider
// and src/lib/worksheet-parsing/state-machine.ts for the state types.

/**
 * Hook to submit corrections to parsed problems
 */
export function useSubmitCorrections(playerId: string, sessionId: string) {
  const queryClient = useQueryClient()
  const queryKey = attachmentKeys.session(playerId, sessionId)

  return useMutation({
    mutationFn: async ({
      attachmentId,
      corrections,
      markAsReviewed = false,
    }: {
      attachmentId: string
      corrections: Array<{
        problemNumber: number
        correctedTerms?: number[] | null
        correctedStudentAnswer?: number | null
        shouldExclude?: boolean
      }>
      markAsReviewed?: boolean
    }) => {
      const res = await api(`curriculum/${playerId}/attachments/${attachmentId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ corrections, markAsReviewed }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to submit corrections')
      }
      return res.json()
    },

    onSuccess: () => {
      // Refetch to get updated data
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

/**
 * Hook to approve parsing and create a practice session
 */
export function useApproveAndCreateSession(playerId: string, sessionId: string) {
  const queryClient = useQueryClient()
  const queryKey = attachmentKeys.session(playerId, sessionId)

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await api(`curriculum/${playerId}/attachments/${attachmentId}/approve`, {
        method: 'POST',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve and create session')
      }
      return (await res.json()) as ApproveResponse
    },

    onMutate: async (attachmentId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot current state
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey)

      // Optimistic update: mark as creating session
      if (previous) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...previous,
          attachments: previous.attachments.map((a) =>
            a.id === attachmentId ? { ...a, sessionCreated: true } : a
          ),
        })
      }

      return { previous }
    },

    onError: (_err, _attachmentId, context) => {
      // Revert on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },

    onSuccess: (data, attachmentId) => {
      // Update cache with session ID
      const current = queryClient.getQueryData<AttachmentsCache>(queryKey)
      if (current && data.success) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...current,
          attachments: current.attachments.map((a) =>
            a.id === attachmentId
              ? {
                  ...a,
                  sessionCreated: true,
                  createdSessionId: data.sessionId,
                  parsingStatus: 'approved' as ParsingStatus,
                }
              : a
          ),
        })
      }

      // Invalidate session-related queries so new session appears
      queryClient.invalidateQueries({
        queryKey: sessionPlanKeys.list(playerId),
      })
      queryClient.invalidateQueries({
        queryKey: sessionHistoryKeys.list(playerId),
      })
    },

    onSettled: () => {
      // Always refetch attachments to ensure consistency
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

/** Response from unapprove API */
interface UnapproveResponse {
  success: boolean
  message: string
  problemsRemoved: number
}

/**
 * Hook to unapprove/revert a processed worksheet back to review state
 */
export function useUnapproveWorksheet(playerId: string, sessionId: string) {
  const queryClient = useQueryClient()
  const queryKey = attachmentKeys.session(playerId, sessionId)

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await api(`curriculum/${playerId}/attachments/${attachmentId}/unapprove`, {
        method: 'POST',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to unapprove worksheet')
      }
      return (await res.json()) as UnapproveResponse
    },

    onMutate: async (attachmentId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot current state
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey)

      // Optimistic update: revert to needs_review
      if (previous) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...previous,
          attachments: previous.attachments.map((a) =>
            a.id === attachmentId
              ? {
                  ...a,
                  sessionCreated: false,
                  parsingStatus: 'needs_review' as ParsingStatus,
                }
              : a
          ),
        })
      }

      return { previous }
    },

    onError: (_err, _attachmentId, context) => {
      // Revert on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },

    onSuccess: () => {
      // Invalidate session-related queries so changes appear
      queryClient.invalidateQueries({
        queryKey: sessionPlanKeys.list(playerId),
      })
      queryClient.invalidateQueries({
        queryKey: sessionHistoryKeys.list(playerId),
      })
    },

    onSettled: () => {
      // Always refetch attachments to ensure consistency
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

/** Options for selective re-parsing */
export interface ReparseSelectedOptions {
  attachmentId: string
  /** Indices of problems to re-parse (0-based) */
  problemIndices: number[]
  /** Bounding boxes for each problem (must match problemIndices length) */
  boundingBoxes: Array<{ x: number; y: number; width: number; height: number }>
  /** Optional additional context/hints for the LLM */
  additionalContext?: string
  /** Optional model config ID */
  modelConfigId?: string
}

/** Response from selective re-parse API */
interface ReparseSelectedResponse {
  success: boolean
  reparsedCount: number
  reparsedIndices: number[]
  updatedResult: import('@/lib/worksheet-parsing').WorksheetParsingResult
}

/**
 * Hook to re-parse selected problems
 */
export function useReparseSelected(playerId: string, sessionId: string) {
  const queryClient = useQueryClient()
  const queryKey = attachmentKeys.session(playerId, sessionId)

  return useMutation({
    mutationFn: async (options: ReparseSelectedOptions) => {
      const { attachmentId, problemIndices, boundingBoxes, additionalContext, modelConfigId } =
        options

      const res = await api(`curriculum/${playerId}/attachments/${attachmentId}/parse-selected`, {
        method: 'POST',
        body: JSON.stringify({
          problemIndices,
          boundingBoxes,
          additionalContext,
          modelConfigId,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to re-parse selected problems')
      }
      return res.json() as Promise<ReparseSelectedResponse>
    },

    onMutate: async (options) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot current state
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey)

      // Optimistic update: mark as processing
      if (previous) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...previous,
          attachments: previous.attachments.map((a) =>
            a.id === options.attachmentId
              ? { ...a, parsingStatus: 'processing' as ParsingStatus }
              : a
          ),
        })
      }

      return { previous }
    },

    onError: (_err, _options, context) => {
      // Revert on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },

    onSuccess: (data, options) => {
      // Update cache with actual result
      const current = queryClient.getQueryData<AttachmentsCache>(queryKey)
      if (current && data.success) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...current,
          attachments: current.attachments.map((a) =>
            a.id === options.attachmentId
              ? {
                  ...a,
                  parsingStatus: data.updatedResult.needsReview
                    ? ('needs_review' as ParsingStatus)
                    : ('approved' as ParsingStatus),
                  rawParsingResult: data.updatedResult,
                  confidenceScore: data.updatedResult.overallConfidence,
                  needsReview: data.updatedResult.needsReview,
                }
              : a
          ),
        })
      }
    },

    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

/**
 * Hook to cancel/reset parsing status
 */
export function useCancelParsing(playerId: string, sessionId: string) {
  const queryClient = useQueryClient()
  const queryKey = attachmentKeys.session(playerId, sessionId)

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await api(`curriculum/${playerId}/attachments/${attachmentId}/parse`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to cancel parsing')
      }
      return res.json()
    },

    onMutate: async (attachmentId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot current state
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey)

      // Optimistic update: reset to unparsed
      if (previous) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...previous,
          attachments: previous.attachments.map((a) =>
            a.id === attachmentId
              ? {
                  ...a,
                  parsingStatus: null,
                  parsedAt: null,
                  parsingError: null,
                  rawParsingResult: null,
                  confidenceScore: null,
                  needsReview: false,
                }
              : a
          ),
        })
      }

      return { previous }
    },

    onError: (_err, _attachmentId, context) => {
      // Revert on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },

    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

/**
 * Get parsing status badge color
 */
export function getParsingStatusColor(status: ParsingStatus | null): string {
  switch (status) {
    case 'processing':
      return 'blue.500'
    case 'needs_review':
      return 'yellow.500'
    case 'approved':
      return 'green.500'
    case 'failed':
      return 'red.500'
    default:
      return 'gray.500'
  }
}

/**
 * Get parsing status display text
 */
export function getParsingStatusText(status: ParsingStatus | null, problemCount?: number): string {
  switch (status) {
    case 'processing':
      return 'Analyzing...'
    case 'needs_review':
      return problemCount ? `${problemCount} problems (needs review)` : 'Needs review'
    case 'approved':
      return problemCount ? `${problemCount} problems` : 'Ready'
    case 'failed':
      return 'Failed'
    default:
      return 'Not parsed'
  }
}

// ============================================================================
// Review Progress Hooks
// ============================================================================

/** Response from review progress API */
interface ReviewProgressResponse {
  reviewProgress: ReviewProgress
  problems: ParsedProblem[]
  totalProblems: number
}

/**
 * Hook to fetch review progress for an attachment
 */
export function useReviewProgress(playerId: string, attachmentId: string | null) {
  return useQuery({
    queryKey: attachmentId ? attachmentKeys.reviewProgress(playerId, attachmentId) : ['disabled'],
    queryFn: async () => {
      if (!attachmentId) throw new Error('No attachment ID')
      const res = await api(`curriculum/${playerId}/attachments/${attachmentId}/review-progress`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch review progress')
      }
      return res.json() as Promise<ReviewProgressResponse>
    },
    enabled: !!attachmentId,
  })
}

/** Response from initialize review API */
interface InitializeReviewResponse {
  success: boolean
  reviewProgress: ReviewProgress
  problems: ParsedProblem[]
  message: string
}

/**
 * Hook to initialize a review session (auto-approves high-confidence problems)
 */
export function useInitializeReview(playerId: string, sessionId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await api(`curriculum/${playerId}/attachments/${attachmentId}/review-progress`, {
        method: 'POST',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to initialize review')
      }
      return res.json() as Promise<InitializeReviewResponse>
    },

    onSuccess: (_data, attachmentId) => {
      // Invalidate both review progress and session attachments
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.reviewProgress(playerId, attachmentId),
      })
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.session(playerId, sessionId),
      })
    },
  })
}

/** Options for updating review progress */
interface UpdateReviewProgressOptions {
  attachmentId: string
  currentIndex?: number
  status?: 'not_started' | 'in_progress' | 'completed'
  problemUpdate?: {
    index: number
    reviewStatus: 'pending' | 'approved' | 'corrected' | 'flagged'
  }
}

/**
 * Hook to update review progress (save position, mark problems reviewed)
 */
export function useUpdateReviewProgress(playerId: string, sessionId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (options: UpdateReviewProgressOptions) => {
      const { attachmentId, ...body } = options
      const res = await api(`curriculum/${playerId}/attachments/${attachmentId}/review-progress`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update review progress')
      }
      return res.json() as Promise<ReviewProgressResponse>
    },

    onMutate: async (options) => {
      const { attachmentId } = options
      const queryKey = attachmentKeys.reviewProgress(playerId, attachmentId)

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot current state for rollback
      const previous = queryClient.getQueryData<ReviewProgressResponse>(queryKey)

      // Optimistic update
      if (previous && options.problemUpdate) {
        const { index, reviewStatus } = options.problemUpdate
        queryClient.setQueryData<ReviewProgressResponse>(queryKey, {
          ...previous,
          problems: previous.problems.map((p, i) =>
            i === index ? { ...p, reviewStatus, reviewedAt: new Date().toISOString() } : p
          ),
          reviewProgress: {
            ...previous.reviewProgress,
            status: 'in_progress',
            lastReviewedAt: new Date().toISOString(),
          },
        })
      }

      return { previous, queryKey }
    },

    onError: (_err, _options, context) => {
      // Revert on error
      if (context?.previous && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous)
      }
    },

    onSuccess: (_data, options) => {
      // Also invalidate session attachments to keep list in sync
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.session(playerId, sessionId),
      })
    },

    onSettled: (_data, _error, options) => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.reviewProgress(playerId, options.attachmentId),
      })
    },
  })
}

// ============================================================================
// Mutation State Helpers
// ============================================================================

/**
 * Extract the pending attachment ID from a worksheet parsing mutation
 *
 * Handles both string and object variable types that different mutations use.
 * Returns null if mutation is not pending.
 *
 * Usage:
 * ```typescript
 * const startParsing = useStartParsing(...)
 * const parsingId = getPendingAttachmentId(startParsing)
 * ```
 */
export function getPendingAttachmentId(mutation: {
  isPending: boolean
  variables?: unknown
}): string | null {
  if (!mutation.isPending) return null
  const vars = mutation.variables
  if (typeof vars === 'string') return vars
  if (vars && typeof vars === 'object' && 'attachmentId' in vars) {
    return (vars as { attachmentId: string }).attachmentId
  }
  return null
}
