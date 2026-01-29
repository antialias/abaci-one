/**
 * Rithmomachia (Battle of Numbers) - Type Definitions
 *
 * This module uses Zod schemas as the single source of truth for types.
 * TypeScript types are inferred from Zod schemas using z.infer<>.
 */

import { z } from 'zod'

// ============================================================================
// Piece Types
// ============================================================================

export const PieceTypeSchema = z.enum(['C', 'T', 'S', 'P']) // Circle, Triangle, Square, Pyramid
export type PieceType = z.infer<typeof PieceTypeSchema>

export const ColorSchema = z.enum(['W', 'B']) // White, Black
export type Color = z.infer<typeof ColorSchema>

export const PieceSchema = z.object({
  id: z.string(), // stable UUID (e.g., "W_C_01")
  color: ColorSchema,
  type: PieceTypeSchema,
  value: z.number().optional(), // for C/T/S always present
  pyramidFaces: z.array(z.number()).optional(), // for P only (length 4)
  activePyramidFace: z.number().nullable().optional(), // last chosen face for logging/captures
  square: z.string(), // "A1".."P8"
  captured: z.boolean(),
})
export type Piece = z.infer<typeof PieceSchema>

// ============================================================================
// Relations
// ============================================================================

export const RelationKindSchema = z.enum([
  'EQUAL', // a == b
  'MULTIPLE', // a % b == 0
  'DIVISOR', // b % a == 0
  'SUM', // a + h == b or b + h == a
  'DIFF', // |a - h| == b or |b - h| == a
  'PRODUCT', // a * h == b or b * h == a
  'RATIO', // a * r == b or b * r == a (r = helper value)
])
export type RelationKind = z.infer<typeof RelationKindSchema>

export const CaptureContextSchema = z.object({
  relation: RelationKindSchema,
  moverPieceId: z.string(),
  targetPieceId: z.string(),
  helperPieceId: z.string().optional(), // required for SUM/DIFF/PRODUCT/RATIO
  moverFaceUsed: z.number().nullable().optional(), // if mover was a Pyramid
})
export type CaptureContext = z.infer<typeof CaptureContextSchema>

export const AmbushContextSchema = z.object({
  relation: RelationKindSchema,
  enemyPieceId: z.string(),
  helper1Id: z.string(),
  helper2Id: z.string(), // two helpers for ambush
})
export type AmbushContext = z.infer<typeof AmbushContextSchema>

// ============================================================================
// Harmony
// ============================================================================

export const HarmonyTypeSchema = z.enum(['ARITH', 'GEOM', 'HARM'])
export type HarmonyType = z.infer<typeof HarmonyTypeSchema>

export const HarmonyDeclarationSchema = z.object({
  by: ColorSchema,
  pieceIds: z.array(z.string()), // exactly 3 for classical three-piece proportions
  type: HarmonyTypeSchema,
  params: z.object({
    a: z.string().optional(), // first value in proportion (A-M-B structure)
    m: z.string().optional(), // middle value in proportion
    b: z.string().optional(), // last value in proportion
  }),
  declaredAtPly: z.number(),
})
export type HarmonyDeclaration = z.infer<typeof HarmonyDeclarationSchema>

// ============================================================================
// Move Records
// ============================================================================

export const WinConditionSchema = z.enum([
  'HARMONY',
  'EXHAUSTION',
  'RESIGNATION',
  'POINTS',
  'AGREEMENT',
  'REPETITION',
  'FIFTY',
])

export const GameResultSchema = z.enum(['ONGOING', 'WINS_W', 'WINS_B', 'DRAW'])

export const MoveRecordSchema = z.object({
  ply: z.number(),
  color: ColorSchema,
  from: z.string(), // e.g., "C2"
  to: z.string(), // e.g., "C6"
  pieceId: z.string(),
  pyramidFaceUsed: z.number().nullable().optional(),
  capture: CaptureContextSchema.nullable().optional(),
  ambush: AmbushContextSchema.nullable().optional(),
  harmonyDeclared: HarmonyDeclarationSchema.nullable().optional(),
  pointsCapturedThisMove: z.number().optional(), // if point scoring is on
  fenLikeHash: z.string().optional(), // for repetition detection
  noProgressCount: z.number().optional(), // for 50-move rule
  resultAfter: GameResultSchema.optional(),
})
export type MoveRecord = z.infer<typeof MoveRecordSchema>

// ============================================================================
// Game Configuration
// ============================================================================

