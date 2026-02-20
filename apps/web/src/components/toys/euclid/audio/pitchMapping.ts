/**
 * Geometric-to-musical conversion for Euclid construction music.
 * Pure functions, no side effects.
 *
 * Uses D minor pentatonic scale (D F G A C) across octaves 2-6.
 * Shorter segments -> higher pitch (like shorter strings).
 */

const SCALE_NOTES = ['d', 'f', 'g', 'a', 'c'] as const
const MIN_OCTAVE = 2
const MAX_OCTAVE = 6

// Build full scale array from low to high
const FULL_SCALE: string[] = []
for (let oct = MIN_OCTAVE; oct <= MAX_OCTAVE; oct++) {
  for (const note of SCALE_NOTES) {
    FULL_SCALE.push(`${note}${oct}`)
  }
}

const CENTER_INDEX = Math.floor(FULL_SCALE.length / 2)

/**
 * Map a geometric distance to a note in the D minor pentatonic scale.
 *
 * Logarithmic mapping: shorter segments -> higher pitch (like shorter strings).
 * Reference distance maps to scale center. Equal distances always produce
 * the same note -- the key musical-geometric link.
 */
export function distanceToNote(distance: number, refDistance: number): string {
  if (distance <= 0 || refDistance <= 0) return FULL_SCALE[CENTER_INDEX]

  // Log ratio: ref/distance -> shorter = positive -> higher pitch
  const logRatio = Math.log2(refDistance / distance)
  const offset = Math.round(logRatio * SCALE_NOTES.length)
  const index = Math.max(0, Math.min(FULL_SCALE.length - 1, CENTER_INDEX + offset))

  return FULL_SCALE[index]
}

/**
 * Generate arpeggio notes for a circle based on its radius.
 * Returns a Strudel mini-notation string (e.g. "f3 g3 a3 c4").
 * 4 notes spanning the scale around the radius-derived pitch.
 */
export function circleArpNotes(radius: number, refDistance: number): string {
  if (radius <= 0 || refDistance <= 0) return FULL_SCALE[CENTER_INDEX]

  const logRatio = Math.log2(refDistance / radius)
  const offset = Math.round(logRatio * SCALE_NOTES.length)
  const centerIdx = Math.max(2, Math.min(FULL_SCALE.length - 2, CENTER_INDEX + offset))

  const indices = [centerIdx - 1, centerIdx, centerIdx + 1, centerIdx + 2].map((i) =>
    Math.max(0, Math.min(FULL_SCALE.length - 1, i))
  )

  return indices.map((i) => FULL_SCALE[i]).join(' ')
}

/**
 * Map circle radius to a Strudel .slow() factor.
 * Larger radius = slower arpeggio (proportional to circumference).
 */
export function radiusToSlowFactor(radius: number, refDistance: number): number {
  if (radius <= 0 || refDistance <= 0) return 4
  return Math.max(1, Math.min(16, (radius / refDistance) * 4))
}

/**
 * Map center X coordinate to Strudel pan value (0-1, where 0.5 is center).
 */
export function centerXToPan(x: number, minX: number, maxX: number): number {
  if (maxX <= minX) return 0.5
  return Math.max(0, Math.min(1, (x - minX) / (maxX - minX)))
}
