import type {
  ActiveTool,
  CompassPhase,
  StraightedgePhase,
  ConstructionState,
  EuclidViewportState,
} from '../types'
import { getPoint } from '../engine/constructionState'
import { worldToScreen2D } from '../../shared/coordinateConversions'

// ── Constants ─────────────────────────────────────────────────────

const COMPASS_LEG_LENGTH = 110 // screen px
const COMPASS_HINGE_RADIUS = 6
const COMPASS_LEG_WIDTH_HINGE = 8
const COMPASS_LEG_WIDTH_TIP = 2
const COMPASS_IDLE_SPREAD = 15 // px apart when idle

const STRAIGHTEDGE_WIDTH = 24
const STRAIGHTEDGE_MIN_LENGTH = 120
const STRAIGHTEDGE_OVERHANG = 30
const STRAIGHTEDGE_IDLE_LENGTH = 80
const STRAIGHTEDGE_IDLE_ANGLE = Math.PI / 6 // 30 degrees

// Rigid-body friction physics for the straightedge trailing end.
// Models a rod dragged by one end across a surface: viscous friction acts
// on every point along the rod proportional to that point's velocity,
// producing a torque that swings the trailing end behind the grip.
//
// Derivation: for a uniform rod of length L dragged by one end at velocity Ṗ,
// friction at distance s from the grip creates torque dτ = -γ·s·(vPerp + s·ω) ds.
// Integrating and dividing by moment of inertia I = ρL³/3 gives:
//   α = -β · [ (3/(2L)) · vPerp + ω ]
// where β = γ/ρ (friction-to-mass ratio) and vPerp is the component of Ṗ
// perpendicular to the rod.
let friction = 1 // β: friction-to-mass ratio (1/ms) — governs response speed

/** Get the current friction coefficient. */
export function getFriction(): number { return friction }
/** Set the friction coefficient (for debug tuning). */
export function setFriction(value: number) { friction = value }

// ── Straightedge draw animation type ─────────────────────────────

export interface StraightedgeDrawAnim {
  segmentId: string
  fromId: string
  toId: string
  color: string
  startTime: number
  duration: number
}

// ── Module-level state for angle physics ─────────────────────────

const sePhysics = {
  /** Current angle of the trailing end (radians) */
  angle: STRAIGHTEDGE_IDLE_ANGLE,
  /** Angular velocity (rad/ms) */
  omega: 0,
  /** Previous screen-space tip position (for computing cursor velocity) */
  prevSx: 0,
  prevSy: 0,
  /** Whether the physics state has been initialized with a position */
  initialized: false,
  /** Last frame timestamp */
  lastTime: 0,
}

// ── Helpers ───────────────────────────────────────────────────────

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

/**
 * Rigid-body friction simulation for the straightedge angle.
 *
 * Models a uniform rod of length L dragged by one end across a surface with
 * viscous friction. The friction on each infinitesimal element creates torque
 * proportional to that element's velocity and its distance from the grip,
 * yielding the angular acceleration:
 *
 *   α = -β · [ (3/(2L)) · vPerp + ω ]
 *
 * where vPerp is the cursor velocity component perpendicular to the rod.
 * The (3/(2L)) factor comes from integrating friction torque along the rod
 * and dividing by the moment of inertia (ρL³/3).
 *
 * This produces natural behavior: the trailing end swings behind the
 * direction of motion, with slight underdamping at typical cursor speeds
 * giving a physical, weighty feel. The double integration (α → ω → θ)
 * naturally filters out input noise without needing velocity smoothing.
 */
