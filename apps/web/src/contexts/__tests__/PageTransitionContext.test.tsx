import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'

// Mock next/navigation
const mockPush = vi.fn()
const mockPrefetch = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: mockPrefetch,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/practice/student-1/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

import {
  PageTransitionProvider,
  usePageTransition,
  useIncomingTransition,
} from '../PageTransitionContext'

function wrapper({ children }: { children: ReactNode }) {
  return <PageTransitionProvider>{children}</PageTransitionProvider>
}

describe('PageTransitionContext', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockPush.mockClear()
    mockPrefetch.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws when usePageTransition is used outside provider', () => {
    expect(() => {
      renderHook(() => usePageTransition())
    }).toThrow('usePageTransition must be used within a PageTransitionProvider')
  })

  it('provides default state with no transition', () => {
    const { result } = renderHook(() => usePageTransition(), { wrapper })
    expect(result.current.transitionState).toBeNull()
    expect(result.current.isTransitioning).toBe(false)
    expect(result.current.isRevealing).toBe(false)
  })

  it('provides all required functions', () => {
    const { result } = renderHook(() => usePageTransition(), { wrapper })
    expect(typeof result.current.startTransition).toBe('function')
    expect(typeof result.current.signalReady).toBe('function')
    expect(typeof result.current.clearTransition).toBe('function')
  })

  it('starts a transition', () => {
    const { result } = renderHook(() => usePageTransition(), { wrapper })

    act(() => {
      result.current.startTransition({
        studentId: 'student-1',
        studentName: 'Alice',
        studentEmoji: '🎵',
        studentColor: '#3b82f6',
        originBounds: { left: 100, top: 200, width: 300, height: 400 },
      })
    })

    expect(result.current.isTransitioning).toBe(true)
    expect(result.current.transitionState).not.toBeNull()
    expect(result.current.transitionState!.studentId).toBe('student-1')
    expect(result.current.transitionState!.studentName).toBe('Alice')
    expect(result.current.transitionState!.type).toBe('quicklook-to-dashboard')
  })

  it('stores transition state in sessionStorage', () => {
    const { result } = renderHook(() => usePageTransition(), { wrapper })

    act(() => {
      result.current.startTransition({
        studentId: 'student-1',
        studentName: 'Alice',
        studentEmoji: '🎵',
        studentColor: '#3b82f6',
        originBounds: { left: 0, top: 0, width: 100, height: 100 },
      })
    })

    const stored = sessionStorage.getItem('page-transition-state')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.studentId).toBe('student-1')
  })

  it('prefetches destination route on startTransition', () => {
    const { result } = renderHook(() => usePageTransition(), { wrapper })

    act(() => {
      result.current.startTransition({
        studentId: 'student-1',
        studentName: 'Alice',
        studentEmoji: '🎵',
        studentColor: '#3b82f6',
        originBounds: { left: 0, top: 0, width: 100, height: 100 },
      })
    })

    expect(mockPrefetch).toHaveBeenCalledWith('/practice/student-1/dashboard')
  })

  it('navigates after delay on startTransition', () => {
    const { result } = renderHook(() => usePageTransition(), { wrapper })

    act(() => {
      result.current.startTransition({
        studentId: 'student-2',
        studentName: 'Bob',
        studentEmoji: '🚀',
        studentColor: '#10b981',
        originBounds: { left: 0, top: 0, width: 100, height: 100 },
      })
    })

    // Before timeout, navigation shouldn't have happened
    expect(mockPush).not.toHaveBeenCalled()

    // After 250ms timeout
    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(mockPush).toHaveBeenCalledWith('/practice/student-2/dashboard')
  })

  it('clears transition state', () => {
    const { result } = renderHook(() => usePageTransition(), { wrapper })

    act(() => {
      result.current.startTransition({
        studentId: 'student-1',
        studentName: 'Alice',
        studentEmoji: '🎵',
        studentColor: '#3b82f6',
        originBounds: { left: 0, top: 0, width: 100, height: 100 },
      })
    })

    expect(result.current.isTransitioning).toBe(true)

    act(() => {
      result.current.clearTransition()
    })

    expect(result.current.isTransitioning).toBe(false)
    expect(result.current.transitionState).toBeNull()
  })

  it('signals ready and cleans up after delay', () => {
    const { result } = renderHook(() => usePageTransition(), { wrapper })

    act(() => {
      result.current.startTransition({
        studentId: 'student-1',
        studentName: 'Alice',
        studentEmoji: '🎵',
        studentColor: '#3b82f6',
        originBounds: { left: 0, top: 0, width: 100, height: 100 },
      })
    })

    act(() => {
      result.current.signalReady()
    })

    expect(result.current.isRevealing).toBe(true)

    // After 300ms cleanup
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isTransitioning).toBe(false)
    expect(result.current.transitionState).toBeNull()
  })

  describe('useIncomingTransition', () => {
    it('reports no transition by default', () => {
      const { result } = renderHook(() => useIncomingTransition(), { wrapper })
      expect(result.current.hasTransition).toBe(false)
      expect(result.current.isRevealing).toBe(false)
      expect(result.current.transitionState).toBeNull()
    })

    it('provides signalReady and clearTransition', () => {
      const { result } = renderHook(() => useIncomingTransition(), { wrapper })
      expect(typeof result.current.signalReady).toBe('function')
      expect(typeof result.current.clearTransition).toBe('function')
    })
  })

  it('loads valid transition from sessionStorage on mount', () => {
    const state = {
      type: 'quicklook-to-dashboard',
      studentId: 'student-1',
      studentName: 'Alice',
      studentEmoji: '🎵',
      studentColor: '#3b82f6',
      originBounds: { left: 0, top: 0, width: 100, height: 100 },
      timestamp: Date.now(), // fresh timestamp
    }
    sessionStorage.setItem('page-transition-state', JSON.stringify(state))

    const { result } = renderHook(() => usePageTransition(), { wrapper })

    expect(result.current.isTransitioning).toBe(true)
    expect(result.current.transitionState!.studentId).toBe('student-1')
  })

  it('ignores expired transition from sessionStorage', () => {
    const state = {
      type: 'quicklook-to-dashboard',
      studentId: 'student-1',
      studentName: 'Alice',
      studentEmoji: '🎵',
      studentColor: '#3b82f6',
      originBounds: { left: 0, top: 0, width: 100, height: 100 },
      timestamp: Date.now() - 10000, // 10 seconds old - expired
    }
    sessionStorage.setItem('page-transition-state', JSON.stringify(state))

    const { result } = renderHook(() => usePageTransition(), { wrapper })

    expect(result.current.isTransitioning).toBe(false)
    expect(result.current.transitionState).toBeNull()
  })
})
