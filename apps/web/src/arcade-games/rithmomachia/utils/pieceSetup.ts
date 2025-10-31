import type { Color, Piece } from '../types'

/**
 * Generate the initial board setup for traditional Rithmomachia.
 * Returns a Record of piece.id → Piece.
 *
 * Layout: VERTICAL - BLACK on left (columns A-C), WHITE on right (columns N-P)
 * This is the classical symmetric formation with 25 pieces per side.
 */
export function createInitialBoard(): Record<string, Piece> {
  const pieces: Record<string, Piece> = {}

  // === BLACK PIECES (Left side: columns A, B, C) ===
  // Traditional setup: large figurates on outer edges, small units inside

  // Column A (Outer edge - Large squares and triangles)
  const blackColumnA = [
    { type: 'S', value: 49, square: 'A1' },
    { type: 'S', value: 121, square: 'A2' },
    { type: 'T', value: 36, square: 'A3' },
    { type: 'T', value: 30, square: 'A4' },
    { type: 'T', value: 56, square: 'A5' },
    { type: 'T', value: 64, square: 'A6' },
    { type: 'S', value: 225, square: 'A7' },
    { type: 'S', value: 361, square: 'A8' },
  ] as const

  // Column B (Middle - Mixed pieces + Pyramid)
  const blackColumnB = [
    // B1: empty
    { type: 'T', value: 66, square: 'B2' },
    { type: 'C', value: 9, square: 'B3' },
    { type: 'C', value: 25, square: 'B4' },
    { type: 'C', value: 49, square: 'B5' },
    { type: 'C', value: 81, square: 'B6' },
    { type: 'S', value: 120, square: 'B7' },
    // B8 is Pyramid (see below)
  ] as const

  // Column C (Inner edge - Small units)
  const blackColumnC = [
    { type: 'T', value: 16, square: 'C1' },
    { type: 'T', value: 12, square: 'C2' },
    { type: 'C', value: 3, square: 'C3' },
    { type: 'C', value: 4, square: 'C4' },
    { type: 'C', value: 2, square: 'C5' },
    { type: 'C', value: 12, square: 'C6' },
    { type: 'T', value: 90, square: 'C7' },
    { type: 'T', value: 9, square: 'C8' },
  ] as const

  let blackSquareCount = 0
  let blackTriangleCount = 0
  let blackCircleCount = 0

  for (const piece of [...blackColumnA, ...blackColumnB, ...blackColumnC]) {
    let id: string
    let count: number
    if (piece.type === 'S') {
      count = ++blackSquareCount
      id = `B_S_${String(count).padStart(2, '0')}`
    } else if (piece.type === 'T') {
      count = ++blackTriangleCount
      id = `B_T_${String(count).padStart(2, '0')}`
    } else {
      count = ++blackCircleCount
      id = `B_C_${String(count).padStart(2, '0')}`
    }
    pieces[id] = {
      id,
      color: 'B',
      type: piece.type,
      value: piece.value,
      square: piece.square,
      captured: false,
    }
  }

  // Black Pyramid at B8
  pieces.B_P_01 = {
    id: 'B_P_01',
    color: 'B',
    type: 'P',
    pyramidFaces: [36, 25, 16, 4],
    activePyramidFace: null,
    square: 'B8',
    captured: false,
  }

  // === WHITE PIECES (Right side: columns N, O, P) ===
  // Traditional setup mirrors Black with inverse ratios

  // Column N (Inner edge - Small units)
  const whiteColumnN = [
    { type: 'T', value: 4, square: 'N1' },
    { type: 'C', value: 2, square: 'N2' },
    { type: 'C', value: 6, square: 'N3' },
    { type: 'C', value: 8, square: 'N4' },
    { type: 'C', value: 4, square: 'N5' },
    { type: 'C', value: 2, square: 'N6' },
    { type: 'T', value: 6, square: 'N7' },
    { type: 'T', value: 5, square: 'N8' },
  ] as const

  // Column O (Middle - Mixed pieces + Pyramid)
  const whiteColumnO = [
    { type: 'S', value: 153, square: 'O1' },
    { type: 'C', value: 25, square: 'O2' },
    { type: 'C', value: 36, square: 'O3' },
    { type: 'C', value: 64, square: 'O4' },
    { type: 'C', value: 16, square: 'O5' },
    { type: 'C', value: 4, square: 'O6' },
    // O7 is Pyramid (see below)
    { type: 'S', value: 169, square: 'O8' },
  ] as const

  // Column P (Outer edge - Large squares and triangles)
  const whiteColumnP = [
    { type: 'S', value: 289, square: 'P1' },
    { type: 'S', value: 81, square: 'P2' },
    { type: 'T', value: 20, square: 'P3' },
    { type: 'T', value: 42, square: 'P4' },
    { type: 'T', value: 49, square: 'P5' },
    { type: 'T', value: 72, square: 'P6' },
    { type: 'S', value: 45, square: 'P7' },
    { type: 'S', value: 25, square: 'P8' },
  ] as const

  let whiteSquareCount = 0
  let whiteTriangleCount = 0
  let whiteCircleCount = 0

  for (const piece of [...whiteColumnN, ...whiteColumnO, ...whiteColumnP]) {
    let id: string
    let count: number
    if (piece.type === 'S') {
      count = ++whiteSquareCount
      id = `W_S_${String(count).padStart(2, '0')}`
    } else if (piece.type === 'T') {
      count = ++whiteTriangleCount
      id = `W_T_${String(count).padStart(2, '0')}`
    } else {
      count = ++whiteCircleCount
      id = `W_C_${String(count).padStart(2, '0')}`
    }
    pieces[id] = {
      id,
      color: 'W',
      type: piece.type,
      value: piece.value,
      square: piece.square,
      captured: false,
    }
  }

  // White Pyramid at O7
  pieces.W_P_01 = {
    id: 'W_P_01',
    color: 'W',
    type: 'P',
    pyramidFaces: [64, 49, 36, 25],
    activePyramidFace: null,
    square: 'O7',
    captured: false,
  }

  return pieces
}

/**
 * Get the effective value of a piece for relation checks.
 * For Circles/Triangles/Squares, returns their value.
 * For Pyramids, returns the activePyramidFace (or null if not set).
 */
export function getEffectiveValue(piece: Piece): number | null {
  if (piece.type === 'P') {
    return piece.activePyramidFace ?? null
  }
  return piece.value ?? null
}

/**
 * Get all live (non-captured) pieces for a given color.
 */
export function getLivePiecesForColor(pieces: Record<string, Piece>, color: Color): Piece[] {
  return Object.values(pieces).filter((p) => p.color === color && !p.captured)
}

/**
 * Get the piece at a specific square (if any).
 */
export function getPieceAt(pieces: Record<string, Piece>, square: string): Piece | null {
  return Object.values(pieces).find((p) => p.square === square && !p.captured) ?? null
}

/**
 * Check if a square is occupied by a live piece.
 */
export function isSquareOccupied(pieces: Record<string, Piece>, square: string): boolean {
  return getPieceAt(pieces, square) !== null
}

/**
 * Get a piece by ID (throws if not found).
 */
export function getPieceById(pieces: Record<string, Piece>, id: string): Piece {
  const piece = pieces[id]
  if (!piece) {
    throw new Error(`Piece not found: ${id}`)
  }
  return piece
}

/**
 * Clone a pieces record (shallow clone for immutability).
 */
export function clonePieces(pieces: Record<string, Piece>): Record<string, Piece> {
  const result: Record<string, Piece> = {}
  for (const [id, piece] of Object.entries(pieces)) {
    result[id] = { ...piece }
  }
  return result
}
