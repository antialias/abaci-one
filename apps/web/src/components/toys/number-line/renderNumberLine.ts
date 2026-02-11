import type { NumberLineState, TickThresholds, CollisionFadeMap } from './types'
import { DEFAULT_TICK_THRESHOLDS } from './types'
import { computeTickMarks, numberToScreenX } from './numberLineTicks'

export interface RenderTarget {
  value: number
  emoji: string
  /** Pre-computed opacity (0-1) from proximity engine */
  opacity: number
}

/** Base RGB components for dynamic alpha composition */
interface RenderColors {
  axisLine: string
  /** RGB for tick marks — alpha computed from prominence */
  tickRgb: string
  /** RGB for labels — alpha computed from prominence */
  labelRgb: string
}

const LIGHT_COLORS: RenderColors = {
  axisLine: 'rgba(55, 65, 81, 0.8)',
  tickRgb: '55, 65, 81',
  labelRgb: '17, 24, 39',
}

const DARK_COLORS: RenderColors = {
  axisLine: 'rgba(209, 213, 219, 0.8)',
  tickRgb: '209, 213, 219',
  labelRgb: '243, 244, 246',
}

// Visual landmarks for prominence-based interpolation
// p=1.0 (anchor), p=0.5 (medium), p=0.0 (fine)
const HEIGHTS = { anchor: 40, medium: 24, fine: 12 } as const
const LINE_WIDTHS = { anchor: 2, medium: 1.5, fine: 1 } as const
const FONT_SIZES = { anchor: 13, medium: 11, fine: 11 } as const
const FONT_WEIGHTS = { anchor: 600, medium: 400, fine: 400 } as const
const TICK_ALPHAS = { anchor: 1.0, medium: 0.5, fine: 0.15 } as const
const COLLISION_FADE_MS = 500

/** Piecewise linear interpolation between three landmarks at p=1, p=0.5, p=0 */
function lerpLandmarks(prominence: number, anchor: number, medium: number, fine: number): number {
  if (prominence >= 0.5) {
    // Interpolate between anchor (p=1) and medium (p=0.5)
    const t = (prominence - 0.5) / 0.5
    return medium + t * (anchor - medium)
  } else {
    // Interpolate between medium (p=0.5) and fine (p=0)
    const t = prominence / 0.5
    return fine + t * (medium - fine)
  }
}

function getTickHeight(prominence: number, canvasHeight: number): number {
  const maxHeight = canvasHeight / 2
  const raw = lerpLandmarks(prominence, HEIGHTS.anchor, HEIGHTS.medium, HEIGHTS.fine)
  const maxForLevel = lerpLandmarks(prominence, maxHeight * 0.6, maxHeight * 0.4, maxHeight * 0.2)
  return Math.min(raw, maxForLevel)
}

function getTickLineWidth(prominence: number): number {
  return lerpLandmarks(prominence, LINE_WIDTHS.anchor, LINE_WIDTHS.medium, LINE_WIDTHS.fine)
}

function getTickAlpha(prominence: number): number {
  return lerpLandmarks(prominence, TICK_ALPHAS.anchor, TICK_ALPHAS.medium, TICK_ALPHAS.fine)
}

function getTickFontSize(prominence: number): number {
  return lerpLandmarks(prominence, FONT_SIZES.anchor, FONT_SIZES.medium, FONT_SIZES.fine)
}

function getTickFontWeight(prominence: number): number {
  return Math.round(
    lerpLandmarks(prominence, FONT_WEIGHTS.anchor, FONT_WEIGHTS.medium, FONT_WEIGHTS.fine)
  )
}

/** Format a number for display as a tick label, using the tick's power for precision */
function formatTickLabel(value: number, power: number): string {
  // Normalize -0 to 0
  if (value === 0) value = 0
  // Use scientific notation for very large or very small numbers
  if (value !== 0 && (Math.abs(value) >= 1e7 || Math.abs(value) < 1e-4)) {
    // Show enough significant digits based on power
    const sigFigs = Math.max(1, Math.min(15, -power + 1))
    return value.toExponential(Math.min(sigFigs, 6))
  }
  // For normal numbers, show enough fraction digits for the tick's power
  const fractionDigits = Math.max(0, -power)
  return value.toLocaleString(undefined, { maximumFractionDigits: Math.min(fractionDigits, 20) })
}

/**
 * Render the number line onto a canvas context.
 * Assumes ctx.scale(dpr, dpr) has already been called.
 */
