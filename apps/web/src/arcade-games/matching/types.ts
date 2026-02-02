/**
 * Matching Pairs Battle - Type Definitions
 *
 * This module uses Zod schemas as the single source of truth for types.
 * TypeScript types are inferred from Zod schemas using z.infer<>.
 */

import { z } from 'zod'

// ============================================================================
// Core Types (Zod Schemas)
// ============================================================================

export const GameModeSchema = z.enum(['single', 'multiplayer'])
export type GameMode = z.infer<typeof GameModeSchema>

export const GameTypeSchema = z.enum(['abacus-numeral', 'complement-pairs'])
export type GameType = z.infer<typeof GameTypeSchema>

export const GamePhaseSchema = z.enum(['setup', 'playing', 'results'])
export type GamePhase = z.infer<typeof GamePhaseSchema>

export const CardTypeSchema = z.enum(['abacus', 'number', 'complement'])
export type CardType = z.infer<typeof CardTypeSchema>

export const DifficultySchema = z.union([z.literal(6), z.literal(8), z.literal(12), z.literal(15)])
export type Difficulty = z.infer<typeof DifficultySchema>

export const TargetSumSchema = z.union([z.literal(5), z.literal(10), z.literal(20)])
export type TargetSum = z.infer<typeof TargetSumSchema>

// Player is just a string (Player ID / UUID)
export type Player = string

// ============================================================================
// Game Configuration (Zod Schema)
// ============================================================================

export const MatchingConfigSchema = z.object({
  gameType: GameTypeSchema,
  difficulty: DifficultySchema,
  turnTimer: z.number(),
  /**
   * Skip the setup phase and start directly in playing phase.
   * When true, getInitialState() will generate cards immediately
   * and set gamePhase to 'playing' instead of 'setup'.
   */
  skipSetupPhase: z.boolean().optional(),
})
export type MatchingConfig = z.infer<typeof MatchingConfigSchema>

// ============================================================================
// Game Entities (Zod Schemas)
// ============================================================================

export const GameCardSchema = z.object({
  id: z.string(),
  type: CardTypeSchema,
  number: z.number(),
  complement: z.number().optional(),
  targetSum: TargetSumSchema.optional(),
  matched: z.boolean(),
  matchedBy: z.string().optional(), // Player ID for two-player mode
  // element is runtime-only (HTMLElement), not serialized
})
export type GameCard = z.infer<typeof GameCardSchema> & {
  element?: HTMLElement | null // For animations (runtime only)
}

export const PlayerMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  userId: z.string(),
  color: z.string().optional(),
})
export type PlayerMetadata = z.infer<typeof PlayerMetadataSchema>

export const PlayerScoreSchema = z.record(z.string(), z.number())
export type PlayerScore = z.infer<typeof PlayerScoreSchema>

export const CelebrationAnimationSchema = z.object({
  id: z.string(),
  type: z.enum(['match', 'win', 'confetti']),
  x: z.number(),
  y: z.number(),
  timestamp: z.number(),
})
export type CelebrationAnimation = z.infer<typeof CelebrationAnimationSchema>

export const GameStatisticsSchema = z.object({
  totalMoves: z.number(),
  matchedPairs: z.number(),
  totalPairs: z.number(),
  gameTime: z.number(),
  accuracy: z.number(),
  averageTimePerMove: z.number(),
})
export type GameStatistics = z.infer<typeof GameStatisticsSchema>

// ============================================================================
// Original Config (for pause/resume)
// ============================================================================

export const OriginalConfigSchema = z.object({
  gameType: GameTypeSchema,
  difficulty: DifficultySchema,
  turnTimer: z.number(),
})
export type OriginalConfig = z.infer<typeof OriginalConfigSchema>

// ============================================================================
// Paused Game State (for pause/resume)
// ============================================================================

export const PausedGameStateSchema = z.object({
  gameCards: z.array(GameCardSchema),
  currentPlayer: z.string(),
  matchedPairs: z.number(),
  moves: z.number(),
  scores: PlayerScoreSchema,
  activePlayers: z.array(z.string()),
  playerMetadata: z.record(z.string(), PlayerMetadataSchema),
  consecutiveMatches: z.record(z.string(), z.number()),
  gameStartTime: z.number().nullable(),
})
export type PausedGameState = z.infer<typeof PausedGameStateSchema>

// ============================================================================
// Game State (Zod Schema)
// ============================================================================

