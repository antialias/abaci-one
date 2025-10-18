'use client'

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  createContext,
  useContext,
  useState,
} from 'react'
import { useArcadeSession } from '@/hooks/useArcadeSession'
import { useRoomData, useUpdateGameConfig } from '@/hooks/useRoomData'
import { useViewerId } from '@/hooks/useViewerId'
import { buildPlayerMetadata as buildPlayerMetadataUtil } from '@/lib/arcade/player-ownership.client'
import type { GameMove } from '@/lib/arcade/validation'
import { useGameMode } from '@/contexts/GameModeContext'
import { generateRandomCards, shuffleCards } from './utils/cardGeneration'
import type { CardSortingState, CardSortingMove, SortingCard, CardSortingConfig } from './types'

// Context value interface
interface CardSortingContextValue {
  state: CardSortingState
  // Actions
  startGame: () => void
  placeCard: (cardId: string, position: number) => void
  removeCard: (position: number) => void
  checkSolution: () => void
  revealNumbers: () => void
  goToSetup: () => void
  resumeGame: () => void
  setConfig: (field: 'cardCount' | 'showNumbers' | 'timeLimit', value: unknown) => void
  exitSession: () => void
  // Computed
  canCheckSolution: boolean
  placedCount: number
  elapsedTime: number
  hasConfigChanged: boolean
  canResumeGame: boolean
  // UI state
  selectedCardId: string | null
  selectCard: (cardId: string | null) => void
}

// Create context
const CardSortingContext = createContext<CardSortingContextValue | null>(null)

// Initial state matching validator's getInitialState
const createInitialState = (config: Partial<CardSortingConfig>): CardSortingState => ({
  cardCount: config.cardCount ?? 8,
  showNumbers: config.showNumbers ?? true,
  timeLimit: config.timeLimit ?? null,
  gamePhase: 'setup',
  playerId: '',
  playerMetadata: {
    id: '',
    name: '',
    emoji: '',
    userId: '',
  },
  gameStartTime: null,
  gameEndTime: null,
  selectedCards: [],
  correctOrder: [],
  availableCards: [],
  placedCards: new Array(config.cardCount ?? 8).fill(null),
  selectedCardId: null,
  numbersRevealed: false,
  scoreBreakdown: null,
})

/**
 * Optimistic move application (client-side prediction)
 */
