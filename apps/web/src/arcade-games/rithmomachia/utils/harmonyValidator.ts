import type { Color, HarmonyDeclaration, HarmonyType, Piece } from '../types'
import { isInEnemyHalf, parseSquare } from '../types'
import { getEffectiveValue } from './pieceSetup'

/**
 * Harmony (progression) validator for Rithmomachia.
 * Detects arithmetic, geometric, and harmonic proportions using three pieces.
 *
 * Updated to match classical Rithmomachia rules:
 * - Three pieces (A-M-B) where M is spatially in the middle
 * - Must be in a straight line (row, column, or diagonal)
 * - Uses three-piece proportion formulas (no division needed)
 */

export interface HarmonyValidationResult {
  valid: boolean
  type?: HarmonyType
  params?: HarmonyDeclaration['params']
  reason?: string
}

export type HarmonyLayoutMode = 'adjacent' | 'equalSpacing' | 'collinear'

/**
 * Check if three squares are collinear (on same row, column, or diagonal)
 */
function areCollinear(sq1: string, sq2: string, sq3: string): boolean {
  const p1 = parseSquare(sq1)
  const p2 = parseSquare(sq2)
  const p3 = parseSquare(sq3)

  if (!p1 || !p2 || !p3) return false

  // Same rank (horizontal row)
  if (p1.rank === p2.rank && p2.rank === p3.rank) return true

  // Same file (vertical column)
  if (p1.file === p2.file && p2.file === p3.file) return true

  // Diagonal: check if slope is consistent
  const dx12 = p2.file - p1.file
  const dy12 = p2.rank - p1.rank
  const dx23 = p3.file - p2.file
  const dy23 = p3.rank - p2.rank

  // Cross product should be zero for collinear points
  return dx12 * dy23 === dy12 * dx23
}

/**
 * Get the distance between two squares (Manhattan or diagonal)
 */
function getDistance(sq1: string, sq2: string): number {
  const p1 = parseSquare(sq1)
  const p2 = parseSquare(sq2)

  if (!p1 || !p2) return Infinity

  return Math.max(Math.abs(p2.file - p1.file), Math.abs(p2.rank - p1.rank))
}

/**
 * Determine which piece is spatially in the middle on a line
 * Returns the middle piece, or null if they're not properly ordered
 */
function findMiddlePiece(pieces: Piece[]): Piece | null {
  if (pieces.length !== 3) return null

  const [p1, p2, p3] = pieces

  // Check all permutations to find which one is in the middle
  const positions = [parseSquare(p1.square), parseSquare(p2.square), parseSquare(p3.square)]

  if (!positions[0] || !positions[1] || !positions[2]) return null

  // For each piece, check if it's between the other two
  for (let i = 0; i < 3; i++) {
    const candidate = positions[i]
    const others = [positions[(i + 1) % 3], positions[(i + 2) % 3]]

    // Check if candidate is between the other two on all axes
    const betweenX =
      (candidate.file >= others[0].file && candidate.file <= others[1].file) ||
      (candidate.file >= others[1].file && candidate.file <= others[0].file)

    const betweenY =
      (candidate.rank >= others[0].rank && candidate.rank <= others[1].rank) ||
      (candidate.rank >= others[1].rank && candidate.rank <= others[0].rank)

    if (betweenX && betweenY) {
      return pieces[i]
    }
  }

  return null
}

/**
 * Check if three pieces satisfy layout constraint
 */
function checkLayout(pieces: Piece[], mode: HarmonyLayoutMode): boolean {
  if (pieces.length !== 3) return false

  const [p1, p2, p3] = pieces
  const squares = [p1.square, p2.square, p3.square]

  // All modes require collinearity
  if (!areCollinear(squares[0], squares[1], squares[2])) {
    return false
  }

  // Find which piece is in the middle
  const middle = findMiddlePiece(pieces)
  if (!middle) return false

  const others = pieces.filter((p) => p !== middle)

  if (mode === 'adjacent') {
    // All distances must be 1
    const d1 = getDistance(middle.square, others[0].square)
    const d2 = getDistance(middle.square, others[1].square)
    return d1 === 1 && d2 === 1
  }

  if (mode === 'equalSpacing') {
    // Distances must be equal (and can be 1 or 2)
    const d1 = getDistance(middle.square, others[0].square)
    const d2 = getDistance(middle.square, others[1].square)
    return d1 === d2 && (d1 === 1 || d1 === 2)
  }

  // mode === 'collinear': any spacing is OK (already checked collinearity)
  return true
}

/**
 * Check if three values form an arithmetic proportion (A-M-B).
 * AP: 2M = A + B (middle is arithmetic mean)
 */
function isArithmeticProportion(a: number, m: number, b: number): HarmonyValidationResult {
  if (2 * m === a + b) {
    return {
      valid: true,
      type: 'ARITH',
      params: {
        a: a.toString(),
        m: m.toString(),
        b: b.toString(),
      },
    }
  }

  return {
    valid: false,
    reason: `Not arithmetic: 2·${m} ≠ ${a} + ${b} (${2 * m} ≠ ${a + b})`,
  }
}

/**
 * Check if three values form a geometric proportion (A-M-B).
 * GP: M² = A · B (middle is geometric mean)
 */
function isGeometricProportion(a: number, m: number, b: number): HarmonyValidationResult {
  if (m * m === a * b) {
    return {
      valid: true,
      type: 'GEOM',
      params: {
        a: a.toString(),
        m: m.toString(),
        b: b.toString(),
      },
    }
  }

  return {
    valid: false,
    reason: `Not geometric: ${m}² ≠ ${a} · ${b} (${m * m} ≠ ${a * b})`,
  }
}