function updateAnglePhysics(tipSx: number, tipSy: number, now: number): number {
  if (!sePhysics.initialized) {
    sePhysics.prevSx = tipSx
    sePhysics.prevSy = tipSy
    sePhysics.omega = 0
    sePhysics.lastTime = now
    sePhysics.initialized = true
    return sePhysics.angle
  }

  const rawDt = now - sePhysics.lastTime
  if (rawDt < 1) return sePhysics.angle // skip sub-millisecond updates
  const dt = Math.min(rawDt, 50) // clamp to avoid explosion after tab switch
  sePhysics.lastTime = now

  // Cursor velocity (px/ms)
  const vx = (tipSx - sePhysics.prevSx) / dt
  const vy = (tipSy - sePhysics.prevSy) / dt
  sePhysics.prevSx = tipSx
  sePhysics.prevSy = tipSy

  // Perpendicular component of cursor velocity relative to the rod direction.
  // vPerp > 0 when cursor moves in the rod's "left" direction (counterclockwise).
  const cosA = Math.cos(sePhysics.angle)
  const sinA = Math.sin(sePhysics.angle)
  const vPerp = vy * cosA - vx * sinA

  // Angular acceleration from distributed friction along the rod
  const L = STRAIGHTEDGE_IDLE_LENGTH
  const alpha = -friction * ((3 / (2 * L)) * vPerp + sePhysics.omega)

  // Semi-implicit Euler integration (update ω first, then θ, for stability)
  sePhysics.omega += alpha * dt
  sePhysics.angle += sePhysics.omega * dt

  // Normalize angle to [-π, π]
  while (sePhysics.angle > Math.PI) sePhysics.angle -= 2 * Math.PI
  while (sePhysics.angle <= -Math.PI) sePhysics.angle += 2 * Math.PI

  return sePhysics.angle
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  return Math.sqrt(dx * dx + dy * dy)
}

/** Compute hinge point for compass given pivot and scriber screen positions. */
function computeHinge(
  pivotX: number,
  pivotY: number,
  scriberX: number,
  scriberY: number,
): { x: number; y: number } {
  const midX = (pivotX + scriberX) / 2
  const midY = (pivotY + scriberY) / 2
  const halfBase = dist(pivotX, pivotY, scriberX, scriberY) / 2

  let hingeHeight: number
  if (halfBase >= COMPASS_LEG_LENGTH) {
    hingeHeight = 0 // fully open, hinge at midpoint
  } else {
    hingeHeight = Math.sqrt(COMPASS_LEG_LENGTH * COMPASS_LEG_LENGTH - halfBase * halfBase)
  }

  // Perpendicular direction to pivot→scriber
  const dx = scriberX - pivotX
  const dy = scriberY - pivotY
  const len = Math.sqrt(dx * dx + dy * dy)

  if (len < 0.1) {
    // Points coincide — place hinge above
    return { x: midX, y: midY - COMPASS_LEG_LENGTH }
  }

  // Two perpendicular directions: (-dy, dx) and (dy, -dx)
  const perpAx = -dy / len
  const perpAy = dx / len
  const perpBx = dy / len
  const perpBy = -dx / len

  // Bias toward screen-top (smaller Y)
  const hingeAy = midY + perpAy * hingeHeight
  const hingeBy = midY + perpBy * hingeHeight

  if (hingeAy <= hingeBy) {
    return { x: midX + perpAx * hingeHeight, y: hingeAy }
  }
  return { x: midX + perpBx * hingeHeight, y: hingeBy }
}

// ── Leg rendering (pseudo-3D trapezoid) ───────────────────────────

