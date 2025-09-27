'use client'

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react'
import { validateMatch } from '../utils/matchValidation'
import { generateGameCards } from '../utils/cardGeneration'
import type {
  MemoryPairsState,
  MemoryPairsAction,
  MemoryPairsContextValue,
  GameCard,
  GameStatistics,
  CelebrationAnimation
} from './types'

// Initial state
const initialState: MemoryPairsState = {
  // Core game data
  cards: [],
  gameCards: [],
  flippedCards: [],

  // Game configuration
  gameMode: 'single',
  gameType: 'abacus-numeral',
  difficulty: 6,
  turnTimer: 30,

  // Game progression
  gamePhase: 'setup',
  currentPlayer: 1,
  matchedPairs: 0,
  totalPairs: 6,
  moves: 0,
  scores: { player1: 0, player2: 0 },

  // Timing
  gameStartTime: null,
  gameEndTime: null,
  currentMoveStartTime: null,
  timerInterval: null,

  // UI state
  celebrationAnimations: [],
  isProcessingMove: false,
  showMismatchFeedback: false,
  lastMatchedPair: null
}

// Reducer function
function memoryPairsReducer(state: MemoryPairsState, action: MemoryPairsAction): MemoryPairsState {
  switch (action.type) {
    case 'SET_GAME_MODE':
      return {
        ...state,
        gameMode: action.mode,
        // Reset scores when switching modes
        scores: { player1: 0, player2: 0 },
        currentPlayer: 1
      }

    case 'SET_GAME_TYPE':
      return {
        ...state,
        gameType: action.gameType
      }

    case 'SET_DIFFICULTY':
      return {
        ...state,
        difficulty: action.difficulty,
        totalPairs: action.difficulty
      }

    case 'SET_TURN_TIMER':
      return {
        ...state,
        turnTimer: action.timer
      }

    case 'START_GAME':
      return {
        ...state,
        gamePhase: 'playing',
        gameCards: action.cards,
        cards: action.cards,
        flippedCards: [],
        matchedPairs: 0,
        moves: 0,
        scores: { player1: 0, player2: 0 },
        currentPlayer: 1,
        gameStartTime: Date.now(),
        gameEndTime: null,
        currentMoveStartTime: Date.now(),
        celebrationAnimations: [],
        isProcessingMove: false,
        showMismatchFeedback: false,
        lastMatchedPair: null
      }

    case 'FLIP_CARD': {
      const cardToFlip = state.gameCards.find(card => card.id === action.cardId)
      if (!cardToFlip || cardToFlip.matched || state.flippedCards.length >= 2 || state.isProcessingMove) {
        return state
      }

      const newFlippedCards = [...state.flippedCards, cardToFlip]
      const newMoveStartTime = state.flippedCards.length === 0 ? Date.now() : state.currentMoveStartTime

      return {
        ...state,
        flippedCards: newFlippedCards,
        currentMoveStartTime: newMoveStartTime,
        showMismatchFeedback: false
      }
    }

    case 'MATCH_FOUND': {
      const [card1Id, card2Id] = action.cardIds
      const updatedCards = state.gameCards.map(card => {
        if (card.id === card1Id || card.id === card2Id) {
          return {
            ...card,
            matched: true,
            matchedBy: state.currentPlayer
          }
        }
        return card
      })

      const newMatchedPairs = state.matchedPairs + 1
      const newScores = {
        ...state.scores,
        [`player${state.currentPlayer}` as keyof typeof state.scores]:
          state.scores[`player${state.currentPlayer}` as keyof typeof state.scores] + 1
      }

      // Check if game is complete
      const isGameComplete = newMatchedPairs === state.totalPairs

      return {
        ...state,
        gameCards: updatedCards,
        matchedPairs: newMatchedPairs,
        scores: newScores,
        flippedCards: [],
        moves: state.moves + 1,
        lastMatchedPair: action.cardIds,
        gamePhase: isGameComplete ? 'results' : 'playing',
        gameEndTime: isGameComplete ? Date.now() : null,
        isProcessingMove: false
        // Note: Player keeps turn after successful match in two-player mode
      }
    }

    case 'MATCH_FAILED': {
      const newCurrentPlayer = state.gameMode === 'two-player'
        ? (state.currentPlayer === 1 ? 2 : 1)
        : state.currentPlayer

      return {
        ...state,
        flippedCards: [],
        currentPlayer: newCurrentPlayer,
        moves: state.moves + 1,
        showMismatchFeedback: true,
        isProcessingMove: false
      }
    }

    case 'SWITCH_PLAYER':
      return {
        ...state,
        currentPlayer: state.currentPlayer === 1 ? 2 : 1
      }

    case 'ADD_CELEBRATION':
      return {
        ...state,
        celebrationAnimations: [...state.celebrationAnimations, action.animation]
      }

    case 'REMOVE_CELEBRATION':
      return {
        ...state,
        celebrationAnimations: state.celebrationAnimations.filter(
          anim => anim.id !== action.animationId
        )
      }

    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessingMove: action.processing
      }

    case 'SET_MISMATCH_FEEDBACK':
      return {
        ...state,
        showMismatchFeedback: action.show
      }

    case 'SHOW_RESULTS':
      return {
        ...state,
        gamePhase: 'results',
        gameEndTime: Date.now(),
        flippedCards: []
      }

    case 'RESET_GAME':
      return {
        ...initialState,
        gameMode: state.gameMode,
        gameType: state.gameType,
        difficulty: state.difficulty,
        turnTimer: state.turnTimer,
        totalPairs: state.difficulty
      }

    case 'UPDATE_TIMER':
      // This can be used for any timer-related updates
      return state

    default:
      return state
  }
}

