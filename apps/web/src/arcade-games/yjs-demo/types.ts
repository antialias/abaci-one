/**
 * Yjs Demo - Type Definitions
 *
 * This module uses Zod schemas as the single source of truth for types.
 * TypeScript types are inferred from Zod schemas using z.infer<>.
 */

import { z } from 'zod'

// ============================================================================
// Configuration
// ============================================================================

export const YjsDemoConfigSchema = z.object({
  gridSize: z.union([z.literal(8), z.literal(12), z.literal(16)]),
  duration: z.union([z.literal(60), z.literal(120), z.literal(180)]),
})
export type YjsDemoConfig = z.infer<typeof YjsDemoConfigSchema> & {
  [key: string]: unknown // Satisfy GameConfig constraint
}

// ============================================================================
// Grid Cell (for Yjs synchronization)
// ============================================================================

export const GridCellSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  playerId: z.string(),
  timestamp: z.number(),
  color: z.string(),
})
export type GridCell = z.infer<typeof GridCellSchema>

// ============================================================================
// Game Phase
// ============================================================================

export const GamePhaseSchema = z.enum(['setup', 'playing', 'results'])
export type GamePhase = z.infer<typeof GamePhaseSchema>

// ============================================================================
// Game State
// ============================================================================

export const YjsDemoStateSchema = z.object({
  gamePhase: GamePhaseSchema,
  gridSize: z.number(),
  duration: z.number(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  activePlayers: z.array(z.string()),
  playerScores: z.record(z.string(), z.number()),
  // Cells array for persistence (synced from Y.Doc)
  cells: z.array(GridCellSchema).optional(),
})

/**
 * Core game state type - inferred from Zod schema
 * Note: Index signature added to satisfy GameState constraint
 */
export type YjsDemoState = z.infer<typeof YjsDemoStateSchema>

// ============================================================================
// Move Types
// ============================================================================

// Moves are not used in Yjs demo (everything goes through Y.Doc)
// but we need this for arcade compatibility
export type YjsDemoMove =
  | {
      type: 'START_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: { activePlayers: string[] }
    }
  | {
      type: 'END_GAME'
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
