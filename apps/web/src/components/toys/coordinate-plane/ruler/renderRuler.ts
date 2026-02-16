import type { RulerState, VisualRulerState, EquationProbeState, Fraction, SlopeGuideState } from './types'
import type { CoordinatePlaneState } from '../types'
import { worldToScreen2D, screenToWorld2D } from '../../shared/coordinateConversions'
import { SYSTEM_FONT } from '../../shared/tickMath'
import { toMixedNumber } from './fractionMath'
import { guideIntegerIntersections } from './slopeGuides'

/** Visual constants */
const HANDLE_RADIUS = 8
const HANDLE_HIT_RADIUS = 30 // exposed for hit-testing
const BODY_HALF_WIDTH = 4
const RULER_OVERSHOOT = 6 // px beyond handles
const TICK_LENGTH = 5

export { HANDLE_HIT_RADIUS, BODY_HALF_WIDTH }

interface RulerScreenInfo {
  ax: number
  ay: number
  bx: number
  by: number
  midX: number
  midY: number
  angle: number
  length: number
}

/** Convert ruler state to screen coordinates */
export function rulerToScreen(
  ruler: RulerState | VisualRulerState,
  state: CoordinatePlaneState,
  cssWidth: number,
  cssHeight: number,
): RulerScreenInfo {
  const a = worldToScreen2D(
    ruler.ax, ruler.ay,
    state.center.x, state.center.y,
    state.pixelsPerUnit.x, state.pixelsPerUnit.y,
    cssWidth, cssHeight,
  )
  const b = worldToScreen2D(
    ruler.bx, ruler.by,
    state.center.x, state.center.y,
    state.pixelsPerUnit.x, state.pixelsPerUnit.y,
    cssWidth, cssHeight,
  )
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)
  return {
    ax: a.x, ay: a.y,
    bx: b.x, by: b.y,
    midX: (a.x + b.x) / 2,
    midY: (a.y + b.y) / 2,
    angle,
    length,
  }
}

/**
 * Render the ruler onto the canvas.
 * Draws laser beams, body, tick marks, handles, and coordinate awareness —
 * equation label is in the DOM layer.
 *
 * @param visualRuler  Smoothly interpolated state (used for visual positioning)
 * @param snappedRuler Integer-snapped state (used for coordinate labels)
 */
