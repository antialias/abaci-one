/**
 * Memory Quiz - Type Definitions
 *
 * This module uses Zod schemas as the single source of truth for types.
 * TypeScript types are inferred from Zod schemas using z.infer<>.
 */

import { z } from 'zod'

// ============================================================================
// Difficulty Levels (const + derived schema)
// ============================================================================

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

export const DifficultyLevelSchema = z.enum(['beginner', 'easy', 'medium', 'hard', 'expert'])
export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>

// ============================================================================
// Core Types (Zod Schemas)
// ============================================================================

export const SelectedCountSchema = z.union([
  z.literal(2),
  z.literal(5),
  z.literal(8),
  z.literal(12),
  z.literal(15),
])
export type SelectedCount = z.infer<typeof SelectedCountSchema>

export const PlayModeSchema = z.enum(['cooperative', 'competitive'])
export type PlayMode = z.infer<typeof PlayModeSchema>

export const GamePhaseSchema = z.enum(['setup', 'display', 'input', 'results'])
export type GamePhase = z.infer<typeof GamePhaseSchema>

// ============================================================================
// Game Entities (Zod Schemas)
// ============================================================================

export const QuizCardSchema = z
  .object({
    number: z.number(),
    // svgComponent and element are runtime-only, not serialized but allowed via passthrough
  })
  .passthrough()

export type QuizCard = {
  number: number
  svgComponent: JSX.Element | null // Runtime only
  element: HTMLElement | null // Runtime only
}

export const PlayerScoreSchema = z.object({
  correct: z.number(),
  incorrect: z.number(),
})
export type PlayerScore = z.infer<typeof PlayerScoreSchema>

export const PlayerMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  userId: z.string(),
  color: z.string().optional(),
})
export type PlayerMetadata = z.infer<typeof PlayerMetadataSchema>

export const WrongGuessAnimationSchema = z.object({
  number: z.number(),
  id: z.string(),
  timestamp: z.number(),
})
export type WrongGuessAnimation = z.infer<typeof WrongGuessAnimationSchema>

// ============================================================================
// Game Configuration (Zod Schema)
// ============================================================================

export const MemoryQuizConfigSchema = z.object({
  selectedCount: SelectedCountSchema,
  displayTime: z.number(),
  selectedDifficulty: DifficultyLevelSchema,
  playMode: PlayModeSchema,
})
export type MemoryQuizConfig = z.infer<typeof MemoryQuizConfigSchema>

// ============================================================================
// Game State (Zod Schema)
// ============================================================================

export const MemoryQuizStateSchema = z.object({
  // Core game data
  cards: z.array(QuizCardSchema),
  quizCards: z.array(QuizCardSchema),
  correctAnswers: z.array(z.number()),

  // Game progression
  currentCardIndex: z.number(),
  displayTime: z.number(),
  selectedCount: z.number(),
  selectedDifficulty: DifficultyLevelSchema,

  // Input system state
  foundNumbers: z.array(z.number()),
  guessesRemaining: z.number(),
  currentInput: z.string(),
  incorrectGuesses: z.number(),

  // Multiplayer state
  activePlayers: z.array(z.string()),
  playerMetadata: z.record(z.string(), PlayerMetadataSchema),
  playerScores: z.record(z.string(), PlayerScoreSchema),
  playMode: PlayModeSchema,
  numberFoundBy: z.record(z.string(), z.string()), // Maps number (as string key) to userId who found it

  // UI state
  gamePhase: GamePhaseSchema,
  finishButtonsBound: z.boolean(),
  wrongGuessAnimations: z.array(WrongGuessAnimationSchema),

  // Timing
  gameStartTime: z.number().nullable(),

  // Keyboard state
  hasPhysicalKeyboard: z.boolean().nullable(),
  testingMode: z.boolean(),
  showOnScreenKeyboard: z.boolean(),

  // Runtime-only (will be null in serialized state, managed by components)
  prefixAcceptanceTimeout: z.any().optional(),
})

/**
 * Core game state type
 * Includes both serializable fields and runtime-only fields for component use
 */
export type MemoryQuizState = Omit<
  z.infer<typeof MemoryQuizStateSchema>,
  'cards' | 'quizCards' | 'prefixAcceptanceTimeout'
> & {
  cards: QuizCard[]
  quizCards: QuizCard[]
  prefixAcceptanceTimeout: NodeJS.Timeout | null
}

// ============================================================================
// Legacy Reducer Actions (deprecated - will be removed)
// ============================================================================

export type QuizAction =
  | { type: 'SET_CARDS'; cards: QuizCard[] }
  | { type: 'SET_DISPLAY_TIME'; time: number }
  | { type: 'SET_SELECTED_COUNT'; count: number }
  | { type: 'SET_DIFFICULTY'; difficulty: DifficultyLevel }
  | { type: 'SET_PLAY_MODE'; playMode: 'cooperative' | 'competitive' }
  | { type: 'START_QUIZ'; quizCards: QuizCard[] }
  | { type: 'NEXT_CARD' }
  | { type: 'SHOW_INPUT_PHASE' }
  | { type: 'ACCEPT_NUMBER'; number: number; playerId?: string }
  | { type: 'REJECT_NUMBER'; playerId?: string }
  | { type: 'ADD_WRONG_GUESS_ANIMATION'; number: number }
  | { type: 'CLEAR_WRONG_GUESS_ANIMATIONS' }
  | { type: 'SET_INPUT'; input: string }
  | { type: 'SET_PREFIX_TIMEOUT'; timeout: NodeJS.Timeout | null }
  | { type: 'SHOW_RESULTS' }
  | { type: 'RESET_QUIZ' }
  | { type: 'SET_PHYSICAL_KEYBOARD'; hasKeyboard: boolean | null }
  | { type: 'SET_TESTING_MODE'; enabled: boolean }
  | { type: 'TOGGLE_ONSCREEN_KEYBOARD' }

// ============================================================================
// Game Moves (TypeScript union - could be Zod later if needed)
// ============================================================================

export type MemoryQuizMove =
  | {
      type: 'START_QUIZ'
      playerId: string
      userId: string
      timestamp: number
      data: {
        numbers: number[]
        quizCards?: QuizCard[]
        activePlayers: string[]
        playerMetadata: Record<string, PlayerMetadata>
      }
    }
  | {
      type: 'NEXT_CARD'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'SHOW_INPUT_PHASE'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'ACCEPT_NUMBER'
      playerId: string
      userId: string
      timestamp: number
      data: { number: number }
    }
  | {
      type: 'REJECT_NUMBER'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'SET_INPUT'
      playerId: string
      userId: string
      timestamp: number
      data: { input: string }
    }
  | {
      type: 'SHOW_RESULTS'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'RESET_QUIZ'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'SET_CONFIG'
      playerId: string
      userId: string
      timestamp: number
      data: {
        field: 'selectedCount' | 'displayTime' | 'selectedDifficulty' | 'playMode'
        value: any
      }
    }

export type MemoryQuizSetConfigMove = Extract<MemoryQuizMove, { type: 'SET_CONFIG' }>
