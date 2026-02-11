import type { RenderConstant } from '../types'

const MARKER_LINE_WIDTH = 1.5

/** Gap between the top of the tallest tick and where the DOM symbol sits */
export const SYMBOL_GAP_ABOVE_TICKS = 6

const COLOR_LIGHT = '#4338ca' // deep indigo
const COLOR_DARK = '#f59e0b' // bright amber

export { COLOR_LIGHT as CONSTANT_COLOR_LIGHT, COLOR_DARK as CONSTANT_COLOR_DARK }

/**
 * Render dashed drop lines from constant symbol positions down to the axis.
 *
 * The symbols themselves are rendered as MathML DOM elements (see updateConstantMarkerDOM).
 * This canvas pass draws only the connecting lines.
 */
export function renderConstantDropLines(
  ctx: CanvasRenderingContext2D,
  constants: RenderConstant[],
  centerY: number,
  isDark: boolean,
  maxTickHeight: number
): void {
  if (constants.length === 0) return

  const color = isDark ? COLOR_DARK : COLOR_LIGHT
  const symbolBottomY = centerY - maxTickHeight - SYMBOL_GAP_ABOVE_TICKS

  for (const c of constants) {
    if (c.opacity <= 0) continue

    ctx.globalAlpha = c.opacity
    ctx.beginPath()
    ctx.moveTo(c.screenX, symbolBottomY)
    ctx.lineTo(c.screenX, centerY)
    ctx.strokeStyle = color
    ctx.lineWidth = MARKER_LINE_WIDTH
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }
}