export function renderRuler(
  ctx: CanvasRenderingContext2D,
  visualRuler: VisualRulerState,
  snappedRuler: RulerState,
  planeState: CoordinatePlaneState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  activeHandle: 'handleA' | 'handleB' | 'body' | null,
  probeState?: EquationProbeState,
  slopeGuideState?: SlopeGuideState | null,
) {
  const info = rulerToScreen(visualRuler, planeState, cssWidth, cssHeight)
  if (info.length < 0.5) return // degenerate

  const { ax, ay, bx, by, angle } = info

  ctx.save()

  // Direction unit vector
  const dirX = Math.cos(angle)
  const dirY = Math.sin(angle)

  // Perpendicular unit vector
  const perpX = -dirY
  const perpY = dirX

  // ── Laser beams (rendered before body so body paints over origin) ──
  // Extend to viewport edge to communicate infinite slope line

  const laserCore = isDark
    ? 'rgba(251, 191, 36, 0.6)'  // amber-400
    : 'rgba(217, 119, 6, 0.55)'  // amber-600
  const laserGlow = isDark
    ? 'rgba(251, 191, 36, 0.12)' // soft outer glow
    : 'rgba(217, 119, 6, 0.10)'

  // Distance large enough to always exit the viewport
  const viewportDiag = Math.sqrt(cssWidth * cssWidth + cssHeight * cssHeight)

  const laserAFarX = ax - dirX * viewportDiag
  const laserAFarY = ay - dirY * viewportDiag
  const laserBFarX = bx + dirX * viewportDiag
  const laserBFarY = by + dirY * viewportDiag

  // Glow pass (wide, soft)
  ctx.lineCap = 'round'
  ctx.strokeStyle = laserGlow
  ctx.lineWidth = 6

  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(laserAFarX, laserAFarY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(laserBFarX, laserBFarY)
  ctx.stroke()

  // Core pass (thin, bright)
  ctx.strokeStyle = laserCore
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(laserAFarX, laserAFarY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(laserBFarX, laserBFarY)
  ctx.stroke()

  ctx.lineCap = 'butt'

  // ── Slope guide lines (behind ruler body) ─────────────────────
  if (slopeGuideState) {
    drawSlopeGuides(ctx, slopeGuideState, planeState, cssWidth, cssHeight, isDark)
  }

  // ── Body ──────────────────────────────────────────────────────

  // Extended endpoints (overshoot beyond handles)
  const eax = ax - dirX * RULER_OVERSHOOT
  const eay = ay - dirY * RULER_OVERSHOOT
  const ebx = bx + dirX * RULER_OVERSHOOT
  const eby = by + dirY * RULER_OVERSHOOT

  // Body fill
  const bodyColor = isDark
    ? 'rgba(49, 46, 75, 0.55)' // dark indigo glass
    : 'rgba(241, 245, 249, 0.6)' // frosted white

  ctx.beginPath()
  ctx.moveTo(eax + perpX * BODY_HALF_WIDTH, eay + perpY * BODY_HALF_WIDTH)
  ctx.lineTo(ebx + perpX * BODY_HALF_WIDTH, eby + perpY * BODY_HALF_WIDTH)
  ctx.lineTo(ebx - perpX * BODY_HALF_WIDTH, eby - perpY * BODY_HALF_WIDTH)
  ctx.lineTo(eax - perpX * BODY_HALF_WIDTH, eay - perpY * BODY_HALF_WIDTH)
  ctx.closePath()
  ctx.fillStyle = bodyColor
  ctx.fill()

  // Edge lines
  const edgeColor = isDark
    ? 'rgba(129, 140, 248, 0.35)'
    : 'rgba(100, 116, 139, 0.3)'
  ctx.strokeStyle = edgeColor
  ctx.lineWidth = 0.5

  ctx.beginPath()
  ctx.moveTo(eax + perpX * BODY_HALF_WIDTH, eay + perpY * BODY_HALF_WIDTH)
  ctx.lineTo(ebx + perpX * BODY_HALF_WIDTH, eby + perpY * BODY_HALF_WIDTH)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(eax - perpX * BODY_HALF_WIDTH, eay - perpY * BODY_HALF_WIDTH)
  ctx.lineTo(ebx - perpX * BODY_HALF_WIDTH, eby - perpY * BODY_HALF_WIDTH)
  ctx.stroke()

  // ── Tick marks along one edge (every 1 world unit) ────────────

  // Compute world distance between endpoints
  const worldDx = visualRuler.bx - visualRuler.ax
  const worldDy = visualRuler.by - visualRuler.ay
  const worldDist = Math.sqrt(worldDx * worldDx + worldDy * worldDy)
  const steps = Math.round(worldDist)

  if (steps > 0 && steps <= 200) {
    const tickColor = isDark
      ? 'rgba(129, 140, 248, 0.4)'
      : 'rgba(100, 116, 139, 0.35)'
    ctx.strokeStyle = tickColor
    ctx.lineWidth = 0.75

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const tx = ax + (bx - ax) * t
      const ty = ay + (by - ay) * t

      // Tick on one side (positive perpendicular)
      ctx.beginPath()
      ctx.moveTo(tx + perpX * BODY_HALF_WIDTH, ty + perpY * BODY_HALF_WIDTH)
      ctx.lineTo(
        tx + perpX * (BODY_HALF_WIDTH + TICK_LENGTH),
        ty + perpY * (BODY_HALF_WIDTH + TICK_LENGTH),
      )
      ctx.stroke()
    }
  }

  // ── Handles ───────────────────────────────────────────────────

  drawHandle(ctx, ax, ay, isDark, activeHandle === 'handleA')
  drawHandle(ctx, bx, by, isDark, activeHandle === 'handleB')

  // ── Coordinate awareness ──────────────────────────────────────

  drawCoordinateAwareness(
    ctx, ax, ay, snappedRuler.ax, snappedRuler.ay,
    bx, by, planeState, cssWidth, cssHeight, isDark,
  )
  drawCoordinateAwareness(
    ctx, bx, by, snappedRuler.bx, snappedRuler.by,
    ax, ay, planeState, cssWidth, cssHeight, isDark,
  )

  // ── Probe dot + coordinate awareness (equation slider) ──────
  if (probeState?.active) {
    const probe = worldToScreen2D(
      probeState.worldX, probeState.worldY,
      planeState.center.x, planeState.center.y,
      planeState.pixelsPerUnit.x, planeState.pixelsPerUnit.y,
      cssWidth, cssHeight,
    )
    const probeRadius = 4
    const probeColor = isDark ? 'rgba(129, 140, 248, 0.9)' : 'rgba(79, 70, 229, 0.9)'

    ctx.beginPath()
    ctx.arc(probe.x, probe.y, probeRadius, 0, Math.PI * 2)
    ctx.fillStyle = probeColor
    ctx.fill()

    // Dashed projection lines + pills when near a solve point
    if (probeState.nearX != null || probeState.nearY != null) {
      drawProbeCoordinateAwareness(ctx, probe.x, probe.y, probeState, planeState, cssWidth, cssHeight, isDark)
    }
  }

  ctx.restore()
}

/** Draw coordinate awareness for a single handle */
function drawCoordinateAwareness(
  ctx: CanvasRenderingContext2D,
  /** Screen position of this handle */
  hx: number, hy: number,
  /** Snapped integer coordinates for labels */
  worldX: number, worldY: number,
  /** Screen position of the other handle (for floating label direction) */
  otherX: number, otherY: number,
  planeState: CoordinatePlaneState,
  cssWidth: number, cssHeight: number,
  isDark: boolean,
) {
  const { center, pixelsPerUnit } = planeState

  // Axis screen positions
  const xAxisScreenY = cssHeight / 2 - (0 - center.y) * pixelsPerUnit.y
  const yAxisScreenX = (0 - center.x) * pixelsPerUnit.x + cssWidth / 2

  const xAxisVisible = xAxisScreenY >= 0 && xAxisScreenY <= cssHeight
  const yAxisVisible = yAxisScreenX >= 0 && yAxisScreenX <= cssWidth

  if (xAxisVisible && yAxisVisible) {
    // Mode A: Projection lines to axes
    drawProjectionLines(ctx, hx, hy, worldX, worldY, xAxisScreenY, yAxisScreenX, isDark)
  } else {
    // Mode B: Floating coordinate label
    drawFloatingLabel(ctx, hx, hy, worldX, worldY, otherX, otherY, isDark)
  }
}

/** Mode A: Dashed projection lines to axes with coordinate pills */
function drawProjectionLines(
  ctx: CanvasRenderingContext2D,
  hx: number, hy: number,
  worldX: number, worldY: number,
  xAxisScreenY: number, yAxisScreenX: number,
  isDark: boolean,
) {
  const dashColor = isDark
    ? 'rgba(129, 140, 248, 0.35)'
    : 'rgba(79, 70, 229, 0.35)'

  ctx.save()
  ctx.setLineDash([4, 3])
  ctx.strokeStyle = dashColor
  ctx.lineWidth = 1

  // Vertical dashed line: handle → x-axis
  ctx.beginPath()
  ctx.moveTo(hx, hy)
  ctx.lineTo(hx, xAxisScreenY)
  ctx.stroke()

  // Horizontal dashed line: handle → y-axis
  ctx.beginPath()
  ctx.moveTo(hx, hy)
  ctx.lineTo(yAxisScreenX, hy)
  ctx.stroke()

  ctx.setLineDash([])
  ctx.restore()

  // Coordinate pills at axis intersections
  drawCoordinatePill(ctx, hx, xAxisScreenY, String(worldX), isDark, 'x-axis')
  drawCoordinatePill(ctx, yAxisScreenX, hy, String(worldY), isDark, 'y-axis')
}

/** Draw a small pill label at an axis intersection */
function drawCoordinatePill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  text: string,
  isDark: boolean,
  axis: 'x-axis' | 'y-axis',
) {
  ctx.save()
  ctx.font = `11px ${SYSTEM_FONT}`
  const metrics = ctx.measureText(text)
  const textWidth = metrics.width
  const padX = 5
  const padY = 3
  const pillW = textWidth + padX * 2
  const pillH = 16

  // Position pill: offset slightly from the axis
  let px: number, py: number
  if (axis === 'x-axis') {
    // Below the x-axis intersection
    px = x - pillW / 2
    py = y + 4
  } else {
    // Left of the y-axis intersection
    px = x - pillW - 4
    py = y - pillH / 2
  }

  const bgColor = isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.85)'
  const borderColor = isDark ? 'rgba(129, 140, 248, 0.5)' : 'rgba(79, 70, 229, 0.5)'
  const textColor = isDark ? '#c7d2fe' : '#4338ca'

  // Pill background
  const r = 4
  ctx.beginPath()
  ctx.roundRect(px, py, pillW, pillH, r)
  ctx.fillStyle = bgColor
  ctx.fill()
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 1
  ctx.stroke()

  // Text
  ctx.fillStyle = textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, px + pillW / 2, py + pillH / 2)

  ctx.restore()
}