// Create context
const MemoryPairsContext = createContext<MemoryPairsContextValue | null>(null)

// Provider component
export function MemoryPairsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(memoryPairsReducer, initialState)

  // Handle card matching logic when two cards are flipped
  useEffect(() => {
    if (state.flippedCards.length === 2 && !state.isProcessingMove) {
      dispatch({ type: 'SET_PROCESSING', processing: true })

      const [card1, card2] = state.flippedCards
      const matchResult = validateMatch(card1, card2)

      // Delay to allow card flip animation
      setTimeout(() => {
        if (matchResult.isValid) {
          dispatch({ type: 'MATCH_FOUND', cardIds: [card1.id, card2.id] })
        } else {
          dispatch({ type: 'MATCH_FAILED', cardIds: [card1.id, card2.id] })
        }
      }, 1000) // Give time to see both cards
    }
  }, [state.flippedCards, state.isProcessingMove])

  // Auto-hide mismatch feedback
  useEffect(() => {
    if (state.showMismatchFeedback) {
      const timeout = setTimeout(() => {
        dispatch({ type: 'SET_MISMATCH_FEEDBACK', show: false })
      }, 2000)

      return () => clearTimeout(timeout)
    }
  }, [state.showMismatchFeedback])

  // Computed values
  const isGameActive = state.gamePhase === 'playing'

  const canFlipCard = (cardId: string): boolean => {
    if (!isGameActive || state.isProcessingMove) return false

    const card = state.gameCards.find(c => c.id === cardId)
    if (!card || card.matched) return false

    // Can't flip if already flipped
    if (state.flippedCards.some(c => c.id === cardId)) return false

    // Can't flip more than 2 cards
    if (state.flippedCards.length >= 2) return false

    return true
  }

  const currentGameStatistics: GameStatistics = {
    totalMoves: state.moves,
    matchedPairs: state.matchedPairs,
    totalPairs: state.totalPairs,
    gameTime: state.gameStartTime ?
      (state.gameEndTime || Date.now()) - state.gameStartTime : 0,
    accuracy: state.moves > 0 ? (state.matchedPairs / state.moves) * 100 : 0,
    averageTimePerMove: state.moves > 0 && state.gameStartTime ?
      ((state.gameEndTime || Date.now()) - state.gameStartTime) / state.moves : 0
  }

  // Action creators
  const startGame = () => {
    const cards = generateGameCards(state.gameType, state.difficulty)
    dispatch({ type: 'START_GAME', cards })
  }

  const flipCard = (cardId: string) => {
    if (!canFlipCard(cardId)) return
    dispatch({ type: 'FLIP_CARD', cardId })
  }

  const resetGame = () => {
    dispatch({ type: 'RESET_GAME' })
  }

  const setGameMode = (mode: typeof state.gameMode) => {
    dispatch({ type: 'SET_GAME_MODE', mode })
  }

  const setGameType = (gameType: typeof state.gameType) => {
    dispatch({ type: 'SET_GAME_TYPE', gameType })
  }

  const setDifficulty = (difficulty: typeof state.difficulty) => {
    dispatch({ type: 'SET_DIFFICULTY', difficulty })
  }

  const contextValue: MemoryPairsContextValue = {
    state,
    dispatch,
    isGameActive,
    canFlipCard,
    currentGameStatistics,
    startGame,
    flipCard,
    resetGame,
    setGameMode,
    setGameType,
    setDifficulty
  }

  return (
    <MemoryPairsContext.Provider value={contextValue}>
      {children}
    </MemoryPairsContext.Provider>
  )
}

// Hook to use the context
export function useMemoryPairs(): MemoryPairsContextValue {
  const context = useContext(MemoryPairsContext)
  if (!context) {
    throw new Error('useMemoryPairs must be used within a MemoryPairsProvider')
  }
  return context
}