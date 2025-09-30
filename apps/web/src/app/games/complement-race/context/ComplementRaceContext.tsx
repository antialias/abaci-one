'use client'

import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import type { GameState, GameAction, AIRacer, DifficultyTracker, Station, Passenger } from '../lib/gameTypes'

const initialDifficultyTracker: DifficultyTracker = {
  pairPerformance: new Map(),
  baseTimeLimit: 3000,
  currentTimeLimit: 3000,
  difficultyLevel: 1,
  consecutiveCorrect: 0,
  consecutiveIncorrect: 0,
  learningMode: true,
  adaptationRate: 0.1
}

const initialAIRacers: AIRacer[] = [
  {
    id: 'ai-racer-1',
    position: 0,
    speed: 0.32,  // Balanced speed for good challenge
    name: 'Swift AI',
    personality: 'competitive',
    icon: '🏃‍♂️',
    lastComment: 0,
    commentCooldown: 0,
    previousPosition: 0
  },
  {
    id: 'ai-racer-2',
    position: 0,
    speed: 0.20,  // Balanced speed for good challenge
    name: 'Math Bot',
    personality: 'analytical',
    icon: '🏃',
    lastComment: 0,
    commentCooldown: 0,
    previousPosition: 0
  }
]

const initialStations: Station[] = [
  { id: 'station-0', name: 'Depot', position: 0, icon: '🏭' },
  { id: 'station-1', name: 'Riverside', position: 20, icon: '🌊' },
  { id: 'station-2', name: 'Hillside', position: 40, icon: '⛰️' },
  { id: 'station-3', name: 'Canyon View', position: 60, icon: '🏜️' },
  { id: 'station-4', name: 'Meadows', position: 80, icon: '🌾' },
  { id: 'station-5', name: 'Grand Central', position: 100, icon: '🏛️' }
]

