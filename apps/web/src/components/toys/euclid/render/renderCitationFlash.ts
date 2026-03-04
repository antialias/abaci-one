import type { EuclidViewportState } from '../types'
import { CITATIONS } from '../engine/citations'

const FLASH_DURATION = 1200 // ms total
const FADE_IN_END = 100 // ms
const FADE_OUT_START = 900 // ms
const FLOAT_DISTANCE = 8 // px over lifetime
const FONT_SIZE = 12
const COLOR = '#F0C75E'

// ── Discriminated union ──────────────────────────────────────────

export type CitationFlash =
  | {
      type: 'segment'
      startTime: number
      citation: string
      fromX: number
      fromY: number
      toX: number
      toY: number
    }
  | {
      type: 'circle'
      startTime: number
      citation: string
      centerX: number
      centerY: number
      radius: number
    }
  | {
      type: 'extend'
      startTime: number
      citation: string
      throughX: number
      throughY: number
      endX: number
      endY: number
    }
  | {
      type: 'point'
      startTime: number
      citation: string
      worldX: number
      worldY: number
    }

/** Distributive Omit that works across union members */
export type CitationFlashInit = CitationFlash extends infer T
  ? T extends CitationFlash
    ? Omit<T, 'startTime'>
    : never
  : never

// ── Coordinate conversion ────────────────────────────────────────

function toScreen(
  wx: number,
  wy: number,
  viewport: EuclidViewportState,
  w: number,
  h: number
): { sx: number; sy: number } {
  const sx = w / 2 + (wx - viewport.center.x) * viewport.pixelsPerUnit
  const sy = h / 2 - (wy - viewport.center.y) * viewport.pixelsPerUnit
  return { sx, sy }
}

// ── Shared rendering helpers (exported for tool overlay preview) ──

/**
 * Render a label aligned parallel to a line segment.
 * `angle` is screen-space radians from atan2(dy, dx).
 * Text is offset perpendicular to the line so it doesn't overlap.
 */
export function renderLineAlignedLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  sx: number,
  sy: number,
  angle: number,
  alpha: number,
  fontSize: number,
  perpOffset: number
) {
  // Prevent upside-down text: flip by PI if needed
  let drawAngle = angle
  if (drawAngle > Math.PI / 2) drawAngle -= Math.PI
  else if (drawAngle < -Math.PI / 2) drawAngle += Math.PI

  // Perpendicular offset uses the ORIGINAL angle so the direction is
  // consistent regardless of the upside-down text flip
  const offX = -Math.sin(angle) * perpOffset
  const offY = Math.cos(angle) * perpOffset

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `${fontSize}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
  ctx.shadowBlur = 3
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 1
  ctx.fillStyle = COLOR
  ctx.translate(sx + offX, sy + offY)
  ctx.rotate(drawAngle)
  ctx.fillText(label, 0, 0)
  ctx.restore()
}

/**
 * Render a label curved along a circle's circumference.
 * Characters are placed individually along the arc, centered at the top.
 * Falls back to flat text above center for small circles (< 30px radius).
 */
export function renderArcLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  cx: number,
  cy: number,
  radius: number,
  alpha: number,
  fontSize: number
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `${fontSize}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
  ctx.shadowBlur = 3
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 1
  ctx.fillStyle = COLOR

  // Small-circle fallback: flat text above center
  if (radius < 30) {
    ctx.fillText(label, cx, cy - radius - 10)
    ctx.restore()
    return
  }

  // Place characters along the arc at the top of the circle
  const textRadius = radius + 6
  // Measure total angular width
  const charWidths: number[] = []
  let totalAngularWidth = 0
  for (const char of label) {
    const w = ctx.measureText(char).width
    const angularW = w / textRadius
    charWidths.push(angularW)
    totalAngularWidth += angularW
  }

  // Start angle: centered at top of circle (screen angle -PI/2)
  let currentAngle = -Math.PI / 2 - totalAngularWidth / 2

  for (let i = 0; i < label.length; i++) {
    const charAngle = currentAngle + charWidths[i] / 2

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(charAngle)
    ctx.translate(textRadius, 0) // move along radius to circumference
    ctx.rotate(Math.PI / 2) // align with tangent direction
    ctx.textBaseline = 'bottom' // text renders outside the circle
    ctx.fillText(label[i], 0, 0)
    ctx.restore()

    currentAngle += charWidths[i]
  }

  ctx.restore()
}

