/**
 * Influence highlight: shows which given (input) point most affects a
 * derived point currently under the pointer. Used by the move tool to
 * make the construction's dependency structure visible on hover.
 *
 * Visual: dashed line from the derived point to the given, pulsing rings
 * + soft glow on the given, a diamond marker on the derived, and a small
 * arrow showing where dragging would push the given. Smooth fade-in/out.
 */

import type { ConstructionState, EuclidViewportState } from '../types'
import { getPoint } from '../engine/constructionState'
import { worldToScreen2D } from '../../shared/coordinateConversions'
import { constrainedDragStep } from '../engine/jacobianInfluence'

// ── Visual constants ──
const HIGHLIGHT_COLOR = '#4E79A7' // Byrne blue
const LINE_COLOR = 'rgba(78, 121, 167, 0.35)'
const OUTER_RING_RADIUS = 20
const INNER_RING_RADIUS = 14
const GLOW_RADIUS = 28
const OUTER_RING_WIDTH = 2
const INNER_RING_WIDTH = 3
const DASH_PATTERN: [number, number] = [6, 4]
const FADE_DURATION_MS = 200
const PREVIEW_ARROW_COLOR = HIGHLIGHT_COLOR
const PREVIEW_ARROW_SCALE = 40 // pixels per unit of Jacobian response
const PREVIEW_ARROW_MAX_LEN = 60 // max arrow length in pixels
const PREVIEW_ARROW_HEAD = 8 // arrowhead size
const PREVIEW_ARROW_FADE_START = 15 // screen px from derived: arrow fully visible beyond this
const PREVIEW_ARROW_FADE_END = 5 // screen px from derived: arrow fully hidden below this
const TENSION_START_RADIUS = 40 // screen px: tension visuals begin
const BREAK_FREE_RADIUS = 250 // screen px: constraint snaps
const TENSION_DAMPEN = 0.95 // at max tension, cursor influence reduced to 1 - this
const TRAIL_MAX_POINTS = 20

// ── State ──

/** Persistent state for smooth highlight transitions across frames. */
export interface InfluenceHighlightState {
  opacity: number
  targetOpacity: number
  derivedPointId: string | null
  givenPointId: string | null
  fadeStartTime: number
  fadeStartOpacity: number
  /** Sub-Jacobian for the most influential given point: [∂tx/∂gx, ∂tx/∂gy, ∂ty/∂gx, ∂ty/∂gy] */
  subJacobian: [number, number, number, number] | null
  /** 0..1 tension during constrained drag (0 = relaxed, 1 = about to break) */
  tension: number
  /** Cursor screen position during constrained drag (for rubber band line) */
  cursorScreen: { x: number; y: number } | null
}

export function createInfluenceHighlightState(): InfluenceHighlightState {
  return {
    opacity: 0,
    targetOpacity: 0,
    derivedPointId: null,
    givenPointId: null,
    fadeStartTime: 0,
    fadeStartOpacity: 0,
    subJacobian: null,
    tension: 0,
    cursorScreen: null,
  }
}

/** Visual flash when the constraint breaks free during a drag. */
export interface BreakFreeFlash {
  startTime: number
  /** Screen position of the influential given point at the moment of break */
  givenScreen: { x: number; y: number }
  /** Screen position of the derived point at the moment of break */
  derivedScreen: { x: number; y: number }
}

/** Motion trail state: ring buffer of recent positions for each tracked point. */
export interface MotionTrailState {
  /** Point ID being trailed */
  pointId: string | null
  /** Ring buffer of recent screen positions */
  positions: Array<{ x: number; y: number }>
  /** Write index into the ring buffer */
  writeIdx: number
  /** Number of valid entries */
  count: number
  /** Fade-out opacity (1 while dragging, decays after release) */
  opacity: number
}

export function createMotionTrailState(): MotionTrailState {
  return {
    pointId: null,
    positions: new Array(TRAIL_MAX_POINTS).fill({ x: 0, y: 0 }),
    writeIdx: 0,
    count: 0,
    opacity: 0,
  }
}

/** Record a new position in the trail. Call each drag frame. */
export function recordTrailPosition(
  trail: MotionTrailState,
  pointId: string,
  screenX: number,
  screenY: number
): void {
  if (trail.pointId !== pointId) {
    // New drag target — reset
    trail.pointId = pointId
    trail.count = 0
    trail.writeIdx = 0
  }
  trail.positions[trail.writeIdx] = { x: screenX, y: screenY }
  trail.writeIdx = (trail.writeIdx + 1) % TRAIL_MAX_POINTS
  if (trail.count < TRAIL_MAX_POINTS) trail.count++
  trail.opacity = 1
}

