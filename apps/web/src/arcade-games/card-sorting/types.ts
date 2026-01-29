/**
 * Card Sorting Game - Type Definitions
 *
 * This module uses Zod schemas as the single source of truth for types.
 * TypeScript types are inferred from Zod schemas using z.infer<>.
 */

import { z } from 'zod'

// ============================================================================
// Player Metadata
// ============================================================================

export const PlayerMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  userId: z.string(),
})
export type PlayerMetadata = z.infer<typeof PlayerMetadataSchema>

// ============================================================================
// Configuration
// ============================================================================

export const GameModeSchema = z.enum(['solo', 'collaborative', 'competitive', 'relay'])
export type GameMode = z.infer<typeof GameModeSchema>

export const CardCountSchema = z.union([
  z.literal(5),
  z.literal(8),
  z.literal(12),
  z.literal(15),
])
export type CardCount = z.infer<typeof CardCountSchema>

export const CardSortingConfigSchema = z.object({
  cardCount: CardCountSchema,
  timeLimit: z.number().nullable(),
  gameMode: GameModeSchema,
})
export type CardSortingConfig = z.infer<typeof CardSortingConfigSchema>

// ============================================================================
// Core Data Types
// ============================================================================

export const GamePhaseSchema = z.enum(['setup', 'playing', 'results'])
export type GamePhase = z.infer<typeof GamePhaseSchema>

export const SortingCardSchema = z.object({
  id: z.string(),
  number: z.number(),
  svgContent: z.string(),
})
export type SortingCard = z.infer<typeof SortingCardSchema>

export const CardPositionSchema = z.object({
  cardId: z.string(),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  zIndex: z.number(),
  draggedByPlayerId: z.string().optional(),
  draggedByWindowId: z.string().optional(),
})
export type CardPosition = z.infer<typeof CardPositionSchema>

export const PlacedCardSchema = z.object({
  card: SortingCardSchema,
  position: z.number(),
})
export type PlacedCard = z.infer<typeof PlacedCardSchema>

export const ScoreBreakdownSchema = z.object({
  finalScore: z.number(),
  exactMatches: z.number(),
  lcsLength: z.number(),
  inversions: z.number(),
  relativeOrderScore: z.number(),
  exactPositionScore: z.number(),
  inversionScore: z.number(),
  elapsedTime: z.number(),
})
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>

export const CursorPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})
export type CursorPosition = z.infer<typeof CursorPositionSchema>

// ============================================================================
// Paused Game State
// ============================================================================

export const PausedGameStateSchema = z.object({
  selectedCards: z.array(SortingCardSchema),
  availableCards: z.array(SortingCardSchema),
  placedCards: z.array(SortingCardSchema.nullable()),
  cardPositions: z.array(CardPositionSchema),
  gameStartTime: z.number(),
})
export type PausedGameState = z.infer<typeof PausedGameStateSchema>

// ============================================================================
// Game State
// ============================================================================

export const CardSortingStateSchema = z.object({
  // Configuration
  cardCount: CardCountSchema,
  timeLimit: z.number().nullable(),
  gameMode: GameModeSchema,

  // Game phase
  gamePhase: GamePhaseSchema,

  // Player & timing
  playerId: z.string(),
  playerMetadata: PlayerMetadataSchema,
  activePlayers: z.array(z.string()),
  allPlayerMetadata: z.record(z.string(), PlayerMetadataSchema), // Was Map, now Record for serialization
  gameStartTime: z.number().nullable(),
  gameEndTime: z.number().nullable(),

  // Cards
  selectedCards: z.array(SortingCardSchema),
  correctOrder: z.array(SortingCardSchema),
  availableCards: z.array(SortingCardSchema),
  placedCards: z.array(SortingCardSchema.nullable()),
  cardPositions: z.array(CardPositionSchema),

  // Multiplayer cursors (collaborative mode) - was Map, now Record for serialization
  cursorPositions: z.record(z.string(), CursorPositionSchema),

  // UI state
  selectedCardId: z.string().nullable(),

  // Results
  scoreBreakdown: ScoreBreakdownSchema.nullable(),

  // Pause/Resume
  originalConfig: CardSortingConfigSchema.optional(),
  pausedGamePhase: GamePhaseSchema.optional(),
  pausedGameState: PausedGameStateSchema.optional(),
})

/**
 * Core game state type - inferred from Zod schema
 * Note: allPlayerMetadata and cursorPositions were Map in old code, now Record for serialization
 */
export type CardSortingState = z.infer<typeof CardSortingStateSchema>

// ============================================================================
// Game Moves (TypeScript union - could be Zod later if needed)
// ============================================================================

export type CardSortingMove =
  | {
      type: 'START_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: {
        playerMetadata: PlayerMetadata
        selectedCards: SortingCard[]
      }
    }
  | {
      type: 'PLACE_CARD'
      playerId: string
      userId: string
      timestamp: number
      data: {
        cardId: string
        position: number
      }
    }
  | {
      type: 'INSERT_CARD'
      playerId: string
      userId: string
      timestamp: number
      data: {
        cardId: string
        insertPosition: number
      }
    }
  | {
      type: 'REMOVE_CARD'
      playerId: string
      userId: string
      timestamp: number
      data: {
        position: number
      }
    }
  | {
      type: 'CHECK_SOLUTION'
      playerId: string
      userId: string
      timestamp: number
      data: {
        finalSequence?: SortingCard[]
      }
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
        field: 'cardCount' | 'timeLimit' | 'gameMode'
        value: unknown
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
      type: 'UPDATE_CARD_POSITIONS'
      playerId: string
      userId: string
      timestamp: number
      data: {
        positions: CardPosition[]
      }
    }
  | {
      type: 'JOIN_COLLABORATIVE_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: {
        playerMetadata: PlayerMetadata
      }
    }
  | {
      type: 'LEAVE_COLLABORATIVE_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'UPDATE_CURSOR_POSITION'
      playerId: string
      userId: string
      timestamp: number
      data: {
        x: number
        y: number
      }
    }

// ============================================================================
// Component Props (TypeScript only - not serialized)
// ============================================================================

export interface SortingCardProps {
  card: SortingCard
  isSelected: boolean
  isPlaced: boolean
  isCorrect?: boolean
  onClick: () => void
}

export interface PositionSlotProps {
  position: number
  card: SortingCard | null
  isActive: boolean
  isCorrect?: boolean
  gradientStyle: React.CSSProperties
  onClick: () => void
}

export interface ScoreDisplayProps {
  breakdown: ScoreBreakdown
  correctOrder: SortingCard[]
  userOrder: SortingCard[]
  onNewGame: () => void
  onExit: () => void
}