// ── Main flash renderer ──────────────────────────────────────────

/**
 * Render citation flash labels on the canvas.
 *
 * Returns the subset of flashes that are still animating (caller should
 * replace its array with this return value to prune expired flashes).
 */
export function renderCitationFlashes(
  ctx: CanvasRenderingContext2D,
  flashes: CitationFlash[],
  viewport: EuclidViewportState,
  w: number,
  h: number,
  now: number
): CitationFlash[] {
  const surviving: CitationFlash[] = []

  for (const flash of flashes) {
    const elapsed = now - flash.startTime
    if (elapsed >= FLASH_DURATION) continue

    surviving.push(flash)

    const t = elapsed / FLASH_DURATION // 0 -> 1

    // Alpha: fade in 0->100ms, hold 100->900ms, fade out 900->1200ms
    let alpha: number
    if (elapsed < FADE_IN_END) {
      alpha = elapsed / FADE_IN_END
    } else if (elapsed < FADE_OUT_START) {
      alpha = 1
    } else {
      alpha = 1 - (elapsed - FADE_OUT_START) / (FLASH_DURATION - FADE_OUT_START)
    }

    const label = CITATIONS[flash.citation]?.label ?? flash.citation

    switch (flash.type) {
      case 'segment':
      case 'extend': {
        const from =
          flash.type === 'segment'
            ? toScreen(flash.fromX, flash.fromY, viewport, w, h)
            : toScreen(flash.throughX, flash.throughY, viewport, w, h)
        const to =
          flash.type === 'segment'
            ? toScreen(flash.toX, flash.toY, viewport, w, h)
            : toScreen(flash.endX, flash.endY, viewport, w, h)

        const midX = (from.sx + to.sx) / 2
        const midY = (from.sy + to.sy) / 2
        const angle = Math.atan2(to.sy - from.sy, to.sx - from.sx)

        // Perpendicular float: offset grows over lifetime
        // Negative so label stays on the working-edge side (opposite the straightedge bar)
        const perpOffset = -(10 + t * FLOAT_DISTANCE)

        // Skip label for very short segments (< 40px)
        const segLen = Math.sqrt((to.sx - from.sx) ** 2 + (to.sy - from.sy) ** 2)
        if (segLen < 40) continue

        renderLineAlignedLabel(ctx, label, midX, midY, angle, alpha, FONT_SIZE, perpOffset)
        break
      }

      case 'circle': {
        const sc = toScreen(flash.centerX, flash.centerY, viewport, w, h)
        const radiusScreen = flash.radius * viewport.pixelsPerUnit

        // Radial float: text drifts outward over lifetime
        const driftRadius = radiusScreen + t * FLOAT_DISTANCE

        if (driftRadius < 30) {
          // Small circle fallback: flat text above
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.font = `${FONT_SIZE}px system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
          ctx.shadowBlur = 3
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = 1
          ctx.fillStyle = COLOR
          ctx.fillText(label, sc.sx, sc.sy - driftRadius - 10)
          ctx.restore()
        } else {
          renderArcLabel(ctx, label, sc.sx, sc.sy, driftRadius, alpha, FONT_SIZE)
        }
        break
      }

      case 'point': {
        const sp = toScreen(flash.worldX, flash.worldY, viewport, w, h)
        // Float upward over lifetime
        const floatOffset = t * FLOAT_DISTANCE

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.font = `${FONT_SIZE}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
        ctx.shadowBlur = 3
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 1
        ctx.fillStyle = COLOR
        ctx.fillText(label, sp.sx, sp.sy - 28 - floatOffset)
        ctx.restore()
        break
      }
    }
  }

  return surviving
}