function renderLeg(
  ctx: CanvasRenderingContext2D,
  hingeX: number,
  hingeY: number,
  tipX: number,
  tipY: number,
  alpha: number,
) {
  const dx = tipX - hingeX
  const dy = tipY - hingeY
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return

  // Perpendicular unit vector
  const px = -dy / len
  const py = dx / len

  const hw = COMPASS_LEG_WIDTH_HINGE / 2
  const tw = COMPASS_LEG_WIDTH_TIP / 2

  // Trapezoid corners: hinge-left, hinge-right, tip-right, tip-left
  const hlx = hingeX + px * hw
  const hly = hingeY + py * hw
  const hrx = hingeX - px * hw
  const hry = hingeY - py * hw
  const trx = tipX - px * tw
  const try_ = tipY - py * tw
  const tlx = tipX + px * tw
  const tly = tipY + py * tw

  // Shadow (offset 2px down-right)
  ctx.save()
  ctx.globalAlpha = alpha * 0.2
  ctx.beginPath()
  ctx.moveTo(hlx + 2, hly + 2)
  ctx.lineTo(hrx + 2, hry + 2)
  ctx.lineTo(trx + 2, try_ + 2)
  ctx.lineTo(tlx + 2, tly + 2)
  ctx.closePath()
  ctx.fillStyle = '#000'
  ctx.fill()
  ctx.restore()

  // Gradient fill — lighter left, darker right (cylindrical appearance)
  const grad = ctx.createLinearGradient(hlx, hly, hrx, hry)
  grad.addColorStop(0, '#B0B0B0')
  grad.addColorStop(0.4, '#A0A0A0')
  grad.addColorStop(1, '#606060')

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.moveTo(hlx, hly)
  ctx.lineTo(hrx, hry)
  ctx.lineTo(trx, try_)
  ctx.lineTo(tlx, tly)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // Outline
  ctx.strokeStyle = `rgba(80, 80, 80, ${alpha * 0.5})`
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

// ── Hinge rendering ───────────────────────────────────────────────

function renderHinge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  alpha: number,
) {
  ctx.save()
  ctx.globalAlpha = alpha

  // Radial gradient: center highlight → edge shadow
  const grad = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, COMPASS_HINGE_RADIUS)
  grad.addColorStop(0, '#D0D0D0')
  grad.addColorStop(0.5, '#B0B0B0')
  grad.addColorStop(1, '#505050')

  ctx.beginPath()
  ctx.arc(x, y, COMPASS_HINGE_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()

  // Center dot
  ctx.beginPath()
  ctx.arc(x, y, 2, 0, Math.PI * 2)
  ctx.fillStyle = '#404040'
  ctx.fill()

  ctx.restore()
}

// ── Compass tip rendering ─────────────────────────────────────────

function renderPivotTip(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  hingeX: number,
  hingeY: number,
  alpha: number,
) {
  // Needle-sharp triangle — this IS the cursor, so it needs to read as "the point"
  const dx = tipX - hingeX
  const dy = tipY - hingeY
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return

  const nx = dx / len
  const ny = dy / len
  const px = -ny
  const py = nx

  const tipLength = 12
  const tipWidth = 3

  ctx.save()
  ctx.globalAlpha = alpha

  // Dark steel needle
  ctx.beginPath()
  ctx.moveTo(tipX + nx * tipLength, tipY + ny * tipLength)
  ctx.lineTo(tipX + px * tipWidth, tipY + py * tipWidth)
  ctx.lineTo(tipX - px * tipWidth, tipY - py * tipWidth)
  ctx.closePath()
  ctx.fillStyle = '#303030'
  ctx.fill()

  // Thin highlight edge on one side for metallic look
  ctx.beginPath()
  ctx.moveTo(tipX + nx * tipLength, tipY + ny * tipLength)
  ctx.lineTo(tipX + px * tipWidth, tipY + py * tipWidth)
  ctx.strokeStyle = `rgba(200, 200, 200, ${alpha * 0.5})`
  ctx.lineWidth = 0.5
  ctx.stroke()

  ctx.restore()
}

