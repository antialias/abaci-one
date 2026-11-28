/**
 * @vitest-environment jsdom
 *
 * The generic try lifecycle (practice-kinds plan §4 K5a-1): phases, pause
 * accounting, the hidden-time fold, the try id and the timing guard.
 *
 * Split from `useInteractionPhase.test.ts` with every case kept and its body
 * unchanged: the hook cases still render `useInteractionPhase`, the lifecycle
 * composed with arithmetic's digit entry, so they run exactly as they did.
 * The cases at the end are new: the lifecycle on its own with a kind that is
 * not arithmetic, and the timing guard.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GeneratedProblem } from '@/db/schema/session-plans'
import {
  type ActivePhase,
  createAttemptInput,
} from '@/lib/curriculum/parts/arithmetic/browser/useDigitEntry'
import { useInteractionPhase } from '@/test/arithmetic-interaction'
import {
  addPauseToActivePhase,
  foldHiddenSpanIntoActivePhase,
  getActivePhaseAttempt,
  startTryClock,
  type TryClock,
  type TryResult,
  tryResponseTime,
  useTryLifecycle,
  useTryPhaseState,
} from '../useTryLifecycle'

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
// Pure helpers: pause / hidden-span accounting (#156)
// =============================================================================

/** Build an inputting ActivePhase with a controlled attempt. */
function inputtingPhase(
  startTime: number,
  accPause = 0,
  accHidden = 0
): Extract<ActivePhase, { phase: 'inputting' }> {
  return {
    phase: 'inputting',
    attempt: {
      ...createAttemptInput(simpleProblem, 0, 0),
      startTime,
      accumulatedPauseMs: accPause,
      accumulatedHiddenMs: accHidden,
    },
  }
}

describe('addPauseToActivePhase', () => {
  it('adds pause time to accumulatedPauseMs only (hidden:false)', () => {
    const next = addPauseToActivePhase(inputtingPhase(1000, 500, 0), 2000, { hidden: false })
    const attempt = getActivePhaseAttempt(next)!
    expect(attempt.accumulatedPauseMs).toBe(2500)
    expect(attempt.accumulatedHiddenMs).toBe(0)
  })

  it('adds hidden time to both accumulatedPauseMs and accumulatedHiddenMs (hidden:true)', () => {
    const next = addPauseToActivePhase(inputtingPhase(1000, 500, 100), 2000, { hidden: true })
    const attempt = getActivePhaseAttempt(next)!
    expect(attempt.accumulatedPauseMs).toBe(2500)
    expect(attempt.accumulatedHiddenMs).toBe(2100)
  })

  it('is a no-op for a non-positive span (returns the same phase)', () => {
    const phase = inputtingPhase(1000, 500, 0)
    expect(addPauseToActivePhase(phase, 0, { hidden: true })).toBe(phase)
    expect(addPauseToActivePhase(phase, -50, { hidden: true })).toBe(phase)
  })

  it('is a no-op for phases without an attempt', () => {
    const loading: ActivePhase = { phase: 'loading' }
    const complete: ActivePhase = { phase: 'complete' }
    expect(addPauseToActivePhase(loading, 1000, { hidden: true })).toBe(loading)
    expect(addPauseToActivePhase(complete, 1000, { hidden: true })).toBe(complete)
  })

  it('folds into the incoming attempt for a transitioning phase', () => {
    const transitioning: ActivePhase = {
      phase: 'transitioning',
      outgoing: {
        key: '0-0',
        problem: simpleProblem,
        userAnswer: '12',
        result: 'correct',
        partIndex: 0,
      },
      incoming: {
        ...createAttemptInput(simpleProblem, 1, 0),
        startTime: 5000,
        accumulatedPauseMs: 0,
        accumulatedHiddenMs: 0,
      },
    }
    const next = addPauseToActivePhase(transitioning, 3000, { hidden: true })
    const attempt = getActivePhaseAttempt(next)!
    expect(attempt.accumulatedPauseMs).toBe(3000)
    expect(attempt.accumulatedHiddenMs).toBe(3000)
  })
})

