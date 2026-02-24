/**
 * Type Racer Jr. - Type Definitions
 *
 * Zod schemas as single source of truth. TypeScript types inferred via z.infer<>.
 */

import { z } from 'zod'

// ============================================================================
// Enums & Constants
// ============================================================================

export const GameModeSchema = z.enum(['free-play', 'beat-the-clock'])
export type GameMode = z.infer<typeof GameModeSchema>

export const DifficultyLevelSchema = z.enum(['level1', 'level2', 'level3'])
export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>

export const GamePhaseSchema = z.enum(['setup', 'playing', 'results'])
export type GamePhase = z.infer<typeof GamePhaseSchema>

export const KeyboardLayoutSchema = z.enum(['qwerty', 'dvorak', 'abc'])
export type KeyboardLayout = z.infer<typeof KeyboardLayoutSchema>

export const TimeLimitSchema = z.union([z.literal(60), z.literal(90), z.literal(120), z.null()])
export type TimeLimit = z.infer<typeof TimeLimitSchema>

// ============================================================================
// Game Entities
// ============================================================================

export const WordEntrySchema = z.object({
  word: z.string(),
  emoji: z.string(),
})
export type WordEntry = z.infer<typeof WordEntrySchema>

export const CompletedWordSchema = z.object({
  word: z.string(),
  emoji: z.string(),
  stars: z.number(),
  mistakeCount: z.number(),
  durationMs: z.number(),
})
export type CompletedWord = z.infer<typeof CompletedWordSchema>

export const PlayerMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  userId: z.string(),
})
export type PlayerMetadata = z.infer<typeof PlayerMetadataSchema>

// ============================================================================
// Game Configuration
// ============================================================================

export const TypeRacerJrConfigSchema = z.object({
  gameMode: GameModeSchema,
  timeLimit: TimeLimitSchema,
  startingDifficulty: DifficultyLevelSchema,
  wordCount: z.number().nullable(),
  keyboardLayout: KeyboardLayoutSchema,
  showVirtualKeyboard: z.boolean(),
})
export type TypeRacerJrConfig = z.infer<typeof TypeRacerJrConfigSchema>

// ============================================================================
// Game State
// ============================================================================

export const TypeRacerJrStateSchema = z.object({
  // Core
  gamePhase: GamePhaseSchema,
  gameMode: GameModeSchema,
  timeLimit: TimeLimitSchema,
  wordCount: z.number().nullable(),

  // Keyboard
  keyboardLayout: KeyboardLayoutSchema,
  showVirtualKeyboard: z.boolean(),

  // Difficulty
  currentDifficulty: DifficultyLevelSchema,
  consecutiveCleanWords: z.number(),

  // Word queue
  wordQueue: z.array(WordEntrySchema),
  currentWordIndex: z.number(),
  completedWords: z.array(CompletedWordSchema),
  usedWords: z.array(z.string()),

  // Scoring
  totalStars: z.number(),
  bestStreak: z.number(),

  // Timing
  gameStartTime: z.number().nullable(),
  currentWordStartTime: z.number().nullable(),

  // Player
  playerId: z.string(),
  playerMetadata: z.record(z.string(), PlayerMetadataSchema),

  // End game reason
  endReason: z.enum(['timer-expired', 'all-words-done', 'player-quit']).nullable(),
})

export type TypeRacerJrState = z.infer<typeof TypeRacerJrStateSchema>

// ============================================================================
// Game Moves
// ============================================================================

export type TypeRacerJrMove =
  | {
      type: 'START_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: {
        wordQueue: WordEntry[]
        playerMetadata: Record<string, PlayerMetadata>
      }
    }
  | {
      type: 'COMPLETE_WORD'
      playerId: string
      userId: string
      timestamp: number
      data: {
        word: string
        stars: number
        mistakeCount: number
        durationMs: number
      }
    }
  | {
      type: 'ADVANCE_DIFFICULTY'
      playerId: string
      userId: string
      timestamp: number
      data: {
        newDifficulty: DifficultyLevel
        newWords: WordEntry[]
      }
    }
  | {
      type: 'END_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: {
        reason: 'timer-expired' | 'all-words-done' | 'player-quit'
      }
    }
  | {
      type: 'SET_CONFIG'
      playerId: string
      userId: string
      timestamp: number
      data: {
        field:
          | 'gameMode'
          | 'timeLimit'
          | 'startingDifficulty'
          | 'wordCount'
          | 'keyboardLayout'
          | 'showVirtualKeyboard'
        value: unknown
      }
    }
  | {
      type: 'RESET_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
