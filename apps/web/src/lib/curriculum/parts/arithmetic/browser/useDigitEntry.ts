'use client'

/**
 * Arithmetic's digit entry (practice-kinds plan §2, §4 K5a-1): the typed
 * answer, prefix sums, disambiguation and help mode, inside the generic try
 * lifecycle (`components/practice/session/useTryLifecycle.ts`).
 *
 * Arithmetic adds two phases inside inputting: `awaitingDisambiguation` (the
 * typed answer is an intermediate prefix sum and could also start the final
 * answer; after {@link AMBIGUOUS_HELP_DELAY_MS} the kid gets help) and
 * `helpMode` (bead help for one term). Both carry the attempt; the lifecycle
 * treats them as inputting.
 *
 * Extracted from `useInteractionPhase.ts` behaviour-identical (K5a-1). The
 * item view (`ItemView`) calls it as the session shell's child (K5a-3b).
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  getActivePhase,
  getActivePhaseAttempt,
  type LifecyclePhase,
  startTryClock,
  type TryClock,
  type TryItemKind,
  type TryPhase,
  type TryPhaseState,
  type TryResult,
} from '@/components/practice/session/useTryLifecycle'
import type { GeneratedProblem } from '@/db/schema/session-plans'

// =============================================================================
// Types
// =============================================================================

/**
 * Problem context passed as a prop - the single source of truth for what problem
 * is currently being worked on. This is computed by the parent component from
 * redoState + session plan, eliminating dual sources of truth.
 */
export interface ProblemContext {
  /** The problem being solved */
  problem: GeneratedProblem
  /** Index in the current part (original slot index for redos) */
  slotIndex: number
  /** Part index in the session */
  partIndex: number
}

/**
 * Input-level state for a problem attempt.
 * This is what the student is actively working on - their answer input.
 * Its try id and clock ({@link TryClock}) are the lifecycle's.
 */
export interface AttemptInput extends TryClock {
  /** The problem being solved */
  problem: GeneratedProblem
  /** Index in the current part */
  slotIndex: number
  /** Part index in the session */
  partIndex: number
  /** Retry round of the problem on screen (0 = original slot; absent = 0) */
  epochNumber?: number
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
  /** Part the outgoing problem belonged to (so the transition can render its
   *  own vertical/linear format, which may differ from the incoming part). */
  partIndex: number
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

/** Arithmetic's phases inside inputting */
export type DigitEntryPhase =
  | {
      phase: 'awaitingDisambiguation'
      attempt: AttemptInput
      disambiguationContext: DisambiguationContext
    }
  | { phase: 'helpMode'; attempt: AttemptInput; helpContext: HelpContext }

/**
 * Non-paused phases (used for resumePhase type)
 */
export type ActivePhase = LifecyclePhase<AttemptInput, OutgoingAttempt, DigitEntryPhase>

/**
 * Discriminated union representing all possible interaction phases.
 * Each phase carries exactly the data needed for that phase.
 */
export type InteractionPhase = TryPhase<ActivePhase>

/** Threshold for correction count before requiring manual submit */
export const MANUAL_SUBMIT_THRESHOLD = 2

/** Time to wait before auto-triggering help in ambiguous cases (ms) */
export const AMBIGUOUS_HELP_DELAY_MS = 4000

export interface InitialProblemData {
  problem: GeneratedProblem
  slotIndex: number
  partIndex: number
  /** Retry round (0 = original slot; absent = 0) */
  epochNumber?: number
}

/**
 * Active problem context with a stable key for change detection.
 * The key allows the hook to detect when the problem truly changes,
 * not just when references change.
 */
export interface ActiveProblem {
  problem: GeneratedProblem
  slotIndex: number
  partIndex: number
  /** Retry round (0 = original slot; absent = 0) */
  epochNumber?: number
  /** Stable identifier for this problem instance - changes when the problem changes */
  key: string
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Creates a fresh attempt input for a new problem
 */
export function createAttemptInput(
  problem: GeneratedProblem,
  slotIndex: number,
  partIndex: number,
  epochNumber = 0
): AttemptInput {
  return {
    problem,
    slotIndex,
    partIndex,
    epochNumber,
    ...startTryClock(),
    userAnswer: '',
    correctionCount: 0,
    manualSubmitRequired: false,
    rejectedDigit: null,
  }
}

/** How arithmetic makes the lifecycle's attempts: a problem in a slot of a part */
export const arithmeticTryItems: TryItemKind<InitialProblemData, AttemptInput, OutgoingAttempt> = {
  attemptOf: (item) =>
    createAttemptInput(item.problem, item.slotIndex, item.partIndex, item.epochNumber),
  outgoingOf: (attempt: AttemptInput, result: TryResult): OutgoingAttempt => ({
    key: `${attempt.partIndex}-${attempt.slotIndex}`,
    problem: attempt.problem,
    userAnswer: attempt.userAnswer,
    result,
    partIndex: attempt.partIndex,
  }),
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

export interface UseDigitEntryOptions {
  /** Called when auto-submit threshold is exceeded */
  onManualSubmitRequired?: () => void
  /**
   * When true (LINEAR parts), the abacus is put away entirely: never reject a
   * digit, never enter awaitingDisambiguation, and never enter help mode. The
   * student just types the final answer to the number sentence.
   */
  disableAbacusScaffolding?: boolean
}

export interface UseDigitEntryReturn {
  /** Help context when in helpMode (null otherwise) */
  helpContext: HelpContext | null
  /** Should the help overlay be shown? */
  showHelpOverlay: boolean

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
}

/**
 * Arithmetic's digit entry over the try's phase state. Call it before
 * `useTryLifecycle` on the same state, so the disambiguation timer's effect
 * runs before the lifecycle's (see `useTryLifecycle.ts`).
 */
export function useDigitEntry(
  state: TryPhaseState<ActivePhase>,
  options: UseDigitEntryOptions = {}
): UseDigitEntryReturn {
  const [phase, setPhase] = state
  const { onManualSubmitRequired, disableAbacusScaffolding } = options

  // Live mirror of the abacus-scaffolding-disabled flag (LINEAR parts) so the
  // memoized handleDigit/enterHelpMode callbacks read the current value without
  // being re-created when it toggles. Set during render — safe.
  const disableScaffoldingRef = useRef(disableAbacusScaffolding)
  disableScaffoldingRef.current = disableAbacusScaffolding

  // ==========================================================================
  // Derived State
  // ==========================================================================

  // The attempt on screen, recursing into a paused phase (the lifecycle's)
  const attempt = useMemo(
    (): AttemptInput | null => getActivePhaseAttempt(getActivePhase(phase)),
    [phase]
  )

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

    // LINEAR parts never enter awaitingDisambiguation (see handleDigit); with the
    // abacus scaffolding disabled there is no bead-help to schedule. Defensive.
    if (disableAbacusScaffolding) return

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
  }, [phase, disableAbacusScaffolding, setPhase])