export function renderNumberLine(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  thresholds: TickThresholds = DEFAULT_TICK_THRESHOLDS,
  zoomVelocity = 0,
  zoomHue = 0,
  zoomFocalX = 0.5,
  target?: RenderTarget,
  collisionFadeMap?: CollisionFadeMap
): boolean {
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS
  const centerY = cssHeight / 2

  // Clear
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  // Zoom velocity background wash — hue and focal point are pre-smoothed by caller
  if (Math.abs(zoomVelocity) > 0.001) {
    const intensity = Math.min(Math.abs(zoomVelocity) * 3, 0.35)
    const sat = 80
    const lum = isDark ? 30 : 70
    const focalPx = zoomFocalX * cssWidth
    const gradient = ctx.createRadialGradient(
      focalPx, centerY, 0,
      focalPx, centerY, cssWidth * 0.7
    )
    gradient.addColorStop(0, `hsla(${zoomHue}, ${sat}%, ${lum}%, ${intensity})`)
    gradient.addColorStop(1, `hsla(${zoomHue}, ${sat}%, ${lum}%, 0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, cssWidth, cssHeight)
  }

  // Draw horizontal axis line
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(cssWidth, centerY)
  ctx.strokeStyle = colors.axisLine
  ctx.lineWidth = 1
  ctx.stroke()

  // Compute ticks
  const ticks = computeTickMarks(state, cssWidth, thresholds)

  // Pre-compute screen positions
  const ticksWithX = ticks.map((tick) => ({
    tick,
    x: numberToScreenX(tick.value, state.center, state.pixelsPerUnit, cssWidth),
  }))

  // Compute per-power label rotation angle.
  // When labels fit horizontally: angle = 0. As they get more crowded the angle
  // increases smoothly.  At angle θ the horizontal footprint is labelWidth·cos(θ),
  // so the exact no-overlap angle is acos(spacing / labelWidth).
  const LABEL_PAD = 6
  const MAX_LABEL_ANGLE = Math.PI / 3 // cap at 60°
  const powerAngle = new Map<number, number>()

  const powerSpacingPx = new Map<number, number>()
  for (const { tick } of ticksWithX) {
    if (!powerSpacingPx.has(tick.power)) {
      const spacing = Math.pow(10, tick.power)
      powerSpacingPx.set(tick.power, spacing * state.pixelsPerUnit)
    }
  }

  // Measure a representative label for each power to compute the needed angle
  const measuredPowers = new Set<number>()
  for (const { tick } of ticksWithX) {
    if (measuredPowers.has(tick.power)) continue
    if (tick.opacity <= 0) continue
    measuredPowers.add(tick.power)

    const fontSize = getTickFontSize(tick.prominence)
    const fontWeight = getTickFontWeight(tick.prominence)
    ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

    const label = formatTickLabel(tick.value, tick.power)
    const labelWidth = ctx.measureText(label).width
    const spacingPx = powerSpacingPx.get(tick.power) ?? Infinity

    // ratio < 1 means labels overlap horizontally
    const ratio = Math.max(0, spacingPx - LABEL_PAD) / labelWidth
    if (ratio >= 1) {
      powerAngle.set(tick.power, 0)
    } else {
      // acos(ratio) gives the exact angle where labels just fit
      powerAngle.set(tick.power, Math.min(Math.acos(ratio), MAX_LABEL_ANGLE))
    }
  }

  // Pre-compute label info for cross-power collision detection.
  // Each label occupies a horizontal extent on the x-axis; when a lower-prominence
  // label overlaps a higher-prominence one, the lower-prominence label is hidden.
  interface LabelInfo {
    tick: typeof ticksWithX[number]['tick']
    x: number
    label: string
    fontSize: number
    fontWeight: number
    labelWidth: number
    angle: number
    height: number
    /** Horizontal extent: [xMin, xMax] on the canvas */
    xMin: number
    xMax: number
  }

  const labelInfos: LabelInfo[] = []
  for (const { tick, x } of ticksWithX) {
    if (x < -50 || x > cssWidth + 50) continue
    if (tick.opacity <= 0) continue

    const label = formatTickLabel(tick.value, tick.power)
    const fontSize = getTickFontSize(tick.prominence)
    const fontWeight = getTickFontWeight(tick.prominence)
    ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    const labelWidth = ctx.measureText(label).width
    const angle = powerAngle.get(tick.power) ?? 0
    const height = getTickHeight(tick.prominence, cssHeight)

    // Compute horizontal footprint of the (possibly rotated) label.
    // The label is drawn at (x, labelY) then rotated by angle.
    // Its horizontal extent is approximately labelWidth·cos(angle) + fontSize·sin(angle).
    const t = MAX_LABEL_ANGLE > 0 ? Math.min(angle / MAX_LABEL_ANGLE, 1) : 0
    const xOffset = -labelWidth / 2 * (1 - t)
    const hFootprint = labelWidth * Math.cos(angle) + fontSize * Math.sin(angle)
    const xMin = x + xOffset * Math.cos(angle)
    const xMax = xMin + hFootprint

    labelInfos.push({ tick, x, label, fontSize, fontWeight, labelWidth, angle, height, xMin, xMax })
  }

  // Sort by prominence descending so higher-prominence labels take priority
  labelInfos.sort((a, b) => b.tick.prominence - a.tick.prominence)

  // Mark which labels survive collision detection
  const labelVisible = new Set<LabelInfo>()
  const occupiedExtents: { xMin: number; xMax: number }[] = []

  for (const info of labelInfos) {
    const pad = LABEL_PAD / 2
    let overlaps = false
    for (const occ of occupiedExtents) {
      if (info.xMin - pad < occ.xMax && info.xMax + pad > occ.xMin) {
        overlaps = true
        break
      }
    }
    if (!overlaps) {
      labelVisible.add(info)
      occupiedExtents.push({ xMin: info.xMin, xMax: info.xMax })
    }
  }

  // Pass 1: tick lines
  for (const { tick, x } of ticksWithX) {
    if (x < -50 || x > cssWidth + 50) continue

    const height = getTickHeight(tick.prominence, cssHeight)
    const lineWidth = getTickLineWidth(tick.prominence)
    const tickAlpha = getTickAlpha(tick.prominence)

    ctx.globalAlpha = tick.opacity
    ctx.beginPath()
    ctx.moveTo(x, centerY - height)
    ctx.lineTo(x, centerY + height)
    ctx.strokeStyle = `rgba(${colors.tickRgb}, ${tickAlpha})`
    ctx.lineWidth = lineWidth
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Pass 2: labels with smooth collision fade.
  // All labels are rendered (not just visible ones) so that collision-hidden
  // labels can fade out over COLLISION_FADE_MS instead of disappearing instantly.
  const now = performance.now()
  let animating = false
  const seenValues = new Set<number>()

  for (const info of labelInfos) {
    const { tick, x, label, fontSize, fontWeight, labelWidth, angle, height } = info
    const isVisible = labelVisible.has(info)
    seenValues.add(tick.value)

    // Compute collision opacity (1 = fully visible, 0 = collision-hidden)
    let collisionOpacity = isVisible ? 1 : 0

    if (collisionFadeMap) {
      let entry = collisionFadeMap.get(tick.value)
      if (!entry) {
        // First time seeing this label — no fade, just snap to current state
        entry = { visible: isVisible, startTime: now, startOpacity: isVisible ? 1 : 0 }
        collisionFadeMap.set(tick.value, entry)
      } else if (entry.visible !== isVisible) {
        // Visibility changed — start transition from current animated position
        const elapsed = now - entry.startTime
        const t = Math.min(1, elapsed / COLLISION_FADE_MS)
        const prevTarget = entry.visible ? 1 : 0
        const currentOpacity = entry.startOpacity + (prevTarget - entry.startOpacity) * t
        entry.visible = isVisible
        entry.startTime = now
        entry.startOpacity = currentOpacity
      }

      const elapsed = now - entry.startTime
      const t = Math.min(1, elapsed / COLLISION_FADE_MS)
      const target = entry.visible ? 1 : 0
      collisionOpacity = entry.startOpacity + (target - entry.startOpacity) * t

      if (t < 1) animating = true
    }

    // Skip fully hidden labels
    if (collisionOpacity <= 0.01) continue

    const labelAlpha = getTickAlpha(tick.prominence)

    ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.globalAlpha = tick.opacity * collisionOpacity
    ctx.fillStyle = `rgba(${colors.labelRgb}, ${labelAlpha})`

    const labelY = centerY + height + 4

    // t: 0 = fully horizontal/centered, 1 = fully rotated/left-aligned
    const tAngle = MAX_LABEL_ANGLE > 0 ? Math.min(angle / MAX_LABEL_ANGLE, 1) : 0
    const xOffset = -labelWidth / 2 * (1 - tAngle)

    ctx.save()
    ctx.translate(x, labelY)
    ctx.rotate(angle)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(label, xOffset, 0)
    ctx.restore()

    ctx.globalAlpha = 1
  }

  // Clean up stale entries no longer in the viewport
  if (collisionFadeMap) {
    for (const key of collisionFadeMap.keys()) {
      if (!seenValues.has(key)) {
        collisionFadeMap.delete(key)
      }
    }
  }

  // Pass 3: target emoji (Find the Number game)
  if (target && target.opacity > 0) {
    const tx = numberToScreenX(target.value, state.center, state.pixelsPerUnit, cssWidth)
    // Scale emoji size with opacity: 24px at low opacity, 40px at full
    const emojiSize = 24 + 16 * target.opacity
    // Pulsing glow when nearly found
    if (target.opacity > 0.8) {
      const pulsePhase = (Date.now() % 1500) / 1500
      const pulseAlpha = 0.15 + 0.1 * Math.sin(pulsePhase * Math.PI * 2)
      const glowRadius = emojiSize * 1.2
      const glow = ctx.createRadialGradient(tx, centerY, 0, tx, centerY, glowRadius)
      glow.addColorStop(0, `hsla(45, 100%, 60%, ${pulseAlpha * target.opacity})`)
      glow.addColorStop(1, `hsla(45, 100%, 60%, 0)`)
      ctx.globalAlpha = 1
      ctx.fillStyle = glow
      ctx.fillRect(tx - glowRadius, centerY - glowRadius, glowRadius * 2, glowRadius * 2)
    }

    ctx.globalAlpha = target.opacity
    ctx.font = `${emojiSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = isDark ? '#fff' : '#000'
    ctx.fillText(target.emoji, tx, centerY)
    ctx.globalAlpha = 1
  }

  return animating
}
