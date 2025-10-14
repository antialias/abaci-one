'use client'

import { createContext, useContext } from 'react'
import type { QuizAction, QuizCard, SorobanQuizState } from '../types'

// Context value interface
export interface MemoryQuizContextValue {
  state: SorobanQuizState
  dispatch: React.Dispatch<QuizAction>

  // Computed values
  isGameActive: boolean

  // Action creators (to be implemented by providers)
  // Local mode uses dispatch, room mode uses these action creators
  startGame?: () => void
  resetGame?: () => void
  exitSession?: () => void

  // Room mode action creators (optional for local mode)
  startQuiz?: (quizCards: QuizCard[]) => void
  nextCard?: () => void
  showInputPhase?: () => void
  acceptNumber?: (number: number) => void
  rejectNumber?: () => void
  setInput?: (input: string) => void
  showResults?: () => void
  setConfig?: (field: 'selectedCount' | 'displayTime' | 'selectedDifficulty', value: any) => void
}

// Create context
export const MemoryQuizContext = createContext<MemoryQuizContextValue | null>(null)

// Hook to use the context
export function useMemoryQuiz(): MemoryQuizContextValue {
  const context = useContext(MemoryQuizContext)
  if (!context) {
    throw new Error('useMemoryQuiz must be used within a MemoryQuizProvider')
  }
  return context
}