export const RithmomachiaConfigSchema = z.object({
  // Rule toggles
  pointWinEnabled: z.boolean(), // default: false
  pointWinThreshold: z.number(), // default: 30
  repetitionRule: z.boolean(), // default: true
  fiftyMoveRule: z.boolean(), // default: true
  allowAnySetOnRecheck: z.boolean(), // default: true (harmony revalidation)

  // Optional time controls (not implemented in v1)
  timeControlMs: z.number().nullable(),

  // Player assignments (null = auto-assign)
  whitePlayerId: z.string().nullable().optional(), // default: null (auto-assign first active player)
  blackPlayerId: z.string().nullable().optional(), // default: null (auto-assign second active player)
})
export type RithmomachiaConfig = z.infer<typeof RithmomachiaConfigSchema> & {
  [key: string]: unknown // Index signature for GameConfig constraint
}

// ============================================================================
// Game Phase
// ============================================================================

export const GamePhaseSchema = z.enum(['setup', 'playing', 'results'])
export type GamePhase = z.infer<typeof GamePhaseSchema>

// ============================================================================
// Game State
// ============================================================================

export const RithmomachiaStateSchema = z.object({
  // Configuration (stored in state per arcade pattern)
  pointWinEnabled: z.boolean(),
  pointWinThreshold: z.number(),
  repetitionRule: z.boolean(),
  fiftyMoveRule: z.boolean(),
  allowAnySetOnRecheck: z.boolean(),
  timeControlMs: z.number().nullable(),
  whitePlayerId: z.string().nullable().optional(),
  blackPlayerId: z.string().nullable().optional(),

  // Game phase
  gamePhase: GamePhaseSchema,

  // Board dimensions
  boardCols: z.number(), // 16
  boardRows: z.number(), // 8

  // Current turn
  turn: ColorSchema, // 'W' or 'B'

  // Pieces (key = piece.id)
  pieces: z.record(z.string(), PieceSchema),

  // Captured pieces
  capturedPieces: z.object({
    W: z.array(PieceSchema),
    B: z.array(PieceSchema),
  }),

  // Move history
  history: z.array(MoveRecordSchema),

  // Pending harmony (declared last turn, awaiting validation)
  pendingHarmony: HarmonyDeclarationSchema.nullable(),

  // Draw/repetition tracking
  noProgressCount: z.number(), // for 50-move rule
  stateHashes: z.array(z.string()), // Zobrist hashes for repetition detection

  // Victory state
  winner: ColorSchema.nullable(),
  winCondition: WinConditionSchema.nullable(),

  // Points (if enabled by config)
  pointsCaptured: z
    .object({
      W: z.number(),
      B: z.number(),
    })
    .optional(),
})
export type RithmomachiaState = z.infer<typeof RithmomachiaStateSchema>

// ============================================================================
// Game Moves
// ============================================================================

export type RithmomachiaMove =
  | {
      type: 'START_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: {
        playerColor: Color
        activePlayers: string[]
      }
    }
  | {
      type: 'MOVE'
      playerId: string
      userId: string
      timestamp: number
      data: {
        from: string
        to: string
        pieceId: string
        pyramidFaceUsed?: number | null
        capture?: Omit<CaptureContext, 'moverPieceId' | 'targetPieceId'> & {
          targetPieceId: string
        }
        ambush?: AmbushContext
      }
    }
  | {
      type: 'DECLARE_HARMONY'
      playerId: string
      userId: string
      timestamp: number
      data: {
        pieceIds: string[]
        harmonyType: HarmonyType
        params: HarmonyDeclaration['params']
      }
    }
  | {
      type: 'RESIGN'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'OFFER_DRAW'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'ACCEPT_DRAW'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'CLAIM_REPETITION'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'CLAIM_FIFTY_MOVE'
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
        field: string
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
  | {
      type: 'GO_TO_SETUP'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }

// ============================================================================
// Helper Types & Constants
// ============================================================================

// Square notation helpers
export type File =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type Square = `${File}${Rank}`

// Board boundaries
export const WHITE_HALF_ROWS = [1, 2, 3, 4] as const
export const BLACK_HALF_ROWS = [5, 6, 7, 8] as const

// Point values for pieces
export const PIECE_POINTS: Record<PieceType, number> = {
  C: 1, // Circle
  T: 2, // Triangle
  S: 3, // Square
  P: 5, // Pyramid
}

// Utility: check if square is in enemy half
export function isInEnemyHalf(square: string, color: Color): boolean {
  const rank = Number.parseInt(square[1], 10)
  if (color === 'W') {
    return (BLACK_HALF_ROWS as readonly number[]).includes(rank)
  }
  return (WHITE_HALF_ROWS as readonly number[]).includes(rank)
}

// Utility: parse square notation
export function parseSquare(square: string): { file: number; rank: number } {
  const file = square.charCodeAt(0) - 65 // A=0, B=1, ..., P=15
  const rank = Number.parseInt(square[1], 10) // 1-8
  return { file, rank }
}

// Utility: create square notation
export function makeSquare(file: number, rank: number): string {
  return `${String.fromCharCode(65 + file)}${rank}`
}

// Utility: get opponent color
export function opponentColor(color: Color): Color {
  return color === 'W' ? 'B' : 'W'
}