function renderScriberTip(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  color: string,
  alpha: number,
) {
  ctx.save()
  ctx.globalAlpha = alpha

  // Contrasting outline so the colored dot reads clearly against any background
  ctx.beginPath()
  ctx.arc(tipX, tipY, 4.5, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(40, 40, 40, ${alpha * 0.6})`
  ctx.lineWidth = 1
  ctx.stroke()

  // Colored fill
  ctx.beginPath()
  ctx.arc(tipX, tipY, 3.5, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  ctx.restore()
}

// ── Full compass rendering ────────────────────────────────────────

function renderCompass(
  ctx: CanvasRenderingContext2D,
  pivotX: number,
  pivotY: number,
  scriberX: number,
  scriberY: number,
  alpha: number,
  nextColor: string,
) {
  const hinge = computeHinge(pivotX, pivotY, scriberX, scriberY)

  // Draw legs
  renderLeg(ctx, hinge.x, hinge.y, pivotX, pivotY, alpha)
  renderLeg(ctx, hinge.x, hinge.y, scriberX, scriberY, alpha)

  // Draw hinge
  renderHinge(ctx, hinge.x, hinge.y, alpha)

  // Draw tips
  renderPivotTip(ctx, pivotX, pivotY, hinge.x, hinge.y, alpha)
  renderScriberTip(ctx, scriberX, scriberY, nextColor, alpha)
}

// ── Straightedge rendering ────────────────────────────────────────

function renderStraightedgeBar(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  alpha: number,
) {
  const dx = toX - fromX
  const dy = toY - fromY
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.1) return

  const nx = dx / len
  const ny = dy / len
  // Perpendicular (pointing to the offset side)
  const px = -ny
  const py = nx

  const barLength = Math.max(len, STRAIGHTEDGE_MIN_LENGTH) + STRAIGHTEDGE_OVERHANG * 2
  const halfLen = barLength / 2
  const midX = (fromX + toX) / 2
  const midY = (fromY + toY) / 2

  // Bar corners (offset to one side so working edge sits on the line)
  const x1 = midX - nx * halfLen
  const y1 = midY - ny * halfLen
  const x2 = midX + nx * halfLen
  const y2 = midY + ny * halfLen

  // Four corners of the rectangle, offset perpendicular
  const offset = STRAIGHTEDGE_WIDTH
  const corners = [
    { x: x1, y: y1 },                               // working edge start
    { x: x2, y: y2 },                               // working edge end
    { x: x2 + px * offset, y: y2 + py * offset },   // far edge end
    { x: x1 + px * offset, y: y1 + py * offset },   // far edge start
  ]

  // Shadow
  ctx.save()
  ctx.globalAlpha = alpha * 0.15
  ctx.beginPath()
  ctx.moveTo(corners[0].x + 3, corners[0].y + 3)
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(corners[i].x + 3, corners[i].y + 3)
  }
  ctx.closePath()
  ctx.fillStyle = '#000'
  ctx.fill()
  ctx.restore()

  // Gradient fill — warm tan/wood tone, lighter top darker bottom
  const grad = ctx.createLinearGradient(
    x1, y1,
    x1 + px * offset, y1 + py * offset,
  )
  grad.addColorStop(0, '#D8CCA8')
  grad.addColorStop(0.3, '#C8B896')
  grad.addColorStop(1, '#8A7A5A')

  ctx.save()
  ctx.globalAlpha = alpha

  // Rounded rectangle via path
  ctx.beginPath()
  ctx.moveTo(corners[0].x, corners[0].y)
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(corners[i].x, corners[i].y)
  }
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // Working edge (bottom) — solid darker line
  ctx.beginPath()
  ctx.moveTo(corners[0].x, corners[0].y)
  ctx.lineTo(corners[1].x, corners[1].y)
  ctx.strokeStyle = '#5A5040'
  ctx.lineWidth = 2
  ctx.stroke()

  // Opposite edge — lighter line
  ctx.beginPath()
  ctx.moveTo(corners[2].x, corners[2].y)
  ctx.lineTo(corners[3].x, corners[3].y)
  ctx.strokeStyle = '#D8CCA8'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.restore()
}

// ── Straightedge endpoint nib ─────────────────────────────────────

/** Small V-notch at the active end of the straightedge working edge. */
function renderStraightedgeEndpoint(
  ctx: CanvasRenderingContext2D,
  activeX: number,
  activeY: number,
  otherX: number,
  otherY: number,
  alpha: number,
) {
  const dx = activeX - otherX
  const dy = activeY - otherY
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.1) return

  const nx = dx / len
  const ny = dy / len
  const px = -ny
  const py = nx

  // Small triangular nib pointing toward the active point
  const nibLen = 7
  const nibWidth = 4

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.moveTo(activeX, activeY)
  ctx.lineTo(activeX - nx * nibLen + px * nibWidth, activeY - ny * nibLen + py * nibWidth)
  ctx.lineTo(activeX - nx * nibLen - px * nibWidth, activeY - ny * nibLen - py * nibWidth)
  ctx.closePath()
  ctx.fillStyle = '#404030'
  ctx.fill()
  ctx.restore()
}

// ── Geometric preview helpers (moved from renderConstruction Section 5) ──

function renderCompassCenterSetPreview(
  ctx: CanvasRenderingContext2D,
  centerSx: number,
  centerSy: number,
  pointerSx: number,
  pointerSy: number,
  radiusScreen: number,
) {
  // Dashed line center -> pointer
  ctx.beginPath()
  ctx.setLineDash([6, 4])
  ctx.moveTo(centerSx, centerSy)
  ctx.lineTo(pointerSx, pointerSy)
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.setLineDash([])

  // Faint circle at current radius
  if (radiusScreen > 1) {
    ctx.beginPath()
    ctx.arc(centerSx, centerSy, radiusScreen, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function renderCompassRadiusSetPreview(
  ctx: CanvasRenderingContext2D,
  centerSx: number,
  centerSy: number,
  pointerSx: number,
  pointerSy: number,
  radiusScreen: number,
) {
  // Faint guide ring
  ctx.beginPath()
  ctx.arc(centerSx, centerSy, radiusScreen, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.15)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Line center -> pointer
  ctx.beginPath()
  ctx.moveTo(centerSx, centerSy)
  ctx.lineTo(pointerSx, pointerSy)
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)'
  ctx.lineWidth = 1
  ctx.stroke()
}

function renderCompassSweepingPreview(
  ctx: CanvasRenderingContext2D,
  centerSx: number,
  centerSy: number,
  radiusScreen: number,
  startAngle: number,
  cumulativeSweep: number,
  pointerSx: number | null,
  pointerSy: number | null,
  nextColor: string,
) {
  // Faint guide ring
  ctx.beginPath()
  ctx.arc(centerSx, centerSy, radiusScreen, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.12)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Arc from startAngle through cumulativeSweep
  // Y-inversion: negate angles for screen rendering
  const screenStartAngle = -startAngle
  const screenEndAngle = -(startAngle + cumulativeSweep)
  const counterclockwise = cumulativeSweep > 0

  ctx.beginPath()
  ctx.arc(centerSx, centerSy, radiusScreen, screenStartAngle, screenEndAngle, counterclockwise)
  ctx.strokeStyle = nextColor
  ctx.lineWidth = 2.5
  ctx.stroke()

  // Thin line from center to current pointer angle
  if (pointerSx != null && pointerSy != null) {
    ctx.beginPath()
    ctx.moveTo(centerSx, centerSy)
    ctx.lineTo(pointerSx, pointerSy)
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }
}

function renderStraightedgeFromSetPreview(
  ctx: CanvasRenderingContext2D,
  fromSx: number,
  fromSy: number,
  pointerSx: number,
  pointerSy: number,
  nextColor: string,
  canvasW: number,
  canvasH: number,
) {
  // Extend line to viewport edges
  const dx = pointerSx - fromSx
  const dy = pointerSy - fromSy
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len > 0.1) {
    const extend = Math.max(canvasW, canvasH) * 2
    const nx = dx / len
    const ny = dy / len

    ctx.beginPath()
    ctx.moveTo(fromSx - nx * extend, fromSy - ny * extend)
    ctx.lineTo(fromSx + nx * extend, fromSy + ny * extend)
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.15)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Actual segment preview
  ctx.beginPath()
  ctx.moveTo(fromSx, fromSy)
  ctx.lineTo(pointerSx, pointerSy)
  ctx.strokeStyle = nextColor
  ctx.lineWidth = 2
  ctx.setLineDash([8, 4])
  ctx.stroke()
  ctx.setLineDash([])
}

// ── Main entry point ──────────────────────────────────────────────

export function renderToolOverlay(
  ctx: CanvasRenderingContext2D,
  activeTool: ActiveTool,
  compassPhase: CompassPhase,
  straightedgePhase: StraightedgePhase,
  pointerWorld: { x: number; y: number } | null,
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  nextColor: string,
  isComplete: boolean,
  straightedgeDrawAnim: StraightedgeDrawAnim | null,
): void {
  if (isComplete) return

  const ppu = viewport.pixelsPerUnit

  // ── Straightedge drawing animation (takes priority over everything) ──

  if (straightedgeDrawAnim) {
    const now = performance.now()
    const elapsed = now - straightedgeDrawAnim.startTime
    const rawProgress = Math.min(1, elapsed / straightedgeDrawAnim.duration)
    // Ease-out quadratic — starts fast, slows at end like a pencil stroke
    const progress = 1 - (1 - rawProgress) * (1 - rawProgress)

    const fromPt = getPoint(state, straightedgeDrawAnim.fromId)
    const toPt = getPoint(state, straightedgeDrawAnim.toId)
    if (fromPt && toPt) {
      const sf = toScreen(fromPt.x, fromPt.y, viewport, w, h)
      const st = toScreen(toPt.x, toPt.y, viewport, w, h)
      const px = sf.x + (st.x - sf.x) * progress
      const py = sf.y + (st.y - sf.y) * progress

      // Straightedge bar FIRST (behind the ink line)
      renderStraightedgeBar(ctx, sf.x, sf.y, st.x, st.y, 0.65)

      // Progressive colored line ON TOP — glow layer for visibility
      ctx.beginPath()
      ctx.moveTo(sf.x, sf.y)
      ctx.lineTo(px, py)
      ctx.strokeStyle = straightedgeDrawAnim.color
      ctx.globalAlpha = 0.3
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.globalAlpha = 1

      // Solid ink line
      ctx.beginPath()
      ctx.moveTo(sf.x, sf.y)
      ctx.lineTo(px, py)
      ctx.strokeStyle = straightedgeDrawAnim.color
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.lineCap = 'butt'

      // Endpoint nib tracks the progress point (the "pencil tip")
      renderStraightedgeEndpoint(ctx, px, py, sf.x, sf.y, 0.75)

      // Seed physics with the segment orientation so when idle resumes
      // the trailing end smoothly swings from the drawing angle
      sePhysics.angle = Math.atan2(sf.y - st.y, sf.x - st.x)
      sePhysics.omega = 0
      sePhysics.initialized = false // re-initialize position on first idle frame
    }
    return
  }

  // ── Compass phases ──

  if (activeTool === 'compass') {
    // Clear straightedge physics when switching tools
    sePhysics.initialized = false

    if (compassPhase.tag === 'center-set' && pointerWorld) {
      const center = getPoint(state, compassPhase.centerId)
      if (center) {
        const sc = toScreen(center.x, center.y, viewport, w, h)
        const sp = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)
        const dx = pointerWorld.x - center.x
        const dy = pointerWorld.y - center.y
        const radiusScreen = Math.sqrt(dx * dx + dy * dy) * ppu

        renderCompassCenterSetPreview(ctx, sc.x, sc.y, sp.x, sp.y, radiusScreen)
        renderCompass(ctx, sc.x, sc.y, sp.x, sp.y, 0.75, nextColor)
      }
      return
    }

    if (compassPhase.tag === 'radius-set' && pointerWorld) {
      const center = getPoint(state, compassPhase.centerId)
      const radiusPt = getPoint(state, compassPhase.radiusPointId)
      if (center && radiusPt) {
        const sc = toScreen(center.x, center.y, viewport, w, h)
        const sp = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)
        const sr = toScreen(radiusPt.x, radiusPt.y, viewport, w, h)
        const radiusScreen = compassPhase.radius * ppu

        renderCompassRadiusSetPreview(ctx, sc.x, sc.y, sp.x, sp.y, radiusScreen)
        renderCompass(ctx, sc.x, sc.y, sr.x, sr.y, 0.85, nextColor)
      }
      return
    }

    if (compassPhase.tag === 'sweeping') {
      const center = getPoint(state, compassPhase.centerId)
      if (center) {
        const sc = toScreen(center.x, center.y, viewport, w, h)
        const radiusScreen = compassPhase.radius * ppu

        const pointerSx = pointerWorld ? toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h).x : null
        const pointerSy = pointerWorld ? toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h).y : null

        renderCompassSweepingPreview(
          ctx, sc.x, sc.y, radiusScreen,
          compassPhase.startAngle, compassPhase.cumulativeSweep,
          pointerSx, pointerSy, nextColor,
        )

        const currentAngle = compassPhase.startAngle + compassPhase.cumulativeSweep
        const scriberSx = sc.x + radiusScreen * Math.cos(currentAngle)
        const scriberSy = sc.y - radiusScreen * Math.sin(currentAngle)
        renderCompass(ctx, sc.x, sc.y, scriberSx, scriberSy, 0.7, nextColor)
      }
      return
    }

    if (compassPhase.tag === 'idle' && pointerWorld) {
      const sp = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)
      const bob = Math.sin(performance.now() / 600) * 2
      renderCompass(
        ctx,
        sp.x, sp.y + bob,
        sp.x + COMPASS_IDLE_SPREAD, sp.y + bob,
        0.4,
        nextColor,
      )
    }
    return
  }

  // ── Straightedge phases ──

  if (activeTool === 'straightedge') {
    if (straightedgePhase.tag === 'from-set' && pointerWorld) {
      const from = getPoint(state, straightedgePhase.fromId)
      if (from) {
        const sf = toScreen(from.x, from.y, viewport, w, h)
        const sp = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)

        // Sync physics to the current straightedge orientation
        // so releasing back to idle doesn't cause a jarring snap
        sePhysics.angle = Math.atan2(sf.y - sp.y, sf.x - sp.x)
        sePhysics.omega = 0
        sePhysics.prevSx = sp.x
        sePhysics.prevSy = sp.y
        sePhysics.lastTime = performance.now()
        sePhysics.initialized = true

        renderStraightedgeFromSetPreview(ctx, sf.x, sf.y, sp.x, sp.y, nextColor, w, h)
        renderStraightedgeBar(ctx, sf.x, sf.y, sp.x, sp.y, 0.6)
        renderStraightedgeEndpoint(ctx, sp.x, sp.y, sf.x, sf.y, 0.6)
      }
      return
    }

    // Idle straightedge — tip always at cursor, trailing end swings via angle physics
    if (straightedgePhase.tag === 'idle' && pointerWorld) {
      const now = performance.now()
      const sp = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)
      const bob = Math.sin(now / 600) * 1.5

      const tipX = sp.x
      const tipY = sp.y + bob

      // Angle physics: trailing end swings behind cursor movement direction
      const angle = updateAnglePhysics(tipX, tipY, now)

      const cosA = Math.cos(angle)
      const sinA = Math.sin(angle)
      const trailX = tipX + cosA * STRAIGHTEDGE_IDLE_LENGTH
      const trailY = tipY + sinA * STRAIGHTEDGE_IDLE_LENGTH
      renderStraightedgeBar(ctx, tipX, tipY, trailX, trailY, 0.4)
      renderStraightedgeEndpoint(ctx, tipX, tipY, trailX, trailY, 0.4)
    }
  }
}
