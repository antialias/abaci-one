import type { WordProblem } from '../wordProblems/types'
import type { Fraction } from '../ruler/types'
import { equationFromPoints } from '../ruler/fractionMath'

/**
 * Check if the ruler's current position matches the target equation.
 *
 * Since ruler handles snap to integer grid points, equationFromPoints produces
 * exact reduced fractions. Comparison is exact fraction equality — no floating-point
 * tolerance needed.
 */
export function checkAnswer(
  rulerAx: number,
  rulerAy: number,
  rulerBx: number,
  rulerBy: number,
  problem: WordProblem
): { correct: boolean } {
  const eq = equationFromPoints(rulerAx, rulerAy, rulerBx, rulerBy)

  // Handle degenerate ruler placements
  if (eq.kind === 'point') return { correct: false }
  if (eq.kind === 'vertical') return { correct: false }

  const target = problem.equation

  if (eq.kind === 'horizontal') {
    // y = b — slope is 0
    return {
      correct: target.slope.num === 0 && fractionsEqual({ num: eq.y, den: 1 }, target.intercept),
    }
  }

  // General case: compare slope and intercept
  return {
    correct:
      fractionsEqual(eq.slope, target.slope) &&
      fractionsEqual(eq.intercept, target.intercept),
  }
}

function fractionsEqual(a: Fraction, b: Fraction): boolean {
  // Both are reduced fractions with positive denominators
  return a.num === b.num && a.den === b.den
}
