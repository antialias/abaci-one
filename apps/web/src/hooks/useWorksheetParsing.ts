"use client";

/**
 * React Query hooks for worksheet parsing workflow
 *
 * Provides mutations for:
 * - Starting worksheet parsing (POST /parse)
 * - Streaming worksheet parsing with reasoning (POST /parse/stream)
 * - Submitting corrections (PATCH /review)
 * - Approving and creating session (POST /approve)
 *
 * Includes optimistic updates for immediate UI feedback.
 */

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ParsingStatus } from "@/db/schema/practice-attachments";
import { api } from "@/lib/queryClient";
import {
  attachmentKeys,
  sessionHistoryKeys,
  sessionPlanKeys,
} from "@/lib/queryKeys";
import type {
  computeParsingStats,
  WorksheetParsingResult,
  ReviewProgress,
  ParsedProblem,
  BoundingBox,
} from "@/lib/worksheet-parsing";
import {
  extractCompletedProblems,
  type CompletedProblem,
} from "./usePartialJsonParser";

// Re-export for use by components
export type { CompletedProblem };

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

// ============================================================================
// Streaming Parsing Hook
// ============================================================================

/** Streaming parsing state */
export interface StreamingParseState {
  /** Current status */
  status:
    | "idle"
    | "connecting"
    | "reasoning"
    | "generating"
    | "complete"
    | "error";
  /** Accumulated reasoning text (model's thinking process) */
  reasoningText: string;
  /** Accumulated output text (partial JSON) */
  outputText: string;
  /** Error message if failed */
  error: string | null;
  /** Progress stage message */
  progressMessage: string | null;
  /** Final result when complete */
  result: WorksheetParsingResult | null;
  /** Final stats when complete */
  stats: ParsingStats | null;
  /** Problems that have been fully streamed (for progressive highlighting) */
  completedProblems: CompletedProblem[];
}

const initialStreamingState: StreamingParseState = {
  status: "idle",
  reasoningText: "",
  outputText: "",
  error: null,
  progressMessage: null,
  result: null,
  stats: null,
  completedProblems: [],
};

/**
 * Hook to stream parse a worksheet with real-time reasoning updates
 *
 * Uses Server-Sent Events to receive:
 * - Reasoning summaries (model's thinking process)
 * - Output deltas (partial structured output)
 * - Progress events
 * - Final validated result
 *
 * @example
 * ```tsx
 * const { streamingState, startStreaming, cancelStreaming } = useStreamingParse(playerId, sessionId)
 *
 * // In component:
 * <button onClick={() => startStreaming({ attachmentId })}>Parse with AI</button>
 *
 * {streamingState.status === 'reasoning' && (
 *   <div className={css({ fontStyle: 'italic', color: 'gray.600' })}>
 *     <strong>Thinking:</strong> {streamingState.reasoningText}
 *   </div>
 * )}
 * ```
 */
