import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useMediaQuery, useIsMobile, useIsTablet, useIsDesktop } from '../useMediaQuery'

// ============================================================================
// Helpers
// ============================================================================

type MediaQueryChangeHandler = (event: { matches: boolean }) => void

function createMockMatchMedia(initialMatches: boolean) {
  let currentHandler: MediaQueryChangeHandler | null = null

  const mockMediaQuery = {
    matches: initialMatches,
    media: '',
    onchange: null,
    addEventListener: vi.fn((event: string, handler: MediaQueryChangeHandler) => {
      if (event === 'change') {
        currentHandler = handler
      }
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }

  const matchMediaFn = vi.fn().mockReturnValue(mockMediaQuery)

  return {
    matchMediaFn,
    mockMediaQuery,
    triggerChange: (matches: boolean) => {
      mockMediaQuery.matches = matches
      if (currentHandler) {
        currentHandler({ matches })
      }
    },
  }
}

// ============================================================================
// useMediaQuery
// ============================================================================

describe('useMediaQuery', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    })
  })

  it('reflects matchMedia result after client-side initialization', () => {
    const { matchMediaFn } = createMockMatchMedia(true)
    Object.defineProperty(window, 'matchMedia', {
      value: matchMediaFn,
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    // In jsdom, useEffect runs synchronously after renderHook,
    // so the hook has already set isClient=true and read matchMedia
    expect(result.current).toBe(true)
  })

  it('updates to true when media query matches after client-side init', async () => {
    const { matchMediaFn } = createMockMatchMedia(true)
    Object.defineProperty(window, 'matchMedia', {
      value: matchMediaFn,
      writable: true,
      configurable: true,
    })

    const { result, rerender } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    // Wait for the useEffect to set isClient and then match
    // Re-render to pick up state changes
    rerender()

    // After the two effects run, should reflect the actual match
    // The hook uses two effects: one for isClient, one for matchMedia
    await vi.waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('updates when media query match changes', async () => {
    const { matchMediaFn, triggerChange } = createMockMatchMedia(false)
    Object.defineProperty(window, 'matchMedia', {
      value: matchMediaFn,
      writable: true,
      configurable: true,
    })

    const { result, rerender } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    rerender()

    await vi.waitFor(() => {
      expect(result.current).toBe(false)
    })

    // Simulate media query change
    act(() => {
      triggerChange(true)
    })

    expect(result.current).toBe(true)
  })

  it('registers and removes event listener', async () => {
    const { matchMediaFn, mockMediaQuery } = createMockMatchMedia(false)
    Object.defineProperty(window, 'matchMedia', {
      value: matchMediaFn,
      writable: true,
      configurable: true,
    })

    const { unmount, rerender } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    rerender()

    await vi.waitFor(() => {
      expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })

    unmount()

    expect(mockMediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})

// ============================================================================
// Breakpoint hooks
// ============================================================================

describe('useIsMobile', () => {
  it('calls useMediaQuery with mobile breakpoint', () => {
    const { matchMediaFn } = createMockMatchMedia(true)
    Object.defineProperty(window, 'matchMedia', {
      value: matchMediaFn,
      writable: true,
      configurable: true,
    })

    renderHook(() => useIsMobile())

    // Verify matchMedia was called with the mobile query
    expect(matchMediaFn).toHaveBeenCalledWith('(max-width: 767px)')
  })
})

describe('useIsTablet', () => {
  it('calls useMediaQuery with tablet breakpoint', () => {
    const { matchMediaFn } = createMockMatchMedia(false)
    Object.defineProperty(window, 'matchMedia', {
      value: matchMediaFn,
      writable: true,
      configurable: true,
    })

    renderHook(() => useIsTablet())

    expect(matchMediaFn).toHaveBeenCalledWith('(min-width: 768px) and (max-width: 1023px)')
  })
})

describe('useIsDesktop', () => {
  it('calls useMediaQuery with desktop breakpoint', () => {
    const { matchMediaFn } = createMockMatchMedia(false)
    Object.defineProperty(window, 'matchMedia', {
      value: matchMediaFn,
      writable: true,
      configurable: true,
    })

    renderHook(() => useIsDesktop())

    expect(matchMediaFn).toHaveBeenCalledWith('(min-width: 1024px)')
  })
})
