import type { GameConfig, GameState } from '@/lib/arcade/game-sdk'

// === PIECE TYPES ===

export type PieceType = 'C' | 'T' | 'S' | 'P' // Circle, Triangle, Square, Pyramid
export type Color = 'W' | 'B' // White, Black

export interface Piece {
  id: string // stable UUID (e.g., "W_C_01")
  color: Color
  type: PieceType
  value?: number // for C/T/S always present
  pyramidFaces?: number[] // for P only (length 4)
  activePyramidFace?: number | null // last chosen face for logging/captures
  square: string // "A1".."P8"
  captured: boolean
}

// === RELATIONS ===

export type RelationKind =
  | 'EQUAL' // a == b
  | 'MULTIPLE' // a % b == 0
  | 'DIVISOR' // b % a == 0
  | 'SUM' // a + h == b or b + h == a
  | 'DIFF' // |a - h| == b or |b - h| == a
  | 'PRODUCT' // a * h == b or b * h == a
  | 'RATIO' // a * r == b or b * r == a (r = helper value)

export interface CaptureContext {
  relation: RelationKind
  moverPieceId: string
  targetPieceId: string
  helperPieceId?: string // required for SUM/DIFF/PRODUCT/RATIO
  moverFaceUsed?: number | null // if mover was a Pyramid
}

export interface AmbushContext {
  relation: RelationKind
  enemyPieceId: string
  helper1Id: string
  helper2Id: string // two helpers for ambush
}

// === HARMONY ===

export type HarmonyType = 'ARITH' | 'GEOM' | 'HARM'

export interface HarmonyDeclaration {
  by: Color
  pieceIds: string[] // exactly 3 for classical three-piece proportions
  type: HarmonyType
  params: {
    a?: string // first value in proportion (A-M-B structure)
    m?: string // middle value in proportion
    b?: string // last value in proportion
  }
  declaredAtPly: number
}

// === MOVE RECORDS ===

export interface MoveRecord {
  ply: number
  color: Color
  from: string // e.g., "C2"
  to: string // e.g., "C6"
  pieceId: string
  pyramidFaceUsed?: number | null
  capture?: CaptureContext | null
  ambush?: AmbushContext | null
  harmonyDeclared?: HarmonyDeclaration | null
  pointsCapturedThisMove?: number // if point scoring is on
  fenLikeHash?: string // for repetition detection
  noProgressCount?: number // for 50-move rule
  resultAfter?: 'ONGOING' | 'WINS_W' | 'WINS_B' | 'DRAW'
}

// === GAME STATE ===

export interface RithmomachiaState extends GameState {
  // Configuration (stored in state per arcade pattern)
  pointWinEnabled: boolean
  pointWinThreshold: number
  repetitionRule: boolean
  fiftyMoveRule: boolean
  allowAnySetOnRecheck: boolean
  timeControlMs: number | null
  whitePlayerId?: string | null
  blackPlayerId?: string | null

  // Game phase
  gamePhase: 'setup' | 'playing' | 'results'

  // Board dimensions
  boardCols: number // 16
  boardRows: number // 8

  // Current turn
  turn: Color // 'W' or 'B'

  // Pieces (key = piece.id)
  pieces: Record<string, Piece>

  // Captured pieces
  capturedPieces: {
    W: Piece[]
    B: Piece[]
  }

  // Move history
  history: MoveRecord[]

  // Pending harmony (declared last turn, awaiting validation)
  pendingHarmony: HarmonyDeclaration | null

  // Draw/repetition tracking
  noProgressCount: number // for 50-move rule
  stateHashes: string[] // Zobrist hashes for repetition detection

  // Victory state
  winner: Color | null
  winCondition:
    | 'HARMONY'
    | 'EXHAUSTION'
    | 'RESIGNATION'
    | 'POINTS'
    | 'AGREEMENT'
    | 'REPETITION'
    | 'FIFTY'
    | null

  // Points (if enabled by config)
  pointsCaptured?: {
    W: number
    B: number
  }
}

// === GAME CONFIG ===

export interface RithmomachiaConfig extends GameConfig {
  // Rule toggles
  pointWinEnabled: boolean // default: false
  pointWinThreshold: number // default: 30
  repetitionRule: boolean // default: true
  fiftyMoveRule: boolean // default: true
  allowAnySetOnRecheck: boolean // default: true (harmony revalidation)

  // Optional time controls (not implemented in v1)
  timeControlMs?: number | null

  // Player assignments (null = auto-assign)
  whitePlayerId?: string | null // default: null (auto-assign first active player)
  blackPlayerId?: string | null // default: null (auto-assign second active player)
}

// === GAME MOVES ===

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
        value: any
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

// === HELPER TYPES ===

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
