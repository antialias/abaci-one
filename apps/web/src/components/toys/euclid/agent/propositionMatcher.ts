/**
 * Topology-based proposition detection from free-form construction.
 *
 * Detects which proposition the user is attempting based on the construction's
 * topology (element counts + relational structure). This is the heckler's
 * activation trigger — when the matcher identifies a known proposition,
 * Euclid calls the user.
 *
 * Matching strategy (two tiers):
 * 1. Count-based pre-filter — extract a fingerprint from the construction state
 * 2. Relational structure check — verify graph edges for shortlisted candidates
 *
 * Confidence levels:
 * - 'speculative' — early pattern match (e.g., cross-centered circles, no intersection yet)
 * - 'likely'      — most structure present (e.g., + intersection at circle meeting)
 * - 'confirmed'   — complete match (e.g., full equilateral triangle drawn)
 */

import type {
  ConstructionState,
  ConstructionPoint,
  ConstructionCircle,
  ConstructionSegment,
} from '../types'
import { getAllPoints, getAllCircles, getAllSegments } from '../engine/constructionState'

export type MatchConfidence = 'speculative' | 'likely' | 'confirmed'

export interface PropositionMatch {
  propositionId: number
  confidence: MatchConfidence
  /** Human-readable description of what was detected. */
  description: string
}

/** Count-based fingerprint of a construction state. */
interface ConstructionFingerprint {
  points: ConstructionPoint[]
  circles: ConstructionCircle[]
  segments: ConstructionSegment[]
  intersectionPoints: ConstructionPoint[]
  extendPoints: ConstructionPoint[]
  freePoints: ConstructionPoint[]
  givenPoints: ConstructionPoint[]
}

function fingerprint(state: ConstructionState): ConstructionFingerprint {
  const points = getAllPoints(state)
  const circles = getAllCircles(state)
  const segments = getAllSegments(state)
  return {
    points,
    circles,
    segments,
    intersectionPoints: points.filter((p) => p.origin === 'intersection'),
    extendPoints: points.filter((p) => p.origin === 'extend'),
    freePoints: points.filter((p) => p.origin === 'free'),
    givenPoints: points.filter((p) => p.origin === 'given'),
  }
}

// ---------------------------------------------------------------------------
// Proposition I.1 — Construct an equilateral triangle on a given segment
// ---------------------------------------------------------------------------

/**
 * Check if two circles are cross-centered: each centered on one of two points,
 * with the radius-point being the other.
 */
function findCrossCenteredCirclePair(circles: ConstructionCircle[]): {
  circleA: ConstructionCircle
  circleB: ConstructionCircle
  ptIdA: string
  ptIdB: string
} | null {
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i]
      const b = circles[j]
      // a centered at P through Q, b centered at Q through P
      if (a.centerId === b.radiusPointId && a.radiusPointId === b.centerId) {
        return { circleA: a, circleB: b, ptIdA: a.centerId, ptIdB: b.centerId }
      }
    }
  }
  return null
}

/**
 * Check if a point lies at a circle-circle intersection.
 * We don't recompute geometry — we check if the point's origin is 'intersection'
 * and whether both circles exist with the expected relationship.
 */
function isCircleCircleIntersection(
  pt: ConstructionPoint,
  circleA: ConstructionCircle,
  circleB: ConstructionCircle,
  state: ConstructionState
): boolean {
  if (pt.origin !== 'intersection') return false

  // The point should lie on both circles geometrically.
  // Since we can't know the parent elements directly from the state,
  // we check coordinates: compute the distance from the point to each
  // circle's center and compare with the circle's radius.
  const allPts = getAllPoints(state)
  const centerA = allPts.find((p) => p.id === circleA.centerId)
  const radPtA = allPts.find((p) => p.id === circleA.radiusPointId)
  const centerB = allPts.find((p) => p.id === circleB.centerId)
  const radPtB = allPts.find((p) => p.id === circleB.radiusPointId)

  if (!centerA || !radPtA || !centerB || !radPtB) return false

  const radiusA = Math.hypot(radPtA.x - centerA.x, radPtA.y - centerA.y)
  const radiusB = Math.hypot(radPtB.x - centerB.x, radPtB.y - centerB.y)
  const distA = Math.hypot(pt.x - centerA.x, pt.y - centerA.y)
  const distB = Math.hypot(pt.x - centerB.x, pt.y - centerB.y)

  const tolerance = 0.02 // slightly more generous than the 0.01 in serializeProofState
  return Math.abs(distA - radiusA) < tolerance && Math.abs(distB - radiusB) < tolerance
}

