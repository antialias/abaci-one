'use client'

import { createContext, useContext, useCallback, useMemo, useEffect, type ReactNode } from 'react'
import { useGameMode } from '../../../../contexts/GameModeContext'
import { useViewerId } from '@/hooks/useViewerId'
import { useArcadeSession } from '@/hooks/useArcadeSession'
import { generateGameCards } from '../utils/cardGeneration'
import type {
  MemoryPairsState,
  MemoryPairsContextValue,
  GameStatistics,
} from './types'
import type { GameMove } from '@/lib/arcade/validation'

// Initial state
const initialState: MemoryPairsState = {
  cards: [],
  gameCards: [],
  flippedCards: [],
  gameType: 'abacus-numeral',
  difficulty: 6,
  turnTimer: 30,
  gamePhase: 'setup',
  currentPlayer: 1,
  matchedPairs: 0,
  totalPairs: 6,
  moves: 0,
  scores: {},
  activePlayers: [],
  consecutiveMatches: {},
  gameStartTime: null,
  gameEndTime: null,
  currentMoveStartTime: null,
  timerInterval: null,
  celebrationAnimations: [],
  isProcessingMove: false,
  showMismatchFeedback: false,
  lastMatchedPair: null
}

/**
 * Optimistic move application (client-side prediction)
 * The server will validate and send back the authoritative state
 */
function applyMoveOptimistically(state: MemoryPairsState, move: GameMove): MemoryPairsState {
  switch (move.type) {
    case 'START_GAME':
      // Generate cards and initialize game
      return {
        ...state,
        gamePhase: 'playing',
        gameCards: move.data.cards,
        cards: move.data.cards,
        flippedCards: [],
        matchedPairs: 0,
        moves: 0,
        scores: move.data.activePlayers.reduce((acc: any, p: number) => ({ ...acc, [p]: 0 }), {}),
        consecutiveMatches: move.data.activePlayers.reduce((acc: any, p: number) => ({ ...acc, [p]: 0 }), {}),
        activePlayers: move.data.activePlayers,
        currentPlayer: move.data.activePlayers[0] || 1,
        gameStartTime: Date.now(),
        gameEndTime: null,
        currentMoveStartTime: Date.now(),
        celebrationAnimations: [],
        isProcessingMove: false,
        showMismatchFeedback: false,
        lastMatchedPair: null
      }

    case 'FLIP_CARD': {
      // Optimistically flip the card
      const card = state.gameCards.find(c => c.id === move.data.cardId)
      if (!card) return state

      const newFlippedCards = [...state.flippedCards, card]

      return {
        ...state,
        flippedCards: newFlippedCards,
        currentMoveStartTime: state.flippedCards.length === 0 ? Date.now() : state.currentMoveStartTime,
        isProcessingMove: newFlippedCards.length === 2, // Processing if 2 cards flipped
        showMismatchFeedback: false
      }
    }

    case 'CLEAR_MISMATCH': {
      // Clear mismatched cards and feedback
      return {
        ...state,
        flippedCards: [],
        showMismatchFeedback: false,
        isProcessingMove: false
      }
    }

    default:
      return state
  }
}

// Create context
const ArcadeMemoryPairsContext = createContext<MemoryPairsContextValue | null>(null)

