import type { NumberLineState, TickMark, TickThresholds } from './types'
import { DEFAULT_TICK_THRESHOLDS } from './types'

/** Hermite smoothstep: 3t² - 2t³, clamped to [0,1] */
function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

/**
 * Compute continuous prominence (0-1) for a tick power based on how many
 * ticks of that spacing fit on screen.
 *
 * Piecewise Hermite smoothstep across three segments:
 *   [0, anchorMax]          → prominence [1.0, 0.5]   (anchor → medium)
 *   [anchorMax, mediumMax]  → prominence [0.5, 0.15]  (medium → fine)
 *   [mediumMax, fadeEnd]    → prominence [0.15, 0.0]  (fine → invisible)
 *
 * Each segment uses smoothstep(t) = 3t² - 2t³ which has zero derivative
 * at both endpoints → C1 continuous at all joints.
 */
function computeProminence(
  numTicks: number,
  anchorMax: number,
  mediumMax: number
): number {
  const fadeEnd = mediumMax * 1.5

  if (numTicks <= 0) return 1.0
  if (numTicks >= fadeEnd) return 0.0

  if (numTicks <= anchorMax) {
    // Anchor → medium: prominence 1.0 → 0.5
    const t = smoothstep(numTicks / anchorMax)
    return 1.0 - t * 0.5
  } else if (numTicks <= mediumMax) {
    // Medium → fine: prominence 0.5 → 0.15
    const t = smoothstep((numTicks - anchorMax) / (mediumMax - anchorMax))
    return 0.5 - t * 0.35
  } else {
    // Fine → invisible: prominence 0.15 → 0.0
    const t = smoothstep((numTicks - mediumMax) / (fadeEnd - mediumMax))
    return 0.15 - t * 0.15
  }
}

/**
 * Compute all visible tick marks for the current viewport.
 *
 * For each power of 10, we compute how many ticks of that spacing fit on screen
 * and assign a continuous prominence value based on configurable thresholds.
 * Prominence drives smooth interpolation of all visual properties (height,
 * line width, font, color) — no abrupt jumps at threshold boundaries.
 *
 * A tick at value N is only emitted at its coarsest applicable power so that,
 * for example, 100 is drawn as a power-2 tick and not also as power-1 and power-0.
 */
export function computeTickMarks(
  state: NumberLineState,
  canvasWidth: number,
  thresholds: TickThresholds = DEFAULT_TICK_THRESHOLDS
): TickMark[] {
  const { center, pixelsPerUnit } = state
  if (pixelsPerUnit <= 0 || canvasWidth <= 0) return []

  const { anchorMax, mediumMax } = thresholds

  const halfWidth = canvasWidth / 2
  const leftValue = center - halfWidth / pixelsPerUnit
  const rightValue = center + halfWidth / pixelsPerUnit

  // Determine the range of powers to consider.
  // Smallest power where tick spacing in px >= 2
  const minPower = Math.floor(Math.log10(2 / pixelsPerUnit))
  // Largest power where at least ~1 tick fits on screen
  const maxPower = Math.ceil(Math.log10((rightValue - leftValue) * 2))

  // First pass: determine prominence and opacity for each power
  const powerInfo: { power: number; prominence: number; opacity: number }[] = []

  for (let power = maxPower; power >= minPower; power--) {
    const spacing = Math.pow(10, power)
    const tickSpacingPx = spacing * pixelsPerUnit

    // Skip if too dense (more than ~130 ticks) or too small (< 2px apart)
    if (tickSpacingPx < 2) continue
    const numTicks = canvasWidth / tickSpacingPx
    if (numTicks > 130) continue

    const prominence = computeProminence(numTicks, anchorMax, mediumMax)

    // Opacity: fully visible until prominence < 0.15, then fades
    const opacity = Math.min(1, prominence / 0.15)

    // Skip fully invisible ticks
    if (opacity <= 0) continue

    powerInfo.push({ power, prominence, opacity })
  }

  // Second pass: generate ticks, deduplicating so each value appears only at
  // its coarsest power. We process from coarsest to finest.
  // Use string keys "power:index" for dedup to avoid floating-point collisions.
  const seen = new Set<string>()
  const ticks: TickMark[] = []

  // powerInfo is already ordered from coarsest (highest power) to finest
  for (const { power, prominence, opacity } of powerInfo) {
    const spacing = Math.pow(10, power)
    const firstIndex = Math.ceil(leftValue / spacing)
    const lastIndex = Math.floor(rightValue / spacing)

    for (let i = firstIndex; i <= lastIndex; i++) {
      // Compute value from index * spacing (avoids accumulated addition drift)
      const value = i * spacing

      // Dedup: a tick at value V was already emitted at a coarser power P'
      // if V is a multiple of 10^P'. Check all coarser powers.
      let dominated = false
      for (const coarser of powerInfo) {
        if (coarser.power <= power) break // only check strictly coarser
        const coarserSpacing = Math.pow(10, coarser.power)
        // V is a multiple of coarserSpacing if i is a multiple of 10^(P'-P)
        const ratio = Math.round(coarserSpacing / spacing)
        if (i % ratio === 0) {
          dominated = true
          break
        }
      }
      if (dominated) continue

      // Additional string-key dedup for safety
      const key = `${power}:${i}`
      if (seen.has(key)) continue
      seen.add(key)

      ticks.push({ value, power, prominence, opacity })
    }
  }

  return ticks
}

/** Convert a number-line value to a screen X coordinate */
export function numberToScreenX(
  value: number,
  center: number,
  pixelsPerUnit: number,
  canvasWidth: number
): number {
  return (value - center) * pixelsPerUnit + canvasWidth / 2
}

/** Convert a screen X coordinate to a number-line value */
export function screenXToNumber(
  screenX: number,
  center: number,
  pixelsPerUnit: number,
  canvasWidth: number
): number {
  return (screenX - canvasWidth / 2) / pixelsPerUnit + center
}
