import type { EuclidViewportState, GhostLayer } from '../types'
import { worldToScreen2D } from '../../shared/coordinateConversions'

function toScreen(wx: number, wy: number, viewport: EuclidViewportState, w: number, h: number) {
  return worldToScreen2D(
    wx,
    wy,
    viewport.center.x,
    viewport.center.y,
    viewport.pixelsPerUnit,
    viewport.pixelsPerUnit,
    w,
    h
  )
}

/** Lerp factor per frame (~60fps). Gives ~150ms transition. */
const LERP_SPEED = 0.15

// ── Ghost opacity controls ──

// Base opacity at rest for depth 1. Hover brightens to ~4x this value.
let ghostBaseOpacity = 0.2
export function getGhostBaseOpacity() {
  return ghostBaseOpacity
}
export function setGhostBaseOpacity(v: number) {
  ghostBaseOpacity = Math.max(0, Math.min(1, v))
}
export function getGhostBaseOpacityRange() {
  return { min: 0, max: 0.5 }
}

// Depth falloff: 0 = no backoff, 1 = immediate backoff (depth > 1 invisible)
let ghostFalloff = 0.75
export function getGhostFalloff() {
  return ghostFalloff
}
export function setGhostFalloff(v: number) {
  ghostFalloff = Math.max(0, Math.min(1, v))
}
export function getGhostFalloffRange() {
  return { min: 0, max: 1 }
}

/**
 * Compute depth-based opacity multiplier.
 * falloff=0 → 1 for all depths (no backoff)
 * falloff=1 → 0 for depth > 1 (immediate cutoff)
 */
function depthFactor(depth: number): number {
  return Math.max(0, 1 - ghostFalloff * (depth - 1))
}

/**
 * Render ghost geometry layers with depth-based opacity and smooth hover transitions.
 *
 * Ghost geometry represents the internal construction elements that macro
 * invocations skip — e.g. the two circles whose intersection proves I.1's
 * equilateral triangle. They appear as faint dashed outlines at rest and
 * brighten when the user hovers the corresponding step in the proof panel.
 *
 * @returns true if opacity is still animating (caller should keep drawing)
 */
export function renderGhostGeometry(
  ctx: CanvasRenderingContext2D,
  ghostLayers: GhostLayer[],
  viewport: EuclidViewportState,
  w: number,
  h: number,
  hoveredMacroStep: number | null,
  opacities: Map<string, number>
): boolean {
  if (ghostLayers.length === 0) return false

  const ppu = viewport.pixelsPerUnit
  let stillAnimating = false

  for (const layer of ghostLayers) {
    const df = depthFactor(layer.depth)
    if (df <= 0) continue // this depth is invisible at current falloff

    // Target opacity: brightened if hovered, faint watermark otherwise
    const isHovered = hoveredMacroStep === layer.atStep
    const baseAlpha = isHovered ? Math.min(1, ghostBaseOpacity * 4) : ghostBaseOpacity
    const targetAlpha = baseAlpha * df

    // Key by step+depth so layers at different depths don't clobber each other
    const key = `${layer.atStep}:${layer.depth}`
    const currentAlpha = opacities.get(key) ?? targetAlpha
    const newAlpha = currentAlpha + (targetAlpha - currentAlpha) * LERP_SPEED

    // Snap if close enough
    const finalAlpha = Math.abs(newAlpha - targetAlpha) < 0.005 ? targetAlpha : newAlpha
    opacities.set(key, finalAlpha)

    if (finalAlpha !== targetAlpha) {
      stillAnimating = true
    }

    ctx.save()
    ctx.globalAlpha = finalAlpha

    for (const el of layer.elements) {
      if (el.kind === 'circle') {
        const center = toScreen(el.cx, el.cy, viewport, w, h)
        const screenR = el.r * ppu
        ctx.beginPath()
        ctx.arc(center.x, center.y, screenR, 0, Math.PI * 2)
        ctx.strokeStyle = el.color
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 4])
        ctx.stroke()
        ctx.setLineDash([])
      } else if (el.kind === 'segment') {
        const from = toScreen(el.x1, el.y1, viewport, w, h)
        const to = toScreen(el.x2, el.y2, viewport, w, h)
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(to.x, to.y)
        ctx.strokeStyle = el.color
        if (el.isProduction) {
          // Post.2 production: thinner + reduced opacity
          ctx.lineWidth = 1
          ctx.globalAlpha = finalAlpha * 0.5
        } else {
          ctx.lineWidth = 1.5
        }
        ctx.setLineDash([6, 4])
        ctx.stroke()
        ctx.setLineDash([])
        if (el.isProduction) {
          ctx.globalAlpha = finalAlpha // restore layer alpha
        }
      } else if (el.kind === 'point') {
        const pos = toScreen(el.x, el.y, viewport, w, h)
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = el.color
        ctx.fill()
      }
    }

    ctx.restore()
  }

  return stillAnimating
}
