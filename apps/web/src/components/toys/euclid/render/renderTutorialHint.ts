import type {
  TutorialHint,
  ConstructionState,
  EuclidViewportState,
  IntersectionCandidate,
} from '../types'
import { getPoint } from '../engine/constructionState'
import { isCandidateBeyondPoint } from '../engine/intersections'
import { resolveSelector } from '../engine/selectors'
import { worldToScreen2D } from '../../shared/coordinateConversions'

const HINT_COLOR = 'rgba(78, 121, 167,'
const HINT_FILL = `${HINT_COLOR} 0.7)`

function toScreen(wx: number, wy: number, viewport: EuclidViewportState, w: number, h: number) {
  return worldToScreen2D(
    wx,
    wy,
    viewport.center.x,
    viewport.center.y,
    viewport.pixelsPerUnit,
    viewport.pixelsPerUnit,
    w,
    h
  )
}

// ── Individual hint renderers ──────────────────────────────────────

function renderPointHint(ctx: CanvasRenderingContext2D, sx: number, sy: number, time: number) {
  // Pulsing ring
  const pulse = 1 + Math.sin(time * 4) * 0.15
  const ringRadius = 16 * pulse
  const alpha = 0.35 + Math.sin(time * 4) * 0.15
  ctx.beginPath()
  ctx.arc(sx, sy, ringRadius, 0, Math.PI * 2)
  ctx.strokeStyle = `${HINT_COLOR} ${alpha})`
  ctx.lineWidth = 2.5
  ctx.stroke()

  // Bouncing arrow above the point
  const bounce = Math.sin(time * 3) * 5
  const arrowTipY = sy - 28 + bounce
  const arrowBaseY = arrowTipY - 18

  // Shaft
  ctx.beginPath()
  ctx.moveTo(sx, arrowBaseY)
  ctx.lineTo(sx, arrowTipY)
  ctx.strokeStyle = HINT_FILL
  ctx.lineWidth = 2.5
  ctx.stroke()

  // Head (triangle)
  ctx.beginPath()
  ctx.moveTo(sx, arrowTipY + 5)
  ctx.lineTo(sx - 6, arrowTipY - 3)
  ctx.lineTo(sx + 6, arrowTipY - 3)
  ctx.closePath()
  ctx.fillStyle = HINT_FILL
  ctx.fill()
}

function renderArrowHint(
  ctx: CanvasRenderingContext2D,
  fromSx: number,
  fromSy: number,
  toSx: number,
  toSy: number,
  time: number
) {
  const dx = toSx - fromSx
  const dy = toSy - fromSy
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return

  const angle = Math.atan2(dy, dx)

  // Marching-ants dashed line
  ctx.save()
  ctx.beginPath()
  ctx.setLineDash([10, 6])
  ctx.lineDashOffset = -(time * 60) % 16
  ctx.moveTo(fromSx, fromSy)
  ctx.lineTo(toSx, toSy)
  ctx.strokeStyle = `${HINT_COLOR} 0.4)`
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // Arrowhead at destination
  const headLen = 12
  ctx.beginPath()
  ctx.moveTo(toSx, toSy)
  ctx.lineTo(toSx - headLen * Math.cos(angle - 0.4), toSy - headLen * Math.sin(angle - 0.4))
  ctx.lineTo(toSx - headLen * Math.cos(angle + 0.4), toSy - headLen * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fillStyle = HINT_FILL
  ctx.fill()

  // Pulsing ring at destination
  const pulse = 1 + Math.sin(time * 4) * 0.15
  const alpha = 0.35 + Math.sin(time * 4) * 0.15
  ctx.beginPath()
  ctx.arc(toSx, toSy, 16 * pulse, 0, Math.PI * 2)
  ctx.strokeStyle = `${HINT_COLOR} ${alpha})`
  ctx.lineWidth = 2.5
  ctx.stroke()
}

function renderSweepHint(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  screenRadius: number,
  time: number
) {
  // Rotating dashed arc with leading dot — "sweep around"
  const r = screenRadius + 18
  const rotationOffset = time * 1.5
  const arcLen = Math.PI * 1.6 // ~288°

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, rotationOffset, rotationOffset + arcLen)
  ctx.setLineDash([6, 4])
  ctx.lineDashOffset = -(time * 50) % 10
  ctx.strokeStyle = `${HINT_COLOR} 0.3)`
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.setLineDash([])

  // Leading dot at arc end
  const endAngle = rotationOffset + arcLen
  const ex = cx + r * Math.cos(endAngle)
  const ey = cy + r * Math.sin(endAngle)
  ctx.beginPath()
  ctx.arc(ex, ey, 5, 0, Math.PI * 2)
  ctx.fillStyle = `${HINT_COLOR} 0.6)`
  ctx.fill()

  ctx.restore()
}

