'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGameMode } from '@/contexts/GameModeContext'
import { useArcadeSession } from '@/hooks/useArcadeSession'
import { useRoomData, useUpdateGameConfig } from '@/hooks/useRoomData'
import { useViewerId } from '@/hooks/useViewerId'
import type { GameMove } from '@/lib/arcade/validation'
import { TEAM_MOVE } from '@/lib/arcade/validation/types'
import {
  buildPlayerMetadata as buildPlayerMetadataUtil,
  buildPlayerOwnershipFromRoomData,
} from '@/lib/arcade/player-ownership.client'
import { initialState } from '../reducer'
import type { QuizCard, SorobanQuizState } from '../types'
import { MemoryQuizContext, type MemoryQuizContextValue } from './MemoryQuizContext'

/**
 * Optimistic move application (client-side prediction)
 * The server will validate and send back the authoritative state
 */
function applyMoveOptimistically(state: SorobanQuizState, move: GameMove): SorobanQuizState {
  switch (move.type) {
    case 'START_QUIZ': {
      // Handle both client-generated moves (with quizCards) and server-generated moves (with numbers only)
      // Server can't serialize React components, so it only sends numbers
      const clientQuizCards = move.data.quizCards
      const serverNumbers = move.data.numbers

      let quizCards: QuizCard[]
      let correctAnswers: number[]

      if (clientQuizCards) {
        // Client-side optimistic update: use the full quizCards with React components
        quizCards = clientQuizCards
        correctAnswers = clientQuizCards.map((card: QuizCard) => card.number)
      } else if (serverNumbers) {
        // Server update: create minimal quizCards from numbers (no React components needed for validation)
        quizCards = serverNumbers.map((number: number) => ({
          number,
          svgComponent: null,
          element: null,
        }))
        correctAnswers = serverNumbers
      } else {
        // Fallback: preserve existing state
        quizCards = state.quizCards
        correctAnswers = state.correctAnswers
      }

      const cardCount = quizCards.length

      // Initialize player scores for all active players (by userId, not playerId)
      const activePlayers = move.data.activePlayers || []
      const playerMetadata = move.data.playerMetadata || {}

      console.log('🎯 [START_QUIZ] Initializing player scores:', {
        activePlayers,
        playerMetadata,
      })

      // Extract unique userIds from playerMetadata
      const uniqueUserIds = new Set<string>()
      for (const playerId of activePlayers) {
        const metadata = playerMetadata[playerId]
        console.log('🎯 [START_QUIZ] Processing player:', {
          playerId,
          metadata,
          hasUserId: !!metadata?.userId,
        })
        if (metadata?.userId) {
          uniqueUserIds.add(metadata.userId)
        }
      }

      console.log('🎯 [START_QUIZ] Unique userIds found:', Array.from(uniqueUserIds))

      // Initialize scores for each userId
      const playerScores = Array.from(uniqueUserIds).reduce((acc: any, userId: string) => {
        acc[userId] = { correct: 0, incorrect: 0 }
        return acc
      }, {})

      console.log('🎯 [START_QUIZ] Initialized playerScores:', playerScores)

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
        // Multiplayer state
        activePlayers,
        playerMetadata,
        playerScores,
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
      // Track scores by userId (not playerId) since we can't determine which player typed
      // Defensive check: ensure state properties exist
      const playerScores = state.playerScores || {}
      const foundNumbers = state.foundNumbers || []
      const numberFoundBy = state.numberFoundBy || {}

      console.log('✅ [ACCEPT_NUMBER] Before update:', {
        moveUserId: move.userId,
        currentPlayerScores: playerScores,
        number: move.data.number,
      })

      const newPlayerScores = { ...playerScores }
      const newNumberFoundBy = { ...numberFoundBy }

      if (move.userId) {
        const currentScore = newPlayerScores[move.userId] || { correct: 0, incorrect: 0 }
        newPlayerScores[move.userId] = {
          ...currentScore,
          correct: currentScore.correct + 1,
        }
        // Track who found this number
        newNumberFoundBy[move.data.number] = move.userId

        console.log('✅ [ACCEPT_NUMBER] After update:', {
          userId: move.userId,
          newScore: newPlayerScores[move.userId],
          allScores: newPlayerScores,
          numberFoundBy: move.data.number,
        })
      } else {
        console.warn('⚠️ [ACCEPT_NUMBER] No userId in move!')
      }
      return {
        ...state,
        foundNumbers: [...foundNumbers, move.data.number],
        playerScores: newPlayerScores,
        numberFoundBy: newNumberFoundBy,
      }
    }

    case 'REJECT_NUMBER': {
      // Track scores by userId (not playerId) since we can't determine which player typed
      // Defensive check: ensure state properties exist
      const playerScores = state.playerScores || {}

      console.log('❌ [REJECT_NUMBER] Before update:', {
        moveUserId: move.userId,
        currentPlayerScores: playerScores,
      })

      const newPlayerScores = { ...playerScores }
      if (move.userId) {
        const currentScore = newPlayerScores[move.userId] || { correct: 0, incorrect: 0 }
        newPlayerScores[move.userId] = {
          ...currentScore,
          incorrect: currentScore.incorrect + 1,
        }
        console.log('❌ [REJECT_NUMBER] After update:', {
          userId: move.userId,
          newScore: newPlayerScores[move.userId],
          allScores: newPlayerScores,
        })
      } else {
        console.warn('⚠️ [REJECT_NUMBER] No userId in move!')
      }
      return {
        ...state,
        guessesRemaining: state.guessesRemaining - 1,
        incorrectGuesses: state.incorrectGuesses + 1,
        playerScores: newPlayerScores,
      }
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
      const { field, value } = move.data as {
        field: 'selectedCount' | 'displayTime' | 'selectedDifficulty' | 'playMode'
        value: any
      }
      return {
        ...state,
        [field]: value,
      }
    }

    default:
      return state
  }
}

