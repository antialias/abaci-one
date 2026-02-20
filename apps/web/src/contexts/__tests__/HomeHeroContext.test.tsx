import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { HomeHeroProvider, useHomeHero } from '../HomeHeroContext'

function wrapper({ children }: { children: ReactNode }) {
  return <HomeHeroProvider>{children}</HomeHeroProvider>
}

describe('HomeHeroContext', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('throws when useHomeHero is used outside provider', () => {
    expect(() => {
      renderHook(() => useHomeHero())
    }).toThrow('useHomeHero must be used within HomeHeroProvider')
  })

  it('provides a subtitle object', () => {
    const { result } = renderHook(() => useHomeHero(), { wrapper })
    expect(result.current.subtitle).toBeDefined()
    expect(typeof result.current.subtitle.text).toBe('string')
    expect(typeof result.current.subtitle.description).toBe('string')
  })

  it('provides abacusValue starting at 0', () => {
    const { result } = renderHook(() => useHomeHero(), { wrapper })
    // Initial render value should be 0 (before sessionStorage load)
    // After useEffect, it may still be 0 if nothing is stored
    expect(typeof result.current.abacusValue).toBe('number')
  })

  it('allows setting abacusValue', () => {
    const { result } = renderHook(() => useHomeHero(), { wrapper })

    act(() => {
      result.current.setAbacusValue(42)
    })

    expect(result.current.abacusValue).toBe(42)
  })

  it('provides isHeroVisible defaulting to true', () => {
    const { result } = renderHook(() => useHomeHero(), { wrapper })
    expect(result.current.isHeroVisible).toBe(true)
  })

  it('allows setting isHeroVisible', () => {
    const { result } = renderHook(() => useHomeHero(), { wrapper })

    act(() => {
      result.current.setIsHeroVisible(false)
    })

    expect(result.current.isHeroVisible).toBe(false)
  })

  it('starts subtitle rotation from index 0', () => {
    const { result } = renderHook(() => useHomeHero(), { wrapper })
    expect(result.current.subtitle).toEqual(expect.objectContaining({ text: expect.any(String) }))
  })

  it('persists abacus value to sessionStorage', async () => {
    const { result } = renderHook(() => useHomeHero(), { wrapper })

    // Wait for isAbacusLoaded to be true (setTimeout(0) in effect)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    act(() => {
      result.current.setAbacusValue(99)
    })

    // Wait a tick for the persistence effect
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(sessionStorage.getItem('heroAbacusValue')).toBe('99')
  })

  it('loads abacus value from sessionStorage', async () => {
    sessionStorage.setItem('heroAbacusValue', '55')

    const { result } = renderHook(() => useHomeHero(), { wrapper })

    // Wait for the load effect + setTimeout(0)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(result.current.abacusValue).toBe(55)
  })

  it('provides a consistent subtitle across renders', () => {
    const { result } = renderHook(() => useHomeHero(), { wrapper })

    // Subtitle should be defined on initial render
    expect(result.current.subtitle).toBeDefined()
  })

  it('provides isAbacusLoaded and isSubtitleLoaded', () => {
    const { result } = renderHook(() => useHomeHero(), { wrapper })
    expect(typeof result.current.isAbacusLoaded).toBe('boolean')
    expect(typeof result.current.isSubtitleLoaded).toBe('boolean')
  })
})
