import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { GameThemeProvider, useGameTheme } from '../GameThemeContext'

function wrapper({ children }: { children: ReactNode }) {
  return <GameThemeProvider>{children}</GameThemeProvider>
}

describe('GameThemeContext', () => {
  it('throws when useGameTheme is used outside provider', () => {
    expect(() => {
      renderHook(() => useGameTheme())
    }).toThrow('useGameTheme must be used within a GameThemeProvider')
  })

  it('provides null theme by default', () => {
    const { result } = renderHook(() => useGameTheme(), { wrapper })
    expect(result.current.theme).toBeNull()
  })

  it('provides isHydrated as true after mount', () => {
    const { result } = renderHook(() => useGameTheme(), { wrapper })
    // useEffect runs after render, so isHydrated should be true
    expect(result.current.isHydrated).toBe(true)
  })

  it('sets theme via setTheme', () => {
    const { result } = renderHook(() => useGameTheme(), { wrapper })

    act(() => {
      result.current.setTheme({
        gameName: 'abacus-numeral',
        backgroundColor: '#3b82f6',
      })
    })

    expect(result.current.theme).toEqual({
      gameName: 'abacus-numeral',
      backgroundColor: '#3b82f6',
    })
  })

  it('clears theme by setting null', () => {
    const { result } = renderHook(() => useGameTheme(), { wrapper })

    act(() => {
      result.current.setTheme({
        gameName: 'complement-pairs',
        backgroundColor: '#10b981',
      })
    })
    expect(result.current.theme).not.toBeNull()

    act(() => {
      result.current.setTheme(null)
    })
    expect(result.current.theme).toBeNull()
  })

  it('provides setTheme as a function', () => {
    const { result } = renderHook(() => useGameTheme(), { wrapper })
    expect(typeof result.current.setTheme).toBe('function')
  })
})
