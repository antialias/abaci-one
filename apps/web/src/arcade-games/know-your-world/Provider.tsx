'use client'

import { createContext, useCallback, useContext, useMemo } from 'react'
import {
  buildPlayerMetadata,
  useArcadeSession,
  useGameMode,
  useRoomData,
  useUpdateGameConfig,
  useViewerId,
} from '@/lib/arcade/game-sdk'
import { buildPlayerOwnershipFromRoomData } from '@/lib/arcade/player-ownership.client'
import type { KnowYourWorldState, KnowYourWorldMove } from './types'

interface KnowYourWorldContextValue {
  state: KnowYourWorldState
  lastError: string | null
  clearError: () => void
  exitSession: () => void

  // Game actions
  startGame: () => void
  clickRegion: (regionId: string, regionName: string) => void
  nextRound: () => void
  endGame: () => void
  giveUp: () => void
  endStudy: () => void
  returnToSetup: () => void

  // Setup actions
  setMap: (map: 'world' | 'usa') => void
  setMode: (mode: 'cooperative' | 'race' | 'turn-based') => void
  setDifficulty: (difficulty: string) => void
  setStudyDuration: (duration: 0 | 30 | 60 | 120) => void
  setContinent: (continent: import('./continents').ContinentId | 'all') => void
}

const KnowYourWorldContext = createContext<KnowYourWorldContextValue | null>(null)

export function useKnowYourWorld() {
  const context = useContext(KnowYourWorldContext)
  if (!context) {
    throw new Error('useKnowYourWorld must be used within KnowYourWorldProvider')
  }
  return context
}