function renderCandidatesHint(
  ctx: CanvasRenderingContext2D,
  candidates: IntersectionCandidate[],
  viewport: EuclidViewportState,
  w: number,
  h: number,
  time: number
) {
  const pulse = 1 + Math.sin(time * 3) * 0.2
  const alpha = 0.4 + Math.sin(time * 3) * 0.2

  for (const c of candidates) {
    const sc = toScreen(c.x, c.y, viewport, w, h)

    // Pulsing ring
    ctx.beginPath()
    ctx.arc(sc.x, sc.y, 14 * pulse, 0, Math.PI * 2)
    ctx.strokeStyle = `${HINT_COLOR} ${alpha})`
    ctx.lineWidth = 2.5
    ctx.stroke()
  }

  // Bouncing arrow on the first (upper) candidate
  if (candidates.length > 0) {
    // Pick the candidate with higher Y (upper in world, lower screen Y)
    const upper = candidates.reduce((a, b) => (a.y > b.y ? a : b))
    const sc = toScreen(upper.x, upper.y, viewport, w, h)
    renderPointHint(ctx, sc.x, sc.y, time)
  }
}

// ── Main entry point ───────────────────────────────────────────────

export function renderTutorialHint(
  ctx: CanvasRenderingContext2D,
  hint: TutorialHint,
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  candidates: IntersectionCandidate[],
  time: number
): void {
  if (hint.type === 'none') return

  if (hint.type === 'point') {
    const pt = getPoint(state, hint.pointId)
    if (!pt) return
    const sc = toScreen(pt.x, pt.y, viewport, w, h)
    renderPointHint(ctx, sc.x, sc.y, time)
    return
  }

  if (hint.type === 'arrow') {
    const from = getPoint(state, hint.fromId)
    const to = getPoint(state, hint.toId)
    if (!from || !to) return
    const sf = toScreen(from.x, from.y, viewport, w, h)
    const st = toScreen(to.x, to.y, viewport, w, h)
    renderArrowHint(ctx, sf.x, sf.y, st.x, st.y, time)
    return
  }

  if (hint.type === 'sweep') {
    const center = getPoint(state, hint.centerId)
    const radiusPt = getPoint(state, hint.radiusPointId)
    if (!center || !radiusPt) return
    const sc = toScreen(center.x, center.y, viewport, w, h)
    const dx = radiusPt.x - center.x
    const dy = radiusPt.y - center.y
    const worldRadius = Math.sqrt(dx * dx + dy * dy)
    const screenRadius = worldRadius * viewport.pixelsPerUnit
    renderSweepHint(ctx, sc.x, sc.y, screenRadius, time)
    return
  }

  if (hint.type === 'candidates') {
    // Filter candidates by ofA/ofB when specified (resolve selectors to element IDs)
    let filtered: IntersectionCandidate[]
    if (hint.ofA != null && hint.ofB != null) {
      const resolvedA = resolveSelector(hint.ofA, state)
      const resolvedB = resolveSelector(hint.ofB, state)
      if (!resolvedA || !resolvedB) return
      filtered = candidates.filter(
        (c) =>
          (c.ofA === resolvedA && c.ofB === resolvedB) ||
          (c.ofA === resolvedB && c.ofB === resolvedA)
      )
    } else {
      filtered = candidates
    }
    // Further filter by beyondId when specified (e.g. "beyond B on segment DB")
    if (hint.beyondId) {
      filtered = filtered.filter((c) =>
        isCandidateBeyondPoint(c, hint.beyondId!, c.ofA, c.ofB, state)
      )
    }
    // In guided mode, only show one candidate to avoid confusing the student.
    // Pick the one with the highest Y (convention matching the arrow target).
    if (filtered.length > 1) {
      const preferred = filtered.reduce((a, b) => (a.y > b.y ? a : b))
      filtered = [preferred]
    }
    renderCandidatesHint(ctx, filtered, viewport, w, h, time)
    return
  }
}