const initialState: GameState = {
  // Game configuration
  mode: 'friends5',
  style: 'practice',
  timeoutSetting: 'normal',

  // Current question
  currentQuestion: null,
  previousQuestion: null,

  // Game progress
  score: 0,
  streak: 0,
  bestStreak: 0,
  totalQuestions: 0,
  correctAnswers: 0,

  // Game status
  isGameActive: false,
  isPaused: false,
  gamePhase: 'intro',

  // Timing
  gameStartTime: null,
  questionStartTime: Date.now(),

  // Race mechanics
  raceGoal: 20,
  timeLimit: null,
  speedMultiplier: 1.0,
  aiRacers: initialAIRacers,

  // Adaptive difficulty
  difficultyTracker: initialDifficultyTracker,

  // Survival mode specific
  playerLap: 0,
  aiLaps: new Map(),
  survivalMultiplier: 1.0,

  // Sprint mode specific
  momentum: 0,
  trainPosition: 0,
  pressure: 0,
  elapsedTime: 0,
  lastCorrectAnswerTime: Date.now(),
  currentRoute: 1,
  stations: initialStations,
  passengers: [],
  deliveredPassengers: 0,
  cumulativeDistance: 0,
  showRouteCelebration: false,

  // Input
  currentInput: '',

  // UI state
  showScoreModal: false,
  activeSpeechBubbles: new Map(),
  adaptiveFeedback: null
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode }

    case 'SET_STYLE':
      return { ...state, style: action.style }

    case 'SET_TIMEOUT':
      return { ...state, timeoutSetting: action.timeout }

    case 'SHOW_CONTROLS':
      return { ...state, gamePhase: 'controls' }

    case 'START_COUNTDOWN':
      return { ...state, gamePhase: 'countdown' }

    case 'BEGIN_GAME':
      // Generate first question when game starts
      const generateFirstQuestion = () => {
        let targetSum: number
        if (state.mode === 'friends5') {
          targetSum = 5
        } else if (state.mode === 'friends10') {
          targetSum = 10
        } else {
          targetSum = Math.random() > 0.5 ? 5 : 10
        }

        const newNumber = targetSum === 5
          ? Math.floor(Math.random() * 5)
          : Math.floor(Math.random() * 10)

        return {
          number: newNumber,
          targetSum,
          correctAnswer: targetSum - newNumber
        }
      }

      return {
        ...state,
        gamePhase: 'playing',
        isGameActive: true,
        gameStartTime: Date.now(),
        questionStartTime: Date.now(),
        currentQuestion: generateFirstQuestion()
      }

    case 'NEXT_QUESTION':
      // Generate new question based on mode
      const generateQuestion = () => {
        let targetSum: number
        if (state.mode === 'friends5') {
          targetSum = 5
        } else if (state.mode === 'friends10') {
          targetSum = 10
        } else {
          targetSum = Math.random() > 0.5 ? 5 : 10
        }

        let newNumber: number
        let attempts = 0

        do {
          if (targetSum === 5) {
            newNumber = Math.floor(Math.random() * 5)
          } else {
            newNumber = Math.floor(Math.random() * 10)
          }
          attempts++
        } while (
          state.currentQuestion &&
          state.currentQuestion.number === newNumber &&
          state.currentQuestion.targetSum === targetSum &&
          attempts < 10
        )

        return {
          number: newNumber,
          targetSum,
          correctAnswer: targetSum - newNumber
        }
      }

      return {
        ...state,
        previousQuestion: state.currentQuestion,
        currentQuestion: generateQuestion(),
        questionStartTime: Date.now(),
        currentInput: ''
      }

    case 'UPDATE_INPUT':
      return { ...state, currentInput: action.input }

    case 'SUBMIT_ANSWER':
      if (!state.currentQuestion) return state

      const isCorrect = action.answer === state.currentQuestion.correctAnswer
      const responseTime = Date.now() - state.questionStartTime

      if (isCorrect) {
        // Calculate speed bonus: max(0, 300 - (avgTime * 10))
        const speedBonus = Math.max(0, 300 - (responseTime / 100))

        // Update score: correctAnswers * 100 + streak * 50 + speedBonus
        const newStreak = state.streak + 1
        const newCorrectAnswers = state.correctAnswers + 1
        const newScore = state.score + 100 + (newStreak * 50) + speedBonus

        return {
          ...state,
          correctAnswers: newCorrectAnswers,
          streak: newStreak,
          bestStreak: Math.max(state.bestStreak, newStreak),
          score: Math.round(newScore),
          totalQuestions: state.totalQuestions + 1
        }
      } else {
        // Incorrect answer - reset streak but keep score
        return {
          ...state,
          streak: 0,
          totalQuestions: state.totalQuestions + 1
        }
      }

    case 'UPDATE_AI_POSITIONS':
      return {
        ...state,
        aiRacers: state.aiRacers.map(racer => {
          const update = action.positions.find(p => p.id === racer.id)
          return update
            ? { ...racer, previousPosition: racer.position, position: update.position }
            : racer
        })
      }

    case 'UPDATE_MOMENTUM':
      return { ...state, momentum: action.momentum }

    case 'UPDATE_TRAIN_POSITION':
      return { ...state, trainPosition: action.position }

    case 'UPDATE_STEAM_JOURNEY':
      return {
        ...state,
        momentum: action.momentum,
        trainPosition: action.trainPosition,
        pressure: action.pressure,
        elapsedTime: action.elapsedTime
      }

    case 'COMPLETE_LAP':
      if (action.racerId === 'player') {
        return { ...state, playerLap: state.playerLap + 1 }
      } else {
        const newAILaps = new Map(state.aiLaps)
        newAILaps.set(action.racerId, (newAILaps.get(action.racerId) || 0) + 1)
        return { ...state, aiLaps: newAILaps }
      }

    case 'PAUSE_RACE':
      return { ...state, isPaused: true }

    case 'RESUME_RACE':
      return { ...state, isPaused: false }

    case 'END_RACE':
      return { ...state, isGameActive: false }

    case 'SHOW_RESULTS':
      return { ...state, gamePhase: 'results', showScoreModal: true }

    case 'RESET_GAME':
      return {
        ...initialState,
        // Preserve configuration settings
        mode: state.mode,
        style: state.style,
        timeoutSetting: state.timeoutSetting,
        gamePhase: 'intro'
      }

    case 'TRIGGER_AI_COMMENTARY':
      const newBubbles = new Map(state.activeSpeechBubbles)
      newBubbles.set(action.racerId, action.message)
      return {
        ...state,
        activeSpeechBubbles: newBubbles,
        // Update racer's lastComment time and cooldown
        aiRacers: state.aiRacers.map(racer =>
          racer.id === action.racerId
            ? {
                ...racer,
                lastComment: Date.now(),
                commentCooldown: Math.random() * 4000 + 2000  // 2-6 seconds
              }
            : racer
        )
      }

    case 'CLEAR_AI_COMMENT':
      const clearedBubbles = new Map(state.activeSpeechBubbles)
      clearedBubbles.delete(action.racerId)
      return {
        ...state,
        activeSpeechBubbles: clearedBubbles
      }

    case 'UPDATE_DIFFICULTY_TRACKER':
      return {
        ...state,
        difficultyTracker: action.tracker
      }

    case 'UPDATE_AI_SPEEDS':
      return {
        ...state,
        aiRacers: action.racers
      }

    case 'SHOW_ADAPTIVE_FEEDBACK':
      return {
        ...state,
        adaptiveFeedback: action.feedback
      }

    case 'CLEAR_ADAPTIVE_FEEDBACK':
      return {
        ...state,
        adaptiveFeedback: null
      }

    case 'GENERATE_PASSENGERS':
      return {
        ...state,
        passengers: action.passengers
      }

    case 'BOARD_PASSENGER':
      return {
        ...state,
        passengers: state.passengers.map(p =>
          p.id === action.passengerId ? { ...p, isBoarded: true } : p
        )
      }

    case 'DELIVER_PASSENGER':
      return {
        ...state,
        passengers: state.passengers.map(p =>
          p.id === action.passengerId ? { ...p, isDelivered: true } : p
        ),
        deliveredPassengers: state.deliveredPassengers + 1,
        score: state.score + action.points
      }

    case 'START_NEW_ROUTE':
      return {
        ...state,
        currentRoute: action.routeNumber,
        stations: action.stations,
        trainPosition: 0,
        deliveredPassengers: 0,
        showRouteCelebration: false
      }

    case 'COMPLETE_ROUTE':
      return {
        ...state,
        cumulativeDistance: state.cumulativeDistance + 100,
        showRouteCelebration: true
      }

    case 'HIDE_ROUTE_CELEBRATION':
      return {
        ...state,
        showRouteCelebration: false
      }

    default:
      return state
  }
}

interface ComplementRaceContextType {
  state: GameState
  dispatch: React.Dispatch<GameAction>
}

const ComplementRaceContext = createContext<ComplementRaceContextType | undefined>(undefined)

interface ComplementRaceProviderProps {
  children: ReactNode
  initialStyle?: 'practice' | 'sprint' | 'survival'
}

export function ComplementRaceProvider({ children, initialStyle }: ComplementRaceProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, {
    ...initialState,
    style: initialStyle || initialState.style
  })

  return (
    <ComplementRaceContext.Provider value={{ state, dispatch }}>
      {children}
    </ComplementRaceContext.Provider>
  )
}

export function useComplementRace() {
  const context = useContext(ComplementRaceContext)
  if (context === undefined) {
    throw new Error('useComplementRace must be used within ComplementRaceProvider')
  }
  return context
}