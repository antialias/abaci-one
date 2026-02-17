import type {
  ConstructionState,
  EuclidViewportState,
  RulerPhase,
  Measurement,
} from '../types'
import { getPoint } from '../engine/constructionState'
import { worldToScreen2D } from '../../shared/coordinateConversions'

const TEAL = '#5b8a8a'
const TEAL_HIGHLIGHT = '#3a7a7a'
const DASH_PATTERN: [number, number] = [6, 3]
const LINE_WIDTH = 1.5
const WHISKER_LENGTH = 8
const TICK_LENGTH = 6   // px each side of the dimension line
const TICK_SPACING = 4  // px between parallel tick marks
const EQUALITY_EPSILON = 0.001  // absolute tolerance for distance comparison

function toScreen(
  wx: number,
  wy: number,
  viewport: EuclidViewportState,
  w: number,
  h: number,
) {
  return worldToScreen2D(
    wx, wy,
    viewport.center.x, viewport.center.y,
    viewport.pixelsPerUnit, viewport.pixelsPerUnit,
    w, h,
  )
}

function distancesEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EQUALITY_EPSILON
}

/** Assign a tick-group number (1-based) to each measurement. Equal distances share a group. */
function assignTickGroups(measurements: Measurement[]): number[] {
  const groups: number[][] = []
  const result: number[] = []

  for (let i = 0; i < measurements.length; i++) {
    let foundGroup = -1
    for (let g = 0; g < groups.length; g++) {
      if (distancesEqual(measurements[i].distance, measurements[groups[g][0]].distance)) {
        foundGroup = g
        break
      }
    }
    if (foundGroup >= 0) {
      groups[foundGroup].push(i)
      result.push(foundGroup + 1)
    } else {
      groups.push([i])
      result.push(groups.length)
    }
  }

  return result
}

/** Find the tick group a distance belongs to, or 0 if no match. */
function findMatchingGroup(
  distance: number,
  measurements: Measurement[],
  tickGroups: number[],
): number {
  for (let i = 0; i < measurements.length; i++) {
    if (distancesEqual(distance, measurements[i].distance)) {
      return tickGroups[i]
    }
  }
  return 0
}

/** Draw perpendicular tick marks at the midpoint of a dimension line. */
function drawTickMarks(
  ctx: CanvasRenderingContext2D,
  mx: number, my: number,
  perpX: number, perpY: number,
  dirX: number, dirY: number,
  tickCount: number,
  color: string,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5

  const totalWidth = (tickCount - 1) * TICK_SPACING
  const startOffset = -totalWidth / 2

  for (let t = 0; t < tickCount; t++) {
    const offset = startOffset + t * TICK_SPACING
    const cx = mx + dirX * offset
    const cy = my + dirY * offset

    ctx.beginPath()
    ctx.moveTo(cx + perpX * TICK_LENGTH, cy + perpY * TICK_LENGTH)
    ctx.lineTo(cx - perpX * TICK_LENGTH, cy - perpY * TICK_LENGTH)
    ctx.stroke()
  }
}

function drawDimensionLine(
  ctx: CanvasRenderingContext2D,
  ax: number, ay: number,
  bx: number, by: number,
  tickCount: number,
  alpha: number,
  drawWhiskers: boolean,
  highlight: boolean,
) {
  const segDx = bx - ax
  const segDy = by - ay
  const len = Math.sqrt(segDx * segDx + segDy * segDy)
  if (len < 0.5) return

  // Direction unit vector along the line
  const dirX = segDx / len
  const dirY = segDy / len

  // Perpendicular — pick the direction pointing more "up" on screen (lower Y)
  const pAx = -dirY, pAy = dirX
  const pBx = dirY, pBy = -dirX
  const perpX = pAy < pBy ? pAx : pBx
  const perpY = pAy < pBy ? pAy : pBy

  const color = highlight ? TEAL_HIGHLIGHT : TEAL
  const lw = highlight ? 2 : LINE_WIDTH

  ctx.save()
  ctx.globalAlpha = alpha

  // Dashed line between points
  ctx.beginPath()
  ctx.setLineDash([...DASH_PATTERN])
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.strokeStyle = color
  ctx.lineWidth = lw
  ctx.stroke()
  ctx.setLineDash([])

  // Whiskers at endpoints
  if (drawWhiskers) {
    for (const [px, py] of [[ax, ay], [bx, by]] as const) {
      ctx.beginPath()
      ctx.moveTo(px + perpX * WHISKER_LENGTH, py + perpY * WHISKER_LENGTH)
      ctx.lineTo(px - perpX * WHISKER_LENGTH, py - perpY * WHISKER_LENGTH)
      ctx.strokeStyle = color
      ctx.lineWidth = lw
      ctx.stroke()
    }
  }

  // Tick marks at midpoint
  if (tickCount > 0) {
    const mx = (ax + bx) / 2
    const my = (ay + by) / 2
    drawTickMarks(ctx, mx, my, perpX, perpY, dirX, dirY, tickCount, color)
  }

  ctx.restore()
}

export function renderMeasurements(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  measurements: Measurement[],
  rulerPhase: RulerPhase,
  snappedPointId: string | null,
  pointerWorld: { x: number; y: number } | null,
) {
  if (measurements.length === 0 && rulerPhase.tag === 'idle') return

  const tickGroups = assignTickGroups(measurements)

  // Check if the live preview matches an existing group
  let previewMatchGroup = 0
  if (rulerPhase.tag === 'from-set' && snappedPointId && snappedPointId !== rulerPhase.fromId) {
    const from = getPoint(state, rulerPhase.fromId)
    const to = getPoint(state, snappedPointId)
    if (from && to) {
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 0.01) {
        previewMatchGroup = findMatchingGroup(dist, measurements, tickGroups)
      }
    }
  }

  // Committed measurements
  for (let i = 0; i < measurements.length; i++) {
    const m = measurements[i]
    const from = getPoint(state, m.fromId)
    const to = getPoint(state, m.toId)
    if (!from || !to) continue

    const sf = toScreen(from.x, from.y, viewport, w, h)
    const st = toScreen(to.x, to.y, viewport, w, h)

    const isMatch = previewMatchGroup > 0 && tickGroups[i] === previewMatchGroup

    drawDimensionLine(
      ctx,
      sf.x, sf.y,
      st.x, st.y,
      tickGroups[i],
      1.0,
      true,
      isMatch,
    )
  }

  // Live preview
  if (rulerPhase.tag === 'from-set' && pointerWorld) {
    const from = getPoint(state, rulerPhase.fromId)
    if (from) {
      const sf = toScreen(from.x, from.y, viewport, w, h)

      if (snappedPointId && snappedPointId !== rulerPhase.fromId) {
        const to = getPoint(state, snappedPointId)
        if (to) {
          const st = toScreen(to.x, to.y, viewport, w, h)
          // Show matching tick count if it matches, otherwise no ticks yet
          drawDimensionLine(
            ctx,
            sf.x, sf.y,
            st.x, st.y,
            previewMatchGroup,
            0.5,
            false,
            false,
          )
          return
        }
      }

      // Not snapped — plain line, no ticks
      const sp = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)
      drawDimensionLine(
        ctx,
        sf.x, sf.y,
        sp.x, sp.y,
        0,
        0.5,
        false,
        false,
      )
    }
  }
}
