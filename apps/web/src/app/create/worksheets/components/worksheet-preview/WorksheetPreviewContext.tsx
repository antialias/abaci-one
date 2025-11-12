'use client'

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { validateProblemSpace } from '@/app/create/worksheets/utils/validateProblemSpace'
import { useTheme } from '@/contexts/ThemeContext'

interface WorksheetPreviewContextValue {
  // Theme
  isDark: boolean

  // Warnings
  warnings: string[]
  isDismissed: boolean
  setIsDismissed: (dismissed: boolean) => void

  // Form state
  formState: WorksheetFormState
}

const WorksheetPreviewContext = createContext<WorksheetPreviewContextValue | null>(null)

export function useWorksheetPreview() {
  const context = useContext(WorksheetPreviewContext)
  if (!context) {
    throw new Error('useWorksheetPreview must be used within WorksheetPreviewProvider')
  }
  return context
}

interface WorksheetPreviewProviderProps {
  formState: WorksheetFormState
  children: ReactNode
}

export function WorksheetPreviewProvider({ formState, children }: WorksheetPreviewProviderProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [isDismissed, setIsDismissed] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])

  // Validate problem space whenever relevant config changes
  useEffect(() => {
    const problemsPerPage = formState.problemsPerPage ?? 20
    const pages = formState.pages ?? 1
    const operator = formState.operator ?? 'addition'
    const mode = formState.mode ?? 'smart'

    // Reset dismissed state when config changes
    setIsDismissed(false)

    // Skip validation for mastery+mixed mode - too complex with separate skill configs
    if (mode === 'mastery' && operator === 'mixed') {
      setWarnings([])
      return
    }

    const digitRange = formState.digitRange ?? { min: 2, max: 2 }
    const pAnyStart = formState.pAnyStart ?? 0

    const validation = validateProblemSpace(problemsPerPage, pages, digitRange, pAnyStart, operator)

    setWarnings(validation.warnings)
  }, [
    formState.problemsPerPage,
    formState.pages,
    formState.digitRange,
    formState.pAnyStart,
    formState.operator,
    formState.mode,
  ])

  const value: WorksheetPreviewContextValue = {
    isDark,
    warnings,
    isDismissed,
    setIsDismissed,
    formState,
  }

  return (
    <WorksheetPreviewContext.Provider value={value}>{children}</WorksheetPreviewContext.Provider>
  )
}