// Provider component
export function ArcadeMemoryPairsProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { activePlayerCount, activePlayers: activePlayerIds } = useGameMode()

  // Get active player IDs as numbers
  const activePlayers = Array.from(activePlayerIds).map((id, index) => index + 1)

  // Derive game mode from active player count
  const gameMode = activePlayerCount > 1 ? 'multiplayer' : 'single'

  // Arcade session integration
  const { state, sendMove, connected, exitSession } = useArcadeSession<MemoryPairsState>({
    userId: viewerId || '',
    initialState,
    applyMove: applyMoveOptimistically,
  })

  // Handle mismatch feedback timeout
  useEffect(() => {
    if (state.showMismatchFeedback && state.flippedCards.length === 2) {
      // After 1.5 seconds, clear the flipped cards and feedback
      const timeout = setTimeout(() => {
        sendMove({
          type: 'CLEAR_MISMATCH',
          data: {}
        })
      }, 1500)

      return () => clearTimeout(timeout)
    }
  }, [state.showMismatchFeedback, state.flippedCards.length, sendMove])

  // Computed values
  const isGameActive = state.gamePhase === 'playing'

  const canFlipCard = useCallback((cardId: string): boolean => {
    if (!isGameActive || state.isProcessingMove) return false

    const card = state.gameCards.find(c => c.id === cardId)
    if (!card || card.matched) return false

    // Can't flip if already flipped
    if (state.flippedCards.some(c => c.id === cardId)) return false

    // Can't flip more than 2 cards
    if (state.flippedCards.length >= 2) return false

    return true
  }, [isGameActive, state.isProcessingMove, state.gameCards, state.flippedCards])

  const currentGameStatistics: GameStatistics = useMemo(() => ({
    totalMoves: state.moves,
    matchedPairs: state.matchedPairs,
    totalPairs: state.totalPairs,
    gameTime: state.gameStartTime ?
      (state.gameEndTime || Date.now()) - state.gameStartTime : 0,
    accuracy: state.moves > 0 ? (state.matchedPairs / state.moves) * 100 : 0,
    averageTimePerMove: state.moves > 0 && state.gameStartTime ?
      ((state.gameEndTime || Date.now()) - state.gameStartTime) / state.moves : 0
  }), [state.moves, state.matchedPairs, state.totalPairs, state.gameStartTime, state.gameEndTime])

  // Action creators - send moves to arcade session
  const startGame = useCallback(() => {
    const cards = generateGameCards(state.gameType, state.difficulty)
    sendMove({
      type: 'START_GAME',
      data: {
        cards,
        activePlayers
      }
    })
  }, [state.gameType, state.difficulty, activePlayers, sendMove])

  const flipCard = useCallback((cardId: string) => {
    if (!canFlipCard(cardId)) return
    sendMove({
      type: 'FLIP_CARD',
      data: { cardId }
    })
  }, [canFlipCard, sendMove])

  const resetGame = useCallback(() => {
    // Delete current session and start a new game
    const cards = generateGameCards(state.gameType, state.difficulty)
    sendMove({
      type: 'START_GAME',
      data: {
        cards,
        activePlayers
      }
    })
  }, [state.gameType, state.difficulty, activePlayers, sendMove])

  const setGameType = useCallback((gameType: typeof state.gameType) => {
    // TODO: Implement via arcade session if needed
    console.warn('setGameType not yet implemented for arcade mode')
  }, [])

  const setDifficulty = useCallback((difficulty: typeof state.difficulty) => {
    // TODO: Implement via arcade session if needed
    console.warn('setDifficulty not yet implemented for arcade mode')
  }, [])

  const contextValue: MemoryPairsContextValue = {
    state: { ...state, gameMode },
    dispatch: () => {
      // No-op - replaced with sendMove
      console.warn('dispatch() is deprecated in arcade mode, use action creators instead')
    },
    isGameActive,
    canFlipCard,
    currentGameStatistics,
    startGame,
    flipCard,
    resetGame,
    setGameType,
    setDifficulty,
    exitSession,
    gameMode,
    activePlayers
  }

  return (
    <ArcadeMemoryPairsContext.Provider value={contextValue}>
      {children}
    </ArcadeMemoryPairsContext.Provider>
  )
}

// Hook to use the context
export function useArcadeMemoryPairs(): MemoryPairsContextValue {
  const context = useContext(ArcadeMemoryPairsContext)
  if (!context) {
    throw new Error('useArcadeMemoryPairs must be used within an ArcadeMemoryPairsProvider')
  }
  return context
}
