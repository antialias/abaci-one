'use client'

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { ErrorToast } from '@/components/ErrorToast'

interface ArcadeError {
  id: string
  message: string
  details?: string
  timestamp: number
}

interface ArcadeErrorContextValue {
  errors: ArcadeError[]
  addError: (message: string, details?: string) => void
  clearError: (id: string) => void
  clearAllErrors: () => void
}

const ArcadeErrorContext = createContext<ArcadeErrorContextValue | null>(null)

/**
 * Provider for arcade error management
 * Manages error toast notifications across arcade games
 */
export function ArcadeErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<ArcadeError[]>([])

  const addError = useCallback((message: string, details?: string) => {
    const error: ArcadeError = {
      id: `error-${Date.now()}-${Math.random()}`,
      message,
      details,
      timestamp: Date.now(),
    }

    setErrors((prev) => [...prev, error])

    // Auto-remove after 15 seconds as fallback
    setTimeout(() => {
      setErrors((prev) => prev.filter((e) => e.id !== error.id))
    }, 15000)
  }, [])

  const clearError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const clearAllErrors = useCallback(() => {
    setErrors([])
  }, [])

  return (
    <ArcadeErrorContext.Provider value={{ errors, addError, clearError, clearAllErrors }}>
      {children}

      {/* Render error toasts */}
      <div data-component="arcade-error-toasts">
        {errors.map((error) => (
          <ErrorToast
            key={error.id}
            message={error.message}
            details={error.details}
            onDismiss={() => clearError(error.id)}
            autoHideDuration={10000}
          />
        ))}
      </div>
    </ArcadeErrorContext.Provider>
  )
}

/**
 * Hook to access arcade error context
 */
export function useArcadeError() {
  const context = useContext(ArcadeErrorContext)
  if (!context) {
    throw new Error('useArcadeError must be used within ArcadeErrorProvider')
  }
  return context
}
