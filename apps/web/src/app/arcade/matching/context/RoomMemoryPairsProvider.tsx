'use client'

import { type ReactNode, useCallback, useEffect, useMemo } from 'react'
import { useArcadeRedirect } from '@/hooks/useArcadeRedirect'
import { useArcadeSession } from '@/hooks/useArcadeSession'
import { useRoomData } from '@/hooks/useRoomData'
import { useViewerId } from '@/hooks/useViewerId'
import type { GameMove } from '@/lib/arcade/validation'
import { useGameMode } from '../../../../contexts/GameModeContext'
import { generateGameCards } from '../utils/cardGeneration'
import { MemoryPairsContext } from './MemoryPairsContext'
import type { GameMode, GameStatistics, MemoryPairsContextValue, MemoryPairsState } from './types'

// Initial state
const initialState: MemoryPairsState = {
  cards: [],
  gameCards: [],
  flippedCards: [],
  gameType: 'abacus-numeral',
  difficulty: 6,
  turnTimer: 30,
  gamePhase: 'setup',
  currentPlayer: '', // Will be set to first player ID on START_GAME
  matchedPairs: 0,
  totalPairs: 6,
  moves: 0,
  scores: {},
  activePlayers: [],
  playerMetadata: {}, // Player metadata for cross-user visibility
  consecutiveMatches: {},
  gameStartTime: null,
  gameEndTime: null,
  currentMoveStartTime: null,
  timerInterval: null,
  celebrationAnimations: [],
  isProcessingMove: false,
  showMismatchFeedback: false,
  lastMatchedPair: null,
  // PAUSE/RESUME: Initialize paused game fields
  originalConfig: undefined,
  pausedGamePhase: undefined,
  pausedGameState: undefined,
  // HOVER: Initialize hover state
  playerHovers: {},
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
        scores: move.data.activePlayers.reduce((acc: any, p: string) => ({ ...acc, [p]: 0 }), {}),
        consecutiveMatches: move.data.activePlayers.reduce(
          (acc: any, p: string) => ({ ...acc, [p]: 0 }),
          {}
        ),
        activePlayers: move.data.activePlayers,
        playerMetadata: move.data.playerMetadata || {}, // Include player metadata
        currentPlayer: move.data.activePlayers[0] || '',
        gameStartTime: Date.now(),
        gameEndTime: null,
        currentMoveStartTime: Date.now(),
        celebrationAnimations: [],
        isProcessingMove: false,
        showMismatchFeedback: false,
        lastMatchedPair: null,
        // PAUSE/RESUME: Save original config and clear paused state
        originalConfig: {
          gameType: state.gameType,
          difficulty: state.difficulty,
          turnTimer: state.turnTimer,
        },
        pausedGamePhase: undefined,
        pausedGameState: undefined,
      }

    case 'FLIP_CARD': {
      // Optimistically flip the card
      const card = state.gameCards.find((c) => c.id === move.data.cardId)
      if (!card) return state

      const newFlippedCards = [...state.flippedCards, card]

      return {
        ...state,
        flippedCards: newFlippedCards,
        currentMoveStartTime:
          state.flippedCards.length === 0 ? Date.now() : state.currentMoveStartTime,
        isProcessingMove: newFlippedCards.length === 2, // Processing if 2 cards flipped
        showMismatchFeedback: false,
      }
    }

    case 'CLEAR_MISMATCH': {
      // Clear mismatched cards and feedback
      return {
        ...state,
        flippedCards: [],
        showMismatchFeedback: false,
        isProcessingMove: false,
      }
    }

    case 'GO_TO_SETUP': {
      // Return to setup phase - pause game if coming from playing/results
      const isPausingGame = state.gamePhase === 'playing' || state.gamePhase === 'results'

      return {
        ...state,
        gamePhase: 'setup',
        // PAUSE: Save game state if pausing from active game
        pausedGamePhase: isPausingGame ? state.gamePhase : undefined,
        pausedGameState: isPausingGame
          ? {
              gameCards: state.gameCards,
              currentPlayer: state.currentPlayer,
              matchedPairs: state.matchedPairs,
              moves: state.moves,
              scores: state.scores,
              activePlayers: state.activePlayers,
              playerMetadata: state.playerMetadata,
              consecutiveMatches: state.consecutiveMatches,
              gameStartTime: state.gameStartTime,
            }
          : undefined,
        // Reset visible game state
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
      // Update configuration field optimistically
      const { field, value } = move.data as { field: string; value: any }
      const clearPausedGame = !!state.pausedGamePhase

      return {
        ...state,
        [field]: value,
        // Update totalPairs if difficulty changes
        ...(field === 'difficulty' ? { totalPairs: value } : {}),
        // Clear paused game if config changed
        ...(clearPausedGame
          ? { pausedGamePhase: undefined, pausedGameState: undefined, originalConfig: undefined }
          : {}),
      }
    }

    case 'RESUME_GAME': {
      // Resume paused game
      if (!state.pausedGamePhase || !state.pausedGameState) {
        return state // No paused game, no-op
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
        // Clear paused state
        pausedGamePhase: undefined,
        pausedGameState: undefined,
      }
    }

    case 'HOVER_CARD': {
      // Update player hover state for networked presence
      return {
        ...state,
        playerHovers: {
          ...state.playerHovers,
          [move.playerId]: move.data.cardId,
        },
      }
    }

    default:
      return state
  }
}

