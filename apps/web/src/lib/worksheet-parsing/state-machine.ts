/**
 * Worksheet Parsing State Machine
 *
 * Provides a centralized state reducer for all worksheet parsing operations.
 * Supports multiple concurrent parsing operations (one per attachment).
 */

import type { BoundingBox, WorksheetParsingResult } from './schemas'

// ============================================================================
// Types
// ============================================================================

/** Stats returned from parsing */
export interface ParsingStats {
  totalProblems: number
  correctCount: number
  incorrectCount: number
  unansweredCount: number
  accuracy: number | null
  skillsDetected: string[]
}

/** Completed problem for progressive highlighting */
export interface CompletedProblem {
  problemNumber: number
  problemBoundingBox: BoundingBox
}

/** Stream type for distinguishing parse operations */
export type StreamType = 'initial' | 'reparse'

/** Streaming status */
export type StreamingStatus =
  | 'idle'
  | 'connecting'
  | 'reasoning'
  | 'processing' // Used during reparse
  | 'generating'
  | 'complete'
  | 'error'
  | 'cancelled'

/**
 * Streaming sub-state (active during parsing phase)
 *
 * Tracks real-time LLM output for display in the UI
 */
export interface StreamingState {
  /** Current streaming status */
  status: StreamingStatus
  /** Type of streaming operation */
  streamType: StreamType
  /** Accumulated reasoning text (model's thinking process) */
  reasoningText: string
  /** Accumulated output text (partial JSON) */
  outputText: string
  /** Progress message for display */
  progressMessage: string | null
  /** Problems that have been fully streamed (for progressive highlighting) */
  completedProblems: CompletedProblem[]
  /** For reparse: current problem index being processed */
  currentProblemIndex?: number
  /** For reparse: total problems to process */
  totalProblems?: number
  /** For reparse: completed problem indices */
  completedIndices?: number[]
}

/**
 * Full parsing context state
 *
 * Supports multiple concurrent parsing operations via Map
 */
export interface ParsingContextState {
  /** Map of attachment ID to streaming state (supports concurrent parses) */
  activeStreams: Map<string, StreamingState>
  /** Last successful results per attachment */
  lastResults: Map<string, WorksheetParsingResult>
  /** Last parsing stats per attachment */
  lastStats: Map<string, ParsingStats>
  /** Last error messages per attachment */
  lastErrors: Map<string, { message: string; code?: string }>
}

// ============================================================================
// Actions
// ============================================================================

export type ParsingAction =
  // Start/Stop operations (all require attachmentId for multi-stream support)
  | {
      type: 'START_STREAMING'
      attachmentId: string
      streamType: StreamType
      totalProblems?: number
    }
  | { type: 'CANCEL'; attachmentId: string }
  | { type: 'CANCEL_ALL' }
  | { type: 'RESET' }

  // Streaming updates (all require attachmentId)
  | { type: 'STREAM_CONNECTING'; attachmentId: string }
  | { type: 'STREAM_REASONING'; attachmentId: string; text: string; append?: boolean }
  | { type: 'STREAM_OUTPUT'; attachmentId: string; text: string }
  | {
      type: 'STREAM_PROBLEM_COMPLETE'
      attachmentId: string
      problem: CompletedProblem
      problemIndex?: number
    }
  | { type: 'STREAM_REPARSE_PROGRESS'; attachmentId: string; current: number; total: number }
  | { type: 'STREAM_PROGRESS_MESSAGE'; attachmentId: string; message: string }

  // Completion (all require attachmentId)
  | {
      type: 'PARSE_COMPLETE'
      attachmentId: string
      result: WorksheetParsingResult | null
      stats?: ParsingStats
    }
  | { type: 'PARSE_FAILED'; attachmentId: string; error: string; code?: string }

// ============================================================================
// Initial State
// ============================================================================

export const initialParsingState: ParsingContextState = {
  activeStreams: new Map(),
  lastResults: new Map(),
  lastStats: new Map(),
  lastErrors: new Map(),
}

