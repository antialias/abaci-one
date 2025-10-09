'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useReducer } from 'react'
import { useRouter } from 'next/navigation'
import { useArcadeRedirect } from '@/hooks/useArcadeRedirect'
import { useViewerId } from '@/hooks/useViewerId'
import { useGameMode } from '../../../../contexts/GameModeContext'
import { generateGameCards } from '../utils/cardGeneration'
import { validateMatch } from '../utils/matchValidation'
import { MemoryPairsContext } from './MemoryPairsContext'
import type { GameMode, GameStatistics, MemoryPairsContextValue, MemoryPairsState } from './types'

// Initial state for local-only games
const initialState: MemoryPairsState = {
  cards: [],
  gameCards: [],
  flippedCards: [],
  gameType: 'abacus-numeral',
  difficulty: 6,
  turnTimer: 30,
  gamePhase: 'setup',
  currentPlayer: '',
  matchedPairs: 0,
  totalPairs: 6,
  moves: 0,
  scores: {},
  activePlayers: [],
  playerMetadata: {},
  consecutiveMatches: {},
  gameStartTime: null,
  gameEndTime: null,
  currentMoveStartTime: null,
  timerInterval: null,
  celebrationAnimations: [],
  isProcessingMove: false,
  showMismatchFeedback: false,
  lastMatchedPair: null,
  originalConfig: undefined,
  pausedGamePhase: undefined,
  pausedGameState: undefined,
  playerHovers: {},
}

// Action types for local reducer
type LocalAction =
  | { type: 'START_GAME'; cards: any[]; activePlayers: string[]; playerMetadata: any }
  | { type: 'FLIP_CARD'; cardId: string }
  | { type: 'MATCH_FOUND'; cardIds: [string, string]; playerId: string }
  | { type: 'MATCH_FAILED'; cardIds: [string, string] }
  | { type: 'CLEAR_MISMATCH' }
  | { type: 'SWITCH_PLAYER' }
  | { type: 'GO_TO_SETUP' }
  | { type: 'SET_CONFIG'; field: string; value: any }
  | { type: 'RESUME_GAME' }
  | { type: 'HOVER_CARD'; playerId: string; cardId: string | null }
  | { type: 'END_GAME' }

