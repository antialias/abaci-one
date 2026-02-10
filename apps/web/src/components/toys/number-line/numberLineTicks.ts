import type { NumberLineState, TickMark, TickClass, TickThresholds } from './types'
import { DEFAULT_TICK_THRESHOLDS } from './types'

/**
 * Compute all visible tick marks for the current viewport.
 *
 * For each power of 10, we compute how many ticks of that spacing fit on screen
 * and assign a visual class based on configurable thresholds:
 *   - < anchorMax ticks (default 9)  -> "anchor" (full opacity, tall, bold labels)
 *   - <= mediumMax ticks (default 23) -> "medium" (normal labels)
 *   - > mediumMax ticks  -> "fine"   (low opacity, short, labels fade out)
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

  // Fade zone: labels fade from full opacity to 0 between mediumMax and mediumMax * 1.5
  const fadeStart = mediumMax
  const fadeEnd = mediumMax * 1.5

  // First pass: determine the class and opacity for each power
  const powerClasses: { power: number; tickClass: TickClass; opacity: number }[] = []

  for (let power = maxPower; power >= minPower; power--) {
    const spacing = Math.pow(10, power)
    const tickSpacingPx = spacing * pixelsPerUnit

    // Skip if too dense (more than ~130 ticks) or too small (< 2px apart)
    if (tickSpacingPx < 2) continue
    const numTicks = canvasWidth / tickSpacingPx
    if (numTicks > 130) continue

    let tickClass: TickClass
    let opacity: number

    if (numTicks < anchorMax) {
      tickClass = 'anchor'
      opacity = 1
    } else if (numTicks <= mediumMax) {
      tickClass = 'medium'
      opacity = 1
    } else {
      tickClass = 'fine'
      // Smooth fade: 1 at fadeStart, 0 at fadeEnd
      if (numTicks <= fadeStart) {
        opacity = 1
      } else if (numTicks >= fadeEnd) {
        opacity = 0
      } else {
        opacity = 1 - (numTicks - fadeStart) / (fadeEnd - fadeStart)
      }
    }

    // Skip fully invisible ticks
    if (opacity <= 0) continue

    powerClasses.push({ power, tickClass, opacity })
  }

  // Second pass: generate ticks, deduplicating so each value appears only at
  // its coarsest power. We process from coarsest to finest.
  // Use string keys "power:index" for dedup to avoid floating-point collisions.
  const seen = new Set<string>()
  const ticks: TickMark[] = []

  // powerClasses is already ordered from coarsest (highest power) to finest
  for (const { power, tickClass, opacity } of powerClasses) {
    const spacing = Math.pow(10, power)
    const firstIndex = Math.ceil(leftValue / spacing)
    const lastIndex = Math.floor(rightValue / spacing)

    for (let i = firstIndex; i <= lastIndex; i++) {
      // Compute value from index * spacing (avoids accumulated addition drift)
      const value = i * spacing

      // Dedup: a tick at value V was already emitted at a coarser power P'
      // if V is a multiple of 10^P'. Check all coarser powers.
      let dominated = false
      for (const coarser of powerClasses) {
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

      ticks.push({ value, power, tickClass, opacity })
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
