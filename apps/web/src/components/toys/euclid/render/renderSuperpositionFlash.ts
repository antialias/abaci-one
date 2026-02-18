import type { ConstructionState, EuclidViewportState } from '../types'
import { getPoint } from '../engine/constructionState'

const FLASH_DURATION = 1200 // ms total
const FILL_COLOR = '#F0C75E'
const FILL_ALPHA = 0.15
const PULSE_STAGGER = 200 // ms between vertex pulses
const PULSE_MAX_RADIUS = 20 // px
const PULSE_START_ALPHA = 0.6

export interface SuperpositionFlash {
  startTime: number
  /** Resolved screen positions for vertex correspondence pairs */
  pairs: Array<{ src: string; tgt: string }>
  /** Triangle vertex IDs for fill rendering */
  triA: [string, string, string]
  triB: [string, string, string]
}

/** Convert world coordinates to screen coordinates */
function toScreen(
  wx: number, wy: number,
  viewport: EuclidViewportState,
  w: number, h: number,
): { sx: number; sy: number } {
  const sx = w / 2 + (wx - viewport.center.x) * viewport.pixelsPerUnit
  const sy = h / 2 - (wy - viewport.center.y) * viewport.pixelsPerUnit
  return { sx, sy }
}

/**
 * Render the superposition flash animation for C.N.4.
 *
 * - Semi-transparent gold fill on both triangles
 * - Vertex correspondence pulses (expanding rings) staggered 200ms apart
 * - All fades out over ~1200ms
 *
 * Returns true while still animating (to keep RAF pumping).
 */
export function renderSuperpositionFlash(
  ctx: CanvasRenderingContext2D,
  flash: SuperpositionFlash,
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number, h: number,
  now: number,
): boolean {
  const elapsed = now - flash.startTime
  if (elapsed >= FLASH_DURATION) return false

  const t = elapsed / FLASH_DURATION // 0 → 1
  const fadeAlpha = 1 - t

  // ── Triangle fills ──
  const triVerts = [flash.triA, flash.triB]
  for (const tri of triVerts) {
    const pts = tri.map(id => {
      const p = getPoint(state, id)
      if (!p) return null
      return toScreen(p.x, p.y, viewport, w, h)
    })
    if (pts.some(p => p === null)) continue

    ctx.beginPath()
    ctx.moveTo(pts[0]!.sx, pts[0]!.sy)
    ctx.lineTo(pts[1]!.sx, pts[1]!.sy)
    ctx.lineTo(pts[2]!.sx, pts[2]!.sy)
    ctx.closePath()
    ctx.fillStyle = FILL_COLOR
    ctx.globalAlpha = FILL_ALPHA * fadeAlpha
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // ── Vertex correspondence pulses ──
  for (let i = 0; i < flash.pairs.length; i++) {
    const pair = flash.pairs[i]
    const pulseStart = i * PULSE_STAGGER
    const pulseElapsed = elapsed - pulseStart
    if (pulseElapsed < 0) continue

    const pulseDuration = FLASH_DURATION - pulseStart
    if (pulseElapsed >= pulseDuration) continue

    const pt = pulseElapsed / pulseDuration
    const radius = pt * PULSE_MAX_RADIUS
    const alpha = PULSE_START_ALPHA * (1 - pt)

    // Draw pulse at both source and target vertices
    for (const id of [pair.src, pair.tgt]) {
      const p = getPoint(state, id)
      if (!p) continue
      const s = toScreen(p.x, p.y, viewport, w, h)

      ctx.beginPath()
      ctx.arc(s.sx, s.sy, radius, 0, 2 * Math.PI)
      ctx.strokeStyle = FILL_COLOR
      ctx.lineWidth = 2
      ctx.globalAlpha = alpha
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  return true // still animating
}
