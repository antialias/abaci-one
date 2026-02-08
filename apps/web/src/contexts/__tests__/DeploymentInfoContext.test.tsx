import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { DeploymentInfoProvider, useDeploymentInfo } from '../DeploymentInfoContext'

function wrapper({ children }: { children: ReactNode }) {
  return <DeploymentInfoProvider>{children}</DeploymentInfoProvider>
}

describe('DeploymentInfoContext', () => {
  it('throws when useDeploymentInfo is used outside provider', () => {
    expect(() => {
      renderHook(() => useDeploymentInfo())
    }).toThrow('useDeploymentInfo must be used within DeploymentInfoProvider')
  })

  it('provides default isOpen as false', () => {
    const { result } = renderHook(() => useDeploymentInfo(), { wrapper })
    expect(result.current.isOpen).toBe(false)
  })

  it('opens the deployment info panel', () => {
    const { result } = renderHook(() => useDeploymentInfo(), { wrapper })
    act(() => {
      result.current.open()
    })
    expect(result.current.isOpen).toBe(true)
  })

  it('closes the deployment info panel', () => {
    const { result } = renderHook(() => useDeploymentInfo(), { wrapper })
    act(() => {
      result.current.open()
    })
    expect(result.current.isOpen).toBe(true)
    act(() => {
      result.current.close()
    })
    expect(result.current.isOpen).toBe(false)
  })

  it('toggles the deployment info panel', () => {
    const { result } = renderHook(() => useDeploymentInfo(), { wrapper })
    expect(result.current.isOpen).toBe(false)

    act(() => {
      result.current.toggle()
    })
    expect(result.current.isOpen).toBe(true)

    act(() => {
      result.current.toggle()
    })
    expect(result.current.isOpen).toBe(false)
  })

  it('renders children', () => {
    const { result } = renderHook(() => useDeploymentInfo(), { wrapper })
    // If we get here without throwing, children rendered successfully
    expect(result.current).toBeDefined()
    expect(typeof result.current.open).toBe('function')
    expect(typeof result.current.close).toBe('function')
    expect(typeof result.current.toggle).toBe('function')
  })
})
