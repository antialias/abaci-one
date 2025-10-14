export interface QuizCard {
  number: number
  svgComponent: JSX.Element
  element: HTMLElement | null
}

export interface SorobanQuizState {
  // Core game data
  cards: QuizCard[]
  quizCards: QuizCard[]
  correctAnswers: number[]

  // Game progression
  currentCardIndex: number
  displayTime: number
  selectedCount: number
  selectedDifficulty: DifficultyLevel

  // Input system state
  foundNumbers: number[]
  guessesRemaining: number
  currentInput: string
  incorrectGuesses: number

  // UI state
  gamePhase: 'setup' | 'display' | 'input' | 'results'
  prefixAcceptanceTimeout: NodeJS.Timeout | null
  finishButtonsBound: boolean
  wrongGuessAnimations: Array<{
    number: number
    id: string
    timestamp: number
  }>

  // Keyboard state (moved from InputPhase to persist across re-renders)
  hasPhysicalKeyboard: boolean | null
  testingMode: boolean
  showOnScreenKeyboard: boolean
}

export type QuizAction =
  | { type: 'SET_CARDS'; cards: QuizCard[] }
  | { type: 'SET_DISPLAY_TIME'; time: number }
  | { type: 'SET_SELECTED_COUNT'; count: number }
  | { type: 'SET_DIFFICULTY'; difficulty: DifficultyLevel }
  | { type: 'START_QUIZ'; quizCards: QuizCard[] }
  | { type: 'NEXT_CARD' }
  | { type: 'SHOW_INPUT_PHASE' }
  | { type: 'ACCEPT_NUMBER'; number: number }
  | { type: 'REJECT_NUMBER' }
  | { type: 'ADD_WRONG_GUESS_ANIMATION'; number: number }
  | { type: 'CLEAR_WRONG_GUESS_ANIMATIONS' }
  | { type: 'SET_INPUT'; input: string }
  | { type: 'SET_PREFIX_TIMEOUT'; timeout: NodeJS.Timeout | null }
  | { type: 'SHOW_RESULTS' }
  | { type: 'RESET_QUIZ' }
  | { type: 'SET_PHYSICAL_KEYBOARD'; hasKeyboard: boolean | null }
  | { type: 'SET_TESTING_MODE'; enabled: boolean }
  | { type: 'TOGGLE_ONSCREEN_KEYBOARD' }

// Difficulty levels with progressive number ranges
export const DIFFICULTY_LEVELS = {
  beginner: {
    name: 'Beginner',
    range: { min: 1, max: 9 },
    description: 'Single digits (1-9)',
  },
  easy: {
    name: 'Easy',
    range: { min: 10, max: 99 },
    description: 'Two digits (10-99)',
  },
  medium: {
    name: 'Medium',
    range: { min: 100, max: 499 },
    description: 'Three digits (100-499)',
  },
  hard: {
    name: 'Hard',
    range: { min: 500, max: 999 },
    description: 'Large numbers (500-999)',
  },
  expert: {
    name: 'Expert',
    range: { min: 1, max: 999 },
    description: 'Mixed range (1-999)',
  },
} as const

export type DifficultyLevel = keyof typeof DIFFICULTY_LEVELS
