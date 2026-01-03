"use client";

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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import {
  attachmentKeys,
  sessionPlanKeys,
  sessionHistoryKeys,
} from "@/lib/queryKeys";
import type {
  WorksheetParsingResult,
  computeParsingStats,
} from "@/lib/worksheet-parsing";
import type { ParsingStatus } from "@/db/schema/practice-attachments";

/** Stats returned from parsing */
type ParsingStats = ReturnType<typeof computeParsingStats>;

// ============================================================================
// Types
// ============================================================================

/** Extended attachment data with parsing fields */
export interface AttachmentWithParsing {
  id: string;
  filename: string;
  originalFilename: string | null;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  url: string;
  originalUrl: string | null;
  corners: Array<{ x: number; y: number }> | null;
  rotation: 0 | 90 | 180 | 270;
  // Parsing fields
  parsingStatus: ParsingStatus | null;
  parsedAt: string | null;
  parsingError: string | null;
  rawParsingResult: WorksheetParsingResult | null;
  approvedResult: WorksheetParsingResult | null;
  confidenceScore: number | null;
  needsReview: boolean;
  sessionCreated: boolean;
  createdSessionId: string | null;
}

/** Response from parse API */
interface ParseResponse {
  success: boolean;
  status: ParsingStatus;
  result?: WorksheetParsingResult;
  stats?: ParsingStats;
  error?: string;
  attempts?: number;
}

/** Response from approve API */
interface ApproveResponse {
  success: boolean;
  sessionId: string;
  problemCount: number;
  correctCount: number;
  accuracy: number | null;
  skillsExercised: string[];
  stats: ParsingStats;
}

/** Cached session attachments shape */
interface AttachmentsCache {
  attachments: AttachmentWithParsing[];
}

// ============================================================================
// Hooks
// ============================================================================

/** Options for starting parsing */
export interface StartParsingOptions {
  attachmentId: string;
  /** Optional model config ID - uses default if not specified */
  modelConfigId?: string;
  /** Optional additional context/hints for re-parsing */
  additionalContext?: string;
  /** Optional bounding boxes to preserve from user adjustments (keyed by problem index) */
  preservedBoundingBoxes?: Record<
    number,
    { x: number; y: number; width: number; height: number }
  >;
}

/**
 * Hook to start parsing a worksheet attachment
 */
export function useStartParsing(playerId: string, sessionId: string) {
  const queryClient = useQueryClient();
  const queryKey = attachmentKeys.session(playerId, sessionId);

  return useMutation({
    mutationFn: async (options: StartParsingOptions | string) => {
      // Support both old (string) and new (object) signature for backwards compatibility
      const {
        attachmentId,
        modelConfigId,
        additionalContext,
        preservedBoundingBoxes,
      } =
        typeof options === "string"
          ? {
              attachmentId: options,
              modelConfigId: undefined,
              additionalContext: undefined,
              preservedBoundingBoxes: undefined,
            }
          : options;

      // Build request body if we have any options
      const body =
        modelConfigId || additionalContext || preservedBoundingBoxes
          ? JSON.stringify({
              modelConfigId,
              additionalContext,
              preservedBoundingBoxes,
            })
          : undefined;

      const res = await api(
        `curriculum/${playerId}/attachments/${attachmentId}/parse`,
        {
          method: "POST",
          body,
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to start parsing");
      }
      return res.json() as Promise<ParseResponse>;
    },

    onMutate: async (options) => {
      const attachmentId =
        typeof options === "string" ? options : options.attachmentId;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot current state
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey);

      // Optimistic update: mark as processing
      if (previous) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...previous,
          attachments: previous.attachments.map((a) =>
            a.id === attachmentId
              ? {
                  ...a,
                  parsingStatus: "processing" as ParsingStatus,
                  parsingError: null,
                }
              : a,
          ),
        });
      }

      return { previous };
    },

    onError: (_err, _options, context) => {
      // Revert on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSuccess: (data, options) => {
      const attachmentId =
        typeof options === "string" ? options : options.attachmentId;

      // Update cache with actual result
      const current = queryClient.getQueryData<AttachmentsCache>(queryKey);
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
              : a,
          ),
        });
      }
    },

    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Hook to submit corrections to parsed problems
 */