/** Mode B: Floating (x, y) label near the handle, away from ruler body */
function drawFloatingLabel(
  ctx: CanvasRenderingContext2D,
  hx: number, hy: number,
  worldX: number, worldY: number,
  otherX: number, otherY: number,
  isDark: boolean,
) {
  // Direction away from the other handle
  const dx = hx - otherX
  const dy = hy - otherY
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 0.1) return

  const awayX = dx / dist
  const awayY = dy / dist

  // Perpendicular to away direction
  const perpX = -awayY
  const perpY = awayX

  // Offset: 20px along away + 12px perpendicular
  const labelX = hx + awayX * 20 + perpX * 12
  const labelY = hy + awayY * 20 + perpY * 12

  const text = `(${worldX}, ${worldY})`

  ctx.save()
  ctx.font = `11px ${SYSTEM_FONT}`
  const metrics = ctx.measureText(text)
  const textWidth = metrics.width
  const padX = 6
  const padY = 3
  const pillW = textWidth + padX * 2
  const pillH = 16

  const px = labelX - pillW / 2
  const py = labelY - pillH / 2

  const bgColor = isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.85)'
  const borderColor = isDark ? 'rgba(129, 140, 248, 0.5)' : 'rgba(79, 70, 229, 0.5)'
  const textColor = isDark ? '#c7d2fe' : '#4338ca'

  const r = 4
  ctx.beginPath()
  ctx.roundRect(px, py, pillW, pillH, r)
  ctx.fillStyle = bgColor
  ctx.fill()
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, labelX, labelY)

  ctx.restore()
}

