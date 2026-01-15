/**
 * Worksheet Parsing State Machine
 *
 * Provides a centralized state reducer for all worksheet parsing operations.
 * Replaces scattered state across multiple hooks with a single source of truth.
 */

import type { BoundingBox, WorksheetParsingResult } from "./schemas";

// ============================================================================
// Types
// ============================================================================

/** Stats returned from parsing */
export interface ParsingStats {
  totalProblems: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  accuracy: number | null;
  skillsDetected: string[];
}

/** Completed problem for progressive highlighting */
export interface CompletedProblem {
  problemNumber: number;
  problemBoundingBox: BoundingBox;
}

/** Stream type for distinguishing parse operations */
export type StreamType = "initial" | "reparse";

/** Streaming status */
export type StreamingStatus =
  | "idle"
  | "connecting"
  | "reasoning"
  | "processing" // Used during reparse
  | "generating"
  | "complete"
  | "error"
  | "cancelled";

/**
 * Streaming sub-state (active during parsing phase)
 *
 * Tracks real-time LLM output for display in the UI
 */
export interface StreamingState {
  /** Current streaming status */
  status: StreamingStatus;
  /** Type of streaming operation */
  streamType: StreamType;
  /** Accumulated reasoning text (model's thinking process) */
  reasoningText: string;
  /** Accumulated output text (partial JSON) */
  outputText: string;
  /** Progress message for display */
  progressMessage: string | null;
  /** Problems that have been fully streamed (for progressive highlighting) */
  completedProblems: CompletedProblem[];
  /** For reparse: current problem index being processed */
  currentProblemIndex?: number;
  /** For reparse: total problems to process */
  totalProblems?: number;
  /** For reparse: completed problem indices */
  completedIndices?: number[];
}

/**
 * Full parsing context state
 *
 * Combines attachment tracking with streaming state
 */
export interface ParsingContextState {
  /** ID of the attachment currently being operated on (null if idle) */
  activeAttachmentId: string | null;
  /** Current streaming state (null if not streaming) */
  streaming: StreamingState | null;
  /** Last successful result (persists after streaming completes) */
  lastResult: WorksheetParsingResult | null;
  /** Last parsing stats */
  lastStats: ParsingStats | null;
  /** Last error message */
  lastError: string | null;
}

// ============================================================================
// Actions
// ============================================================================

export type ParsingAction =
  // Start/Stop operations
  | {
      type: "START_STREAMING";
      attachmentId: string;
      streamType: StreamType;
      totalProblems?: number;
    }
  | { type: "CANCEL" }
  | { type: "RESET" }

  // Streaming updates
  | { type: "STREAM_CONNECTING" }
  | { type: "STREAM_REASONING"; text: string; append?: boolean }
  | { type: "STREAM_OUTPUT"; text: string }
  | {
      type: "STREAM_PROBLEM_COMPLETE";
      problem: CompletedProblem;
      problemIndex?: number;
    }
  | { type: "STREAM_REPARSE_PROGRESS"; current: number; total: number }
  | { type: "STREAM_PROGRESS_MESSAGE"; message: string }

  // Completion
  | {
      type: "PARSE_COMPLETE";
      result: WorksheetParsingResult;
      stats?: ParsingStats;
    }
  | { type: "PARSE_FAILED"; error: string };

// ============================================================================
// Initial State
// ============================================================================

export const initialParsingState: ParsingContextState = {
  activeAttachmentId: null,
  streaming: null,
  lastResult: null,
  lastStats: null,
  lastError: null,
};

// ============================================================================
// Reducer
// ============================================================================

