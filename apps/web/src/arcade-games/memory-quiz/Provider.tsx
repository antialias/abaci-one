'use client'

import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useGameMode } from '@/contexts/GameModeContext'
import { useArcadeSession } from '@/hooks/useArcadeSession'
import { useRoomData, useUpdateGameConfig } from '@/hooks/useRoomData'
import { useViewerId } from '@/hooks/useViewerId'
import {
  buildPlayerMetadata as buildPlayerMetadataUtil,
  buildPlayerOwnershipFromRoomData,
} from '@/lib/arcade/player-ownership.client'
import { TEAM_MOVE } from '@/lib/arcade/validation/types'
import type { QuizCard, MemoryQuizState, MemoryQuizMove } from './types'

import type { GameMove } from '@/lib/arcade/validation'

/**
 * Optimistic move application (client-side prediction)
 * The server will validate and send back the authoritative state
 */
function applyMoveOptimistically(state: MemoryQuizState, move: GameMove): MemoryQuizState {
  const typedMove = move as MemoryQuizMove
  switch (typedMove.type) {
    case 'START_QUIZ': {
      // Handle both client-generated moves (with quizCards) and server-generated moves (with numbers only)
      const clientQuizCards = typedMove.data.quizCards
      const serverNumbers = typedMove.data.numbers

      let quizCards: QuizCard[]
      let correctAnswers: number[]

      if (clientQuizCards) {
        // Client-side optimistic update: use the full quizCards with React components
        quizCards = clientQuizCards
        correctAnswers = clientQuizCards.map((card: QuizCard) => card.number)
      } else if (serverNumbers) {
        // Server update: create minimal quizCards from numbers
        quizCards = serverNumbers.map((number: number) => ({
          number,
          svgComponent: null,
          element: null,
        }))
        correctAnswers = serverNumbers
      } else {
        quizCards = state.quizCards
        correctAnswers = state.correctAnswers
      }

      const cardCount = quizCards.length

      // Initialize player scores for all active players (by userId)
      const activePlayers = typedMove.data.activePlayers || []
      const playerMetadata = typedMove.data.playerMetadata || {}

      const uniqueUserIds = new Set<string>()
      for (const playerId of activePlayers) {
        const metadata = playerMetadata[playerId]
        if (metadata?.userId) {
          uniqueUserIds.add(metadata.userId)
        }
      }

      const playerScores = Array.from(uniqueUserIds).reduce(
        (acc: Record<string, { correct: number; incorrect: number }>, userId: string) => {
          acc[userId] = { correct: 0, incorrect: 0 }
          return acc
        },
        {}
      )

      return {
        ...state,
        quizCards,
        correctAnswers,
        currentCardIndex: 0,
        foundNumbers: [],
        guessesRemaining: cardCount + Math.floor(cardCount / 2),
        gamePhase: 'display',
        incorrectGuesses: 0,
        currentInput: '',
        wrongGuessAnimations: [],
        prefixAcceptanceTimeout: null,
        activePlayers,
        playerMetadata,
        playerScores,
        numberFoundBy: {},
      }
    }

    case 'NEXT_CARD':
      return {
        ...state,
        currentCardIndex: state.currentCardIndex + 1,
      }

    case 'SHOW_INPUT_PHASE':
      return {
        ...state,
        gamePhase: 'input',
      }

    case 'ACCEPT_NUMBER': {
      const playerScores = state.playerScores || {}
      const foundNumbers = state.foundNumbers || []
      const numberFoundBy = state.numberFoundBy || {}

      const newPlayerScores = { ...playerScores }
      const newNumberFoundBy = { ...numberFoundBy }

      if (typedMove.userId) {
        const currentScore = newPlayerScores[typedMove.userId] || {
          correct: 0,
          incorrect: 0,
        }
        newPlayerScores[typedMove.userId] = {
          ...currentScore,
          correct: currentScore.correct + 1,
        }
        newNumberFoundBy[typedMove.data.number] = typedMove.userId
      }

      return {
        ...state,
        foundNumbers: [...foundNumbers, typedMove.data.number],
        currentInput: '',
        playerScores: newPlayerScores,
        numberFoundBy: newNumberFoundBy,
      }
    }

    case 'REJECT_NUMBER': {
      const playerScores = state.playerScores || {}
      const newPlayerScores = { ...playerScores }

      if (typedMove.userId) {
        const currentScore = newPlayerScores[typedMove.userId] || {
          correct: 0,
          incorrect: 0,
        }
        newPlayerScores[typedMove.userId] = {
          ...currentScore,
          incorrect: currentScore.incorrect + 1,
        }
      }

      return {
        ...state,
        guessesRemaining: state.guessesRemaining - 1,
        incorrectGuesses: state.incorrectGuesses + 1,
        currentInput: '',
        playerScores: newPlayerScores,
      }
    }

    case 'SET_INPUT':
      return {
        ...state,
        currentInput: typedMove.data.input,
      }

    case 'SHOW_RESULTS':
      return {
        ...state,
        gamePhase: 'results',
      }

    case 'RESET_QUIZ':
      return {
        ...state,
        gamePhase: 'setup',
        quizCards: [],
        correctAnswers: [],
        currentCardIndex: 0,
        foundNumbers: [],
        guessesRemaining: 0,
        currentInput: '',
        incorrectGuesses: 0,
        wrongGuessAnimations: [],
        prefixAcceptanceTimeout: null,
        finishButtonsBound: false,
      }

    case 'SET_CONFIG': {
      const { field, value } = typedMove.data
      return {
        ...state,
        [field]: value,
      }
    }

    default:
      return state
  }
}