export function useStreamingParse(playerId: string, sessionId: string) {
  const queryClient = useQueryClient();
  const queryKey = attachmentKeys.session(playerId, sessionId);
  const [streamingState, setStreamingState] = useState<StreamingParseState>(
    initialStreamingState,
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStreaming = useCallback(
    async (options: StartParsingOptions) => {
      const {
        attachmentId,
        modelConfigId,
        additionalContext,
        preservedBoundingBoxes,
      } = options;

      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Reset state
      setStreamingState({
        ...initialStreamingState,
        status: "connecting",
        progressMessage: "Connecting to AI...",
      });

      // Optimistic update in cache
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey);
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

      const controller = new AbortController();
      abortControllerRef.current = controller;

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
          throw new Error(error.error || "Failed to start streaming");
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedReasoning = "";
        let accumulatedOutput = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // Keep incomplete line

          let currentEvent: string | null = null;
          let currentData: string | null = null;

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              currentData = line.slice(6).trim();

              if (currentEvent && currentData) {
                try {
                  const data = JSON.parse(currentData);

                  switch (currentEvent) {
                    case "progress":
                      setStreamingState((prev) => ({
                        ...prev,
                        progressMessage: data.message,
                      }));
                      break;

                    case "started":
                      setStreamingState((prev) => ({
                        ...prev,
                        status: "reasoning",
                        progressMessage: "AI is analyzing the worksheet...",
                      }));
                      break;

                    case "reasoning":
                      if (data.isDelta) {
                        accumulatedReasoning += data.text;
                      } else {
                        // Complete summary for this index
                        accumulatedReasoning = data.text;
                      }
                      setStreamingState((prev) => ({
                        ...prev,
                        status: "reasoning",
                        reasoningText: accumulatedReasoning,
                        progressMessage: "AI is thinking...",
                      }));
                      break;

                    case "output_delta": {
                      accumulatedOutput += data.text;
                      // Extract completed problems for progressive highlighting
                      const completedProblems =
                        extractCompletedProblems(accumulatedOutput);
                      const problemCount = completedProblems.length;
                      setStreamingState((prev) => ({
                        ...prev,
                        status: "generating",
                        outputText: accumulatedOutput,
                        progressMessage:
                          problemCount > 0
                            ? `Extracting problems... ${problemCount} found`
                            : "Generating results...",
                        completedProblems,
                      }));
                      break;
                    }

                    case "complete": {
                      // Extract final problems from complete result
                      const finalProblems: CompletedProblem[] = data.result
                        ?.problems
                        ? data.result.problems.map(
                            (p: {
                              problemNumber: number;
                              problemBoundingBox: BoundingBox;
                            }) => ({
                              problemNumber: p.problemNumber,
                              problemBoundingBox: p.problemBoundingBox,
                            }),
                          )
                        : [];
                      setStreamingState({
                        status: "complete",
                        reasoningText: accumulatedReasoning,
                        outputText: accumulatedOutput,
                        error: null,
                        progressMessage: null,
                        result: data.result,
                        stats: data.stats,
                        completedProblems: finalProblems,
                      });

                      // Update cache
                      const current =
                        queryClient.getQueryData<AttachmentsCache>(queryKey);
                      if (current) {
                        queryClient.setQueryData<AttachmentsCache>(queryKey, {
                          ...current,
                          attachments: current.attachments.map((a) =>
                            a.id === attachmentId
                              ? {
                                  ...a,
                                  parsingStatus: data.status,
                                  rawParsingResult: data.result,
                                  confidenceScore:
                                    data.result?.overallConfidence ?? null,
                                  needsReview:
                                    data.result?.needsReview ?? false,
                                  parsedAt: new Date().toISOString(),
                                }
                              : a,
                          ),
                        });
                      }
                      break;
                    }

                    case "error":
                      setStreamingState({
                        status: "error",
                        reasoningText: accumulatedReasoning,
                        outputText: accumulatedOutput,
                        error: data.message,
                        progressMessage: null,
                        result: null,
                        stats: null,
                        completedProblems: [],
                      });
                      break;
                  }
                } catch {
                  // Ignore malformed JSON
                }
                currentEvent = null;
                currentData = null;
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setStreamingState((prev) => ({
            ...prev,
            status: "idle",
            progressMessage: "Cancelled",
          }));
        } else {
          setStreamingState({
            status: "error",
            reasoningText: "",
            outputText: "",
            error: err instanceof Error ? err.message : "Unknown error",
            progressMessage: null,
            result: null,
            stats: null,
            completedProblems: [],
          });
        }
      } finally {
        abortControllerRef.current = null;
        // Refetch to ensure consistency
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [playerId, queryClient, queryKey],
  );

  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setStreamingState(initialStreamingState);
  }, []);

  return {
    streamingState,
    startStreaming,
    cancelStreaming,
    resetState,
    isStreaming:
      streamingState.status === "connecting" ||
      streamingState.status === "reasoning" ||
      streamingState.status === "generating",
  };
}

// ============================================================================
// Streaming Re-parse Hook
// ============================================================================

