import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import React, { useContext, type ReactNode } from 'react'
import { PreviewModeContext } from '../PreviewModeContext'

describe('PreviewModeContext', () => {
  it('returns null by default when no provider is present', () => {
    const { result } = renderHook(() => useContext(PreviewModeContext))
    expect(result.current).toBeNull()
  })

  it('provides preview mode state when wrapped in provider', () => {
    const mockState = { score: 100, level: 5 }

    function wrapper({ children }: { children: ReactNode }) {
      return (
        <PreviewModeContext.Provider value={{ isPreview: true, mockState }}>
          {children}
        </PreviewModeContext.Provider>
      )
    }

    const { result } = renderHook(() => useContext(PreviewModeContext), { wrapper })
    expect(result.current).not.toBeNull()
    expect(result.current!.isPreview).toBe(true)
    expect(result.current!.mockState).toEqual({ score: 100, level: 5 })
  })

  it('provides non-preview state', () => {
    function wrapper({ children }: { children: ReactNode }) {
      return (
        <PreviewModeContext.Provider value={{ isPreview: false, mockState: null }}>
          {children}
        </PreviewModeContext.Provider>
      )
    }

    const { result } = renderHook(() => useContext(PreviewModeContext), { wrapper })
    expect(result.current).not.toBeNull()
    expect(result.current!.isPreview).toBe(false)
    expect(result.current!.mockState).toBeNull()
  })
})
