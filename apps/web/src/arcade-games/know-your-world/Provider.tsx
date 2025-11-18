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
  endStudy: () => void
  returnToSetup: () => void

  // Setup actions
  setMap: (map: 'world' | 'usa') => void
  setMode: (mode: 'cooperative' | 'race' | 'turn-based') => void
  setDifficulty: (difficulty: 'easy' | 'hard') => void
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
      difficulty: (gameConfig?.difficulty as 'easy' | 'hard') || 'easy',
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
      sendMove({
        type: 'CLICK_REGION',
        playerId: viewerId || 'player-1',
        userId: viewerId || '',
        data: { regionId, regionName },
      })
    },
    [viewerId, sendMove]
  )

  // Action: Next Round
  const nextRound = useCallback(() => {
    sendMove({
      type: 'NEXT_ROUND',
      playerId: activePlayers[0] || 'player-1',
      userId: viewerId || '',
      data: {},
    })
  }, [activePlayers, viewerId, sendMove])

  // Action: End Game
  const endGame = useCallback(() => {
    sendMove({
      type: 'END_GAME',
      playerId: viewerId || 'player-1',
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  // Setup Action: Set Map
  const setMap = useCallback(
    (selectedMap: 'world' | 'usa') => {
      sendMove({
        type: 'SET_MAP',
        playerId: viewerId || 'player-1',
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
    [viewerId, sendMove, roomData, updateGameConfig]
  )

  // Setup Action: Set Mode
  const setMode = useCallback(
    (gameMode: 'cooperative' | 'race' | 'turn-based') => {
      sendMove({
        type: 'SET_MODE',
        playerId: viewerId || 'player-1',
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
    [viewerId, sendMove, roomData, updateGameConfig]
  )

  // Setup Action: Set Difficulty
  const setDifficulty = useCallback(
    (difficulty: 'easy' | 'hard') => {
      sendMove({
        type: 'SET_DIFFICULTY',
        playerId: viewerId || 'player-1',
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
    [viewerId, sendMove, roomData, updateGameConfig]
  )

  // Setup Action: Set Study Duration
  const setStudyDuration = useCallback(
    (studyDuration: 0 | 30 | 60 | 120) => {
      sendMove({
        type: 'SET_STUDY_DURATION',
        playerId: viewerId || 'player-1',
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
    [viewerId, sendMove, roomData, updateGameConfig]
  )

  // Action: End Study
  const endStudy = useCallback(() => {
    sendMove({
      type: 'END_STUDY',
      playerId: viewerId || 'player-1',
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

  // Setup Action: Set Continent
  const setContinent = useCallback(
    (selectedContinent: import('./continents').ContinentId | 'all') => {
      sendMove({
        type: 'SET_CONTINENT',
        playerId: viewerId || 'player-1',
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
    [viewerId, sendMove, roomData, updateGameConfig]
  )

  // Action: Return to Setup
  const returnToSetup = useCallback(() => {
    sendMove({
      type: 'RETURN_TO_SETUP',
      playerId: viewerId || 'player-1',
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove])

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
