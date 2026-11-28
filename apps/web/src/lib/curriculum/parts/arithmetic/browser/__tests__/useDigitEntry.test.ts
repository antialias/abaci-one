/**
 * @vitest-environment jsdom
 *
 * Arithmetic's digit entry (practice-kinds plan §4 K5a-1): prefix sums,
 * disambiguation and help mode.
 *
 * Split from `components/practice/hooks/__tests__/useInteractionPhase.test.ts`
 * with every case kept and its body unchanged: the hook cases still render
 * `useInteractionPhase`, the generic lifecycle composed with this entry, so
 * they run exactly as they did. The composition-order case at the end is new.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useInteractionPhase } from '@/components/practice/hooks/useInteractionPhase'
import type { GeneratedProblem } from '@/db/schema/session-plans'
import {
  type ActiveProblem,
  computeHelpContext,
  computePrefixSums,
  createAttemptInput,
  findMatchedPrefixIndex,
  isDigitConsistent,
  MANUAL_SUBMIT_THRESHOLD,
} from '../useDigitEntry'

// =============================================================================
// Test Fixtures
// =============================================================================

const createTestProblem = (terms: number[]): GeneratedProblem => ({
  terms,
  answer: terms.reduce((a, b) => a + b, 0),
  skillsRequired: [],
})

const simpleProblem = createTestProblem([3, 4, 5]) // answer: 12
const twoDigitProblem = createTestProblem([15, 27]) // answer: 42

// =============================================================================
// Pure Function Tests
// =============================================================================

describe('computePrefixSums', () => {
  it('computes running totals', () => {
    expect(computePrefixSums([3, 4, 5])).toEqual([3, 7, 12])
  })

  it('handles single term', () => {
    expect(computePrefixSums([42])).toEqual([42])
  })

  it('handles empty array', () => {
    expect(computePrefixSums([])).toEqual([])
  })

  it('handles negative terms', () => {
    expect(computePrefixSums([10, -3, 5])).toEqual([10, 7, 12])
  })
})

describe('isDigitConsistent', () => {
  const sums = [3, 7, 12] // for problem [3, 4, 5]

  it('accepts digit that starts a valid prefix sum', () => {
    expect(isDigitConsistent('', '1', sums)).toBe(true) // could be 12
    expect(isDigitConsistent('', '3', sums)).toBe(true) // could be 3
    expect(isDigitConsistent('', '7', sums)).toBe(true) // could be 7
  })

  it('accepts digit that continues a valid prefix sum', () => {
    expect(isDigitConsistent('1', '2', sums)).toBe(true) // 12
  })

  it('rejects digit that cannot match any prefix sum', () => {
    expect(isDigitConsistent('', '5', sums)).toBe(false)
    expect(isDigitConsistent('1', '3', sums)).toBe(false) // 13 not in sums
  })

  it('handles two-digit prefix sums', () => {
    const bigSums = [15, 42] // for problem [15, 27]
    expect(isDigitConsistent('', '4', bigSums)).toBe(true) // could be 42
    expect(isDigitConsistent('4', '2', bigSums)).toBe(true) // 42
    expect(isDigitConsistent('4', '3', bigSums)).toBe(false) // 43 not valid
  })

  describe('leading zeros for disambiguation', () => {
    // Problem [2, 1, 30] -> sums [2, 3, 33]
    const ambiguousSums = [2, 3, 33]

    it('accepts leading zero as first digit', () => {
      // "0" alone is allowed - indicates user is building a multi-digit number
      expect(isDigitConsistent('', '0', ambiguousSums)).toBe(true)
    })

    it('accepts digit after leading zero that matches a prefix sum', () => {
      // "03" is valid - stripped to "3" which matches prefix sum
      expect(isDigitConsistent('0', '3', ambiguousSums)).toBe(true)
      // "02" is valid - stripped to "2" which matches prefix sum
      expect(isDigitConsistent('0', '2', ambiguousSums)).toBe(true)
    })

    it('rejects digit after leading zero that does not match any prefix sum', () => {
      // "05" -> "5" does not match any prefix sum in [2, 3, 33]
      expect(isDigitConsistent('0', '5', ambiguousSums)).toBe(false)
    })

    it('allows multiple leading zeros up to max answer length', () => {
      // "00" is valid if we haven't exceeded max digit count
      expect(isDigitConsistent('0', '0', ambiguousSums)).toBe(true)
    })
  })
})

describe('findMatchedPrefixIndex', () => {
  const sums = [3, 7, 12]

  it('finds exact match for intermediate prefix sum (unambiguous)', () => {
    // "7" matches prefix sum at index 1, and 7 is NOT a digit-prefix of 12
    const result = findMatchedPrefixIndex('7', sums)
    expect(result.matchedIndex).toBe(1)
    expect(result.isAmbiguous).toBe(false)
    expect(result.helpTermIndex).toBe(2) // help with term at index 2
  })

  it('finds final answer match', () => {
    const result = findMatchedPrefixIndex('12', sums)
    expect(result.matchedIndex).toBe(2) // final answer
    expect(result.isAmbiguous).toBe(false)
    expect(result.helpTermIndex).toBe(-1) // no help needed for final answer
  })

  it('detects ambiguous match when prefix sum is also digit-prefix of final answer', () => {
    // Problem: [2, 1, 30] -> prefix sums [2, 3, 33], final answer 33
    const ambiguousSums = [2, 3, 33]
    const result = findMatchedPrefixIndex('3', ambiguousSums)
    expect(result.matchedIndex).toBe(1) // matches prefix sum at index 1
    expect(result.isAmbiguous).toBe(true) // "3" is also digit-prefix of "33"
    expect(result.helpTermIndex).toBe(2) // help with term at index 2
  })

  it('detects ambiguous match when prefix sum is digit-prefix of intermediate prefix sum', () => {
    // Problem: [2, 1, 30, 10, 1] -> prefix sums [2, 3, 33, 43, 44]
    // Typing "3" matches prefix sum 3 at index 1
    // But "3" is also the first digit of "33" at index 2
    // Note: "3" is NOT a prefix of "43" or "44" (those start with "4")
    const multiSums = [2, 3, 33, 43, 44]
    const result = findMatchedPrefixIndex('3', multiSums)
    expect(result.matchedIndex).toBe(1) // matches prefix sum 3 at index 1
    expect(result.isAmbiguous).toBe(true) // "3" is also digit-prefix of "33"
    expect(result.helpTermIndex).toBe(2) // help with term at index 2
  })

  it('returns no match for input that does not match any prefix sum', () => {
    const result = findMatchedPrefixIndex('5', sums)
    expect(result.matchedIndex).toBe(-1)
    expect(result.isAmbiguous).toBe(false)
    expect(result.helpTermIndex).toBe(-1)
  })

  it('returns no match for empty input', () => {
    const result = findMatchedPrefixIndex('', sums)
    expect(result.matchedIndex).toBe(-1)
    expect(result.isAmbiguous).toBe(false)
    expect(result.helpTermIndex).toBe(-1)
  })

  it('returns no match for non-numeric input', () => {
    const result = findMatchedPrefixIndex('abc', sums)
    expect(result.matchedIndex).toBe(-1)
    expect(result.isAmbiguous).toBe(false)
    expect(result.helpTermIndex).toBe(-1)
  })

  describe('intermediate prefix sum equals final answer', () => {
    // Problem: 65 - 34 - 15 + 33 - 18 = 31
    // Prefix sums: [65, 31, 16, 49, 31]
    // prefixSums[1] = 31 AND prefixSums[4] = 31 (final answer)
    // BUG FIX: indexOf(31) returns 1, but we should return 4 (final answer)
    const sumsWithDuplicateFinal = [65, 31, 16, 49, 31]

    it('returns final answer index when answer matches both intermediate and final prefix sums', () => {
      const result = findMatchedPrefixIndex('31', sumsWithDuplicateFinal)
      expect(result.matchedIndex).toBe(4) // Final answer index, NOT 1
      expect(result.isAmbiguous).toBe(false)
      expect(result.helpTermIndex).toBe(-1) // No help for final answer
    })

    it('correctly identifies intermediate prefix sum when not matching final answer', () => {
      const result = findMatchedPrefixIndex('65', sumsWithDuplicateFinal)
      expect(result.matchedIndex).toBe(0) // First prefix sum
      expect(result.isAmbiguous).toBe(false)
      expect(result.helpTermIndex).toBe(1) // Help with next term
    })

    it('correctly identifies middle prefix sum', () => {
      const result = findMatchedPrefixIndex('16', sumsWithDuplicateFinal)
      expect(result.matchedIndex).toBe(2) // Third prefix sum
      expect(result.isAmbiguous).toBe(false)
      expect(result.helpTermIndex).toBe(3) // Help with next term
    })
  })

  describe('leading zeros disambiguation', () => {
    // Problem: [2, 1, 30] -> prefix sums [2, 3, 33]
    const ambiguousSums = [2, 3, 33]

    it('treats leading zero as explicit help request (not ambiguous)', () => {
      // "03" means "I want help with prefix sum 3" - unambiguous
      const result = findMatchedPrefixIndex('03', ambiguousSums)
      expect(result.matchedIndex).toBe(1) // matches prefix sum 3 at index 1
      expect(result.isAmbiguous).toBe(false) // leading zero removes ambiguity
      expect(result.helpTermIndex).toBe(2) // help with term at index 2
    })

    it('treats single leading zero as part of a multi-digit entry', () => {
      // "02" -> numeric value 2 matches prefix sum at index 0
      const result = findMatchedPrefixIndex('02', ambiguousSums)
      expect(result.matchedIndex).toBe(0)
      expect(result.isAmbiguous).toBe(false) // leading zero = explicit help request
      expect(result.helpTermIndex).toBe(1)
    })
  })
})

describe('computeHelpContext', () => {
  it('computes context for first term', () => {
    const ctx = computeHelpContext([3, 4, 5], 0)
    expect(ctx).toEqual({
      termIndex: 0,
      currentValue: 0,
      targetValue: 3,
      term: 3,
    })
  })

  it('computes context for middle term', () => {
    const ctx = computeHelpContext([3, 4, 5], 1)
    expect(ctx).toEqual({
      termIndex: 1,
      currentValue: 3,
      targetValue: 7,
      term: 4,
    })
  })

  it('computes context for last term', () => {
    const ctx = computeHelpContext([3, 4, 5], 2)
    expect(ctx).toEqual({
      termIndex: 2,
      currentValue: 7,
      targetValue: 12,
      term: 5,
    })
  })
})

describe('createAttemptInput', () => {
  it('creates fresh attempt with correct initial values', () => {
    const before = Date.now()
    const attempt = createAttemptInput(simpleProblem, 2, 1)
    const after = Date.now()

    expect(attempt.problem).toBe(simpleProblem)
    expect(attempt.slotIndex).toBe(2)
    expect(attempt.partIndex).toBe(1)
    expect(attempt.startTime).toBeGreaterThanOrEqual(before)
    expect(attempt.startTime).toBeLessThanOrEqual(after)
    expect(attempt.userAnswer).toBe('')
    expect(attempt.correctionCount).toBe(0)
    expect(attempt.manualSubmitRequired).toBe(false)
    expect(attempt.rejectedDigit).toBe(null)
  })

  it('initializes accumulatedHiddenMs to 0', () => {
    const attempt = createAttemptInput(simpleProblem, 0, 0)
    expect(attempt.accumulatedHiddenMs).toBe(0)
    expect(attempt.accumulatedPauseMs).toBe(0)
  })
})

// =============================================================================
// Hook Tests (through useInteractionPhase, the composition)
// =============================================================================

describe('useInteractionPhase', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('has empty computed values in loading phase', () => {
      const { result } = renderHook(() => useInteractionPhase())
      expect(result.current.prefixSums).toEqual([])
      expect(result.current.matchedPrefixIndex).toBe(-1)
      expect(result.current.canSubmit).toBe(false)
      expect(result.current.shouldAutoSubmit).toBe(false)
    })
  })

  // ===========================================================================
  // Phase Transitions
  // ===========================================================================

  describe('loadProblem: loading → inputting', () => {
    it('computes prefix sums', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      expect(result.current.prefixSums).toEqual([3, 7, 12])
    })
  })

  describe('handleDigit', () => {
    it('accepts valid digit', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.handleDigit('1')
      })

      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.userAnswer).toBe('1')
      }
    })

    it('rejects invalid digit and increments correction count', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.handleDigit('5') // 5 is not a prefix of 3, 7, or 12
      })

      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.userAnswer).toBe('')
        expect(result.current.phase.attempt.correctionCount).toBe(1)
        expect(result.current.phase.attempt.rejectedDigit).toBe('5')
      }
    })

    it('clears rejected digit after timeout', async () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.handleDigit('5')
      })

      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.rejectedDigit).toBe('5')
      }

      await act(async () => {
        vi.advanceTimersByTime(301)
      })

      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.rejectedDigit).toBe(null)
      }
    })

    it('triggers manual submit after threshold exceeded', async () => {
      const onManualSubmitRequired = vi.fn()
      const { result } = renderHook(() => useInteractionPhase({ onManualSubmitRequired }))

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      // Make corrections to exceed threshold
      for (let i = 0; i <= MANUAL_SUBMIT_THRESHOLD; i++) {
        act(() => {
          result.current.handleDigit('5') // invalid digit
        })
        await act(async () => {
          vi.advanceTimersByTime(301)
        })
      }

      await act(async () => {
        vi.advanceTimersByTime(1)
      })

      expect(onManualSubmitRequired).toHaveBeenCalled()
      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.manualSubmitRequired).toBe(true)
      }
    })

    it('accepts any digit input once manual submit is required', async () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      // Force manual submit by exceeding the correction threshold
      for (let i = 0; i <= MANUAL_SUBMIT_THRESHOLD; i++) {
        act(() => {
          result.current.handleDigit('5') // invalid digit
        })
        await act(async () => {
          vi.advanceTimersByTime(301)
        })
      }

      // Now that manual submit is required, any digit should be accepted
      act(() => {
        result.current.handleDigit('9')
      })

      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.manualSubmitRequired).toBe(true)
        expect(result.current.phase.attempt.userAnswer).toBe('9')
        expect(result.current.phase.attempt.rejectedDigit).toBeNull()
      }
    })

    it('does nothing in non-input phases', () => {
      const { result } = renderHook(() => useInteractionPhase())

      // In loading phase
      act(() => {
        result.current.handleDigit('1')
      })

      expect(result.current.phase.phase).toBe('loading')
    })
  })

  describe('disableAbacusScaffolding (LINEAR parts)', () => {
    // With the abacus put away, the prefix-sum scaffolding is disabled: every digit
    // is free-accepted, disambiguation/help mode is never entered, and the typed
    // answer is never wiped. The student just types the final answer.

    it('accepts a digit that vertical mode would reject', () => {
      const { result } = renderHook(() => useInteractionPhase({ disableAbacusScaffolding: true }))

      act(() => {
        result.current.loadProblem(twoDigitProblem, 0, 0) // [15, 27], sums [15, 42]
      })

      // '9' is not a prefix of 15 or 42 — vertical mode rejects it and bumps
      // correctionCount; linear accepts it verbatim.
      act(() => {
        result.current.handleDigit('9')
      })

      expect(result.current.phase.phase).toBe('inputting')
      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.userAnswer).toBe('9')
        expect(result.current.phase.attempt.rejectedDigit).toBeNull()
        expect(result.current.phase.attempt.correctionCount).toBe(0)
      }
    })

    it('never enters awaitingDisambiguation/helpMode on an intermediate prefix sum', () => {
      const { result } = renderHook(() => useInteractionPhase({ disableAbacusScaffolding: true }))

      act(() => {
        result.current.loadProblem(twoDigitProblem, 0, 0) // sums [15, 42]
      })

      // Typing "15" equals the first prefix sum — vertical mode leaves inputting
      // (help mode). Linear stays put.
      act(() => {
        result.current.handleDigit('1')
        result.current.handleDigit('5')
      })

      expect(result.current.phase.phase).toBe('inputting')
      expect(result.current.ambiguousHelpTermIndex).toBe(-1)
      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.userAnswer).toBe('15')
      }
    })

    it('makes enterHelpMode a no-op that preserves the typed answer', () => {
      const { result } = renderHook(() => useInteractionPhase({ disableAbacusScaffolding: true }))

      act(() => {
        result.current.loadProblem(twoDigitProblem, 0, 0)
      })

      act(() => {
        result.current.handleDigit('4')
        result.current.handleDigit('2')
      })

      act(() => {
        result.current.enterHelpMode(0)
      })

      expect(result.current.phase.phase).toBe('inputting')
      expect(result.current.showHelpOverlay).toBe(false)
      if (result.current.phase.phase === 'inputting') {
        // Not wiped to '' (the vertical help-entry behavior)
        expect(result.current.phase.attempt.userAnswer).toBe('42')
      }
    })

    it('still auto-submits when the typed answer is correct', () => {
      const { result } = renderHook(() => useInteractionPhase({ disableAbacusScaffolding: true }))

      act(() => {
        result.current.loadProblem(twoDigitProblem, 0, 0) // answer 42
      })

      act(() => {
        result.current.handleDigit('4')
        result.current.handleDigit('2')
      })

      expect(result.current.shouldAutoSubmit).toBe(true)
    })

    it('leaves rejection/help behavior intact when the flag is off (control)', () => {
      const { result } = renderHook(() => useInteractionPhase({ disableAbacusScaffolding: false }))

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0) // sums [3, 7, 12]
      })

      act(() => {
        result.current.handleDigit('5') // not a prefix of any sum
      })

      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.userAnswer).toBe('')
        expect(result.current.phase.attempt.correctionCount).toBe(1)
        expect(result.current.phase.attempt.rejectedDigit).toBe('5')
      }
    })
  })

  describe('handleBackspace', () => {
    it('removes last digit', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.handleDigit('1')
        result.current.handleDigit('2')
      })

      act(() => {
        result.current.handleBackspace()
      })

      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.userAnswer).toBe('1')
      }
    })

    it('increments correction count', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.handleDigit('1')
      })

      act(() => {
        result.current.handleBackspace()
      })

      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.correctionCount).toBe(1)
      }
    })

    it('does nothing when answer is empty', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.handleBackspace()
      })

      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.correctionCount).toBe(0)
      }
    })
  })

  describe('enterHelpMode: inputting → helpMode', () => {
    it('transitions to helpMode with context', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.enterHelpMode(1)
      })

      expect(result.current.phase.phase).toBe('helpMode')
      if (result.current.phase.phase === 'helpMode') {
        expect(result.current.phase.helpContext).toEqual({
          termIndex: 1,
          currentValue: 3,
          targetValue: 7,
          term: 4,
        })
      }
    })

    it('clears user answer when entering help mode', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.handleDigit('3')
      })

      act(() => {
        result.current.enterHelpMode(1)
      })

      if (result.current.phase.phase === 'helpMode') {
        expect(result.current.phase.attempt.userAnswer).toBe('')
      }
    })

    it('sets correct UI predicates in helpMode', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.enterHelpMode(1)
      })

      expect(result.current.canAcceptInput).toBe(true)
      expect(result.current.showHelpOverlay).toBe(true)
      expect(result.current.showInputArea).toBe(true)
      expect(result.current.inputIsFocused).toBe(true)
    })

    it('does nothing if not in inputting phase', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.enterHelpMode(1)
      })

      expect(result.current.phase.phase).toBe('loading')
    })
  })

  describe('exitHelpMode: helpMode → inputting', () => {
    it('transitions back to inputting', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.enterHelpMode(1)
      })

      act(() => {
        result.current.exitHelpMode()
      })

      expect(result.current.phase.phase).toBe('inputting')
    })

    it('clears user answer when exiting help mode', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.enterHelpMode(1)
      })

      act(() => {
        result.current.handleDigit('7')
      })

      act(() => {
        result.current.exitHelpMode()
      })

      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.userAnswer).toBe('')
      }
    })
  })

  // ===========================================================================
  // Computed Values
  // ===========================================================================

  describe('canSubmit', () => {
    it('is false when no answer', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      expect(result.current.canSubmit).toBe(false)
    })

    it('is true when answer has digits', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('1')
      })

      expect(result.current.canSubmit).toBe(true)
    })
  })

  describe('shouldAutoSubmit', () => {
    it('is true when answer matches and no corrections', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('1')
        result.current.handleDigit('2')
      })

      expect(result.current.shouldAutoSubmit).toBe(true)
    })

    it('is false when answer is incorrect', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('3')
      })

      expect(result.current.shouldAutoSubmit).toBe(false)
    })

    it('is false when corrections exceed threshold', async () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      // Make corrections to exceed threshold
      for (let i = 0; i <= MANUAL_SUBMIT_THRESHOLD; i++) {
        act(() => {
          result.current.handleDigit('5')
        })
        await act(async () => {
          vi.advanceTimersByTime(301)
        })
      }

      // Now enter correct answer
      act(() => {
        result.current.handleDigit('1')
        result.current.handleDigit('2')
      })

      expect(result.current.shouldAutoSubmit).toBe(false)
    })

    it('is false when not in inputting/helpMode phase', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('1')
        result.current.handleDigit('2')
        result.current.startSubmit()
      })

      expect(result.current.shouldAutoSubmit).toBe(false)
    })
  })

  describe('matchedPrefixIndex', () => {
    it('returns -1 when no match', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('1')
      })

      expect(result.current.matchedPrefixIndex).toBe(-1)
    })

    it('returns -1 when partial match (not yet complete)', () => {
      const { result } = renderHook(() => useInteractionPhase())

      // Use twoDigitProblem [15, 27] -> sums [15, 42]
      act(() => {
        result.current.loadProblem(twoDigitProblem, 0, 0)
        result.current.handleDigit('4') // partial match for 42
      })

      expect(result.current.matchedPrefixIndex).toBe(-1)
    })

    it('returns final answer index when answer is complete', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('1')
        result.current.handleDigit('2') // 12 = final answer
      })

      expect(result.current.matchedPrefixIndex).toBe(2) // Final answer index
    })
  })

  // ===========================================================================
  // Disambiguation Phase Tests
  // ===========================================================================

  describe('awaitingDisambiguation phase', () => {
    // Problem [2, 1, 30] -> prefix sums [2, 3, 33], answer 33
    // Typing "3" is ambiguous: could be prefix sum 3 OR first digit of 33
    const ambiguousProblem = createTestProblem([2, 1, 30])

    describe('entering awaitingDisambiguation', () => {
      it('transitions to awaitingDisambiguation when typing ambiguous prefix match', () => {
        const { result } = renderHook(() => useInteractionPhase())

        act(() => {
          result.current.loadProblem(ambiguousProblem, 0, 0)
        })

        act(() => {
          result.current.handleDigit('3') // Ambiguous: prefix sum 3 or first digit of 33
        })

        expect(result.current.phase.phase).toBe('awaitingDisambiguation')
        if (result.current.phase.phase === 'awaitingDisambiguation') {
          expect(result.current.phase.attempt.userAnswer).toBe('3')
          expect(result.current.phase.disambiguationContext.matchedPrefixIndex).toBe(1)
          expect(result.current.phase.disambiguationContext.helpTermIndex).toBe(2)
        }
      })

      it('sets ambiguousHelpTermIndex when in awaitingDisambiguation', () => {
        const { result } = renderHook(() => useInteractionPhase())

        act(() => {
          result.current.loadProblem(ambiguousProblem, 0, 0)
          result.current.handleDigit('3')
        })

        expect(result.current.ambiguousHelpTermIndex).toBe(2)
      })

      it('sets correct UI predicates in awaitingDisambiguation', () => {
        const { result } = renderHook(() => useInteractionPhase())

        act(() => {
          result.current.loadProblem(ambiguousProblem, 0, 0)
          result.current.handleDigit('3')
        })

        expect(result.current.canAcceptInput).toBe(true)
        expect(result.current.showInputArea).toBe(true)
        expect(result.current.inputIsFocused).toBe(true)
        expect(result.current.showHelpOverlay).toBe(false) // Not in help mode yet
        expect(result.current.isTransitioning).toBe(false)
        expect(result.current.isPaused).toBe(false)
        expect(result.current.isSubmitting).toBe(false)
      })
    })

    describe('exiting awaitingDisambiguation via continued typing', () => {
      it('returns to inputting when typing digit that breaks ambiguity (continues final answer)', () => {
        const { result } = renderHook(() => useInteractionPhase())

        act(() => {
          result.current.loadProblem(ambiguousProblem, 0, 0)
          result.current.handleDigit('3') // → awaitingDisambiguation
        })

        expect(result.current.phase.phase).toBe('awaitingDisambiguation')

        act(() => {
          result.current.handleDigit('3') // "33" is the final answer - no longer ambiguous
        })

        expect(result.current.phase.phase).toBe('inputting')
        if (result.current.phase.phase === 'inputting') {
          expect(result.current.phase.attempt.userAnswer).toBe('33')
        }
        expect(result.current.ambiguousHelpTermIndex).toBe(-1)
      })
    })

    describe('exiting awaitingDisambiguation via leading zero', () => {
      it('immediately enters helpMode when typing leading zero followed by prefix sum', () => {
        const { result } = renderHook(() => useInteractionPhase())

        act(() => {
          result.current.loadProblem(ambiguousProblem, 0, 0)
        })

        // Type "0" first (leading zero)
        act(() => {
          result.current.handleDigit('0')
        })

        // Then type "3" - "03" is unambiguous, means "help me with prefix sum 3"
        act(() => {
          result.current.handleDigit('3')
        })

        expect(result.current.phase.phase).toBe('helpMode')
        if (result.current.phase.phase === 'helpMode') {
          expect(result.current.phase.helpContext.termIndex).toBe(2) // help with term at index 2
          expect(result.current.phase.attempt.userAnswer).toBe('') // answer cleared for help
        }
      })
    })

    describe('exiting awaitingDisambiguation via backspace', () => {
      it('returns to inputting when backspacing', () => {
        const { result } = renderHook(() => useInteractionPhase())

        act(() => {
          result.current.loadProblem(ambiguousProblem, 0, 0)
          result.current.handleDigit('3')
        })

        expect(result.current.phase.phase).toBe('awaitingDisambiguation')

        act(() => {
          result.current.handleBackspace()
        })

        expect(result.current.phase.phase).toBe('inputting')
        if (result.current.phase.phase === 'inputting') {
          expect(result.current.phase.attempt.userAnswer).toBe('')
        }
      })
    })

    describe('exiting awaitingDisambiguation via timer', () => {
      it('automatically transitions to helpMode when timer expires', async () => {
        const { result } = renderHook(() => useInteractionPhase())

        act(() => {
          result.current.loadProblem(ambiguousProblem, 0, 0)
          result.current.handleDigit('3')
        })

        expect(result.current.phase.phase).toBe('awaitingDisambiguation')

        // Advance time past the disambiguation delay (4000ms)
        await act(async () => {
          vi.advanceTimersByTime(4001)
        })

        expect(result.current.phase.phase).toBe('helpMode')
        if (result.current.phase.phase === 'helpMode') {
          expect(result.current.phase.helpContext.termIndex).toBe(2)
          expect(result.current.phase.attempt.userAnswer).toBe('') // cleared for help
        }
      })

      it('cancels timer when typing continues', async () => {
        const { result } = renderHook(() => useInteractionPhase())

        act(() => {
          result.current.loadProblem(ambiguousProblem, 0, 0)
          result.current.handleDigit('3')
        })

        // Advance time but not past the delay
        await act(async () => {
          vi.advanceTimersByTime(2000)
        })

        expect(result.current.phase.phase).toBe('awaitingDisambiguation')

        // Type another digit to break ambiguity
        act(() => {
          result.current.handleDigit('3')
        })

        expect(result.current.phase.phase).toBe('inputting')

        // Advance past original timer - should NOT transition to helpMode
        await act(async () => {
          vi.advanceTimersByTime(3000)
        })

        expect(result.current.phase.phase).toBe('inputting')
      })
    })

    describe('submit from awaitingDisambiguation', () => {
      it('allows submitting from awaitingDisambiguation phase', () => {
        const { result } = renderHook(() => useInteractionPhase())

        act(() => {
          result.current.loadProblem(ambiguousProblem, 0, 0)
          result.current.handleDigit('3')
        })

        expect(result.current.phase.phase).toBe('awaitingDisambiguation')

        act(() => {
          result.current.startSubmit()
        })

        expect(result.current.phase.phase).toBe('submitting')
        if (result.current.phase.phase === 'submitting') {
          expect(result.current.phase.attempt.userAnswer).toBe('3')
        }
      })
    })

    describe('enterHelpMode from awaitingDisambiguation', () => {
      it('allows entering helpMode explicitly from awaitingDisambiguation', () => {
        const { result } = renderHook(() => useInteractionPhase())

        act(() => {
          result.current.loadProblem(ambiguousProblem, 0, 0)
          result.current.handleDigit('3')
        })

        expect(result.current.phase.phase).toBe('awaitingDisambiguation')

        act(() => {
          result.current.enterHelpMode(2)
        })

        expect(result.current.phase.phase).toBe('helpMode')
        if (result.current.phase.phase === 'helpMode') {
          expect(result.current.phase.helpContext.termIndex).toBe(2)
        }
      })
    })

    describe('shouldAutoSubmit in awaitingDisambiguation', () => {
      it('does not auto-submit when in awaitingDisambiguation', () => {
        // Problem [2, 1, 30] -> sums [2, 3, 33], answer 33
        // Typing "3" matches prefix sum 3, but "3" is also a digit-prefix of "33"
        // This creates an ambiguous situation
        const { result } = renderHook(() => useInteractionPhase())

        act(() => {
          result.current.loadProblem(ambiguousProblem, 0, 0)
          result.current.handleDigit('3')
        })

        // Should be in awaitingDisambiguation phase
        expect(result.current.phase.phase).toBe('awaitingDisambiguation')

        // shouldAutoSubmit should be false because we're in awaitingDisambiguation
        expect(result.current.shouldAutoSubmit).toBe(false)
      })
    })
  })

  // ===========================================================================
  // Exported State Tests
  // ===========================================================================

  describe('exported state from hook', () => {
    it('exports helpContext when in helpMode', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.enterHelpMode(1)
      })

      expect(result.current.helpContext).not.toBeNull()
      expect(result.current.helpContext?.termIndex).toBe(1)
      expect(result.current.helpContext?.currentValue).toBe(3)
      expect(result.current.helpContext?.targetValue).toBe(7)
    })

    it('exports null helpContext when not in helpMode', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      expect(result.current.helpContext).toBeNull()
    })
  })

  // ===========================================================================
  // Unambiguous Prefix Sum Tests
  // ===========================================================================

  describe('unambiguous prefix sum handling', () => {
    // Problem [3, 4, 5] -> prefix sums [3, 7, 12]
    // "7" is unambiguous - it's NOT a digit prefix of "12"

    it('immediately transitions to helpMode for unambiguous prefix match', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('7') // Unambiguous prefix sum
      })

      // Unambiguous prefix matches immediately trigger helpMode
      expect(result.current.phase.phase).toBe('helpMode')
      if (result.current.phase.phase === 'helpMode') {
        // Help is for the term AFTER the matched prefix (index 2)
        expect(result.current.phase.helpContext.termIndex).toBe(2)
        // User's answer is cleared for help mode
        expect(result.current.phase.attempt.userAnswer).toBe('')
      }
      expect(result.current.ambiguousHelpTermIndex).toBe(-1) // Not in awaitingDisambiguation
    })

    it('transitions to helpMode for first prefix sum when unambiguous', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('3') // First prefix sum, not a digit-prefix of 12
      })

      expect(result.current.phase.phase).toBe('helpMode')
      if (result.current.phase.phase === 'helpMode') {
        // Help is for the term AFTER the first prefix sum (index 1)
        expect(result.current.phase.helpContext.termIndex).toBe(1)
        expect(result.current.phase.attempt.userAnswer).toBe('')
      }
    })
  })

  describe('help mode flow', () => {
    it('inputting → helpMode (via prefix sum) → inputting → submitting', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      // Typing an unambiguous prefix sum immediately triggers helpMode
      act(() => {
        result.current.handleDigit('3') // Unambiguous prefix sum
      })
      // For simpleProblem [3, 4, 5], "3" is an unambiguous prefix match
      // (3 is not a digit-prefix of 12), so we go straight to helpMode
      expect(result.current.phase.phase).toBe('helpMode')
      expect(result.current.showHelpOverlay).toBe(true)
      if (result.current.phase.phase === 'helpMode') {
        // Help is for term at index 1 (the NEXT term after prefix sum at index 0)
        expect(result.current.phase.helpContext.termIndex).toBe(1)
      }

      // Exit help mode
      act(() => {
        result.current.exitHelpMode()
      })
      expect(result.current.phase.phase).toBe('inputting')
      expect(result.current.showHelpOverlay).toBe(false)

      // Enter final answer
      act(() => {
        result.current.handleDigit('1')
        result.current.handleDigit('2')
      })

      // Submit
      act(() => {
        result.current.startSubmit()
      })
      expect(result.current.phase.phase).toBe('submitting')
    })

    it('inputting → helpMode (via explicit call) → inputting → submitting', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      // Type "1" (valid digit but not a prefix sum match)
      act(() => {
        result.current.handleDigit('1')
      })
      expect(result.current.phase.phase).toBe('inputting')

      // Explicitly enter help mode
      act(() => {
        result.current.enterHelpMode(1)
      })
      expect(result.current.phase.phase).toBe('helpMode')
      expect(result.current.showHelpOverlay).toBe(true)

      // Exit help mode
      act(() => {
        result.current.exitHelpMode()
      })
      expect(result.current.phase.phase).toBe('inputting')
      expect(result.current.showHelpOverlay).toBe(false)

      // Enter final answer
      act(() => {
        result.current.handleDigit('1')
        result.current.handleDigit('2')
      })

      // Submit
      act(() => {
        result.current.startSubmit()
      })
      expect(result.current.phase.phase).toBe('submitting')
    })
  })

  // ===========================================================================
  // Regression: helpMode exit with ambiguous prefix should not re-enter help
  // https://github.com/antialias/abaci-one/issues/2
  // ===========================================================================

  describe('helpMode exit with ambiguous prefix (issue #2)', () => {
    // Problem: 4 + 30 + 10 = 44, prefix sums: [4, 34, 44]
    // Bug: typing "4" from helpMode should go to awaitingDisambiguation, not back to helpMode
    const ambiguousProblem = createTestProblem([4, 30, 10]) // answer: 44

    it('typing digit from helpMode goes to awaitingDisambiguation when prefix match is ambiguous', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(ambiguousProblem, 0, 0)
      })

      // Enter help mode explicitly (simulating timer expiration after first "4")
      act(() => {
        result.current.enterHelpMode(1)
      })
      expect(result.current.phase.phase).toBe('helpMode')

      // Type "4" to exit help mode - should go to awaitingDisambiguation, NOT helpMode
      // because "4" matches prefix sum [4] but could also be the first digit of [44]
      act(() => {
        result.current.handleDigit('4')
      })
      expect(result.current.phase.phase).toBe('awaitingDisambiguation')
      // NOT helpMode - this was the bug
      expect(result.current.phase.phase).not.toBe('helpMode')
    })

    it('typing second digit from awaitingDisambiguation completes the answer', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(ambiguousProblem, 0, 0)
      })

      // Enter help mode
      act(() => {
        result.current.enterHelpMode(1)
      })

      // Type "4" - goes to awaitingDisambiguation
      act(() => {
        result.current.handleDigit('4')
      })
      expect(result.current.phase.phase).toBe('awaitingDisambiguation')

      // Type second "4" - should complete the answer "44"
      act(() => {
        result.current.handleDigit('4')
      })
      expect(result.current.phase.phase).toBe('inputting')
      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.userAnswer).toBe('44')
      }
      // Should auto-submit since 44 === answer
      expect(result.current.shouldAutoSubmit).toBe(true)
    })
  })

  describe('enterHelpMode from helpMode', () => {
    it('allows navigating to a different term', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.enterHelpMode(1) // Enter help for term at index 1
      })

      expect(result.current.phase.phase).toBe('helpMode')
      if (result.current.phase.phase === 'helpMode') {
        expect(result.current.phase.helpContext.termIndex).toBe(1)
      }

      // Navigate to different term
      act(() => {
        result.current.enterHelpMode(2) // Switch to term at index 2
      })

      expect(result.current.phase.phase).toBe('helpMode')
      if (result.current.phase.phase === 'helpMode') {
        expect(result.current.phase.helpContext.termIndex).toBe(2)
        // Answer should be cleared when switching terms
        expect(result.current.phase.attempt.userAnswer).toBe('')
      }
    })
  })

  // ===========================================================================
  // Composition order (new in K5a-1)
  // ===========================================================================

  describe('composition order', () => {
    // The entry's effect (the disambiguation timer) runs before the
    // lifecycle's (the active problem), as when they were one hook: when both
    // act in one render, the problem change wins.
    it('a problem change wins over an overdue disambiguation in the same render', () => {
      const ambiguousProblem = createTestProblem([2, 1, 30]) // "3" is ambiguous
      const nextProblem = createTestProblem([5, 6])
      const shown: ActiveProblem = {
        problem: ambiguousProblem,
        slotIndex: 0,
        partIndex: 0,
        key: 'a',
      }
      const next: ActiveProblem = { problem: nextProblem, slotIndex: 1, partIndex: 0, key: 'b' }
      const { result, rerender } = renderHook(
        ({ activeProblem }) => useInteractionPhase({ activeProblem }),
        { initialProps: { activeProblem: shown } }
      )

      act(() => {
        result.current.loadProblem(ambiguousProblem, 0, 0)
      })
      act(() => {
        result.current.handleDigit('3')
      })
      expect(result.current.phase.phase).toBe('awaitingDisambiguation')

      // Paused past the help delay: on resume the timer is overdue
      act(() => {
        result.current.pause()
      })
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      act(() => {
        result.current.resume()
        rerender({ activeProblem: next })
      })

      expect(result.current.phase.phase).toBe('inputting')
      expect(result.current.attempt?.problem).toBe(nextProblem)
    })
  })
})
