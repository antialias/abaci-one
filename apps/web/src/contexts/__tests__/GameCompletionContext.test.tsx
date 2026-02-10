import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { GameCompletionProvider, useGameCompletionCallback } from '../GameCompletionContext'

describe('GameCompletionContext', () => {
  it('returns null when used outside provider', () => {
    const { result } = renderHook(() => useGameCompletionCallback())
    expect(result.current).toBeNull()
  })

  it('provides a callback function inside provider', () => {
    const onGameComplete = vi.fn()
    function wrapper({ children }: { children: ReactNode }) {
      return (
        <GameCompletionProvider onGameComplete={onGameComplete}>{children}</GameCompletionProvider>
      )
    }

    const { result } = renderHook(() => useGameCompletionCallback(), { wrapper })
    expect(result.current).not.toBeNull()
    expect(typeof result.current).toBe('function')
  })

  it('calls the onGameComplete callback when invoked', () => {
    const onGameComplete = vi.fn()
    function wrapper({ children }: { children: ReactNode }) {
      return (
        <GameCompletionProvider onGameComplete={onGameComplete}>{children}</GameCompletionProvider>
      )
    }

    const { result } = renderHook(() => useGameCompletionCallback(), { wrapper })

    const gameState = { score: 100, level: 5 }
    act(() => {
      result.current!(gameState)
    })

    expect(onGameComplete).toHaveBeenCalledWith(gameState)
  })

  it('provides a stable callback reference across re-renders', () => {
    const onGameComplete = vi.fn()
    function wrapper({ children }: { children: ReactNode }) {
      return (
        <GameCompletionProvider onGameComplete={onGameComplete}>{children}</GameCompletionProvider>
      )
    }

    const { result, rerender } = renderHook(() => useGameCompletionCallback(), { wrapper })
    const firstCallback = result.current

    rerender()
    expect(result.current).toBe(firstCallback)
  })

  it('uses the latest callback via ref', () => {
    const firstCallback = vi.fn()
    const secondCallback = vi.fn()

    let onGameComplete = firstCallback
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <GameCompletionProvider onGameComplete={onGameComplete}>{children}</GameCompletionProvider>
      )
    }

    const { result, rerender } = renderHook(() => useGameCompletionCallback(), {
      wrapper: Wrapper,
    })

    // Update the callback prop
    onGameComplete = secondCallback
    rerender()

    // Calling the stable callback should use the second callback
    act(() => {
      result.current!({ done: true })
    })

    expect(firstCallback).not.toHaveBeenCalled()
    expect(secondCallback).toHaveBeenCalledWith({ done: true })
  })
})