/** Streaming re-parse state */
export interface StreamingReparseState {
  /** Current status */
  status:
    | "idle"
    | "connecting"
    | "processing"
    | "complete"
    | "error"
    | "cancelled";
  /** Current problem being processed (index in problemIndices array) */
  currentProblemIndex: number;
  /** Total problems to process */
  totalProblems: number;
  /** Current problem's worksheet index */
  currentProblemWorksheetIndex: number | null;
  /** Accumulated reasoning text for current problem */
  reasoningText: string;
  /** Error message if failed */
  error: string | null;
  /** Progress message */
  progressMessage: string | null;
  /** Completed problem indices */
  completedIndices: number[];
  /** Final result when complete */
  result: WorksheetParsingResult | null;
}

const initialReparseState: StreamingReparseState = {
  status: "idle",
  currentProblemIndex: 0,
  totalProblems: 0,
  currentProblemWorksheetIndex: null,
  reasoningText: "",
  error: null,
  progressMessage: null,
  completedIndices: [],
  result: null,
};

/**
 * Hook to stream re-parse selected problems with real-time reasoning updates
 *
 * Uses Server-Sent Events to receive:
 * - Problem start/complete events
 * - Reasoning summaries for each problem
 * - Output deltas
 * - Final merged result
 *
 * @example
 * ```tsx
 * const { reparseState, startReparse, cancelReparse } = useStreamingReparse(playerId, sessionId)
 *
 * // In component:
 * <button onClick={() => startReparse({
 *   attachmentId,
 *   problemIndices: [0, 3, 5],
 *   boundingBoxes: [box0, box3, box5]
 * })}>Re-parse Selected</button>
 *
 * {reparseState.status === 'processing' && (
 *   <div>
 *     Processing problem {reparseState.currentProblemIndex + 1} of {reparseState.totalProblems}
 *     <div>{reparseState.reasoningText}</div>
 *   </div>
 * )}
 * ```
 */