export function useSubmitCorrections(playerId: string, sessionId: string) {
  const queryClient = useQueryClient();
  const queryKey = attachmentKeys.session(playerId, sessionId);

  return useMutation({
    mutationFn: async ({
      attachmentId,
      corrections,
      markAsReviewed = false,
    }: {
      attachmentId: string;
      corrections: Array<{
        problemNumber: number;
        correctedTerms?: number[] | null;
        correctedStudentAnswer?: number | null;
        shouldExclude?: boolean;
      }>;
      markAsReviewed?: boolean;
    }) => {
      const res = await api(
        `curriculum/${playerId}/attachments/${attachmentId}/review`,
        {
          method: "PATCH",
          body: JSON.stringify({ corrections, markAsReviewed }),
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit corrections");
      }
      return res.json();
    },

    onSuccess: () => {
      // Refetch to get updated data
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Hook to approve parsing and create a practice session
 */
export function useApproveAndCreateSession(
  playerId: string,
  sessionId: string,
) {
  const queryClient = useQueryClient();
  const queryKey = attachmentKeys.session(playerId, sessionId);

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await api(
        `curriculum/${playerId}/attachments/${attachmentId}/approve`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to approve and create session");
      }
      return (await res.json()) as ApproveResponse;
    },

    onMutate: async (attachmentId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot current state
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey);

      // Optimistic update: mark as creating session
      if (previous) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...previous,
          attachments: previous.attachments.map((a) =>
            a.id === attachmentId ? { ...a, sessionCreated: true } : a,
          ),
        });
      }

      return { previous };
    },

    onError: (_err, _attachmentId, context) => {
      // Revert on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSuccess: (data, attachmentId) => {
      // Update cache with session ID
      const current = queryClient.getQueryData<AttachmentsCache>(queryKey);
      if (current && data.success) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...current,
          attachments: current.attachments.map((a) =>
            a.id === attachmentId
              ? {
                  ...a,
                  sessionCreated: true,
                  createdSessionId: data.sessionId,
                  parsingStatus: "approved" as ParsingStatus,
                }
              : a,
          ),
        });
      }

      // Invalidate session-related queries so new session appears
      queryClient.invalidateQueries({
        queryKey: sessionPlanKeys.list(playerId),
      });
      queryClient.invalidateQueries({
        queryKey: sessionHistoryKeys.list(playerId),
      });
    },

    onSettled: () => {
      // Always refetch attachments to ensure consistency
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** Options for selective re-parsing */
export interface ReparseSelectedOptions {
  attachmentId: string;
  /** Indices of problems to re-parse (0-based) */
  problemIndices: number[];
  /** Bounding boxes for each problem (must match problemIndices length) */
  boundingBoxes: Array<{ x: number; y: number; width: number; height: number }>;
  /** Optional additional context/hints for the LLM */
  additionalContext?: string;
  /** Optional model config ID */
  modelConfigId?: string;
}

/** Response from selective re-parse API */
interface ReparseSelectedResponse {
  success: boolean;
  reparsedCount: number;
  reparsedIndices: number[];
  updatedResult: import("@/lib/worksheet-parsing").WorksheetParsingResult;
}

/**
 * Hook to re-parse selected problems
 */
export function useReparseSelected(playerId: string, sessionId: string) {
  const queryClient = useQueryClient();
  const queryKey = attachmentKeys.session(playerId, sessionId);

  return useMutation({
    mutationFn: async (options: ReparseSelectedOptions) => {
      const {
        attachmentId,
        problemIndices,
        boundingBoxes,
        additionalContext,
        modelConfigId,
      } = options;

      const res = await api(
        `curriculum/${playerId}/attachments/${attachmentId}/parse-selected`,
        {
          method: "POST",
          body: JSON.stringify({
            problemIndices,
            boundingBoxes,
            additionalContext,
            modelConfigId,
          }),
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to re-parse selected problems");
      }
      return res.json() as Promise<ReparseSelectedResponse>;
    },

    onMutate: async (options) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot current state
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey);

      // Optimistic update: mark as processing
      if (previous) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...previous,
          attachments: previous.attachments.map((a) =>
            a.id === options.attachmentId
              ? { ...a, parsingStatus: "processing" as ParsingStatus }
              : a,
          ),
        });
      }

      return { previous };
    },

    onError: (_err, _options, context) => {
      // Revert on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSuccess: (data, options) => {
      // Update cache with actual result
      const current = queryClient.getQueryData<AttachmentsCache>(queryKey);
      if (current && data.success) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...current,
          attachments: current.attachments.map((a) =>
            a.id === options.attachmentId
              ? {
                  ...a,
                  parsingStatus: data.updatedResult.needsReview
                    ? ("needs_review" as ParsingStatus)
                    : ("approved" as ParsingStatus),
                  rawParsingResult: data.updatedResult,
                  confidenceScore: data.updatedResult.overallConfidence,
                  needsReview: data.updatedResult.needsReview,
                }
              : a,
          ),
        });
      }
    },

    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Get parsing status badge color
 */
export function getParsingStatusColor(status: ParsingStatus | null): string {
  switch (status) {
    case "processing":
      return "blue.500";
    case "needs_review":
      return "yellow.500";
    case "approved":
      return "green.500";
    case "failed":
      return "red.500";
    default:
      return "gray.500";
  }
}

/**
 * Get parsing status display text
 */
export function getParsingStatusText(
  status: ParsingStatus | null,
  problemCount?: number,
): string {
  switch (status) {
    case "processing":
      return "Analyzing...";
    case "needs_review":
      return problemCount
        ? `${problemCount} problems (needs review)`
        : "Needs review";
    case "approved":
      return problemCount ? `${problemCount} problems` : "Ready";
    case "failed":
      return "Failed";
    default:
      return "Not parsed";
  }
}