/** Call when drag ends to begin fade-out. */
export function clearTrail(trail: MotionTrailState): void {
  trail.pointId = null
  trail.count = 0
  trail.writeIdx = 0
  trail.opacity = 0
}

/** Exported tension thresholds for use by the drag handler. */
export { TENSION_START_RADIUS, BREAK_FREE_RADIUS, TENSION_DAMPEN }

// ── Highlight target update ──

/**
 * Update the highlight target. Triggers fade-in when given a (derived, given)
 * pair, fade-out when either is null. Idempotent if the target hasn't changed.
 */
export function updateInfluenceTarget(
  state: InfluenceHighlightState,
  derivedPointId: string | null,
  givenPointId: string | null,
  now: number
): void {
  const hasTarget = derivedPointId != null && givenPointId != null

  if (hasTarget) {
    state.derivedPointId = derivedPointId
    state.givenPointId = givenPointId
    if (state.targetOpacity !== 1) {
      state.targetOpacity = 1
      state.fadeStartTime = now
      state.fadeStartOpacity = state.opacity
    }
  } else {
    if (state.targetOpacity !== 0) {
      state.targetOpacity = 0
      state.fadeStartTime = now
      state.fadeStartOpacity = state.opacity
    }
  }
}

// ── Helpers ──

function toScreen(wx: number, wy: number, vp: EuclidViewportState, w: number, h: number) {
  return worldToScreen2D(wx, wy, vp.center.x, vp.center.y, vp.pixelsPerUnit, vp.pixelsPerUnit, w, h)
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  angle: number,
  size: number
): void {
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(
    tipX - size * Math.cos(angle - Math.PI / 6),
    tipY - size * Math.sin(angle - Math.PI / 6)
  )
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(
    tipX - size * Math.cos(angle + Math.PI / 6),
    tipY - size * Math.sin(angle + Math.PI / 6)
  )
  ctx.stroke()
}

// ── Main render ──

/**
 * @returns true if still animating (caller should request another frame)
 */