// Context interface
export interface MemoryQuizContextValue {
  state: MemoryQuizState
  isGameActive: boolean
  isRoomCreator: boolean
  resetGame: () => void
  exitSession?: () => void
  startQuiz: (quizCards: QuizCard[]) => void
  nextCard: () => void
  showInputPhase: () => void
  acceptNumber: (number: number) => void
  rejectNumber: () => void
  setInput: (input: string) => void
  showResults: () => void
  setConfig: (
    field: 'selectedCount' | 'displayTime' | 'selectedDifficulty' | 'playMode',
    value: unknown
  ) => void
  // Legacy dispatch for UI-only actions (to be migrated to local state)
  dispatch: (action: unknown) => void
}

// Create context
const MemoryQuizContext = createContext<MemoryQuizContextValue | null>(null)

// Hook to use the context
export function useMemoryQuiz(): MemoryQuizContextValue {
  const context = useContext(MemoryQuizContext)
  if (!context) {
    throw new Error('useMemoryQuiz must be used within MemoryQuizProvider')
  }
  return context
}

/**
 * MemoryQuizProvider - Unified provider for room-based multiplayer
 *
 * This provider uses useArcadeSession for network-synchronized gameplay.
 * All state changes are sent as moves and validated on the server.
 */
export function MemoryQuizProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers: activePlayerIds, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()

  const activePlayers = Array.from(activePlayerIds)

  // LOCAL-ONLY state for current input (not synced over network)
  const [localCurrentInput, setLocalCurrentInput] = useState('')

  // Merge saved game config from room with default initial state
  const mergedInitialState = useMemo(() => {
    const gameConfig = roomData?.gameConfig as Record<string, unknown> | null | undefined

    const savedConfig = gameConfig?.['memory-quiz'] as Record<string, unknown> | null | undefined

    // Default initial state
    const defaultState: MemoryQuizState = {
      cards: [],
      quizCards: [],
      correctAnswers: [],
      currentCardIndex: 0,
      displayTime: 2.0,
      selectedCount: 5,
      selectedDifficulty: 'easy',
      foundNumbers: [],
      guessesRemaining: 0,
      currentInput: '',
      incorrectGuesses: 0,
      activePlayers: [],
      playerMetadata: {},
      playerScores: {},
      playMode: 'cooperative',
      numberFoundBy: {},
      gamePhase: 'setup',
      prefixAcceptanceTimeout: null,
      finishButtonsBound: false,
      wrongGuessAnimations: [],
      hasPhysicalKeyboard: null,
      testingMode: false,
      showOnScreenKeyboard: false,
    }

    if (!savedConfig) {
      return defaultState
    }

    return {
      ...defaultState,
      selectedCount:
        (savedConfig.selectedCount as 2 | 5 | 8 | 12 | 15) ?? defaultState.selectedCount,
      displayTime: (savedConfig.displayTime as number) ?? defaultState.displayTime,
      selectedDifficulty:
        (savedConfig.selectedDifficulty as MemoryQuizState['selectedDifficulty']) ??
        defaultState.selectedDifficulty,
      playMode: (savedConfig.playMode as 'cooperative' | 'competitive') ?? defaultState.playMode,
    }
  }, [roomData?.gameConfig])

  // Arcade session integration
  const { state, sendMove, exitSession } = useArcadeSession<MemoryQuizState>({
    userId: viewerId || '',
    roomId: roomData?.id || undefined,
    initialState: mergedInitialState,
    applyMove: applyMoveOptimistically,
  })

  // Clear local input when game phase changes
  useEffect(() => {
    if (state.gamePhase !== 'input') {
      setLocalCurrentInput('')
    }
  }, [state.gamePhase])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (state.prefixAcceptanceTimeout) {
        clearTimeout(state.prefixAcceptanceTimeout)
      }
    }
  }, [state.prefixAcceptanceTimeout])

  // Detect state corruption
  const hasStateCorruption =
    !state.quizCards ||
    !state.correctAnswers ||
    !state.foundNumbers ||
    !Array.isArray(state.quizCards)

  // Computed values
  const isGameActive = state.gamePhase === 'display' || state.gamePhase === 'input'

  // Build player metadata
  const buildPlayerMetadata = useCallback(() => {
    const playerOwnership = buildPlayerOwnershipFromRoomData(roomData)
    const metadata = buildPlayerMetadataUtil(
      activePlayers,
      playerOwnership,
      players,
      viewerId || undefined
    )
    return metadata
  }, [activePlayers, players, roomData, viewerId])

  // Action creators
  const startQuiz = useCallback(
    (quizCards: QuizCard[]) => {
      const numbers = quizCards.map((card) => card.number)
      const playerMetadata = buildPlayerMetadata()

      sendMove({
        type: 'START_QUIZ',
        playerId: TEAM_MOVE,
        userId: viewerId || '',
        data: {
          numbers,
          quizCards,
          activePlayers,
          playerMetadata,
        },
      })
    },
    [viewerId, sendMove, activePlayers, buildPlayerMetadata]
  )

  const nextCard = useCallback(() => {
    sendMove({
      type: 'NEXT_CARD',
      playerId: TEAM_MOVE,
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  const showInputPhase = useCallback(() => {
    sendMove({
      type: 'SHOW_INPUT_PHASE',
      playerId: TEAM_MOVE,
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  const acceptNumber = useCallback(
    (number: number) => {
      setLocalCurrentInput('')
      sendMove({
        type: 'ACCEPT_NUMBER',
        playerId: TEAM_MOVE,
        userId: viewerId || '',
        data: { number },
      })
    },
    [viewerId, sendMove]
  )

  const rejectNumber = useCallback(() => {
    setLocalCurrentInput('')
    sendMove({
      type: 'REJECT_NUMBER',
      playerId: TEAM_MOVE,
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  const setInput = useCallback((input: string) => {
    // LOCAL ONLY - no network sync for instant typing
    setLocalCurrentInput(input)
  }, [])

  const showResults = useCallback(() => {
    sendMove({
      type: 'SHOW_RESULTS',
      playerId: TEAM_MOVE,
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  const resetGame = useCallback(() => {
    sendMove({
      type: 'RESET_QUIZ',
      playerId: TEAM_MOVE,
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  const setConfig = useCallback(
    (
      field: 'selectedCount' | 'displayTime' | 'selectedDifficulty' | 'playMode',
      value: unknown
    ) => {
      sendMove({
        type: 'SET_CONFIG',
        playerId: TEAM_MOVE,
        userId: viewerId || '',
        data: { field, value },
      })

      // Save to room config for persistence
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, unknown>) || {}
        const currentMemoryQuizConfig =
          (currentGameConfig['memory-quiz'] as Record<string, unknown>) || {}

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            'memory-quiz': {
              ...currentMemoryQuizConfig,
              [field]: value,
            },
          },
        })
      }
    },
    [viewerId, sendMove, roomData?.id, roomData?.gameConfig, updateGameConfig]
  )

  // Legacy dispatch stub for UI-only actions
  // TODO: Migrate these to local component state
  const dispatch = useCallback((action: unknown) => {
    console.warn(
      '[MemoryQuizProvider] dispatch() is deprecated for UI-only actions. These should be migrated to local component state:',
      action
    )
    // No-op - UI-only state changes should be handled locally
  }, [])

  // Merge network state with local input
  const mergedState = {
    ...state,
    currentInput: localCurrentInput,
  }

  // Determine if current user is room creator
  const isRoomCreator =
    roomData?.members.find((member) => member.userId === viewerId)?.isCreator || false

  // Handle state corruption
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
          There's a mismatch between game types in this room. This usually happens when room members
          are playing different games.
        </p>
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
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Refresh Page
        </button>
      </div>
    )
  }

  const contextValue: MemoryQuizContextValue = {
    state: mergedState,
    isGameActive,
    resetGame,
    exitSession,
    isRoomCreator,
    startQuiz,
    nextCard,
    showInputPhase,
    acceptNumber,
    rejectNumber,
    setInput,
    showResults,
    setConfig,
    dispatch,
  }

  return <MemoryQuizContext.Provider value={contextValue}>{children}</MemoryQuizContext.Provider>
}