function drawHandle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  isDark: boolean,
  active: boolean,
) {
  const radius = HANDLE_RADIUS

  // Glow
  if (active) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.5)
    const glowColor = isDark ? '129, 140, 248' : '79, 70, 229'
    glow.addColorStop(0, `rgba(${glowColor}, 0.4)`)
    glow.addColorStop(1, `rgba(${glowColor}, 0)`)
    ctx.fillStyle = glow
    ctx.fillRect(x - radius * 2.5, y - radius * 2.5, radius * 5, radius * 5)
  }

  // Outer circle
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = isDark
    ? (active ? 'rgba(99, 102, 241, 0.85)' : 'rgba(71, 85, 105, 0.7)')
    : (active ? 'rgba(79, 70, 229, 0.85)' : 'rgba(203, 213, 225, 0.8)')
  ctx.fill()

  ctx.strokeStyle = isDark
    ? 'rgba(129, 140, 248, 0.6)'
    : 'rgba(100, 116, 139, 0.5)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Crosshair
  const crossSize = 4
  ctx.strokeStyle = isDark
    ? 'rgba(226, 232, 240, 0.8)'
    : 'rgba(30, 41, 59, 0.6)'
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.moveTo(x - crossSize, y)
  ctx.lineTo(x + crossSize, y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x, y - crossSize)
  ctx.lineTo(x, y + crossSize)
  ctx.stroke()
}

// ── Slope guide lines with integer intersection indicators ────────

const GUIDE_DOT_RADIUS = 4

