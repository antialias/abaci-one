'use client'

import { useCallback, useMemo, useState } from 'react'
import type { GeneratedProblem } from '@/db/schema/session-plans'

// =============================================================================
// Types
// =============================================================================

/**
 * Input-level state for a problem attempt.
 * This is what the student is actively working on - their answer input.
 */
export interface AttemptInput {
  /** The problem being solved */
  problem: GeneratedProblem
  /** Index in the current part */
  slotIndex: number
  /** Part index in the session */
  partIndex: number
  /** When the attempt started */
  startTime: number
  /** User's current answer input */
  userAnswer: string
  /** Number of times user used backspace or had digits rejected */
  correctionCount: number
  /** Whether manual submit is required (exceeded auto-submit threshold) */
  manualSubmitRequired: boolean
  /** Rejected digit to show as red X (null = no rejection) */
  rejectedDigit: string | null
}

/**
 * Context for help mode - computed when entering help
 */
export interface HelpContext {
  /** Index of the term being helped with */
  termIndex: number
  /** Current running total before this term */
  currentValue: number
  /** Target value after adding this term */
  targetValue: number
  /** The term being added */
  term: number
}

/**
 * Snapshot of an attempt that's animating out during transition
 */
export interface OutgoingAttempt {
  key: string
  problem: GeneratedProblem
  userAnswer: string
  result: 'correct' | 'incorrect'
}

/**
 * Discriminated union representing all possible interaction phases.
 * Each phase carries exactly the data needed for that phase.
 */
export type InteractionPhase =
  // No problem loaded yet, waiting for initialization
  | { phase: 'loading' }

  // Student is actively entering digits for their answer
  | {
      phase: 'inputting'
      attempt: AttemptInput
    }

  // Student triggered help mode by entering a prefix sum
  | {
      phase: 'helpMode'
      attempt: AttemptInput
      helpContext: HelpContext
    }

  // Answer submitted, waiting for server response
  | {
      phase: 'submitting'
      attempt: AttemptInput
    }

  // Showing feedback (correct/incorrect) after submission
  | {
      phase: 'showingFeedback'
      attempt: AttemptInput
      result: 'correct' | 'incorrect'
    }

  // Animating transition to next problem
  | {
      phase: 'transitioning'
      outgoing: OutgoingAttempt
      incoming: AttemptInput
    }

  // Session paused - remembers what phase to return to
  | {
      phase: 'paused'
      resumePhase: Exclude<InteractionPhase, { phase: 'paused' }>
    }

/** Threshold for correction count before requiring manual submit */
export const MANUAL_SUBMIT_THRESHOLD = 2

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Creates a fresh attempt input for a new problem
 */
export function createAttemptInput(
  problem: GeneratedProblem,
  slotIndex: number,
  partIndex: number
): AttemptInput {
  return {
    problem,
    slotIndex,
    partIndex,
    startTime: Date.now(),
    userAnswer: '',
    correctionCount: 0,
    manualSubmitRequired: false,
    rejectedDigit: null,
  }
}

/**
 * Computes prefix sums for a problem's terms.
 * prefixSums[i] = sum of terms[0..i] (inclusive)
 */
export function computePrefixSums(terms: number[]): number[] {
  const sums: number[] = []
  let total = 0
  for (const term of terms) {
    total += term
    sums.push(total)
  }
  return sums
}

/**
 * Checks if a digit would be consistent with any prefix sum.
 */
export function isDigitConsistent(
  currentAnswer: string,
  digit: string,
  prefixSums: number[]
): boolean {
  const newAnswer = currentAnswer + digit
  const newAnswerNum = parseInt(newAnswer, 10)
  if (Number.isNaN(newAnswerNum)) return false

  for (const sum of prefixSums) {
    const sumStr = sum.toString()
    if (sumStr.startsWith(newAnswer)) {
      return true
    }
  }
  return false
}

/**
 * Finds which prefix sum the user's answer matches, if any.
 * Returns -1 if no match.
 */
export function findMatchedPrefixIndex(userAnswer: string, prefixSums: number[]): number {
  const answerNum = parseInt(userAnswer, 10)
  if (Number.isNaN(answerNum)) return -1
  return prefixSums.indexOf(answerNum)
}

/**
 * Computes help context for a given term index
 */
export function computeHelpContext(terms: number[], termIndex: number): HelpContext {
  const sums = computePrefixSums(terms)
  const currentValue = termIndex === 0 ? 0 : sums[termIndex - 1]
  const targetValue = sums[termIndex]
  const term = terms[termIndex]
  return { termIndex, currentValue, targetValue, term }
}

// =============================================================================
// Hook
// =============================================================================

export interface UseInteractionPhaseOptions {
  /** Called when auto-submit threshold is exceeded */
  onManualSubmitRequired?: () => void
}

