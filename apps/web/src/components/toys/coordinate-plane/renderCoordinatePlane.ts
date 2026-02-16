import type { CoordinatePlaneState, CoordinatePlaneOverlay } from './types'
import type { EquationProbeState } from './ruler/types'
import type { TickMark } from '../number-line/types'
import { DEFAULT_TICK_THRESHOLDS } from '../number-line/types'
import type { CollisionFadeMap } from '../shared/collisionDetection'
import { computeCollisionOpacity } from '../shared/collisionDetection'
import { computeAxisTicks } from './coordinatePlaneTicks'
import { worldToScreen } from '../shared/coordinateConversions'
import {
  smoothstep,
  getTickHeight,
  getTickLineWidth,
  getTickAlpha,
  getTickFontSize,
  getTickFontWeight,
  formatTickLabel,
  LIGHT_COLORS,
  DARK_COLORS,
  COLLISION_FADE_MS,
  SYSTEM_FONT,
} from '../shared/tickMath'

// How many px from the viewport edge the label flip transition starts
const LABEL_FLIP_ZONE = 40

// ── Label collision detection ───────────────────────────────────────

interface LabelInfo {
  tick: TickMark
  screenPos: number
  label: string
  fontSize: number
  fontWeight: number
  labelWidth: number
  /** Horizontal extent: [min, max] on the canvas */
  extentMin: number
  extentMax: number
}

const LABEL_PAD = 6

function computeLabelCollisions(
  labelInfos: LabelInfo[]
): Set<LabelInfo> {
  // Sort by prominence descending so higher-prominence labels take priority
  const sorted = [...labelInfos].sort((a, b) => b.tick.prominence - a.tick.prominence)
  const visible = new Set<LabelInfo>()
  const occupied: { min: number; max: number }[] = []

  for (const info of sorted) {
    const pad = LABEL_PAD / 2
    let overlaps = false
    for (const occ of occupied) {
      if (info.extentMin - pad < occ.max && info.extentMax + pad > occ.min) {
        overlaps = true
        break
      }
    }
    if (!overlaps) {
      visible.add(info)
      occupied.push({ min: info.extentMin, max: info.extentMax })
    }
  }

  return visible
}

// ── Main render function ────────────────────────────────────────────

/**
 * Render the coordinate plane onto a canvas context.
 * Assumes ctx.scale(dpr, dpr) has already been called.
 *
 * Returns true if animations are in progress (label fading).
 */
