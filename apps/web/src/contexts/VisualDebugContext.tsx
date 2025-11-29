'use client'

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'visual-debug-enabled'

interface VisualDebugContextType {
  /** Whether visual debug elements are enabled (only functional in development) */
  isVisualDebugEnabled: boolean
  /** Toggle visual debug mode on/off */
  toggleVisualDebug: () => void
  /** Whether we're in development mode (visual debug toggle only shows in dev) */
  isDevelopment: boolean
}

const VisualDebugContext = createContext<VisualDebugContextType | null>(null)

export function VisualDebugProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false)
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') {
      setIsEnabled(true)
    }
  }, [])

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, String(isEnabled))
  }, [isEnabled])

  const toggleVisualDebug = useCallback(() => {
    setIsEnabled((prev) => !prev)
  }, [])

  // Only enable visual debug in development mode
  const isVisualDebugEnabled = isDevelopment && isEnabled

  return (
    <VisualDebugContext.Provider
      value={{
        isVisualDebugEnabled,
        toggleVisualDebug,
        isDevelopment,
      }}
    >
      {children}
    </VisualDebugContext.Provider>
  )
}

export function useVisualDebug(): VisualDebugContextType {
  const context = useContext(VisualDebugContext)
  if (!context) {
    throw new Error('useVisualDebug must be used within a VisualDebugProvider')
  }
  return context
}

/**
 * Hook for components that may be rendered outside the provider.
 * Returns safe defaults (debug disabled) if no provider is found.
 */
export function useVisualDebugSafe(): VisualDebugContextType {
  const context = useContext(VisualDebugContext)
  if (!context) {
    return {
      isVisualDebugEnabled: false,
      toggleVisualDebug: () => {},
      isDevelopment: process.env.NODE_ENV === 'development',
    }
  }
  return context
}
