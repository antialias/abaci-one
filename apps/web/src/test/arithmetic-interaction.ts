/**
 * For tests: the generic try lifecycle (`useTryLifecycle`) composed with
 * arithmetic's digit entry (`parts/arithmetic/browser/useDigitEntry`) in one
 * hook, the shape `useInteractionPhase.ts` had (practice-kinds K5a-1). That
 * file is gone (K5a-3b: the session shell holds the lifecycle and arithmetic's
 * item view, its child, the entry); the hook cases of `useTryLifecycle.test.ts`
 * and `useDigitEntry.test.ts` render this composition, unchanged.
 */

import { useCallback } from 'react'
import { useTryLifecycle, useTryPhaseState } from '@/components/practice/session/useTryLifecycle'
import type { GeneratedProblem } from '@/db/schema/session-plans'
import {
  type ActiveProblem,
  type AttemptInput,
  arithmeticTryItems,
  type DigitEntryPhase,
  type HelpContext,
  type InitialProblemData,
  type InteractionPhase,
  type OutgoingAttempt,
  type PrefixMatchResult,
  useDigitEntry,
} from '@/lib/curriculum/parts/arithmetic/browser/useDigitEntry'

// =============================================================================
// Hook
// =============================================================================

export interface UseInteractionPhaseOptions {
  /** Initial problem to hydrate with (for SSR) */
  initialProblem?: InitialProblemData
  /**
   * Active problem context - derived from redoState + session plan.
   * When the key changes, the hook automatically loads the new problem.
   * This is the single source of truth for which problem is being worked on.
   */
  activeProblem?: ActiveProblem | null
  /** Called when auto-submit threshold is exceeded */
  onManualSubmitRequired?: () => void
  /**
   * When true (LINEAR parts), the abacus is put away entirely: never reject a
   * digit, never enter awaitingDisambiguation, and never enter help mode. The
   * student just types the final answer to the number sentence.
   */
  disableAbacusScaffolding?: boolean
}

export interface UseInteractionPhaseReturn {
  // Current phase
  phase: InteractionPhase

  // Extracted state from phase (single source of truth)
  /** Current attempt being worked on (null in loading/complete phases) */
  attempt: AttemptInput | null
  /** Help context when in helpMode (null otherwise) */
  helpContext: HelpContext | null
  /** Outgoing attempt during transition animation (null otherwise) */
  outgoingAttempt: OutgoingAttempt | null

  // Derived predicates for UI
  /** Can we accept keyboard/keypad input? */
  canAcceptInput: boolean
  /** Should the problem display show as completed? */
  showAsCompleted: boolean
  /** Should the help overlay be shown? */
  showHelpOverlay: boolean
  /** Should the input area (keypad/submit) be shown? */
  showInputArea: boolean
  /** Should the feedback message be shown? */
  showFeedback: boolean
  /** Is the input box focused? */
  inputIsFocused: boolean
  /** Are we currently in the transitioning phase? */
  isTransitioning: boolean
  /** Are we currently paused? */
  isPaused: boolean
  /** Are we currently submitting? */
  isSubmitting: boolean

  // Computed values (only valid when attempt exists)
  /** Prefix sums for current problem */
  prefixSums: number[]
  /** Full prefix match result with ambiguity info */
  prefixMatch: PrefixMatchResult
  /** Matched prefix index (-1 if none) - shorthand for prefixMatch.matchedIndex */
  matchedPrefixIndex: number
  /** Can the submit button be pressed? */
  canSubmit: boolean
  /** Should auto-submit trigger? */
  shouldAutoSubmit: boolean

  // Ambiguous prefix state
  /** Term index to show "need help?" prompt for (-1 if not in awaitingDisambiguation phase) */
  ambiguousHelpTermIndex: number