// Pure client-side reducer with complete game logic
function localMemoryPairsReducer(state: MemoryPairsState, action: LocalAction): MemoryPairsState {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...state,
        gamePhase: 'playing',
        gameCards: action.cards,
        cards: action.cards,
        flippedCards: [],
        matchedPairs: 0,
        moves: 0,
        scores: action.activePlayers.reduce((acc: any, p: string) => ({ ...acc, [p]: 0 }), {}),
        consecutiveMatches: action.activePlayers.reduce((acc: any, p: string) => ({ ...acc, [p]: 0 }), {}),
        activePlayers: action.activePlayers,
        playerMetadata: action.playerMetadata,
        currentPlayer: action.activePlayers[0] || '',
        gameStartTime: Date.now(),
        gameEndTime: null,
        currentMoveStartTime: Date.now(),
        celebrationAnimations: [],
        isProcessingMove: false,
        showMismatchFeedback: false,
        lastMatchedPair: null,
        originalConfig: {
          gameType: state.gameType,
          difficulty: state.difficulty,
          turnTimer: state.turnTimer,
        },
        pausedGamePhase: undefined,
        pausedGameState: undefined,
      }

    case 'FLIP_CARD': {
      const card = state.gameCards.find((c) => c.id === action.cardId)
      if (!card) return state

      const newFlippedCards = [...state.flippedCards, card]

      return {
        ...state,
        flippedCards: newFlippedCards,
        currentMoveStartTime: state.flippedCards.length === 0 ? Date.now() : state.currentMoveStartTime,
        isProcessingMove: newFlippedCards.length === 2,
        showMismatchFeedback: false,
      }
    }

    case 'MATCH_FOUND': {
      const [id1, id2] = action.cardIds
      const updatedCards = state.gameCards.map((card) =>
        card.id === id1 || card.id === id2
          ? { ...card, matched: true, matchedBy: action.playerId }
          : card
      )

      const newMatchedPairs = state.matchedPairs + 1
      const newScores = {
        ...state.scores,
        [action.playerId]: (state.scores[action.playerId] || 0) + 1,
      }
      const newConsecutiveMatches = {
        ...state.consecutiveMatches,
        [action.playerId]: (state.consecutiveMatches[action.playerId] || 0) + 1,
      }

      // Check if game is complete
      const gameComplete = newMatchedPairs >= state.totalPairs

      return {
        ...state,
        gameCards: updatedCards,
        cards: updatedCards,
        flippedCards: [],
        matchedPairs: newMatchedPairs,
        moves: state.moves + 1,
        scores: newScores,
        consecutiveMatches: newConsecutiveMatches,
        lastMatchedPair: action.cardIds,
        isProcessingMove: false,
        showMismatchFeedback: false,
        gamePhase: gameComplete ? 'results' : state.gamePhase,
        gameEndTime: gameComplete ? Date.now() : null,
        // Player keeps their turn on match
      }
    }

    case 'MATCH_FAILED': {
      // Reset consecutive matches for current player
      const newConsecutiveMatches = {
        ...state.consecutiveMatches,
        [state.currentPlayer]: 0,
      }

      return {
        ...state,
        moves: state.moves + 1,
        showMismatchFeedback: true,
        isProcessingMove: true,
        consecutiveMatches: newConsecutiveMatches,
        // Don't clear flipped cards yet - CLEAR_MISMATCH will do that
      }
    }

    case 'CLEAR_MISMATCH': {
      return {
        ...state,
        flippedCards: [],
        showMismatchFeedback: false,
        isProcessingMove: false,
      }
    }

    case 'SWITCH_PLAYER': {
      const currentIndex = state.activePlayers.indexOf(state.currentPlayer)
      const nextIndex = (currentIndex + 1) % state.activePlayers.length
      const nextPlayer = state.activePlayers[nextIndex]

      return {
        ...state,
        currentPlayer: nextPlayer,
        currentMoveStartTime: Date.now(),
      }
    }

    case 'GO_TO_SETUP': {
      const isPausingGame = state.gamePhase === 'playing' || state.gamePhase === 'results'

      return {
        ...state,
        gamePhase: 'setup',
        pausedGamePhase: isPausingGame ? state.gamePhase : undefined,
        pausedGameState: isPausingGame
          ? {
              gameCards: state.gameCards,
              currentPlayer: state.currentPlayer,
              matchedPairs: state.matchedPairs,
              moves: state.moves,
              scores: state.scores,
              activePlayers: state.activePlayers,
              playerMetadata: state.playerMetadata || {},
              consecutiveMatches: state.consecutiveMatches,
              gameStartTime: state.gameStartTime,
            }
          : undefined,
        gameCards: [],
        cards: [],
        flippedCards: [],
        currentPlayer: '',
        matchedPairs: 0,
        moves: 0,
        scores: {},
        activePlayers: [],
        playerMetadata: {},
        consecutiveMatches: {},
        gameStartTime: null,
        gameEndTime: null,
        currentMoveStartTime: null,
        celebrationAnimations: [],
        isProcessingMove: false,
        showMismatchFeedback: false,
        lastMatchedPair: null,
      }
    }

    case 'SET_CONFIG': {
      const clearPausedGame = !!state.pausedGamePhase

      return {
        ...state,
        [action.field]: action.value,
        ...(action.field === 'difficulty' ? { totalPairs: action.value } : {}),
        ...(clearPausedGame
          ? { pausedGamePhase: undefined, pausedGameState: undefined, originalConfig: undefined }
          : {}),
      }
    }

    case 'RESUME_GAME': {
      if (!state.pausedGamePhase || !state.pausedGameState) {
        return state
      }

      return {
        ...state,
        gamePhase: state.pausedGamePhase,
        gameCards: state.pausedGameState.gameCards,
        cards: state.pausedGameState.gameCards,
        currentPlayer: state.pausedGameState.currentPlayer,
        matchedPairs: state.pausedGameState.matchedPairs,
        moves: state.pausedGameState.moves,
        scores: state.pausedGameState.scores,
        activePlayers: state.pausedGameState.activePlayers,
        playerMetadata: state.pausedGameState.playerMetadata,
        consecutiveMatches: state.pausedGameState.consecutiveMatches,
        gameStartTime: state.pausedGameState.gameStartTime,
        pausedGamePhase: undefined,
        pausedGameState: undefined,
      }
    }

    case 'HOVER_CARD': {
      return {
        ...state,
        playerHovers: {
          ...state.playerHovers,
          [action.playerId]: action.cardId,
        },
      }
    }

    case 'END_GAME': {
      return {
        ...state,
        gamePhase: 'results',
        gameEndTime: Date.now(),
      }
    }

    default:
      return state
  }
}

