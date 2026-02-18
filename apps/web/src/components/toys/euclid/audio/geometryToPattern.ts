/**
 * Pattern generator: ConstructionState + FactStore -> Strudel pattern string.
 *
 * Sound design influenced by Switch Angel's production techniques:
 * - supersaw for rich, wide timbres (not thin raw oscillators)
 * - Filter envelopes (lpenv/lpd/lps) for organic movement
 * - Delay with feedback for depth and shimmer
 * - Detuning for width
 * - swpad samples for warm textural foundation
 *
 * @see https://github.com/switchangel/strudel-scripts
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

  // Completion opens up the sound — brighter filter, wider reverb
  const lpfCeiling = isComplete ? 2500 : 1400
  const roomWet = isComplete ? 0.7 : 0.45
  const roomSz = isComplete ? 0.85 : 0.65

  // ── Layer 1: Pad drone — swpad foundation ──
  // Slow-cycling pad with gentle filter, anchors the whole mix
  const dronePad = isComplete ? 2 : 0
  layers.push(
    `sound("swpad:${dronePad}").slow(16).lpf(${Math.round(lpfCeiling * 0.4)}).gain(0.055)`,
  )

  // ── Layer 2: Sub-bass — supersaw on D, very low, felt not heard ──
  // Detuned for warmth, heavily filtered so it's just sub presence
  layers.push(
    `note("d2").sound("supersaw").detune(0.3).lpf(180).gain(0.04).slow(16)`,
  )

  // ── Layer 3: Circle voices — supersaw arpeggios with delay shimmer ──
  const circles = getAllCircles(state)
  for (const circle of circles) {
    const radius = getCircleRadius(state, circle.centerId, circle.radiusPointId)
    if (radius <= 0) continue

    const center = getPoint(state, circle.centerId)
    if (!center) continue

    const arpNotes = circleArpNotes(radius, refDistance)
    const slowFactor = radiusToSlowFactor(radius, refDistance)
    const pan = centerXToPan(center.x, minX, maxX)

    // supersaw arpeggio: detuned for width, filter envelope for pluck,
    // delay for shimmer — panned by circle's geometric center
    layers.push(
      `note("${arpNotes}").sound("supersaw").detune(0.12).lpf(${lpfCeiling}).lpenv(2).lpd(0.2).lps(0.1).gain(0.035).slow(${slowFactor.toFixed(1)}).pan(${pan.toFixed(2)}).delay(0.3).delayfeedback(0.4).delaytime(0.125)`,
    )
  }

  // ── Layer 4: Segment voices — pitched pads per equality group ──
  const segments = getAllSegments(state)
  if (segments.length > 0) {
    const groups = groupSegmentsByEquality(segments, factStore)

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi]
      const length = getSegmentLength(state, group[0].fromId, group[0].toId)
      if (length <= 0) continue

      const note = distanceToNote(length, refDistance)
      // More members in equality group = louder (proof reinforcement)
      const gain = Math.min(0.055, 0.025 + group.length * 0.01)
      const pv = (gi + 1) % 5

      // Pitched pad sample — warm sustained tone
      layers.push(
        `note("${note}").sound("swpad:${pv}").lpf(${Math.round(lpfCeiling * 0.6)}).gain(${gain.toFixed(3)}).slow(8)`,
      )
    }
  }

  return `stack(\n  ${layers.join(',\n  ')}\n).room(${roomWet}).roomsize(${roomSz})`
}

/**
 * One-shot intersection chime.
 * FM bell synthesis à la Switch Angel's DX preset — metallic and resonant.
 */
export function intersectionChimePattern(
  x: number,
  _y: number,
  minX: number,
  maxX: number,
): string {
  const pan = centerXToPan(x, minX, maxX)
  const SCALE = ['d', 'f', 'g', 'a', 'c']
  const range = maxX - minX || 1
  const t = Math.max(0, Math.min(1, (x - minX) / range))
  const scaleIdx = Math.floor(t * (SCALE.length - 1))

  // FM bell: high harmonicity (5.4) for metallic partials, envelope on FM for attack brightness
  return `note("${SCALE[scaleIdx]}5").sound("sine").fm(3).fmh(5.4).fmenv(6).fmdecay(0.3).decay(1.5).sustain(0).gain(0.12).pan(${pan.toFixed(2)}).room(0.7).roomsize(0.8)`
}

/**
 * Completion flourish — ascending supersaw resolving to D major (Picardy third).
 */
export function completionFlourishPattern(): string {
  return 'note("d4 f4 a4 d5 f#5").sound("supersaw").detune(0.15).lpf(2500).lpenv(3).lpd(0.3).lps(0.1).gain(0.07).slow(3).delay(0.35).delayfeedback(0.5).delaytime(0.2).room(0.85).roomsize(0.9)'
}
