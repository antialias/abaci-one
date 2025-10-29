'use client'

import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react'
import { useGameMode } from '@/contexts/GameModeContext'
import {
  TEAM_MOVE,
  useArcadeSession,
  useRoomData,
  useUpdateGameConfig,
  useViewerId,
} from '@/lib/arcade/game-sdk'
import type {
  AmbushContext,
  Color,
  HarmonyType,
  RelationKind,
  RithmomachiaConfig,
  RithmomachiaState,
} from './types'

/**
 * Context value for Rithmomachia game.
 */
interface RithmomachiaContextValue {
  // State
  state: RithmomachiaState
  lastError: string | null

  // Player info
  viewerId: string | null
  playerColor: Color | null
  isMyTurn: boolean

  // Game actions
  startGame: () => void
  makeMove: (
    from: string,
    to: string,
    pieceId: string,
    pyramidFace?: number,
    capture?: CaptureData,
    ambush?: AmbushContext
  ) => void
  declareHarmony: (
    pieceIds: string[],
    harmonyType: HarmonyType,
    params: Record<string, string>
  ) => void
  resign: () => void
  offerDraw: () => void
  acceptDraw: () => void
  claimRepetition: () => void
  claimFiftyMove: () => void

  // Config actions
  setConfig: (field: keyof RithmomachiaConfig, value: any) => void

  // Game control actions
  resetGame: () => void
  goToSetup: () => void
  exitSession: () => void

  // Error handling
  clearError: () => void
}

interface CaptureData {
  relation: RelationKind
  targetPieceId: string
  helperPieceId?: string
}

const RithmomachiaContext = createContext<RithmomachiaContextValue | null>(null)

/**
 * Hook to access Rithmomachia game context.
 */
export function useRithmomachia(): RithmomachiaContextValue {
  const context = useContext(RithmomachiaContext)
  if (!context) {
    throw new Error('useRithmomachia must be used within RithmomachiaProvider')
  }
  return context
}

/**
 * Provider for Rithmomachia game state and actions.
 */
