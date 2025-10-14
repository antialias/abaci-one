'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useReducer } from 'react'
import { useRouter } from 'next/navigation'
import { initialState, quizReducer } from '../reducer'
import type { QuizCard } from '../types'
import { MemoryQuizContext, type MemoryQuizContextValue } from './MemoryQuizContext'

interface LocalMemoryQuizProviderProps {
  children: ReactNode
}

/**
 * LocalMemoryQuizProvider - Provides context for single-player local mode
 *
 * This provider wraps the memory quiz reducer and provides action creators
 * to child components. It's used for standalone local play (non-room mode).
 *
 * Action creators wrap dispatch calls to maintain same interface as RoomProvider.
 */
export function LocalMemoryQuizProvider({ children }: LocalMemoryQuizProviderProps) {
  const router = useRouter()
  const [state, dispatch] = useReducer(quizReducer, initialState)

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (state.prefixAcceptanceTimeout) {
        clearTimeout(state.prefixAcceptanceTimeout)
      }
    }
  }, [state.prefixAcceptanceTimeout])

  // Computed values
  const isGameActive = state.gamePhase === 'display' || state.gamePhase === 'input'

  // Action creators - wrap dispatch calls to match RoomProvider interface
  const startQuiz = useCallback((quizCards: QuizCard[]) => {
    dispatch({ type: 'START_QUIZ', quizCards })
  }, [])

  const nextCard = useCallback(() => {
    dispatch({ type: 'NEXT_CARD' })
  }, [])

  const showInputPhase = useCallback(() => {
    dispatch({ type: 'SHOW_INPUT_PHASE' })
  }, [])

  const acceptNumber = useCallback((number: number) => {
    dispatch({ type: 'ACCEPT_NUMBER', number })
  }, [])

  const rejectNumber = useCallback(() => {
    dispatch({ type: 'REJECT_NUMBER' })
  }, [])

  const setInput = useCallback((input: string) => {
    dispatch({ type: 'SET_INPUT', input })
  }, [])

  const showResults = useCallback(() => {
    dispatch({ type: 'SHOW_RESULTS' })
  }, [])

  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET_QUIZ' })
  }, [])

  const setConfig = useCallback(
    (field: 'selectedCount' | 'displayTime' | 'selectedDifficulty', value: any) => {
      switch (field) {
        case 'selectedCount':
          dispatch({ type: 'SET_SELECTED_COUNT', count: value })
          break
        case 'displayTime':
          dispatch({ type: 'SET_DISPLAY_TIME', time: value })
          break
        case 'selectedDifficulty':
          dispatch({ type: 'SET_DIFFICULTY', difficulty: value })
          break
      }
    },
    []
  )

  const exitSession = useCallback(() => {
    router.push('/games')
  }, [router])

  const contextValue: MemoryQuizContextValue = {
    state,
    dispatch: () => {
      // No-op - local provider uses action creators instead
      console.warn('dispatch() is not available in local mode, use action creators instead')
    },
    isGameActive,
    resetGame,
    exitSession,
    // Expose action creators for components to use
    startQuiz,
    nextCard,
    showInputPhase,
    acceptNumber,
    rejectNumber,
    setInput,
    showResults,
    setConfig,
  }

  return <MemoryQuizContext.Provider value={contextValue}>{children}</MemoryQuizContext.Provider>
}
