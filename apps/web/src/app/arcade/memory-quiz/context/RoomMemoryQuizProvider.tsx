'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect } from 'react'
import { useArcadeSession } from '@/hooks/useArcadeSession'
import { useRoomData } from '@/hooks/useRoomData'
import { useViewerId } from '@/hooks/useViewerId'
import type { GameMove } from '@/lib/arcade/validation'
import { initialState } from '../reducer'
import type { QuizCard, SorobanQuizState } from '../types'
import { MemoryQuizContext, type MemoryQuizContextValue } from './MemoryQuizContext'

/**
 * Optimistic move application (client-side prediction)
 * The server will validate and send back the authoritative state
 */
function applyMoveOptimistically(state: SorobanQuizState, move: GameMove): SorobanQuizState {
  switch (move.type) {
    case 'START_QUIZ': {
      // Handle both client-generated moves (with quizCards) and server-generated moves (with numbers only)
      // Server can't serialize React components, so it only sends numbers
      const clientQuizCards = move.data.quizCards
      const serverNumbers = move.data.numbers

      let quizCards: QuizCard[]
      let correctAnswers: number[]

      if (clientQuizCards) {
        // Client-side optimistic update: use the full quizCards with React components
        quizCards = clientQuizCards
        correctAnswers = clientQuizCards.map((card: QuizCard) => card.number)
      } else if (serverNumbers) {
        // Server update: create minimal quizCards from numbers (no React components needed for validation)
        quizCards = serverNumbers.map((number: number) => ({
          number,
          svgComponent: null,
          element: null,
        }))
        correctAnswers = serverNumbers
      } else {
        // Fallback: preserve existing state
        quizCards = state.quizCards
        correctAnswers = state.correctAnswers
      }

      const cardCount = quizCards.length

      return {
        ...state,
        quizCards,
        correctAnswers,
        currentCardIndex: 0,
        foundNumbers: [],
        guessesRemaining: cardCount + Math.floor(cardCount / 2),
        gamePhase: 'display',
        incorrectGuesses: 0,
        currentInput: '',
        wrongGuessAnimations: [],
        prefixAcceptanceTimeout: null,
      }
    }

    case 'NEXT_CARD':
      return {
        ...state,
        currentCardIndex: state.currentCardIndex + 1,
      }

    case 'SHOW_INPUT_PHASE':
      return {
        ...state,
        gamePhase: 'input',
      }

    case 'ACCEPT_NUMBER':
      return {
        ...state,
        foundNumbers: [...state.foundNumbers, move.data.number],
        currentInput: '',
      }

    case 'REJECT_NUMBER':
      return {
        ...state,
        guessesRemaining: state.guessesRemaining - 1,
        incorrectGuesses: state.incorrectGuesses + 1,
        currentInput: '',
      }

    case 'SET_INPUT':
      return {
        ...state,
        currentInput: move.data.input,
      }

    case 'SHOW_RESULTS':
      return {
        ...state,
        gamePhase: 'results',
      }

    case 'RESET_QUIZ':
      return {
        ...state,
        gamePhase: 'setup',
        quizCards: [],
        correctAnswers: [],
        currentCardIndex: 0,
        foundNumbers: [],
        guessesRemaining: 0,
        currentInput: '',
        incorrectGuesses: 0,
        wrongGuessAnimations: [],
        prefixAcceptanceTimeout: null,
        finishButtonsBound: false,
      }

    case 'SET_CONFIG': {
      const { field, value } = move.data as {
        field: 'selectedCount' | 'displayTime' | 'selectedDifficulty'
        value: any
      }
      return {
        ...state,
        [field]: value,
      }
    }

    default:
      return state
  }
}

/**
 * RoomMemoryQuizProvider - Provides context for room-based multiplayer mode
 *
 * This provider uses useArcadeSession for network-synchronized gameplay.
 * All state changes are sent as moves and validated on the server.
 */
export function RoomMemoryQuizProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()

  // Arcade session integration WITH room sync
  const {
    state,
    sendMove,
    connected: _connected,
    exitSession,
  } = useArcadeSession<SorobanQuizState>({
    userId: viewerId || '',
    roomId: roomData?.id, // CRITICAL: Pass roomId for network sync across room members
    initialState,
    applyMove: applyMoveOptimistically,
  })

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

  // Action creators - send moves to arcade session
  // For single-player quiz, we use viewerId as playerId
  const startQuiz = useCallback(
    (quizCards: QuizCard[]) => {
      // Extract only serializable data (numbers) for server
      // React components can't be sent over Socket.IO
      const numbers = quizCards.map((card) => card.number)

      sendMove({
        type: 'START_QUIZ',
        playerId: viewerId || '',
        data: {
          numbers, // Send to server
          quizCards, // Keep for optimistic local update
        },
      })
    },
    [viewerId, sendMove]
  )

  const nextCard = useCallback(() => {
    sendMove({
      type: 'NEXT_CARD',
      playerId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  const showInputPhase = useCallback(() => {
    sendMove({
      type: 'SHOW_INPUT_PHASE',
      playerId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  const acceptNumber = useCallback(
    (number: number) => {
      sendMove({
        type: 'ACCEPT_NUMBER',
        playerId: viewerId || '',
        data: { number },
      })
    },
    [viewerId, sendMove]
  )

  const rejectNumber = useCallback(() => {
    sendMove({
      type: 'REJECT_NUMBER',
      playerId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  const setInput = useCallback(
    (input: string) => {
      sendMove({
        type: 'SET_INPUT',
        playerId: viewerId || '',
        data: { input },
      })
    },
    [viewerId, sendMove]
  )

  const showResults = useCallback(() => {
    sendMove({
      type: 'SHOW_RESULTS',
      playerId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  const resetGame = useCallback(() => {
    sendMove({
      type: 'RESET_QUIZ',
      playerId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  const setConfig = useCallback(
    (field: 'selectedCount' | 'displayTime' | 'selectedDifficulty', value: any) => {
      sendMove({
        type: 'SET_CONFIG',
        playerId: viewerId || '',
        data: { field, value },
      })
    },
    [viewerId, sendMove]
  )

  const contextValue: MemoryQuizContextValue = {
    state,
    dispatch: () => {
      // No-op - replaced with action creators
      console.warn('dispatch() is deprecated in room mode, use action creators instead')
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

// Export the hook for this provider
export { useMemoryQuiz } from './MemoryQuizContext'
