'use client'

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  createContext,
  useContext,
} from 'react'
import { useArcadeSession } from '@/hooks/useArcadeSession'
import { useRoomData, useUpdateGameConfig, useClearRoomGame } from '@/hooks/useRoomData'
import { useViewerId } from '@/hooks/useViewerId'
import {
  buildPlayerMetadata as buildPlayerMetadataUtil,
  buildPlayerOwnershipFromRoomData,
} from '@/lib/arcade/player-ownership.client'
import type { GameMove } from '@/lib/arcade/validation'
import { useGameMode } from '@/contexts/GameModeContext'
import { useGameCompletionCallback } from '@/contexts/GameCompletionContext'
import { generateGameCards } from './utils/cardGeneration'
import type {
  GameMode,
  GameStatistics,
  MatchingContextValue,
  MatchingState,
  MatchingMove,
} from './types'

// Create context for Matching game
const MatchingContext = createContext<MatchingContextValue | null>(null)

// Initial state
const initialState: MatchingState = {
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
function applyMoveOptimistically(state: MatchingState, move: GameMove): MatchingState {
  const typedMove = move as MatchingMove
  switch (typedMove.type) {
    case 'START_GAME':
      // Generate cards and initialize game
      return {
        ...state,
        gamePhase: 'playing',
        gameCards: typedMove.data.cards,
        cards: typedMove.data.cards,
        flippedCards: [],
        matchedPairs: 0,
        moves: 0,
        scores: typedMove.data.activePlayers.reduce(
          (acc: any, p: string) => ({ ...acc, [p]: 0 }),
          {}
        ),
        consecutiveMatches: typedMove.data.activePlayers.reduce(
          (acc: any, p: string) => ({ ...acc, [p]: 0 }),
          {}
        ),
        activePlayers: typedMove.data.activePlayers,
        playerMetadata: typedMove.data.playerMetadata || {}, // Include player metadata
        currentPlayer: typedMove.data.activePlayers[0] || '',
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
      // Defensive check: ensure arrays exist
      const gameCards = state.gameCards || []
      const flippedCards = state.flippedCards || []

      const card = gameCards.find((c) => c.id === typedMove.data.cardId)
      if (!card) return state

      const newFlippedCards = [...flippedCards, card]

      return {
        ...state,
        flippedCards: newFlippedCards,
        currentMoveStartTime: flippedCards.length === 0 ? Date.now() : state.currentMoveStartTime,
        isProcessingMove: newFlippedCards.length === 2, // Processing if 2 cards flipped
        showMismatchFeedback: false,
      }
    }

    case 'CLEAR_MISMATCH': {
      // Clear hover for all non-current players
      const clearedHovers = { ...state.playerHovers }
      for (const playerId of state.activePlayers) {
        if (playerId !== state.currentPlayer) {
          clearedHovers[playerId] = null
        }
      }

      // Clear mismatched cards and feedback
      return {
        ...state,
        flippedCards: [],
        showMismatchFeedback: false,
        isProcessingMove: false,
        // Clear hovers for non-current players
        playerHovers: clearedHovers,
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
      const { field, value } = typedMove.data
      const clearPausedGame = !!state.pausedGamePhase

      return {
        ...state,
        [field]: value,
        // Update totalPairs if difficulty changes
        ...(field === 'difficulty' ? { totalPairs: value } : {}),
        // Clear paused game if config changed
        ...(clearPausedGame
          ? {
              pausedGamePhase: undefined,
              pausedGameState: undefined,
              originalConfig: undefined,
            }
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
          [typedMove.playerId]: typedMove.data.cardId,
        },
      }
    }

    default:
      return state
  }
}

// Provider component for ROOM-BASED play (with network sync)
// NOTE: This provider should ONLY be used for room-based multiplayer games.
// For arcade sessions without rooms, use LocalMemoryPairsProvider instead.
export function MatchingProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData() // Fetch room data for room-based play
  const { activePlayerCount, activePlayers: activePlayerIds, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()
  const clearRoomGame = useClearRoomGame()

  // Get active player IDs directly as strings (UUIDs)
  const activePlayers = Array.from(activePlayerIds) as string[]

  // Derive game mode from active player count
  const gameMode = activePlayerCount > 1 ? 'multiplayer' : 'single'

  // Merge saved game config from room with initialState
  // Settings are scoped by game name to preserve settings when switching games
  const mergedInitialState = useMemo(() => {
    const gameConfig = roomData?.gameConfig as Record<string, any> | null | undefined

    if (!gameConfig) return initialState

    // Get settings for this specific game (matching)
    const savedConfig = gameConfig.matching as Record<string, any> | null | undefined
    if (!savedConfig) return initialState

    return {
      ...initialState,
      // Restore settings from saved config
      gameType: savedConfig.gameType ?? initialState.gameType,
      difficulty: savedConfig.difficulty ?? initialState.difficulty,
      turnTimer: savedConfig.turnTimer ?? initialState.turnTimer,
    }
  }, [roomData?.gameConfig])

  // Arcade session integration WITH room sync
  const {
    state,
    sendMove,
    connected: _connected,
    exitSession,
  } = useArcadeSession<MatchingState>({
    userId: viewerId || '',
    roomId: roomData?.id, // CRITICAL: Pass roomId for network sync across room members
    initialState: mergedInitialState,
    applyMove: applyMoveOptimistically,
  })

  // Notify parent (e.g., PracticeGameModeProvider) when game reaches 'results' phase
  const onGameComplete = useGameCompletionCallback()
  const previousPhaseRef = useRef<string | null>(null)
  useEffect(() => {
    if (state.gamePhase === 'results' && previousPhaseRef.current !== 'results' && onGameComplete) {
      onGameComplete(state as unknown as Record<string, unknown>)
    }
    previousPhaseRef.current = state.gamePhase
  }, [state.gamePhase, onGameComplete, state])

  // Detect state corruption/mismatch (e.g., game type mismatch between sessions)
  const hasStateCorruption =
    !state.gameCards || !state.flippedCards || !Array.isArray(state.gameCards)

  // Handle mismatch feedback timeout
  useEffect(() => {
    if (state.showMismatchFeedback && state.flippedCards?.length === 2) {
      // After 1.5 seconds, send CLEAR_MISMATCH
      // Server will validate that cards are still in mismatch state before clearing
      const timeout = setTimeout(() => {
        sendMove({
          type: 'CLEAR_MISMATCH',
          playerId: state.currentPlayer,
          userId: viewerId || '',
          data: {},
        })
      }, 1500)

      return () => clearTimeout(timeout)
    }
  }, [
    state.showMismatchFeedback,
    state.flippedCards?.length,
    sendMove,
    state.currentPlayer,
    viewerId,
  ])

  // Computed values
  const isGameActive = state.gamePhase === 'playing'

  const canFlipCard = useCallback(
    (cardId: string): boolean => {
      const flippedCards = state.flippedCards || []
      const gameCards = state.gameCards || []

      if (!isGameActive || state.isProcessingMove) return false
      if (!state.currentPlayer) return false

      const card = gameCards.find((c) => c.id === cardId)
      if (!card || card.matched) return false
      if (flippedCards.some((c) => c.id === cardId)) return false
      if (flippedCards.length >= 2) return false

      // Authorization check: Only allow flipping if it's your player's turn
      if (roomData && state.currentPlayer) {
        const currentPlayerData = players.get(state.currentPlayer)

        // Block if current player is explicitly marked as remote (isLocal === false)
        if (currentPlayerData && currentPlayerData.isLocal === false) {
          return false
        }
      }

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

  // Helper to build player metadata with correct userId ownership
  // Uses centralized ownership utilities
  const buildPlayerMetadata = useCallback(
    (playerIds: string[]) => {
      // Build ownership map from room data
      const playerOwnership = buildPlayerOwnershipFromRoomData(roomData)

      // Use centralized utility to build metadata
      return buildPlayerMetadataUtil(playerIds, playerOwnership, players, viewerId ?? undefined)
    },
    [players, roomData, viewerId]
  )

  // Action creators - send moves to arcade session
  const startGame = useCallback(() => {
    // Must have at least one active player
    if (activePlayers.length === 0) {
      console.error('[MatchingProvider] Cannot start game without active players')
      return
    }

    // Capture player metadata from local players map
    // This ensures all room members can display player info even if they don't own the players
    const playerMetadata = buildPlayerMetadata(activePlayers)

    // Use current session state configuration (no local state!)
    const cards = generateGameCards(state.gameType, state.difficulty)
    // Use first active player as playerId for START_GAME move
    const firstPlayer = activePlayers[0] as string
    sendMove({
      type: 'START_GAME',
      playerId: firstPlayer,
      userId: viewerId || '',
      data: {
        cards,
        activePlayers,
        playerMetadata,
      },
    })
  }, [state.gameType, state.difficulty, activePlayers, buildPlayerMetadata, sendMove, viewerId])

  const flipCard = useCallback(
    (cardId: string) => {
      if (!canFlipCard(cardId)) return

      sendMove({
        type: 'FLIP_CARD' as const,
        playerId: state.currentPlayer,
        userId: viewerId || '',
        data: { cardId },
      })
    },
    [canFlipCard, sendMove, viewerId, state.currentPlayer]
  )

  const resetGame = useCallback(() => {
    // Must have at least one active player
    if (activePlayers.length === 0) {
      console.error('[MatchingProvider] Cannot reset game without active players')
      return
    }

    // Capture player metadata with correct userId ownership
    const playerMetadata = buildPlayerMetadata(activePlayers)

    // Use current session state configuration (no local state!)
    const cards = generateGameCards(state.gameType, state.difficulty)
    // Use first active player as playerId for START_GAME move
    const firstPlayer = activePlayers[0] as string
    sendMove({
      type: 'START_GAME',
      playerId: firstPlayer,
      userId: viewerId || '',
      data: {
        cards,
        activePlayers,
        playerMetadata,
      },
    })
  }, [state.gameType, state.difficulty, activePlayers, buildPlayerMetadata, sendMove, viewerId])

  const setGameType = useCallback(
    (gameType: typeof state.gameType) => {
      const playerId = (activePlayers[0] as string) || ''
      sendMove({
        type: 'SET_CONFIG',
        playerId,
        userId: viewerId || '',
        data: { field: 'gameType', value: gameType },
      })

      // Save setting to room's gameConfig for persistence
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentMatchingConfig = (currentGameConfig.matching as Record<string, any>) || {}
        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            matching: { ...currentMatchingConfig, gameType },
          },
        })
      }
    },
    [activePlayers, sendMove, viewerId, roomData?.id, roomData?.gameConfig, updateGameConfig]
  )

  const setDifficulty = useCallback(
    (difficulty: typeof state.difficulty) => {
      const playerId = (activePlayers[0] as string) || ''
      sendMove({
        type: 'SET_CONFIG',
        playerId,
        userId: viewerId || '',
        data: { field: 'difficulty', value: difficulty },
      })

      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentMatchingConfig = (currentGameConfig.matching as Record<string, any>) || {}
        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            matching: { ...currentMatchingConfig, difficulty },
          },
        })
      }
    },
    [activePlayers, sendMove, viewerId, roomData?.id, roomData?.gameConfig, updateGameConfig]
  )

  const setTurnTimer = useCallback(
    (turnTimer: typeof state.turnTimer) => {
      const playerId = (activePlayers[0] as string) || ''
      sendMove({
        type: 'SET_CONFIG',
        playerId,
        userId: viewerId || '',
        data: { field: 'turnTimer', value: turnTimer },
      })

      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentMatchingConfig = (currentGameConfig.matching as Record<string, any>) || {}
        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            matching: { ...currentMatchingConfig, turnTimer },
          },
        })
      }
    },
    [activePlayers, sendMove, viewerId, roomData?.id, roomData?.gameConfig, updateGameConfig]
  )

  const goToSetup = useCallback(() => {
    // Send GO_TO_SETUP move - synchronized across all room members
    const playerId = (activePlayers[0] as string) || state.currentPlayer || ''
    sendMove({
      type: 'GO_TO_SETUP',
      playerId,
      userId: viewerId || '',
      data: {},
    })
  }, [activePlayers, state.currentPlayer, sendMove, viewerId])

  const resumeGame = useCallback(() => {
    if (!canResumeGame) return

    const playerId = (activePlayers[0] as string) || state.currentPlayer || ''
    sendMove({
      type: 'RESUME_GAME',
      playerId,
      userId: viewerId || '',
      data: {},
    })
  }, [canResumeGame, activePlayers, state.currentPlayer, sendMove, viewerId])

  const hoverCard = useCallback(
    (cardId: string | null) => {
      // HOVER: Send hover state for networked presence
      // Use current player as the one hovering
      const playerId = state.currentPlayer || (activePlayers[0] as string) || ''
      if (!playerId) return // No active player to send hover for

      sendMove({
        type: 'HOVER_CARD',
        playerId,
        userId: viewerId || '',
        data: { cardId },
      })
    },
    [state.currentPlayer, activePlayers, sendMove, viewerId]
  )

  // NO MORE effectiveState merging! Just use session state directly with gameMode added
  const effectiveState = { ...state, gameMode } as MatchingState & {
    gameMode: GameMode
  }

  // If state is corrupted, show error message instead of crashing
  if (hasStateCorruption) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center',
          minHeight: '400px',
        }}
      >
        <div
          style={{
            fontSize: '48px',
            marginBottom: '20px',
          }}
        >
          ⚠️
        </div>
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '12px',
            color: '#dc2626',
          }}
        >
          Game State Mismatch
        </h2>
        <p
          style={{
            fontSize: '16px',
            color: '#6b7280',
            marginBottom: '24px',
            maxWidth: '500px',
          }}
        >
          There's a mismatch between game types in this room. This usually happens when room members
          are playing different games.
        </p>
        <div
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            maxWidth: '500px',
          }}
        >
          <p
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            To fix this:
          </p>
          <ol
            style={{
              fontSize: '14px',
              textAlign: 'left',
              paddingLeft: '20px',
              lineHeight: '1.6',
            }}
          >
            <li>Make sure all room members are on the same game page</li>
            <li>Try refreshing the page</li>
            <li>If the issue persists, leave and rejoin the room</li>
          </ol>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => {
              if (roomData?.id) {
                clearRoomGame.mutate(roomData.id, {
                  onError: () => {
                    // If clearing fails, at least reload
                    window.location.reload()
                  },
                })
              }
            }}
            style={{
              padding: '10px 20px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back to Game Selection
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  const contextValue: MatchingContextValue = {
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

  return <MatchingContext.Provider value={contextValue}>{children}</MatchingContext.Provider>
}

// Export the hook for this provider
export function useMatching() {
  const context = useContext(MatchingContext)
  if (!context) {
    throw new Error('useMatching must be used within MatchingProvider')
  }
  return context
}
