import type { CoordinatePlaneState } from '../types'
import type { ViewportTarget } from './types'
import type { WordProblem } from '../wordProblems/types'

const PADDING_FACTOR = 0.3 // 30% padding around the bounding box

/** Maximum ratio between ppuX and ppuY to avoid extreme visual distortion */
const MAX_PPU_RATIO = 12

/**
 * Compute the target viewport that shows the problem's relevant geometry.
 *
 * Uses independent axis scaling so high-slope problems (e.g., 53 miles/hour)
 * are viewable — the Y axis gets a different scale than X.
 *
 * Returns a ViewportTarget with potentially different ppuX and ppuY.
 */
export function computeViewportTarget(
  problem: WordProblem,
  canvasWidth: number,
  canvasHeight: number,
  _currentState: CoordinatePlaneState
): ViewportTarget {
  // Collect points of interest
  const points: { x: number; y: number }[] = [
    { x: 0, y: 0 }, // origin is always useful context
    { x: 0, y: problem.equation.intercept.num / problem.equation.intercept.den }, // y-intercept
    { x: problem.answer.x, y: problem.answer.y }, // solution point
  ]

  // For two-point problems, include the given points
  if (problem.difficulty === 4) {
    const nums = problem.answer
    points.push({ x: nums.x, y: nums.y })
  }

  // Compute bounding box
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }

  // Add padding
  const rangeX = maxX - minX || 2
  const rangeY = maxY - minY || 2
  const padX = rangeX * PADDING_FACTOR
  const padY = rangeY * PADDING_FACTOR
  minX -= padX
  maxX += padX
  minY -= padY
  maxY += padY

  // Reserve space for the card (roughly 1/3 of the viewport on one side)
  const expandedRangeX = (maxX - minX) * 1.4
  const expandedRangeY = (maxY - minY) * 1.4

  // Compute independent PPU for each axis
  let ppuX = canvasWidth / expandedRangeX
  let ppuY = canvasHeight / expandedRangeY

  // Clamp the ratio to avoid extreme distortion
  const ratio = ppuX / ppuY
  if (ratio > MAX_PPU_RATIO) {
    // X is too zoomed in relative to Y — pull X back
    ppuX = ppuY * MAX_PPU_RATIO
  } else if (ratio < 1 / MAX_PPU_RATIO) {
    // Y is too zoomed in relative to X — pull Y back
    ppuY = ppuX * MAX_PPU_RATIO
  }

  // Center on the midpoint of the bounding box
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  return { cx, cy, ppuX, ppuY }
}