  // Derive which term to show "need help?" prompt for from the phase
  // Returns -1 when not in awaitingDisambiguation phase
  const ambiguousHelpTermIndex = useMemo(() => {
    if (phase.phase !== 'awaitingDisambiguation') return -1
    return phase.disambiguationContext.helpTermIndex
  }, [phase])

  const canSubmit = useMemo(() => {
    if (!attempt?.userAnswer) return false
    const answerNum = parseInt(attempt.userAnswer, 10)
    return !Number.isNaN(answerNum)
  }, [attempt])

  const shouldAutoSubmit = useMemo(() => {
    // Don't auto-submit in awaitingDisambiguation - the input might be a prefix sum
    if (phase.phase !== 'inputting' && phase.phase !== 'helpMode') return false
    if (!attempt?.userAnswer) return false
    if (attempt.correctionCount > MANUAL_SUBMIT_THRESHOLD) return false

    const answerNum = parseInt(attempt.userAnswer, 10)
    if (Number.isNaN(answerNum)) return false

    return answerNum === attempt.problem.answer
  }, [phase.phase, attempt])

  const showHelpOverlay = phase.phase === 'helpMode'

  // Extract helpContext from phase (also when paused in help mode)
  const helpContext = useMemo((): HelpContext | null => {
    const active = getActivePhase(phase)
    if (active.phase === 'helpMode') {
      return active.helpContext
    }
    return null
  }, [phase])

  // ==========================================================================
  // Actions
  // ==========================================================================

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
        // We reset to an empty answer and fall through to the normal digit processing
        // so that ambiguity checks (awaitingDisambiguation) still apply
        if (prev.phase === 'helpMode') {
          prev = {
            phase: 'inputting',
            attempt: { ...prev.attempt, userAnswer: '', rejectedDigit: null },
          }
        }

        const attempt = prev.attempt
        const sums = computePrefixSums(attempt.problem.terms)

        // Once manual submit is required — or during LINEAR parts, where the abacus
        // prefix-sum scaffolding is disabled — accept any digit without validation
        // (never reject, never enter awaitingDisambiguation/help mode).
        if (attempt.manualSubmitRequired || disableScaffoldingRef.current) {
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
    [onManualSubmitRequired, setPhase]
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
  }, [onManualSubmitRequired, setPhase])

  const enterHelpMode = useCallback(
    (termIndex: number) => {
      // LINEAR parts have the abacus put away — bead-decomposition help must never
      // be entered. No-op keeps the current phase and typed answer intact.
      if (disableScaffoldingRef.current) return
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
    },
    [setPhase]
  )

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
  }, [setPhase])

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
  }, [setPhase])

  const setAnswer = useCallback(
    (value: string) => {
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
    },
    [setPhase]
  )

  return {
    helpContext,
    showHelpOverlay,
    prefixSums,
    prefixMatch,
    matchedPrefixIndex,
    canSubmit,
    shouldAutoSubmit,
    ambiguousHelpTermIndex,
    handleDigit,
    handleBackspace,
    enterHelpMode,
    exitHelpMode,
    clearAnswer,
    setAnswer,
  }
}
