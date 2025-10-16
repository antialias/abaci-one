/**
 * Math Sprint Provider
 *
 * Context provider for Math Sprint game state management.
 * Demonstrates free-for-all gameplay with TEAM_MOVE pattern.
 */

'use client'

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import {
  buildPlayerMetadata,
  useArcadeSession,
  useGameMode,
  useRoomData,
  useUpdateGameConfig,
  useViewerId,
} from '@/lib/arcade/game-sdk'
import { TEAM_MOVE } from '@/lib/arcade/validation/types'
import type { Difficulty, MathSprintState } from './types'

/**
 * Context value provided to child components
 */
interface MathSprintContextValue {
  state: MathSprintState
  lastError: string | null
  startGame: () => void
  submitAnswer: (answer: number) => void
  nextQuestion: () => void
  resetGame: () => void
  setConfig: (field: 'difficulty' | 'questionsPerRound' | 'timePerQuestion', value: any) => void
  clearError: () => void
  exitSession: () => void
}

const MathSprintContext = createContext<MathSprintContextValue | null>(null)

/**
 * Hook to access Math Sprint context
 */
export function useMathSprint() {
  const context = useContext(MathSprintContext)
  if (!context) {
    throw new Error('useMathSprint must be used within MathSprintProvider')
  }
  return context
}

/**
 * Math Sprint Provider Component
 */
export function MathSprintProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers: activePlayerIds, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()

  // Get active players as array (keep Set iteration order)
  const activePlayers = Array.from(activePlayerIds)

  // Merge saved config from room with defaults
  const gameConfig = useMemo(() => {
    const allGameConfigs = roomData?.gameConfig as Record<string, unknown> | null | undefined
    const savedConfig = allGameConfigs?.['math-sprint'] as Record<string, unknown> | undefined
    return {
      difficulty: (savedConfig?.difficulty as Difficulty) || 'medium',
      questionsPerRound: (savedConfig?.questionsPerRound as number) || 10,
      timePerQuestion: (savedConfig?.timePerQuestion as number) || 30,
    }
  }, [roomData?.gameConfig])

  // Initial state with merged config
  const initialState = useMemo<MathSprintState>(
    () => ({
      gamePhase: 'setup',
      activePlayers: [],
      playerMetadata: {},
      difficulty: gameConfig.difficulty,
      questionsPerRound: gameConfig.questionsPerRound,
      timePerQuestion: gameConfig.timePerQuestion,
      currentQuestionIndex: 0,
      questions: [],
      scores: {},
      correctAnswersCount: {},
      answers: [],
      questionStartTime: 0,
      questionAnswered: false,
      winnerId: null,
    }),
    [gameConfig]
  )

  // Arcade session integration
  const { state, sendMove, exitSession, lastError, clearError } =
    useArcadeSession<MathSprintState>({
      userId: viewerId || '',
      roomId: roomData?.id,
      initialState,
      applyMove: (state) => state, // Server handles all state updates
    })

  // Action: Start game
  const startGame = useCallback(() => {
    const playerMetadata = buildPlayerMetadata(activePlayers, {}, players, viewerId || undefined)

    sendMove({
      type: 'START_GAME',
      playerId: TEAM_MOVE, // Free-for-all: no specific turn owner
      userId: viewerId || '',
      data: { activePlayers, playerMetadata },
    })
  }, [activePlayers, players, viewerId, sendMove])

  // Action: Submit answer
  const submitAnswer = useCallback(
    (answer: number) => {
      // Find this user's player ID from game state
      const myPlayerId = state.activePlayers.find((pid) => {
        return state.playerMetadata[pid]?.userId === viewerId
      })

      if (!myPlayerId) {
        console.error('[MathSprint] No player found for current user')
        return
      }

      sendMove({
        type: 'SUBMIT_ANSWER',
        playerId: myPlayerId, // Specific player answering
        userId: viewerId || '',
        data: { answer },
      })
    },
    [state.activePlayers, state.playerMetadata, viewerId, sendMove]
  )

  // Action: Next question
  const nextQuestion = useCallback(() => {
    sendMove({
      type: 'NEXT_QUESTION',
      playerId: TEAM_MOVE, // Any player can advance
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  // Action: Reset game
  const resetGame = useCallback(() => {
    sendMove({
      type: 'RESET_GAME',
      playerId: TEAM_MOVE,
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  // Action: Set config
  const setConfig = useCallback(
    (field: 'difficulty' | 'questionsPerRound' | 'timePerQuestion', value: any) => {
      sendMove({
        type: 'SET_CONFIG',
        playerId: TEAM_MOVE,
        userId: viewerId || '',
        data: { field, value },
      })

      // Persist to database for next session
      if (roomData?.id) {
        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...roomData.gameConfig,
            'math-sprint': {
              ...(roomData.gameConfig?.['math-sprint'] || {}),
              [field]: value,
            },
          },
        })
      }
    },
    [viewerId, sendMove, updateGameConfig, roomData]
  )

  const contextValue: MathSprintContextValue = {
    state,
    lastError,
    startGame,
    submitAnswer,
    nextQuestion,
    resetGame,
    setConfig,
    clearError,
    exitSession,
  }

  return <MathSprintContext.Provider value={contextValue}>{children}</MathSprintContext.Provider>
}
