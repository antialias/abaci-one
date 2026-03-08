/**
 * Pure geometry utilities for the superposition interaction.
 * No React dependencies — these are math functions only.
 */
import type { Vec2 } from '../types'

/**
 * Determine the winding order of a triangle.
 * In world coords (Y-up): positive cross product = CCW.
 */
export function triangleOrientation(a: Vec2, b: Vec2, c: Vec2): 'cw' | 'ccw' {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  return cross > 0 ? 'ccw' : 'cw'
}

/** Centroid of a triangle */
export function triangleCentroid(a: Vec2, b: Vec2, c: Vec2): Vec2 {
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 }
}

/** Circumradius of a triangle: R = abc / (4·area) */
export function circumradius(a: Vec2, b: Vec2, c: Vec2): number {
  const ab = Math.hypot(b.x - a.x, b.y - a.y)
  const bc = Math.hypot(c.x - b.x, c.y - b.y)
  const ca = Math.hypot(a.x - c.x, a.y - c.y)
  const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2
  if (area < 1e-10) return Math.max(ab, bc, ca) / 2 // degenerate
  return (ab * bc * ca) / (4 * area)
}

/**
 * Compute the rotation angle (radians) to align source edge 0→1 with target edge 0→1.
 * Uses the first edge pair from the mapping.
 */
export function computeTargetRotation(
  srcVerts: [Vec2, Vec2, Vec2],
  tgtVerts: [Vec2, Vec2, Vec2]
): number {
  const srcAngle = Math.atan2(srcVerts[1].y - srcVerts[0].y, srcVerts[1].x - srcVerts[0].x)
  const tgtAngle = Math.atan2(tgtVerts[1].y - tgtVerts[0].y, tgtVerts[1].x - tgtVerts[0].x)
  return normalizeAngle(tgtAngle - srcAngle)
}

/** Normalize an angle to [-π, π] */
function normalizeAngle(angle: number): number {
  let a = angle % (2 * Math.PI)
  if (a > Math.PI) a -= 2 * Math.PI
  if (a < -Math.PI) a += 2 * Math.PI
  return a
}

/** Shortest-path angular interpolation */
export function lerpAngle(from: number, to: number, t: number): number {
  const delta = normalizeAngle(to - from)
  return from + delta * t
}

/** Rotate an array of 3 vertices around a center point by the given angle */
export function rotateVerticesAround(
  verts: [Vec2, Vec2, Vec2],
  center: Vec2,
  angle: number
): [Vec2, Vec2, Vec2] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return verts.map((v) => {
    const dx = v.x - center.x
    const dy = v.y - center.y
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    }
  }) as [Vec2, Vec2, Vec2]
}

/**
 * Flip a vertex across an axis for the superposition flip animation.
 * Projects the vertex onto the axis, then scales the perpendicular
 * displacement by cos(π·t). At t=0.5 the vertex collapses onto the axis;
 * for t>0.5 the displacement inverts, producing the mirror image.
 */
export function flipVertex(vertex: Vec2, axisPoint: Vec2, axisDir: Vec2, t: number): Vec2 {
  const toVertex = { x: vertex.x - axisPoint.x, y: vertex.y - axisPoint.y }
  const projLen = toVertex.x * axisDir.x + toVertex.y * axisDir.y
  const proj = {
    x: axisPoint.x + projLen * axisDir.x,
    y: axisPoint.y + projLen * axisDir.y,
  }
  const scale = Math.cos(Math.PI * t)
  return {
    x: proj.x + (vertex.x - proj.x) * scale,
    y: proj.y + (vertex.y - proj.y) * scale,
  }
}

/** Linear interpolation between two sets of 3 vertices */
export function lerpVertices(
  from: [Vec2, Vec2, Vec2],
  to: [Vec2, Vec2, Vec2],
  t: number
): [Vec2, Vec2, Vec2] {
  return from.map((f, i) => ({
    x: f.x + (to[i].x - f.x) * t,
    y: f.y + (to[i].y - f.y) * t,
  })) as [Vec2, Vec2, Vec2]
}

/**
 * Compute auto-rotation angle based on proximity to target.
 * Uses quadratic falloff: influence = max(0, 1 - dist/(2·circumR))²
 * Returns the blended rotation angle to apply to the cutout.
 */
export function computeAutoRotation(
  cutoutCentroid: Vec2,
  tgtCentroid: Vec2,
  cutoutVerts: [Vec2, Vec2, Vec2],
  tgtVerts: [Vec2, Vec2, Vec2],
  circumR: number
): number {
  const dist = Math.hypot(cutoutCentroid.x - tgtCentroid.x, cutoutCentroid.y - tgtCentroid.y)
  const rawInfluence = Math.max(0, 1 - dist / (2 * circumR))
  const influence = rawInfluence * rawInfluence // quadratic falloff

  if (influence < 1e-6) return 0

  const targetRot = computeTargetRotation(cutoutVerts, tgtVerts)
  return targetRot * influence
}

/** Point-in-triangle test using barycentric coordinates */
export function pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const v0x = c.x - a.x
  const v0y = c.y - a.y
  const v1x = b.x - a.x
  const v1y = b.y - a.y
  const v2x = p.x - a.x
  const v2y = p.y - a.y

  const dot00 = v0x * v0x + v0y * v0y
  const dot01 = v0x * v1x + v0y * v1y
  const dot02 = v0x * v2x + v0y * v2y
  const dot11 = v1x * v1x + v1y * v1y
  const dot12 = v1x * v2x + v1y * v2y

  const inv = 1 / (dot00 * dot11 - dot01 * dot01)
  const u = (dot11 * dot02 - dot01 * dot12) * inv
  const v = (dot00 * dot12 - dot01 * dot02) * inv

  return u >= 0 && v >= 0 && u + v <= 1
}