export function renderInfluenceHighlight(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  highlightState: InfluenceHighlightState,
  time: number,
  pointerWorld: { x: number; y: number } | null
): boolean {
  const now = time * 1000

  // Animate opacity toward target
  if (highlightState.opacity !== highlightState.targetOpacity) {
    const elapsed = now - highlightState.fadeStartTime
    const t = Math.min(1, elapsed / FADE_DURATION_MS)
    const eased = easeOutCubic(t)
    highlightState.opacity =
      highlightState.fadeStartOpacity +
      (highlightState.targetOpacity - highlightState.fadeStartOpacity) * eased
    if (t >= 1) {
      highlightState.opacity = highlightState.targetOpacity
      if (highlightState.targetOpacity === 0) {
        highlightState.derivedPointId = null
        highlightState.givenPointId = null
        highlightState.subJacobian = null
      }
    }
  }

  if (highlightState.opacity <= 0.001) return false
  if (!highlightState.derivedPointId || !highlightState.givenPointId) return false

  const derivedPt = getPoint(state, highlightState.derivedPointId)
  const givenPt = getPoint(state, highlightState.givenPointId)
  if (!derivedPt || !givenPt) return false

  const derivedScreen = toScreen(derivedPt.x, derivedPt.y, viewport, w, h)
  const givenScreen = toScreen(givenPt.x, givenPt.y, viewport, w, h)

  const alpha = highlightState.opacity
  const pulse = 0.75 + 0.25 * Math.sin(time * 3.5)

  ctx.save()

  // ── Connecting dashed line ──
  ctx.beginPath()
  ctx.setLineDash(DASH_PATTERN)
  ctx.moveTo(derivedScreen.x, derivedScreen.y)
  ctx.lineTo(givenScreen.x, givenScreen.y)
  ctx.strokeStyle = LINE_COLOR
  ctx.lineWidth = 1.5
  ctx.globalAlpha = alpha * 0.8
  ctx.stroke()
  ctx.setLineDash([])

  // ── Soft glow ──
  const gradient = ctx.createRadialGradient(
    givenScreen.x,
    givenScreen.y,
    0,
    givenScreen.x,
    givenScreen.y,
    GLOW_RADIUS * pulse
  )
  gradient.addColorStop(0, 'rgba(78, 121, 167, 0.4)')
  gradient.addColorStop(0.5, 'rgba(78, 121, 167, 0.15)')
  gradient.addColorStop(1, 'rgba(78, 121, 167, 0)')
  ctx.beginPath()
  ctx.arc(givenScreen.x, givenScreen.y, GLOW_RADIUS * pulse, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.globalAlpha = alpha
  ctx.fill()

  // ── Outer ring ──
  ctx.beginPath()
  ctx.arc(givenScreen.x, givenScreen.y, OUTER_RING_RADIUS, 0, Math.PI * 2)
  ctx.strokeStyle = HIGHLIGHT_COLOR
  ctx.lineWidth = OUTER_RING_WIDTH
  ctx.globalAlpha = alpha * 0.4 * pulse
  ctx.stroke()

  // ── Inner ring ──
  ctx.beginPath()
  ctx.arc(givenScreen.x, givenScreen.y, INNER_RING_RADIUS, 0, Math.PI * 2)
  ctx.strokeStyle = HIGHLIGHT_COLOR
  ctx.lineWidth = INNER_RING_WIDTH
  ctx.globalAlpha = alpha * pulse
  ctx.stroke()

  // ── Center disc ──
  ctx.beginPath()
  ctx.arc(givenScreen.x, givenScreen.y, 5, 0, Math.PI * 2)
  ctx.fillStyle = HIGHLIGHT_COLOR
  ctx.globalAlpha = alpha * 0.7
  ctx.fill()

  // ── Diamond marker on derived point ──
  const s = 5
  ctx.beginPath()
  ctx.moveTo(derivedScreen.x, derivedScreen.y - s)
  ctx.lineTo(derivedScreen.x + s, derivedScreen.y)
  ctx.lineTo(derivedScreen.x, derivedScreen.y + s)
  ctx.lineTo(derivedScreen.x - s, derivedScreen.y)
  ctx.closePath()
  ctx.strokeStyle = HIGHLIGHT_COLOR
  ctx.lineWidth = 1.5
  ctx.globalAlpha = alpha * 0.6
  ctx.stroke()

  // ── Preview arrow on the given, in the direction it would move if the
  //    derived were dragged toward the cursor. Fades out as the cursor
  //    approaches the derived point so it doesn't clutter when about to click.
  if (pointerWorld && highlightState.subJacobian) {
    const pointerScreen = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)
    const dxScreen = pointerScreen.x - derivedScreen.x
    const dyScreen = pointerScreen.y - derivedScreen.y
    const cursorScreenDist = Math.sqrt(dxScreen * dxScreen + dyScreen * dyScreen)

    const proximityAlpha =
      cursorScreenDist <= PREVIEW_ARROW_FADE_END
        ? 0
        : cursorScreenDist >= PREVIEW_ARROW_FADE_START
          ? 1
          : (cursorScreenDist - PREVIEW_ARROW_FADE_END) /
            (PREVIEW_ARROW_FADE_START - PREVIEW_ARROW_FADE_END)

    const dxWorld = pointerWorld.x - derivedPt.x
    const dyWorld = pointerWorld.y - derivedPt.y
    const cursorDist = Math.sqrt(dxWorld * dxWorld + dyWorld * dyWorld)

    if (proximityAlpha > 0.01 && cursorDist > 0.01) {
      const scale = 1 / cursorDist
      const unitDx = dxWorld * scale
      const unitDy = dyWorld * scale

      const response = constrainedDragStep(
        { x: 0, y: 0 },
        { x: unitDx, y: unitDy },
        highlightState.subJacobian
      )

      if (response) {
        const respScreenX = response.x * viewport.pixelsPerUnit
        const respScreenY = -response.y * viewport.pixelsPerUnit // y flipped on screen
        let arrowLen = Math.sqrt(respScreenX * respScreenX + respScreenY * respScreenY)
        arrowLen *= PREVIEW_ARROW_SCALE

        if (arrowLen > 2) {
          const clampedLen = Math.min(arrowLen, PREVIEW_ARROW_MAX_LEN)
          const normFactor =
            clampedLen / Math.sqrt(respScreenX * respScreenX + respScreenY * respScreenY)
          const ax = respScreenX * normFactor
          const ay = respScreenY * normFactor
          const tipX = givenScreen.x + ax
          const tipY = givenScreen.y + ay
          const angle = Math.atan2(ay, ax)
          const arrowAlpha = alpha * 0.7 * proximityAlpha

          ctx.beginPath()
          ctx.moveTo(givenScreen.x, givenScreen.y)
          ctx.lineTo(tipX, tipY)
          ctx.strokeStyle = PREVIEW_ARROW_COLOR
          ctx.lineWidth = 2.5
          ctx.globalAlpha = arrowAlpha
          ctx.lineCap = 'round'
          ctx.stroke()

          ctx.lineWidth = 2.5
          drawArrowhead(ctx, tipX, tipY, angle, PREVIEW_ARROW_HEAD)
        }
      }
    }
  }

  ctx.restore()

  return highlightState.opacity !== highlightState.targetOpacity || highlightState.opacity > 0
}
