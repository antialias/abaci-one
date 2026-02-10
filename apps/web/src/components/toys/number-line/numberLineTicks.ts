import type { NumberLineState, TickMark, TickClass } from './types'

/**
 * Compute all visible tick marks for the current viewport.
 *
 * For each power of 10, we compute how many ticks of that spacing fit on screen
 * and assign a visual class:
 *   - < 3 ticks   -> "anchor" (full opacity, tall, bold labels)
 *   - 4-13 ticks  -> "medium" (half opacity, medium height, normal labels)
 *   - > 13 ticks  -> "fine"   (low opacity, short, no labels)
 *
 * A tick at value N is only emitted at its coarsest applicable power so that,
 * for example, 100 is drawn as a power-2 tick and not also as power-1 and power-0.
 */
export function computeTickMarks(state: NumberLineState, canvasWidth: number): TickMark[] {
  const { center, pixelsPerUnit } = state
  if (pixelsPerUnit <= 0 || canvasWidth <= 0) return []

  const halfWidth = canvasWidth / 2
  const leftValue = center - halfWidth / pixelsPerUnit
  const rightValue = center + halfWidth / pixelsPerUnit

  // Determine the range of powers to consider.
  // Smallest power where tick spacing in px >= 2
  const minPower = Math.floor(Math.log10(2 / pixelsPerUnit))
  // Largest power where at least ~1 tick fits on screen
  const maxPower = Math.ceil(Math.log10((rightValue - leftValue) * 2))

  // First pass: determine the class for each power
  const powerClasses: { power: number; tickClass: TickClass }[] = []

  for (let power = maxPower; power >= minPower; power--) {
    const spacing = Math.pow(10, power)
    const tickSpacingPx = spacing * pixelsPerUnit

    // Skip if too dense (more than ~130 ticks) or too small (< 2px apart)
    if (tickSpacingPx < 2) continue
    const numTicks = canvasWidth / tickSpacingPx
    if (numTicks > 130) continue

    let tickClass: TickClass
    if (numTicks < 3) {
      tickClass = 'anchor'
    } else if (numTicks <= 13) {
      tickClass = 'medium'
    } else {
      tickClass = 'fine'
    }

    powerClasses.push({ power, tickClass })
  }

  // Second pass: generate ticks, deduplicating so each value appears only at
  // its coarsest power. We process from coarsest to finest.
  const seen = new Set<number>()
  const ticks: TickMark[] = []

  // powerClasses is already ordered from coarsest (highest power) to finest
  for (const { power, tickClass } of powerClasses) {
    const spacing = Math.pow(10, power)
    const firstTick = Math.ceil(leftValue / spacing) * spacing
    const lastTick = Math.floor(rightValue / spacing) * spacing

    for (let value = firstTick; value <= lastTick; value += spacing) {
      // Round to avoid floating point drift
      const rounded = Math.round(value * 1e10) / 1e10
      if (seen.has(rounded)) continue
      seen.add(rounded)
      ticks.push({ value: rounded, power, tickClass })
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