export interface UseInteractionPhaseReturn {
  // Current phase
  phase: InteractionPhase

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

  // Computed values (only valid when attempt exists)
  /** Prefix sums for current problem */
  prefixSums: number[]
  /** Matched prefix index (-1 if none) */
  matchedPrefixIndex: number
  /** Can the submit button be pressed? */
  canSubmit: boolean
  /** Should auto-submit trigger? */
  shouldAutoSubmit: boolean

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
  /** Submit answer (inputting/helpMode → submitting) */
  startSubmit: () => void
  /** Handle submit result (submitting → showingFeedback) */
  completeSubmit: (result: 'correct' | 'incorrect') => void
  /** Start transition to next problem (showingFeedback → transitioning) */
  startTransition: (nextProblem: GeneratedProblem, nextSlotIndex: number) => void
  /** Complete transition (transitioning → inputting) */
  completeTransition: () => void
  /** Clear to loading state */
  clearToLoading: () => void
  /** Pause session (* → paused) */
  pause: () => void
  /** Resume session (paused → resumePhase) */
  resume: () => void
}

export function useInteractionPhase(
  options: UseInteractionPhaseOptions = {}
): UseInteractionPhaseReturn {
  const { onManualSubmitRequired } = options
  const [phase, setPhase] = useState<InteractionPhase>({ phase: 'loading' })

  // ==========================================================================
  // Derived State
  // ==========================================================================

  // Extract attempt from phase if available
  const attempt = useMemo((): AttemptInput | null => {
    switch (phase.phase) {
      case 'inputting':
      case 'helpMode':
      case 'submitting':
      case 'showingFeedback':
        return phase.attempt
      case 'transitioning':
        return phase.incoming
      case 'paused': {
        // Recurse into resumePhase
        const inner = phase.resumePhase
        if (
          inner.phase === 'inputting' ||
          inner.phase === 'helpMode' ||
          inner.phase === 'submitting' ||
          inner.phase === 'showingFeedback'
        ) {
          return inner.attempt
        }
        if (inner.phase === 'transitioning') {
          return inner.incoming
        }
        return null
      }
      default:
        return null
    }
  }, [phase])

  const prefixSums = useMemo(() => {
    if (!attempt) return []
    return computePrefixSums(attempt.problem.terms)
  }, [attempt])

  const matchedPrefixIndex = useMemo(() => {
    if (!attempt) return -1
    return findMatchedPrefixIndex(attempt.userAnswer, prefixSums)
  }, [attempt, prefixSums])

  const canSubmit = useMemo(() => {
    if (!attempt || !attempt.userAnswer) return false
    const answerNum = parseInt(attempt.userAnswer, 10)
    return !Number.isNaN(answerNum)
  }, [attempt])

  const shouldAutoSubmit = useMemo(() => {
    if (phase.phase !== 'inputting' && phase.phase !== 'helpMode') return false
    if (!attempt || !attempt.userAnswer) return false
    if (attempt.correctionCount > MANUAL_SUBMIT_THRESHOLD) return false

    const answerNum = parseInt(attempt.userAnswer, 10)
    if (Number.isNaN(answerNum)) return false

    return answerNum === attempt.problem.answer
  }, [phase.phase, attempt])

  // UI predicates
  const canAcceptInput = phase.phase === 'inputting' || phase.phase === 'helpMode'

  const showAsCompleted = phase.phase === 'showingFeedback'

  const showHelpOverlay = phase.phase === 'helpMode'

  const showInputArea =
    phase.phase === 'inputting' || phase.phase === 'helpMode' || phase.phase === 'submitting'

  const showFeedback = phase.phase === 'showingFeedback' && phase.result === 'incorrect'

  const inputIsFocused = phase.phase === 'inputting' || phase.phase === 'helpMode'

  // ==========================================================================
  // Actions
  // ==========================================================================

  const loadProblem = useCallback(
    (problem: GeneratedProblem, slotIndex: number, partIndex: number) => {
      const newAttempt = createAttemptInput(problem, slotIndex, partIndex)
      setPhase({ phase: 'inputting', attempt: newAttempt })
    },
    []
  )

  const handleDigit = useCallback(
    (digit: string) => {
      setPhase((prev) => {
        if (prev.phase !== 'inputting' && prev.phase !== 'helpMode') return prev

        const attempt = prev.attempt
        const sums = computePrefixSums(attempt.problem.terms)

        if (isDigitConsistent(attempt.userAnswer, digit, sums)) {
          const updatedAttempt = {
            ...attempt,
            userAnswer: attempt.userAnswer + digit,
            rejectedDigit: null,
          }
          return { ...prev, attempt: updatedAttempt }
        } else {
          // Reject the digit
          const newCorrectionCount = attempt.correctionCount + 1
          const nowRequiresManualSubmit =
            newCorrectionCount > MANUAL_SUBMIT_THRESHOLD && !attempt.manualSubmitRequired

          if (nowRequiresManualSubmit) {
            setTimeout(() => onManualSubmitRequired?.(), 0)
          }

          const updatedAttempt = {
            ...attempt,
            rejectedDigit: digit,
            correctionCount: newCorrectionCount,
            manualSubmitRequired: attempt.manualSubmitRequired || nowRequiresManualSubmit,
          }
          return { ...prev, attempt: updatedAttempt }
        }
      })

      // Clear rejected digit after animation
      setTimeout(() => {
        setPhase((prev) => {
          if (prev.phase !== 'inputting' && prev.phase !== 'helpMode') return prev
          return { ...prev, attempt: { ...prev.attempt, rejectedDigit: null } }
        })
      }, 300)
    },
    [onManualSubmitRequired]
  )

  const handleBackspace = useCallback(() => {
    setPhase((prev) => {
      if (prev.phase !== 'inputting' && prev.phase !== 'helpMode') return prev

      const attempt = prev.attempt
      if (attempt.userAnswer.length === 0) return prev

      const newCorrectionCount = attempt.correctionCount + 1
      const nowRequiresManualSubmit =
        newCorrectionCount > MANUAL_SUBMIT_THRESHOLD && !attempt.manualSubmitRequired

      if (nowRequiresManualSubmit) {
        setTimeout(() => onManualSubmitRequired?.(), 0)
      }

      const updatedAttempt = {
        ...attempt,
        userAnswer: attempt.userAnswer.slice(0, -1),
        correctionCount: newCorrectionCount,
        manualSubmitRequired: attempt.manualSubmitRequired || nowRequiresManualSubmit,
      }
      return { ...prev, attempt: updatedAttempt }
    })
  }, [onManualSubmitRequired])

  const enterHelpMode = useCallback((termIndex: number) => {
    setPhase((prev) => {
      if (prev.phase !== 'inputting') return prev

      const helpContext = computeHelpContext(prev.attempt.problem.terms, termIndex)
      const updatedAttempt = { ...prev.attempt, userAnswer: '' }
      return { phase: 'helpMode', attempt: updatedAttempt, helpContext }
    })
  }, [])

  const exitHelpMode = useCallback(() => {
    setPhase((prev) => {
      if (prev.phase !== 'helpMode') return prev
      const updatedAttempt = { ...prev.attempt, userAnswer: '' }
      return { phase: 'inputting', attempt: updatedAttempt }
    })
  }, [])

  const startSubmit = useCallback(() => {
    setPhase((prev) => {
      if (prev.phase !== 'inputting' && prev.phase !== 'helpMode') return prev
      return { phase: 'submitting', attempt: prev.attempt }
    })
  }, [])

  const completeSubmit = useCallback((result: 'correct' | 'incorrect') => {
    setPhase((prev) => {
      if (prev.phase !== 'submitting') return prev
      return { phase: 'showingFeedback', attempt: prev.attempt, result }
    })
  }, [])

  const startTransition = useCallback((nextProblem: GeneratedProblem, nextSlotIndex: number) => {
    setPhase((prev) => {
      if (prev.phase !== 'showingFeedback') return prev

      const outgoing: OutgoingAttempt = {
        key: `${prev.attempt.partIndex}-${prev.attempt.slotIndex}`,
        problem: prev.attempt.problem,
        userAnswer: prev.attempt.userAnswer,
        result: prev.result,
      }

      const incoming = createAttemptInput(nextProblem, nextSlotIndex, prev.attempt.partIndex)

      return { phase: 'transitioning', outgoing, incoming }
    })
  }, [])

  const completeTransition = useCallback(() => {
    setPhase((prev) => {
      if (prev.phase !== 'transitioning') return prev
      return { phase: 'inputting', attempt: prev.incoming }
    })
  }, [])

  const clearToLoading = useCallback(() => {
    setPhase({ phase: 'loading' })
  }, [])

  const pause = useCallback(() => {
    setPhase((prev) => {
      if (prev.phase === 'paused' || prev.phase === 'loading') return prev
      return { phase: 'paused', resumePhase: prev }
    })
  }, [])

  const resume = useCallback(() => {
    setPhase((prev) => {
      if (prev.phase !== 'paused') return prev
      return prev.resumePhase
    })
  }, [])

  return {
    phase,
    canAcceptInput,
    showAsCompleted,
    showHelpOverlay,
    showInputArea,
    showFeedback,
    inputIsFocused,
    prefixSums,
    matchedPrefixIndex,
    canSubmit,
    shouldAutoSubmit,
    loadProblem,
    handleDigit,
    handleBackspace,
    enterHelpMode,
    exitHelpMode,
    startSubmit,
    completeSubmit,
    startTransition,
    completeTransition,
    clearToLoading,
    pause,
    resume,
  }
}
