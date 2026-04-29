/**
 * Render influence highlight: a prominent glowing ring around the most
 * influential given point when hovering over a derived point, with a
 * connecting line, preview arrow, and motion trail during drag.
 *
 * Features smooth fade-in/fade-out transitions.
 */

import type { ConstructionState, EuclidViewportState } from '../types'
import { getPoint } from '../engine/constructionState'
import { worldToScreen2D } from '../../shared/coordinateConversions'
import { constrainedDragStep } from '../engine/jacobianInfluence'

// ── Visual constants ──
const HIGHLIGHT_COLOR = '#4E79A7' // Byrne blue
const LINE_COLOR_BASE = 'rgba(78, 121, 167, 0.35)'
const OUTER_RING_RADIUS = 20
const INNER_RING_RADIUS = 14
const GLOW_RADIUS = 28
const OUTER_RING_WIDTH = 2
const INNER_RING_WIDTH = 3
const DASH_PATTERN: [number, number] = [6, 4]
const FADE_DURATION_MS = 200
const PREVIEW_ARROW_COLOR = '#4E79A7'
const PREVIEW_ARROW_SCALE = 40 // pixels per unit of Jacobian response
const PREVIEW_ARROW_MAX_LEN = 60 // max arrow length in pixels
const PREVIEW_ARROW_HEAD = 8 // arrowhead size
const PREVIEW_ARROW_FADE_START = 15 // screen px from derived point: arrow fully visible beyond this
const PREVIEW_ARROW_FADE_END = 5 // screen px from derived point: arrow fully hidden below this
const TENSION_START_RADIUS = 40 // screen px: tension visuals begin
const BREAK_FREE_RADIUS = 250 // screen px: constraint snaps
const TENSION_DAMPEN = 0.95 // at max tension, cursor influence reduced to 1 - this
const TENSION_COLOR = '#D98D2F' // amber for strained state
const TENSION_COLOR_RGB = '217, 141, 47'
const HIGHLIGHT_COLOR_RGB = '78, 121, 167'
const BREAK_FREE_FLASH_DURATION_MS = 400
const BREAK_FREE_SHOCKWAVE_MAX_RADIUS = 80
const TRAIL_COLOR = 'rgba(78, 121, 167, 0.6)'
const TRAIL_MAX_POINTS = 20
const TRAIL_MAX_WIDTH = 4
const TRAIL_MIN_WIDTH = 0.5

// ── State types ──

