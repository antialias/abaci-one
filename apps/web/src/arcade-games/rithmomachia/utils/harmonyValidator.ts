import type { Color, HarmonyDeclaration, HarmonyType, Piece } from '../types'
import { isInEnemyHalf } from '../types'
import { getEffectiveValue } from './pieceSetup'

/**
 * Harmony (progression) validator for Rithmomachia.
 * Detects arithmetic, geometric, and harmonic progressions.
 */

export interface HarmonyValidationResult {
  valid: boolean
  type?: HarmonyType
  params?: HarmonyDeclaration['params']
  reason?: string
}

/**
 * Check if values form an arithmetic progression.
 * Arithmetic: v, v+d, v+2d, ... with d > 0
 */
function isArithmeticProgression(values: number[]): HarmonyValidationResult {
  if (values.length < 2) {
    return { valid: false, reason: 'Need at least 2 values' }
  }

  // Sort values
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  // Calculate common difference
  const d = sorted[1] - sorted[0]

  if (d <= 0) {
    return { valid: false, reason: 'Arithmetic progression requires positive difference' }
  }

  // Check all consecutive differences
  for (let i = 1; i < sorted.length; i++) {
    const actualDiff = sorted[i] - sorted[i - 1]
    if (actualDiff !== d) {
      return {
        valid: false,
        reason: `Not arithmetic: diff ${sorted[i - 1]} → ${sorted[i]} is ${actualDiff}, expected ${d}`,
      }
    }
  }

  return {
    valid: true,
    type: 'ARITH',
    params: {
      v: sorted[0].toString(),
      d: d.toString(),
    },
  }
}

/**
 * Check if values form a geometric progression.
 * Geometric: v, v·r, v·r², ... with integer r ≥ 2
 */
function isGeometricProgression(values: number[]): HarmonyValidationResult {
  if (values.length < 2) {
    return { valid: false, reason: 'Need at least 2 values' }
  }

  // Sort values
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  // Check for zero (can't have geometric with zero)
  if (sorted[0] === 0) {
    return { valid: false, reason: 'Geometric progression cannot start with 0' }
  }

  // Calculate common ratio
  if (sorted[1] % sorted[0] !== 0) {
    return { valid: false, reason: 'Not geometric: ratio is not an integer' }
  }

  const r = sorted[1] / sorted[0]

  if (r < 2) {
    return { valid: false, reason: 'Geometric progression requires ratio ≥ 2' }
  }

  // Check all consecutive ratios
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] % sorted[i - 1] !== 0) {
      return {
        valid: false,
        reason: `Not geometric: ${sorted[i]} not divisible by ${sorted[i - 1]}`,
      }
    }
    const actualRatio = sorted[i] / sorted[i - 1]
    if (actualRatio !== r) {
      return {
        valid: false,
        reason: `Not geometric: ratio ${sorted[i - 1]} → ${sorted[i]} is ${actualRatio}, expected ${r}`,
      }
    }
  }

  return {
    valid: true,
    type: 'GEOM',
    params: {
      v: sorted[0].toString(),
      r: r.toString(),
    },
  }
}

/**
 * Check if values form a harmonic progression.
 * Harmonic: reciprocals form an arithmetic progression.
 * 1/v, 1/(v·n/(n-1)), 1/(v·n/(n-2)), ...
 */
function isHarmonicProgression(values: number[]): HarmonyValidationResult {
  if (values.length < 3) {
    return { valid: false, reason: 'Harmonic progression requires at least 3 values' }
  }

  // Sort values
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  // Check for zero
  if (sorted.some((v) => v === 0)) {
    return { valid: false, reason: 'Harmonic progression cannot contain 0' }
  }

  // Calculate reciprocals as fractions (to avoid floating point)
  // We'll represent 1/v as a rational number and check if differences are equal

  // For harmonic progression, we need:
  // 1/v1 - 1/v2 = 1/v2 - 1/v3 = ... = constant
  //
  // This means:
  // (v2 - v1) / (v1 * v2) = (v3 - v2) / (v2 * v3)
  //
  // Cross-multiply: (v2 - v1) * v2 * v3 = (v3 - v2) * v1 * v2
  //                 (v2 - v1) * v3 = (v3 - v2) * v1

  for (let i = 1; i < sorted.length - 1; i++) {
    const v1 = sorted[i - 1]
    const v2 = sorted[i]
    const v3 = sorted[i + 1]

    const leftSide = (v2 - v1) * v3
    const rightSide = (v3 - v2) * v1

    if (leftSide !== rightSide) {
      return {
        valid: false,
        reason: 'Not harmonic: reciprocals do not form arithmetic progression',
      }
    }
  }

  // Calculate the harmonic parameter n
  // For the first three terms: 1/v, 1/(v·n/(n-1)), 1/(v·n/(n-2))
  // We can derive n from the relationship, but for simplicity we'll just validate
  // the harmonic property holds (which we already did above)

  return {
    valid: true,
    type: 'HARM',
    params: {
      v: sorted[0].toString(),
    },
  }
}

