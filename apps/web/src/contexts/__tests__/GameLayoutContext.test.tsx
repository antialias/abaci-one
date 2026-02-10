import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { GameLayoutProvider, useGameLayoutMode } from '../GameLayoutContext'

describe('GameLayoutContext', () => {
  it('returns default value "viewport" when no provider is present', () => {
    const { result } = renderHook(() => useGameLayoutMode())
    expect(result.current).toBe('viewport')
  })

  it('provides "viewport" mode when set', () => {
    function wrapper({ children }: { children: ReactNode }) {
      return <GameLayoutProvider mode="viewport">{children}</GameLayoutProvider>
    }
    const { result } = renderHook(() => useGameLayoutMode(), { wrapper })
    expect(result.current).toBe('viewport')
  })

  it('provides "container" mode when set', () => {
    function wrapper({ children }: { children: ReactNode }) {
      return <GameLayoutProvider mode="container">{children}</GameLayoutProvider>
    }
    const { result } = renderHook(() => useGameLayoutMode(), { wrapper })
    expect(result.current).toBe('container')
  })

  it('renders children within the provider', () => {
    const TestChild = () => {
      const mode = useGameLayoutMode()
      return <div data-testid="mode">{mode}</div>
    }

    const { unmount } = renderHook(() => useGameLayoutMode(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <GameLayoutProvider mode="container">{children}</GameLayoutProvider>
      ),
    })
    // If hook returned without throwing, the provider rendered its children
    unmount()
  })
})
