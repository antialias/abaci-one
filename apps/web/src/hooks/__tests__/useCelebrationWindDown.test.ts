import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useCelebrationWindDown } from '../useCelebrationWindDown'

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  vi.useFakeTimers()
  // Clear localStorage between tests
  localStorage.clear()
  // Mock requestAnimationFrame
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    return setTimeout(() => cb(Date.now()), 16) as unknown as number
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    clearTimeout(id)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ============================================================================
// Tests
// ============================================================================

describe('useCelebrationWindDown', () => {
  it('returns progress=1 when disabled', () => {
    const { result } = renderHook(() =>
      useCelebrationWindDown({
        skillId: 'skill-1',
        tutorialRequired: true,
        enabled: false,
      })
    )

    expect(result.current.progress).toBe(1)
    expect(result.current.isCelebrating).toBe(false)
    expect(result.current.shouldFireConfetti).toBe(false)
  })

  it('returns progress=1 when tutorialRequired is false', () => {
    const { result } = renderHook(() =>
      useCelebrationWindDown({
        skillId: 'skill-1',
        tutorialRequired: false,
        enabled: true,
      })
    )

    expect(result.current.progress).toBe(1)
    expect(result.current.isCelebrating).toBe(false)
  })

  it('returns progress=1 when skillId is empty', () => {
    const { result } = renderHook(() =>
      useCelebrationWindDown({
        skillId: '',
        tutorialRequired: true,
        enabled: true,
      })
    )

    expect(result.current.progress).toBe(1)
    expect(result.current.isCelebrating).toBe(false)
  })

  it('starts celebration for new skill unlock', () => {
    const { result } = renderHook(() =>
      useCelebrationWindDown({
        skillId: 'skill-1',
        tutorialRequired: true,
        enabled: true,
      })
    )

    // After the effect runs, celebration should start
    act(() => {
      vi.advanceTimersByTime(16) // One frame
    })

    expect(result.current.isCelebrating).toBe(true)
    expect(result.current.shouldFireConfetti).toBe(true)
    // Progress should be 0 at the beginning (full celebration)
    expect(result.current.progress).toBe(0)
  })

  it('stores celebration state in localStorage', () => {
    renderHook(() =>
      useCelebrationWindDown({
        skillId: 'skill-1',
        tutorialRequired: true,
        enabled: true,
      })
    )

    const stored = localStorage.getItem('skill-celebration-state')
    expect(stored).not.toBeNull()

    const parsed = JSON.parse(stored!)
    expect(parsed.skillId).toBe('skill-1')
    expect(parsed.confettiFired).toBe(false)
    expect(parsed.startedAt).toBeDefined()
  })

  it('onConfettiFired marks confetti as fired in localStorage', () => {
    const { result } = renderHook(() =>
      useCelebrationWindDown({
        skillId: 'skill-1',
        tutorialRequired: true,
        enabled: true,
      })
    )

    act(() => {
      result.current.onConfettiFired()
    })

    expect(result.current.shouldFireConfetti).toBe(false)

    const stored = localStorage.getItem('skill-celebration-state')
    const parsed = JSON.parse(stored!)
    expect(parsed.confettiFired).toBe(true)
  })

  it('uses forceProgress when provided (for Storybook)', () => {
    const { result } = renderHook(() =>
      useCelebrationWindDown({
        skillId: 'skill-1',
        tutorialRequired: true,
        enabled: true,
        forceProgress: 0.5,
      })
    )

    expect(result.current.progress).toBe(0.5)
    expect(result.current.isCelebrating).toBe(true)
  })

  it('forceProgress=1 means not celebrating', () => {
    const { result } = renderHook(() =>
      useCelebrationWindDown({
        skillId: 'skill-1',
        tutorialRequired: true,
        enabled: true,
        forceProgress: 1,
      })
    )

    expect(result.current.progress).toBe(1)
    expect(result.current.isCelebrating).toBe(false)
  })

  it('forceProgress=0 means fully celebrating', () => {
    const { result } = renderHook(() =>
      useCelebrationWindDown({
        skillId: 'skill-1',
        tutorialRequired: true,
        enabled: true,
        forceProgress: 0,
      })
    )

    expect(result.current.progress).toBe(0)
    expect(result.current.isCelebrating).toBe(true)
  })

  it('resumes existing celebration on re-mount', () => {
    // Set up existing celebration state
    const startedAt = Date.now() - 10_000 // 10 seconds ago
    localStorage.setItem(
      'skill-celebration-state',
      JSON.stringify({
        skillId: 'skill-1',
        startedAt,
        confettiFired: true,
      })
    )

    const { result } = renderHook(() =>
      useCelebrationWindDown({
        skillId: 'skill-1',
        tutorialRequired: true,
        enabled: true,
      })
    )

    // Should be celebrating but confetti already fired
    // Progress should be > 0 since 10 seconds have passed (but within burst duration of 5s)
    // After 10s: burst is 5s, so 5s into wind-down out of 55s total
    act(() => {
      vi.advanceTimersByTime(16)
    })

    expect(result.current.isCelebrating).toBe(true)
    expect(result.current.shouldFireConfetti).toBe(false) // already fired
  })

  it('does not re-fire confetti for existing celebration', () => {
    localStorage.setItem(
      'skill-celebration-state',
      JSON.stringify({
        skillId: 'skill-1',
        startedAt: Date.now() - 3000,
        confettiFired: true,
      })
    )

    const { result } = renderHook(() =>
      useCelebrationWindDown({
        skillId: 'skill-1',
        tutorialRequired: true,
        enabled: true,
      })
    )

    expect(result.current.shouldFireConfetti).toBe(false)
  })

  it('starts new celebration when skillId changes', () => {
    // Existing celebration for skill-1
    localStorage.setItem(
      'skill-celebration-state',
      JSON.stringify({
        skillId: 'skill-1',
        startedAt: Date.now() - 60000,
        confettiFired: true,
      })
    )

    // Mount with skill-2 (different skill)
    const { result } = renderHook(() =>
      useCelebrationWindDown({
        skillId: 'skill-2',
        tutorialRequired: true,
        enabled: true,
      })
    )

    act(() => {
      vi.advanceTimersByTime(16)
    })

    // Should start fresh celebration for skill-2
    expect(result.current.isCelebrating).toBe(true)
    expect(result.current.shouldFireConfetti).toBe(true)

    const stored = JSON.parse(localStorage.getItem('skill-celebration-state')!)
    expect(stored.skillId).toBe('skill-2')
  })

  it('provides oscillation value', () => {
    const { result } = renderHook(() =>
      useCelebrationWindDown({
        skillId: 'skill-1',
        tutorialRequired: true,
        enabled: true,
        forceProgress: 0.5,
      })
    )

    // oscillation is a number between -1 and 1
    act(() => {
      vi.advanceTimersByTime(16)
    })
    expect(typeof result.current.oscillation).toBe('number')
    expect(result.current.oscillation).toBeGreaterThanOrEqual(-1)
    expect(result.current.oscillation).toBeLessThanOrEqual(1)
  })

  it('cleans up requestAnimationFrame on unmount', () => {
    const { unmount } = renderHook(() =>
      useCelebrationWindDown({
        skillId: 'skill-1',
        tutorialRequired: true,
        enabled: true,
      })
    )

    unmount()

    // cancelAnimationFrame should have been called
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })
})
