/**
 * Complement Race Provider
 * Manages multiplayer game state using the Arcade SDK
 */

'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
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
  maxConcurrentPassengers: number

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
  claimPassenger: (passengerId: string, carIndex: number) => void
  deliverPassenger: (passengerId: string) => void
  nextQuestion: () => void
  endGame: () => void
  playAgain: () => void
  goToSetup: () => void
  setConfig: (field: keyof ComplementRaceConfig, value: unknown) => void
  clearError: () => void
  exitSession: () => void
  boostMomentum: (correct: boolean) => void // Client-side momentum boost/reduce
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
 * Apply moves immediately on client for responsive UI, server will confirm or reject
 */
function applyMoveOptimistically(state: ComplementRaceState, move: GameMove): ComplementRaceState {
  const typedMove = move as ComplementRaceMove

  switch (typedMove.type) {
    case 'CLAIM_PASSENGER': {
      // Optimistically mark passenger as claimed and assign to car
      const passengerId = typedMove.data.passengerId
      const carIndex = typedMove.data.carIndex
      const updatedPassengers = state.passengers.map((p) =>
        p.id === passengerId ? { ...p, claimedBy: typedMove.playerId, carIndex } : p
      )

      // Optimistically add to player's passenger list
      const updatedPlayers = { ...state.players }
      const player = updatedPlayers[typedMove.playerId]
      if (player) {
        updatedPlayers[typedMove.playerId] = {
          ...player,
          passengers: [...player.passengers, passengerId],
        }
      }

      return {
        ...state,
        passengers: updatedPassengers,
        players: updatedPlayers,
      }
    }

    case 'DELIVER_PASSENGER': {
      // Optimistically mark passenger as delivered and award points
      const passengerId = typedMove.data.passengerId
      const passenger = state.passengers.find((p) => p.id === passengerId)
      if (!passenger) return state

      const points = passenger.isUrgent ? 20 : 10
      const updatedPassengers = state.passengers.map((p) =>
        p.id === passengerId ? { ...p, deliveredBy: typedMove.playerId } : p
      )

      // Optimistically remove from player's passenger list and update score
      const updatedPlayers = { ...state.players }
      const player = updatedPlayers[typedMove.playerId]
      if (player) {
        updatedPlayers[typedMove.playerId] = {
          ...player,
          passengers: player.passengers.filter((id) => id !== passengerId),
          deliveredPassengers: player.deliveredPassengers + 1,
          score: player.score + points,
        }
      }

      return {
        ...state,
        passengers: updatedPassengers,
        players: updatedPlayers,
      }
    }

    default:
      // For other moves, rely on server validation
      return state
  }
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

  // Debug logging ref (track last logged values)
  const lastLogRef = useState({ key: '', count: 0 })[0]

  // Client-side game state (NOT synced to server - purely visual/gameplay)
  const [clientMomentum, setClientMomentum] = useState(10) // Start at 10 for gentle push
  const [clientPosition, setClientPosition] = useState(0)
  const [clientPressure, setClientPressure] = useState(0)
  const [clientAIRacers, setClientAIRacers] = useState<
    Array<{
      id: string
      name: string
      position: number
      speed: number
      personality: 'competitive' | 'analytical'
      icon: string
      lastComment: number
      commentCooldown: number
      previousPosition: number
    }>
  >([])
  const lastUpdateRef = useRef(Date.now())
  const gameStartTimeRef = useRef(0)

  // Decay rates based on skill level (momentum lost per second)
  const MOMENTUM_DECAY_RATES = {
    preschool: 2.0,
    kindergarten: 3.5,
    relaxed: 5.0,
    slow: 7.0,
    normal: 9.0,
    fast: 11.0,
    expert: 13.0,
  }

  const MOMENTUM_GAIN_PER_CORRECT = 15
  const MOMENTUM_LOSS_PER_WRONG = 10
  const SPEED_MULTIPLIER = 0.15 // momentum * 0.15 = % per second
  const UPDATE_INTERVAL = 50 // 50ms = ~20fps

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
      maxConcurrentPassengers: multiplayerState.config.maxConcurrentPassengers,

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
      speedMultiplier:
        multiplayerState.config.style === 'practice'
          ? 0.7
          : multiplayerState.config.style === 'sprint'
            ? 0.9
            : 1.0, // Base speed multipliers by mode
      aiRacers: clientAIRacers, // Use client-side AI state

      // Sprint mode specific (all client-side for smooth movement)
      momentum: clientMomentum, // Client-only state with continuous decay
      trainPosition: clientPosition, // Client-calculated from momentum
      pressure: clientPressure, // Client-calculated from momentum (0-150 PSI)
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
  }, [
    multiplayerState,
    localPlayerId,
    localUIState,
    clientPosition,
    clientPressure,
    clientMomentum,
    clientAIRacers,
  ])

  // Initialize game start time when game becomes active
  useEffect(() => {
    if (compatibleState.isGameActive && compatibleState.style === 'sprint') {
      if (gameStartTimeRef.current === 0) {
        gameStartTimeRef.current = Date.now()
        lastUpdateRef.current = Date.now()
        // Reset client state for new game
        setClientMomentum(10) // Start with gentle push
        setClientPosition(0)
        setClientPressure((10 / 100) * 150) // Initial pressure from starting momentum
      }
    } else {
      // Reset when game ends
      gameStartTimeRef.current = 0
    }
  }, [compatibleState.isGameActive, compatibleState.style])

  // Initialize AI racers when game starts
  useEffect(() => {
    if (compatibleState.isGameActive && multiplayerState.config.enableAI) {
      const count = multiplayerState.config.aiOpponentCount
      if (count > 0 && clientAIRacers.length === 0) {
        const aiNames = ['Swift AI', 'Math Bot', 'Speed Demon', 'Brain Bot']
        const personalities: Array<'competitive' | 'analytical'> = ['competitive', 'analytical']

        const newAI = []
        for (let i = 0; i < Math.min(count, aiNames.length); i++) {
          // Use original balanced speeds: 0.32 for Swift AI, 0.2 for Math Bot
          const baseSpeed = i === 0 ? 0.32 : 0.2
          newAI.push({
            id: `ai-${i}`,
            name: aiNames[i],
            personality: personalities[i % personalities.length] as 'competitive' | 'analytical',
            position: 0,
            speed: baseSpeed, // Balanced speed from original single-player version
            icon: personalities[i % personalities.length] === 'competitive' ? '🏃‍♂️' : '🏃',
            lastComment: 0,
            commentCooldown: 0,
            previousPosition: 0,
          })
        }
        setClientAIRacers(newAI)
      }
    } else if (!compatibleState.isGameActive) {
      // Clear AI when game ends
      setClientAIRacers([])
    }
  }, [
    compatibleState.isGameActive,
    multiplayerState.config.enableAI,
    multiplayerState.config.aiOpponentCount,
    clientAIRacers.length,
  ])

  // Main client-side game loop: momentum decay and position calculation
  useEffect(() => {
    if (!compatibleState.isGameActive || compatibleState.style !== 'sprint') return

    const interval = setInterval(() => {
      const now = Date.now()
      const deltaTime = now - lastUpdateRef.current
      lastUpdateRef.current = now

      // Get decay rate based on skill level
      const decayRate =
        MOMENTUM_DECAY_RATES[compatibleState.timeoutSetting as keyof typeof MOMENTUM_DECAY_RATES] ||
        MOMENTUM_DECAY_RATES.normal

      setClientMomentum((prevMomentum) => {
        // Calculate momentum decay for this frame
        const momentumLoss = (decayRate * deltaTime) / 1000

        // Update momentum (don't go below 0)
        const newMomentum = Math.max(0, prevMomentum - momentumLoss)

        // Calculate speed from momentum (% per second)
        const speed = newMomentum * SPEED_MULTIPLIER

        // Update position (accumulate, never go backward)
        const positionDelta = (speed * deltaTime) / 1000
        setClientPosition((prev) => prev + positionDelta)

        // Calculate pressure (0-150 PSI)
        const pressure = Math.min(150, (newMomentum / 100) * 150)
        setClientPressure(pressure)

        return newMomentum
      })
    }, UPDATE_INTERVAL)

    return () => clearInterval(interval)
  }, [
    compatibleState.isGameActive,
    compatibleState.style,
    compatibleState.timeoutSetting,
    MOMENTUM_DECAY_RATES,
    SPEED_MULTIPLIER,
    UPDATE_INTERVAL,
  ])

  // Reset client position when route changes
  useEffect(() => {
    const currentRoute = multiplayerState.currentRoute
    // When route changes, reset position and give starting momentum
    if (currentRoute > 1 && compatibleState.style === 'sprint') {
      console.log(
        `[Provider] Route changed to ${currentRoute}, resetting position. Passengers: ${multiplayerState.passengers.length}`
      )
      setClientPosition(0)
      setClientMomentum(10) // Reset to starting momentum (gentle push)
    }
  }, [multiplayerState.currentRoute, compatibleState.style, multiplayerState.passengers.length])

  // Keep lastLogRef for future debugging needs
  // (removed debug logging)

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
    (passengerId: string, carIndex: number) => {
      const currentPlayerId = activePlayers.find((id) => {
        const player = players.get(id)
        return player?.isLocal
      })

      if (!currentPlayerId) return

      sendMove({
        type: 'CLAIM_PASSENGER',
        playerId: currentPlayerId,
        userId: viewerId || '',
        data: { passengerId, carIndex },
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
          if (action.passengerId !== undefined && action.carIndex !== undefined) {
            claimPassenger(action.passengerId, action.carIndex)
          }
          break
        case 'DELIVER_PASSENGER':
          if (action.passengerId !== undefined) {
            deliverPassenger(action.passengerId)
          }
          break
        case 'START_NEW_ROUTE':
          // Send route progression to server
          if (action.routeNumber !== undefined) {
            console.log(`[Provider] Dispatching START_NEW_ROUTE for route ${action.routeNumber}`)
            sendMove({
              type: 'START_NEW_ROUTE',
              playerId: activePlayers[0] || '',
              userId: viewerId || '',
              data: { routeNumber: action.routeNumber },
            } as ComplementRaceMove)
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
        case 'UPDATE_AI_POSITIONS': {
          // Update client-side AI positions
          if (action.positions && Array.isArray(action.positions)) {
            setClientAIRacers((prevRacers) =>
              prevRacers.map((racer) => {
                const update = action.positions.find(
                  (p: { id: string; position: number }) => p.id === racer.id
                )
                return update
                  ? {
                      ...racer,
                      previousPosition: racer.position,
                      position: update.position,
                    }
                  : racer
              })
            )
          }
          break
        }
        // Other local actions that don't affect UI (can be ignored for now)
        case 'UPDATE_MOMENTUM':
        case 'UPDATE_TRAIN_POSITION':
        case 'UPDATE_STEAM_JOURNEY':
        case 'UPDATE_DIFFICULTY_TRACKER':
        case 'UPDATE_AI_SPEEDS':
        case 'GENERATE_PASSENGERS': // Passengers generated server-side when route starts
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
      sendMove,
      activePlayers,
      viewerId,
    ]
  )

  // Client-side momentum boost/reduce (sprint mode only)
  const boostMomentum = useCallback(
    (correct: boolean) => {
      if (compatibleState.style !== 'sprint') return

      setClientMomentum((prevMomentum) => {
        if (correct) {
          return Math.min(100, prevMomentum + MOMENTUM_GAIN_PER_CORRECT)
        } else {
          return Math.max(0, prevMomentum - MOMENTUM_LOSS_PER_WRONG)
        }
      })
    },
    [compatibleState.style, MOMENTUM_GAIN_PER_CORRECT, MOMENTUM_LOSS_PER_WRONG]
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
    boostMomentum, // Client-side momentum control
  }

  return (
    <ComplementRaceContext.Provider value={contextValue}>{children}</ComplementRaceContext.Provider>
  )
}
