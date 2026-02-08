import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { ArcadeErrorProvider, useArcadeError } from '../ArcadeErrorContext'

// Mock the ToastContext
const mockShowError = vi.fn()
vi.mock('@/components/common/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showError: mockShowError,
    showInfo: vi.fn(),
  }),
}))

function wrapper({ children }: { children: ReactNode }) {
  return <ArcadeErrorProvider>{children}</ArcadeErrorProvider>
}

describe('ArcadeErrorContext', () => {
  it('throws when useArcadeError is used outside provider', () => {
    expect(() => {
      renderHook(() => useArcadeError())
    }).toThrow('useArcadeError must be used within ArcadeErrorProvider')
  })

  it('provides addError function', () => {
    const { result } = renderHook(() => useArcadeError(), { wrapper })
    expect(typeof result.current.addError).toBe('function')
  })

  it('calls showError when addError is called with message', () => {
    const { result } = renderHook(() => useArcadeError(), { wrapper })

    act(() => {
      result.current.addError('Something went wrong')
    })

    expect(mockShowError).toHaveBeenCalledWith('Something went wrong', undefined)
  })

  it('calls showError with message and details', () => {
    mockShowError.mockClear()
    const { result } = renderHook(() => useArcadeError(), { wrapper })

    act(() => {
      result.current.addError('Connection failed', 'Check your network')
    })

    expect(mockShowError).toHaveBeenCalledWith('Connection failed', 'Check your network')
  })
})
