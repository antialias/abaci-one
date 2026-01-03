'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  /** Accumulated time spent paused (ms) - subtract from elapsed time for actual response time */
  accumulatedPauseMs: number
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
 * Context for the disambiguation phase - when user's input matches
 * an intermediate prefix sum but could also be the start of the final answer
 */
export interface DisambiguationContext {
  /** Index of the matched prefix sum */
  matchedPrefixIndex: number
  /** Term index to show help for if they want it */
  helpTermIndex: number
  /** When the disambiguation timer started */
  timerStartedAt: number
}

/**
 * Non-paused phases (used for resumePhase type)
 */
export type ActivePhase =
  | { phase: 'loading' }
  | { phase: 'inputting'; attempt: AttemptInput }
  | {
      phase: 'awaitingDisambiguation'
      attempt: AttemptInput
      disambiguationContext: DisambiguationContext
    }
  | { phase: 'helpMode'; attempt: AttemptInput; helpContext: HelpContext }
  | { phase: 'submitting'; attempt: AttemptInput }
  | {
      phase: 'showingFeedback'
      attempt: AttemptInput
      result: 'correct' | 'incorrect'
    }
  | {
      phase: 'transitioning'
      outgoing: OutgoingAttempt
      incoming: AttemptInput
    }
  | { phase: 'complete' }

/**
 * Discriminated union representing all possible interaction phases.
 * Each phase carries exactly the data needed for that phase.
 */
export type InteractionPhase =
  | ActivePhase
  // Session paused - remembers what phase to return to
  | {
      phase: 'paused'
      resumePhase: ActivePhase
      /** When the pause started (used to calculate pause duration on resume) */
      pauseStartedAt: number
    }

/** Threshold for correction count before requiring manual submit */
export const MANUAL_SUBMIT_THRESHOLD = 2

/** Time to wait before auto-triggering help in ambiguous cases (ms) */
export const AMBIGUOUS_HELP_DELAY_MS = 4000

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Gets the active (non-paused) phase, unwrapping if paused.
 */
export function getActivePhase(phase: InteractionPhase): ActivePhase {
  return phase.phase === 'paused' ? phase.resumePhase : phase
}

/**
 * Applies a transformation to the active phase, preserving paused wrapper if present.
 * If the transform returns null, the phase is unchanged.
 */
export function transformActivePhase(
  phase: InteractionPhase,
  transform: (active: ActivePhase) => ActivePhase | null
): InteractionPhase {
  if (phase.phase === 'paused') {
    const newResumePhase = transform(phase.resumePhase)
    if (newResumePhase === null) return phase
    return {
      phase: 'paused',
      resumePhase: newResumePhase,
      pauseStartedAt: phase.pauseStartedAt,
    }
  }
  const newPhase = transform(phase)
  return newPhase === null ? phase : newPhase
}

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
    accumulatedPauseMs: 0,
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
 *
 * Leading zeros are allowed as a disambiguation mechanism:
 * - Typing "0" when answer is empty is allowed (starts a multi-digit entry)
 * - Typing "03" signals intent to enter a 2+ digit number ending in 3
 * - The numeric value after stripping leading zeros must be consistent
 */
export function isDigitConsistent(
  currentAnswer: string,
  digit: string,
  prefixSums: number[]
): boolean {
  const newAnswer = currentAnswer + digit

  // Allow leading zeros as disambiguation (e.g., "0" or "03" for 3)
  // Strip leading zeros to get the numeric prefix we're building toward
  const strippedAnswer = newAnswer.replace(/^0+/, '') || '0'

  // If the result is just zeros, allow it (user is typing leading zeros)
  if (strippedAnswer === '0' && newAnswer.length > 0) {
    // Allow typing zeros as long as we haven't exceeded max answer length
    const maxLength = Math.max(...prefixSums.map((s) => s.toString().length))
    return newAnswer.length <= maxLength
  }

  const newAnswerNum = parseInt(strippedAnswer, 10)
  if (Number.isNaN(newAnswerNum)) return false

  for (const sum of prefixSums) {
    const sumStr = sum.toString()
    // Check if stripped answer is a prefix of any sum
    if (sumStr.startsWith(strippedAnswer)) {
      return true
    }
  }
  return false
}

/**
 * Result of checking for prefix sum matches
 */
export interface PrefixMatchResult {
  /** Index of matched prefix sum (-1 if none) */
  matchedIndex: number
  /** Whether this is an ambiguous match (could be digit-prefix of final answer) */
  isAmbiguous: boolean
  /** The term index to show help for (matchedIndex + 1, since we help with the NEXT term) */
  helpTermIndex: number
}

