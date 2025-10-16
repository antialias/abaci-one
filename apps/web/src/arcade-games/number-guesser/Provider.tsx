/**
 * Number Guesser Provider
 * Manages game state using the Arcade SDK
 */

'use client'

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import {
  type GameMove,
  buildPlayerMetadata,
  useArcadeSession,
  useGameMode,
  useRoomData,
  useUpdateGameConfig,
  useViewerId,
} from '@/lib/arcade/game-sdk'
import type { NumberGuesserState } from './types'

/**
 * Context value interface
 */
interface NumberGuesserContextValue {
  state: NumberGuesserState
  lastError: string | null
  startGame: () => void
  chooseNumber: (number: number) => void
  makeGuess: (guess: number) => void
  nextRound: () => void
  goToSetup: () => void
  setConfig: (field: 'minNumber' | 'maxNumber' | 'roundsToWin', value: number) => void
  clearError: () => void
  exitSession: () => void
}

const NumberGuesserContext = createContext<NumberGuesserContextValue | null>(null)

/**
 * Hook to access Number Guesser context
 */
export function useNumberGuesser() {
  const context = useContext(NumberGuesserContext)
  if (!context) {
    throw new Error('useNumberGuesser must be used within NumberGuesserProvider')
  }
  return context
}

/**
 * Optimistic move application
 */
function applyMoveOptimistically(state: NumberGuesserState, move: GameMove): NumberGuesserState {
  // For simplicity, just return current state
  // Server will send back the validated new state
  return state
}

/**
 * Number Guesser Provider Component
 */
export function NumberGuesserProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers: activePlayerIds, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()

  // Get active players as array (keep Set iteration order to match UI display)
  const activePlayers = Array.from(activePlayerIds)

  // Merge saved config from room
  const initialState = useMemo(() => {
    const gameConfig = roomData?.gameConfig as Record<string, unknown> | null | undefined
    const savedConfig = gameConfig?.['number-guesser'] as Record<string, unknown> | undefined

    return {
      minNumber: (savedConfig?.minNumber as number) || 1,
      maxNumber: (savedConfig?.maxNumber as number) || 100,
      roundsToWin: (savedConfig?.roundsToWin as number) || 3,
      gamePhase: 'setup' as const,
      activePlayers: [],
      playerMetadata: {},
      secretNumber: null,
      chooser: '',
      currentGuesser: '',
      guesses: [],
      roundNumber: 0,
      scores: {},
      gameStartTime: null,
      gameEndTime: null,
      winner: null,
    }
  }, [roomData?.gameConfig])

  // Arcade session integration
  const { state, sendMove, exitSession, lastError, clearError } =
    useArcadeSession<NumberGuesserState>({
      userId: viewerId || '',
      roomId: roomData?.id,
      initialState,
      applyMove: applyMoveOptimistically,
    })

  // Action creators
  const startGame = useCallback(() => {
    if (activePlayers.length < 2) {
      console.error('Need at least 2 players to start')
      return
    }

    const playerMetadata = buildPlayerMetadata(activePlayers, {}, players, viewerId || undefined)

    sendMove({
      type: 'START_GAME',
      playerId: activePlayers[0],
      userId: viewerId || '',
      data: {
        activePlayers,
        playerMetadata,
      },
    })
  }, [activePlayers, players, viewerId, sendMove])

  const chooseNumber = useCallback(
    (secretNumber: number) => {
      sendMove({
        type: 'CHOOSE_NUMBER',
        playerId: state.chooser,
        userId: viewerId || '',
        data: { secretNumber },
      })
    },
    [state.chooser, viewerId, sendMove]
  )

  const makeGuess = useCallback(
    (guess: number) => {
      const playerName = state.playerMetadata[state.currentGuesser]?.name || 'Unknown'

      sendMove({
        type: 'MAKE_GUESS',
        playerId: state.currentGuesser,
        userId: viewerId || '',
        data: { guess, playerName },
      })
    },
    [state.currentGuesser, state.playerMetadata, viewerId, sendMove]
  )

  const nextRound = useCallback(() => {
    sendMove({
      type: 'NEXT_ROUND',
      playerId: activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    })
  }, [activePlayers, viewerId, sendMove])

  const goToSetup = useCallback(() => {
    sendMove({
      type: 'GO_TO_SETUP',
      playerId: activePlayers[0] || state.chooser || '',
      userId: viewerId || '',
      data: {},
    })
  }, [activePlayers, state.chooser, viewerId, sendMove])

  const setConfig = useCallback(
    (field: 'minNumber' | 'maxNumber' | 'roundsToWin', value: number) => {
      sendMove({
        type: 'SET_CONFIG',
        playerId: activePlayers[0] || '',
        userId: viewerId || '',
        data: { field, value },
      })

      // Persist to database
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, unknown>) || {}
        const currentNumberGuesserConfig =
          (currentGameConfig['number-guesser'] as Record<string, unknown>) || {}

        const updatedConfig = {
          ...currentGameConfig,
          'number-guesser': {
            ...currentNumberGuesserConfig,
            [field]: value,
          },
        }

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: updatedConfig,
        })
      }
    },
    [activePlayers, viewerId, sendMove, roomData?.id, roomData?.gameConfig, updateGameConfig]
  )

  const contextValue: NumberGuesserContextValue = {
    state,
    lastError,
    startGame,
    chooseNumber,
    makeGuess,
    nextRound,
    goToSetup,
    setConfig,
    clearError,
    exitSession,
  }

  return (
    <NumberGuesserContext.Provider value={contextValue}>{children}</NumberGuesserContext.Provider>
  )
}
