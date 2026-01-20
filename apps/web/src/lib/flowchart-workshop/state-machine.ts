/**
 * State Machine for Flowchart Workshop streaming lifecycle
 *
 * Manages the state transitions during flowchart generation and refinement,
 * tracking progress, reasoning, and results.
 *
 * @module flowchart-workshop/state-machine
 */

import type { FlowchartDefinition } from '../flowcharts/schema'
import type { FlowchartCompleteResult } from './sse-parser'

/**
 * Possible streaming statuses
 */
export type StreamingStatus =
  | 'idle' // No operation in progress
  | 'connecting' // Initial connection being established
  | 'reasoning' // LLM is thinking (reasoning being streamed)
  | 'generating' // Structured output being generated
  | 'validating' // Result is being validated
  | 'complete' // Operation completed successfully
  | 'error' // Operation failed
  | 'cancelled' // Operation was cancelled by user

/**
 * Type of streaming operation
 */
export type StreamType = 'generate' | 'refine'

/**
 * State for the streaming lifecycle
 */
export interface StreamingState {
  /** Current status of the streaming operation */
  status: StreamingStatus

  /** Type of operation (generate or refine) */
  streamType: StreamType | null

  /** Response ID from the LLM (for debugging/tracking) */
  responseId: string | null

  /** Accumulated reasoning text from the LLM */
  reasoningText: string

  /** Accumulated partial output text */
  outputText: string

  /** Current progress stage */
  progressStage: string | null

  /** Current progress message (user-facing) */
  progressMessage: string | null

  /** Final result when complete */
  result: FlowchartCompleteResult | null

  /** Error message if operation failed */
  error: string | null

  /** Error code if available */
  errorCode: string | null

  /** Token usage statistics */
  usage: {
    promptTokens: number
    completionTokens: number
    reasoningTokens?: number
  } | null
}

/**
 * Initial state
 */
export const initialStreamingState: StreamingState = {
  status: 'idle',
  streamType: null,
  responseId: null,
  reasoningText: '',
  outputText: '',
  progressStage: null,
  progressMessage: null,
  result: null,
  error: null,
  errorCode: null,
  usage: null,
}

/**
 * Actions that can be dispatched to the state machine
 */
export type StreamingAction =
  | { type: 'START_STREAMING'; streamType: StreamType }
  | { type: 'STREAM_STARTED'; responseId: string }
  | { type: 'STREAM_PROGRESS'; stage: string; message: string }
  | { type: 'STREAM_REASONING'; text: string; append: boolean }
  | { type: 'STREAM_OUTPUT'; text: string; append: boolean }
  | { type: 'STREAM_COMPLETE'; result: FlowchartCompleteResult }
  | { type: 'STREAM_ERROR'; message: string; code?: string }
  | { type: 'STREAM_CANCELLED' }
  | { type: 'RESET' }

/**
 * Reducer function for the streaming state machine
 */
export function streamingReducer(state: StreamingState, action: StreamingAction): StreamingState {
  switch (action.type) {
    case 'START_STREAMING':
      return {
        ...initialStreamingState,
        status: 'connecting',
        streamType: action.streamType,
        progressMessage:
          action.streamType === 'generate' ? 'Starting generation...' : 'Starting refinement...',
      }

    case 'STREAM_STARTED':
      return {
        ...state,
        status: 'reasoning',
        responseId: action.responseId,
        progressMessage: 'AI is thinking...',
      }

    case 'STREAM_PROGRESS': {
      // Map progress stages to status
      let newStatus = state.status
      if (action.stage === 'preparing') {
        newStatus = 'connecting'
      } else if (action.stage === 'validating') {
        newStatus = 'validating'
      }
      return {
        ...state,
        status: newStatus,
        progressStage: action.stage,
        progressMessage: action.message,
      }
    }

    case 'STREAM_REASONING':
      return {
        ...state,
        status: 'reasoning',
        reasoningText: action.append ? state.reasoningText + action.text : action.text,
        progressMessage: 'AI is thinking...',
      }

    case 'STREAM_OUTPUT':
      return {
        ...state,
        status: 'generating',
        outputText: action.append ? state.outputText + action.text : action.text,
        progressMessage: 'Generating flowchart...',
      }

    case 'STREAM_COMPLETE':
      return {
        ...state,
        status: 'complete',
        result: action.result,
        progressStage: 'complete',
        progressMessage:
          state.streamType === 'generate' ? 'Flowchart generated!' : 'Flowchart refined!',
        usage: 'usage' in action.result ? (action.result.usage ?? null) : null,
      }

    case 'STREAM_ERROR':
      return {
        ...state,
        status: 'error',
        error: action.message,
        errorCode: action.code ?? null,
        progressMessage: null,
      }

    case 'STREAM_CANCELLED':
      return {
        ...state,
        status: 'cancelled',
        progressMessage: 'Operation cancelled',
      }

    case 'RESET':
      return initialStreamingState

    default:
      return state
  }
}

/**
 * Helper to determine if an operation is in progress
 */
export function isStreaming(status: StreamingStatus): boolean {
  return (
    status === 'connecting' ||
    status === 'reasoning' ||
    status === 'generating' ||
    status === 'validating'
  )
}

/**
 * Helper to determine if the operation completed (successfully or not)
 */
export function isFinished(status: StreamingStatus): boolean {
  return status === 'complete' || status === 'error' || status === 'cancelled'
}

/**
 * Get a user-friendly status message
 */
export function getStatusMessage(state: StreamingState): string {
  if (state.progressMessage) {
    return state.progressMessage
  }

  switch (state.status) {
    case 'idle':
      return ''
    case 'connecting':
      return 'Connecting...'
    case 'reasoning':
      return 'AI is thinking...'
    case 'generating':
      return 'Generating flowchart...'
    case 'validating':
      return 'Validating result...'
    case 'complete':
      return 'Complete!'
    case 'error':
      return state.error || 'An error occurred'
    case 'cancelled':
      return 'Cancelled'
    default:
      return ''
  }
}