export const MatchingStateSchema = z.object({
  // Core game data
  cards: z.array(GameCardSchema),
  gameCards: z.array(GameCardSchema),
  flippedCards: z.array(GameCardSchema),

  // Game configuration
  gameType: GameTypeSchema,
  difficulty: DifficultySchema,
  turnTimer: z.number(),

  // Game progression
  gamePhase: GamePhaseSchema,
  currentPlayer: z.string(),
  matchedPairs: z.number(),
  totalPairs: z.number(),
  moves: z.number(),
  scores: PlayerScoreSchema,
  activePlayers: z.array(z.string()),
  playerMetadata: z.record(z.string(), PlayerMetadataSchema),
  consecutiveMatches: z.record(z.string(), z.number()),

  // Timing
  gameStartTime: z.number().nullable(),
  gameEndTime: z.number().nullable(),
  currentMoveStartTime: z.number().nullable(),
  // timerInterval is runtime-only (NodeJS.Timeout), not serialized

  // UI state
  celebrationAnimations: z.array(CelebrationAnimationSchema),
  isProcessingMove: z.boolean(),
  showMismatchFeedback: z.boolean(),
  lastMatchedPair: z.tuple([z.string(), z.string()]).nullable(),

  // PAUSE/RESUME: Paused game state
  originalConfig: OriginalConfigSchema.optional(),
  pausedGamePhase: GamePhaseSchema.optional(),
  pausedGameState: PausedGameStateSchema.optional(),

  // HOVER: Networked hover state
  playerHovers: z.record(z.string(), z.string().nullable()),
})

/**
 * Core game state type - inferred from Zod schema
 * This is what gets serialized/synchronized
 */
export type MatchingState = z.infer<typeof MatchingStateSchema>

/**
 * Extended state with runtime-only properties
 * Used in React components that need timer functionality
 */
export type MatchingStateWithTimer = MatchingState & {
  timerInterval: NodeJS.Timeout | null
}

// For backwards compatibility with existing code
export type MemoryPairsState = MatchingState

// ============================================================================
// Context Value (TypeScript only - not serialized)
// ============================================================================

/**
 * Context value for the matching game provider
 * Exposes state and action creators to components
 */
export interface MatchingContextValue {
  state: MatchingState & { gameMode: GameMode }
  dispatch: React.Dispatch<any> // Deprecated - use action creators instead

  // Computed values
  isGameActive: boolean
  canFlipCard: (cardId: string) => boolean
  currentGameStatistics: GameStatistics
  gameMode: GameMode
  activePlayers: Player[]

  // Pause/Resume
  hasConfigChanged: boolean
  canResumeGame: boolean

  // Actions
  startGame: () => void
  flipCard: (cardId: string) => void
  resetGame: () => void
  setGameType: (type: GameType) => void
  setDifficulty: (difficulty: Difficulty) => void
  setTurnTimer: (timer: number) => void
  goToSetup: () => void
  resumeGame: () => void
  hoverCard: (cardId: string | null) => void
  exitSession: () => void
}

// ============================================================================
// Game Moves (TypeScript union - could be Zod later if needed)
// ============================================================================

/**
 * All possible moves in the matching game
 * These match the move types validated by MatchingGameValidator
 */
export type MatchingMove =
  | {
      type: 'FLIP_CARD'
      playerId: string
      userId: string
      timestamp: number
      data: {
        cardId: string
      }
    }
  | {
      type: 'START_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: {
        cards: GameCard[]
        activePlayers: string[]
        playerMetadata: Record<string, PlayerMetadata>
      }
    }
  | {
      type: 'CLEAR_MISMATCH'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'GO_TO_SETUP'
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
        field: 'gameType' | 'difficulty' | 'turnTimer'
        value: any
      }
    }
  | {
      type: 'RESUME_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'HOVER_CARD'
      playerId: string
      userId: string
      timestamp: number
      data: {
        cardId: string | null
      }
    }

// ============================================================================
// Component Props (TypeScript only - not serialized)
// ============================================================================

export interface GameCardProps {
  card: GameCard
  isFlipped: boolean
  isMatched: boolean
  onClick: () => void
  disabled?: boolean
}

export interface PlayerIndicatorProps {
  player: Player
  isActive: boolean
  score: number
  name?: string
}

export interface GameGridProps {
  cards: GameCard[]
  onCardClick: (cardId: string) => void
  disabled?: boolean
}

// ============================================================================
// Validation (TypeScript only)
// ============================================================================

export interface MatchValidationResult {
  isValid: boolean
  reason?: string
  type: 'abacus-numeral' | 'complement' | 'invalid'
}
