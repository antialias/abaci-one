/**
 * Render a golden glow highlight on construction elements
 * referenced by the chat hover state.
 */

import type { ConstructionState, EuclidViewportState } from '../types'
import type { GeometricEntityRef } from '../chat/parseGeometricEntities'
import { getAllPoints } from '../engine/constructionState'
import { worldToScreen2D } from '../../shared/coordinateConversions'

const GLOW_COLOR = 'rgba(255, 191, 0, 0.55)'
const GLOW_LINE_WIDTH = 6
const POINT_GLOW_RADIUS = 12
const ANGLE_ARC_RADIUS_PX = 28

function toScreen(
  wx: number, wy: number,
  vp: EuclidViewportState, w: number, h: number,
) {
  return worldToScreen2D(
    wx, wy, vp.center.x, vp.center.y,
    vp.pixelsPerUnit, vp.pixelsPerUnit, w, h,
  )
}

/** Resolve a point label ("A") to its world coordinates, or null. */
function resolvePoint(
  state: ConstructionState,
  label: string,
): { x: number; y: number } | null {
  const points = getAllPoints(state)
  return points.find((p) => p.label === label) ?? null
}

/** Draw a glowing line between two world points. */
function drawGlowLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  vp: EuclidViewportState, w: number, h: number,
) {
  const s1 = toScreen(x1, y1, vp, w, h)
  const s2 = toScreen(x2, y2, vp, w, h)
  ctx.beginPath()
  ctx.moveTo(s1.x, s1.y)
  ctx.lineTo(s2.x, s2.y)
  ctx.strokeStyle = GLOW_COLOR
  ctx.lineWidth = GLOW_LINE_WIDTH
  ctx.lineCap = 'round'
  ctx.stroke()
}

/** Draw a glowing circle at a world point. */
function drawGlowPoint(
  ctx: CanvasRenderingContext2D,
  wx: number, wy: number,
  vp: EuclidViewportState, w: number, h: number,
) {
  const s = toScreen(wx, wy, vp, w, h)
  ctx.beginPath()
  ctx.arc(s.x, s.y, POINT_GLOW_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = GLOW_COLOR
  ctx.fill()
}

/** Highlight a segment between two labeled points. */
function highlightSegment(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  from: string, to: string,
  vp: EuclidViewportState, w: number, h: number,
) {
  const pA = resolvePoint(state, from)
  const pB = resolvePoint(state, to)
  if (!pA || !pB) return
  drawGlowLine(ctx, pA.x, pA.y, pB.x, pB.y, vp, w, h)
  drawGlowPoint(ctx, pA.x, pA.y, vp, w, h)
  drawGlowPoint(ctx, pB.x, pB.y, vp, w, h)
}

/** Highlight an angle arc at vertex (middle point of [A, B, C]). */
function highlightAngle(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  points: [string, string, string],
  vp: EuclidViewportState, w: number, h: number,
) {
  const pA = resolvePoint(state, points[0])
  const pB = resolvePoint(state, points[1]) // vertex
  const pC = resolvePoint(state, points[2])
  if (!pA || !pB || !pC) return

  const sB = toScreen(pB.x, pB.y, vp, w, h)

  // Draw glow on the two rays
  drawGlowLine(ctx, pB.x, pB.y, pA.x, pA.y, vp, w, h)
  drawGlowLine(ctx, pB.x, pB.y, pC.x, pC.y, vp, w, h)

  // Draw angle arc at vertex
  // Compute angles in screen space (Y is flipped)
  const sA = toScreen(pA.x, pA.y, vp, w, h)
  const sC = toScreen(pC.x, pC.y, vp, w, h)
  const startAngle = Math.atan2(sA.y - sB.y, sA.x - sB.x)
  const endAngle = Math.atan2(sC.y - sB.y, sC.x - sB.x)

  // Draw arc (shorter of the two possible arcs)
  ctx.beginPath()
  let diff = endAngle - startAngle
  if (diff > Math.PI) diff -= 2 * Math.PI
  if (diff < -Math.PI) diff += 2 * Math.PI
  ctx.arc(sB.x, sB.y, ANGLE_ARC_RADIUS_PX, startAngle, startAngle + diff, diff < 0)
  ctx.strokeStyle = GLOW_COLOR
  ctx.lineWidth = 3
  ctx.stroke()

  // Vertex glow
  drawGlowPoint(ctx, pB.x, pB.y, vp, w, h)
}

export function renderChatHighlight(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  highlight: GeometricEntityRef,
  viewport: EuclidViewportState,
  canvasW: number,
  canvasH: number,
): void {
  ctx.save()

  switch (highlight.type) {
    case 'point': {
      const pt = resolvePoint(state, highlight.label)
      if (pt) drawGlowPoint(ctx, pt.x, pt.y, viewport, canvasW, canvasH)
      break
    }

    case 'segment':
      highlightSegment(ctx, state, highlight.from, highlight.to, viewport, canvasW, canvasH)
      break

    case 'triangle':
      highlightSegment(ctx, state, highlight.vertices[0], highlight.vertices[1], viewport, canvasW, canvasH)
      highlightSegment(ctx, state, highlight.vertices[1], highlight.vertices[2], viewport, canvasW, canvasH)
      highlightSegment(ctx, state, highlight.vertices[2], highlight.vertices[0], viewport, canvasW, canvasH)
      break

    case 'angle':
      highlightAngle(ctx, state, highlight.points, viewport, canvasW, canvasH)
      break
  }

  ctx.restore()
}
