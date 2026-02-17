import type {
  ConstructionState,
  EuclidViewportState,
  CompassPhase,
  StraightedgePhase,
  IntersectionCandidate,
} from '../types'
import { BYRNE, BYRNE_CYCLE } from '../types'
import { getAllPoints, getAllCircles, getAllSegments, getPoint, getRadius } from '../engine/constructionState'
import { isCandidateBeyondPoint } from '../engine/intersections'
import { worldToScreen2D } from '../../shared/coordinateConversions'

const BG_COLOR = '#FAFAF0'
const POINT_RADIUS = 5
const SNAP_RING_RADIUS = 8
const LABEL_FONT = '14px system-ui, sans-serif'
const LABEL_OFFSET_X = 10
const LABEL_OFFSET_Y = -10
const CANDIDATE_RADIUS = 4
const CANDIDATE_COLOR_ACTIVE = 'rgba(120, 120, 120, 0.5)'
const CANDIDATE_COLOR_DIM = 'rgba(120, 120, 120, 0.15)'
const RESULT_COLOR = '#10b981' // matches completion banner green

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

export function renderConstruction(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  compassPhase: CompassPhase,
  straightedgePhase: StraightedgePhase,
  pointerWorld: { x: number; y: number } | null,
  snappedPointId: string | null,
  candidates: IntersectionCandidate[],
  nextColorIndex: number,
  candidateFilter?: { ofA: string; ofB: string; beyondId?: string } | null,
  isComplete?: boolean,
  resultSegments?: Array<{ fromId: string; toId: string }>,
  hiddenElementIds?: Set<string>,
) {
  const ppu = viewport.pixelsPerUnit

  // 1. Background
  ctx.fillStyle = BG_COLOR
  ctx.fillRect(0, 0, w, h)

  // 2. Completed circles
  for (const circle of getAllCircles(state)) {
    if (hiddenElementIds?.has(circle.id)) continue
    const center = getPoint(state, circle.centerId)
    if (!center) continue
    const r = getRadius(state, circle.id)
    if (r <= 0) continue
    const sc = toScreen(center.x, center.y, viewport, w, h)
    const sr = r * ppu

    ctx.beginPath()
    ctx.arc(sc.x, sc.y, sr, 0, Math.PI * 2)
    ctx.strokeStyle = circle.color
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // 3. Completed segments
  for (const seg of getAllSegments(state)) {
    if (hiddenElementIds?.has(seg.id)) continue
    const from = getPoint(state, seg.fromId)
    const to = getPoint(state, seg.toId)
    if (!from || !to) continue
    const sf = toScreen(from.x, from.y, viewport, w, h)
    const st = toScreen(to.x, to.y, viewport, w, h)

    ctx.beginPath()
    ctx.moveTo(sf.x, sf.y)
    ctx.lineTo(st.x, st.y)
    ctx.strokeStyle = seg.color
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // 4. Intersection candidates — active ones prominent, others dimmed
  for (const c of candidates) {
    const sc = toScreen(c.x, c.y, viewport, w, h)

    let color = CANDIDATE_COLOR_ACTIVE
    if (isComplete) {
      color = CANDIDATE_COLOR_DIM
    } else if (candidateFilter && candidateFilter.ofA && candidateFilter.ofB) {
      const matchesElements =
        (c.ofA === candidateFilter.ofA && c.ofB === candidateFilter.ofB) ||
        (c.ofA === candidateFilter.ofB && c.ofB === candidateFilter.ofA)
      let isPreferred = true
      if (matchesElements && candidateFilter.beyondId) {
        isPreferred = isCandidateBeyondPoint(c, candidateFilter.beyondId, c.ofA, c.ofB, state)
      } else if (matchesElements && !candidateFilter.beyondId) {
        // When multiple candidates match with no beyondId (e.g. circle-circle),
        // only highlight the one with the highest Y (matches tutorial arrow convention)
        const hasHigherMatch = candidates.some(other =>
          other !== c &&
          ((other.ofA === candidateFilter.ofA && other.ofB === candidateFilter.ofB) ||
           (other.ofA === candidateFilter.ofB && other.ofB === candidateFilter.ofA)) &&
          other.y > c.y,
        )
        if (hasHigherMatch) isPreferred = false
      }
      color = (matchesElements && isPreferred) ? CANDIDATE_COLOR_ACTIVE : CANDIDATE_COLOR_DIM
    }

    ctx.beginPath()
    ctx.arc(sc.x, sc.y, CANDIDATE_RADIUS, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  // 5. Active tool previews
  const nextColor = BYRNE_CYCLE[nextColorIndex % BYRNE_CYCLE.length]

  // Compass previews
  if (compassPhase.tag === 'center-set' && pointerWorld) {
    const center = getPoint(state, compassPhase.centerId)
    if (center) {
      const sc = toScreen(center.x, center.y, viewport, w, h)
      const sp = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)

      // Dashed line center → pointer
      ctx.beginPath()
      ctx.setLineDash([6, 4])
      ctx.moveTo(sc.x, sc.y)
      ctx.lineTo(sp.x, sp.y)
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])

      // Faint circle at current radius
      const dx = pointerWorld.x - center.x
      const dy = pointerWorld.y - center.y
      const r = Math.sqrt(dx * dx + dy * dy) * ppu
      if (r > 1) {
        ctx.beginPath()
        ctx.arc(sc.x, sc.y, r, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  }

  if (compassPhase.tag === 'radius-set' && pointerWorld) {
    const center = getPoint(state, compassPhase.centerId)
    if (center) {
      const sc = toScreen(center.x, center.y, viewport, w, h)
      const sr = compassPhase.radius * ppu

      // Faint guide ring
      ctx.beginPath()
      ctx.arc(sc.x, sc.y, sr, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.15)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Line center → pointer
      const sp = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)
      ctx.beginPath()
      ctx.moveTo(sc.x, sc.y)
      ctx.lineTo(sp.x, sp.y)
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  if (compassPhase.tag === 'sweeping') {
    const center = getPoint(state, compassPhase.centerId)
    if (center) {
      const sc = toScreen(center.x, center.y, viewport, w, h)
      const sr = compassPhase.radius * ppu

      // Faint guide ring
      ctx.beginPath()
      ctx.arc(sc.x, sc.y, sr, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.12)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Arc from startAngle through cumulativeSweep
      // Y-inversion: negate angles for screen rendering
      const screenStartAngle = -compassPhase.startAngle
      const screenEndAngle = -(compassPhase.startAngle + compassPhase.cumulativeSweep)
      const counterclockwise = compassPhase.cumulativeSweep > 0

      ctx.beginPath()
      ctx.arc(sc.x, sc.y, sr, screenStartAngle, screenEndAngle, counterclockwise)
      ctx.strokeStyle = nextColor
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Thin line from center to current pointer angle
      if (pointerWorld) {
        const sp = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)
        ctx.beginPath()
        ctx.moveTo(sc.x, sc.y)
        ctx.lineTo(sp.x, sp.y)
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }
  }

  // Straightedge preview
  if (straightedgePhase.tag === 'from-set' && pointerWorld) {
    const from = getPoint(state, straightedgePhase.fromId)
    if (from) {
      const sf = toScreen(from.x, from.y, viewport, w, h)
      const sp = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)

      // Extend line to viewport edges
      const dx = sp.x - sf.x
      const dy = sp.y - sf.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > 0.1) {
        const extend = Math.max(w, h) * 2
        const nx = dx / len
        const ny = dy / len

        ctx.beginPath()
        ctx.moveTo(sf.x - nx * extend, sf.y - ny * extend)
        ctx.lineTo(sf.x + nx * extend, sf.y + ny * extend)
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.15)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Actual segment preview
      ctx.beginPath()
      ctx.moveTo(sf.x, sf.y)
      ctx.lineTo(sp.x, sp.y)
      ctx.strokeStyle = nextColor
      ctx.lineWidth = 2
      ctx.setLineDash([8, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // 6. Marked points — filled circles with labels
  for (const pt of getAllPoints(state)) {
    if (hiddenElementIds?.has(pt.id)) continue
    const sp = toScreen(pt.x, pt.y, viewport, w, h)

    ctx.beginPath()
    ctx.arc(sp.x, sp.y, POINT_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = pt.color || BYRNE.given
    ctx.fill()

    // Label
    ctx.font = LABEL_FONT
    ctx.fillStyle = pt.color || BYRNE.given
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText(pt.label, sp.x + LABEL_OFFSET_X, sp.y + LABEL_OFFSET_Y)
  }

  // 7. Snap highlight — larger ring around nearest point
  if (snappedPointId) {
    const pt = getPoint(state, snappedPointId)
    if (pt) {
      const sp = toScreen(pt.x, pt.y, viewport, w, h)
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, SNAP_RING_RADIUS, 0, Math.PI * 2)
      ctx.strokeStyle = pt.color || BYRNE.given
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  // 8. Result highlight — glowing segments on completion
  if (isComplete && resultSegments) {
    for (const seg of resultSegments) {
      const from = getPoint(state, seg.fromId)
      const to = getPoint(state, seg.toId)
      if (!from || !to) continue
      const sf = toScreen(from.x, from.y, viewport, w, h)
      const st = toScreen(to.x, to.y, viewport, w, h)

      // Glow layer
      ctx.beginPath()
      ctx.moveTo(sf.x, sf.y)
      ctx.lineTo(st.x, st.y)
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)'
      ctx.lineWidth = 10
      ctx.lineCap = 'round'
      ctx.stroke()

      // Core line
      ctx.beginPath()
      ctx.moveTo(sf.x, sf.y)
      ctx.lineTo(st.x, st.y)
      ctx.strokeStyle = RESULT_COLOR
      ctx.lineWidth = 3.5
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    // Highlight the result endpoints
    for (const seg of resultSegments) {
      for (const ptId of [seg.fromId, seg.toId]) {
        const pt = getPoint(state, ptId)
        if (!pt) continue
        const sp = toScreen(pt.x, pt.y, viewport, w, h)

        // Glow ring
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, POINT_RADIUS + 5, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)'
        ctx.lineWidth = 3
        ctx.stroke()

        // Point fill
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, POINT_RADIUS + 1, 0, Math.PI * 2)
        ctx.fillStyle = RESULT_COLOR
        ctx.fill()
      }
    }
  }
}