export function parsingReducer(
  state: ParsingContextState,
  action: ParsingAction,
): ParsingContextState {
  switch (action.type) {
    case "START_STREAMING":
      return {
        ...state,
        activeAttachmentId: action.attachmentId,
        streaming: {
          status: "connecting",
          streamType: action.streamType,
          reasoningText: "",
          outputText: "",
          progressMessage: "Connecting to AI...",
          completedProblems: [],
          currentProblemIndex: action.streamType === "reparse" ? 0 : undefined,
          totalProblems: action.totalProblems,
          completedIndices: action.streamType === "reparse" ? [] : undefined,
        },
        lastError: null,
      };

    case "STREAM_CONNECTING":
      if (!state.streaming) return state;
      return {
        ...state,
        streaming: {
          ...state.streaming,
          status: "connecting",
          progressMessage: "Connecting to AI...",
        },
      };

    case "STREAM_REASONING":
      if (!state.streaming) return state;
      return {
        ...state,
        streaming: {
          ...state.streaming,
          // For initial parse: set status to "reasoning"
          // For reparse: keep current status (should be "processing" from problem_start)
          status:
            state.streaming.streamType === "initial"
              ? "reasoning"
              : state.streaming.status,
          reasoningText: action.append
            ? state.streaming.reasoningText + action.text
            : action.text,
          progressMessage:
            state.streaming.streamType === "initial"
              ? "AI is thinking..."
              : state.streaming.progressMessage,
        },
      };

    case "STREAM_OUTPUT":
      if (!state.streaming) return state;
      return {
        ...state,
        streaming: {
          ...state.streaming,
          status: "generating",
          outputText: state.streaming.outputText + action.text,
          progressMessage:
            state.streaming.completedProblems.length > 0
              ? `Extracting problems... ${state.streaming.completedProblems.length} found`
              : "Generating results...",
        },
      };

    case "STREAM_PROBLEM_COMPLETE":
      if (!state.streaming) return state;
      return {
        ...state,
        streaming: {
          ...state.streaming,
          completedProblems: [
            ...state.streaming.completedProblems,
            action.problem,
          ],
          completedIndices:
            action.problemIndex !== undefined &&
            state.streaming.completedIndices
              ? [...state.streaming.completedIndices, action.problemIndex]
              : state.streaming.completedIndices,
        },
      };

    case "STREAM_REPARSE_PROGRESS":
      if (!state.streaming) return state;
      return {
        ...state,
        streaming: {
          ...state.streaming,
          // Use "processing" for reparse to match expected UI state
          status: "processing",
          currentProblemIndex: action.current,
          totalProblems: action.total,
          progressMessage: `Analyzing problem ${action.current + 1} of ${action.total}...`,
        },
      };

    case "STREAM_PROGRESS_MESSAGE":
      if (!state.streaming) return state;
      return {
        ...state,
        streaming: {
          ...state.streaming,
          progressMessage: action.message,
        },
      };

    case "PARSE_COMPLETE":
      return {
        ...state,
        activeAttachmentId: null,
        streaming: state.streaming
          ? {
              ...state.streaming,
              status: "complete",
              progressMessage: null,
            }
          : null,
        lastResult: action.result,
        lastStats: action.stats ?? null,
      };

    case "PARSE_FAILED":
      return {
        ...state,
        activeAttachmentId: null,
        streaming: state.streaming
          ? {
              ...state.streaming,
              status: "error",
              progressMessage: null,
            }
          : null,
        lastError: action.error,
      };

    case "CANCEL":
      return {
        ...state,
        activeAttachmentId: null,
        streaming: state.streaming
          ? {
              ...state.streaming,
              status: "cancelled",
              progressMessage: "Cancelled",
            }
          : null,
      };

    case "RESET":
      return initialParsingState;

    default:
      return state;
  }
}

// ============================================================================
// Selectors (helper functions)
// ============================================================================

/**
 * Check if currently parsing a specific attachment
 */
export function isParsingAttachment(
  state: ParsingContextState,
  attachmentId: string,
): boolean {
  return (
    state.activeAttachmentId === attachmentId &&
    state.streaming !== null &&
    state.streaming.status !== "complete" &&
    state.streaming.status !== "error" &&
    state.streaming.status !== "cancelled"
  );
}

/**
 * Check if any parsing operation is in progress
 */
export function isAnyParsingActive(state: ParsingContextState): boolean {
  return (
    state.streaming !== null &&
    state.streaming.status !== "complete" &&
    state.streaming.status !== "error" &&
    state.streaming.status !== "cancelled"
  );
}

/**
 * Get the current streaming status for an attachment
 */
export function getStreamingStatus(
  state: ParsingContextState,
  attachmentId: string,
): StreamingStatus | null {
  if (state.activeAttachmentId !== attachmentId) return null;
  return state.streaming?.status ?? null;
}
