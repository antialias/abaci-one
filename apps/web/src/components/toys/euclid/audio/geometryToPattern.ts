/**
 * Pattern generator: ConstructionState + FactStore -> Strudel pattern string.
 *
 * Sound palette (all from loaded sample banks or built-in synths):
 * - Drone: switchangel pad (github:switchangel/pad)
 * - Circle voices: "arpy" from dirt-samples — pre-pitched, clear arpeggio tones
 * - Segment voices: switchangel pads pitched to note — warm sustained tones
 * - Texture bed: filtered brown noise
 * - Intersection chime: "tink" from dirt-samples
 * - Completion flourish: "arpy" ascending to D major
 */

import type { ConstructionState } from '../types'
import type { FactStore } from '../engine/factStore'
import { queryEquality } from '../engine/factStore'
import { getAllCircles, getAllSegments, getAllPoints, getPoint } from '../engine/constructionState'
import { distancePair } from '../engine/facts'
import { distanceToNote, circleArpNotes, radiusToSlowFactor, centerXToPan } from './pitchMapping'

function getSegmentLength(state: ConstructionState, fromId: string, toId: string): number {
  const from = getPoint(state, fromId)
  const to = getPoint(state, toId)
  if (!from || !to) return 0
  return Math.sqrt((from.x - to.x) ** 2 + (from.y - to.y) ** 2)
}

function getCircleRadius(state: ConstructionState, centerId: string, radiusPointId: string): number {
  return getSegmentLength(state, centerId, radiusPointId)
}

export function getPointBounds(state: ConstructionState): { minX: number; maxX: number } {
  const points = getAllPoints(state)
  if (points.length === 0) return { minX: -5, maxX: 5 }
  let minX = Infinity
  let maxX = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
  }
  if (maxX - minX < 1) {
    minX -= 0.5
    maxX += 0.5
  }
  return { minX, maxX }
}

function getMedianSegmentLength(state: ConstructionState): number {
  const segments = getAllSegments(state)
  if (segments.length === 0) return 4

  const lengths = segments
    .map(s => getSegmentLength(state, s.fromId, s.toId))
    .filter(l => l > 0)
    .sort((a, b) => a - b)

  if (lengths.length === 0) return 4
  return lengths[Math.floor(lengths.length / 2)]
}

/**
 * Group segments by equality using the FactStore's union-find.
 */
function groupSegmentsByEquality(
  segments: Array<{ fromId: string; toId: string }>,
  factStore: FactStore,
): Array<{ fromId: string; toId: string }[]> {
  const groups: Array<{ fromId: string; toId: string }[]> = []
  const grouped = new Set<number>()

  for (let i = 0; i < segments.length; i++) {
    if (grouped.has(i)) continue

    const group = [segments[i]]
    grouped.add(i)

    const dpI = distancePair(segments[i].fromId, segments[i].toId)

    for (let j = i + 1; j < segments.length; j++) {
      if (grouped.has(j)) continue
      const dpJ = distancePair(segments[j].fromId, segments[j].toId)
      if (queryEquality(factStore, dpI, dpJ)) {
        group.push(segments[j])
        grouped.add(j)
      }
    }

    groups.push(group)
  }

  return groups
}

/**
 * Generate a Strudel pattern string from the current construction state.
 */
export function geometryToPattern(
  state: ConstructionState,
  factStore: FactStore,
  isComplete: boolean,
): string {
  const layers: string[] = []

  const refDistance = getMedianSegmentLength(state)
  const { minX, maxX } = getPointBounds(state)
  const roomSize = isComplete ? 0.85 : 0.7
  const lpfCeiling = isComplete ? 2000 : 1200

  // Layer 1: Drone — switchangel pad, warm and slow
  const dronePad = isComplete ? 2 : 0
  layers.push(
    `sound("swpad:${dronePad}").slow(16).lpf(${Math.round(lpfCeiling * 0.5)}).gain(0.06)`,
  )

  // Layer 2: Texture bed — filtered brown noise
  layers.push(
    `sound("brown").gain(0.012).lpf(${isComplete ? 350 : 200})`,
  )

  // Layer 3: Circle voices — "arpy" from dirt-samples, panned by center x
  const circles = getAllCircles(state)
  for (const circle of circles) {
    const radius = getCircleRadius(state, circle.centerId, circle.radiusPointId)
    if (radius <= 0) continue

    const center = getPoint(state, circle.centerId)
    if (!center) continue

    const arpNotes = circleArpNotes(radius, refDistance)
    const slowFactor = radiusToSlowFactor(radius, refDistance)
    const pan = centerXToPan(center.x, minX, maxX)

    layers.push(
      `note("${arpNotes}").sound("arpy").lpf(${lpfCeiling}).gain(0.04).slow(${slowFactor.toFixed(1)}).pan(${pan.toFixed(2)}).delay(0.25).delayfeedback(0.4).delaytime(0.125)`,
    )
  }

  // Layer 4: Segment voices — pitched swpad per equality group
  const segments = getAllSegments(state)
  if (segments.length > 0) {
    const groups = groupSegmentsByEquality(segments, factStore)

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi]
      const length = getSegmentLength(state, group[0].fromId, group[0].toId)
      if (length <= 0) continue

      const note = distanceToNote(length, refDistance)
      // Louder per member — equality reinforcement
      const gain = Math.min(0.05, 0.02 + group.length * 0.01)
      const pv = (gi + 1) % 5

      layers.push(
        `note("${note}").sound("swpad:${pv}").lpf(${Math.round(lpfCeiling * 0.7)}).gain(${gain.toFixed(3)}).slow(8)`,
      )
    }
  }

  return `stack(\n  ${layers.join(',\n  ')}\n).room(${roomSize}).roomsize(${isComplete ? 0.9 : 0.7})`
}

/**
 * One-shot chime for intersection discovery.
 * Uses "tink" from dirt-samples — bright, clear percussive hit.
 */
export function intersectionChimePattern(
  x: number,
  _y: number,
  minX: number,
  maxX: number,
): string {
  const pan = centerXToPan(x, minX, maxX)
  // Use different tink variations based on position for variety
  const variation = Math.floor(Math.max(0, Math.min(1, (x - minX) / (maxX - minX || 1))) * 3)

  return `sound("tink:${variation}").gain(0.14).pan(${pan.toFixed(2)}).room(0.8).roomsize(0.9)`
}

/**
 * Completion flourish — ascending arpy resolving to D major (Picardy third).
 */
export function completionFlourishPattern(): string {
  return 'note("d4 f4 a4 d5 f#5").sound("arpy").gain(0.09).slow(3).room(0.9).roomsize(0.9).delay(0.3).delayfeedback(0.5).delaytime(0.2)'
}
