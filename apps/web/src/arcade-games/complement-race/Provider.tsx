/**
 * Complement Race Provider
 * Manages multiplayer game state using the Arcade SDK
 */

'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  type GameMove,
  buildPlayerMetadata,
  useArcadeSession,
  useGameMode,
  useRoomData,
  useUpdateGameConfig,
  useViewerId,
} from '@/lib/arcade/game-sdk'
import { DEFAULT_COMPLEMENT_RACE_CONFIG } from '@/lib/arcade/game-configs'
import type { DifficultyTracker } from '@/app/arcade/complement-race/lib/gameTypes'
import type { ComplementRaceConfig, ComplementRaceMove, ComplementRaceState } from './types'

/**
 * Compatible state shape that matches the old single-player GameState interface
 * This allows existing UI components to work without modification
 */
interface CompatibleGameState {
  // Game configuration (extracted from config object)
  mode: string
  style: string
  timeoutSetting: string
  complementDisplay: string

  // Current question (extracted from currentQuestions[localPlayerId])
  currentQuestion: any | null
  previousQuestion: any | null

  // Game progress (extracted from players[localPlayerId])
  score: number
  streak: number
  bestStreak: number
  totalQuestions: number
  correctAnswers: number

  // Game status
  isGameActive: boolean
  isPaused: boolean
  gamePhase: 'intro' | 'controls' | 'countdown' | 'playing' | 'results'

  // Timing
  gameStartTime: number | null
  questionStartTime: number

  // Race mechanics (extracted from players[localPlayerId] and config)
  raceGoal: number
  timeLimit: number | null
  speedMultiplier: number
  aiRacers: any[]

  // Sprint mode specific (extracted from players[localPlayerId])
  momentum: number
  trainPosition: number
  pressure: number
  elapsedTime: number
  lastCorrectAnswerTime: number
  currentRoute: number
  stations: any[]
  passengers: any[]
  deliveredPassengers: number
  cumulativeDistance: number
  showRouteCelebration: boolean

  // Survival mode specific
  playerLap: number
  aiLaps: Map<string, number>
  survivalMultiplier: number

  // Input (local UI state)
  currentInput: string

  // UI state
  showScoreModal: boolean
  activeSpeechBubbles: Map<string, string>
  adaptiveFeedback: { message: string; type: string } | null
  difficultyTracker: DifficultyTracker
}

/**
 * Context value interface
 */
interface ComplementRaceContextValue {
  state: CompatibleGameState // Return adapted state
  dispatch: (action: { type: string; [key: string]: any }) => void // Compatibility layer
  lastError: string | null
  startGame: () => void
  submitAnswer: (answer: number, responseTime: number) => void
  claimPassenger: (passengerId: string) => void
  deliverPassenger: (passengerId: string) => void
  nextQuestion: () => void
  endGame: () => void
  playAgain: () => void
  goToSetup: () => void
  setConfig: (field: keyof ComplementRaceConfig, value: unknown) => void
  clearError: () => void
  exitSession: () => void
}

const ComplementRaceContext = createContext<ComplementRaceContextValue | null>(null)

/**
 * Hook to access Complement Race context
 */
export function useComplementRace() {
  const context = useContext(ComplementRaceContext)
  if (!context) {
    throw new Error('useComplementRace must be used within ComplementRaceProvider')
  }
  return context
}

/**
 * Optimistic move application (client-side prediction)
 * For now, just return current state - server will validate and send back authoritative state
 */
function applyMoveOptimistically(state: ComplementRaceState, move: GameMove): ComplementRaceState {
  // Simple optimistic updates can be added here later
  // For now, rely on server validation
  return state
}

/**
 * Complement Race Provider Component
 */
