import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useClipboard } from '../useClipboard'

describe('useClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    // Mock navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(''),
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with copied=false', () => {
    const { result } = renderHook(() => useClipboard())
    expect(result.current.copied).toBe(false)
  })

  it('sets copied=true after successful copy', async () => {
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy('hello')
    })

    expect(result.current.copied).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello')
  })

  it('resets copied state after default timeout (1500ms)', async () => {
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy('hello')
    })

    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(result.current.copied).toBe(false)
  })

  it('uses custom timeout', async () => {
    const { result } = renderHook(() => useClipboard({ timeout: 3000 }))

    await act(async () => {
      await result.current.copy('hello')
    })

    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    // Still true after default time
    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    // Now false after custom timeout
    expect(result.current.copied).toBe(false)
  })

  it('reset() manually clears copied state', async () => {
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy('hello')
    })

    expect(result.current.copied).toBe(true)

    act(() => {
      result.current.reset()
    })

    expect(result.current.copied).toBe(false)
  })

  it('handles clipboard API failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Clipboard not available')
    )

    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy('hello')
    })

    // copied should remain false on error
    expect(result.current.copied).toBe(false)
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('can copy different texts', async () => {
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy('first')
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('first')

    // Reset and copy again
    act(() => {
      result.current.reset()
    })

    await act(async () => {
      await result.current.copy('second')
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('second')
  })
})
