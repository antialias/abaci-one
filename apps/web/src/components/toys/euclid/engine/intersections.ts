import Flatten from '@flatten-js/core'
import type {
  ConstructionState,
  ConstructionElement,
  ConstructionPoint,
  ConstructionCircle,
  ConstructionSegment,
  IntersectionCandidate,
} from '../types'
import { getPoint, getSegment, getRadius, getAllCircles, getAllSegments } from './constructionState'

const TOLERANCE = 0.001

interface Vec2 {
  x: number
  y: number
}

// ── Primitive intersections ────────────────────────────────────────

export function circleCircleIntersections(
  c1x: number, c1y: number, c1r: number,
  c2x: number, c2y: number, c2r: number,
): Vec2[] {
  const fc1 = new Flatten.Circle(new Flatten.Point(c1x, c1y), c1r)
  const fc2 = new Flatten.Circle(new Flatten.Point(c2x, c2y), c2r)
  const pts = fc1.intersect(fc2)
  return pts.map((p: Flatten.Point) => ({ x: p.x, y: p.y }))
}

export function circleSegmentIntersections(
  cx: number, cy: number, cr: number,
  x1: number, y1: number, x2: number, y2: number,
): Vec2[] {
  const fc = new Flatten.Circle(new Flatten.Point(cx, cy), cr)
  const fs = new Flatten.Segment(new Flatten.Point(x1, y1), new Flatten.Point(x2, y2))
  const pts = fc.intersect(fs)
  return pts.map((p: Flatten.Point) => ({ x: p.x, y: p.y }))
}

/** Circle ∩ infinite line through two points (for "produced" segments — Post.2) */
export function circleLineIntersections(
  cx: number, cy: number, cr: number,
  x1: number, y1: number, x2: number, y2: number,
): Vec2[] {
  // Degenerate: two identical points can't define a line
  if (Math.abs(x1 - x2) < TOLERANCE && Math.abs(y1 - y2) < TOLERANCE) return []
  const fc = new Flatten.Circle(new Flatten.Point(cx, cy), cr)
  const fl = new Flatten.Line(new Flatten.Point(x1, y1), new Flatten.Point(x2, y2))
  const pts = fc.intersect(fl)
  return pts.map((p: Flatten.Point) => ({ x: p.x, y: p.y }))
}

export function segmentSegmentIntersection(
  a1x: number, a1y: number, a2x: number, a2y: number,
  b1x: number, b1y: number, b2x: number, b2y: number,
): Vec2[] {
  const sa = new Flatten.Segment(new Flatten.Point(a1x, a1y), new Flatten.Point(a2x, a2y))
  const sb = new Flatten.Segment(new Flatten.Point(b1x, b1y), new Flatten.Point(b2x, b2y))
  const pts = sa.intersect(sb)
  return pts.map((p: Flatten.Point) => ({ x: p.x, y: p.y }))
}

// ── High-level: find new intersections for a newly added element ───

function isDuplicate(
  candidate: Vec2,
  existing: IntersectionCandidate[],
  statePoints: Vec2[],
): boolean {
  for (const e of existing) {
    if (Math.abs(candidate.x - e.x) < TOLERANCE && Math.abs(candidate.y - e.y) < TOLERANCE) {
      return true
    }
  }
  for (const p of statePoints) {
    if (Math.abs(candidate.x - p.x) < TOLERANCE && Math.abs(candidate.y - p.y) < TOLERANCE) {
      return true
    }
  }
  return false
}

function getCircleData(state: ConstructionState, c: ConstructionCircle) {
  const center = getPoint(state, c.centerId)
  const r = getRadius(state, c.id)
  return center && r > 0 ? { cx: center.x, cy: center.y, r } : null
}

function getSegmentData(state: ConstructionState, s: ConstructionSegment) {
  const from = getPoint(state, s.fromId)
  const to = getPoint(state, s.toId)
  return from && to ? { x1: from.x, y1: from.y, x2: to.x, y2: to.y } : null
}

/** Is (cx, cy) at one of the segment's endpoints? */
function isEndpoint(cx: number, cy: number, seg: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return (
    (Math.abs(cx - seg.x1) < TOLERANCE && Math.abs(cy - seg.y1) < TOLERANCE) ||
    (Math.abs(cx - seg.x2) < TOLERANCE && Math.abs(cy - seg.y2) < TOLERANCE)
  )
}

/** Return points from `linePts` that aren't already in `segPts`. */
function removeAlreadyFound(linePts: Vec2[], segPts: Vec2[]): Vec2[] {
  return linePts.filter(lp =>
    !segPts.some(sp => Math.abs(lp.x - sp.x) < TOLERANCE && Math.abs(lp.y - sp.y) < TOLERANCE),
  )
}

/**
 * Check if a candidate intersection point is "beyond" a specified point
 * on a segment — i.e. on the extension past that endpoint.
 *
 * Uses dot product: candidate is "beyond" P (away from Q) when
 * dot(candidate − P, P − Q) > 0.
 */