describe('foldHiddenSpanIntoActivePhase', () => {
  it('folds the full span when hidden started after the attempt began', () => {
    // hiddenAt (2000) > startTime (1000): span = now(5000) - 2000 = 3000
    const next = foldHiddenSpanIntoActivePhase(inputtingPhase(1000), 2000, 5000)
    expect(getActivePhaseAttempt(next)!.accumulatedHiddenMs).toBe(3000)
  })

  it('clamps to the attempt lifetime when the span straddled a problem transition', () => {
    // A new attempt started at 4000 while the tab was already hidden (hiddenAt
    // 2000). Clamp to startTime: span = now(5000) - max(2000, 4000) = 1000,
    // never the full 3000 — so the new attempt can't go negative.
    const next = foldHiddenSpanIntoActivePhase(inputtingPhase(4000), 2000, 5000)
    expect(getActivePhaseAttempt(next)!.accumulatedHiddenMs).toBe(1000)
  })

  it('is a no-op for a phase without an attempt', () => {
    const loading: ActivePhase = { phase: 'loading' }
    expect(foldHiddenSpanIntoActivePhase(loading, 2000, 5000)).toBe(loading)
  })
})

describe('getActivePhaseAttempt', () => {
  it('returns the attempt for attempt-carrying phases and null otherwise', () => {
    expect(getActivePhaseAttempt(inputtingPhase(1000))).not.toBeNull()
    expect(getActivePhaseAttempt({ phase: 'loading' })).toBeNull()
    expect(getActivePhaseAttempt({ phase: 'complete' })).toBeNull()
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
        expect(result.current.phase.incoming.epochNumber).toBe(0)
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

    it('re-shows the active problem when its key is unchanged (resync after a failed write)', () => {
      const activeProblem = {
        problem: simpleProblem,
        slotIndex: 2,
        partIndex: 0,
        epochNumber: 1,
        key: 'normal-0-2-1',
      }
      const { result } = renderHook(() =>
        useInteractionPhase({ initialProblem: activeProblem, activeProblem })
      )
      act(() => {
        result.current.handleDigit('1')
      })
      expect(result.current.attempt?.userAnswer).toBe('1')

      act(() => {
        result.current.clearToLoading()
      })

      expect(result.current.phase.phase).toBe('inputting')
      expect(result.current.attempt?.problem).toBe(simpleProblem)
      expect(result.current.attempt?.userAnswer).toBe('')
      expect(result.current.attempt?.epochNumber).toBe(1)
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
  // Visibility layer (#156): hidden-time exclusion
  // ===========================================================================

  describe('visibility layer (hidden-time exclusion)', () => {
    const HOUR = 60 * 60 * 1000

    function setVisibilityState(state: 'hidden' | 'visible') {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
      })
    }
    function hide() {
      setVisibilityState('hidden')
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
    }
    function show() {
      setVisibilityState('visible')
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
    }

    afterEach(() => {
      setVisibilityState('visible')
    })

    it('folds an 8h hidden span into the current attempt (pause + hidden audit)', () => {
      vi.setSystemTime(1_000_000)
      const { result } = renderHook(() => useInteractionPhase())
      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      }) // startTime = 1_000_000

      vi.setSystemTime(1_005_000) // 5s of visible work
      hide() // arm at 1_005_000

      vi.setSystemTime(1_005_000 + 8 * HOUR)
      show() // fold [1_005_000, +8h]

      const attempt = result.current.attempt!
      expect(attempt.accumulatedHiddenMs).toBe(8 * HOUR)
      expect(attempt.accumulatedPauseMs).toBe(8 * HOUR)
    })

    it('folds only once for duplicate hidden signals (pagehide then visibilitychange)', () => {
      vi.setSystemTime(1_000_000)
      const { result } = renderHook(() => useInteractionPhase())
      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      vi.setSystemTime(1_002_000)
      // iOS Safari can emit pagehide before visibilitychange.
      act(() => {
        window.dispatchEvent(new Event('pagehide'))
      })
      hide() // second hidden signal — must NOT re-arm

      vi.setSystemTime(1_002_000 + 60_000)
      show()

      // Single span from the FIRST arm (1_002_000) → 60s, not doubled.
      expect(result.current.attempt!.accumulatedHiddenMs).toBe(60_000)
    })

    it('does not fold when the tab is hidden while already paused (pause clock owns it)', () => {
      vi.setSystemTime(1_000_000)
      const { result } = renderHook(() => useInteractionPhase())
      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.pause()
      }) // paused at 1_000_000
      hide() // arm() must early-return (phase paused)

      vi.setSystemTime(1_000_000 + 120_000)
      show() // fold() sees no armed ref → no-op (also visible before resume)

      act(() => {
        result.current.resume()
      }) // pause span folded (120s)

      const attempt = result.current.attempt!
      expect(attempt.accumulatedHiddenMs).toBe(0)
      expect(attempt.accumulatedPauseMs).toBe(120_000)
    })

    it('hands a hidden span off to the pause clock without double-counting (pause while hidden)', () => {
      vi.setSystemTime(1_000_000)
      const { result } = renderHook(() => useInteractionPhase())
      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      hide() // arm at 1_000_000

      vi.setSystemTime(1_010_000) // 10s hidden
      act(() => {
        result.current.pause() // folds hidden 10s, clears ref, pauseStartedAt=1_010_000
      })

      show() // visible while paused → fold no-op
      vi.setSystemTime(1_030_000) // 20s more (paused)
      act(() => {
        result.current.resume() // folds pause 20s
      })

      const attempt = result.current.attempt!
      expect(attempt.accumulatedHiddenMs).toBe(10_000)
      // 10s hidden + 20s pause — the hidden span is not double-counted.
      expect(attempt.accumulatedPauseMs).toBe(30_000)
    })

    it('re-arms on teacher remote-resume while still hidden (only post-resume hidden folded)', () => {
      vi.setSystemTime(1_000_000)
      const { result } = renderHook(() => useInteractionPhase())
      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      act(() => {
        result.current.pause() // manual pause at 1_000_000 (tab visible)
      })
      hide() // tab goes hidden while paused — arm() early-returns

      vi.setSystemTime(1_010_000) // 10s paused-while-hidden
      act(() => {
        result.current.resume() // stillHidden → folds pause 10s AND re-arms at 1_010_000
      })

      vi.setSystemTime(1_025_000) // 15s more hidden
      show() // fold [1_010_000, 1_025_000] = 15s

      const attempt = result.current.attempt!
      expect(attempt.accumulatedPauseMs).toBe(25_000) // 10s pause + 15s hidden
      expect(attempt.accumulatedHiddenMs).toBe(15_000) // only the post-resume hidden portion
    })

    it('accumulates across multiple hide/show cycles', () => {
      vi.setSystemTime(1_000_000)
      const { result } = renderHook(() => useInteractionPhase())
      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      hide()
      vi.setSystemTime(1_030_000) // +30s
      show()

      vi.setSystemTime(1_040_000) // 10s visible
      hide()
      vi.setSystemTime(1_060_000) // +20s
      show()

      expect(result.current.attempt!.accumulatedHiddenMs).toBe(50_000) // 30 + 20
    })

    it('clamps a span that straddles a problem load so the new attempt never goes negative', () => {
      vi.setSystemTime(1_000_000)
      const { result } = renderHook(() => useInteractionPhase())
      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })
      hide() // arm at 1_000_000

      vi.setSystemTime(1_050_000)
      act(() => {
        result.current.loadProblem(twoDigitProblem, 1, 0) // new attempt startTime=1_050_000
      })

      vi.setSystemTime(1_080_000)
      show() // clamp: 1_080_000 - max(1_000_000, 1_050_000) = 30s (not 80s)

      const attempt = result.current.attempt!
      expect(attempt.startTime).toBe(1_050_000)
      expect(attempt.accumulatedHiddenMs).toBe(30_000)
      const responseTimeMs = 1_080_000 - attempt.startTime - attempt.accumulatedPauseMs
      expect(responseTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('resets hidden accounting for a fresh attempt', () => {
      vi.setSystemTime(1_000_000)
      const { result } = renderHook(() => useInteractionPhase())
      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })
      hide()
      vi.setSystemTime(1_030_000)
      show()
      expect(result.current.attempt!.accumulatedHiddenMs).toBe(30_000)

      act(() => {
        result.current.loadProblem(twoDigitProblem, 1, 0)
      })
      expect(result.current.attempt!.accumulatedHiddenMs).toBe(0)
    })

    it('is a no-op when the tab becomes visible with no prior hidden span', () => {
      vi.setSystemTime(1_000_000)
      const { result } = renderHook(() => useInteractionPhase())
      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })
      show() // no arm before
      const attempt = result.current.attempt!
      expect(attempt.accumulatedHiddenMs).toBe(0)
      expect(attempt.accumulatedPauseMs).toBe(0)
    })

    it('removes all visibility listeners on unmount', () => {
      const removeDocSpy = vi.spyOn(document, 'removeEventListener')
      const removeWinSpy = vi.spyOn(window, 'removeEventListener')
      const { unmount } = renderHook(() => useInteractionPhase())
      act(() => {
        unmount()
      })
      expect(removeDocSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
      expect(removeWinSpy).toHaveBeenCalledWith('pagehide', expect.any(Function))
      expect(removeWinSpy).toHaveBeenCalledWith('pageshow', expect.any(Function))
      removeDocSpy.mockRestore()
      removeWinSpy.mockRestore()
    })
  })

  // ===========================================================================
  // Exported State Tests
  // ===========================================================================

  describe('exported state from hook', () => {
    it('exports attempt correctly', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('1')
      })

      expect(result.current.attempt).not.toBeNull()
      expect(result.current.attempt?.userAnswer).toBe('1')
      expect(result.current.attempt?.problem).toBe(simpleProblem)
    })

    it('exports outgoingAttempt during transition', () => {
      const { result } = renderHook(() => useInteractionPhase())
      const nextProblem = createTestProblem([5, 6])

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
        result.current.handleDigit('1')
        result.current.handleDigit('2')
        result.current.startSubmit()
        result.current.completeSubmit('correct')
        result.current.startTransition(nextProblem, 1)
      })

      expect(result.current.outgoingAttempt).not.toBeNull()
      expect(result.current.outgoingAttempt?.userAnswer).toBe('12')
      expect(result.current.outgoingAttempt?.result).toBe('correct')
    })

    it('exports null outgoingAttempt when not transitioning', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      expect(result.current.outgoingAttempt).toBeNull()
    })

    it('exports isTransitioning correctly', () => {
      const { result } = renderHook(() => useInteractionPhase())
      const nextProblem = createTestProblem([5, 6])

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      expect(result.current.isTransitioning).toBe(false)

      act(() => {
        result.current.handleDigit('1')
        result.current.handleDigit('2')
        result.current.startSubmit()
        result.current.completeSubmit('correct')
        result.current.startTransition(nextProblem, 1)
      })

      expect(result.current.isTransitioning).toBe(true)
    })

    it('exports isPaused correctly', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      expect(result.current.isPaused).toBe(false)

      act(() => {
        result.current.pause()
      })

      expect(result.current.isPaused).toBe(true)
    })

    it('exports isSubmitting correctly', () => {
      const { result } = renderHook(() => useInteractionPhase())

      act(() => {
        result.current.loadProblem(simpleProblem, 0, 0)
      })

      expect(result.current.isSubmitting).toBe(false)

      act(() => {
        result.current.startSubmit()
      })

      expect(result.current.isSubmitting).toBe(true)
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
})