/** Persistent state for smooth highlight transitions. */
export interface InfluenceHighlightState {
  opacity: number
  targetOpacity: number
  derivedPointId: string | null
  givenPointId: string | null
  fadeStartTime: number
  fadeStartOpacity: number
  /** Sub-Jacobian for preview arrow: [∂tx/∂gx, ∂tx/∂gy, ∂ty/∂gx, ∂ty/∂gy] */
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

// ── Highlight target update ──

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

/** Lerp between two RGB color strings based on t (0..1). Returns CSS rgba(). */
function lerpColor(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
  t: number,
  a: number
): string {
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** Lerp between Byrne blue and tension amber. */
function tensionColor(tension: number, alpha: number): string {
  return lerpColor(78, 121, 167, 217, 141, 47, tension, alpha)
}

/** Hex color lerped between blue and amber based on tension. */
function tensionHex(tension: number): string {
  const r = Math.round(78 + (217 - 78) * tension)
  const g = Math.round(121 + (141 - 121) * tension)
  const b = Math.round(167 + (47 - 167) * tension)
  return `rgb(${r}, ${g}, ${b})`
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

// ── Constraint field ──

/**
 * Subtle elliptical halo around the derived point that visualizes the local
 * structure of the inverse Jacobian J⁻¹. Concentric level sets of
 * |J⁻¹·(P−D)| are exactly ellipses centered at D, with axes aligned to J's
 * singular vectors and lengths proportional to its singular values — so the
 * whole field is described by 4 numbers, no rasterization needed.
 *
 * The radial gradient's inner circle is biased toward the cursor's bearing
 * (in ellipse-local coordinates), so as the user sweeps the cursor around D
 * the bright spot of the ellipse rotates with them — the radial direction
 * (cursor angle) modulates the cartesian representation (ellipse highlight).
 *
 * Renders behind influence-highlight artifacts (it's drawn *first* in the
 * highlight pass) so the ring + dashed connector + arrow stay readable.
 */
export function renderConstraintField(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  highlightState: InfluenceHighlightState,
  pointerWorld: { x: number; y: number } | null
): void {
  if (highlightState.opacity <= 0.001) return
  if (!highlightState.derivedPointId || !highlightState.subJacobian) return

  const derivedPt = getPoint(state, highlightState.derivedPointId)
  if (!derivedPt) return
  const derivedScreen = toScreen(derivedPt.x, derivedPt.y, viewport, w, h)

  // ── Decompose J = [a b; c d]: principal axes of derived-space leverage ──
  // M = JᵀJ has eigenvalues σ₁², σ₂² (singular values squared of J) and
  // eigenvectors equal to the right singular vectors V — i.e. derived-space
  // directions of "easy" pull (large σ ⇒ big derived motion per given step).
  const [a, b, c, d] = highlightState.subJacobian
  const M00 = a * a + c * c
  const M01 = a * b + c * d
  const M11 = b * b + d * d
  const halfTr = (M00 + M11) / 2
  const detM = M00 * M11 - M01 * M01
  const disc = Math.sqrt(Math.max(0, halfTr * halfTr - detM))
  const lam1 = halfTr + disc
  const lam2 = halfTr - disc
  if (lam1 < 1e-12 || lam2 < 1e-12) return // near-singular: don't draw a lie
  const sigma1 = Math.sqrt(lam1)
  const sigma2 = Math.sqrt(lam2)

  // Eigenvector for the largest eigenvalue (the "easy" direction in world).
  let vx: number, vy: number
  if (Math.abs(M01) > 1e-9) {
    vx = M01
    vy = lam1 - M00
  } else {
    // M is diagonal; principal axis is whichever coord has the larger value
    vx = M00 >= M11 ? 1 : 0
    vy = M00 >= M11 ? 0 : 1
  }
  const vn = Math.sqrt(vx * vx + vy * vy) || 1
  vx /= vn
  vy /= vn

  // World Y is flipped vs canvas Y; flip the eigenvector's y to get the
  // screen-space rotation angle of the ellipse's major axis.
  const theta = Math.atan2(-vy, vx)

  // Ellipse semi-axes in screen pixels. Major axis is fixed (qualitative
  // visualization — the *shape* carries the information, not absolute size);
  // minor axis = major × σ₂/σ₁ so highly anisotropic constraints visibly
  // squash to thin oblongs.
  const SIZE = 130
  const sx = SIZE
  const sy = SIZE * (sigma2 / sigma1)

  // ── Cursor → ellipse-local bias ──
  // Bring the cursor screen-offset into ellipse-local (unit-circle) coords
  // by inverting the canvas transform: rotate by −θ, then scale by 1/sx,1/sy.
  // The bright spot of the radial gradient is then biased toward (ix, iy),
  // clamped to stay inside the ellipse so it never exits the visible field.
  let ix = 0
  let iy = 0
  let cursorLocalDist = 0
  if (pointerWorld) {
    const pScreen = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)
    const dx = pScreen.x - derivedScreen.x
    const dy = pScreen.y - derivedScreen.y
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    const lx = (cos * dx + sin * dy) / sx
    const ly = (-sin * dx + cos * dy) / sy
    cursorLocalDist = Math.sqrt(lx * lx + ly * ly)
    if (cursorLocalDist > 1e-6) {
      const bias = Math.min(cursorLocalDist * 0.55, 0.45)
      ix = (lx / cursorLocalDist) * bias
      iy = (ly / cursorLocalDist) * bias
    }
  }

  // Cursor proximity boosts brightness when the user is probing near D.
  const proximity = pointerWorld ? Math.max(0, 1 - cursorLocalDist) : 0.4
  const baseAlpha = 0.09 * highlightState.opacity * (1 + proximity * 0.9)

  ctx.save()
  ctx.translate(derivedScreen.x, derivedScreen.y)
  ctx.rotate(theta)
  ctx.scale(sx, sy)

  const grad = ctx.createRadialGradient(ix, iy, 0, 0, 0, 1.0)
  grad.addColorStop(0, `rgba(${HIGHLIGHT_COLOR_RGB}, ${(baseAlpha * 1.6).toFixed(3)})`)
  grad.addColorStop(0.45, `rgba(${HIGHLIGHT_COLOR_RGB}, ${(baseAlpha * 0.6).toFixed(3)})`)
  grad.addColorStop(1, `rgba(${HIGHLIGHT_COLOR_RGB}, 0)`)

  ctx.fillStyle = grad
  ctx.fillRect(-1, -1, 2, 2)
  ctx.restore()
}

// ── Main render ──

/**
 * @returns true if still animating (needs redraw)
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

  // Animate opacity
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
  const tension = highlightState.tension
  const pulse = 0.75 + 0.25 * Math.sin(time * 3.5)

  // Tension-driven ring vibration: random offset scaled by tension
  const vibeX = tension > 0.01 ? (Math.random() - 0.5) * tension * 8 : 0
  const vibeY = tension > 0.01 ? (Math.random() - 0.5) * tension * 8 : 0
  const ringX = givenScreen.x + vibeX
  const ringY = givenScreen.y + vibeY

  // Color that shifts with tension
  const lineColor = tensionColor(tension, 0.35 + tension * 0.4)
  const ringColor = tensionHex(tension)

  ctx.save()

  // ── Rubber band line (cursor → derived point, visible during tension) ──
  if (tension > 0.01 && highlightState.cursorScreen) {
    const rbAlpha = alpha * tension * 0.8
    const rbWidth = 1 + tension * 2.5
    ctx.beginPath()
    ctx.moveTo(highlightState.cursorScreen.x, highlightState.cursorScreen.y)
    ctx.lineTo(derivedScreen.x, derivedScreen.y)
    ctx.strokeStyle = tensionColor(tension, 1)
    ctx.lineWidth = rbWidth
    ctx.globalAlpha = rbAlpha
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  // ── Connecting dashed line ──
  ctx.beginPath()
  ctx.setLineDash(DASH_PATTERN)
  ctx.moveTo(derivedScreen.x, derivedScreen.y)
  ctx.lineTo(ringX, ringY)
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1.5 + tension * 1.5
  ctx.globalAlpha = alpha * 0.8
  ctx.stroke()
  ctx.setLineDash([])

  // ── Soft glow ──
  const gradient = ctx.createRadialGradient(ringX, ringY, 0, ringX, ringY, GLOW_RADIUS * pulse)
  gradient.addColorStop(0, tensionColor(tension, 0.4))
  gradient.addColorStop(0.5, tensionColor(tension, 0.15))
  gradient.addColorStop(1, tensionColor(tension, 0))
  ctx.beginPath()
  ctx.arc(ringX, ringY, GLOW_RADIUS * pulse, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.globalAlpha = alpha
  ctx.fill()

  // ── Outer ring ──
  ctx.beginPath()
  ctx.arc(ringX, ringY, OUTER_RING_RADIUS, 0, Math.PI * 2)
  ctx.strokeStyle = ringColor
  ctx.lineWidth = OUTER_RING_WIDTH
  ctx.globalAlpha = alpha * 0.4 * pulse
  ctx.stroke()

  // ── Inner ring ──
  ctx.beginPath()
  ctx.arc(ringX, ringY, INNER_RING_RADIUS, 0, Math.PI * 2)
  ctx.strokeStyle = ringColor
  ctx.lineWidth = INNER_RING_WIDTH
  ctx.globalAlpha = alpha * pulse
  ctx.stroke()

  // ── Center disc ──
  ctx.beginPath()
  ctx.arc(ringX, ringY, 5, 0, Math.PI * 2)
  ctx.fillStyle = ringColor
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
  ctx.strokeStyle = ringColor
  ctx.lineWidth = 1.5
  ctx.globalAlpha = alpha * 0.6
  ctx.stroke()

  // ── Preview arrow: shows where given point would move ──
  if (pointerWorld && highlightState.subJacobian) {
    // Compute cursor-to-derived-point distance in SCREEN pixels for fade
    const pointerScreen = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)
    const dxScreen = pointerScreen.x - derivedScreen.x
    const dyScreen = pointerScreen.y - derivedScreen.y
    const cursorScreenDist = Math.sqrt(dxScreen * dxScreen + dyScreen * dyScreen)

    // Fade arrow based on proximity: full at FADE_START, zero at FADE_END
    const proximityAlpha =
      cursorScreenDist <= PREVIEW_ARROW_FADE_END
        ? 0
        : cursorScreenDist >= PREVIEW_ARROW_FADE_START
          ? 1
          : (cursorScreenDist - PREVIEW_ARROW_FADE_END) /
            (PREVIEW_ARROW_FADE_START - PREVIEW_ARROW_FADE_END)

    // Vector from derived point to cursor in world coords
    const dxWorld = pointerWorld.x - derivedPt.x
    const dyWorld = pointerWorld.y - derivedPt.y
    const cursorDist = Math.sqrt(dxWorld * dxWorld + dyWorld * dyWorld)

    if (proximityAlpha > 0.01 && cursorDist > 0.01) {
      // Normalize to unit direction, then compute given-point response
      const scale = 1 / cursorDist
      const unitDx = dxWorld * scale
      const unitDy = dyWorld * scale

      const response = constrainedDragStep(
        { x: 0, y: 0 }, // we only care about the delta
        { x: unitDx, y: unitDy },
        highlightState.subJacobian
      )

      if (response) {
        // Convert response to screen pixels
        const respScreenX = response.x * viewport.pixelsPerUnit
        const respScreenY = -response.y * viewport.pixelsPerUnit // Y flipped in screen

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

          // Arrow shaft
          ctx.beginPath()
          ctx.moveTo(givenScreen.x, givenScreen.y)
          ctx.lineTo(tipX, tipY)
          ctx.strokeStyle = PREVIEW_ARROW_COLOR
          ctx.lineWidth = 2.5
          ctx.globalAlpha = arrowAlpha
          ctx.lineCap = 'round'
          ctx.stroke()

          // Arrowhead
          ctx.lineWidth = 2.5
          drawArrowhead(ctx, tipX, tipY, angle, PREVIEW_ARROW_HEAD)
        }
      }
    }
  }

  ctx.restore()

  return highlightState.opacity !== highlightState.targetOpacity || highlightState.opacity > 0
}

// ── Motion trail rendering ──

/**
 * Render the motion trail for a given point during/after drag.
 * @returns true if still animating
 */
export function renderMotionTrail(ctx: CanvasRenderingContext2D, trail: MotionTrailState): boolean {
  if (trail.count < 2 || trail.opacity <= 0.01) return false

  ctx.save()

  // Read positions in order from oldest to newest
  const startIdx = trail.count < TRAIL_MAX_POINTS ? 0 : trail.writeIdx // oldest is at writeIdx when buffer is full

  for (let i = 0; i < trail.count - 1; i++) {
    const idx0 = (startIdx + i) % TRAIL_MAX_POINTS
    const idx1 = (startIdx + i + 1) % TRAIL_MAX_POINTS
    const p0 = trail.positions[idx0]
    const p1 = trail.positions[idx1]

    // Age: 0 = oldest, 1 = newest
    const age = i / (trail.count - 1)
    const segAlpha = age * trail.opacity
    const segWidth = TRAIL_MIN_WIDTH + (TRAIL_MAX_WIDTH - TRAIL_MIN_WIDTH) * age

    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.lineTo(p1.x, p1.y)
    ctx.strokeStyle = TRAIL_COLOR
    ctx.lineWidth = segWidth
    ctx.globalAlpha = segAlpha
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  ctx.restore()
  return trail.opacity > 0
}

// ── Break-free flash rendering ──

/**
 * Render the break-free flash: expanding shockwave ring + line fragment burst.
 * @returns true if still animating
 */
export function renderBreakFreeFlash(
  ctx: CanvasRenderingContext2D,
  flash: BreakFreeFlash,
  now: number
): boolean {
  const elapsed = now - flash.startTime
  if (elapsed >= BREAK_FREE_FLASH_DURATION_MS) return false

  const t = elapsed / BREAK_FREE_FLASH_DURATION_MS
  const eased = easeOutCubic(t)

  ctx.save()

  // ── Expanding shockwave ring from given point ──
  const shockRadius =
    INNER_RING_RADIUS + (BREAK_FREE_SHOCKWAVE_MAX_RADIUS - INNER_RING_RADIUS) * eased
  const shockAlpha = (1 - eased) * 0.8
  ctx.beginPath()
  ctx.arc(flash.givenScreen.x, flash.givenScreen.y, shockRadius, 0, Math.PI * 2)
  ctx.strokeStyle = TENSION_COLOR
  ctx.lineWidth = 3 * (1 - eased) + 0.5
  ctx.globalAlpha = shockAlpha
  ctx.stroke()

  // ── Bright flash on given point (white → amber, fast fade) ──
  const flashT = Math.min(1, elapsed / 100) // 100ms flash
  const flashAlpha = (1 - flashT) * 0.9
  if (flashAlpha > 0.01) {
    const flashGrad = ctx.createRadialGradient(
      flash.givenScreen.x,
      flash.givenScreen.y,
      0,
      flash.givenScreen.x,
      flash.givenScreen.y,
      20
    )
    flashGrad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`)
    flashGrad.addColorStop(0.4, `rgba(${TENSION_COLOR_RGB}, ${flashAlpha * 0.6})`)
    flashGrad.addColorStop(1, `rgba(${TENSION_COLOR_RGB}, 0)`)
    ctx.beginPath()
    ctx.arc(flash.givenScreen.x, flash.givenScreen.y, 20, 0, Math.PI * 2)
    ctx.fillStyle = flashGrad
    ctx.globalAlpha = 1
    ctx.fill()
  }

  // ── Line fragment burst from midpoint of the old constraint line ──
  const midX = (flash.givenScreen.x + flash.derivedScreen.x) / 2
  const midY = (flash.givenScreen.y + flash.derivedScreen.y) / 2
  const lineAngle = Math.atan2(
    flash.derivedScreen.y - flash.givenScreen.y,
    flash.derivedScreen.x - flash.givenScreen.x
  )
  const perpAngle = lineAngle + Math.PI / 2
  const fragAlpha = (1 - eased) * 0.7

  if (fragAlpha > 0.01) {
    ctx.strokeStyle = TENSION_COLOR
    ctx.lineWidth = 2
    ctx.globalAlpha = fragAlpha
    ctx.lineCap = 'round'

    // 4 fragments: 2 pairs going in opposite perpendicular directions
    const fragLen = 8
    const driftDist = 30 * eased
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? 1 : -1
      const offset = (i % 2 === 0 ? -0.3 : 0.3) * fragLen
      const fx = midX + offset * Math.cos(lineAngle) + side * driftDist * Math.cos(perpAngle)
      const fy = midY + offset * Math.sin(lineAngle) + side * driftDist * Math.sin(perpAngle)
      ctx.beginPath()
      ctx.moveTo(fx, fy)
      ctx.lineTo(
        fx + fragLen * Math.cos(lineAngle + side * 0.3),
        fy + fragLen * Math.sin(lineAngle + side * 0.3)
      )
      ctx.stroke()
    }
  }

  ctx.restore()
  return true
}

/** Exported constants for use by the drag handler. */
export { TENSION_START_RADIUS, BREAK_FREE_RADIUS, TENSION_DAMPEN }