function drawSlopeGuides(
  ctx: CanvasRenderingContext2D,
  state: SlopeGuideState,
  planeState: CoordinatePlaneState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
) {
  const { center, pixelsPerUnit } = planeState
  const anchor = worldToScreen2D(
    state.anchorX, state.anchorY,
    center.x, center.y, pixelsPerUnit.x, pixelsPerUnit.y,
    cssWidth, cssHeight,
  )
  const handle = worldToScreen2D(
    state.handleX, state.handleY,
    center.x, center.y, pixelsPerUnit.x, pixelsPerUnit.y,
    cssWidth, cssHeight,
  )
  const viewportDiag = Math.sqrt(cssWidth * cssWidth + cssHeight * cssHeight)

  // Distance cutoff: 50% of the smaller viewport dimension
  const fadeRadius = Math.min(cssWidth, cssHeight) * 0.5

  // Compute visible world-coordinate range (with 1-unit margin)
  const topLeft = screenToWorld2D(0, 0, center.x, center.y, pixelsPerUnit.x, pixelsPerUnit.y, cssWidth, cssHeight)
  const bottomRight = screenToWorld2D(cssWidth, cssHeight, center.x, center.y, pixelsPerUnit.x, pixelsPerUnit.y, cssWidth, cssHeight)
  const minWorldX = Math.min(topLeft.x, bottomRight.x) - 1
  const maxWorldX = Math.max(topLeft.x, bottomRight.x) + 1
  const minWorldY = Math.min(topLeft.y, bottomRight.y) - 1
  const maxWorldY = Math.max(topLeft.y, bottomRight.y) + 1

  const lineRGB = isDark ? '129, 140, 248' : '79, 70, 229'
  const dotRGB = isDark ? '129, 140, 248' : '79, 70, 229'

  for (const guide of state.guides) {
    const { slope } = guide

    // ── Find nearest drop point first (need it for opacity) ────
    const intPoints = guideIntegerIntersections(
      state.anchorX, state.anchorY, slope,
      minWorldX, maxWorldX, minWorldY, maxWorldY,
    )

    let nearest: { x: number; y: number } | null = null
    let nearestDistSq = Infinity
    for (const pt of intPoints) {
      if (pt.x === state.anchorX && pt.y === state.anchorY) continue
      const dx = pt.x - state.handleX
      const dy = pt.y - state.handleY
      const dSq = dx * dx + dy * dy
      if (dSq < nearestDistSq) {
        nearestDistSq = dSq
        nearest = pt
      }
    }

    if (!nearest) continue

    const sp = worldToScreen2D(
      nearest.x, nearest.y,
      center.x, center.y, pixelsPerUnit.x, pixelsPerUnit.y,
      cssWidth, cssHeight,
    )

    // Screen distance from handle to nearest drop point
    const screenDist = Math.sqrt(
      (sp.x - handle.x) ** 2 + (sp.y - handle.y) ** 2,
    )
    if (screenDist >= fadeRadius) continue

    const opacity = 1 - screenDist / fadeRadius

    // ── Direction in screen space (Y inverted for canvas) ──────
    let screenDirX: number
    let screenDirY: number
    if (slope.den === 0) {
      screenDirX = 0
      screenDirY = 1
    } else {
      screenDirX = slope.den * pixelsPerUnit.x
      screenDirY = -slope.num * pixelsPerUnit.y
    }

    const len = Math.sqrt(screenDirX * screenDirX + screenDirY * screenDirY)
    if (len < 0.001) continue
    screenDirX /= len
    screenDirY /= len

    // Extend in both directions from anchor
    const x1 = anchor.x - screenDirX * viewportDiag
    const y1 = anchor.y - screenDirY * viewportDiag
    const x2 = anchor.x + screenDirX * viewportDiag
    const y2 = anchor.y + screenDirY * viewportDiag

    // Dashed guide line
    ctx.save()
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = `rgba(${lineRGB}, ${opacity * 0.15})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()

    // Open circle (ring) at drop point
    ctx.save()
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, GUIDE_DOT_RADIUS, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${dotRGB}, ${opacity * 0.55})`
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()

    // Slope label pill at the drop point
    const pillOffset = GUIDE_DOT_RADIUS + 12
    drawSlopePill(ctx, sp.x + pillOffset, sp.y - pillOffset, slope.label, opacity, isDark)
  }
}

/** Draw a small slope label pill at the given screen position */
function drawSlopePill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  text: string,
  opacity: number,
  isDark: boolean,
) {
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.font = `10px ${SYSTEM_FONT}`
  const metrics = ctx.measureText(text)
  const textWidth = metrics.width
  const padX = 4
  const pillW = textWidth + padX * 2
  const pillH = 14
  const px = x - pillW / 2
  const py = y - pillH / 2

  const bgColor = isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.85)'
  const borderColor = isDark ? 'rgba(129, 140, 248, 0.4)' : 'rgba(79, 70, 229, 0.4)'
  const textColor = isDark ? '#a5b4fc' : '#6366f1'

  const r = 3
  ctx.beginPath()
  ctx.roundRect(px, py, pillW, pillH, r)
  ctx.fillStyle = bgColor
  ctx.fill()
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 0.75
  ctx.stroke()

  ctx.fillStyle = textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)

  ctx.restore()
}

// ── Probe solve-point coordinate awareness ────────────────────────

/** Format a Fraction as a compact string for canvas pill labels */
function formatFractionText(f: Fraction): string {
  const m = toMixedNumber(f)
  const sign = m.negative ? '\u2212' : ''
  // Integer
  if (m.fracNum === 0) return `${sign}${m.whole}`
  // Pure fraction
  if (m.whole === 0) return `${sign}${m.fracNum}/${m.fracDen}`
  // Mixed number
  return `${sign}${m.whole} ${m.fracNum}/${m.fracDen}`
}