// =============================================================================
// The lifecycle on its own, with a kind that is not arithmetic (new in K5a-1)
// =============================================================================

interface Card {
  id: string
}
interface CardAttempt extends TryClock {
  card: Card
}
interface CardOutgoing {
  id: string
  result: TryResult
}
/** The kind's own phase inside inputting */
type Peeking = { phase: 'peeking'; attempt: CardAttempt }

const cards = {
  attemptOf: (card: Card): CardAttempt => ({ card, ...startTryClock() }),
  outgoingOf: (attempt: CardAttempt, result: TryResult): CardOutgoing => ({
    id: attempt.card.id,
    result,
  }),
}

function useCards(initialCard?: Card, activeCard?: (Card & { key: string }) | null) {
  const state = useTryPhaseState<Card, CardAttempt, CardOutgoing, Peeking>(initialCard, cards)
  const lifecycle = useTryLifecycle(state, { activeItem: activeCard, kind: cards })
  return { ...lifecycle, setPhase: state[1] }
}

describe('useTryLifecycle with a kind of its own', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs a try from shown to the next item, minting a try id for each', () => {
    const { result } = renderHook(() => useCards({ id: 'a' }))
    expect(result.current.phase.phase).toBe('inputting')
    const first = result.current.attempt!
    expect(first.card.id).toBe('a')
    expect(first.tryId).toBeTruthy()

    act(() => {
      result.current.startSubmit()
    })
    expect(result.current.isSubmitting).toBe(true)
    act(() => {
      result.current.completeSubmit('incorrect')
    })
    expect(result.current.showFeedback).toBe(true)
    act(() => {
      result.current.startTransition(() => ({ id: 'b' }))
    })
    expect(result.current.outgoingAttempt).toEqual({ id: 'a', result: 'incorrect' })
    act(() => {
      result.current.completeTransition()
    })

    expect(result.current.phase.phase).toBe('inputting')
    expect(result.current.attempt!.card.id).toBe('b')
    expect(result.current.attempt!.tryId).not.toBe(first.tryId)
  })

  it("treats the kind's own phase as inputting: input, pause accounting, submit", () => {
    vi.setSystemTime(1000)
    const { result } = renderHook(() => useCards({ id: 'a' }))
    act(() => {
      result.current.setPhase((prev) =>
        prev.phase === 'inputting' ? { phase: 'peeking', attempt: prev.attempt } : prev
      )
    })
    expect(result.current.canAcceptInput).toBe(true)
    expect(result.current.inputIsFocused).toBe(true)
    expect(result.current.showInputArea).toBe(true)

    act(() => {
      result.current.pause()
    })
    expect(result.current.canAcceptInput).toBe(false)
    vi.setSystemTime(6000)
    act(() => {
      result.current.resume()
    })
    expect(result.current.phase.phase).toBe('peeking')
    expect(result.current.attempt!.accumulatedPauseMs).toBe(5000)

    act(() => {
      result.current.startSubmit()
    })
    expect(result.current.phase.phase).toBe('submitting')
    expect(result.current.attempt!.card.id).toBe('a')
  })

  it('loads the active item when its key changes', () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: Card & { key: string } }) => useCards(undefined, active),
      { initialProps: { active: { id: 'a', key: 'a' } } }
    )
    expect(result.current.phase.phase).toBe('loading')
    act(() => {
      result.current.load({ id: 'a' })
    })
    rerender({ active: { id: 'b', key: 'b' } })
    expect(result.current.phase.phase).toBe('inputting')
    expect(result.current.attempt!.card.id).toBe('b')
  })
})

describe('tryResponseTime (the capture-time timing guard)', () => {
  it('is the elapsed time less the pause and hidden time folded into the try', () => {
    expect(tryResponseTime({ startTime: 1000, accumulatedPauseMs: 2000 }, 60_000, 10_000)).toEqual({
      responseTimeMs: 7000,
    })
  })

  it('caps an idle span at the threshold and keeps the raw value', () => {
    expect(tryResponseTime({ startTime: 0, accumulatedPauseMs: 0 }, 30_000, 90_000)).toMatchObject({
      responseTimeMs: 30_000,
      responseTimeMsRaw: 90_000,
      wasIdleCapped: true,
      capSource: 'client',
    })
  })
})
