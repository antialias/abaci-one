'use client'

import { type ReactNode, useCallback, useEffect, useMemo, createContext, useContext } from 'react'
import { useArcadeSession } from '@/hooks/useArcadeSession'
import { useRoomData, useUpdateGameConfig, useClearRoomGame } from '@/hooks/useRoomData'
import { useViewerId } from '@/hooks/useViewerId'
import {
  buildPlayerMetadata as buildPlayerMetadataUtil,
  buildPlayerOwnershipFromRoomData,
} from '@/lib/arcade/player-ownership.client'
import type { GameMove } from '@/lib/arcade/validation'
import { useGameMode } from '@/contexts/GameModeContext'
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

  // Track roomData.gameConfig changes
  useEffect(() => {
    console.log(
      '[MatchingProvider] roomData.gameConfig changed:',
      JSON.stringify(
        {
          gameConfig: roomData?.gameConfig,
          roomId: roomData?.id,
          gameName: roomData?.gameName,
        },
        null,
        2
      )
    )
  }, [roomData?.gameConfig, roomData?.id, roomData?.gameName])

  // Merge saved game config from room with initialState
  // Settings are scoped by game name to preserve settings when switching games
  const mergedInitialState = useMemo(() => {
    const gameConfig = roomData?.gameConfig as Record<string, any> | null | undefined
    console.log(
      '[MatchingProvider] Loading settings from database:',
      JSON.stringify(
        {
          gameConfig,
          roomId: roomData?.id,
        },
        null,
        2
      )
    )

    if (!gameConfig) {
      console.log('[MatchingProvider] No gameConfig, using initialState')
      return initialState
    }

    // Get settings for this specific game (matching)
    const savedConfig = gameConfig.matching as Record<string, any> | null | undefined
    console.log(
      '[MatchingProvider] Saved config for matching:',
      JSON.stringify(savedConfig, null, 2)
    )

    if (!savedConfig) {
      console.log('[MatchingProvider] No saved config for matching, using initialState')
      return initialState
    }

    const merged = {
      ...initialState,
      // Restore settings from saved config
      gameType: savedConfig.gameType ?? initialState.gameType,
      difficulty: savedConfig.difficulty ?? initialState.difficulty,
      turnTimer: savedConfig.turnTimer ?? initialState.turnTimer,
    }
    console.log(
      '[MatchingProvider] Merged state:',
      JSON.stringify(
        {
          gameType: merged.gameType,
          difficulty: merged.difficulty,
          turnTimer: merged.turnTimer,
        },
        null,
        2
      )
    )

    return merged
  }, [roomData?.gameConfig])

  // Debug: Log what initial state is being used
  useEffect(() => {
    console.log('[MatchingProvider] Using initialState:', {
      gameCardsLength: mergedInitialState.gameCards?.length ?? 'undefined',
      flippedCardsLength: mergedInitialState.flippedCards?.length ?? 'undefined',
      gamePhase: mergedInitialState.gamePhase,
      gameType: mergedInitialState.gameType,
      roomId: roomData?.id,
    })
  }, [mergedInitialState, roomData?.id])

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

  // Detect state corruption/mismatch (e.g., game type mismatch between sessions)
  const hasStateCorruption =
    !state.gameCards || !state.flippedCards || !Array.isArray(state.gameCards)

  // Debug: Log corruption check details
  if (hasStateCorruption) {
    console.error('[MatchingProvider] STATE_CORRUPTION detected:', {
      hasGameCards: !!state.gameCards,
      hasFlippedCards: !!state.flippedCards,
      gameCardsIsArray: Array.isArray(state.gameCards),
      gameCardsValue: state.gameCards,
      flippedCardsValue: state.flippedCards,
      stateKeys: Object.keys(state).slice(0, 15),
      gamePhase: state.gamePhase,
      gameType: state.gameType,
      roomId: roomData?.id,
    })
  }

  // Debug: Track state changes relevant to mismatch handling (only log when cards are flipped)
  useEffect(() => {
    // Only log when there are flipped cards or mismatch feedback to reduce noise
    if ((state.flippedCards?.length ?? 0) > 0 || state.showMismatchFeedback) {
      console.log(
        `[MatchingDebug] State update: showMismatchFeedback=${state.showMismatchFeedback} flippedCards=${state.flippedCards?.length ?? 'undefined'} isProcessingMove=${state.isProcessingMove}`
      )
    }
  }, [state.showMismatchFeedback, state.flippedCards?.length, state.isProcessingMove])

  // Handle mismatch feedback timeout
  useEffect(() => {
    // Only log when there are flipped cards to reduce noise
    if ((state.flippedCards?.length ?? 0) > 0 || state.showMismatchFeedback) {
      console.log(
        `[MatchingDebug] Checking mismatch: showMismatchFeedback=${state.showMismatchFeedback} flippedCards=${state.flippedCards?.length ?? 'undefined'}`
      )
    }
    // Defensive check: ensure flippedCards exists
    if (state.showMismatchFeedback && state.flippedCards?.length === 2) {
      console.log('[MatchingDebug] Mismatch detected! Setting 1.5s timeout for CLEAR_MISMATCH')
      // After 1.5 seconds, send CLEAR_MISMATCH
      // Server will validate that cards are still in mismatch state before clearing
      const timeout = setTimeout(() => {
        console.log('[MatchingDebug] Timeout fired! Sending CLEAR_MISMATCH')
        sendMove({
          type: 'CLEAR_MISMATCH',
          playerId: state.currentPlayer,
          userId: viewerId || '',
          data: {},
        })
      }, 1500)

      return () => {
        console.log('[MatchingDebug] Clearing mismatch timeout')
        clearTimeout(timeout)
      }
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
      // Defensive check: ensure required state exists
      const flippedCards = state.flippedCards || []
      const gameCards = state.gameCards || []

      console.log('[RoomProvider][canFlipCard] Checking card:', {
        cardId,
        isGameActive,
        isProcessingMove: state.isProcessingMove,
        currentPlayer: state.currentPlayer,
        hasRoomData: !!roomData,
        flippedCardsCount: flippedCards.length,
      })

      if (!isGameActive || state.isProcessingMove) {
        console.log('[RoomProvider][canFlipCard] Blocked: game not active or processing')
        return false
      }

      // Can't flip if session state hasn't been received yet (currentPlayer not set)
      // This prevents race condition where user clicks before server state arrives
      if (!state.currentPlayer) {
        console.log(
          '[RoomProvider][canFlipCard] Blocked: waiting for session state (currentPlayer empty)'
        )
        return false
      }

      const card = gameCards.find((c) => c.id === cardId)
      if (!card || card.matched) {
        console.log('[RoomProvider][canFlipCard] Blocked: card not found or already matched')
        return false
      }

      // Can't flip if already flipped
      if (flippedCards.some((c) => c.id === cardId)) {
        console.log('[RoomProvider][canFlipCard] Blocked: card already flipped')
        return false
      }

      // Can't flip more than 2 cards
      if (flippedCards.length >= 2) {
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
        userId: viewerId || '',
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
      console.log('[MatchingProvider] setGameType called:', gameType)

      // Use first active player as playerId, or empty string if none
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

        const updatedConfig = {
          ...currentGameConfig,
          matching: {
            ...currentMatchingConfig,
            gameType,
          },
        }
        console.log(
          '[MatchingProvider] Saving gameType to database:',
          JSON.stringify(
            {
              roomId: roomData.id,
              updatedConfig,
            },
            null,
            2
          )
        )
        updateGameConfig({
          roomId: roomData.id,
          gameConfig: updatedConfig,
        })
      } else {
        console.warn('[MatchingProvider] Cannot save gameType - no roomData.id')
      }
    },
    [activePlayers, sendMove, viewerId, roomData?.id, roomData?.gameConfig, updateGameConfig]
  )

  const setDifficulty = useCallback(
    (difficulty: typeof state.difficulty) => {
      console.log('[MatchingProvider] setDifficulty called:', difficulty)

      const playerId = (activePlayers[0] as string) || ''
      sendMove({
        type: 'SET_CONFIG',
        playerId,
        userId: viewerId || '',
        data: { field: 'difficulty', value: difficulty },
      })

      // Save setting to room's gameConfig for persistence
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentMatchingConfig = (currentGameConfig.matching as Record<string, any>) || {}

        const updatedConfig = {
          ...currentGameConfig,
          matching: {
            ...currentMatchingConfig,
            difficulty,
          },
        }
        console.log(
          '[MatchingProvider] Saving difficulty to database:',
          JSON.stringify(
            {
              roomId: roomData.id,
              updatedConfig,
            },
            null,
            2
          )
        )
        updateGameConfig({
          roomId: roomData.id,
          gameConfig: updatedConfig,
        })
      } else {
        console.warn('[MatchingProvider] Cannot save difficulty - no roomData.id')
      }
    },
    [activePlayers, sendMove, viewerId, roomData?.id, roomData?.gameConfig, updateGameConfig]
  )

  const setTurnTimer = useCallback(
    (turnTimer: typeof state.turnTimer) => {
      console.log('[MatchingProvider] setTurnTimer called:', turnTimer)

      const playerId = (activePlayers[0] as string) || ''
      sendMove({
        type: 'SET_CONFIG',
        playerId,
        userId: viewerId || '',
        data: { field: 'turnTimer', value: turnTimer },
      })

      // Save setting to room's gameConfig for persistence
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentMatchingConfig = (currentGameConfig.matching as Record<string, any>) || {}

        const updatedConfig = {
          ...currentGameConfig,
          matching: {
            ...currentMatchingConfig,
            turnTimer,
          },
        }
        console.log(
          '[MatchingProvider] Saving turnTimer to database:',
          JSON.stringify(
            {
              roomId: roomData.id,
              updatedConfig,
            },
            null,
            2
          )
        )
        updateGameConfig({
          roomId: roomData.id,
          gameConfig: updatedConfig,
        })
      } else {
        console.warn('[MatchingProvider] Cannot save turnTimer - no roomData.id')
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
    // PAUSE/RESUME: Resume paused game if config unchanged
    if (!canResumeGame) {
      console.warn('[MatchingProvider] Cannot resume - no paused game or config changed')
      return
    }

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