/**
 * Check if three values form a harmonic proportion (A-M-B).
 * HP: 2AB = M(A + B) (middle is harmonic mean)
 * Equivalently: 1/A, 1/M, 1/B forms an arithmetic progression
 */
function isHarmonicProportion(a: number, m: number, b: number): HarmonyValidationResult {
  if (a === 0 || b === 0 || m === 0) {
    return {
      valid: false,
      reason: 'Harmonic proportion cannot contain 0',
    }
  }

  if (2 * a * b === m * (a + b)) {
    return {
      valid: true,
      type: 'HARM',
      params: {
        a: a.toString(),
        m: m.toString(),
        b: b.toString(),
      },
    }
  }

  return {
    valid: false,
    reason: `Not harmonic: 2·${a}·${b} ≠ ${m}·(${a}+${b}) (${2 * a * b} ≠ ${m * (a + b)})`,
  }
}

/**
 * Validate if three pieces form a valid harmony.
 * Returns the first valid proportion type found, or invalid result.
 */
export function validateHarmony(
  pieces: Piece[],
  color: Color,
  layoutMode: HarmonyLayoutMode = 'adjacent'
): HarmonyValidationResult {
  // Check: exactly 3 pieces
  if (pieces.length !== 3) {
    return { valid: false, reason: 'Harmony requires exactly 3 pieces' }
  }

  // Check: all pieces must be in enemy half
  const notInEnemyHalf = pieces.filter((p) => !isInEnemyHalf(p.square, color))
  if (notInEnemyHalf.length > 0) {
    return {
      valid: false,
      reason: `Pieces not in enemy half: ${notInEnemyHalf.map((p) => p.square).join(', ')}`,
    }
  }

  // Check: must satisfy layout constraint
  if (!checkLayout(pieces, layoutMode)) {
    return {
      valid: false,
      reason: `Pieces not in valid ${layoutMode} layout (must be collinear with correct spacing)`,
    }
  }

  // Find middle piece
  const middle = findMiddlePiece(pieces)
  if (!middle) {
    return { valid: false, reason: 'Could not determine middle piece' }
  }

  const others = pieces.filter((p) => p !== middle)

  // Extract values (handling Pyramids)
  const getVal = (p: Piece) => {
    const val = getEffectiveValue(p)
    if (val === null) {
      throw new Error(`Piece ${p.id} has no effective value (Pyramid face not set?)`)
    }
    return val
  }

  try {
    const m = getVal(middle)
    const a = getVal(others[0])
    const b = getVal(others[1])

    // Check for duplicates
    if (a === m || m === b || a === b) {
      return { valid: false, reason: 'Harmony cannot contain duplicate values' }
    }

    // Try all three proportion types
    const apCheck = isArithmeticProportion(a, m, b)
    if (apCheck.valid) return apCheck

    const gpCheck = isGeometricProportion(a, m, b)
    if (gpCheck.valid) return gpCheck

    const hpCheck = isHarmonicProportion(a, m, b)
    if (hpCheck.valid) return hpCheck

    return { valid: false, reason: 'Values do not form any valid proportion' }
  } catch (err) {
    return { valid: false, reason: (err as Error).message }
  }
}

/**
 * Find all possible harmonies for a color from a set of pieces.
 * Returns an array of all valid 3-piece combinations that form harmonies.
 */
export function findPossibleHarmonies(
  pieces: Record<string, Piece>,
  color: Color,
  layoutMode: HarmonyLayoutMode = 'adjacent'
): Array<{ pieceIds: string[]; validation: HarmonyValidationResult }> {
  const results: Array<{ pieceIds: string[]; validation: HarmonyValidationResult }> = []

  // Get all live pieces for this color in enemy half
  const candidatePieces = Object.values(pieces).filter(
    (p) => p.color === color && !p.captured && isInEnemyHalf(p.square, color)
  )

  if (candidatePieces.length < 3) {
    return results
  }

  // Generate all combinations of exactly 3 pieces
  for (let i = 0; i < candidatePieces.length; i++) {
    for (let j = i + 1; j < candidatePieces.length; j++) {
      for (let k = j + 1; k < candidatePieces.length; k++) {
        const combo = [candidatePieces[i], candidatePieces[j], candidatePieces[k]]
        const validation = validateHarmony(combo, color, layoutMode)
        if (validation.valid) {
          results.push({
            pieceIds: combo.map((p) => p.id),
            validation,
          })
        }
      }
    }
  }

  return results
}

/**
 * Check if a specific harmony declaration is currently valid.
 * Used for harmony persistence checking.
 */
export function isHarmonyStillValid(
  pieces: Record<string, Piece>,
  harmony: HarmonyDeclaration,
  layoutMode: HarmonyLayoutMode = 'adjacent'
): boolean {
  const relevantPieces = harmony.pieceIds.map((id) => pieces[id]).filter((p) => p && !p.captured)

  if (relevantPieces.length !== 3) {
    return false
  }

  const validation = validateHarmony(relevantPieces, harmony.by, layoutMode)
  return validation.valid
}

/**
 * Check if ANY valid harmony exists for a color (for harmony persistence recheck).
 */
export function hasAnyValidHarmony(
  pieces: Record<string, Piece>,
  color: Color,
  layoutMode: HarmonyLayoutMode = 'adjacent'
): boolean {
  const harmonies = findPossibleHarmonies(pieces, color, layoutMode)
  return harmonies.length > 0
}
