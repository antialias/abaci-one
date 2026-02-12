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
} from '../player-ownership.client'
import type { GameMove } from '../validation/types'
import { useGameMode } from '@/contexts/GameModeContext'
import { useGameCompletionCallback } from '@/contexts/GameCompletionContext'
import type {
  BaseMatchingCard,
  BaseMatchingConfig,
  GameMode,
  GameStatistics,
  MatchingPairsContextValue,
  MatchingPairsMove,
  MatchingPairsState,
  MatchingPairsVariant,
} from './types'

/**
 * Create a Provider component and hook for a matching-pairs variant.
 */
export function createMatchingPairsProvider<
  TCard extends BaseMatchingCard,
  TConfig extends BaseMatchingConfig,
>(
  variant: MatchingPairsVariant<TCard, TConfig>
): {
  Provider: (props: { children: ReactNode }) => JSX.Element
  useMatchingPairs: () => MatchingPairsContextValue<TCard, TConfig>
} {
  type State = MatchingPairsState<TCard, TConfig> & TConfig
  type Move = MatchingPairsMove<TCard>

  const Context = createContext<MatchingPairsContextValue<TCard, TConfig> | null>(null)

  // Build initial state from default config
  function buildInitialState(): State {
    const config = variant.defaultConfig
    const totalPairs = variant.getTotalPairs(config)
    const baseState: MatchingPairsState<TCard, TConfig> = {
      cards: [] as unknown as TCard[],
      gameCards: [] as unknown as TCard[],
      flippedCards: [] as unknown as TCard[],
      difficulty: config.difficulty,
      turnTimer: config.turnTimer,
      gamePhase: 'setup',
      currentPlayer: '',
      matchedPairs: 0,
      totalPairs,
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
      originalConfig: undefined,
      pausedGamePhase: undefined,
      pausedGameState: undefined,
      playerHovers: {},
    }
    return { ...baseState, ...config } as State
  }

  const initialState = buildInitialState()

  /**
   * Extract TConfig from the full state
   */
  function extractConfig(state: State): TConfig {
    const config = {} as any
    for (const key of Object.keys(variant.defaultConfig)) {
      config[key] = (state as any)[key]
    }
    return config as TConfig
  }

  /**
   * Optimistic move application (client-side prediction)
   */
  function applyMoveOptimistically(state: State, move: GameMove): State {
    const typedMove = move as Move
    switch (typedMove.type) {
      case 'START_GAME':
        return {
          ...state,
          gamePhase: 'playing',
          gameCards: typedMove.data.cards,
          cards: typedMove.data.cards,
          flippedCards: [] as unknown as TCard[],
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
          playerMetadata: typedMove.data.playerMetadata || {},
          currentPlayer: typedMove.data.activePlayers[0] || '',
          gameStartTime: Date.now(),
          gameEndTime: null,
          currentMoveStartTime: Date.now(),
          celebrationAnimations: [],
          isProcessingMove: false,
          showMismatchFeedback: false,
          lastMatchedPair: null,
          originalConfig: variant.getOriginalConfig(extractConfig(state)),
          pausedGamePhase: undefined,
          pausedGameState: undefined,
        }

      case 'FLIP_CARD': {
        const gameCards = state.gameCards || []
        const flippedCards = state.flippedCards || []

        const card = gameCards.find((c) => c.id === typedMove.data.cardId)
        if (!card) return state

        const newFlippedCards = [...flippedCards, card]

        return {
          ...state,
          flippedCards: newFlippedCards,
          currentMoveStartTime:
            flippedCards.length === 0 ? Date.now() : state.currentMoveStartTime,
          isProcessingMove: newFlippedCards.length === 2,
          showMismatchFeedback: false,
        }
      }

      case 'CLEAR_MISMATCH': {
        const clearedHovers = { ...state.playerHovers }
        for (const playerId of state.activePlayers) {
          if (playerId !== state.currentPlayer) {
            clearedHovers[playerId] = null
          }
        }

        return {
          ...state,
          flippedCards: [] as unknown as TCard[],
          showMismatchFeedback: false,
          isProcessingMove: false,
          playerHovers: clearedHovers,
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
                playerMetadata: state.playerMetadata,
                consecutiveMatches: state.consecutiveMatches,
                gameStartTime: state.gameStartTime,
              }
            : undefined,
          gameCards: [] as unknown as TCard[],
          cards: [] as unknown as TCard[],
          flippedCards: [] as unknown as TCard[],
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
        const { field, value } = typedMove.data
        const clearPausedGame = !!state.pausedGamePhase

        const newConfigState = { ...state, [field]: value } as TConfig
        const newTotalPairs = variant.getTotalPairs(newConfigState)

        return {
          ...state,
          [field]: value,
          totalPairs: newTotalPairs,
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
            [typedMove.playerId]: typedMove.data.cardId,
          },
        }
      }

      default:
        return state
    }
  }

  function Provider({ children }: { children: ReactNode }) {
    const { data: viewerId } = useViewerId()
    const { roomData } = useRoomData()
    const { activePlayerCount, activePlayers: activePlayerIds, players } = useGameMode()
    const { mutate: updateGameConfig } = useUpdateGameConfig()
    const clearRoomGame = useClearRoomGame()

    const activePlayers = Array.from(activePlayerIds) as string[]
    const gameMode: GameMode = activePlayerCount > 1 ? 'multiplayer' : 'single'

    // Merge saved game config from room
    const mergedInitialState = useMemo(() => {
      const gameConfig = roomData?.gameConfig as Record<string, any> | null | undefined
      if (!gameConfig) return initialState

      const savedConfig = gameConfig[variant.gameName] as Record<string, any> | null | undefined
      if (!savedConfig) return initialState

      // Merge all config fields from saved config
      const merged = { ...initialState }
      for (const key of Object.keys(variant.defaultConfig)) {
        if (savedConfig[key] !== undefined) {
          ;(merged as any)[key] = savedConfig[key]
        }
      }
      return merged
    }, [roomData?.gameConfig])

    const {
      state,
      sendMove,
      connected: _connected,
      exitSession,
    } = useArcadeSession<State>({
      userId: viewerId || '',
      roomId: roomData?.id,
      initialState: mergedInitialState,
      applyMove: applyMoveOptimistically,
    })

    // Notify parent when game reaches results phase
    const onGameComplete = useGameCompletionCallback()
    const previousPhaseRef = useRef<string | null>(null)
    useEffect(() => {
      if (state.gamePhase === 'results' && previousPhaseRef.current !== 'results' && onGameComplete) {
        onGameComplete(state as unknown as Record<string, unknown>)
      }
      previousPhaseRef.current = state.gamePhase
    }, [state.gamePhase, onGameComplete, state])

    // Detect state corruption
    const hasStateCorruption =
      !state.gameCards || !state.flippedCards || !Array.isArray(state.gameCards)

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

        if (roomData && state.currentPlayer) {
          const currentPlayerData = players.get(state.currentPlayer)
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
        gameTime: state.gameStartTime
          ? (state.gameEndTime || Date.now()) - state.gameStartTime
          : 0,
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
      const currentConfig = extractConfig(state)
      return variant.hasConfigChangedFrom(currentConfig, state.originalConfig)
    }, [state])

    const canResumeGame = useMemo(() => {
      return !!state.pausedGamePhase && !!state.pausedGameState && !hasConfigChanged
    }, [state.pausedGamePhase, state.pausedGameState, hasConfigChanged])

    const buildPlayerMetadata = useCallback(
      (playerIds: string[]) => {
        const playerOwnership = buildPlayerOwnershipFromRoomData(roomData)
        return buildPlayerMetadataUtil(playerIds, playerOwnership, players, viewerId ?? undefined)
      },
      [players, roomData, viewerId]
    )

    const startGame = useCallback(() => {
      if (activePlayers.length === 0) return

      const playerMetadata = buildPlayerMetadata(activePlayers)
      const configFromState = extractConfig(state)
      const cards = variant.generateCards(configFromState)
      const firstPlayer = activePlayers[0] as string
      sendMove({
        type: 'START_GAME',
        playerId: firstPlayer,
        userId: viewerId || '',
        data: { cards, activePlayers, playerMetadata },
      })
    }, [state, activePlayers, buildPlayerMetadata, sendMove, viewerId])

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
      if (activePlayers.length === 0) return

      const playerMetadata = buildPlayerMetadata(activePlayers)
      const configFromState = extractConfig(state)
      const cards = variant.generateCards(configFromState)
      const firstPlayer = activePlayers[0] as string
      sendMove({
        type: 'START_GAME',
        playerId: firstPlayer,
        userId: viewerId || '',
        data: { cards, activePlayers, playerMetadata },
      })
    }, [state, activePlayers, buildPlayerMetadata, sendMove, viewerId])

    const setConfig = useCallback(
      (field: string, value: any) => {
        const playerId = (activePlayers[0] as string) || ''
        sendMove({
          type: 'SET_CONFIG',
          playerId,
          userId: viewerId || '',
          data: { field, value },
        })

        // Persist to room config
        if (roomData?.id) {
          const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
          const currentVariantConfig =
            (currentGameConfig[variant.gameName] as Record<string, any>) || {}
          updateGameConfig({
            roomId: roomData.id,
            gameConfig: {
              ...currentGameConfig,
              [variant.gameName]: { ...currentVariantConfig, [field]: value },
            },
          })
        }
      },
      [activePlayers, sendMove, viewerId, roomData?.id, roomData?.gameConfig, updateGameConfig]
    )

    const setTurnTimer = useCallback(
      (turnTimer: number) => {
        setConfig('turnTimer', turnTimer)
      },
      [setConfig]
    )

    const goToSetup = useCallback(() => {
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
        const playerId = state.currentPlayer || (activePlayers[0] as string) || ''
        if (!playerId) return
        sendMove({
          type: 'HOVER_CARD',
          playerId,
          userId: viewerId || '',
          data: { cardId },
        })
      },
      [state.currentPlayer, activePlayers, sendMove, viewerId]
    )

    const effectiveState = { ...state, gameMode } as State & { gameMode: GameMode }

    // State corruption fallback
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
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
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
            There's a mismatch between game types in this room. Try refreshing the page.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => {
                if (roomData?.id) {
                  clearRoomGame.mutate(roomData.id, {
                    onError: () => window.location.reload(),
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

    const contextValue: MatchingPairsContextValue<TCard, TConfig> = {
      state: effectiveState,
      dispatch: () => {
        console.warn('dispatch() is deprecated, use action creators instead')
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
      setConfig,
      setTurnTimer,
      hoverCard,
      exitSession,
      gameMode,
      activePlayers,
    }

    return <Context.Provider value={contextValue}>{children}</Context.Provider>
  }

  function useMatchingPairs(): MatchingPairsContextValue<TCard, TConfig> {
    const context = useContext(Context)
    if (!context) {
      throw new Error(
        `useMatchingPairs must be used within the ${variant.gameName} Provider`
      )
    }
    return context
  }

  return { Provider, useMatchingPairs }
}
