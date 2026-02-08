import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { ViewportProvider, useViewport } from '../ViewportContext'

describe('ViewportContext', () => {
  it('returns window dimensions when no provider is present', () => {
    const { result } = renderHook(() => useViewport())
    // In jsdom, window.innerWidth/innerHeight are typically 0 or default values
    expect(typeof result.current.width).toBe('number')
    expect(typeof result.current.height).toBe('number')
  })

  it('provides custom dimensions from provider', () => {
    function wrapper({ children }: { children: ReactNode }) {
      return (
        <ViewportProvider width={1440} height={900}>
          {children}
        </ViewportProvider>
      )
    }

    const { result } = renderHook(() => useViewport(), { wrapper })
    expect(result.current.width).toBe(1440)
    expect(result.current.height).toBe(900)
  })

  it('provides different custom dimensions', () => {
    function wrapper({ children }: { children: ReactNode }) {
      return (
        <ViewportProvider width={375} height={667}>
          {children}
        </ViewportProvider>
      )
    }

    const { result } = renderHook(() => useViewport(), { wrapper })
    expect(result.current.width).toBe(375)
    expect(result.current.height).toBe(667)
  })

  it('updates dimensions when window resizes (without provider)', () => {
    const { result } = renderHook(() => useViewport())

    // Simulate a resize event
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 800, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true })
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current.width).toBe(800)
    expect(result.current.height).toBe(600)
  })
})
