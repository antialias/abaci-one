'use client'

import { createContext, useContext, useMemo } from 'react'
import type { WorksheetFormState } from '../types'

/**
 * Context for worksheet configuration state
 * Eliminates prop drilling for formState, onChange, and operator
 */
export interface WorksheetConfigContextValue {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
  operator: 'addition' | 'subtraction' | 'mixed'
}

export const WorksheetConfigContext = createContext<WorksheetConfigContextValue | null>(null)

/**
 * Hook to access worksheet configuration context
 * @throws Error if used outside of WorksheetConfigProvider
 */
export function useWorksheetConfig() {
  const context = useContext(WorksheetConfigContext)
  if (!context) {
    throw new Error('useWorksheetConfig must be used within WorksheetConfigProvider')
  }
  return context
}

export interface WorksheetConfigProviderProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
  children: React.ReactNode
}

/**
 * Provider component for worksheet configuration context
 * Wrap config panel components to provide access to formState, onChange, and operator
 */
export function WorksheetConfigProvider({
  formState,
  onChange,
  children,
}: WorksheetConfigProviderProps) {
  const value = useMemo(
    () => ({
      formState,
      onChange,
      operator: formState.operator || 'addition',
    }),
    [formState, onChange]
  )

  return <WorksheetConfigContext.Provider value={value}>{children}</WorksheetConfigContext.Provider>
}