// ============================================================================
// Helper to update a specific stream
// ============================================================================

function updateStream(
  streams: Map<string, StreamingState>,
  attachmentId: string,
  updater: (stream: StreamingState) => StreamingState
): Map<string, StreamingState> {
  const stream = streams.get(attachmentId)
  if (!stream) return streams

  const newStreams = new Map(streams)
  newStreams.set(attachmentId, updater(stream))
  return newStreams
}

// ============================================================================
// Reducer
// ============================================================================

export function parsingReducer(
  state: ParsingContextState,
  action: ParsingAction
): ParsingContextState {
  switch (action.type) {
    case 'START_STREAMING': {
      const newStreams = new Map(state.activeStreams)
      newStreams.set(action.attachmentId, {
        status: 'connecting',
        streamType: action.streamType,
        reasoningText: '',
        outputText: '',
        progressMessage: 'Connecting to AI...',
        completedProblems: [],
        currentProblemIndex: action.streamType === 'reparse' ? 0 : undefined,
        totalProblems: action.totalProblems,
        completedIndices: action.streamType === 'reparse' ? [] : undefined,
      })

      // Clear any previous error for this attachment
      const newErrors = new Map(state.lastErrors)
      newErrors.delete(action.attachmentId)

      return {
        ...state,
        activeStreams: newStreams,
        lastErrors: newErrors,
      }
    }

    case 'STREAM_CONNECTING':
      return {
        ...state,
        activeStreams: updateStream(state.activeStreams, action.attachmentId, (stream) => ({
          ...stream,
          status: 'connecting',
          progressMessage: 'Connecting to AI...',
        })),
      }

    case 'STREAM_REASONING':
      return {
        ...state,
        activeStreams: updateStream(state.activeStreams, action.attachmentId, (stream) => ({
          ...stream,
          // For initial parse: set status to "reasoning"
          // For reparse: keep current status (should be "processing" from problem_start)
          status: stream.streamType === 'initial' ? 'reasoning' : stream.status,
          reasoningText: action.append ? stream.reasoningText + action.text : action.text,
          progressMessage:
            stream.streamType === 'initial' ? 'AI is thinking...' : stream.progressMessage,
        })),
      }

    case 'STREAM_OUTPUT':
      return {
        ...state,
        activeStreams: updateStream(state.activeStreams, action.attachmentId, (stream) => ({
          ...stream,
          status: 'generating',
          outputText: stream.outputText + action.text,
          progressMessage:
            stream.completedProblems.length > 0
              ? `Extracting problems... ${stream.completedProblems.length} found`
              : 'Generating results...',
        })),
      }

    case 'STREAM_PROBLEM_COMPLETE':
      return {
        ...state,
        activeStreams: updateStream(state.activeStreams, action.attachmentId, (stream) => ({
          ...stream,
          completedProblems: [...stream.completedProblems, action.problem],
          completedIndices:
            action.problemIndex !== undefined && stream.completedIndices
              ? [...stream.completedIndices, action.problemIndex]
              : stream.completedIndices,
        })),
      }

    case 'STREAM_REPARSE_PROGRESS':
      return {
        ...state,
        activeStreams: updateStream(state.activeStreams, action.attachmentId, (stream) => ({
          ...stream,
          // Use "processing" for reparse to match expected UI state
          status: 'processing',
          currentProblemIndex: action.current,
          totalProblems: action.total,
          progressMessage: `Analyzing problem ${action.current + 1} of ${action.total}...`,
        })),
      }

    case 'STREAM_PROGRESS_MESSAGE':
      return {
        ...state,
        activeStreams: updateStream(state.activeStreams, action.attachmentId, (stream) => ({
          ...stream,
          progressMessage: action.message,
        })),
      }

    case 'PARSE_COMPLETE': {
      // Remove from active streams
      const newStreams = new Map(state.activeStreams)
      newStreams.delete(action.attachmentId)

      // Store result if provided
      const newResults = new Map(state.lastResults)
      if (action.result) {
        newResults.set(action.attachmentId, action.result)
      }

      // Store stats if provided
      const newStats = new Map(state.lastStats)
      if (action.stats) {
        newStats.set(action.attachmentId, action.stats)
      }

      return {
        ...state,
        activeStreams: newStreams,
        lastResults: newResults,
        lastStats: newStats,
      }
    }

    case 'PARSE_FAILED': {
      // Remove from active streams
      const newStreams = new Map(state.activeStreams)
      newStreams.delete(action.attachmentId)

      // Store error with optional code
      const newErrors = new Map(state.lastErrors)
      newErrors.set(action.attachmentId, { message: action.error, code: action.code })

      return {
        ...state,
        activeStreams: newStreams,
        lastErrors: newErrors,
      }
    }

    case 'CANCEL': {
      // Remove specific stream
      const newStreams = new Map(state.activeStreams)
      newStreams.delete(action.attachmentId)

      return {
        ...state,
        activeStreams: newStreams,
      }
    }

    case 'CANCEL_ALL': {
      return {
        ...state,
        activeStreams: new Map(),
      }
    }

    case 'RESET':
      return initialParsingState

    default:
      return state
  }
}

