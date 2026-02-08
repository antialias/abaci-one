import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import {
  DecompositionProvider,
  useDecomposition,
  useDecompositionOptional,
} from '../DecompositionContext'

function createWrapper(startValue = 0, targetValue = 45, options: Record<string, any> = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DecompositionProvider startValue={startValue} targetValue={targetValue} {...options}>
        {children}
      </DecompositionProvider>
    )
  }
}

describe('DecompositionContext', () => {
  it('throws when useDecomposition is used outside provider', () => {
    expect(() => {
      renderHook(() => useDecomposition())
    }).toThrow('useDecomposition must be used within a DecompositionProvider')
  })

  it('returns null from useDecompositionOptional outside provider', () => {
    const { result } = renderHook(() => useDecompositionOptional())
    expect(result.current).toBeNull()
  })

  it('provides sequence data', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(0, 45) })
    expect(result.current.sequence).toBeDefined()
    expect(result.current.fullDecomposition).toBeDefined()
    expect(typeof result.current.fullDecomposition).toBe('string')
  })

  it('provides start and target values', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(10, 55) })
    expect(result.current.startValue).toBe(10)
    expect(result.current.targetValue).toBe(55)
  })

  it('provides default currentStepIndex of 0', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(0, 45) })
    expect(result.current.currentStepIndex).toBe(0)
  })

  it('provides default abacusColumns of 5', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(0, 45) })
    expect(result.current.abacusColumns).toBe(5)
  })

  it('provides steps and segments arrays', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(0, 45) })
    expect(Array.isArray(result.current.steps)).toBe(true)
    expect(Array.isArray(result.current.segments)).toBe(true)
    expect(Array.isArray(result.current.termPositions)).toBe(true)
  })

  it('provides highlighting state with initial empty values', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(0, 45) })
    expect(result.current.activeTermIndices).toBeInstanceOf(Set)
    expect(result.current.activeTermIndices.size).toBe(0)
    expect(result.current.activeIndividualTermIndex).toBeNull()
  })

  it('allows setting activeTermIndices', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(0, 45) })

    act(() => {
      result.current.setActiveTermIndices(new Set([0, 1, 2]))
    })

    expect(result.current.activeTermIndices.size).toBe(3)
    expect(result.current.activeTermIndices.has(0)).toBe(true)
    expect(result.current.activeTermIndices.has(1)).toBe(true)
    expect(result.current.activeTermIndices.has(2)).toBe(true)
  })

  it('allows setting activeIndividualTermIndex', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(0, 45) })

    act(() => {
      result.current.setActiveIndividualTermIndex(2)
    })

    expect(result.current.activeIndividualTermIndex).toBe(2)
  })

  it('provides derived functions', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(0, 45) })
    expect(typeof result.current.getColumnFromTermIndex).toBe('function')
    expect(typeof result.current.getTermIndicesFromColumn).toBe('function')
    expect(typeof result.current.getGroupTermIndicesFromTermIndex).toBe('function')
  })

  it('provides event handlers', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(0, 45) })
    expect(typeof result.current.handleTermHover).toBe('function')
    expect(typeof result.current.handleColumnHover).toBe('function')
  })

  it('generates a meaningful decomposition for non-trivial values', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(0, 45) })
    // 0 -> 45 should have steps
    expect(result.current.steps.length).toBeGreaterThan(0)
  })

  it('handles term hover by setting group highlights', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(0, 45) })

    // Only test hover if there are steps
    if (result.current.steps.length > 0) {
      act(() => {
        result.current.handleTermHover(0, true)
      })

      expect(result.current.activeTermIndices.size).toBeGreaterThan(0)
      expect(result.current.activeIndividualTermIndex).toBe(0)

      // Unhover
      act(() => {
        result.current.handleTermHover(0, false)
      })

      expect(result.current.activeTermIndices.size).toBe(0)
      expect(result.current.activeIndividualTermIndex).toBeNull()
    }
  })

  it('handles column hover', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(0, 12) })

    // Try hovering a column
    act(() => {
      result.current.handleColumnHover(4, true)
    })

    // The result depends on the decomposition, but the call should not throw

    act(() => {
      result.current.handleColumnHover(4, false)
    })

    expect(result.current.activeTermIndices.size).toBe(0)
  })

  it('calls onTermHover callback when hovering terms', () => {
    const onTermHover = vi.fn()
    const { result } = renderHook(() => useDecomposition(), {
      wrapper: createWrapper(0, 45, { onTermHover }),
    })

    if (result.current.steps.length > 0) {
      act(() => {
        result.current.handleTermHover(0, true)
      })

      expect(onTermHover).toHaveBeenCalled()
    }
  })

  it('provides isMeaningfulDecomposition flag', () => {
    const { result } = renderHook(() => useDecomposition(), { wrapper: createWrapper(0, 45) })
    expect(typeof result.current.isMeaningfulDecomposition).toBe('boolean')
  })
})