/**
 * Validate if a set of pieces forms a valid harmony.
 * Returns the first valid progression type found, or null.
 */
export function validateHarmony(pieces: Piece[], color: Color): HarmonyValidationResult {
  // Check: all pieces must be in enemy half
  const notInEnemyHalf = pieces.filter((p) => !isInEnemyHalf(p.square, color))
  if (notInEnemyHalf.length > 0) {
    return {
      valid: false,
      reason: `Pieces not in enemy half: ${notInEnemyHalf.map((p) => p.square).join(', ')}`,
    }
  }

  // Check: need at least 3 pieces
  if (pieces.length < 3) {
    return { valid: false, reason: 'Harmony requires at least 3 pieces' }
  }

  // Extract values (handling Pyramids)
  const values: number[] = []
  for (const piece of pieces) {
    const value = getEffectiveValue(piece)
    if (value === null) {
      return {
        valid: false,
        reason: `Piece ${piece.id} has no effective value (Pyramid face not set?)`,
      }
    }
    values.push(value)
  }

  // Check for duplicates
  const uniqueValues = new Set(values.map((v) => v.toString()))
  if (uniqueValues.size !== values.length) {
    return { valid: false, reason: 'Harmony cannot contain duplicate values' }
  }

  // Try to detect progression type (in order: arithmetic, geometric, harmonic)
  const arithCheck = isArithmeticProgression(values)
  if (arithCheck.valid) {
    return arithCheck
  }

  const geomCheck = isGeometricProgression(values)
  if (geomCheck.valid) {
    return geomCheck
  }

  const harmCheck = isHarmonicProgression(values)
  if (harmCheck.valid) {
    return harmCheck
  }

  return { valid: false, reason: 'Values do not form any valid progression' }
}

/**
 * Find all possible harmonies for a color from a set of pieces.
 * Returns an array of all valid 3+ piece combinations that form harmonies.
 */
export function findPossibleHarmonies(
  pieces: Record<string, Piece>,
  color: Color
): Array<{ pieceIds: string[]; validation: HarmonyValidationResult }> {
  const results: Array<{ pieceIds: string[]; validation: HarmonyValidationResult }> = []

  // Get all live pieces for this color in enemy half
  const candidatePieces = Object.values(pieces).filter(
    (p) => p.color === color && !p.captured && isInEnemyHalf(p.square, color)
  )

  if (candidatePieces.length < 3) {
    return results
  }

  // Generate all combinations of 3+ pieces
  // For simplicity, we'll check all subsets of size 3, 4, 5, etc.
  const maxSize = Math.min(candidatePieces.length, 8) // Limit to 8 for performance

  function* combinations<T>(arr: T[], size: number): Generator<T[]> {
    if (size === 0) {
      yield []
      return
    }
    if (arr.length === 0) return

    const [first, ...rest] = arr
    for (const combo of combinations(rest, size - 1)) {
      yield [first, ...combo]
    }
    yield* combinations(rest, size)
  }

  for (let size = 3; size <= maxSize; size++) {
    for (const combo of combinations(candidatePieces, size)) {
      const validation = validateHarmony(combo, color)
      if (validation.valid) {
        results.push({
          pieceIds: combo.map((p) => p.id),
          validation,
        })
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
  harmony: HarmonyDeclaration
): boolean {
  const relevantPieces = harmony.pieceIds.map((id) => pieces[id]).filter((p) => p && !p.captured)

  if (relevantPieces.length < 3) {
    return false
  }

  const validation = validateHarmony(relevantPieces, harmony.by)
  return validation.valid
}

/**
 * Check if ANY valid harmony exists for a color (for harmony persistence recheck).
 */
export function hasAnyValidHarmony(pieces: Record<string, Piece>, color: Color): boolean {
  const harmonies = findPossibleHarmonies(pieces, color)
  return harmonies.length > 0
}