// ============================================================================
// Selectors (helper functions)
// ============================================================================

/**
 * Check if currently parsing a specific attachment
 */
export function isParsingAttachment(state: ParsingContextState, attachmentId: string): boolean {
  const stream = state.activeStreams.get(attachmentId)
  if (!stream) return false

  return stream.status !== 'complete' && stream.status !== 'error' && stream.status !== 'cancelled'
}

/**
 * Check if any parsing operation is in progress
 */
export function isAnyParsingActive(state: ParsingContextState): boolean {
  for (const stream of state.activeStreams.values()) {
    if (
      stream.status !== 'complete' &&
      stream.status !== 'error' &&
      stream.status !== 'cancelled'
    ) {
      return true
    }
  }
  return false
}

/**
 * Get the current streaming status for an attachment
 */
export function getStreamingStatus(
  state: ParsingContextState,
  attachmentId: string
): StreamingStatus | null {
  return state.activeStreams.get(attachmentId)?.status ?? null
}

/**
 * Get the streaming state for a specific attachment
 */
export function getStreamingState(
  state: ParsingContextState,
  attachmentId: string
): StreamingState | null {
  return state.activeStreams.get(attachmentId) ?? null
}

/**
 * Get the number of active parsing operations
 */
export function getActiveParsingCount(state: ParsingContextState): number {
  let count = 0
  for (const stream of state.activeStreams.values()) {
    if (
      stream.status !== 'complete' &&
      stream.status !== 'error' &&
      stream.status !== 'cancelled'
    ) {
      count++
    }
  }
  return count
}

// ============================================================================
// Legacy compatibility - single attachment getters
// ============================================================================

/**
 * @deprecated Use getStreamingState(state, attachmentId) instead
 * Get the "active" attachment ID (returns first active one for backwards compat)
 */
export function getActiveAttachmentId(state: ParsingContextState): string | null {
  for (const [attachmentId, stream] of state.activeStreams.entries()) {
    if (
      stream.status !== 'complete' &&
      stream.status !== 'error' &&
      stream.status !== 'cancelled'
    ) {
      return attachmentId
    }
  }
  return null
}

/**
 * @deprecated Use state.activeStreams.get(attachmentId) instead
 * Get "the" streaming state (returns first active one for backwards compat)
 */
export function getActiveStreaming(state: ParsingContextState): StreamingState | null {
  for (const stream of state.activeStreams.values()) {
    if (
      stream.status !== 'complete' &&
      stream.status !== 'error' &&
      stream.status !== 'cancelled'
    ) {
      return stream
    }
  }
  return null
}
