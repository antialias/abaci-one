'use client'

/**
 * Mock Worksheet Parsing Context Provider
 *
 * Provides a controllable mock of the WorksheetParsingContext for use in:
 * - Storybook stories (testing specific UI states)
 * - Unit tests (isolated component testing)
 *
 * @example
 * ```tsx
 * // In a Storybook story
 * <MockWorksheetParsingProvider
 *   state={{
 *     activeStreams: new Map([["photo-1", {
 *       status: "generating",
 *       streamType: "initial",
 *       reasoningText: "Analyzing worksheet...",
 *       // ...
 *     }]]),
 *   }}
 * >
 *   <OfflineWorkSection {...props} />
 * </MockWorksheetParsingProvider>
 * ```
 */

import { createContext, useContext, type ReactNode } from 'react'
import {
  initialParsingState,
  isParsingAttachment as isParsingAttachmentHelper,
  isAnyParsingActive as isAnyParsingActiveHelper,
  getStreamingStatus as getStreamingStatusHelper,
  type ParsingContextState,
  type StreamingState,
  type ParsingStats,
} from '@/lib/worksheet-parsing/state-machine'
import type { WorksheetParsingResult } from '@/lib/worksheet-parsing'
import type { WorksheetParsingContextValue, ApproveResponse } from './WorksheetParsingContext'

// ============================================================================
// Mock Provider
// ============================================================================

interface MockWorksheetParsingProviderProps {
  children: ReactNode
  /** Override the default initial state */
  state?: Partial<ParsingContextState>
  /** Mock implementations for actions (optional - defaults to no-ops) */
  actions?: Partial<{
    startParse: WorksheetParsingContextValue['startParse']
    startReparse: WorksheetParsingContextValue['startReparse']
    cancel: WorksheetParsingContextValue['cancel']
    cancelAll: WorksheetParsingContextValue['cancelAll']
    reconnectToTask: WorksheetParsingContextValue['reconnectToTask']
    submitCorrection: WorksheetParsingContextValue['submitCorrection']
    approve: WorksheetParsingContextValue['approve']
    unapprove: WorksheetParsingContextValue['unapprove']
  }>
}

// Re-use the same context from the real provider
const MockWorksheetParsingContext = createContext<WorksheetParsingContextValue | null>(null)

/**
 * Mock provider for testing and Storybook
 *
 * Allows explicit control over parsing state without real API calls.
 */
export function MockWorksheetParsingProvider({
  children,
  state: stateOverrides = {},
  actions = {},
}: MockWorksheetParsingProviderProps) {
  // Merge overrides with initial state (Maps need special handling)
  const state: ParsingContextState = {
    activeStreams: stateOverrides.activeStreams ?? new Map(),
    lastResults: stateOverrides.lastResults ?? new Map(),
    lastStats: stateOverrides.lastStats ?? new Map(),
    lastErrors: stateOverrides.lastErrors ?? new Map(),
  }

  // Create mock context value with no-op defaults for actions
  const value: WorksheetParsingContextValue = {
    state,

    // Derived helpers use actual logic with mock state
    isParsingAttachment: (attachmentId: string) => isParsingAttachmentHelper(state, attachmentId),
    isAnyParsingActive: () => isAnyParsingActiveHelper(state),
    getStreamingStatus: (attachmentId: string) => getStreamingStatusHelper(state, attachmentId),

    // Actions default to no-ops but can be overridden
    startParse: actions.startParse ?? (async () => {}),
    startReparse: actions.startReparse ?? (async () => {}),
    cancel: actions.cancel ?? (() => {}),
    cancelAll: actions.cancelAll ?? (() => {}),
    reconnectToTask: actions.reconnectToTask ?? (async () => false),
    submitCorrection: actions.submitCorrection ?? (async () => {}),
    approve:
      actions.approve ??
      (async (): Promise<ApproveResponse> => ({
        success: true,
        sessionId: 'mock-session-id',
        problemCount: 0,
        correctCount: 0,
        accuracy: null,
        skillsExercised: [],
        stats: {
          totalProblems: 0,
          correctCount: 0,
          incorrectCount: 0,
          unansweredCount: 0,
          accuracy: null,
          skillsDetected: [],
        },
      })),
    unapprove: actions.unapprove ?? (async () => {}),
  }

  return (
    <MockWorksheetParsingContext.Provider value={value}>
      {children}
    </MockWorksheetParsingContext.Provider>
  )
}

/**
 * Hook to access the mock context
 *
 * Can be used interchangeably with useWorksheetParsingContext in tests
 */
export function useMockWorksheetParsingContext(): WorksheetParsingContextValue {
  const context = useContext(MockWorksheetParsingContext)
  if (!context) {
    throw new Error(
      'useMockWorksheetParsingContext must be used within a MockWorksheetParsingProvider'
    )
  }
  return context
}

// ============================================================================
// Storybook Helpers
// ============================================================================

/**
 * Create a streaming state for an attachment
 */
function createStreamingState(overrides: Partial<StreamingState> = {}): StreamingState {
  return {
    status: 'generating',
    streamType: 'initial',
    reasoningText: '',
    outputText: '',
    progressMessage: null,
    completedProblems: [],
    ...overrides,
  }
}

/** Pre-configured states for common Storybook scenarios */
export const mockParsingStates = {
  /** Initial idle state - no parsing activity */
  idle: initialParsingState,

  /** Actively parsing a worksheet */
  parsing: (attachmentId: string): Partial<ParsingContextState> => ({
    activeStreams: new Map([
      [
        attachmentId,
        createStreamingState({
          status: 'generating',
          streamType: 'initial',
          reasoningText: 'I can see a worksheet with arithmetic problems...',
          outputText: '{"problems": [',
          progressMessage: 'Extracting problems... 5 found',
        }),
      ],
    ]),
  }),

  /** Parsing complete with results */
  complete: (attachmentId: string): Partial<ParsingContextState> => {
    const result: WorksheetParsingResult = {
      problems: [],
      pageMetadata: {
        lessonId: null,
        weekId: null,
        pageNumber: null,
        detectedFormat: 'vertical',
        totalRows: 0,
        problemsPerRow: 0,
      },
      overallConfidence: 0.95,
      needsReview: false,
      warnings: [],
    }

    const stats: ParsingStats = {
      totalProblems: 10,
      correctCount: 8,
      incorrectCount: 2,
      unansweredCount: 0,
      accuracy: 0.8,
      skillsDetected: ['add-1-digit'],
    }

    return {
      activeStreams: new Map(),
      lastResults: new Map([[attachmentId, result]]),
      lastStats: new Map([[attachmentId, stats]]),
      lastErrors: new Map(),
    }
  },

  /** Parsing failed with error */
  error: (attachmentId: string, errorMessage: string): Partial<ParsingContextState> => ({
    activeStreams: new Map(),
    lastResults: new Map(),
    lastStats: new Map(),
    lastErrors: new Map([[attachmentId, errorMessage]]),
  }),

  /** Re-parsing specific problems */
  reparsing: (
    attachmentId: string,
    currentIndex: number,
    total: number
  ): Partial<ParsingContextState> => ({
    activeStreams: new Map([
      [
        attachmentId,
        createStreamingState({
          status: 'processing',
          streamType: 'reparse',
          reasoningText: 'Re-analyzing this problem more carefully...',
          outputText: '',
          progressMessage: `Re-parsing problem ${currentIndex + 1} of ${total}`,
          currentProblemIndex: currentIndex,
          totalProblems: total,
          completedIndices: Array.from({ length: currentIndex }, (_, i) => i),
        }),
      ],
    ]),
  }),
}