export function useStreamingReparse(playerId: string, sessionId: string) {
  const queryClient = useQueryClient();
  const queryKey = attachmentKeys.session(playerId, sessionId);
  const [reparseState, setReparseState] =
    useState<StreamingReparseState>(initialReparseState);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startReparse = useCallback(
    async (options: ReparseSelectedOptions) => {
      const {
        attachmentId,
        problemIndices,
        boundingBoxes,
        additionalContext,
        modelConfigId,
      } = options;

      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Reset state
      setReparseState({
        ...initialReparseState,
        status: "connecting",
        totalProblems: problemIndices.length,
        progressMessage: "Connecting to AI...",
      });

      // Optimistic update in cache
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey);
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

      const controller = new AbortController();
      abortControllerRef.current = controller;

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
          throw new Error(error.error || "Failed to start streaming re-parse");
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedReasoning = "";
        const completedIndices: number[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let currentEvent: string | null = null;
          let currentData: string | null = null;

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              currentData = line.slice(6).trim();

              if (currentEvent && currentData) {
                try {
                  const data = JSON.parse(currentData);

                  switch (currentEvent) {
                    case "problem_start":
                      accumulatedReasoning = "";
                      setReparseState((prev) => ({
                        ...prev,
                        status: "processing",
                        currentProblemIndex: data.currentIndex,
                        totalProblems: data.totalProblems,
                        currentProblemWorksheetIndex: data.problemIndex,
                        reasoningText: "",
                        progressMessage: `Analyzing problem ${data.currentIndex + 1} of ${data.totalProblems}...`,
                      }));
                      break;

                    case "reasoning":
                      if (data.isDelta) {
                        accumulatedReasoning += data.text;
                      } else {
                        accumulatedReasoning = data.text;
                      }
                      setReparseState((prev) => ({
                        ...prev,
                        reasoningText: accumulatedReasoning,
                      }));
                      break;

                    case "output_delta":
                      // Just update progress message, don't need to track output for re-parse
                      setReparseState((prev) => ({
                        ...prev,
                        progressMessage: `Extracting problem ${prev.currentProblemIndex + 1} of ${prev.totalProblems}...`,
                      }));
                      break;

                    case "problem_complete":
                      completedIndices.push(data.problemIndex);
                      setReparseState((prev) => ({
                        ...prev,
                        completedIndices: [...completedIndices],
                        progressMessage: `Completed problem ${data.currentIndex + 1} of ${data.totalProblems}`,
                      }));
                      break;

                    case "problem_error":
                      // Individual problem failed, but continue with others
                      setReparseState((prev) => ({
                        ...prev,
                        progressMessage: `Problem ${data.problemIndex} failed: ${data.message}`,
                      }));
                      break;

                    case "cancelled":
                      setReparseState({
                        ...initialReparseState,
                        status: "cancelled",
                        progressMessage: "Re-parsing was cancelled",
                      });
                      break;

                    case "complete": {
                      setReparseState({
                        status: "complete",
                        currentProblemIndex: problemIndices.length,
                        totalProblems: problemIndices.length,
                        currentProblemWorksheetIndex: null,
                        reasoningText: "",
                        error: null,
                        progressMessage: null,
                        completedIndices: data.reparsedIndices,
                        result: data.updatedResult,
                      });

                      // Update cache
                      const current =
                        queryClient.getQueryData<AttachmentsCache>(queryKey);
                      if (current) {
                        queryClient.setQueryData<AttachmentsCache>(queryKey, {
                          ...current,
                          attachments: current.attachments.map((a) =>
                            a.id === attachmentId
                              ? {
                                  ...a,
                                  parsingStatus: data.status,
                                  rawParsingResult: data.updatedResult,
                                  confidenceScore:
                                    data.updatedResult?.overallConfidence ??
                                    null,
                                  needsReview:
                                    data.updatedResult?.needsReview ?? false,
                                }
                              : a,
                          ),
                        });
                      }
                      break;
                    }

                    case "error":
                      setReparseState({
                        ...initialReparseState,
                        status: "error",
                        error: data.message,
                        completedIndices,
                      });
                      break;
                  }
                } catch {
                  // Ignore malformed JSON
                }
                currentEvent = null;
                currentData = null;
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setReparseState((prev) => ({
            ...prev,
            status: "cancelled",
            progressMessage: "Cancelled",
          }));
        } else {
          setReparseState({
            ...initialReparseState,
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      } finally {
        abortControllerRef.current = null;
        // Refetch to ensure consistency
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [playerId, queryClient, queryKey],
  );

  const cancelReparse = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setReparseState(initialReparseState);
  }, []);

  return {
    reparseState,
    startReparse,
    cancelReparse,
    resetState,
    isReparsing:
      reparseState.status === "connecting" ||
      reparseState.status === "processing",
  };
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

/** Response from unapprove API */
interface UnapproveResponse {
  success: boolean;
  message: string;
  problemsRemoved: number;
}

/**
 * Hook to unapprove/revert a processed worksheet back to review state
 */
export function useUnapproveWorksheet(playerId: string, sessionId: string) {
  const queryClient = useQueryClient();
  const queryKey = attachmentKeys.session(playerId, sessionId);

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await api(
        `curriculum/${playerId}/attachments/${attachmentId}/unapprove`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to unapprove worksheet");
      }
      return (await res.json()) as UnapproveResponse;
    },

    onMutate: async (attachmentId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot current state
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey);

      // Optimistic update: revert to needs_review
      if (previous) {
        queryClient.setQueryData<AttachmentsCache>(queryKey, {
          ...previous,
          attachments: previous.attachments.map((a) =>
            a.id === attachmentId
              ? {
                  ...a,
                  sessionCreated: false,
                  parsingStatus: "needs_review" as ParsingStatus,
                }
              : a,
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

    onSuccess: () => {
      // Invalidate session-related queries so changes appear
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
 * Hook to cancel/reset parsing status
 */
export function useCancelParsing(playerId: string, sessionId: string) {
  const queryClient = useQueryClient();
  const queryKey = attachmentKeys.session(playerId, sessionId);

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await api(
        `curriculum/${playerId}/attachments/${attachmentId}/parse`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to cancel parsing");
      }
      return res.json();
    },

    onMutate: async (attachmentId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot current state
      const previous = queryClient.getQueryData<AttachmentsCache>(queryKey);

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
              : a,
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

// ============================================================================
// Review Progress Hooks
// ============================================================================

/** Response from review progress API */
interface ReviewProgressResponse {
  reviewProgress: ReviewProgress;
  problems: ParsedProblem[];
  totalProblems: number;
}

/**
 * Hook to fetch review progress for an attachment
 */
export function useReviewProgress(
  playerId: string,
  attachmentId: string | null,
) {
  return useQuery({
    queryKey: attachmentId
      ? attachmentKeys.reviewProgress(playerId, attachmentId)
      : ["disabled"],
    queryFn: async () => {
      if (!attachmentId) throw new Error("No attachment ID");
      const res = await api(
        `curriculum/${playerId}/attachments/${attachmentId}/review-progress`,
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch review progress");
      }
      return res.json() as Promise<ReviewProgressResponse>;
    },
    enabled: !!attachmentId,
  });
}

/** Response from initialize review API */
interface InitializeReviewResponse {
  success: boolean;
  reviewProgress: ReviewProgress;
  problems: ParsedProblem[];
  message: string;
}

/**
 * Hook to initialize a review session (auto-approves high-confidence problems)
 */
export function useInitializeReview(playerId: string, sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await api(
        `curriculum/${playerId}/attachments/${attachmentId}/review-progress`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to initialize review");
      }
      return res.json() as Promise<InitializeReviewResponse>;
    },

    onSuccess: (_data, attachmentId) => {
      // Invalidate both review progress and session attachments
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.reviewProgress(playerId, attachmentId),
      });
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.session(playerId, sessionId),
      });
    },
  });
}

/** Options for updating review progress */
interface UpdateReviewProgressOptions {
  attachmentId: string;
  currentIndex?: number;
  status?: "not_started" | "in_progress" | "completed";
  problemUpdate?: {
    index: number;
    reviewStatus: "pending" | "approved" | "corrected" | "flagged";
  };
}

/**
 * Hook to update review progress (save position, mark problems reviewed)
 */
export function useUpdateReviewProgress(playerId: string, sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: UpdateReviewProgressOptions) => {
      const { attachmentId, ...body } = options;
      const res = await api(
        `curriculum/${playerId}/attachments/${attachmentId}/review-progress`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update review progress");
      }
      return res.json() as Promise<ReviewProgressResponse>;
    },

    onMutate: async (options) => {
      const { attachmentId } = options;
      const queryKey = attachmentKeys.reviewProgress(playerId, attachmentId);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot current state for rollback
      const previous =
        queryClient.getQueryData<ReviewProgressResponse>(queryKey);

      // Optimistic update
      if (previous && options.problemUpdate) {
        const { index, reviewStatus } = options.problemUpdate;
        queryClient.setQueryData<ReviewProgressResponse>(queryKey, {
          ...previous,
          problems: previous.problems.map((p, i) =>
            i === index
              ? { ...p, reviewStatus, reviewedAt: new Date().toISOString() }
              : p,
          ),
          reviewProgress: {
            ...previous.reviewProgress,
            status: "in_progress",
            lastReviewedAt: new Date().toISOString(),
          },
        });
      }

      return { previous, queryKey };
    },

    onError: (_err, _options, context) => {
      // Revert on error
      if (context?.previous && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },

    onSuccess: (_data, options) => {
      // Also invalidate session attachments to keep list in sync
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.session(playerId, sessionId),
      });
    },

    onSettled: (_data, _error, options) => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.reviewProgress(playerId, options.attachmentId),
      });
    },
  });
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
  isPending: boolean;
  variables?: unknown;
}): string | null {
  if (!mutation.isPending) return null;
  const vars = mutation.variables;
  if (typeof vars === "string") return vars;
  if (vars && typeof vars === "object" && "attachmentId" in vars) {
    return (vars as { attachmentId: string }).attachmentId;
  }
  return null;
}
