import type { ConstructionState, EuclidViewportState, AngleSpec } from '../types'
import { BYRNE_CYCLE } from '../types'
import { getPoint } from '../engine/constructionState'
import type { FactStore } from '../engine/factStore'
import { getEqualAngles } from '../engine/factStore'
import { angleMeasureKey } from '../engine/facts'
import type { AngleMeasure } from '../engine/facts'

const ARC_RADIUS_PX = 18
const TICK_LENGTH_PX = 4
const ARC_LINE_WIDTH = 1.5

/**
 * Compute the screen-space angle (in radians) from a vertex to a ray endpoint.
 * Note: canvas Y is flipped (down = positive), so we negate dy for math coords.
 */
function angleToPoint(vx: number, vy: number, px: number, py: number): number {
  return Math.atan2(py - vy, px - vx)
}

/** Convert world coordinates to screen coordinates */
function toScreen(
  wx: number,
  wy: number,
  viewport: EuclidViewportState,
  w: number,
  h: number
): { sx: number; sy: number } {
  const sx = w / 2 + (wx - viewport.center.x) * viewport.pixelsPerUnit
  const sy = h / 2 - (wy - viewport.center.y) * viewport.pixelsPerUnit
  return { sx, sy }
}

/**
 * Normalize an angle to [0, 2π)
 */
function normalizeAngle(a: number): number {
  const TWO_PI = 2 * Math.PI
  return ((a % TWO_PI) + TWO_PI) % TWO_PI
}

/**
 * Draw a small arc between two rays emanating from a vertex, with optional tick marks.
 */
function drawArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  startAngle: number,
  endAngle: number,
  color: string,
  tickCount: number,
  radius: number
) {
  // Ensure we draw the shorter arc
  let start = normalizeAngle(startAngle)
  let end = normalizeAngle(endAngle)
  let sweep = normalizeAngle(end - start)
  if (sweep > Math.PI) {
    // Swap to get the shorter arc
    const tmp = start
    start = end
    end = tmp
    sweep = 2 * Math.PI - sweep
  }

  ctx.beginPath()
  ctx.arc(cx, cy, radius, start, start + sweep)
  ctx.strokeStyle = color
  ctx.lineWidth = ARC_LINE_WIDTH
  ctx.stroke()

  // Draw tick marks if needed
  if (tickCount > 0) {
    const midAngle = start + sweep / 2
    const tickSpacing = 3
    const totalWidth = (tickCount - 1) * tickSpacing

    for (let t = 0; t < tickCount; t++) {
      const offset = -totalWidth / 2 + t * tickSpacing
      // Offset along the arc by converting pixel offset to angle offset
      const angleOffset = offset / radius
      const tickAngle = midAngle + angleOffset

      const innerR = radius - TICK_LENGTH_PX
      const outerR = radius + TICK_LENGTH_PX

      ctx.beginPath()
      ctx.moveTo(cx + innerR * Math.cos(tickAngle), cy + innerR * Math.sin(tickAngle))
      ctx.lineTo(cx + outerR * Math.cos(tickAngle), cy + outerR * Math.sin(tickAngle))
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }
}

/** Canonicalize an AngleSpec to a sorted key matching AngleMeasure format */
function canonicalAngleKey(spec: AngleSpec): string {
  const r1 = spec.ray1End
  const r2 = spec.ray2End
  const [sorted1, sorted2] = r1 < r2 ? [r1, r2] : [r2, r1]
  return `∠${spec.vertex}|${sorted1}|${sorted2}`
}

/**
 * Render angle arcs at vertices with optional equality tick marks.
 * Supports both static arcs (from PropositionDef) and dynamic arcs
 * derived from the fact store's angle equality facts.
 */
export function renderAngleArcs(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  givenAngles?: Array<{ spec: AngleSpec; color: string; radiusPx?: number }>,
  equalAngles?: Array<[AngleSpec, AngleSpec]>,
  factStore?: FactStore
) {
  // Build a map from angle spec key to tick count (static pairs)
  const tickCounts = new Map<string, number>()
  if (equalAngles) {
    for (let pairIdx = 0; pairIdx < equalAngles.length; pairIdx++) {
      const [a1, a2] = equalAngles[pairIdx]
      const key1 = `${a1.vertex}|${a1.ray1End}|${a1.ray2End}`
      const key2 = `${a2.vertex}|${a2.ray1End}|${a2.ray2End}`
      tickCounts.set(key1, pairIdx + 1)
      tickCounts.set(key2, pairIdx + 1)
    }
  }

  // Track which angles have been rendered (canonical keys) to avoid duplicates
  const renderedAngles = new Set<string>()

  // ── Static angle arcs (from PropositionDef) ──
  if (givenAngles) {
    for (const { spec, color, radiusPx } of givenAngles) {
      const vertex = getPoint(state, spec.vertex)
      const ray1 = getPoint(state, spec.ray1End)
      const ray2 = getPoint(state, spec.ray2End)
      if (!vertex || !ray1 || !ray2) continue

      const vs = toScreen(vertex.x, vertex.y, viewport, w, h)
      const r1s = toScreen(ray1.x, ray1.y, viewport, w, h)
      const r2s = toScreen(ray2.x, ray2.y, viewport, w, h)

      const angle1 = angleToPoint(vs.sx, vs.sy, r1s.sx, r1s.sy)
      const angle2 = angleToPoint(vs.sx, vs.sy, r2s.sx, r2s.sy)

      const key = `${spec.vertex}|${spec.ray1End}|${spec.ray2End}`
      const ticks = tickCounts.get(key) ?? 0

      drawArc(ctx, vs.sx, vs.sy, angle1, angle2, color, ticks, radiusPx ?? ARC_RADIUS_PX)
      renderedAngles.add(canonicalAngleKey(spec))
    }
  }

  // ── Dynamic angle arcs (from fact store) ──
  if (!factStore || factStore.angleFacts.length === 0) return

  // Collect all unique angles mentioned in facts
  const allAngles = new Map<string, AngleMeasure>()
  for (const fact of factStore.angleFacts) {
    allAngles.set(angleMeasureKey(fact.left), fact.left)
    allAngles.set(angleMeasureKey(fact.right), fact.right)
  }

  // Group by equivalence class
  const visited = new Set<string>()
  const groups: AngleMeasure[][] = []
  for (const [key, am] of allAngles) {
    if (visited.has(key)) continue
    const eqClass = getEqualAngles(factStore, am)
    const group: AngleMeasure[] = []
    for (const eq of eqClass) {
      const k = angleMeasureKey(eq)
      if (allAngles.has(k) && !visited.has(k)) {
        visited.add(k)
        group.push(eq)
      }
    }
    if (group.length > 0) groups.push(group)
  }

  // Tick numbering starts after static equalAngles pairs
  const tickBase = equalAngles?.length ?? 0
  let dynamicGroupIdx = 0

  for (const group of groups) {
    const color = BYRNE_CYCLE[dynamicGroupIdx % BYRNE_CYCLE.length]
    const tickCount = group.length >= 2 ? tickBase + dynamicGroupIdx + 1 : 0
    dynamicGroupIdx++

    for (const am of group) {
      const canonKey = angleMeasureKey(am)
      if (renderedAngles.has(canonKey)) continue // already drawn by static path

      const vertex = getPoint(state, am.vertex)
      const ray1 = getPoint(state, am.ray1)
      const ray2 = getPoint(state, am.ray2)
      if (!vertex || !ray1 || !ray2) continue

      const vs = toScreen(vertex.x, vertex.y, viewport, w, h)
      const r1s = toScreen(ray1.x, ray1.y, viewport, w, h)
      const r2s = toScreen(ray2.x, ray2.y, viewport, w, h)

      const a1 = angleToPoint(vs.sx, vs.sy, r1s.sx, r1s.sy)
      const a2 = angleToPoint(vs.sx, vs.sy, r2s.sx, r2s.sy)

      drawArc(ctx, vs.sx, vs.sy, a1, a2, color, tickCount, ARC_RADIUS_PX)
      renderedAngles.add(canonKey)
    }
  }
}
