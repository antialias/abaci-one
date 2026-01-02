'use client'

/**
 * React Query hooks for worksheet parsing workflow
 *
 * Provides mutations for:
 * - Starting worksheet parsing (POST /parse)
 * - Submitting corrections (PATCH /review)
 * - Approving and creating session (POST /approve)
 *
 * Includes optimistic updates for immediate UI feedback.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { attachmentKeys, sessionPlanKeys, sessionHistoryKeys } from '@/lib/queryKeys'
import type { WorksheetParsingResult, computeParsingStats } from '@/lib/worksheet-parsing'
import type { ParsingStatus } from '@/db/schema/practice-attachments'

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

/**
 * Hook to start parsing a worksheet attachment
 */
export function useStartParsing(playerId: string, sessionId: string) {
  const queryClient = useQueryClient()
  const queryKey = attachmentKeys.session(playerId, sessionId)

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await api(`curriculum/${playerId}/attachments/${attachmentId}/parse`, {
        method: 'POST',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to start parsing')
      }
      return res.json() as Promise<ParseResponse>
    },

    onMutate: async (attachmentId) => {
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
              ? { ...a, parsingStatus: 'processing' as ParsingStatus, parsingError: null }
              : a
          ),
        })
      }

      return { previous }
    },

    onError: (_err, attachmentId, context) => {
      // Revert on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },

    onSuccess: (data, attachmentId) => {
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
      return res.json() as Promise<ApproveResponse>
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
      queryClient.invalidateQueries({ queryKey: sessionPlanKeys.list(playerId) })
      queryClient.invalidateQueries({ queryKey: sessionHistoryKeys.list(playerId) })
    },

    onSettled: () => {
      // Always refetch attachments to ensure consistency
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