// Provider component for LOCAL-ONLY play (no network, no arcade session)
export function LocalMemoryPairsProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { data: viewerId } = useViewerId()
  const { activePlayerCount, activePlayers: activePlayerIds, players } = useGameMode()

  // Use arcade redirect to determine button visibility
  const { canModifyPlayers } = useArcadeRedirect({ currentGame: 'matching' })

  // Get active player IDs as array
  const activePlayers = Array.from(activePlayerIds)

  // Derive game mode from active player count
  const gameMode = activePlayerCount > 1 ? 'multiplayer' : 'single'

  // Pure client-side state with useReducer
  const [state, dispatch] = useReducer(localMemoryPairsReducer, initialState)

  // Handle mismatch feedback timeout and player switching
  useEffect(() => {
    if (state.showMismatchFeedback && state.flippedCards.length === 2) {
      const timeout = setTimeout(() => {
        dispatch({ type: 'CLEAR_MISMATCH' })
        // Switch to next player after mismatch
        dispatch({ type: 'SWITCH_PLAYER' })
      }, 1500)

      return () => clearTimeout(timeout)
    }
  }, [state.showMismatchFeedback, state.flippedCards.length])

  // Handle automatic match checking when 2 cards flipped
  useEffect(() => {
    if (state.flippedCards.length === 2 && !state.showMismatchFeedback) {
      const [card1, card2] = state.flippedCards
      const isMatch = validateMatch(card1, card2)

      const timeout = setTimeout(() => {
        if (isMatch.isValid) {
          dispatch({
            type: 'MATCH_FOUND',
            cardIds: [card1.id, card2.id],
            playerId: state.currentPlayer,
          })
          // Player keeps turn on match - no SWITCH_PLAYER
        } else {
          dispatch({
            type: 'MATCH_FAILED',
            cardIds: [card1.id, card2.id],
          })
          // SWITCH_PLAYER will happen after CLEAR_MISMATCH timeout
        }
      }, 600) // Small delay to show both cards

      return () => clearTimeout(timeout)
    }
  }, [state.flippedCards, state.showMismatchFeedback, state.currentPlayer])

  // Computed values
  const isGameActive = state.gamePhase === 'playing'

  const canFlipCard = useCallback(
    (cardId: string): boolean => {
      if (!isGameActive || state.isProcessingMove) {
        return false
      }

      const card = state.gameCards.find((c) => c.id === cardId)
      if (!card || card.matched) {
        return false
      }

      if (state.flippedCards.some((c) => c.id === cardId)) {
        return false
      }

      if (state.flippedCards.length >= 2) {
        return false
      }

      // In local play, all local players can flip during their turn
      const currentPlayerData = players.get(state.currentPlayer)
      if (currentPlayerData && currentPlayerData.isLocal === false) {
        return false
      }

      return true
    },
    [isGameActive, state.isProcessingMove, state.gameCards, state.flippedCards, state.currentPlayer, players]
  )

  const currentGameStatistics: GameStatistics = useMemo(
    () => ({
      totalMoves: state.moves,
      matchedPairs: state.matchedPairs,
      totalPairs: state.totalPairs,
      gameTime: state.gameStartTime ? (state.gameEndTime || Date.now()) - state.gameStartTime : 0,
      accuracy: state.moves > 0 ? (state.matchedPairs / state.moves) * 100 : 0,
      averageTimePerMove:
        state.moves > 0 && state.gameStartTime
          ? ((state.gameEndTime || Date.now()) - state.gameStartTime) / state.moves
          : 0,
    }),
    [state.moves, state.matchedPairs, state.totalPairs, state.gameStartTime, state.gameEndTime]
  )

  const hasConfigChanged = useMemo(() => {
    if (!state.originalConfig) return false
    return (
      state.gameType !== state.originalConfig.gameType ||
      state.difficulty !== state.originalConfig.difficulty ||
      state.turnTimer !== state.originalConfig.turnTimer
    )
  }, [state.gameType, state.difficulty, state.turnTimer, state.originalConfig])

  const canResumeGame = useMemo(() => {
    return !!state.pausedGamePhase && !!state.pausedGameState && !hasConfigChanged
  }, [state.pausedGamePhase, state.pausedGameState, hasConfigChanged])

  // Action creators
  const startGame = useCallback(() => {
    if (activePlayers.length === 0) {
      console.error('[LocalMemoryPairs] Cannot start game without active players')
      return
    }

    const playerMetadata: { [playerId: string]: any } = {}
    for (const playerId of activePlayers) {
      const playerData = players.get(playerId)
      if (playerData) {
        playerMetadata[playerId] = {
          id: playerId,
          name: playerData.name,
          emoji: playerData.emoji,
          userId: viewerId || '',
          color: playerData.color,
        }
      }
    }

    const cards = generateGameCards(state.gameType, state.difficulty)
    dispatch({
      type: 'START_GAME',
      cards,
      activePlayers,
      playerMetadata,
    })
  }, [state.gameType, state.difficulty, activePlayers, players, viewerId])

  const flipCard = useCallback(
    (cardId: string) => {
      if (!canFlipCard(cardId)) {
        return
      }
      dispatch({ type: 'FLIP_CARD', cardId })
    },
    [canFlipCard]
  )

  const resetGame = useCallback(() => {
    if (activePlayers.length === 0) {
      console.error('[LocalMemoryPairs] Cannot reset game without active players')
      return
    }

    const playerMetadata: { [playerId: string]: any } = {}
    for (const playerId of activePlayers) {
      const playerData = players.get(playerId)
      if (playerData) {
        playerMetadata[playerId] = {
          id: playerId,
          name: playerData.name,
          emoji: playerData.emoji,
          userId: viewerId || '',
          color: playerData.color,
        }
      }
    }

    const cards = generateGameCards(state.gameType, state.difficulty)
    dispatch({
      type: 'START_GAME',
      cards,
      activePlayers,
      playerMetadata,
    })
  }, [state.gameType, state.difficulty, activePlayers, players, viewerId])

  const setGameType = useCallback((gameType: typeof state.gameType) => {
    dispatch({ type: 'SET_CONFIG', field: 'gameType', value: gameType })
  }, [])

  const setDifficulty = useCallback((difficulty: typeof state.difficulty) => {
    dispatch({ type: 'SET_CONFIG', field: 'difficulty', value: difficulty })
  }, [])

  const setTurnTimer = useCallback((turnTimer: typeof state.turnTimer) => {
    dispatch({ type: 'SET_CONFIG', field: 'turnTimer', value: turnTimer })
  }, [])

  const resumeGame = useCallback(() => {
    if (!canResumeGame) {
      console.warn('[LocalMemoryPairs] Cannot resume - no paused game or config changed')
      return
    }
    dispatch({ type: 'RESUME_GAME' })
  }, [canResumeGame])

  const goToSetup = useCallback(() => {
    dispatch({ type: 'GO_TO_SETUP' })
  }, [])

  const hoverCard = useCallback(
    (cardId: string | null) => {
      const playerId = state.currentPlayer || activePlayers[0] || ''
      if (!playerId) return

      dispatch({
        type: 'HOVER_CARD',
        playerId,
        cardId,
      })
    },
    [state.currentPlayer, activePlayers]
  )

  const exitSession = useCallback(() => {
    router.push('/arcade')
  }, [router])

  const effectiveState = { ...state, gameMode } as MemoryPairsState & { gameMode: GameMode }

  const contextValue: MemoryPairsContextValue = {
    state: effectiveState,
    dispatch: () => {
      // No-op - local provider uses action creators instead
      console.warn('dispatch() is not available in local mode, use action creators instead')
    },
    isGameActive,
    canFlipCard,
    currentGameStatistics,
    hasConfigChanged,
    canResumeGame,
    canModifyPlayers,
    startGame,
    resumeGame,
    flipCard,
    resetGame,
    goToSetup,
    setGameType,
    setDifficulty,
    setTurnTimer,
    hoverCard,
    exitSession,
    gameMode,
    activePlayers,
  }

  return <MemoryPairsContext.Provider value={contextValue}>{children}</MemoryPairsContext.Provider>
}
