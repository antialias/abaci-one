import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import {
  SessionModeBannerProvider,
  useSessionModeBanner,
  useSessionModeBannerOptional,
} from '../SessionModeBannerContext'
import type { SessionMode } from '@/lib/curriculum/session-mode'

// Mock the session-mode module
vi.mock('@/lib/curriculum/session-mode', () => ({}))

const mockSessionMode: SessionMode = {
  type: 'maintenance',
  focusDescription: 'Mixed practice',
  skillCount: 5,
}

function createWrapper(
  sessionMode: SessionMode | null = mockSessionMode,
  isLoading = false,
  activeSession = null as any
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SessionModeBannerProvider
        sessionMode={sessionMode}
        isLoading={isLoading}
        activeSession={activeSession}
      >
        {children}
      </SessionModeBannerProvider>
    )
  }
}

describe('SessionModeBannerContext', () => {
  it('throws when useSessionModeBanner is used outside provider', () => {
    expect(() => {
      renderHook(() => useSessionModeBanner())
    }).toThrow('useSessionModeBanner must be used within SessionModeBannerProvider')
  })

  it('returns null from useSessionModeBannerOptional outside provider', () => {
    const { result } = renderHook(() => useSessionModeBannerOptional())
    expect(result.current).toBeNull()
  })

  it('provides sessionMode from props', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(mockSessionMode),
    })
    expect(result.current.sessionMode).toEqual(mockSessionMode)
  })

  it('provides isLoading from props', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(null, true),
    })
    expect(result.current.isLoading).toBe(true)
  })

  it('provides default activeSlot as hidden when no slots registered', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(),
    })
    expect(result.current.activeSlot).toBe('hidden')
  })

  it('registers and uses content slot', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.registerContentSlot()
    })

    expect(result.current.activeSlot).toBe('content')
  })

  it('falls back to nav slot when content is unregistered', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.registerContentSlot()
      result.current.registerNavSlot()
    })

    expect(result.current.activeSlot).toBe('content')

    act(() => {
      result.current.unregisterContentSlot()
    })

    expect(result.current.activeSlot).toBe('nav')
  })

  it('falls back to hidden when all slots unregistered', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.registerNavSlot()
    })

    expect(result.current.activeSlot).toBe('nav')

    act(() => {
      result.current.unregisterNavSlot()
    })

    expect(result.current.activeSlot).toBe('hidden')
  })

  it('projects to nav when content slot is not visible', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.registerContentSlot()
      result.current.registerNavSlot()
    })

    expect(result.current.activeSlot).toBe('content')

    act(() => {
      result.current.setContentSlotVisible(false)
    })

    expect(result.current.activeSlot).toBe('nav')
  })

  it('reports target bounds based on active slot', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(),
    })

    const contentBounds = { x: 10, y: 20, width: 300, height: 50 }
    const navBounds = { x: 0, y: 0, width: 200, height: 40 }

    act(() => {
      result.current.registerContentSlot()
      result.current.registerNavSlot()
      result.current.setContentBounds(contentBounds)
      result.current.setNavBounds(navBounds)
    })

    expect(result.current.targetBounds).toEqual(contentBounds)

    act(() => {
      result.current.setContentSlotVisible(false)
    })

    expect(result.current.targetBounds).toEqual(navBounds)
  })

  it('provides action callbacks that can be set', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(),
    })

    const mockAction = vi.fn()
    act(() => {
      result.current.setOnAction(mockAction)
    })

    act(() => {
      result.current.onAction()
    })

    expect(mockAction).toHaveBeenCalled()
  })

  it('provides defer callbacks', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(),
    })

    const mockDefer = vi.fn()
    act(() => {
      result.current.setOnDefer(mockDefer)
    })

    act(() => {
      result.current.onDefer()
    })

    expect(mockDefer).toHaveBeenCalled()
  })

  it('provides resume callbacks', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(),
    })

    const mockResume = vi.fn()
    act(() => {
      result.current.setOnResume(mockResume)
    })

    act(() => {
      result.current.onResume()
    })

    expect(mockResume).toHaveBeenCalled()
  })

  it('provides startFresh callbacks', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(),
    })

    const mockStartFresh = vi.fn()
    act(() => {
      result.current.setOnStartFresh(mockStartFresh)
    })

    act(() => {
      result.current.onStartFresh()
    })

    expect(mockStartFresh).toHaveBeenCalled()
  })

  it('provides content and nav dimensions', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(),
    })

    expect(result.current.contentDimensions).toBeNull()
    expect(result.current.navDimensions).toBeNull()

    act(() => {
      result.current.setContentDimensions({ width: 300, height: 50 })
      result.current.setNavDimensions({ width: 200, height: 40 })
    })

    expect(result.current.contentDimensions).toEqual({ width: 300, height: 50 })
    expect(result.current.navDimensions).toEqual({ width: 200, height: 40 })
  })

  it('provides activeSession from props', () => {
    const activeSession = {
      sessionPlanId: 'plan-1',
      problemsCompleted: 3,
      totalProblems: 10,
    }
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(mockSessionMode, false, activeSession),
    })

    expect(result.current.activeSession).toEqual(activeSession)
  })

  it('provides shouldAnimate flag', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(),
    })
    expect(typeof result.current.shouldAnimate).toBe('boolean')
  })

  it('does not go below 0 on unregister count', () => {
    const { result } = renderHook(() => useSessionModeBanner(), {
      wrapper: createWrapper(),
    })

    // Unregister without prior register
    act(() => {
      result.current.unregisterContentSlot()
      result.current.unregisterNavSlot()
    })

    // Should still be hidden (0 counts), not negative
    expect(result.current.activeSlot).toBe('hidden')
  })
})