/**
 * RoomMemoryQuizProvider - Provides context for room-based multiplayer mode
 *
 * This provider uses useArcadeSession for network-synchronized gameplay.
 * All state changes are sent as moves and validated on the server.
 */
export function RoomMemoryQuizProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers: activePlayerIds, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()

  // Get active player IDs as array
  const activePlayers = Array.from(activePlayerIds)

  // LOCAL-ONLY state for current input (not synced over network)
  // This prevents sending a network request for every keystroke
  const [localCurrentInput, setLocalCurrentInput] = useState('')

  // Merge saved game config from room with initialState
  // Settings are scoped by game name to preserve settings when switching games
  const mergedInitialState = useMemo(() => {
    const gameConfig = roomData?.gameConfig as Record<string, any> | null | undefined
    if (!gameConfig) return initialState

    // Get settings for this specific game (memory-quiz)
    const savedConfig = gameConfig['memory-quiz'] as Record<string, any> | null | undefined
    if (!savedConfig) return initialState

    console.log('[RoomMemoryQuizProvider] Loading saved game config for memory-quiz:', savedConfig)

    return {
      ...initialState,
      // Restore settings from saved config
      selectedCount: savedConfig.selectedCount ?? initialState.selectedCount,
      displayTime: savedConfig.displayTime ?? initialState.displayTime,
      selectedDifficulty: savedConfig.selectedDifficulty ?? initialState.selectedDifficulty,
      playMode: savedConfig.playMode ?? initialState.playMode,
    }
  }, [roomData?.gameConfig])

  // Arcade session integration WITH room sync
  const {
    state,
    sendMove,
    connected: _connected,
    exitSession,
  } = useArcadeSession<SorobanQuizState>({
    userId: viewerId || '',
    roomId: roomData?.id, // CRITICAL: Pass roomId for network sync across room members
    initialState: mergedInitialState,
    applyMove: applyMoveOptimistically,
  })

  // Clear local input when game phase changes or when game resets
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

  // Detect state corruption/mismatch (e.g., game type mismatch between sessions)
  const hasStateCorruption =
    !state.quizCards ||
    !state.correctAnswers ||
    !state.foundNumbers ||
    !Array.isArray(state.quizCards)

  // Computed values
  const isGameActive = state.gamePhase === 'display' || state.gamePhase === 'input'

  // Build player metadata from room data and player map
  const buildPlayerMetadata = useCallback(() => {
    console.log('🔍 [buildPlayerMetadata] Starting:', {
      roomData: roomData?.id,
      activePlayers,
      viewerId,
      playersMapSize: players.size,
    })

    const playerOwnership = buildPlayerOwnershipFromRoomData(roomData)
    console.log('🔍 [buildPlayerMetadata] Player ownership:', playerOwnership)

    const metadata = buildPlayerMetadataUtil(activePlayers, playerOwnership, players, viewerId)
    console.log('🔍 [buildPlayerMetadata] Built metadata:', metadata)

    return metadata
  }, [activePlayers, players, roomData, viewerId])

  // Action creators - send moves to arcade session
  const startQuiz = useCallback(
    (quizCards: QuizCard[]) => {
      // Extract only serializable data (numbers) for server
      // React components can't be sent over Socket.IO
      const numbers = quizCards.map((card) => card.number)

      // Build player metadata for multiplayer
      const playerMetadata = buildPlayerMetadata()

      console.log('🚀 [startQuiz] Sending START_QUIZ move:', {
        viewerId,
        activePlayers,
        playerMetadata,
        numbers,
      })

      sendMove({
        type: 'START_QUIZ',
        playerId: TEAM_MOVE, // Team move - all players act together
        userId: viewerId || '', // User who initiated
        data: {
          numbers, // Send to server
          quizCards, // Keep for optimistic local update
          activePlayers, // Send active players list
          playerMetadata, // Send player display info
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
      // Clear local input immediately
      setLocalCurrentInput('')

      console.log('🚀 [acceptNumber] Sending ACCEPT_NUMBER move:', {
        viewerId,
        number,
      })

      sendMove({
        type: 'ACCEPT_NUMBER',
        playerId: TEAM_MOVE, // Team move - can't identify specific player
        userId: viewerId || '', // User who guessed correctly
        data: { number },
      })
    },
    [viewerId, sendMove]
  )

  const rejectNumber = useCallback(() => {
    // Clear local input immediately
    setLocalCurrentInput('')

    console.log('🚀 [rejectNumber] Sending REJECT_NUMBER move:', {
      viewerId,
    })

    sendMove({
      type: 'REJECT_NUMBER',
      playerId: TEAM_MOVE, // Team move - can't identify specific player
      userId: viewerId || '', // User who guessed incorrectly
      data: {},
    })
  }, [viewerId, sendMove])

  const setInput = useCallback((input: string) => {
    // LOCAL ONLY - no network sync!
    // This makes typing instant with zero network lag
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
    (field: 'selectedCount' | 'displayTime' | 'selectedDifficulty' | 'playMode', value: any) => {
      sendMove({
        type: 'SET_CONFIG',
        playerId: TEAM_MOVE,
        userId: viewerId || '',
        data: { field, value },
      })

      // Save setting to room's gameConfig for persistence
      // Settings are scoped by game name to preserve settings when switching games
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentMemoryQuizConfig =
          (currentGameConfig['memory-quiz'] as Record<string, any>) || {}

        const updatedConfig = {
          ...currentGameConfig,
          'memory-quiz': {
            ...currentMemoryQuizConfig,
            [field]: value,
          },
        }
        console.log('[RoomMemoryQuizProvider] Saving game config for memory-quiz:', updatedConfig)
        updateGameConfig({
          roomId: roomData.id,
          gameConfig: updatedConfig,
        })
      }
    },
    [viewerId, sendMove, roomData?.id, roomData?.gameConfig, updateGameConfig]
  )

  // Merge network state with local input state
  const mergedState = {
    ...state,
    currentInput: localCurrentInput, // Override network state with local input
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
              fontWeight: '600',
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
        <button
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

  // Determine if current user is the room creator (controls card timing)
  const isRoomCreator =
    roomData?.members.find((member) => member.userId === viewerId)?.isCreator || false

  const contextValue: MemoryQuizContextValue = {
    state: mergedState,
    dispatch: () => {
      // No-op - replaced with action creators
      console.warn('dispatch() is deprecated in room mode, use action creators instead')
    },
    isGameActive,
    resetGame,
    exitSession,
    isRoomCreator, // Pass room creator flag to components
    // Expose action creators for components to use
    startQuiz,
    nextCard,
    showInputPhase,
    acceptNumber,
    rejectNumber,
    setInput,
    showResults,
    setConfig,
  }

  return <MemoryQuizContext.Provider value={contextValue}>{children}</MemoryQuizContext.Provider>
}

// Export the hook for this provider
export { useMemoryQuiz } from './MemoryQuizContext'
