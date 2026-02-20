import type { SemanticFrame, GeneratedNumbers, DifficultyLevel } from './types'
import type { SeededRandom } from '../../../../lib/SeededRandom'

const GRID_MIN = -15
const GRID_MAX = 15
const MAX_ATTEMPTS = 50

/**
 * Equation-first number generation — guarantees integer solutions by construction.
 *
 * 1. Pick m from frame's slopeRange (per difficulty constraints)
 * 2. Pick b from frame's interceptRange (0 at levels 1-2)
 * 3. Pick xAnswer from frame's xRange
 * 4. Compute yTarget = m * xAnswer + b
 * 5. Validate: yTarget in range, everything fits grid bounds
 * 6. Retry if invalid (bounded attempts, fallback values)
 */
export function generateNumbers(
  frame: SemanticFrame,
  difficulty: DifficultyLevel,
  rng: SeededRandom
): GeneratedNumbers {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = tryGenerate(frame, difficulty, rng)
    if (result) return result
  }

  // Fallback: simple values guaranteed to work
  return fallbackNumbers(frame, difficulty)
}

function tryGenerate(
  frame: SemanticFrame,
  difficulty: DifficultyLevel,
  rng: SeededRandom
): GeneratedNumbers | null {
  let m: number
  let b: number

  if (difficulty === 1) {
    // y = b (constant function)
    m = 0
    b = rng.nextInt(frame.interceptRange.min, frame.interceptRange.max)
    if (b === 0) b = 1 // avoid trivial y = 0
  } else if (difficulty === 2) {
    // y = mx (proportional, no intercept)
    m = rng.nextInt(frame.slopeRange.min, frame.slopeRange.max)
    b = 0
  } else {
    // y = mx + b (full linear)
    m = rng.nextInt(frame.slopeRange.min, frame.slopeRange.max)
    b = rng.nextInt(frame.interceptRange.min, frame.interceptRange.max)
  }

  const xAnswer = rng.nextInt(frame.xRange.min, frame.xRange.max)
  const yTarget = m * xAnswer + b

  // Validate y is in frame's range
  if (yTarget < frame.yRange.min || yTarget > frame.yRange.max) return null

  // Validate key points are within grid bounds (viewport auto-adjusts, but keep reasonable)
  if (!fitsGrid(xAnswer, yTarget)) return null

  // For level 4 (two points → equation), generate two distinct points on the line
  let point1: { x: number; y: number } | undefined
  let point2: { x: number; y: number } | undefined

  if (difficulty === 4) {
    const pts = generateTwoPoints(m, b, frame, rng)
    if (!pts) return null
    point1 = pts.point1
    point2 = pts.point2
  }

  return { m, b, xAnswer, yTarget, point1, point2 }
}

function generateTwoPoints(
  m: number,
  b: number,
  frame: SemanticFrame,
  rng: SeededRandom
): { point1: { x: number; y: number }; point2: { x: number; y: number } } | null {
  // Collect all valid integer x values with corresponding y on the line within grid bounds
  const validPoints: { x: number; y: number }[] = []
  for (
    let x = Math.max(GRID_MIN, frame.xRange.min);
    x <= Math.min(GRID_MAX, frame.xRange.max);
    x++
  ) {
    const y = m * x + b
    if (y >= GRID_MIN && y <= GRID_MAX && Number.isInteger(y)) {
      validPoints.push({ x, y })
    }
  }

  if (validPoints.length < 2) return null

  // Pick two distinct points
  const [p1, p2] = rng.pickN(validPoints, 2)
  return { point1: p1, point2: p2 }
}

function fitsGrid(xAnswer: number, yTarget: number): boolean {
  // xAnswer should be within grid bounds (user needs to find it on the ruler)
  if (xAnswer < GRID_MIN || xAnswer > GRID_MAX) return false
  // yTarget can exceed default grid view — viewport animation will auto-zoom
  // But keep it within a reasonable range for readability
  if (yTarget < -500 || yTarget > 500) return false
  return true
}

function fallbackNumbers(frame: SemanticFrame, difficulty: DifficultyLevel): GeneratedNumbers {
  if (difficulty === 1) {
    const b = Math.max(1, frame.interceptRange.min)
    return { m: 0, b, xAnswer: 1, yTarget: b }
  }
  if (difficulty === 2) {
    const m = frame.slopeRange.min
    return { m, b: 0, xAnswer: 1, yTarget: m }
  }
  // Level 3+
  const m = frame.slopeRange.min
  const b = Math.max(frame.interceptRange.min, 1)
  const xAnswer = 1
  const yTarget = m * xAnswer + b
  return {
    m,
    b,
    xAnswer,
    yTarget,
    ...(difficulty === 4 ? { point1: { x: 0, y: b }, point2: { x: 1, y: m + b } } : {}),
  }
}
