"use client";

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
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  attachmentKeys,
  sessionPlanKeys,
  sessionHistoryKeys,
} from "@/lib/queryKeys";
import { api } from "@/lib/queryClient";
import {
  parsingReducer,
  initialParsingState,
  isParsingAttachment,
  isAnyParsingActive,
  getStreamingStatus,
  type ParsingContextState,
  type ParsingAction,
  type StreamingStatus,
  type ParsingStats,
} from "@/lib/worksheet-parsing/state-machine";
import {
  parseSSEStream,
  extractCompletedProblemsFromPartialJson,
} from "@/lib/worksheet-parsing/sse-parser";
import type {
  WorksheetParsingResult,
  BoundingBox,
  ProblemCorrection,
} from "@/lib/worksheet-parsing";
import type { ParsingStatus } from "@/db/schema/practice-attachments";

// ============================================================================
// Types
// ============================================================================

/** Options for starting a parse operation */
export interface StartParseOptions {
  attachmentId: string;
  /** Optional model config ID - uses default if not specified */
  modelConfigId?: string;
  /** Optional additional context/hints for the LLM */
  additionalContext?: string;
  /** Optional bounding boxes to preserve from user adjustments */
  preservedBoundingBoxes?: Record<number, BoundingBox>;
}

/** Options for starting a selective re-parse operation */
export interface StartReparseOptions {
  attachmentId: string;
  /** Indices of problems to re-parse (0-based) */
  problemIndices: number[];
  /** Bounding boxes for each problem (must match problemIndices length) */
  boundingBoxes: BoundingBox[];
  /** Optional additional context/hints for the LLM */
  additionalContext?: string;
  /** Optional model config ID */
  modelConfigId?: string;
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

/** Cached session attachments shape for optimistic updates */
interface AttachmentsCache {
  attachments: Array<{
    id: string;
    parsingStatus: ParsingStatus | null;
    parsingError: string | null;
    rawParsingResult: WorksheetParsingResult | null;
    confidenceScore: number | null;
    needsReview: boolean;
    parsedAt: string | null;
    sessionCreated: boolean;
    createdSessionId: string | null;
    [key: string]: unknown;
  }>;
}

/** Context value exposed to consumers */
export interface WorksheetParsingContextValue {
  // State (read-only)
  state: ParsingContextState;

  // Derived helpers
  isParsingAttachment: (attachmentId: string) => boolean;
  isAnyParsingActive: () => boolean;
  getStreamingStatus: (attachmentId: string) => StreamingStatus | null;

  // Streaming actions
  startParse: (options: StartParseOptions) => Promise<void>;
  startReparse: (options: StartReparseOptions) => Promise<void>;
  cancel: () => void;
  reset: () => void;

  // Non-streaming mutations
  submitCorrection: (
    attachmentId: string,
    corrections: ProblemCorrection[],
    markAsReviewed?: boolean,
  ) => Promise<void>;
  approve: (attachmentId: string) => Promise<ApproveResponse>;
  unapprove: (attachmentId: string) => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const WorksheetParsingContext =
  createContext<WorksheetParsingContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface WorksheetParsingProviderProps {
  playerId: string;
  sessionId: string;
  children: ReactNode;
}

export function WorksheetParsingProvider({
  playerId,
  sessionId,
  children,
}: WorksheetParsingProviderProps) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(parsingReducer, initialParsingState);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Query key for this session's attachments
  const queryKey = useMemo(
    () => attachmentKeys.session(playerId, sessionId),
    [playerId, sessionId],
  );

  // ============================================================================
  // Cache Helpers
  // ============================================================================