/** Draw dashed projection lines + coordinate pills for the probe solve point */
function drawProbeCoordinateAwareness(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  probeState: EquationProbeState,
  planeState: CoordinatePlaneState,
  cssWidth: number, cssHeight: number,
  isDark: boolean,
) {
  const { center, pixelsPerUnit } = planeState

  // Axis screen positions
  const xAxisScreenY = cssHeight / 2 - (0 - center.y) * pixelsPerUnit.y
  const yAxisScreenX = (0 - center.x) * pixelsPerUnit.x + cssWidth / 2

  const xAxisVisible = xAxisScreenY >= 0 && xAxisScreenY <= cssHeight
  const yAxisVisible = yAxisScreenX >= 0 && yAxisScreenX <= cssWidth

  if (!xAxisVisible && !yAxisVisible) return

  const dashColor = isDark
    ? 'rgba(129, 140, 248, 0.5)'
    : 'rgba(79, 70, 229, 0.5)'

  ctx.save()
  ctx.setLineDash([4, 3])
  ctx.strokeStyle = dashColor
  ctx.lineWidth = 1

  // When near an x grid line: show vertical dashed line to x-axis, pill with x value,
  // and horizontal dashed line to y-axis with solved y fraction
  if (probeState.nearX != null && probeState.solvedAtNearX && xAxisVisible) {
    // Snap the vertical line to the exact integer x position
    const snapScreenX = worldToScreen2D(
      probeState.nearX, 0,
      center.x, center.y, pixelsPerUnit.x, pixelsPerUnit.y,
      cssWidth, cssHeight,
    ).x

    ctx.beginPath()
    ctx.moveTo(snapScreenX, py)
    ctx.lineTo(snapScreenX, xAxisScreenY)
    ctx.stroke()

    ctx.setLineDash([])
    drawCoordinatePill(ctx, snapScreenX, xAxisScreenY, String(probeState.nearX), isDark, 'x-axis')
    ctx.setLineDash([4, 3])
    ctx.strokeStyle = dashColor
  }

  if (probeState.nearY != null && probeState.solvedAtNearY && yAxisVisible) {
    // Snap the horizontal line to the exact integer y position
    const snapScreenY = worldToScreen2D(
      0, probeState.nearY,
      center.x, center.y, pixelsPerUnit.x, pixelsPerUnit.y,
      cssWidth, cssHeight,
    ).y

    ctx.beginPath()
    ctx.moveTo(px, snapScreenY)
    ctx.lineTo(yAxisScreenX, snapScreenY)
    ctx.stroke()

    ctx.setLineDash([])
    drawCoordinatePill(ctx, yAxisScreenX, snapScreenY, String(probeState.nearY), isDark, 'y-axis')
    ctx.setLineDash([4, 3])
    ctx.strokeStyle = dashColor
  }

  // Also show the solved (fractional) value on the opposite axis
  if (probeState.nearX != null && probeState.solvedAtNearX && yAxisVisible) {
    // Solved y → pill on y-axis
    const solvedYScreen = worldToScreen2D(
      0, probeState.solvedAtNearX.yFrac.num / probeState.solvedAtNearX.yFrac.den,
      center.x, center.y, pixelsPerUnit.x, pixelsPerUnit.y,
      cssWidth, cssHeight,
    ).y

    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(yAxisScreenX, solvedYScreen)
    ctx.stroke()

    ctx.setLineDash([])
    drawCoordinatePill(ctx, yAxisScreenX, solvedYScreen, formatFractionText(probeState.solvedAtNearX.yFrac), isDark, 'y-axis')
  }

  if (probeState.nearY != null && probeState.solvedAtNearY && xAxisVisible) {
    // Solved x → pill on x-axis
    const solvedXScreen = worldToScreen2D(
      probeState.solvedAtNearY.xFrac.num / probeState.solvedAtNearY.xFrac.den, 0,
      center.x, center.y, pixelsPerUnit.x, pixelsPerUnit.y,
      cssWidth, cssHeight,
    ).x

    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(solvedXScreen, xAxisScreenY)
    ctx.stroke()

    ctx.setLineDash([])
    drawCoordinatePill(ctx, solvedXScreen, xAxisScreenY, formatFractionText(probeState.solvedAtNearY.xFrac), isDark, 'x-axis')
  }

  ctx.setLineDash([])
  ctx.restore()
}
