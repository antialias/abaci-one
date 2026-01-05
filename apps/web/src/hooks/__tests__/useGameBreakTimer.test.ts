import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useGameBreakTimer } from '../useGameBreakTimer'

describe('useGameBreakTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize with inactive state', () => {
    const onTimeout = vi.fn()
    const { result } = renderHook(() =>
      useGameBreakTimer({
        maxDurationMinutes: 5,
        onTimeout,
      })
    )

    expect(result.current.isActive).toBe(false)
    expect(result.current.startTime).toBeNull()
    expect(result.current.elapsedMs).toBe(0)
    expect(result.current.remainingMs).toBe(5 * 60 * 1000)
    expect(result.current.remainingMinutes).toBe(5)
    expect(result.current.remainingSeconds).toBe(0)
    expect(result.current.percentRemaining).toBe(100)
  })

  it('should start timer when start() is called', () => {
    const onTimeout = vi.fn()
    const { result } = renderHook(() =>
      useGameBreakTimer({
        maxDurationMinutes: 5,
        onTimeout,
      })
    )

    act(() => {
      result.current.start()
    })

    expect(result.current.isActive).toBe(true)
    expect(result.current.startTime).not.toBeNull()
  })

  it('should not start when disabled', () => {
    const onTimeout = vi.fn()
    const { result } = renderHook(() =>
      useGameBreakTimer({
        maxDurationMinutes: 5,
        onTimeout,
        enabled: false,
      })
    )

    act(() => {
      result.current.start()
    })

    expect(result.current.isActive).toBe(false)
    expect(result.current.startTime).toBeNull()
  })

  it('should stop timer when stop() is called', () => {
    const onTimeout = vi.fn()
    const { result } = renderHook(() =>
      useGameBreakTimer({
        maxDurationMinutes: 5,
        onTimeout,
      })
    )

    act(() => {
      result.current.start()
    })

    expect(result.current.isActive).toBe(true)

    act(() => {
      result.current.stop()
    })

    expect(result.current.isActive).toBe(false)
    expect(result.current.startTime).toBeNull()
  })

  it('should reset timer when reset() is called', () => {
    const onTimeout = vi.fn()
    const { result } = renderHook(() =>
      useGameBreakTimer({
        maxDurationMinutes: 5,
        onTimeout,
      })
    )

    act(() => {
      result.current.start()
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.isActive).toBe(false)
    expect(result.current.startTime).toBeNull()
    expect(result.current.elapsedMs).toBe(0)
  })

  it('should calculate remaining time correctly', () => {
    const onTimeout = vi.fn()
    const { result } = renderHook(() =>
      useGameBreakTimer({
        maxDurationMinutes: 2,
        onTimeout,
      })
    )

    // Max duration: 2 minutes = 120,000 ms
    expect(result.current.remainingMs).toBe(120_000)
    expect(result.current.remainingMinutes).toBe(2)
    expect(result.current.remainingSeconds).toBe(0)
    expect(result.current.percentRemaining).toBe(100)
  })

  it('should calculate percent remaining correctly for different durations', () => {
    const onTimeout = vi.fn()

    // Test with 10 minute duration
    const { result: result10 } = renderHook(() =>
      useGameBreakTimer({
        maxDurationMinutes: 10,
        onTimeout,
      })
    )
    expect(result10.current.remainingMs).toBe(600_000)
    expect(result10.current.percentRemaining).toBe(100)

    // Test with 3 minute duration
    const { result: result3 } = renderHook(() =>
      useGameBreakTimer({
        maxDurationMinutes: 3,
        onTimeout,
      })
    )
    expect(result3.current.remainingMs).toBe(180_000)
    expect(result3.current.percentRemaining).toBe(100)
  })

  it('should handle zero duration edge case', () => {
    const onTimeout = vi.fn()
    const { result } = renderHook(() =>
      useGameBreakTimer({
        maxDurationMinutes: 0,
        onTimeout,
      })
    )

    expect(result.current.remainingMs).toBe(0)
    expect(result.current.percentRemaining).toBe(100) // Division by zero guard
  })

  it('should default enabled to true', () => {
    const onTimeout = vi.fn()
    const { result } = renderHook(() =>
      useGameBreakTimer({
        maxDurationMinutes: 5,
        onTimeout,
        // Not passing enabled - should default to true
      })
    )

    act(() => {
      result.current.start()
    })

    expect(result.current.isActive).toBe(true)
  })
})