  /**
   * Invalidate attachment cache after mutations
   */
  const invalidateAttachments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  /**
   * Optimistically update attachment status in cache
   */
  const updateAttachmentStatus = useCallback(
    (
      attachmentId: string,
      updates: Partial<AttachmentsCache["attachments"][0]>,
    ) => {
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey);
      if (previous) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...previous,
          attachments: previous.attachments.map((a) =>
            a.id === attachmentId ? { ...a, ...updates } : a,
          ),
        });
      }
      return previous;
    },
    [queryClient, queryKey],
  );

  // ============================================================================
  // Streaming Parse
  // ============================================================================

  const startParse = useCallback(
    async (options: StartParseOptions) => {
      const {
        attachmentId,
        modelConfigId,
        additionalContext,
        preservedBoundingBoxes,
      } = options;

      // If switching to a different attachment, revert the previous one's status
      const previousAttachmentId = state.activeAttachmentId;
      if (previousAttachmentId && previousAttachmentId !== attachmentId) {
        // Revert previous attachment to null status (will be corrected by cache invalidation)
        updateAttachmentStatus(previousAttachmentId, {
          parsingStatus: null,
          parsingError: null,
        });
      }

      // Cancel any existing operation
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Start streaming
      dispatch({
        type: "START_STREAMING",
        attachmentId,
        streamType: "initial",
      });

      // Optimistic update
      updateAttachmentStatus(attachmentId, {
        parsingStatus: "processing",
        parsingError: null,
      });

      try {
        const response = await fetch(
          `/api/curriculum/${playerId}/attachments/${attachmentId}/parse/stream`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              modelConfigId,
              additionalContext,
              preservedBoundingBoxes,
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const error = await response.json();
          dispatch({
            type: "PARSE_FAILED",
            error: error.error ?? "Failed to start parsing",
          });
          return;
        }

        let accumulatedOutput = "";
        const dispatchedProblemNumbers = new Set<number>();

        await parseSSEStream(
          response,
          {
            onStarted: () => {
              dispatch({ type: "STREAM_PROGRESS_MESSAGE", message: "AI is analyzing the worksheet..." });
            },
            onReasoning: (text, isDelta) => {
              dispatch({ type: "STREAM_REASONING", text, append: isDelta });
            },
            onOutputDelta: (text) => {
              accumulatedOutput += text;
              dispatch({ type: "STREAM_OUTPUT", text });

              // Extract completed problems for progressive highlighting
              const completedProblems =
                extractCompletedProblemsFromPartialJson(accumulatedOutput);
              for (const problem of completedProblems) {
                // Only dispatch if we haven't already dispatched this problem
                if (!dispatchedProblemNumbers.has(problem.problemNumber)) {
                  dispatchedProblemNumbers.add(problem.problemNumber);
                  dispatch({ type: "STREAM_PROBLEM_COMPLETE", problem });
                }
              }
            },
            onComplete: (result, stats, status) => {
              dispatch({ type: "PARSE_COMPLETE", result, stats });

              // Update cache with result
              updateAttachmentStatus(attachmentId, {
                parsingStatus: (status as ParsingStatus) ?? "approved",
                rawParsingResult: result,
                confidenceScore: result.overallConfidence,
                needsReview: result.needsReview,
                parsedAt: new Date().toISOString(),
              });
            },
            onError: (message) => {
              dispatch({ type: "PARSE_FAILED", error: message });
            },
            onCancelled: () => {
              dispatch({ type: "CANCEL" });
            },
          },
          controller.signal,
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          dispatch({ type: "CANCEL" });
        } else {
          dispatch({
            type: "PARSE_FAILED",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } finally {
        abortControllerRef.current = null;
        invalidateAttachments();
      }
    },
    [playerId, state.activeAttachmentId, updateAttachmentStatus, invalidateAttachments],
  );

  // ============================================================================
  // Streaming Reparse
  // ============================================================================

  const startReparse = useCallback(
    async (options: StartReparseOptions) => {
      const {
        attachmentId,
        problemIndices,
        boundingBoxes,
        additionalContext,
        modelConfigId,
      } = options;

      // If switching to a different attachment, revert the previous one's status
      const previousAttachmentId = state.activeAttachmentId;
      if (previousAttachmentId && previousAttachmentId !== attachmentId) {
        // Revert previous attachment to null status (will be corrected by cache invalidation)
        updateAttachmentStatus(previousAttachmentId, {
          parsingStatus: null,
          parsingError: null,
        });
      }

      // Cancel any existing operation
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Start streaming
      dispatch({
        type: "START_STREAMING",
        attachmentId,
        streamType: "reparse",
        totalProblems: problemIndices.length,
      });

      // Optimistic update
      updateAttachmentStatus(attachmentId, {
        parsingStatus: "processing",
        parsingError: null,
      });

      try {
        const response = await fetch(
          `/api/curriculum/${playerId}/attachments/${attachmentId}/parse-selected/stream`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              problemIndices,
              boundingBoxes,
              additionalContext,
              modelConfigId,
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const error = await response.json();
          dispatch({
            type: "PARSE_FAILED",
            error: error.error ?? "Failed to start re-parsing",
          });
          return;
        }

        await parseSSEStream(
          response,
          {
            onProblemStart: (
              _problemIndex,
              _problemNumber,
              currentIndex,
              totalProblems,
            ) => {
              dispatch({
                type: "STREAM_REPARSE_PROGRESS",
                current: currentIndex,
                total: totalProblems,
              });
            },
            onReasoning: (text, isDelta) => {
              dispatch({ type: "STREAM_REASONING", text, append: isDelta });
            },
            onOutputDelta: () => {
              // For reparse, we just update progress message
              dispatch({
                type: "STREAM_PROGRESS_MESSAGE",
                message: "Extracting problem details...",
              });
            },
            onProblemComplete: (
              problemIndex,
              problemNumber,
              result,
              currentIndex,
              totalProblems,
            ) => {
              const problemResult = result as {
                problemBoundingBox?: BoundingBox;
              };
              if (problemResult?.problemBoundingBox) {
                dispatch({
                  type: "STREAM_PROBLEM_COMPLETE",
                  problem: {
                    problemNumber,
                    problemBoundingBox: problemResult.problemBoundingBox,
                  },
                  problemIndex,
                });
              }
              dispatch({
                type: "STREAM_PROGRESS_MESSAGE",
                message: `Completed problem ${currentIndex + 1} of ${totalProblems}`,
              });
            },
            onComplete: (result, _stats, status) => {
              dispatch({ type: "PARSE_COMPLETE", result });

              // Update cache with result
              updateAttachmentStatus(attachmentId, {
                parsingStatus: (status as ParsingStatus) ?? "approved",
                rawParsingResult: result,
                confidenceScore: result.overallConfidence,
                needsReview: result.needsReview,
              });
            },
            onError: (message) => {
              dispatch({ type: "PARSE_FAILED", error: message });
            },
            onCancelled: () => {
              dispatch({ type: "CANCEL" });
            },
          },
          controller.signal,
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          dispatch({ type: "CANCEL" });
        } else {
          dispatch({
            type: "PARSE_FAILED",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } finally {
        abortControllerRef.current = null;
        invalidateAttachments();
      }
    },
    [playerId, state.activeAttachmentId, updateAttachmentStatus, invalidateAttachments],
  );

  // ============================================================================
  // Cancel / Reset
  // ============================================================================

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    dispatch({ type: "CANCEL" });
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    dispatch({ type: "RESET" });
  }, []);

  // ============================================================================
  // Non-Streaming Mutations
  // ============================================================================

  const submitCorrection = useCallback(
    async (
      attachmentId: string,
      corrections: ProblemCorrection[],
      markAsReviewed = false,
    ) => {
      const response = await api(
        `curriculum/${playerId}/attachments/${attachmentId}/review`,
        {
          method: "PATCH",
          body: JSON.stringify({ corrections, markAsReviewed }),
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? "Failed to submit corrections");
      }
      invalidateAttachments();
    },
    [playerId, invalidateAttachments],
  );

  const approve = useCallback(
    async (attachmentId: string): Promise<ApproveResponse> => {
      // Optimistic update
      updateAttachmentStatus(attachmentId, {
        sessionCreated: true,
      });

      try {
        const response = await api(
          `curriculum/${playerId}/attachments/${attachmentId}/approve`,
          { method: "POST" },
        );
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error ?? "Failed to approve worksheet");
        }

        const result = (await response.json()) as ApproveResponse;

        // Update cache with session ID
        updateAttachmentStatus(attachmentId, {
          sessionCreated: true,
          createdSessionId: result.sessionId,
          parsingStatus: "approved",
        });

        // Invalidate related queries
        queryClient.invalidateQueries({
          queryKey: sessionPlanKeys.list(playerId),
        });
        queryClient.invalidateQueries({
          queryKey: sessionHistoryKeys.list(playerId),
        });
        invalidateAttachments();

        return result;
      } catch (error) {
        // Revert optimistic update
        updateAttachmentStatus(attachmentId, {
          sessionCreated: false,
        });
        throw error;
      }
    },
    [playerId, queryClient, updateAttachmentStatus, invalidateAttachments],
  );

  const unapprove = useCallback(
    async (attachmentId: string) => {
      // Optimistic update
      const previous = updateAttachmentStatus(attachmentId, {
        sessionCreated: false,
        parsingStatus: "needs_review",
      });

      try {
        const response = await api(
          `curriculum/${playerId}/attachments/${attachmentId}/unapprove`,
          { method: "POST" },
        );
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error ?? "Failed to unapprove worksheet");
        }

        // Invalidate related queries
        queryClient.invalidateQueries({
          queryKey: sessionPlanKeys.list(playerId),
        });
        queryClient.invalidateQueries({
          queryKey: sessionHistoryKeys.list(playerId),
        });
        invalidateAttachments();
      } catch (error) {
        // Revert optimistic update
        if (previous) {
          queryClient.setQueryData(queryKey, previous);
        }
        throw error;
      }
    },
    [playerId, queryClient, queryKey, updateAttachmentStatus, invalidateAttachments],
  );

  // ============================================================================
  // Context Value
  // ============================================================================

  const value = useMemo<WorksheetParsingContextValue>(
    () => ({
      state,
      isParsingAttachment: (attachmentId: string) =>
        isParsingAttachment(state, attachmentId),
      isAnyParsingActive: () => isAnyParsingActive(state),
      getStreamingStatus: (attachmentId: string) =>
        getStreamingStatus(state, attachmentId),
      startParse,
      startReparse,
      cancel,
      reset,
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
      submitCorrection,
      approve,
      unapprove,
    ],
  );

  return (
    <WorksheetParsingContext.Provider value={value}>
      {children}
    </WorksheetParsingContext.Provider>
  );
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
  const context = useContext(WorksheetParsingContext);
  if (!context) {
    throw new Error(
      "useWorksheetParsingContext must be used within a WorksheetParsingProvider",
    );
  }
  return context;
}

/**
 * Optional hook that returns null if outside provider (instead of throwing)
 *
 * Useful for components that might be used both inside and outside the provider
 */
export function useWorksheetParsingContextOptional(): WorksheetParsingContextValue | null {
  return useContext(WorksheetParsingContext);
}