export function RithmomachiaProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers: activePlayerIds, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()

  // Get local player ID
  const localPlayerId = useMemo(() => {
    return Array.from(activePlayerIds).find((id) => {
      const player = players.get(id)
      return player?.isLocal !== false
    })
  }, [activePlayerIds, players])

  // Merge saved config from room data
  const mergedInitialState = useMemo(() => {
    const gameConfig = roomData?.gameConfig as Record<string, unknown> | null
    const savedConfig = gameConfig?.rithmomachia as Partial<RithmomachiaConfig> | undefined

    // Use validator to create initial state with config
    const config: RithmomachiaConfig = {
      pointWinEnabled: savedConfig?.pointWinEnabled ?? false,
      pointWinThreshold: savedConfig?.pointWinThreshold ?? 30,
      repetitionRule: savedConfig?.repetitionRule ?? true,
      fiftyMoveRule: savedConfig?.fiftyMoveRule ?? true,
      allowAnySetOnRecheck: savedConfig?.allowAnySetOnRecheck ?? true,
      timeControlMs: savedConfig?.timeControlMs ?? null,
    }

    // Import validator dynamically to get initial state
    return {
      ...require('./Validator').rithmomachiaValidator.getInitialState(config),
    }
  }, [roomData?.gameConfig])

  // Use arcade session hook
  const { state, sendMove, lastError, clearError } = useArcadeSession<RithmomachiaState>({
    userId: viewerId || '',
    roomId: roomData?.id,
    initialState: mergedInitialState,
    applyMove: (state) => state, // No optimistic updates for v1 - rely on server validation
  })

  // Determine player color (simplified: first player is White, second is Black)
  const playerColor = useMemo((): Color | null => {
    if (!localPlayerId) return null
    const playerIndex = Array.from(activePlayerIds).indexOf(localPlayerId)
    return playerIndex === 0 ? 'W' : 'B'
  }, [localPlayerId, activePlayerIds])

  // Check if it's my turn
  const isMyTurn = useMemo(() => {
    if (!playerColor) return false
    return state.turn === playerColor
  }, [state.turn, playerColor])

  // Action: Start game
  const startGame = useCallback(() => {
    if (!viewerId || !localPlayerId) return

    sendMove({
      type: 'START_GAME',
      playerId: localPlayerId,
      userId: viewerId,
      data: {
        playerColor: playerColor || 'W',
        activePlayers: Array.from(activePlayerIds),
      },
    })
  }, [sendMove, viewerId, localPlayerId, playerColor, activePlayerIds])

  // Action: Make a move
  const makeMove = useCallback(
    (
      from: string,
      to: string,
      pieceId: string,
      pyramidFace?: number,
      capture?: CaptureData,
      ambush?: AmbushContext
    ) => {
      if (!viewerId || !localPlayerId) return

      sendMove({
        type: 'MOVE',
        playerId: localPlayerId,
        userId: viewerId,
        data: {
          from,
          to,
          pieceId,
          pyramidFaceUsed: pyramidFace ?? null,
          capture: capture
            ? {
                relation: capture.relation,
                targetPieceId: capture.targetPieceId,
                helperPieceId: capture.helperPieceId,
              }
            : undefined,
          ambush,
        },
      })
    },
    [sendMove, viewerId, localPlayerId]
  )

  // Action: Declare harmony
  const declareHarmony = useCallback(
    (pieceIds: string[], harmonyType: HarmonyType, params: Record<string, string>) => {
      if (!viewerId || !localPlayerId) return

      sendMove({
        type: 'DECLARE_HARMONY',
        playerId: localPlayerId,
        userId: viewerId,
        data: {
          pieceIds,
          harmonyType,
          params,
        },
      })
    },
    [sendMove, viewerId, localPlayerId]
  )

  // Action: Resign
  const resign = useCallback(() => {
    if (!viewerId || !localPlayerId) return

    sendMove({
      type: 'RESIGN',
      playerId: localPlayerId,
      userId: viewerId,
      data: {},
    })
  }, [sendMove, viewerId, localPlayerId])

  // Action: Offer draw
  const offerDraw = useCallback(() => {
    if (!viewerId || !localPlayerId) return

    sendMove({
      type: 'OFFER_DRAW',
      playerId: localPlayerId,
      userId: viewerId,
      data: {},
    })
  }, [sendMove, viewerId, localPlayerId])

  // Action: Accept draw
  const acceptDraw = useCallback(() => {
    if (!viewerId || !localPlayerId) return

    sendMove({
      type: 'ACCEPT_DRAW',
      playerId: localPlayerId,
      userId: viewerId,
      data: {},
    })
  }, [sendMove, viewerId, localPlayerId])

  // Action: Claim repetition
  const claimRepetition = useCallback(() => {
    if (!viewerId || !localPlayerId) return

    sendMove({
      type: 'CLAIM_REPETITION',
      playerId: localPlayerId,
      userId: viewerId,
      data: {},
    })
  }, [sendMove, viewerId, localPlayerId])

  // Action: Claim fifty-move rule
  const claimFiftyMove = useCallback(() => {
    if (!viewerId || !localPlayerId) return

    sendMove({
      type: 'CLAIM_FIFTY_MOVE',
      playerId: localPlayerId,
      userId: viewerId,
      data: {},
    })
  }, [sendMove, viewerId, localPlayerId])

  // Action: Set config
  const setConfig = useCallback(
    (field: keyof RithmomachiaConfig, value: any) => {
      // Send move to update state immediately
      sendMove({
        type: 'SET_CONFIG',
        playerId: TEAM_MOVE,
        userId: viewerId || '',
        data: { field, value },
      })

      // Persist to database (room mode only)
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentConfig = (currentGameConfig.rithmomachia as Record<string, any>) || {}

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            rithmomachia: {
              ...currentConfig,
              [field]: value,
            },
          },
        })
      }
    },
    [viewerId, sendMove, roomData, updateGameConfig]
  )

  // Action: Reset game (start new game with same config)
  const resetGame = useCallback(() => {
    if (!viewerId) return

    sendMove({
      type: 'RESET_GAME',
      playerId: TEAM_MOVE,
      userId: viewerId,
      data: {},
    })
  }, [sendMove, viewerId])

  // Action: Go to setup (return to setup phase)
  const goToSetup = useCallback(() => {
    if (!viewerId) return

    sendMove({
      type: 'GO_TO_SETUP',
      playerId: TEAM_MOVE,
      userId: viewerId,
      data: {},
    })
  }, [sendMove, viewerId])

  // Action: Exit session (no-op for now, handled by PageWithNav)
  const exitSession = useCallback(() => {
    // PageWithNav handles the actual navigation
    // This is here for API compatibility
  }, [])

  const value: RithmomachiaContextValue = {
    state,
    lastError,
    viewerId: viewerId ?? null,
    playerColor,
    isMyTurn,
    startGame,
    makeMove,
    declareHarmony,
    resign,
    offerDraw,
    acceptDraw,
    claimRepetition,
    claimFiftyMove,
    setConfig,
    resetGame,
    goToSetup,
    exitSession,
    clearError,
  }

  return <RithmomachiaContext.Provider value={value}>{children}</RithmomachiaContext.Provider>
}
