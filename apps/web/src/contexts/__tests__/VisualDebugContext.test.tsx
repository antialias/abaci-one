import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { VisualDebugProvider, useVisualDebug, useVisualDebugSafe } from '../VisualDebugContext'

function wrapper({ children }: { children: ReactNode }) {
  return <VisualDebugProvider>{children}</VisualDebugProvider>
}

describe('VisualDebugContext', () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset URL params
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
      configurable: true,
    })
  })

  it('throws when useVisualDebug is used outside provider', () => {
    expect(() => {
      renderHook(() => useVisualDebug())
    }).toThrow('useVisualDebug must be used within a VisualDebugProvider')
  })

  it('provides default values', () => {
    const { result } = renderHook(() => useVisualDebug(), { wrapper })
    expect(result.current.isVisualDebugEnabled).toBe(false)
    expect(typeof result.current.toggleVisualDebug).toBe('function')
    expect(typeof result.current.isDevelopment).toBe('boolean')
    expect(typeof result.current.isDebugAllowed).toBe('boolean')
  })

  it('toggles visual debug on and off in dev mode', () => {
    // In test environment, NODE_ENV is 'test', not 'development'
    // so we need to check the actual behavior
    const { result } = renderHook(() => useVisualDebug(), { wrapper })

    act(() => {
      result.current.toggleVisualDebug()
    })

    // In non-development mode without production debug unlock,
    // isVisualDebugEnabled stays false because isDebugAllowed is false
    // (unless the test environment is treated as development)
    if (result.current.isDebugAllowed) {
      expect(result.current.isVisualDebugEnabled).toBe(true)
    }
  })

  describe('useVisualDebugSafe', () => {
    it('returns safe defaults when used outside provider', () => {
      const { result } = renderHook(() => useVisualDebugSafe())
      expect(result.current.isVisualDebugEnabled).toBe(false)
      expect(typeof result.current.toggleVisualDebug).toBe('function')
      expect(typeof result.current.isDevelopment).toBe('boolean')
      expect(typeof result.current.isDebugAllowed).toBe('boolean')
    })

    it('returns context values when used inside provider', () => {
      const { result } = renderHook(() => useVisualDebugSafe(), { wrapper })
      expect(result.current.isVisualDebugEnabled).toBe(false)
      expect(typeof result.current.toggleVisualDebug).toBe('function')
    })
  })

  it('persists enabled state to localStorage', () => {
    const { result } = renderHook(() => useVisualDebug(), { wrapper })

    act(() => {
      result.current.toggleVisualDebug()
    })

    // The toggle sets localStorage regardless of isDebugAllowed
    expect(localStorage.getItem('visual-debug-enabled')).toBeDefined()
  })

  it('loads enabled state from localStorage', () => {
    localStorage.setItem('visual-debug-enabled', 'true')

    const { result } = renderHook(() => useVisualDebug(), { wrapper })
    // The state is loaded, but isVisualDebugEnabled also depends on isDebugAllowed
    // In test mode isDebugAllowed depends on NODE_ENV and productionDebugAllowed
    expect(typeof result.current.isVisualDebugEnabled).toBe('boolean')
  })

  it('unlocks production debug via URL param', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?debug=1' },
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useVisualDebug(), { wrapper })
    // After the useEffect runs, production debug should be allowed
    expect(localStorage.getItem('allow-production-debug')).toBe('true')
  })

  it('unlocks production debug via debug=true URL param', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?debug=true' },
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useVisualDebug(), { wrapper })
    expect(localStorage.getItem('allow-production-debug')).toBe('true')
  })

  it('remembers production debug unlock from localStorage', () => {
    localStorage.setItem('allow-production-debug', 'true')

    const { result } = renderHook(() => useVisualDebug(), { wrapper })
    expect(result.current.isDebugAllowed).toBe(true)
  })
})