export function renderCoordinatePlane(
  ctx: CanvasRenderingContext2D,
  state: CoordinatePlaneState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  zoomVelocity = 0,
  zoomHue = 0,
  zoomFocalX = 0.5,
  zoomFocalY = 0.5,
  xCollisionFadeMap?: CollisionFadeMap,
  yCollisionFadeMap?: CollisionFadeMap,
  overlays?: CoordinatePlaneOverlay[],
  probeState?: EquationProbeState,
): boolean {
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS
  let animating = false

  // ── Pass 1: Clear ──────────────────────────────────────────────
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  // ── Pass 2: Zoom velocity wash ─────────────────────────────────
  if (Math.abs(zoomVelocity) > 0.001) {
    const intensity = Math.min(Math.abs(zoomVelocity) * 3, 0.35)
    const sat = 80
    const lum = isDark ? 30 : 70
    const focalPxX = zoomFocalX * cssWidth
    const focalPxY = zoomFocalY * cssHeight
    const radius = Math.max(cssWidth, cssHeight) * 0.7
    const gradient = ctx.createRadialGradient(
      focalPxX, focalPxY, 0,
      focalPxX, focalPxY, radius
    )
    gradient.addColorStop(0, `hsla(${zoomHue}, ${sat}%, ${lum}%, ${intensity})`)
    gradient.addColorStop(1, `hsla(${zoomHue}, ${sat}%, ${lum}%, 0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, cssWidth, cssHeight)
  }

  // ── Pass 3: Behind-grid overlays ───────────────────────────────
  if (overlays) {
    for (const overlay of overlays) {
      if (overlay.layer === 'behind-grid') {
        overlay.render(ctx, state, cssWidth, cssHeight, isDark)
      }
    }
  }

  // ── Compute ticks for both axes ────────────────────────────────
  const xTicks = computeAxisTicks(state, 'x', cssWidth, DEFAULT_TICK_THRESHOLDS)
  const yTicks = computeAxisTicks(state, 'y', cssHeight, DEFAULT_TICK_THRESHOLDS)

  // ── Pass 4: Grid lines ─────────────────────────────────────────
  // Vertical grid lines from X ticks
  for (const tick of xTicks) {
    const sx = worldToScreen(tick.value, state.center.x, state.pixelsPerUnit.x, cssWidth)
    if (sx < -1 || sx > cssWidth + 1) continue

    const tickAlpha = getTickAlpha(tick.prominence)
    const gridAlpha = tickAlpha * 0.3 * tick.opacity
    if (gridAlpha < 0.005) continue

    ctx.beginPath()
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, cssHeight)
    ctx.strokeStyle = `rgba(${colors.tickRgb}, ${gridAlpha})`
    ctx.lineWidth = Math.max(0.5, getTickLineWidth(tick.prominence) * 0.6)
    ctx.stroke()
  }

  // Horizontal grid lines from Y ticks
  for (const tick of yTicks) {
    // Y-axis inversion: positive Y goes up
    const sy = cssHeight / 2 - (tick.value - state.center.y) * state.pixelsPerUnit.y
    if (sy < -1 || sy > cssHeight + 1) continue

    const tickAlpha = getTickAlpha(tick.prominence)
    const gridAlpha = tickAlpha * 0.3 * tick.opacity
    if (gridAlpha < 0.005) continue

    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(cssWidth, sy)
    ctx.strokeStyle = `rgba(${colors.tickRgb}, ${gridAlpha})`
    ctx.lineWidth = Math.max(0.5, getTickLineWidth(tick.prominence) * 0.6)
    ctx.stroke()
  }

  // ── Pass 4.5: Probe grid line glow ────────────────────────────
  if (probeState?.active) {
    const glowRGB = isDark ? '129, 140, 248' : '79, 70, 229' // indigo

    if (probeState.nearX != null) {
      // Vertical glow at nearX grid line
      const sx = worldToScreen(probeState.nearX, state.center.x, state.pixelsPerUnit.x, cssWidth)
      const distX = Math.abs(probeState.worldX - probeState.nearX)
      const alpha = 1 - distX / 0.15 // 0.15 is snap threshold

      if (alpha > 0) {
        // Soft glow (wide)
        const glowWidth = 12
        const grad = ctx.createLinearGradient(sx - glowWidth, 0, sx + glowWidth, 0)
        grad.addColorStop(0, `rgba(${glowRGB}, 0)`)
        grad.addColorStop(0.5, `rgba(${glowRGB}, ${0.2 * alpha})`)
        grad.addColorStop(1, `rgba(${glowRGB}, 0)`)
        ctx.fillStyle = grad
        ctx.fillRect(sx - glowWidth, 0, glowWidth * 2, cssHeight)

        // Bright center line
        ctx.beginPath()
        ctx.moveTo(sx, 0)
        ctx.lineTo(sx, cssHeight)
        ctx.strokeStyle = `rgba(${glowRGB}, ${0.7 * alpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }

    if (probeState.nearY != null) {
      // Horizontal glow at nearY grid line
      const sy = cssHeight / 2 - (probeState.nearY - state.center.y) * state.pixelsPerUnit.y
      const distY = Math.abs(probeState.worldY - probeState.nearY)
      const alpha = 1 - distY / 0.15

      if (alpha > 0) {
        const glowWidth = 12
        const grad = ctx.createLinearGradient(0, sy - glowWidth, 0, sy + glowWidth)
        grad.addColorStop(0, `rgba(${glowRGB}, 0)`)
        grad.addColorStop(0.5, `rgba(${glowRGB}, ${0.2 * alpha})`)
        grad.addColorStop(1, `rgba(${glowRGB}, 0)`)
        ctx.fillStyle = grad
        ctx.fillRect(0, sy - glowWidth, cssWidth, glowWidth * 2)

        ctx.beginPath()
        ctx.moveTo(0, sy)
        ctx.lineTo(cssWidth, sy)
        ctx.strokeStyle = `rgba(${glowRGB}, ${0.7 * alpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }
  }

  // ── Pass 5: Axis lines ─────────────────────────────────────────
  // X-axis (horizontal line at y=0)
  const xAxisScreenY = cssHeight / 2 - (0 - state.center.y) * state.pixelsPerUnit.y
  const xAxisPinnedTop = xAxisScreenY < 0
  const xAxisPinnedBottom = xAxisScreenY > cssHeight
  const xAxisPinned = xAxisPinnedTop || xAxisPinnedBottom
  const xAxisDrawY = Math.max(0, Math.min(cssHeight, xAxisScreenY))
  const xAxisAlpha = xAxisPinned ? 0.3 : 0.8

  ctx.beginPath()
  ctx.moveTo(0, xAxisDrawY)
  ctx.lineTo(cssWidth, xAxisDrawY)
  ctx.strokeStyle = isDark
    ? `rgba(209, 213, 219, ${xAxisAlpha})`
    : `rgba(55, 65, 81, ${xAxisAlpha})`
  ctx.lineWidth = 2
  ctx.stroke()

  // Y-axis (vertical line at x=0)
  const yAxisScreenX = worldToScreen(0, state.center.x, state.pixelsPerUnit.x, cssWidth)
  const yAxisPinnedLeft = yAxisScreenX < 0
  const yAxisPinnedRight = yAxisScreenX > cssWidth
  const yAxisPinned = yAxisPinnedLeft || yAxisPinnedRight
  const yAxisDrawX = Math.max(0, Math.min(cssWidth, yAxisScreenX))
  const yAxisAlpha = yAxisPinned ? 0.3 : 0.8

  ctx.beginPath()
  ctx.moveTo(yAxisDrawX, 0)
  ctx.lineTo(yAxisDrawX, cssHeight)
  ctx.strokeStyle = isDark
    ? `rgba(209, 213, 219, ${yAxisAlpha})`
    : `rgba(55, 65, 81, ${yAxisAlpha})`
  ctx.lineWidth = 2
  ctx.stroke()

  // Compute smooth label flip factors (0 = default side, 1 = flipped side).
  // X labels: default below axis, flip above when axis near bottom edge.
  // Y labels: default left of axis, flip right when axis near left edge.
  const xSpaceBelow = cssHeight - xAxisDrawY
  const xLabelFlip = xSpaceBelow < LABEL_FLIP_ZONE
    ? smoothstep(1 - xSpaceBelow / LABEL_FLIP_ZONE)
    : 0

  const ySpaceLeft = yAxisDrawX
  const yLabelFlip = ySpaceLeft < LABEL_FLIP_ZONE
    ? smoothstep(1 - ySpaceLeft / LABEL_FLIP_ZONE)
    : 0

  // ── Pass 6: On-grid overlays ───────────────────────────────────
  if (overlays) {
    for (const overlay of overlays) {
      if (overlay.layer === 'on-grid') {
        overlay.render(ctx, state, cssWidth, cssHeight, isDark)
      }
    }
  }

  // ── Pass 7: Tick marks ─────────────────────────────────────────
  // X-axis tick marks (short vertical lines perpendicular to x-axis)
  const xTickLength = 6
  for (const tick of xTicks) {
    const sx = worldToScreen(tick.value, state.center.x, state.pixelsPerUnit.x, cssWidth)
    if (sx < -50 || sx > cssWidth + 50) continue

    const tickAlpha = getTickAlpha(tick.prominence)
    const lineWidth = getTickLineWidth(tick.prominence)
    // Scale tick length by prominence
    const halfLen = xTickLength * (0.5 + 0.5 * tick.prominence)

    ctx.globalAlpha = tick.opacity
    ctx.beginPath()
    ctx.moveTo(sx, xAxisDrawY - halfLen)
    ctx.lineTo(sx, xAxisDrawY + halfLen)
    ctx.strokeStyle = `rgba(${colors.tickRgb}, ${tickAlpha})`
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Y-axis tick marks (short horizontal lines perpendicular to y-axis)
  const yTickLength = 6
  for (const tick of yTicks) {
    const sy = cssHeight / 2 - (tick.value - state.center.y) * state.pixelsPerUnit.y
    if (sy < -50 || sy > cssHeight + 50) continue

    const tickAlpha = getTickAlpha(tick.prominence)
    const lineWidth = getTickLineWidth(tick.prominence)
    const halfLen = yTickLength * (0.5 + 0.5 * tick.prominence)

    ctx.globalAlpha = tick.opacity
    ctx.beginPath()
    ctx.moveTo(yAxisDrawX - halfLen, sy)
    ctx.lineTo(yAxisDrawX + halfLen, sy)
    ctx.strokeStyle = `rgba(${colors.tickRgb}, ${tickAlpha})`
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // ── Pass 8: Labels ─────────────────────────────────────────────
  const now = performance.now()

  // X-axis labels (below x-axis)
  {
    const labelInfos: LabelInfo[] = []
    for (const tick of xTicks) {
      const sx = worldToScreen(tick.value, state.center.x, state.pixelsPerUnit.x, cssWidth)
      if (sx < -50 || sx > cssWidth + 50) continue
      if (tick.opacity <= 0) continue

      const label = formatTickLabel(tick.value, tick.power)
      const fontSize = getTickFontSize(tick.prominence)
      const fontWeight = getTickFontWeight(tick.prominence)
      ctx.font = `${fontWeight} ${fontSize}px ${SYSTEM_FONT}`
      const labelWidth = ctx.measureText(label).width

      labelInfos.push({
        tick,
        screenPos: sx,
        label,
        fontSize,
        fontWeight,
        labelWidth,
        extentMin: sx - labelWidth / 2,
        extentMax: sx + labelWidth / 2,
      })
    }

    const visibleLabels = computeLabelCollisions(labelInfos)
    const seenValues = new Set<number>()

    for (const info of labelInfos) {
      const { tick, screenPos, label, fontSize, fontWeight, labelWidth } = info
      seenValues.add(tick.value)

      const isVisible = visibleLabels.has(info)
      let collisionOpacity = isVisible ? 1 : 0

      if (xCollisionFadeMap) {
        const result = computeCollisionOpacity(
          tick.value, isVisible, xCollisionFadeMap, now, COLLISION_FADE_MS
        )
        collisionOpacity = result.opacity
        if (result.animating) animating = true
      }

      if (collisionOpacity <= 0.01) continue

      const tickAlpha = getTickAlpha(tick.prominence)
      ctx.font = `${fontWeight} ${fontSize}px ${SYSTEM_FONT}`
      ctx.globalAlpha = tick.opacity * collisionOpacity
      ctx.fillStyle = `rgba(${colors.labelRgb}, ${tickAlpha})`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      // Smoothly interpolate label Y between below-axis and above-axis positions
      const gap = 10
      const belowY = xAxisDrawY + gap
      const aboveY = xAxisDrawY - gap - fontSize
      const labelY = belowY + (aboveY - belowY) * xLabelFlip
      ctx.fillText(label, screenPos, labelY)
    }

    // Clean up stale entries
    if (xCollisionFadeMap) {
      for (const key of xCollisionFadeMap.keys()) {
        if (!seenValues.has(key)) xCollisionFadeMap.delete(key)
      }
    }
  }
  ctx.globalAlpha = 1

  // Y-axis labels (left of y-axis)
  {
    const labelInfos: LabelInfo[] = []
    for (const tick of yTicks) {
      if (tick.value === 0) continue // skip origin label on Y (X has it)
      const sy = cssHeight / 2 - (tick.value - state.center.y) * state.pixelsPerUnit.y
      if (sy < -50 || sy > cssHeight + 50) continue
      if (tick.opacity <= 0) continue

      const label = formatTickLabel(tick.value, tick.power)
      const fontSize = getTickFontSize(tick.prominence)
      const fontWeight = getTickFontWeight(tick.prominence)
      ctx.font = `${fontWeight} ${fontSize}px ${SYSTEM_FONT}`
      const labelWidth = ctx.measureText(label).width

      // For Y labels, "extent" is vertical (use font size as height)
      labelInfos.push({
        tick,
        screenPos: sy,
        label,
        fontSize,
        fontWeight,
        labelWidth,
        extentMin: sy - fontSize / 2,
        extentMax: sy + fontSize / 2,
      })
    }

    const visibleLabels = computeLabelCollisions(labelInfos)
    const seenValues = new Set<number>()

    for (const info of labelInfos) {
      const { tick, screenPos, label, fontSize, fontWeight } = info
      seenValues.add(tick.value)

      const isVisible = visibleLabels.has(info)
      let collisionOpacity = isVisible ? 1 : 0

      if (yCollisionFadeMap) {
        const result = computeCollisionOpacity(
          tick.value, isVisible, yCollisionFadeMap, now, COLLISION_FADE_MS
        )
        collisionOpacity = result.opacity
        if (result.animating) animating = true
      }

      if (collisionOpacity <= 0.01) continue

      const tickAlpha = getTickAlpha(tick.prominence)
      ctx.font = `${fontWeight} ${fontSize}px ${SYSTEM_FONT}`
      ctx.globalAlpha = tick.opacity * collisionOpacity
      ctx.fillStyle = `rgba(${colors.labelRgb}, ${tickAlpha})`
      ctx.textBaseline = 'middle'
      // Smoothly interpolate label X between left-of-axis and right-of-axis
      const gap = 10
      const leftCenterX = yAxisDrawX - gap - info.labelWidth / 2
      const rightCenterX = yAxisDrawX + gap + info.labelWidth / 2
      const labelX = leftCenterX + (rightCenterX - leftCenterX) * yLabelFlip
      ctx.textAlign = 'center'
      ctx.fillText(label, labelX, screenPos)
    }

    // Clean up stale entries
    if (yCollisionFadeMap) {
      for (const key of yCollisionFadeMap.keys()) {
        if (!seenValues.has(key)) yCollisionFadeMap.delete(key)
      }
    }
  }
  ctx.globalAlpha = 1

  // ── Pass 9: Origin marker ──────────────────────────────────────
  if (!xAxisPinned && !yAxisPinned) {
    const ox = yAxisDrawX
    const oy = xAxisDrawY

    // Subtle glow
    const glowRadius = 12
    const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, glowRadius)
    const glowColor = isDark ? '129, 140, 248' : '79, 70, 229' // indigo
    glow.addColorStop(0, `rgba(${glowColor}, 0.3)`)
    glow.addColorStop(1, `rgba(${glowColor}, 0)`)
    ctx.fillStyle = glow
    ctx.fillRect(ox - glowRadius, oy - glowRadius, glowRadius * 2, glowRadius * 2)

    // Filled circle
    ctx.beginPath()
    ctx.arc(ox, oy, 4, 0, Math.PI * 2)
    ctx.fillStyle = isDark ? 'rgba(129, 140, 248, 0.9)' : 'rgba(79, 70, 229, 0.9)'
    ctx.fill()

    // Outer ring
    ctx.beginPath()
    ctx.arc(ox, oy, 6, 0, Math.PI * 2)
    ctx.strokeStyle = isDark ? 'rgba(129, 140, 248, 0.4)' : 'rgba(79, 70, 229, 0.4)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // ── Pass 10: Above-grid overlays ───────────────────────────────
  if (overlays) {
    for (const overlay of overlays) {
      if (overlay.layer === 'above-grid') {
        overlay.render(ctx, state, cssWidth, cssHeight, isDark)
      }
    }
  }

  return animating
}
