/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GeneratedProblem } from '@/db/schema/session-plans'
import {
  computeHelpContext,
  computePrefixSums,
  createAttemptInput,
  findMatchedPrefixIndex,
  isDigitConsistent,
  MANUAL_SUBMIT_THRESHOLD,
  useInteractionPhase,
} from '../useInteractionPhase'

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
})

describe('findMatchedPrefixIndex', () => {
  const sums = [3, 7, 12]

  it('finds exact match', () => {
    expect(findMatchedPrefixIndex('3', sums)).toBe(0)
    expect(findMatchedPrefixIndex('7', sums)).toBe(1)
    expect(findMatchedPrefixIndex('12', sums)).toBe(2)
  })

  it('returns -1 for no match', () => {
    expect(findMatchedPrefixIndex('5', sums)).toBe(-1)
    expect(findMatchedPrefixIndex('', sums)).toBe(-1)
  })

  it('returns -1 for non-numeric', () => {
    expect(findMatchedPrefixIndex('abc', sums)).toBe(-1)
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
})

// =============================================================================
// Hook Tests: Initial State
// =============================================================================

describe('useInteractionPhase', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('starts in loading phase', () => {
      const { result } = renderHook(() => useInteractionPhase())
      expect(result.current.phase).toEqual({ phase: 'loading' })
    })

    it('has correct UI predicates in loading phase', () => {
      const { result } = renderHook(() => useInteractionPhase())
      expect(result.current.canAcceptInput).toBe(false)
      expect(result.current.showAsCompleted).toBe(false)
      expect(result.current.showHelpOverlay).toBe(false)
      expect(result.current.showInputArea).toBe(false)
      expect(result.current.showFeedback).toBe(false)
      expect(result.current.inputIsFocused).toBe(false)
    })

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
    it('transitions to inputting phase', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      expect(result.current.phase.phase).toBe('inputting')
      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.problem).toBe(simpleProblem)
        expect(result.current.phase.attempt.slotIndex).toBe(0)
        expect(result.current.phase.attempt.partIndex).toBe(0)
      }
    })

    it('sets correct UI predicates in inputting phase', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      expect(result.current.canAcceptInput).toBe(true)
      expect(result.current.showAsCompleted).toBe(false)
      expect(result.current.showHelpOverlay).toBe(false)
      expect(result.current.showInputArea).toBe(true)
      expect(result.current.showFeedback).toBe(false)
      expect(result.current.inputIsFocused).toBe(true)
    })

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

    it('does nothing in non-input phases', () => {
      const { result } = renderHook(() => useInteractionPhase())

      // In loading phase
      act(() => {
        result.current.handleDigit('1')
      })

      expect(result.current.phase.phase).toBe('loading')
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

  describe('startSubmit: inputting → submitting', () => {
    it('transitions to submitting phase', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.handleDigit('1')
        result.current.handleDigit('2')
      })

      act(() => {
        result.current.startSubmit()
      })

      expect(result.current.phase.phase).toBe('submitting')
    })

    it('preserves attempt state', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.handleDigit('1')
        result.current.handleDigit('2')
      })

      act(() => {
        result.current.startSubmit()
      })

      if (result.current.phase.phase === 'submitting') {
        expect(result.current.phase.attempt.userAnswer).toBe('12')
      }
    })

    it('sets showInputArea true but canAcceptInput false', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.startSubmit()
      })

      expect(result.current.showInputArea).toBe(true)
      expect(result.current.canAcceptInput).toBe(false)
    })
  })

  describe('completeSubmit: submitting → showingFeedback', () => {
    it('transitions to showingFeedback with correct result', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.handleDigit('1')
        result.current.handleDigit('2')
      })

      act(() => {
        result.current.startSubmit()
      })

      act(() => {
        result.current.completeSubmit('correct')
      })

      expect(result.current.phase.phase).toBe('showingFeedback')
      if (result.current.phase.phase === 'showingFeedback') {
        expect(result.current.phase.result).toBe('correct')
      }
    })

    it('sets showAsCompleted true for correct', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.startSubmit()
        result.current.completeSubmit('correct')
      })

      expect(result.current.showAsCompleted).toBe(true)
    })

    it('sets showFeedback true for incorrect', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.startSubmit()
        result.current.completeSubmit('incorrect')
      })

      expect(result.current.showFeedback).toBe(true)
    })

    it('sets showFeedback false for correct', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.startSubmit()
        result.current.completeSubmit('correct')
      })

      expect(result.current.showFeedback).toBe(false)
    })
  })

  describe('startTransition: showingFeedback → transitioning', () => {
    it('transitions with outgoing and incoming attempts', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('1')
        result.current.handleDigit('2')
        result.current.startSubmit()
        result.current.completeSubmit('correct')
      })

      const nextProblem = createTestProblem([5, 6])

      act(() => {
        result.current.startTransition(nextProblem, 1)
      })

      expect(result.current.phase.phase).toBe('transitioning')
      if (result.current.phase.phase === 'transitioning') {
        expect(result.current.phase.outgoing.userAnswer).toBe('12')
        expect(result.current.phase.outgoing.result).toBe('correct')
        expect(result.current.phase.incoming.problem).toBe(nextProblem)
        expect(result.current.phase.incoming.slotIndex).toBe(1)
      }
    })

    it('does nothing if not in showingFeedback', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      const nextProblem = createTestProblem([5, 6])

      act(() => {
        result.current.startTransition(nextProblem, 1)
      })

      expect(result.current.phase.phase).toBe('inputting')
    })
  })

  describe('completeTransition: transitioning → inputting', () => {
    it('transitions to inputting with incoming attempt', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('1')
        result.current.handleDigit('2')
        result.current.startSubmit()
        result.current.completeSubmit('correct')
      })

      const nextProblem = createTestProblem([5, 6])

      act(() => {
        result.current.startTransition(nextProblem, 1)
      })

      act(() => {
        result.current.completeTransition()
      })

      expect(result.current.phase.phase).toBe('inputting')
      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.problem).toBe(nextProblem)
        expect(result.current.phase.attempt.slotIndex).toBe(1)
      }
    })
  })

  describe('clearToLoading', () => {
    it('returns to loading phase from any phase', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.clearToLoading()
      })

      expect(result.current.phase.phase).toBe('loading')
    })
  })

  describe('pause/resume', () => {
    it('pauses and stores resume phase', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.pause()
      })

      expect(result.current.phase.phase).toBe('paused')
      if (result.current.phase.phase === 'paused') {
        expect(result.current.phase.resumePhase.phase).toBe('inputting')
      }
    })

    it('resumes to previous phase', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('1')
      })

      act(() => {
        result.current.pause()
      })

      act(() => {
        result.current.resume()
      })

      expect(result.current.phase.phase).toBe('inputting')
      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.userAnswer).toBe('1')
      }
    })

    it('does nothing when pausing from loading', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.pause()
      })

      expect(result.current.phase.phase).toBe('loading')
    })

    it('does nothing when already paused', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.pause()
      })

      const pausedPhase = result.current.phase

      act(() => {
        result.current.pause()
      })

      expect(result.current.phase).toEqual(pausedPhase)
    })

    it('can pause from helpMode', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.enterHelpMode(1)
      })

      act(() => {
        result.current.pause()
      })

      expect(result.current.phase.phase).toBe('paused')
      if (result.current.phase.phase === 'paused') {
        expect(result.current.phase.resumePhase.phase).toBe('helpMode')
      }
    })

    it('can pause from submitting', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.startSubmit()
      })

      act(() => {
        result.current.pause()
      })

      expect(result.current.phase.phase).toBe('paused')
      if (result.current.phase.phase === 'paused') {
        expect(result.current.phase.resumePhase.phase).toBe('submitting')
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
    it('returns index when answer matches prefix sum', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('3')
      })

      expect(result.current.matchedPrefixIndex).toBe(0)
    })

    it('returns -1 when no match', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('1')
      })

      expect(result.current.matchedPrefixIndex).toBe(-1)
    })
  })

  // ===========================================================================
  // Full Flow Tests
  // ===========================================================================

  describe('full correct answer flow', () => {
    it('loading → inputting → submitting → showingFeedback → transitioning → inputting', () => {
      const { result } = renderHook(() => useInteractionPhase())

      // Start
      expect(result.current.phase.phase).toBe('loading')

      // Load problem
      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })
      expect(result.current.phase.phase).toBe('inputting')

      // Enter answer
      act(() => {
        result.current.handleDigit('1')
        result.current.handleDigit('2')
      })

      // Submit
      act(() => {
        result.current.startSubmit()
      })
      expect(result.current.phase.phase).toBe('submitting')

      // Complete submit
      act(() => {
        result.current.completeSubmit('correct')
      })
      expect(result.current.phase.phase).toBe('showingFeedback')
      expect(result.current.showAsCompleted).toBe(true)

      // Start transition
      const nextProblem = createTestProblem([5, 6])
      act(() => {
        result.current.startTransition(nextProblem, 1)
      })
      expect(result.current.phase.phase).toBe('transitioning')

      // Complete transition
      act(() => {
        result.current.completeTransition()
      })
      expect(result.current.phase.phase).toBe('inputting')
      if (result.current.phase.phase === 'inputting') {
        expect(result.current.phase.attempt.problem).toBe(nextProblem)
      }
    })
  })

  describe('help mode flow', () => {
    it('inputting → helpMode → inputting → submitting', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      // Enter prefix sum that triggers help
      act(() => {
        result.current.handleDigit('3')
      })
      expect(result.current.matchedPrefixIndex).toBe(0)

      // Enter help mode
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
  // Complete phase
  // ===========================================================================

  describe('markComplete', () => {
    it('transitions to complete phase', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.markComplete()
      })

      expect(result.current.phase.phase).toBe('complete')
      expect(result.current.isComplete).toBe(true)
    })

    it('cannot pause from complete phase', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.markComplete()
      })

      act(() => {
        result.current.pause()
      })

      expect(result.current.phase.phase).toBe('complete')
    })
  })

  // ===========================================================================
  // Paused phase transitions
  // ===========================================================================

  describe('completeSubmit while paused', () => {
    it('updates resumePhase from submitting to showingFeedback', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.startSubmit()
      })

      act(() => {
        result.current.pause()
      })

      expect(result.current.phase.phase).toBe('paused')

      // Complete submit while paused
      act(() => {
        result.current.completeSubmit('correct')
      })

      // Should still be paused but resumePhase updated
      expect(result.current.phase.phase).toBe('paused')
      if (result.current.phase.phase === 'paused') {
        expect(result.current.phase.resumePhase.phase).toBe('showingFeedback')
        if (result.current.phase.resumePhase.phase === 'showingFeedback') {
          expect(result.current.phase.resumePhase.result).toBe('correct')
        }
      }
    })
  })

  describe('completeTransition while paused', () => {
    it('updates resumePhase from transitioning to inputting', () => {
      const { result } = renderHook(() => useInteractionPhase())
      const nextProblem = createTestProblem([7, 8])

      // Get to transitioning phase
      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('1')
        result.current.handleDigit('2')
        result.current.startSubmit()
      })

      act(() => {
        result.current.completeSubmit('correct')
      })

      act(() => {
        result.current.startTransition(nextProblem, 1)
      })

      // Now pause during transition
      act(() => {
        result.current.pause()
      })

      expect(result.current.phase.phase).toBe('paused')
      if (result.current.phase.phase === 'paused') {
        expect(result.current.phase.resumePhase.phase).toBe('transitioning')
      }

      // Complete transition while paused
      act(() => {
        result.current.completeTransition()
      })

      // Should still be paused but resumePhase updated
      expect(result.current.phase.phase).toBe('paused')
      if (result.current.phase.phase === 'paused') {
        expect(result.current.phase.resumePhase.phase).toBe('inputting')
      }
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
})
