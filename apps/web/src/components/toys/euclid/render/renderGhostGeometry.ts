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
 * @param ceremonyRevealCounts  During the macro reveal ceremony, maps layer key
 *   (`${atStep}:${depth}`) → number of revealGroups revealed so far.
 *   When present, overrides the normal hover/watermark opacity.
 * @returns true if opacity is still animating (caller should keep drawing)
 */
export function renderGhostGeometry(
  ctx: CanvasRenderingContext2D,
  ghostLayers: GhostLayer[],
  viewport: EuclidViewportState,
  w: number,
  h: number,
  hoveredMacroStep: number | null,
  opacities: Map<string, number>,
  ceremonyRevealCounts?: Map<string, number> | null,
  elementAnims?: Map<string, { startMs: number; durationMs: number }> | null,
  now?: number
): boolean {
  if (ghostLayers.length === 0) return false

  const ppu = viewport.pixelsPerUnit
  let stillAnimating = false

  for (const layer of ghostLayers) {
    const df = depthFactor(layer.depth)
    if (df <= 0) continue // this depth is invisible at current falloff

    const key = `${layer.atStep}:${layer.depth}`
    // A layer is in the ceremony only if it appears in the ceremony map
    const inLayerCeremony =
      ceremonyRevealCounts != null && ceremonyRevealCounts.has(key)

    let targetAlpha: number
    if (inLayerCeremony) {
      // During ceremony for this layer: revealed groups at 0.75, unrevealed at 0
      const revealedGroups = ceremonyRevealCounts!.get(key) ?? 0
      targetAlpha = revealedGroups > 0 ? 0.75 * df : 0
    } else {
      // Normal mode: brightened if hovered, faint watermark otherwise
      const isHovered = hoveredMacroStep === layer.atStep
      const baseAlpha = isHovered ? Math.min(1, ghostBaseOpacity * 4) : ghostBaseOpacity
      targetAlpha = baseAlpha * df
    }

    const currentAlpha = opacities.get(key) ?? targetAlpha
    const newAlpha = currentAlpha + (targetAlpha - currentAlpha) * LERP_SPEED
    const finalAlpha = Math.abs(newAlpha - targetAlpha) < 0.005 ? targetAlpha : newAlpha
    opacities.set(key, finalAlpha)

    if (finalAlpha !== targetAlpha) stillAnimating = true
    if (finalAlpha < 0.005) continue

    // Build set of visible element indices for ceremony mode
    let visibleIndices: Set<number> | null = null
    if (inLayerCeremony && layer.revealGroups) {
      const revealedGroups = ceremonyRevealCounts!.get(key) ?? 0
      visibleIndices = new Set<number>()
      for (let g = 0; g < revealedGroups && g < layer.revealGroups.length; g++) {
        for (const idx of layer.revealGroups[g]) visibleIndices.add(idx)
      }
    }

    ctx.save()
    ctx.globalAlpha = finalAlpha

    layer.elements.forEach((el, idx) => {
      if (visibleIndices && !visibleIndices.has(idx)) return

      // Compute draw progress for animated ceremony reveals
      const animKey = `${key}:${idx}`
      const anim = elementAnims?.get(animKey)
      let drawProgress = 1
      if (anim && anim.durationMs > 0 && now !== undefined) {
        drawProgress = Math.min(1, (now - anim.startMs) / anim.durationMs)
        if (drawProgress < 1) stillAnimating = true
      }

      if (el.kind === 'circle') {
        const center = toScreen(el.cx, el.cy, viewport, w, h)
        const screenR = el.r * ppu
        ctx.beginPath()
        if (drawProgress >= 1) {
          ctx.arc(center.x, center.y, screenR, 0, Math.PI * 2)
        } else {
          // Sweep clockwise from the top (−π/2), like a compass
          const startAngle = -Math.PI / 2
          ctx.arc(center.x, center.y, screenR, startAngle, startAngle + drawProgress * Math.PI * 2)
        }
        ctx.strokeStyle = el.color
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 4])
        ctx.stroke()
        ctx.setLineDash([])
      } else if (el.kind === 'segment') {
        const from = toScreen(el.x1, el.y1, viewport, w, h)
        const toFull = toScreen(el.x2, el.y2, viewport, w, h)
        // Ease-out so the line slows to a stop, matching straightedge draw feel
        const eased = drawProgress < 1 ? 1 - (1 - drawProgress) * (1 - drawProgress) : 1
        const to = {
          x: from.x + eased * (toFull.x - from.x),
          y: from.y + eased * (toFull.y - from.y),
        }
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(to.x, to.y)
        ctx.strokeStyle = el.color
        if (el.isProduction) {
          ctx.lineWidth = 1
          ctx.globalAlpha = finalAlpha * 0.5
        } else {
          ctx.lineWidth = 1.5
        }
        ctx.setLineDash([6, 4])
        ctx.stroke()
        ctx.setLineDash([])
        if (el.isProduction) ctx.globalAlpha = finalAlpha
      } else if (el.kind === 'point') {
        const pos = toScreen(el.x, el.y, viewport, w, h)
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = el.color
        ctx.fill()
      }
    })

    ctx.restore()
  }

  return stillAnimating
}
