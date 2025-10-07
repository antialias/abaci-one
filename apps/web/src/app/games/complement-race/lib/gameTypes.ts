export type GameMode = 'friends5' | 'friends10' | 'mixed'
export type GameStyle = 'practice' | 'sprint' | 'survival'
export type TimeoutSetting =
  | 'preschool'
  | 'kindergarten'
  | 'relaxed'
  | 'slow'
  | 'normal'
  | 'fast'
  | 'expert'
export type ComplementDisplay = 'number' | 'abacus' | 'random' // How to display the complement number

export interface ComplementQuestion {
  number: number
  targetSum: number
  correctAnswer: number
  showAsAbacus: boolean // For random mode, this is decided once per question
}

export interface AIRacer {
  id: string
  position: number
  speed: number
  name: string
  personality: 'competitive' | 'analytical'
  icon: string
  lastComment: number
  commentCooldown: number
  previousPosition: number
}

export interface DifficultyTracker {
  pairPerformance: Map<string, PairPerformance>
  baseTimeLimit: number
  currentTimeLimit: number
  difficultyLevel: number
  consecutiveCorrect: number
  consecutiveIncorrect: number
  learningMode: boolean
  adaptationRate: number
}

export interface PairPerformance {
  attempts: number
  correct: number
  avgTime: number
  difficulty: number
}

export interface Station {
  id: string
  name: string
  position: number // 0-100% along track
  icon: string
}

export interface Passenger {
  id: string
  name: string
  avatar: string
  originStationId: string
  destinationStationId: string
  isUrgent: boolean
  isBoarded: boolean
  isDelivered: boolean
}

export interface GameState {
  // Game configuration
  mode: GameMode
  style: GameStyle
  timeoutSetting: TimeoutSetting
  complementDisplay: ComplementDisplay // How to display the complement number

  // Current question
  currentQuestion: ComplementQuestion | null
  previousQuestion: ComplementQuestion | null

  // Game progress
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

  // Race mechanics
  raceGoal: number
  timeLimit: number | null
  speedMultiplier: number
  aiRacers: AIRacer[]

  // Adaptive difficulty
  difficultyTracker: DifficultyTracker

  // Survival mode specific
  playerLap: number
  aiLaps: Map<string, number>
  survivalMultiplier: number

  // Sprint mode specific
  momentum: number
  trainPosition: number
  pressure: number // 0-150 PSI
  elapsedTime: number // milliseconds elapsed in 60-second journey
  lastCorrectAnswerTime: number
  currentRoute: number
  stations: Station[]
  passengers: Passenger[]
  deliveredPassengers: number
  cumulativeDistance: number // Total distance across all routes
  showRouteCelebration: boolean

  // Input
  currentInput: string

  // UI state
  showScoreModal: boolean
  activeSpeechBubbles: Map<string, string> // racerId -> message
  adaptiveFeedback: { message: string; type: string } | null
}

export type GameAction =
  | { type: 'SET_MODE'; mode: GameMode }
  | { type: 'SET_STYLE'; style: GameStyle }
  | { type: 'SET_TIMEOUT'; timeout: TimeoutSetting }
  | { type: 'SET_COMPLEMENT_DISPLAY'; display: ComplementDisplay }
  | { type: 'SHOW_CONTROLS' }
  | { type: 'START_COUNTDOWN' }
  | { type: 'BEGIN_GAME' }
  | { type: 'NEXT_QUESTION' }
  | { type: 'SUBMIT_ANSWER'; answer: number }
  | { type: 'UPDATE_INPUT'; input: string }
  | { type: 'UPDATE_AI_POSITIONS'; positions: Array<{ id: string; position: number }> }
  | { type: 'TRIGGER_AI_COMMENTARY'; racerId: string; message: string; context: string }
  | { type: 'CLEAR_AI_COMMENT'; racerId: string }
  | { type: 'UPDATE_DIFFICULTY_TRACKER'; tracker: DifficultyTracker }
  | { type: 'UPDATE_AI_SPEEDS'; racers: AIRacer[] }
  | { type: 'SHOW_ADAPTIVE_FEEDBACK'; feedback: { message: string; type: string } }
  | { type: 'CLEAR_ADAPTIVE_FEEDBACK' }
  | { type: 'UPDATE_MOMENTUM'; momentum: number }
  | { type: 'UPDATE_TRAIN_POSITION'; position: number }
  | {
      type: 'UPDATE_STEAM_JOURNEY'
      momentum: number
      trainPosition: number
      pressure: number
      elapsedTime: number
    }
  | { type: 'COMPLETE_LAP'; racerId: string }
  | { type: 'PAUSE_RACE' }
  | { type: 'RESUME_RACE' }
  | { type: 'END_RACE' }
  | { type: 'SHOW_RESULTS' }
  | { type: 'RESET_GAME' }
  | { type: 'GENERATE_PASSENGERS'; passengers: Passenger[] }
  | { type: 'BOARD_PASSENGER'; passengerId: string }
  | { type: 'DELIVER_PASSENGER'; passengerId: string; points: number }
  | { type: 'START_NEW_ROUTE'; routeNumber: number; stations: Station[] }
  | { type: 'COMPLETE_ROUTE' }
  | { type: 'HIDE_ROUTE_CELEBRATION' }