export function KnowYourWorldProvider({ children }: { children: React.ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers: activePlayerIds, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()

  const activePlayers = Array.from(activePlayerIds)

  // Merge saved config from room
  const initialState = useMemo(() => {
    const gameConfig = (roomData?.gameConfig as any)?.['know-your-world']

    // Validate studyDuration to ensure it's one of the allowed values
    const rawDuration = gameConfig?.studyDuration
    const studyDuration: 0 | 30 | 60 | 120 =
      rawDuration === 30 || rawDuration === 60 || rawDuration === 120 ? rawDuration : 0

    // Validate selectedContinent
    const rawContinent = gameConfig?.selectedContinent
    const validContinents = [
      'all',
      'africa',
      'asia',
      'europe',
      'north-america',
      'south-america',
      'oceania',
      'antarctica',
    ]
    const selectedContinent: import('./continents').ContinentId | 'all' =
      typeof rawContinent === 'string' && validContinents.includes(rawContinent)
        ? (rawContinent as any)
        : 'all'

    return {
      gamePhase: 'setup' as const,
      selectedMap: (gameConfig?.selectedMap as 'world' | 'usa') || 'world',
      gameMode: (gameConfig?.gameMode as 'cooperative' | 'race' | 'turn-based') || 'cooperative',
      difficulty: gameConfig?.difficulty || 'medium',
      studyDuration,
      selectedContinent,
      studyTimeRemaining: 0,
      studyStartTime: 0,
      currentPrompt: null,
      regionsToFind: [],
      regionsFound: [],
      currentPlayer: '',
      scores: {},
      attempts: {},
      guessHistory: [],
      startTime: 0,
      activePlayers: [],
      playerMetadata: {},
      giveUpRegionId: null,
      giveUpTimestamp: 0,
    }
  }, [roomData])

  const { state, sendMove, exitSession, lastError, clearError } =
    useArcadeSession<KnowYourWorldState>({
      userId: viewerId || '',
      roomId: roomData?.id,
      initialState,
      applyMove: (state) => state, // Server handles all state updates
    })

  // Action: Start Game
  const startGame = useCallback(() => {
    const playerMetadata = buildPlayerMetadata(activePlayers, {}, players, viewerId || undefined)

    sendMove({
      type: 'START_GAME',
      playerId: activePlayers[0] || 'player-1',
      userId: viewerId || '',
      data: {
        activePlayers,
        playerMetadata,
        selectedMap: state.selectedMap,
        gameMode: state.gameMode,
        difficulty: state.difficulty,
      },
    })
  }, [
    activePlayers,
    players,
    viewerId,
    sendMove,
    state.selectedMap,
    state.gameMode,
    state.difficulty,
  ])

  // Action: Click Region
  const clickRegion = useCallback(
    (regionId: string, regionName: string) => {
      console.log('[CLICK] clickRegion called:', {
        regionId,
        regionName,
        currentPlayer: state.currentPlayer,
        viewerId,
        currentPrompt: state.currentPrompt,
        isCorrect: regionId === state.currentPrompt,
      })

      // Use the current player from game state (PLAYER ID, not USER ID)
      // In turn-based mode, this is the player whose turn it is
      // In other modes, all moves use the current player ID
      sendMove({
        type: 'CLICK_REGION',
        playerId: state.currentPlayer, // CRITICAL: Use PLAYER ID from state, not USER ID
        userId: viewerId || '',
        data: { regionId, regionName },
      })

      console.log('[CLICK] sendMove dispatched')
    },
    [viewerId, sendMove, state.currentPlayer, state.currentPrompt]
  )

  // Action: Next Round
  const nextRound = useCallback(() => {
    sendMove({
      type: 'NEXT_ROUND',
      playerId: state.currentPlayer || activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    })
  }, [activePlayers, viewerId, sendMove, state.currentPlayer])

  // Action: End Game
  const endGame = useCallback(() => {
    sendMove({
      type: 'END_GAME',
      playerId: state.currentPlayer || activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove, state.currentPlayer, activePlayers])

  // Action: Give Up (show current region and advance)
  const giveUp = useCallback(() => {
    sendMove({
      type: 'GIVE_UP',
      playerId: state.currentPlayer || activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove, state.currentPlayer, activePlayers])

  // Setup Action: Set Map
  const setMap = useCallback(
    (selectedMap: 'world' | 'usa') => {
      sendMove({
        type: 'SET_MAP',
        playerId: activePlayers[0] || '', // Use first active player
        userId: viewerId || '',
        data: { selectedMap },
      })

      // Persist to database
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentConfig = (currentGameConfig['know-your-world'] as Record<string, any>) || {}

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            'know-your-world': {
              ...currentConfig,
              selectedMap,
            },
          },
        })
      }
    },
    [viewerId, sendMove, roomData, updateGameConfig, activePlayers]
  )

  // Setup Action: Set Mode
  const setMode = useCallback(
    (gameMode: 'cooperative' | 'race' | 'turn-based') => {
      sendMove({
        type: 'SET_MODE',
        playerId: activePlayers[0] || '', // Use first active player
        userId: viewerId || '',
        data: { gameMode },
      })

      // Persist to database
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentConfig = (currentGameConfig['know-your-world'] as Record<string, any>) || {}

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            'know-your-world': {
              ...currentConfig,
              gameMode,
            },
          },
        })
      }
    },
    [viewerId, sendMove, roomData, updateGameConfig, activePlayers]
  )

  // Setup Action: Set Difficulty
  const setDifficulty = useCallback(
    (difficulty: string) => {
      sendMove({
        type: 'SET_DIFFICULTY',
        playerId: activePlayers[0] || '', // Use first active player
        userId: viewerId || '',
        data: { difficulty },
      })

      // Persist to database
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentConfig = (currentGameConfig['know-your-world'] as Record<string, any>) || {}

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            'know-your-world': {
              ...currentConfig,
              difficulty,
            },
          },
        })
      }
    },
    [viewerId, sendMove, roomData, updateGameConfig, activePlayers]
  )

  // Setup Action: Set Study Duration
  const setStudyDuration = useCallback(
    (studyDuration: 0 | 30 | 60 | 120) => {
      sendMove({
        type: 'SET_STUDY_DURATION',
        playerId: activePlayers[0] || '', // Use first active player
        userId: viewerId || '',
        data: { studyDuration },
      })

      // Persist to database
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentConfig = (currentGameConfig['know-your-world'] as Record<string, any>) || {}

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            'know-your-world': {
              ...currentConfig,
              studyDuration,
            },
          },
        })
      }
    },
    [viewerId, sendMove, roomData, updateGameConfig, activePlayers]
  )

  // Action: End Study
  const endStudy = useCallback(() => {
    sendMove({
      type: 'END_STUDY',
      playerId: state.currentPlayer || activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove, state.currentPlayer, activePlayers])

  // Setup Action: Set Continent
  const setContinent = useCallback(
    (selectedContinent: import('./continents').ContinentId | 'all') => {
      sendMove({
        type: 'SET_CONTINENT',
        playerId: activePlayers[0] || '', // Use first active player
        userId: viewerId || '',
        data: { selectedContinent },
      })

      // Persist to database
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentConfig = (currentGameConfig['know-your-world'] as Record<string, any>) || {}

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            'know-your-world': {
              ...currentConfig,
              selectedContinent,
            },
          },
        })
      }
    },
    [viewerId, sendMove, roomData, updateGameConfig, activePlayers]
  )

  // Action: Return to Setup
  const returnToSetup = useCallback(() => {
    sendMove({
      type: 'RETURN_TO_SETUP',
      playerId: state.currentPlayer || activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove, state.currentPlayer, activePlayers])

  return (
    <KnowYourWorldContext.Provider
      value={{
        state,
        lastError,
        clearError,
        exitSession,
        startGame,
        clickRegion,
        nextRound,
        endGame,
        giveUp,
        endStudy,
        returnToSetup,
        setMap,
        setMode,
        setDifficulty,
        setStudyDuration,
        setContinent,
      }}
    >
      {children}
    </KnowYourWorldContext.Provider>
  )
}