/**
 * Finds which prefix sum the user's answer matches, if any.
 * Also detects ambiguous cases where the input could be either:
 * 1. An intermediate prefix sum (user is stuck)
 * 2. The first digit(s) of a later prefix sum (user is still typing)
 *
 * Leading zeros disambiguate and REQUEST help:
 * - "3" alone is ambiguous (could be prefix sum 3 OR first digit of 33)
 * - "03" is unambiguous - user clearly wants help with prefix sum 3
 */
export function findMatchedPrefixIndex(
  userAnswer: string,
  prefixSums: number[]
): PrefixMatchResult {
  const noMatch: PrefixMatchResult = {
    matchedIndex: -1,
    isAmbiguous: false,
    helpTermIndex: -1,
  }

  if (!userAnswer) return noMatch

  // Leading zeros indicate user is explicitly requesting help for that prefix sum
  // "03" means "I want help with prefix sum 3" - this is NOT ambiguous
  const hasLeadingZero = userAnswer.startsWith('0') && userAnswer.length > 1

  const answerNum = parseInt(userAnswer, 10)
  if (Number.isNaN(answerNum)) return noMatch

  const finalAnswer = prefixSums[prefixSums.length - 1]

  // Check if this is the final answer
  if (answerNum === finalAnswer) {
    return {
      matchedIndex: prefixSums.length - 1,
      isAmbiguous: false,
      helpTermIndex: -1,
    }
  }

  // Check if user's input matches an intermediate prefix sum
  const matchedIndex = prefixSums.findIndex(
    (sum, i) => i < prefixSums.length - 1 && sum === answerNum
  )

  if (matchedIndex === -1) return noMatch

  // If they used leading zeros, they're explicitly requesting help - NOT ambiguous
  // "03" clearly means "help me with prefix sum 3"
  if (hasLeadingZero) {
    return {
      matchedIndex,
      isAmbiguous: false, // Leading zero removes ambiguity - they want help
      helpTermIndex: matchedIndex + 1,
    }
  }

  // Check if user's input could be a digit-prefix of ANY later prefix sum
  // For example, with prefix sums [2, 3, 33, 43, 44]:
  // - "3" matches prefix sum at index 1, but could also be first digit of 33 or 43
  // - So "3" is ambiguous
  const couldBeLaterPrefixPrefix = prefixSums.slice(matchedIndex + 1).some((laterSum) => {
    const laterSumStr = laterSum.toString()
    return laterSumStr.startsWith(userAnswer)
  })

  return {
    matchedIndex,
    isAmbiguous: couldBeLaterPrefixPrefix,
    helpTermIndex: matchedIndex + 1, // Help with the NEXT term after the matched sum
  }
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

export interface InitialProblemData {
  problem: GeneratedProblem
  slotIndex: number
  partIndex: number
}

export interface UseInteractionPhaseOptions {
  /** Initial problem to hydrate with (for SSR) */
  initialProblem?: InitialProblemData
  /** Called when auto-submit threshold is exceeded */
  onManualSubmitRequired?: () => void
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
  startTransition: (nextProblem: GeneratedProblem, nextSlotIndex: number) => void
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
  const { initialProblem, onManualSubmitRequired } = options

  // Initialize state with problem if provided (for SSR hydration)
  const [phase, setPhase] = useState<InteractionPhase>(() => {
    if (initialProblem) {
      const attempt = createAttemptInput(
        initialProblem.problem,
        initialProblem.slotIndex,
        initialProblem.partIndex
      )
      return { phase: 'inputting', attempt }
    }
    return { phase: 'loading' }
  })

  // ==========================================================================
  // Derived State
  // ==========================================================================

  // Extract attempt from phase if available
  const attempt = useMemo((): AttemptInput | null => {
    switch (phase.phase) {
      case 'inputting':
      case 'awaitingDisambiguation':
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
          inner.phase === 'awaitingDisambiguation' ||
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

  const prefixMatch = useMemo((): PrefixMatchResult => {
    if (!attempt) return { matchedIndex: -1, isAmbiguous: false, helpTermIndex: -1 }
    return findMatchedPrefixIndex(attempt.userAnswer, prefixSums)
  }, [attempt, prefixSums])

  // Convenience shorthand - most callers only need the index
  const matchedPrefixIndex = prefixMatch.matchedIndex

  // ==========================================================================
  // Disambiguation Timer (managed via phase state)
  // ==========================================================================

  // Timer ref for the disambiguation timeout
  const disambiguationTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Manage disambiguation timer based on phase
  useEffect(() => {
    // Clear any existing timer
    if (disambiguationTimerRef.current) {
      clearTimeout(disambiguationTimerRef.current)
      disambiguationTimerRef.current = null
    }

    // Only run timer when in awaitingDisambiguation phase
    if (phase.phase !== 'awaitingDisambiguation') return

    const ctx = phase.disambiguationContext
    const elapsed = Date.now() - ctx.timerStartedAt

    if (elapsed >= AMBIGUOUS_HELP_DELAY_MS) {
      // Timer already elapsed - transition to help mode immediately
      // Keep userAnswer during transition so it shows in answer boxes while fading out
      const helpContext = computeHelpContext(phase.attempt.problem.terms, ctx.helpTermIndex)
      setPhase({
        phase: 'helpMode',
        attempt: { ...phase.attempt, userAnswer: '' },
        helpContext,
      })
    } else {
      // Set timer for remaining time
      const remaining = AMBIGUOUS_HELP_DELAY_MS - elapsed
      disambiguationTimerRef.current = setTimeout(() => {
        setPhase((prev) => {
          if (prev.phase !== 'awaitingDisambiguation') return prev
          const helpContext = computeHelpContext(
            prev.attempt.problem.terms,
            prev.disambiguationContext.helpTermIndex
          )
          return {
            phase: 'helpMode',
            attempt: { ...prev.attempt, userAnswer: '' },
            helpContext,
          }
        })
      }, remaining)
    }

    return () => {
      if (disambiguationTimerRef.current) {
        clearTimeout(disambiguationTimerRef.current)
      }
    }
  }, [phase])

  // Derive which term to show "need help?" prompt for from the phase
  // Returns -1 when not in awaitingDisambiguation phase
  const ambiguousHelpTermIndex = useMemo(() => {
    if (phase.phase !== 'awaitingDisambiguation') return -1
    return phase.disambiguationContext.helpTermIndex
  }, [phase])

  const canSubmit = useMemo(() => {
    if (!attempt || !attempt.userAnswer) return false
    const answerNum = parseInt(attempt.userAnswer, 10)
    return !Number.isNaN(answerNum)
  }, [attempt])

  const shouldAutoSubmit = useMemo(() => {
    // Don't auto-submit in awaitingDisambiguation - the input might be a prefix sum
    if (phase.phase !== 'inputting' && phase.phase !== 'helpMode') return false
    if (!attempt || !attempt.userAnswer) return false
    if (attempt.correctionCount > MANUAL_SUBMIT_THRESHOLD) return false

    const answerNum = parseInt(attempt.userAnswer, 10)
    if (Number.isNaN(answerNum)) return false

    return answerNum === attempt.problem.answer
  }, [phase.phase, attempt])

  // UI predicates
  const canAcceptInput =
    phase.phase === 'inputting' ||
    phase.phase === 'awaitingDisambiguation' ||
    phase.phase === 'helpMode'

  const showAsCompleted = phase.phase === 'showingFeedback'

  const showHelpOverlay = phase.phase === 'helpMode'

  const showInputArea =
    phase.phase === 'inputting' ||
    phase.phase === 'awaitingDisambiguation' ||
    phase.phase === 'helpMode' ||
    phase.phase === 'submitting'

  const showFeedback = phase.phase === 'showingFeedback' && phase.result === 'incorrect'

  const inputIsFocused =
    phase.phase === 'inputting' ||
    phase.phase === 'awaitingDisambiguation' ||
    phase.phase === 'helpMode'

  const isTransitioning = phase.phase === 'transitioning'

  const isPaused = phase.phase === 'paused'

  const isSubmitting = phase.phase === 'submitting'

  // Extract helpContext from phase
  const helpContext = useMemo((): HelpContext | null => {
    if (phase.phase === 'helpMode') {
      return phase.helpContext
    }
    // Also check paused phase
    if (phase.phase === 'paused' && phase.resumePhase.phase === 'helpMode') {
      return phase.resumePhase.helpContext
    }
    return null
  }, [phase])

  // Extract outgoingAttempt from phase (only during transitions)
  const outgoingAttempt = useMemo((): OutgoingAttempt | null => {
    if (phase.phase === 'transitioning') {
      return phase.outgoing
    }
    return null
  }, [phase])

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
        // Accept input in inputting, awaitingDisambiguation, or helpMode
        if (
          prev.phase !== 'inputting' &&
          prev.phase !== 'awaitingDisambiguation' &&
          prev.phase !== 'helpMode'
        ) {
          return prev
        }

        // If in help mode, exit help mode and start fresh with the new digit
        if (prev.phase === 'helpMode') {
          const freshAttempt = {
            ...prev.attempt,
            userAnswer: digit,
            rejectedDigit: null,
          }
          return { phase: 'inputting', attempt: freshAttempt }
        }

        const attempt = prev.attempt
        const sums = computePrefixSums(attempt.problem.terms)

        // Once manual submit is required, accept any digit without validation
        if (attempt.manualSubmitRequired) {
          const updatedAttempt = {
            ...attempt,
            userAnswer: attempt.userAnswer + digit,
            rejectedDigit: null,
          }
          return { phase: 'inputting', attempt: updatedAttempt }
        }

        if (isDigitConsistent(attempt.userAnswer, digit, sums)) {
          const updatedAttempt = {
            ...attempt,
            userAnswer: attempt.userAnswer + digit,
            rejectedDigit: null,
          }

          // Check if the new answer creates an ambiguous prefix match
          const newPrefixMatch = findMatchedPrefixIndex(updatedAttempt.userAnswer, sums)

          if (newPrefixMatch.isAmbiguous && newPrefixMatch.helpTermIndex >= 0) {
            // Ambiguous match - transition to awaitingDisambiguation
            return {
              phase: 'awaitingDisambiguation',
              attempt: updatedAttempt,
              disambiguationContext: {
                matchedPrefixIndex: newPrefixMatch.matchedIndex,
                helpTermIndex: newPrefixMatch.helpTermIndex,
                timerStartedAt: Date.now(),
              },
            }
          } else if (
            !newPrefixMatch.isAmbiguous &&
            newPrefixMatch.matchedIndex >= 0 &&
            newPrefixMatch.helpTermIndex >= 0
          ) {
            // Unambiguous intermediate prefix match (e.g., "03" for prefix sum 3)
            // Immediately enter help mode
            // Keep userAnswer during transition so it shows in answer boxes while fading out
            const helpContext = computeHelpContext(
              attempt.problem.terms,
              newPrefixMatch.helpTermIndex
            )
            return {
              phase: 'helpMode',
              attempt: { ...updatedAttempt, userAnswer: '' },
              helpContext,
            }
          } else {
            // No special prefix match - stay in inputting (or return to it from awaitingDisambiguation)
            return { phase: 'inputting', attempt: updatedAttempt }
          }
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

          // Keep the same phase type but update attempt
          if (prev.phase === 'awaitingDisambiguation') {
            return { ...prev, attempt: updatedAttempt }
          }
          return { ...prev, attempt: updatedAttempt }
        }
      })

      // Clear rejected digit after animation
      setTimeout(() => {
        setPhase((prev) => {
          if (
            prev.phase !== 'inputting' &&
            prev.phase !== 'awaitingDisambiguation' &&
            prev.phase !== 'helpMode'
          ) {
            return prev
          }
          return { ...prev, attempt: { ...prev.attempt, rejectedDigit: null } }
        })
      }, 300)
    },
    [onManualSubmitRequired]
  )

  const handleBackspace = useCallback(() => {
    setPhase((prev) => {
      if (
        prev.phase !== 'inputting' &&
        prev.phase !== 'awaitingDisambiguation' &&
        prev.phase !== 'helpMode'
      ) {
        return prev
      }

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

      // After backspace, always return to inputting phase (no longer ambiguous)
      return { phase: 'inputting', attempt: updatedAttempt }
    })
  }, [onManualSubmitRequired])

  const enterHelpMode = useCallback((termIndex: number) => {
    setPhase((prev) => {
      // Allow entering help mode from inputting, awaitingDisambiguation, or helpMode (to navigate to a different term)
      if (
        prev.phase !== 'inputting' &&
        prev.phase !== 'awaitingDisambiguation' &&
        prev.phase !== 'helpMode'
      ) {
        return prev
      }

      // Keep userAnswer during transition so it shows in answer boxes while fading out
      const helpContext = computeHelpContext(prev.attempt.problem.terms, termIndex)
      return {
        phase: 'helpMode',
        attempt: { ...prev.attempt, userAnswer: '' },
        helpContext,
      }
    })
  }, [])

  const exitHelpMode = useCallback(() => {
    setPhase((prev) => {
      if (prev.phase === 'helpMode') {
        const updatedAttempt = { ...prev.attempt, userAnswer: '' }
        return { phase: 'inputting', attempt: updatedAttempt }
      }
      if (prev.phase === 'inputting') {
        const updatedAttempt = { ...prev.attempt, userAnswer: '' }
        return { phase: 'inputting', attempt: updatedAttempt }
      }
      return prev
    })
  }, [])

  const clearAnswer = useCallback(() => {
    setPhase((prev) => {
      if (prev.phase !== 'helpMode') return prev
      const updatedAttempt = { ...prev.attempt, userAnswer: '' }
      return {
        phase: 'helpMode',
        attempt: updatedAttempt,
        helpContext: prev.helpContext,
      }
    })
  }, [])

  const setAnswer = useCallback((value: string) => {
    setPhase((prev) => {
      if (prev.phase !== 'helpMode' && prev.phase !== 'inputting') return prev
      const updatedAttempt = { ...prev.attempt, userAnswer: value }
      if (prev.phase === 'helpMode') {
        return {
          phase: 'helpMode',
          attempt: updatedAttempt,
          helpContext: prev.helpContext,
        }
      }
      return { phase: 'inputting', attempt: updatedAttempt }
    })
  }, [])

  const startSubmit = useCallback(() => {
    setPhase((prev) => {
      // Allow submitting from inputting, awaitingDisambiguation, or helpMode
      if (
        prev.phase !== 'inputting' &&
        prev.phase !== 'awaitingDisambiguation' &&
        prev.phase !== 'helpMode'
      ) {
        return prev
      }
      return { phase: 'submitting', attempt: prev.attempt }
    })
  }, [])

  const completeSubmit = useCallback((result: 'correct' | 'incorrect') => {
    setPhase((prev) =>
      transformActivePhase(prev, (active) => {
        if (active.phase !== 'submitting') return null
        return { phase: 'showingFeedback', attempt: active.attempt, result }
      })
    )
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
    setPhase((prev) =>
      transformActivePhase(prev, (active) => {
        if (active.phase !== 'transitioning') return null
        return { phase: 'inputting', attempt: active.incoming }
      })
    )
  }, [])

  const clearToLoading = useCallback(() => {
    setPhase({ phase: 'loading' })
  }, [])

  const markComplete = useCallback(() => {
    setPhase({ phase: 'complete' })
  }, [])

  const pause = useCallback(() => {
    setPhase((prev) => {
      if (prev.phase === 'paused' || prev.phase === 'loading' || prev.phase === 'complete')
        return prev
      return { phase: 'paused', resumePhase: prev, pauseStartedAt: Date.now() }
    })
  }, [])

  const resume = useCallback(() => {
    setPhase((prev) => {
      if (prev.phase !== 'paused') return prev

      // Calculate how long we were paused
      const pauseDuration = Date.now() - prev.pauseStartedAt

      // Helper to add pause duration to an attempt
      const addPauseDuration = (attempt: AttemptInput): AttemptInput => ({
        ...attempt,
        accumulatedPauseMs: attempt.accumulatedPauseMs + pauseDuration,
      })

      // Update the attempt inside the resume phase to track accumulated pause time
      const resumePhase = prev.resumePhase
      switch (resumePhase.phase) {
        case 'inputting':
          return {
            ...resumePhase,
            attempt: addPauseDuration(resumePhase.attempt),
          }
        case 'awaitingDisambiguation':
          return {
            ...resumePhase,
            attempt: addPauseDuration(resumePhase.attempt),
          }
        case 'helpMode':
          return {
            ...resumePhase,
            attempt: addPauseDuration(resumePhase.attempt),
          }
        case 'submitting':
          return {
            ...resumePhase,
            attempt: addPauseDuration(resumePhase.attempt),
          }
        case 'showingFeedback':
          return {
            ...resumePhase,
            attempt: addPauseDuration(resumePhase.attempt),
          }
        case 'transitioning':
          // Update both outgoing (for accuracy of recorded time) and incoming
          return {
            ...resumePhase,
            incoming: addPauseDuration(resumePhase.incoming),
          }
        case 'loading':
        case 'complete':
          // No attempt to update
          return resumePhase
      }
    })
  }, [])

  // Is the session complete?
  const isComplete = phase.phase === 'complete'

  return {
    phase,
    attempt,
    helpContext,
    outgoingAttempt,
    canAcceptInput,
    showAsCompleted,
    showHelpOverlay,
    showInputArea,
    showFeedback,
    inputIsFocused,
    isTransitioning,
    isPaused,
    isSubmitting,
    prefixSums,
    prefixMatch,
    matchedPrefixIndex,
    canSubmit,
    shouldAutoSubmit,
    ambiguousHelpTermIndex,
    loadProblem,
    handleDigit,
    handleBackspace,
    enterHelpMode,
    exitHelpMode,
    clearAnswer,
    setAnswer,
    startSubmit,
    completeSubmit,
    startTransition,
    completeTransition,
    clearToLoading,
    markComplete,
    pause,
    resume,
    isComplete,
  }
}
