import type {
  ConstructionState,
  EuclidViewportState,
  CompassPhase,
  StraightedgePhase,
  IntersectionCandidate,
} from '../types'
import { BYRNE } from '../types'
import {
  getAllPoints,
  getAllCircles,
  getAllSegments,
  getPoint,
  getRadius,
} from '../engine/constructionState'
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
  transparentBg?: boolean,
  draggablePointIds?: string[]
) {
  const ppu = viewport.pixelsPerUnit

  // 1. Background
  if (transparentBg) {
    ctx.clearRect(0, 0, w, h)
  } else {
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, w, h)
  }

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
        const hasHigherMatch = candidates.some(
          (other) =>
            other !== c &&
            ((other.ofA === candidateFilter.ofA && other.ofB === candidateFilter.ofB) ||
              (other.ofA === candidateFilter.ofB && other.ofB === candidateFilter.ofA)) &&
            other.y > c.y
        )
        if (hasHigherMatch) isPreferred = false
      }
      color = matchesElements && isPreferred ? CANDIDATE_COLOR_ACTIVE : CANDIDATE_COLOR_DIM
    }

    ctx.beginPath()
    ctx.arc(sc.x, sc.y, CANDIDATE_RADIUS, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  // 5. (Active tool previews moved to renderToolOverlay.ts)

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

  // 6b. Draggable point ripple rings (post-completion invitation to interact)
  if (isComplete && draggablePointIds && draggablePointIds.length > 0) {
    const time = performance.now() / 1000
    const RIPPLE_PERIOD = 2.5 // seconds per full ripple cycle
    const RIPPLE_COUNT = 2 // concurrent expanding rings per point
    const RIPPLE_MAX_RADIUS = 22 // max ring radius (screen px)
    const STAGGER_PER_POINT = 0.3 // seconds offset between points

    for (let ptIdx = 0; ptIdx < draggablePointIds.length; ptIdx++) {
      const ptId = draggablePointIds[ptIdx]
      const pt = getPoint(state, ptId)
      if (!pt) continue
      if (hiddenElementIds?.has(ptId)) continue
      const sp = toScreen(pt.x, pt.y, viewport, w, h)

      for (let ring = 0; ring < RIPPLE_COUNT; ring++) {
        // Stagger rings within a point + stagger between points
        const offset = ring / RIPPLE_COUNT + (ptIdx * STAGGER_PER_POINT) / RIPPLE_PERIOD
        const t = (time / RIPPLE_PERIOD + offset) % 1 // 0→1 phase
        const radius = POINT_RADIUS + t * RIPPLE_MAX_RADIUS
        // Fade out as ring expands: bright at birth, gone at max radius
        const alpha = 0.5 * (1 - t)

        ctx.beginPath()
        ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(78, 121, 167, ${alpha})`
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
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

/**
 * Render a "drag the points" invitation text on the canvas post-completion.
 * Fades in after a delay, lingers, then fades to a subtle level.
 *
 * @param completionTime - performance.now() when completion first happened
 * @returns true if still animating (needs next frame)
 */
export function renderDragInvitation(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  completionTime: number
): boolean {
  const now = performance.now()
  const elapsed = now - completionTime

  // Timeline: 1.5s delay → 0.6s fade in → 3s hold → 1s fade to residual
  const DELAY = 1500
  const FADE_IN = 600
  const HOLD = 3000
  const FADE_OUT = 1000
  const RESIDUAL_ALPHA = 0.15 // stays faintly visible forever

  if (elapsed < DELAY) return true // still waiting

  let alpha: number
  const t = elapsed - DELAY

  if (t < FADE_IN) {
    // Fading in
    alpha = (t / FADE_IN) * 0.85
  } else if (t < FADE_IN + HOLD) {
    // Holding
    alpha = 0.85
  } else if (t < FADE_IN + HOLD + FADE_OUT) {
    // Fading to residual
    const ft = (t - FADE_IN - HOLD) / FADE_OUT
    alpha = 0.85 - (0.85 - RESIDUAL_ALPHA) * ft
  } else {
    alpha = RESIDUAL_ALPHA
  }

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = '600 15px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = '#4E79A7'
  ctx.fillText('Drag the points!', w / 2, h - 80)
  ctx.restore()

  return t < FADE_IN + HOLD + FADE_OUT // still animating?
}
