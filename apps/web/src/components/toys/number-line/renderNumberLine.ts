import type { NumberLineState, TickMark, TickThresholds } from './types'
import { DEFAULT_TICK_THRESHOLDS } from './types'
import { computeTickMarks, numberToScreenX } from './numberLineTicks'

interface RenderColors {
  axisLine: string
  tickAnchor: string
  tickMedium: string
  tickFine: string
  labelAnchor: string
  labelMedium: string
}

const LIGHT_COLORS: RenderColors = {
  axisLine: 'rgba(55, 65, 81, 0.8)',
  tickAnchor: 'rgba(55, 65, 81, 1)',
  tickMedium: 'rgba(55, 65, 81, 0.5)',
  tickFine: 'rgba(55, 65, 81, 0.15)',
  labelAnchor: 'rgba(17, 24, 39, 1)',
  labelMedium: 'rgba(55, 65, 81, 0.7)',
}

const DARK_COLORS: RenderColors = {
  axisLine: 'rgba(209, 213, 219, 0.8)',
  tickAnchor: 'rgba(209, 213, 219, 1)',
  tickMedium: 'rgba(209, 213, 219, 0.5)',
  tickFine: 'rgba(209, 213, 219, 0.15)',
  labelAnchor: 'rgba(243, 244, 246, 1)',
  labelMedium: 'rgba(209, 213, 219, 0.7)',
}

function getTickHeight(tickClass: TickMark['tickClass'], canvasHeight: number): number {
  const maxHeight = canvasHeight / 2
  switch (tickClass) {
    case 'anchor':
      return Math.min(maxHeight * 0.6, 40)
    case 'medium':
      return Math.min(maxHeight * 0.4, 24)
    case 'fine':
      return Math.min(maxHeight * 0.2, 12)
  }
}

function getTickLineWidth(tickClass: TickMark['tickClass']): number {
  switch (tickClass) {
    case 'anchor':
      return 2
    case 'medium':
      return 1.5
    case 'fine':
      return 1
  }
}

function getTickColor(tickClass: TickMark['tickClass'], colors: RenderColors): string {
  switch (tickClass) {
    case 'anchor':
      return colors.tickAnchor
    case 'medium':
      return colors.tickMedium
    case 'fine':
      return colors.tickFine
  }
}

/** Format a number for display as a tick label, using the tick's power for precision */
function formatTickLabel(value: number, power: number): string {
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
  zoomFocalX = 0.5
): void {
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
    if (tick.tickClass === 'fine' && tick.opacity <= 0) continue
    measuredPowers.add(tick.power)

    const fontSize = tick.tickClass === 'anchor' ? 13 : 11
    const fontWeight = tick.tickClass === 'anchor' ? '600' : '400'
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

  // Pass 1: tick lines
  for (const { tick, x } of ticksWithX) {
    if (x < -50 || x > cssWidth + 50) continue

    const height = getTickHeight(tick.tickClass, cssHeight)
    const lineWidth = getTickLineWidth(tick.tickClass)
    const color = getTickColor(tick.tickClass, colors)

    ctx.globalAlpha = tick.opacity
    ctx.beginPath()
    ctx.moveTo(x, centerY - height)
    ctx.lineTo(x, centerY + height)
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Pass 2: labels — angle and x-offset both interpolate smoothly.
  // At angle 0 the label is centered (x offset = -width/2).
  // At max angle the label is left-aligned at the tick (x offset = 0).
  for (const { tick, x } of ticksWithX) {
    if (x < -50 || x > cssWidth + 50) continue
    if (tick.tickClass === 'fine' && tick.opacity <= 0) continue

    const height = getTickHeight(tick.tickClass, cssHeight)
    const label = formatTickLabel(tick.value, tick.power)
    const fontSize = tick.tickClass === 'anchor' ? 13 : 11
    const fontWeight = tick.tickClass === 'anchor' ? '600' : '400'
    const labelColor =
      tick.tickClass === 'anchor' ? colors.labelAnchor : colors.labelMedium

    ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.globalAlpha = tick.opacity
    ctx.fillStyle = labelColor

    const labelY = centerY + height + 4
    const angle = powerAngle.get(tick.power) ?? 0

    // t: 0 = fully horizontal/centered, 1 = fully rotated/left-aligned
    const t = MAX_LABEL_ANGLE > 0 ? Math.min(angle / MAX_LABEL_ANGLE, 1) : 0
    const labelWidth = ctx.measureText(label).width
    const xOffset = -labelWidth / 2 * (1 - t)

    ctx.save()
    ctx.translate(x, labelY)
    ctx.rotate(angle)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(label, xOffset, 0)
    ctx.restore()

    ctx.globalAlpha = 1
  }
}
