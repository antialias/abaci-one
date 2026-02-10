import type { NumberLineState, TickMark } from './types'
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

/** Format a number for display as a tick label */
function formatTickLabel(value: number): string {
  // Use scientific notation for very large or very small numbers
  if (value !== 0 && (Math.abs(value) >= 1e7 || Math.abs(value) < 1e-4)) {
    return value.toExponential()
  }
  // Use locale formatting for normal numbers
  return value.toLocaleString(undefined, { maximumFractionDigits: 10 })
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
  isDark: boolean
): void {
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS
  const centerY = cssHeight / 2

  // Clear
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  // Draw horizontal axis line
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(cssWidth, centerY)
  ctx.strokeStyle = colors.axisLine
  ctx.lineWidth = 1
  ctx.stroke()

  // Compute ticks
  const ticks = computeTickMarks(state, cssWidth)

  // Draw ticks
  for (const tick of ticks) {
    const x = numberToScreenX(tick.value, state.center, state.pixelsPerUnit, cssWidth)

    // Skip ticks outside visible area (with small margin for labels)
    if (x < -50 || x > cssWidth + 50) continue

    const height = getTickHeight(tick.tickClass, cssHeight)
    const lineWidth = getTickLineWidth(tick.tickClass)
    const color = getTickColor(tick.tickClass, colors)

    // Draw tick line
    ctx.beginPath()
    ctx.moveTo(x, centerY - height)
    ctx.lineTo(x, centerY + height)
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.stroke()

    // Draw label for anchor and medium ticks
    if (tick.tickClass !== 'fine') {
      const label = formatTickLabel(tick.value)
      const fontSize = tick.tickClass === 'anchor' ? 13 : 11
      const fontWeight = tick.tickClass === 'anchor' ? '600' : '400'
      const labelColor =
        tick.tickClass === 'anchor' ? colors.labelAnchor : colors.labelMedium

      ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
      ctx.fillStyle = labelColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(label, x, centerY + height + 4)
    }
  }
}