export function isCandidateBeyondPoint(
  candidate: { x: number; y: number },
  beyondId: string,
  ofA: string,
  ofB: string,
  state: ConstructionState,
): boolean {
  // Find which of ofA/ofB is the segment
  const segId = [ofA, ofB].find(id => id.startsWith('seg-'))
  if (!segId) return true // no segment involved, can't check

  const seg = getSegment(state, segId)
  if (!seg) return true

  const beyondPt = getPoint(state, beyondId)
  if (!beyondPt) return true

  const fromPt = getPoint(state, seg.fromId)
  const toPt = getPoint(state, seg.toId)
  if (!fromPt || !toPt) return true

  // Determine which endpoint is the "beyond" point and which is the "other"
  const isBeyondFrom =
    Math.abs(beyondPt.x - fromPt.x) < TOLERANCE &&
    Math.abs(beyondPt.y - fromPt.y) < TOLERANCE
  const otherPt = isBeyondFrom ? toPt : fromPt

  // dot(candidate − beyondPt, beyondPt − otherPt) > 0
  const dx = beyondPt.x - otherPt.x
  const dy = beyondPt.y - otherPt.y
  const cx = candidate.x - beyondPt.x
  const cy = candidate.y - beyondPt.y

  return dx * cx + dy * cy > 0
}

export function findNewIntersections(
  state: ConstructionState,
  newElement: ConstructionElement,
  existingCandidates: IntersectionCandidate[],
  extendSegments: boolean = false,
): IntersectionCandidate[] {
  if (newElement.kind === 'point') return []

  const statePoints = state.elements
    .filter((e): e is ConstructionPoint => e.kind === 'point')
    .map(p => ({ x: p.x, y: p.y }))

  const results: IntersectionCandidate[] = []

  function addCandidates(pts: Vec2[], idA: string, idB: string) {
    pts.forEach((pt, i) => {
      if (!isDuplicate(pt, [...existingCandidates, ...results], statePoints)) {
        results.push({ x: pt.x, y: pt.y, ofA: idA, ofB: idB, which: i })
      }
    })
  }

  if (newElement.kind === 'circle') {
    const newData = getCircleData(state, newElement)
    if (!newData) return []

    // vs all existing circles
    for (const c of getAllCircles(state)) {
      if (c.id === newElement.id) continue
      const d = getCircleData(state, c)
      if (!d) continue
      const pts = circleCircleIntersections(newData.cx, newData.cy, newData.r, d.cx, d.cy, d.r)
      addCandidates(pts, newElement.id, c.id)
    }

    // vs all existing segments
    for (const s of getAllSegments(state)) {
      const d = getSegmentData(state, s)
      if (!d) continue
      // Always compute finite segment intersections
      const segPts = circleSegmentIntersections(newData.cx, newData.cy, newData.r, d.x1, d.y1, d.x2, d.y2)
      addCandidates(segPts, newElement.id, s.id)
      // Additionally check line extension if the circle's center is at a segment endpoint
      // (Euclid's Post.2: "produce" a finite straight line beyond its endpoint)
      if (extendSegments && (s.origin === 'straightedge' || s.origin === 'given') && isEndpoint(newData.cx, newData.cy, d)) {
        const linePts = circleLineIntersections(newData.cx, newData.cy, newData.r, d.x1, d.y1, d.x2, d.y2)
        const extensionPts = removeAlreadyFound(linePts, segPts)
        addCandidates(extensionPts, newElement.id, s.id)
      }
    }
  } else if (newElement.kind === 'segment') {
    const newData = getSegmentData(state, newElement)
    if (!newData) return []

    // vs all existing circles
    for (const c of getAllCircles(state)) {
      const d = getCircleData(state, c)
      if (!d) continue
      // Always compute finite segment intersections
      const segPts = circleSegmentIntersections(d.cx, d.cy, d.r, newData.x1, newData.y1, newData.x2, newData.y2)
      addCandidates(segPts, newElement.id, c.id)
      // Additionally check line extension if the circle's center is at a segment endpoint
      if (extendSegments && (newElement.origin === 'straightedge' || newElement.origin === 'given') && isEndpoint(d.cx, d.cy, newData)) {
        const linePts = circleLineIntersections(d.cx, d.cy, d.r, newData.x1, newData.y1, newData.x2, newData.y2)
        const extensionPts = removeAlreadyFound(linePts, segPts)
        addCandidates(extensionPts, newElement.id, c.id)
      }
    }

    // vs all existing segments
    for (const s of getAllSegments(state)) {
      if (s.id === newElement.id) continue
      const sd = getSegmentData(state, s)
      if (!sd) continue
      const pts = segmentSegmentIntersection(
        newData.x1, newData.y1, newData.x2, newData.y2,
        sd.x1, sd.y1, sd.x2, sd.y2,
      )
      addCandidates(pts, newElement.id, s.id)
    }
  }

  return results
}