export function ComplementRaceProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers: activePlayerIds, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()

  // Get active players as array
  const activePlayers = Array.from(activePlayerIds)

  // Merge saved config from room with defaults
  const initialState = useMemo((): ComplementRaceState => {
    const gameConfig = roomData?.gameConfig as Record<string, unknown> | null | undefined
    const savedConfig = gameConfig?.['complement-race'] as Partial<ComplementRaceConfig> | undefined

    const config: ComplementRaceConfig = {
      style:
        (savedConfig?.style as ComplementRaceConfig['style']) ||
        DEFAULT_COMPLEMENT_RACE_CONFIG.style,
      mode:
        (savedConfig?.mode as ComplementRaceConfig['mode']) || DEFAULT_COMPLEMENT_RACE_CONFIG.mode,
      complementDisplay:
        (savedConfig?.complementDisplay as ComplementRaceConfig['complementDisplay']) ||
        DEFAULT_COMPLEMENT_RACE_CONFIG.complementDisplay,
      timeoutSetting:
        (savedConfig?.timeoutSetting as ComplementRaceConfig['timeoutSetting']) ||
        DEFAULT_COMPLEMENT_RACE_CONFIG.timeoutSetting,
      enableAI: savedConfig?.enableAI ?? DEFAULT_COMPLEMENT_RACE_CONFIG.enableAI,
      aiOpponentCount:
        savedConfig?.aiOpponentCount ?? DEFAULT_COMPLEMENT_RACE_CONFIG.aiOpponentCount,
      maxPlayers: savedConfig?.maxPlayers ?? DEFAULT_COMPLEMENT_RACE_CONFIG.maxPlayers,
      routeDuration: savedConfig?.routeDuration ?? DEFAULT_COMPLEMENT_RACE_CONFIG.routeDuration,
      enablePassengers:
        savedConfig?.enablePassengers ?? DEFAULT_COMPLEMENT_RACE_CONFIG.enablePassengers,
      passengerCount: savedConfig?.passengerCount ?? DEFAULT_COMPLEMENT_RACE_CONFIG.passengerCount,
      maxConcurrentPassengers:
        savedConfig?.maxConcurrentPassengers ??
        DEFAULT_COMPLEMENT_RACE_CONFIG.maxConcurrentPassengers,
      raceGoal: savedConfig?.raceGoal ?? DEFAULT_COMPLEMENT_RACE_CONFIG.raceGoal,
      winCondition:
        (savedConfig?.winCondition as ComplementRaceConfig['winCondition']) ||
        DEFAULT_COMPLEMENT_RACE_CONFIG.winCondition,
      targetScore: savedConfig?.targetScore ?? DEFAULT_COMPLEMENT_RACE_CONFIG.targetScore,
      timeLimit: savedConfig?.timeLimit ?? DEFAULT_COMPLEMENT_RACE_CONFIG.timeLimit,
      routeCount: savedConfig?.routeCount ?? DEFAULT_COMPLEMENT_RACE_CONFIG.routeCount,
    }

    return {
      config,
      gamePhase: 'setup',
      activePlayers: [],
      playerMetadata: {},
      players: {},
      currentQuestions: {},
      questionStartTime: 0,
      stations: [],
      passengers: [],
      currentRoute: 0,
      routeStartTime: null,
      raceStartTime: null,
      raceEndTime: null,
      winner: null,
      leaderboard: [],
      aiOpponents: [],
      gameStartTime: null,
      gameEndTime: null,
    }
  }, [roomData?.gameConfig])

  // Arcade session integration
  const {
    state: multiplayerState,
    sendMove,
    exitSession,
    lastError,
    clearError,
  } = useArcadeSession<ComplementRaceState>({
    userId: viewerId || '',
    roomId: roomData?.id,
    initialState,
    applyMove: applyMoveOptimistically,
  })

  // Local UI state (not synced to server)
  const [localUIState, setLocalUIState] = useState({
    currentInput: '',
    previousQuestion: null as any,
    isPaused: false,
    showScoreModal: false,
    activeSpeechBubbles: new Map<string, string>(),
    adaptiveFeedback: null as any,
    difficultyTracker: {
      pairPerformance: new Map(),
      baseTimeLimit: 3000,
      currentTimeLimit: 3000,
      difficultyLevel: 1,
      consecutiveCorrect: 0,
      consecutiveIncorrect: 0,
      learningMode: true,
      adaptationRate: 0.1,
    },
  })

  // Get local player ID
  const localPlayerId = useMemo(() => {
    return activePlayers.find((id) => {
      const player = players.get(id)
      return player?.isLocal
    })
  }, [activePlayers, players])

  // Transform multiplayer state to look like single-player state
  const compatibleState = useMemo((): CompatibleGameState => {
    const localPlayer = localPlayerId ? multiplayerState.players[localPlayerId] : null

    // Map gamePhase: setup/lobby -> controls
    let gamePhase: 'intro' | 'controls' | 'countdown' | 'playing' | 'results'
    if (multiplayerState.gamePhase === 'setup' || multiplayerState.gamePhase === 'lobby') {
      gamePhase = 'controls'
    } else if (multiplayerState.gamePhase === 'countdown') {
      gamePhase = 'countdown'
    } else if (multiplayerState.gamePhase === 'playing') {
      gamePhase = 'playing'
    } else if (multiplayerState.gamePhase === 'results') {
      gamePhase = 'results'
    } else {
      gamePhase = 'controls'
    }

    return {
      // Configuration
      mode: multiplayerState.config.mode,
      style: multiplayerState.config.style,
      timeoutSetting: multiplayerState.config.timeoutSetting,
      complementDisplay: multiplayerState.config.complementDisplay,

      // Current question
      currentQuestion: localPlayerId
        ? multiplayerState.currentQuestions[localPlayerId] || null
        : null,
      previousQuestion: localUIState.previousQuestion,

      // Player stats
      score: localPlayer?.score || 0,
      streak: localPlayer?.streak || 0,
      bestStreak: localPlayer?.bestStreak || 0,
      totalQuestions: localPlayer?.totalQuestions || 0,
      correctAnswers: localPlayer?.correctAnswers || 0,

      // Game status
      isGameActive: gamePhase === 'playing',
      isPaused: localUIState.isPaused,
      gamePhase,

      // Timing
      gameStartTime: multiplayerState.gameStartTime,
      questionStartTime: multiplayerState.questionStartTime,

      // Race mechanics
      raceGoal: multiplayerState.config.raceGoal,
      timeLimit: multiplayerState.config.timeLimit ?? null,
      speedMultiplier: 1.0,
      aiRacers: multiplayerState.aiOpponents.map((ai) => ({
        id: ai.id,
        name: ai.name,
        position: ai.position,
        speed: ai.speed,
        personality: ai.personality,
        icon: ai.personality === 'competitive' ? '🏃‍♂️' : '🏃',
        lastComment: ai.lastCommentTime,
        commentCooldown: 0,
        previousPosition: ai.position,
      })),

      // Sprint mode specific
      momentum: localPlayer?.momentum || 0,
      trainPosition: localPlayer?.position || 0,
      pressure: localPlayer?.momentum ? Math.min(100, localPlayer.momentum + 10) : 0,
      elapsedTime: multiplayerState.gameStartTime ? Date.now() - multiplayerState.gameStartTime : 0,
      lastCorrectAnswerTime: localPlayer?.lastAnswerTime || Date.now(),
      currentRoute: multiplayerState.currentRoute,
      stations: multiplayerState.stations,
      passengers: multiplayerState.passengers,
      deliveredPassengers: localPlayer?.deliveredPassengers || 0,
      cumulativeDistance: 0, // Not tracked in multiplayer yet
      showRouteCelebration: false, // Not tracked in multiplayer yet

      // Survival mode specific
      playerLap: Math.floor((localPlayer?.position || 0) / 100),
      aiLaps: new Map(),
      survivalMultiplier: 1.0,

      // Local UI state
      currentInput: localUIState.currentInput,
      showScoreModal: localUIState.showScoreModal,
      activeSpeechBubbles: localUIState.activeSpeechBubbles,
      adaptiveFeedback: localUIState.adaptiveFeedback,
      difficultyTracker: localUIState.difficultyTracker,
    }
  }, [multiplayerState, localPlayerId, localUIState])

  console.log(`🚂 Sprint: momentum=${compatibleState.momentum} pos=${compatibleState.trainPosition} pressure=${compatibleState.pressure}`)

  // Action creators
  const startGame = useCallback(() => {
    if (activePlayers.length === 0) {
      console.error('Need at least 1 player to start')
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
    } as ComplementRaceMove)
  }, [activePlayers, players, viewerId, sendMove])

  const submitAnswer = useCallback(
    (answer: number, responseTime: number) => {
      // Find the current player's ID (the one who is answering)
      const currentPlayerId = activePlayers.find((id) => {
        const player = players.get(id)
        return player?.isLocal
      })

      if (!currentPlayerId) {
        console.error('No local player found to submit answer')
        return
      }

      sendMove({
        type: 'SUBMIT_ANSWER',
        playerId: currentPlayerId,
        userId: viewerId || '',
        data: { answer, responseTime },
      } as ComplementRaceMove)
    },
    [activePlayers, players, viewerId, sendMove]
  )

  const claimPassenger = useCallback(
    (passengerId: string) => {
      const currentPlayerId = activePlayers.find((id) => {
        const player = players.get(id)
        return player?.isLocal
      })

      if (!currentPlayerId) return

      sendMove({
        type: 'CLAIM_PASSENGER',
        playerId: currentPlayerId,
        userId: viewerId || '',
        data: { passengerId },
      } as ComplementRaceMove)
    },
    [activePlayers, players, viewerId, sendMove]
  )

  const deliverPassenger = useCallback(
    (passengerId: string) => {
      const currentPlayerId = activePlayers.find((id) => {
        const player = players.get(id)
        return player?.isLocal
      })

      if (!currentPlayerId) return

      sendMove({
        type: 'DELIVER_PASSENGER',
        playerId: currentPlayerId,
        userId: viewerId || '',
        data: { passengerId },
      } as ComplementRaceMove)
    },
    [activePlayers, players, viewerId, sendMove]
  )

  const nextQuestion = useCallback(() => {
    sendMove({
      type: 'NEXT_QUESTION',
      playerId: activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    } as ComplementRaceMove)
  }, [activePlayers, viewerId, sendMove])

  const endGame = useCallback(() => {
    sendMove({
      type: 'END_GAME',
      playerId: activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    } as ComplementRaceMove)
  }, [activePlayers, viewerId, sendMove])

  const playAgain = useCallback(() => {
    sendMove({
      type: 'PLAY_AGAIN',
      playerId: activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    } as ComplementRaceMove)
  }, [activePlayers, viewerId, sendMove])

  const goToSetup = useCallback(() => {
    sendMove({
      type: 'GO_TO_SETUP',
      playerId: activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    } as ComplementRaceMove)
  }, [activePlayers, viewerId, sendMove])

  const setConfig = useCallback(
    (field: keyof ComplementRaceConfig, value: unknown) => {
      sendMove({
        type: 'SET_CONFIG',
        playerId: activePlayers[0] || '',
        userId: viewerId || '',
        data: { field, value },
      } as ComplementRaceMove)

      // Persist to database
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, unknown>) || {}
        const currentComplementRaceConfig =
          (currentGameConfig['complement-race'] as Record<string, unknown>) || {}

        const updatedConfig = {
          ...currentGameConfig,
          'complement-race': {
            ...currentComplementRaceConfig,
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

  // Compatibility dispatch function for existing UI components
  const dispatch = useCallback(
    (action: { type: string; [key: string]: any }) => {
      // Map old reducer actions to new action creators
      switch (action.type) {
        case 'START_COUNTDOWN':
        case 'BEGIN_GAME':
          startGame()
          break
        case 'SUBMIT_ANSWER':
          if (action.answer !== undefined) {
            const responseTime = Date.now() - (multiplayerState.questionStartTime || Date.now())
            submitAnswer(action.answer, responseTime)
          }
          break
        case 'NEXT_QUESTION':
          setLocalUIState((prev) => ({ ...prev, currentInput: '' }))
          nextQuestion()
          break
        case 'END_RACE':
        case 'SHOW_RESULTS':
          endGame()
          break
        case 'RESET_GAME':
        case 'SHOW_CONTROLS':
          goToSetup()
          break
        case 'SET_MODE':
          if (action.mode !== undefined) {
            setConfig('mode', action.mode)
          }
          break
        case 'SET_STYLE':
          if (action.style !== undefined) {
            setConfig('style', action.style)
          }
          break
        case 'SET_TIMEOUT':
          if (action.timeout !== undefined) {
            setConfig('timeoutSetting', action.timeout)
          }
          break
        case 'SET_COMPLEMENT_DISPLAY':
          if (action.display !== undefined) {
            setConfig('complementDisplay', action.display)
          }
          break
        case 'BOARD_PASSENGER':
        case 'CLAIM_PASSENGER':
          if (action.passengerId !== undefined) {
            claimPassenger(action.passengerId)
          }
          break
        case 'DELIVER_PASSENGER':
          if (action.passengerId !== undefined) {
            deliverPassenger(action.passengerId)
          }
          break
        // Local UI state actions
        case 'UPDATE_INPUT':
          setLocalUIState((prev) => ({ ...prev, currentInput: action.input || '' }))
          break
        case 'PAUSE_RACE':
          setLocalUIState((prev) => ({ ...prev, isPaused: true }))
          break
        case 'RESUME_RACE':
          setLocalUIState((prev) => ({ ...prev, isPaused: false }))
          break
        case 'SHOW_ADAPTIVE_FEEDBACK':
          setLocalUIState((prev) => ({ ...prev, adaptiveFeedback: action.feedback }))
          break
        case 'CLEAR_ADAPTIVE_FEEDBACK':
          setLocalUIState((prev) => ({ ...prev, adaptiveFeedback: null }))
          break
        case 'TRIGGER_AI_COMMENTARY': {
          setLocalUIState((prev) => {
            const newBubbles = new Map(prev.activeSpeechBubbles)
            newBubbles.set(action.racerId, action.message)
            return { ...prev, activeSpeechBubbles: newBubbles }
          })
          break
        }
        case 'CLEAR_AI_COMMENT': {
          setLocalUIState((prev) => {
            const newBubbles = new Map(prev.activeSpeechBubbles)
            newBubbles.delete(action.racerId)
            return { ...prev, activeSpeechBubbles: newBubbles }
          })
          break
        }
        // Other local actions that don't affect UI (can be ignored for now)
        case 'UPDATE_AI_POSITIONS':
        case 'UPDATE_MOMENTUM':
        case 'UPDATE_TRAIN_POSITION':
        case 'UPDATE_STEAM_JOURNEY':
        case 'UPDATE_DIFFICULTY_TRACKER':
        case 'UPDATE_AI_SPEEDS':
        case 'GENERATE_PASSENGERS':
        case 'START_NEW_ROUTE':
        case 'COMPLETE_ROUTE':
        case 'HIDE_ROUTE_CELEBRATION':
        case 'COMPLETE_LAP':
          // These are now handled by the server state or can be ignored
          break
        default:
          console.warn(`[ComplementRaceProvider] Unknown action type: ${action.type}`)
      }
    },
    [
      startGame,
      submitAnswer,
      nextQuestion,
      endGame,
      goToSetup,
      setConfig,
      claimPassenger,
      deliverPassenger,
      multiplayerState.questionStartTime,
    ]
  )

  const contextValue: ComplementRaceContextValue = {
    state: compatibleState, // Use transformed state
    dispatch,
    lastError,
    startGame,
    submitAnswer,
    claimPassenger,
    deliverPassenger,
    nextQuestion,
    endGame,
    playAgain,
    goToSetup,
    setConfig,
    clearError,
    exitSession,
  }

  return (
    <ComplementRaceContext.Provider value={contextValue}>{children}</ComplementRaceContext.Provider>
  )
}