// Provider component for ROOM-BASED play (with network sync)
export function RoomMemoryPairsProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData() // Fetch room data for room-based play
  const { activePlayerCount, activePlayers: activePlayerIds, players } = useGameMode()

  // Determine if we're in a room vs arcade session
  const isInRoom = !!roomData?.id

  // For arcade sessions (not in room), use arcade redirect logic
  // For rooms, we ignore this and always show buttons
  const arcadeRedirect = useArcadeRedirect({ currentGame: 'matching' })

  // Get active player IDs directly as strings (UUIDs)
  const activePlayers = Array.from(activePlayerIds)

  // Derive game mode from active player count
  const gameMode = activePlayerCount > 1 ? 'multiplayer' : 'single'

  // NO LOCAL STATE - Configuration lives in session state
  // Changes are sent as moves and synchronized across all room members

  // Arcade session integration WITH room sync
  const {
    state,
    sendMove,
    connected: _connected,
    exitSession,
  } = useArcadeSession<MemoryPairsState>({
    userId: viewerId || '',
    roomId: roomData?.id, // CRITICAL: Pass roomId for network sync across room members
    initialState,
    applyMove: applyMoveOptimistically,
  })

  // Handle mismatch feedback timeout
  useEffect(() => {
    if (state.showMismatchFeedback && state.flippedCards.length === 2) {
      // After 1.5 seconds, send CLEAR_MISMATCH
      // Server will validate that cards are still in mismatch state before clearing
      const timeout = setTimeout(() => {
        sendMove({
          type: 'CLEAR_MISMATCH',
          playerId: state.currentPlayer,
          data: {},
        })
      }, 1500)

      return () => clearTimeout(timeout)
    }
  }, [state.showMismatchFeedback, state.flippedCards.length, sendMove, state.currentPlayer])

  // Computed values
  const isGameActive = state.gamePhase === 'playing'

  const canFlipCard = useCallback(
    (cardId: string): boolean => {
      console.log('[RoomProvider][canFlipCard] Checking card:', {
        cardId,
        isGameActive,
        isProcessingMove: state.isProcessingMove,
        currentPlayer: state.currentPlayer,
        hasRoomData: !!roomData,
        flippedCardsCount: state.flippedCards.length,
      })

      if (!isGameActive || state.isProcessingMove) {
        console.log('[RoomProvider][canFlipCard] Blocked: game not active or processing')
        return false
      }

      const card = state.gameCards.find((c) => c.id === cardId)
      if (!card || card.matched) {
        console.log('[RoomProvider][canFlipCard] Blocked: card not found or already matched')
        return false
      }

      // Can't flip if already flipped
      if (state.flippedCards.some((c) => c.id === cardId)) {
        console.log('[RoomProvider][canFlipCard] Blocked: card already flipped')
        return false
      }

      // Can't flip more than 2 cards
      if (state.flippedCards.length >= 2) {
        console.log('[RoomProvider][canFlipCard] Blocked: 2 cards already flipped')
        return false
      }

      // Authorization check: Only allow flipping if it's your player's turn
      if (roomData && state.currentPlayer) {
        const currentPlayerData = players.get(state.currentPlayer)
        console.log('[RoomProvider][canFlipCard] Authorization check:', {
          currentPlayerId: state.currentPlayer,
          currentPlayerFound: !!currentPlayerData,
          currentPlayerIsLocal: currentPlayerData?.isLocal,
        })

        // Block if current player is explicitly marked as remote (isLocal === false)
        if (currentPlayerData && currentPlayerData.isLocal === false) {
          console.log(
            '[RoomProvider][canFlipCard] BLOCKED: Current player is remote (not your turn)'
          )
          return false
        }

        // If player data not found in map, this might be an issue - allow for now but warn
        if (!currentPlayerData) {
          console.warn(
            '[RoomProvider][canFlipCard] WARNING: Current player not found in players map, allowing move'
          )
        }
      }

      console.log('[RoomProvider][canFlipCard] ALLOWED: All checks passed')
      return true
    },
    [
      isGameActive,
      state.isProcessingMove,
      state.gameCards,
      state.flippedCards,
      state.currentPlayer,
      roomData,
      players,
    ]
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

  // PAUSE/RESUME: Computed values for pause/resume functionality
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

  // Action creators - send moves to arcade session
  const startGame = useCallback(() => {
    // Must have at least one active player
    if (activePlayers.length === 0) {
      console.error('[RoomMemoryPairs] Cannot start game without active players')
      return
    }

    // Capture player metadata from local players map
    // This ensures all room members can display player info even if they don't own the players
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

    // Use current session state configuration (no local state!)
    const cards = generateGameCards(state.gameType, state.difficulty)
    // Use first active player as playerId for START_GAME move
    const firstPlayer = activePlayers[0]
    sendMove({
      type: 'START_GAME',
      playerId: firstPlayer,
      data: {
        cards,
        activePlayers,
        playerMetadata,
      },
    })
  }, [state.gameType, state.difficulty, activePlayers, players, viewerId, sendMove])

  const flipCard = useCallback(
    (cardId: string) => {
      console.log('[RoomProvider] flipCard called:', {
        cardId,
        viewerId,
        currentPlayer: state.currentPlayer,
        activePlayers: state.activePlayers,
        gamePhase: state.gamePhase,
        canFlip: canFlipCard(cardId),
      })

      if (!canFlipCard(cardId)) {
        console.log('[RoomProvider] Cannot flip card - canFlipCard returned false')
        return
      }

      const move = {
        type: 'FLIP_CARD' as const,
        playerId: state.currentPlayer, // Use the current player ID from game state (database player ID)
        data: { cardId },
      }
      console.log('[RoomProvider] Sending FLIP_CARD move via sendMove:', move)
      sendMove(move)
    },
    [canFlipCard, sendMove, viewerId, state.currentPlayer, state.activePlayers, state.gamePhase]
  )

  const resetGame = useCallback(() => {
    // Must have at least one active player
    if (activePlayers.length === 0) {
      console.error('[RoomMemoryPairs] Cannot reset game without active players')
      return
    }

    // Capture player metadata from local players map
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

    // Use current session state configuration (no local state!)
    const cards = generateGameCards(state.gameType, state.difficulty)
    // Use first active player as playerId for START_GAME move
    const firstPlayer = activePlayers[0]
    sendMove({
      type: 'START_GAME',
      playerId: firstPlayer,
      data: {
        cards,
        activePlayers,
        playerMetadata,
      },
    })
  }, [state.gameType, state.difficulty, activePlayers, players, viewerId, sendMove])

  const setGameType = useCallback(
    (gameType: typeof state.gameType) => {
      // Use first active player as playerId, or empty string if none
      const playerId = activePlayers[0] || ''
      sendMove({
        type: 'SET_CONFIG',
        playerId,
        data: { field: 'gameType', value: gameType },
      })
    },
    [activePlayers, sendMove]
  )

  const setDifficulty = useCallback(
    (difficulty: typeof state.difficulty) => {
      const playerId = activePlayers[0] || ''
      sendMove({
        type: 'SET_CONFIG',
        playerId,
        data: { field: 'difficulty', value: difficulty },
      })
    },
    [activePlayers, sendMove]
  )

  const setTurnTimer = useCallback(
    (turnTimer: typeof state.turnTimer) => {
      const playerId = activePlayers[0] || ''
      sendMove({
        type: 'SET_CONFIG',
        playerId,
        data: { field: 'turnTimer', value: turnTimer },
      })
    },
    [activePlayers, sendMove]
  )

  const goToSetup = useCallback(() => {
    // Send GO_TO_SETUP move - synchronized across all room members
    const playerId = activePlayers[0] || state.currentPlayer || ''
    sendMove({
      type: 'GO_TO_SETUP',
      playerId,
      data: {},
    })
  }, [activePlayers, state.currentPlayer, sendMove])

  const resumeGame = useCallback(() => {
    // PAUSE/RESUME: Resume paused game if config unchanged
    if (!canResumeGame) {
      console.warn('[RoomMemoryPairs] Cannot resume - no paused game or config changed')
      return
    }

    const playerId = activePlayers[0] || state.currentPlayer || ''
    sendMove({
      type: 'RESUME_GAME',
      playerId,
      data: {},
    })
  }, [canResumeGame, activePlayers, state.currentPlayer, sendMove])

  const hoverCard = useCallback(
    (cardId: string | null) => {
      // HOVER: Send hover state for networked presence
      // Use current player as the one hovering
      const playerId = state.currentPlayer || activePlayers[0] || ''
      if (!playerId) return // No active player to send hover for

      sendMove({
        type: 'HOVER_CARD',
        playerId,
        data: { cardId },
      })
    },
    [state.currentPlayer, activePlayers, sendMove]
  )

  // NO MORE effectiveState merging! Just use session state directly with gameMode added
  const effectiveState = { ...state, gameMode } as MemoryPairsState & { gameMode: GameMode }

  const contextValue: MemoryPairsContextValue = {
    state: effectiveState,
    dispatch: () => {
      // No-op - replaced with sendMove
      console.warn('dispatch() is deprecated in arcade mode, use action creators instead')
    },
    isGameActive,
    canFlipCard,
    currentGameStatistics,
    hasConfigChanged,
    canResumeGame,
    // Room-based: always show buttons (false = show buttons)
    // Arcade session: use arcade redirect logic to determine button visibility
    canModifyPlayers: isInRoom ? false : arcadeRedirect.canModifyPlayers,
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

// Export the hook for this provider
export { useMemoryPairs } from './MemoryPairsContext'
