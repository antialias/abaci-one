import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { FullscreenProvider, useFullscreen } from '../FullscreenContext'

function wrapper({ children }: { children: ReactNode }) {
  return <FullscreenProvider>{children}</FullscreenProvider>
}

describe('FullscreenContext', () => {
  beforeEach(() => {
    // Reset fullscreenElement
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
      configurable: true,
    })
  })

  it('throws when useFullscreen is used outside provider', () => {
    expect(() => {
      renderHook(() => useFullscreen())
    }).toThrow('useFullscreen must be used within a FullscreenProvider')
  })

  it('provides isFullscreen as false initially', () => {
    const { result } = renderHook(() => useFullscreen(), { wrapper })
    expect(result.current.isFullscreen).toBe(false)
  })

  it('provides all required functions', () => {
    const { result } = renderHook(() => useFullscreen(), { wrapper })
    expect(typeof result.current.enterFullscreen).toBe('function')
    expect(typeof result.current.exitFullscreen).toBe('function')
    expect(typeof result.current.toggleFullscreen).toBe('function')
    expect(typeof result.current.setFullscreenElement).toBe('function')
    expect(result.current.fullscreenElementRef).toBeDefined()
  })

  it('sets fullscreen element ref via setFullscreenElement', () => {
    const { result } = renderHook(() => useFullscreen(), { wrapper })

    const element = document.createElement('div')
    act(() => {
      result.current.setFullscreenElement(element)
    })
    expect(result.current.fullscreenElementRef.current).toBe(element)
  })

  it('clears fullscreen element ref when null is passed', () => {
    const { result } = renderHook(() => useFullscreen(), { wrapper })

    const element = document.createElement('div')
    act(() => {
      result.current.setFullscreenElement(element)
    })
    expect(result.current.fullscreenElementRef.current).toBe(element)

    act(() => {
      result.current.setFullscreenElement(null)
    })
    expect(result.current.fullscreenElementRef.current).toBeNull()
  })

  it('tracks fullscreenchange events', () => {
    const { result } = renderHook(() => useFullscreen(), { wrapper })

    // Simulate entering fullscreen
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.documentElement,
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(result.current.isFullscreen).toBe(true)

    // Simulate exiting fullscreen
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(result.current.isFullscreen).toBe(false)
  })

  it('calls requestFullscreen on enterFullscreen', async () => {
    const { result } = renderHook(() => useFullscreen(), { wrapper })

    const mockRequestFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: mockRequestFullscreen,
      writable: true,
      configurable: true,
    })

    await act(async () => {
      await result.current.enterFullscreen()
    })

    expect(mockRequestFullscreen).toHaveBeenCalled()
  })

  it('calls exitFullscreen on exitFullscreen', async () => {
    const { result } = renderHook(() => useFullscreen(), { wrapper })

    const mockExitFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = mockExitFullscreen

    await act(async () => {
      await result.current.exitFullscreen()
    })

    expect(mockExitFullscreen).toHaveBeenCalled()
  })
})