function applyMoveOptimistically(state: CardSortingState, move: GameMove): CardSortingState {
  const typedMove = move as CardSortingMove

  switch (typedMove.type) {
    case 'START_GAME': {
      const selectedCards = typedMove.data.selectedCards as SortingCard[]
      const correctOrder = [...selectedCards].sort((a, b) => a.number - b.number)

      return {
        ...state,
        gamePhase: 'playing',
        playerId: typedMove.playerId,
        playerMetadata: typedMove.data.playerMetadata,
        gameStartTime: Date.now(),
        selectedCards,
        correctOrder,
        availableCards: shuffleCards(selectedCards),
        placedCards: new Array(state.cardCount).fill(null),
        numbersRevealed: false,
        // Save original config for pause/resume
        originalConfig: {
          cardCount: state.cardCount,
          showNumbers: state.showNumbers,
          timeLimit: state.timeLimit,
        },
        pausedGamePhase: undefined,
        pausedGameState: undefined,
      }
    }

    case 'PLACE_CARD': {
      const { cardId, position } = typedMove.data
      const card = state.availableCards.find((c) => c.id === cardId)
      if (!card) return state

      // Simple insert logic (server will do proper compaction)
      const newPlaced = [...state.placedCards]
      newPlaced[position] = card
      const newAvailable = state.availableCards.filter((c) => c.id !== cardId)

      return {
        ...state,
        availableCards: newAvailable,
        placedCards: newPlaced,
      }
    }

    case 'REMOVE_CARD': {
      const { position } = typedMove.data
      const card = state.placedCards[position]
      if (!card) return state

      const newPlaced = [...state.placedCards]
      newPlaced[position] = null
      const newAvailable = [...state.availableCards, card]

      return {
        ...state,
        availableCards: newAvailable,
        placedCards: newPlaced,
      }
    }

    case 'REVEAL_NUMBERS': {
      return {
        ...state,
        numbersRevealed: true,
      }
    }

    case 'CHECK_SOLUTION': {
      // Server will calculate score - just transition to results optimistically
      return {
        ...state,
        gamePhase: 'results',
        gameEndTime: Date.now(),
      }
    }

    case 'GO_TO_SETUP': {
      const isPausingGame = state.gamePhase === 'playing'

      return {
        ...createInitialState({
          cardCount: state.cardCount,
          showNumbers: state.showNumbers,
          timeLimit: state.timeLimit,
        }),
        // Save paused state if coming from active game
        originalConfig: state.originalConfig,
        pausedGamePhase: isPausingGame ? 'playing' : undefined,
        pausedGameState: isPausingGame
          ? {
              selectedCards: state.selectedCards,
              availableCards: state.availableCards,
              placedCards: state.placedCards,
              gameStartTime: state.gameStartTime || Date.now(),
              numbersRevealed: state.numbersRevealed,
            }
          : undefined,
      }
    }

    case 'SET_CONFIG': {
      const { field, value } = typedMove.data
      const clearPausedGame = !!state.pausedGamePhase

      return {
        ...state,
        [field]: value,
        // Update placedCards array size if cardCount changes
        ...(field === 'cardCount' ? { placedCards: new Array(value as number).fill(null) } : {}),
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
      if (!state.pausedGamePhase || !state.pausedGameState) {
        return state
      }

      const correctOrder = [...state.pausedGameState.selectedCards].sort(
        (a, b) => a.number - b.number
      )

      return {
        ...state,
        gamePhase: state.pausedGamePhase,
        selectedCards: state.pausedGameState.selectedCards,
        correctOrder,
        availableCards: state.pausedGameState.availableCards,
        placedCards: state.pausedGameState.placedCards,
        gameStartTime: state.pausedGameState.gameStartTime,
        numbersRevealed: state.pausedGameState.numbersRevealed,
        pausedGamePhase: undefined,
        pausedGameState: undefined,
      }
    }

    default:
      return state
  }
}

/**
 * Card Sorting Provider - Single Player Pattern Recognition Game
 */
export function CardSortingProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()

  // Local UI state (not synced to server)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  // Get local player (single player game)
  const localPlayerId = useMemo(() => {
    return Array.from(activePlayers).find((id) => {
      const player = players.get(id)
      return player?.isLocal !== false
    })
  }, [activePlayers, players])

  // Merge saved config from room data
  const mergedInitialState = useMemo(() => {
    const gameConfig = roomData?.gameConfig as Record<string, unknown> | null
    const savedConfig = gameConfig?.['card-sorting'] as Partial<CardSortingConfig> | undefined

    return createInitialState(savedConfig || {})
  }, [roomData?.gameConfig])

  // Arcade session integration
  const { state, sendMove, exitSession } = useArcadeSession<CardSortingState>({
    userId: viewerId || '',
    roomId: roomData?.id,
    initialState: mergedInitialState,
    applyMove: applyMoveOptimistically,
  })

  // Build player metadata for the single local player
  const buildPlayerMetadata = useCallback(() => {
    if (!localPlayerId) {
      return {
        id: '',
        name: '',
        emoji: '',
        userId: '',
      }
    }

    const playerOwnership: Record<string, string> = {}
    if (viewerId) {
      playerOwnership[localPlayerId] = viewerId
    }

    const metadata = buildPlayerMetadataUtil(
      [localPlayerId],
      playerOwnership,
      players,
      viewerId ?? undefined
    )

    return metadata[localPlayerId] || { id: '', name: '', emoji: '', userId: '' }
  }, [localPlayerId, players, viewerId])

  // Computed values
  const canCheckSolution = useMemo(
    () => state.placedCards.every((c) => c !== null),
    [state.placedCards]
  )

  const placedCount = useMemo(
    () => state.placedCards.filter((c) => c !== null).length,
    [state.placedCards]
  )

  const elapsedTime = useMemo(() => {
    if (!state.gameStartTime) return 0
    const now = state.gameEndTime || Date.now()
    return Math.floor((now - state.gameStartTime) / 1000)
  }, [state.gameStartTime, state.gameEndTime])

  const hasConfigChanged = useMemo(() => {
    if (!state.originalConfig) return false
    return (
      state.cardCount !== state.originalConfig.cardCount ||
      state.showNumbers !== state.originalConfig.showNumbers ||
      state.timeLimit !== state.originalConfig.timeLimit
    )
  }, [state.cardCount, state.showNumbers, state.timeLimit, state.originalConfig])

  const canResumeGame = useMemo(() => {
    return !!state.pausedGamePhase && !!state.pausedGameState && !hasConfigChanged
  }, [state.pausedGamePhase, state.pausedGameState, hasConfigChanged])

  // Action creators
  const startGame = useCallback(() => {
    if (!localPlayerId) {
      console.error('[CardSortingProvider] No local player available')
      return
    }

    const playerMetadata = buildPlayerMetadata()
    const selectedCards = generateRandomCards(state.cardCount)

    sendMove({
      type: 'START_GAME',
      playerId: localPlayerId,
      userId: viewerId || '',
      data: {
        playerMetadata,
        selectedCards,
      },
    })
  }, [localPlayerId, state.cardCount, buildPlayerMetadata, sendMove, viewerId])

  const placeCard = useCallback(
    (cardId: string, position: number) => {
      if (!localPlayerId) return

      sendMove({
        type: 'PLACE_CARD',
        playerId: localPlayerId,
        userId: viewerId || '',
        data: { cardId, position },
      })

      // Clear selection
      setSelectedCardId(null)
    },
    [localPlayerId, sendMove, viewerId]
  )

  const removeCard = useCallback(
    (position: number) => {
      if (!localPlayerId) return

      sendMove({
        type: 'REMOVE_CARD',
        playerId: localPlayerId,
        userId: viewerId || '',
        data: { position },
      })
    },
    [localPlayerId, sendMove, viewerId]
  )

  const checkSolution = useCallback(() => {
    if (!localPlayerId) return
    if (!canCheckSolution) {
      console.warn('[CardSortingProvider] Cannot check - not all cards placed')
      return
    }

    sendMove({
      type: 'CHECK_SOLUTION',
      playerId: localPlayerId,
      userId: viewerId || '',
      data: {},
    })
  }, [localPlayerId, canCheckSolution, sendMove, viewerId])

  const revealNumbers = useCallback(() => {
    if (!localPlayerId) return

    sendMove({
      type: 'REVEAL_NUMBERS',
      playerId: localPlayerId,
      userId: viewerId || '',
      data: {},
    })
  }, [localPlayerId, sendMove, viewerId])

  const goToSetup = useCallback(() => {
    if (!localPlayerId) return

    sendMove({
      type: 'GO_TO_SETUP',
      playerId: localPlayerId,
      userId: viewerId || '',
      data: {},
    })
  }, [localPlayerId, sendMove, viewerId])

  const resumeGame = useCallback(() => {
    if (!localPlayerId || !canResumeGame) {
      console.warn('[CardSortingProvider] Cannot resume - no paused game or config changed')
      return
    }

    sendMove({
      type: 'RESUME_GAME',
      playerId: localPlayerId,
      userId: viewerId || '',
      data: {},
    })
  }, [localPlayerId, canResumeGame, sendMove, viewerId])

  const setConfig = useCallback(
    (field: 'cardCount' | 'showNumbers' | 'timeLimit', value: unknown) => {
      if (!localPlayerId) return

      sendMove({
        type: 'SET_CONFIG',
        playerId: localPlayerId,
        userId: viewerId || '',
        data: { field, value },
      })

      // Persist to database
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, unknown>) || {}
        const currentCardSortingConfig =
          (currentGameConfig['card-sorting'] as Record<string, unknown>) || {}

        const updatedConfig = {
          ...currentGameConfig,
          'card-sorting': {
            ...currentCardSortingConfig,
            [field]: value,
          },
        }

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: updatedConfig,
        })
      }
    },
    [localPlayerId, sendMove, viewerId, roomData, updateGameConfig]
  )

  const contextValue: CardSortingContextValue = {
    state,
    // Actions
    startGame,
    placeCard,
    removeCard,
    checkSolution,
    revealNumbers,
    goToSetup,
    resumeGame,
    setConfig,
    exitSession,
    // Computed
    canCheckSolution,
    placedCount,
    elapsedTime,
    hasConfigChanged,
    canResumeGame,
    // UI state
    selectedCardId,
    selectCard: setSelectedCardId,
  }

  return <CardSortingContext.Provider value={contextValue}>{children}</CardSortingContext.Provider>
}

/**
 * Hook to access Card Sorting context
 */
export function useCardSorting() {
  const context = useContext(CardSortingContext)
  if (!context) {
    throw new Error('useCardSorting must be used within CardSortingProvider')
  }
  return context
}