  // Actions
  /** Load a new problem (loading → inputting) */
  loadProblem: (problem: GeneratedProblem, slotIndex: number, partIndex: number) => void
  /** Handle digit input */
  handleDigit: (digit: string) => void
  /** Handle backspace */
  handleBackspace: () => void
  /** Enter help mode (inputting → helpMode) */
  enterHelpMode: (termIndex: number) => void
  /** Exit help mode (helpMode → inputting) */
  exitHelpMode: () => void
  /** Clear the current answer (used after help overlay transition completes) */
  clearAnswer: () => void
  /** Set the answer to a specific value (used when showing target reached value) */
  setAnswer: (value: string) => void
  /** Submit answer (inputting/helpMode → submitting) */
  startSubmit: () => void
  /** Handle submit result (submitting → showingFeedback) */
  completeSubmit: (result: 'correct' | 'incorrect') => void
  /** Start transition to next problem (showingFeedback → transitioning) */
  startTransition: (
    nextProblem: GeneratedProblem,
    nextSlotIndex: number,
    nextPartIndex?: number,
    nextEpochNumber?: number
  ) => void
  /** Complete transition (transitioning → inputting) */
  completeTransition: () => void
  /** Clear to loading state */
  clearToLoading: () => void
  /** Mark session as complete */
  markComplete: () => void
  /** Pause session (* → paused) */
  pause: () => void
  /** Resume session (paused → resumePhase) */
  resume: () => void
  /** Is the session complete? */
  isComplete: boolean
}

export function useInteractionPhase(
  options: UseInteractionPhaseOptions = {}
): UseInteractionPhaseReturn {
  const { initialProblem, activeProblem, onManualSubmitRequired, disableAbacusScaffolding } =
    options

  // One phase state, driven by both hooks. Initialized with the problem if
  // provided (for SSR hydration).
  const state = useTryPhaseState<
    InitialProblemData,
    AttemptInput,
    OutgoingAttempt,
    DigitEntryPhase
  >(initialProblem, arithmeticTryItems)

  // The entry first: its effect (the disambiguation timer) runs before the
  // lifecycle's (the active problem, the visibility layer), in the order
  // they ran as one hook.
  const entry = useDigitEntry(state, { onManualSubmitRequired, disableAbacusScaffolding })
  const lifecycle = useTryLifecycle(state, { activeItem: activeProblem, kind: arithmeticTryItems })

  const { load, startTransition: startLifecycleTransition } = lifecycle

  const loadProblem = useCallback(
    (problem: GeneratedProblem, slotIndex: number, partIndex: number) => {
      load({ problem, slotIndex, partIndex })
    },
    [load]
  )

  const startTransition = useCallback(
    (
      nextProblem: GeneratedProblem,
      nextSlotIndex: number,
      nextPartIndex?: number,
      nextEpochNumber?: number
    ) => {
      startLifecycleTransition((current) => ({
        problem: nextProblem,
        slotIndex: nextSlotIndex,
        partIndex: nextPartIndex ?? current.partIndex,
        epochNumber: nextEpochNumber,
      }))
    },
    [startLifecycleTransition]
  )

  return {
    phase: lifecycle.phase,
    attempt: lifecycle.attempt,
    helpContext: entry.helpContext,
    outgoingAttempt: lifecycle.outgoingAttempt,
    canAcceptInput: lifecycle.canAcceptInput,
    showAsCompleted: lifecycle.showAsCompleted,
    showHelpOverlay: entry.showHelpOverlay,
    showInputArea: lifecycle.showInputArea,
    showFeedback: lifecycle.showFeedback,
    inputIsFocused: lifecycle.inputIsFocused,
    isTransitioning: lifecycle.isTransitioning,
    isPaused: lifecycle.isPaused,
    isSubmitting: lifecycle.isSubmitting,
    prefixSums: entry.prefixSums,
    prefixMatch: entry.prefixMatch,
    matchedPrefixIndex: entry.matchedPrefixIndex,
    canSubmit: entry.canSubmit,
    shouldAutoSubmit: entry.shouldAutoSubmit,
    ambiguousHelpTermIndex: entry.ambiguousHelpTermIndex,
    loadProblem,
    handleDigit: entry.handleDigit,
    handleBackspace: entry.handleBackspace,
    enterHelpMode: entry.enterHelpMode,
    exitHelpMode: entry.exitHelpMode,
    clearAnswer: entry.clearAnswer,
    setAnswer: entry.setAnswer,
    startSubmit: lifecycle.startSubmit,
    completeSubmit: lifecycle.completeSubmit,
    startTransition,
    completeTransition: lifecycle.completeTransition,
    clearToLoading: lifecycle.clearToLoading,
    markComplete: lifecycle.markComplete,
    pause: lifecycle.pause,
    resume: lifecycle.resume,
    isComplete: lifecycle.isComplete,
  }
}