/**
 * Check if a segment connects two specific points (in either order).
 */
function segmentConnects(seg: ConstructionSegment, ptIdA: string, ptIdB: string): boolean {
  return (
    (seg.fromId === ptIdA && seg.toId === ptIdB) || (seg.fromId === ptIdB && seg.toId === ptIdA)
  )
}

function matchProp1(
  state: ConstructionState,
  fp: ConstructionFingerprint
): PropositionMatch | null {
  // Need at least 2 circles
  if (fp.circles.length < 2) return null

  // Find cross-centered pair
  const crossPair = findCrossCenteredCirclePair(fp.circles)
  if (!crossPair) return null

  const { ptIdA, ptIdB, circleA, circleB } = crossPair

  // Find intersection point at circle-circle meeting
  const meetingPoints = fp.intersectionPoints.filter((pt) =>
    isCircleCircleIntersection(pt, circleA, circleB, state)
  )

  if (meetingPoints.length === 0) {
    // Cross-centered circles exist but no intersection placed yet
    return {
      propositionId: 1,
      confidence: 'speculative',
      description: 'Two cross-centered circles detected — Prop I.1 pattern',
    }
  }

  // At least one intersection point exists at the circle meeting
  const meetPt = meetingPoints[0]

  // Check for triangle segments
  const hasSegAMeet = fp.segments.some((s) => segmentConnects(s, ptIdA, meetPt.id))
  const hasSegBMeet = fp.segments.some((s) => segmentConnects(s, ptIdB, meetPt.id))
  const hasBaseSeg = fp.segments.some((s) => segmentConnects(s, ptIdA, ptIdB))

  if (hasSegAMeet && hasSegBMeet && hasBaseSeg) {
    return {
      propositionId: 1,
      confidence: 'confirmed',
      description: 'Complete equilateral triangle constructed — Prop I.1',
    }
  }

  // Intersection placed = likely
  return {
    propositionId: 1,
    confidence: 'likely',
    description: 'Cross-centered circles with intersection point — Prop I.1',
  }
}

// ---------------------------------------------------------------------------
// Main matcher
// ---------------------------------------------------------------------------

/** All proposition matchers, ordered by priority. */
const MATCHERS: Array<
  (state: ConstructionState, fp: ConstructionFingerprint) => PropositionMatch | null
> = [
  matchProp1,
  // Future: matchProp2, matchProp3, matchProp4, matchProp5, etc.
]

/**
 * Detect which proposition the user is attempting based on the construction's
 * topology. Returns the highest-confidence match, or null if no pattern detected.
 */
export function matchProposition(state: ConstructionState): PropositionMatch | null {
  const fp = fingerprint(state)

  // Need at least 2 points and 1 non-point element to match anything
  if (fp.points.length < 2 || (fp.circles.length === 0 && fp.segments.length === 0)) {
    return null
  }

  console.log(
    '[heckler-matcher] checking: %d pts, %d circles, %d segs, %d intersections',
    fp.points.length,
    fp.circles.length,
    fp.segments.length,
    fp.intersectionPoints.length
  )

  let bestMatch: PropositionMatch | null = null
  const confidenceRank: Record<MatchConfidence, number> = {
    speculative: 0,
    likely: 1,
    confirmed: 2,
  }

  for (const matcher of MATCHERS) {
    const match = matcher(state, fp)
    if (match) {
      if (!bestMatch || confidenceRank[match.confidence] > confidenceRank[bestMatch.confidence]) {
        bestMatch = match
      }
    }
  }

  if (bestMatch) {
    console.log(
      '[heckler-matcher] match: prop I.%d (%s) — %s',
      bestMatch.propositionId,
      bestMatch.confidence,
      bestMatch.description
    )
  }
  return bestMatch
}
