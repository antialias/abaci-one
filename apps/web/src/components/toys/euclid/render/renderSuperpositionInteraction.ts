/**
 * Render the interactive superposition cutout, shadow, ghost, and target glow.
 *
 * Returns true if still animating (needs continued redraw).
 */
import type { ConstructionState, EuclidViewportState, SuperpositionPhase, Vec2 } from '../types'
import { getPoint } from '../engine/constructionState'
import { triangleCentroid, flipVertex, lerpVertices } from '../engine/superpositionMath'

// ── Constants ──
const PAPER_FILL = '#FFF8ED'
const PAPER_BACK_FILL = '#F5ECD7'
const PAPER_BORDER = '#8B7355'
const SHADOW_COLOR = 'rgba(0,0,0,0.15)'
const SHADOW_OFFSET = 4
const SHADOW_BLUR = 8
const TARGET_GLOW_COLOR_BASE = 'rgba(240,199,94,'
const GHOST_DASH = [6, 4]
const GHOST_ALPHA = 0.3
const SETTLED_FILL = '#F0C75E'
const SETTLED_ALPHA = 0.18

const LIFT_DURATION = 300
const FLIP_DURATION = 800
const SNAP_DURATION = 200
const MISMATCH_WOBBLE_DURATION = 400

/** Convert world to screen coords */
function toScreen(
  wx: number,
  wy: number,
  viewport: EuclidViewportState,
  w: number,
  h: number
): Vec2 {
  return {
    x: w / 2 + (wx - viewport.center.x) * viewport.pixelsPerUnit,
    y: h / 2 - (wy - viewport.center.y) * viewport.pixelsPerUnit,
  }
}

/** Draw a triangle path from 3 screen-space vertices */
function triPath(ctx: CanvasRenderingContext2D, pts: [Vec2, Vec2, Vec2]): void {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  ctx.lineTo(pts[1].x, pts[1].y)
  ctx.lineTo(pts[2].x, pts[2].y)
  ctx.closePath()
}

/** Get world-space vertices from construction state by IDs */
function getConstructionVerts(
  state: ConstructionState,
  ids: [string, string, string]
): [Vec2, Vec2, Vec2] | null {
  const pts = ids.map((id) => getPoint(state, id))
  if (pts.some((p) => !p)) return null
  return pts.map((p) => ({ x: p!.x, y: p!.y })) as [Vec2, Vec2, Vec2]
}

/** Convert world-space vertices to screen-space */
function vertsToScreen(
  verts: [Vec2, Vec2, Vec2],
  viewport: EuclidViewportState,
  w: number,
  h: number
): [Vec2, Vec2, Vec2] {
  return verts.map((v) => toScreen(v.x, v.y, viewport, w, h)) as [Vec2, Vec2, Vec2]
}

/** Draw the paper cutout with shadow */
function drawCutout(
  ctx: CanvasRenderingContext2D,
  screenVerts: [Vec2, Vec2, Vec2],
  fill: string,
  shadowIntensity: number = 1
): void {
  // Shadow
  if (shadowIntensity > 0) {
    ctx.save()
    ctx.globalAlpha = shadowIntensity
    ctx.shadowColor = SHADOW_COLOR
    ctx.shadowBlur = SHADOW_BLUR
    ctx.shadowOffsetX = SHADOW_OFFSET
    ctx.shadowOffsetY = SHADOW_OFFSET
    triPath(ctx, screenVerts)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.restore()
  }

  // Main fill (no shadow)
  ctx.save()
  triPath(ctx, screenVerts)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = PAPER_BORDER
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()
}

/** Draw the source triangle ghost (dashed outline at original position) */
function drawGhost(
  ctx: CanvasRenderingContext2D,
  srcIds: [string, string, string],
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number
): void {
  const srcVerts = getConstructionVerts(state, srcIds)
  if (!srcVerts) return
  const screenVerts = vertsToScreen(srcVerts, viewport, w, h)

  ctx.save()
  ctx.globalAlpha = GHOST_ALPHA
  ctx.setLineDash(GHOST_DASH)
  ctx.strokeStyle = PAPER_BORDER
  ctx.lineWidth = 1.5
  triPath(ctx, screenVerts)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

/** Draw the target triangle with a pulsing gold glow */
function drawTargetGlow(
  ctx: CanvasRenderingContext2D,
  tgtIds: [string, string, string],
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  now: number
): void {
  const tgtVerts = getConstructionVerts(state, tgtIds)
  if (!tgtVerts) return
  const screenVerts = vertsToScreen(tgtVerts, viewport, w, h)

  // Sine wave pulse: 0 → 0.12 alpha over 2s period
  const pulse = ((Math.sin((now / 1000) * Math.PI) + 1) / 2) * 0.12

  ctx.save()
  triPath(ctx, screenVerts)
  ctx.fillStyle = TARGET_GLOW_COLOR_BASE + pulse.toFixed(3) + ')'
  ctx.fill()
  ctx.restore()
}

/**
 * Dim the source triangle's sides on the canvas.
 * We overlay a semi-transparent background rectangle on the source segments.
 */
function dimSourceTriangle(
  ctx: CanvasRenderingContext2D,
  srcIds: [string, string, string],
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number
): void {
  const srcVerts = getConstructionVerts(state, srcIds)
  if (!srcVerts) return
  const screenVerts = vertsToScreen(srcVerts, viewport, w, h)

  // Draw semi-transparent white over the source triangle to "dim" it
  ctx.save()
  ctx.globalAlpha = 0.7
  triPath(ctx, screenVerts)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.restore()
}

export function renderSuperpositionInteraction(
  ctx: CanvasRenderingContext2D,
  phase: SuperpositionPhase,
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  now: number
): boolean {
  if (phase.tag === 'idle') return false

  if (phase.tag === 'lifting') {
    const elapsed = now - phase.startTime
    const t = Math.min(1, elapsed / LIFT_DURATION)

    // Dim source triangle
    dimSourceTriangle(ctx, phase.srcTriIds, state, viewport, w, h)

    // Lift source triangle — paper fill with growing shadow
    const srcVerts = getConstructionVerts(state, phase.srcTriIds)
    if (srcVerts) {
      // Scale up 5% from centroid
      const centroid = triangleCentroid(srcVerts[0], srcVerts[1], srcVerts[2])
      const scale = 1 + 0.05 * t
      const scaled = srcVerts.map((v) => ({
        x: centroid.x + (v.x - centroid.x) * scale,
        y: centroid.y + (v.y - centroid.y) * scale,
      })) as [Vec2, Vec2, Vec2]
      const screenVerts = vertsToScreen(scaled, viewport, w, h)
      drawCutout(ctx, screenVerts, PAPER_FILL, t)
    }

    // Target glow
    drawTargetGlow(ctx, phase.tgtTriIds, state, viewport, w, h, now)

    return true // still animating
  }

  if (phase.tag === 'dragging') {
    // Dim source + draw ghost
    dimSourceTriangle(ctx, phase.srcTriIds, state, viewport, w, h)
    drawGhost(ctx, phase.srcTriIds, state, viewport, w, h)

    // Target glow
    drawTargetGlow(ctx, phase.tgtTriIds, state, viewport, w, h, now)

    // Cutout
    const screenVerts = vertsToScreen(phase.cutoutVertices, viewport, w, h)
    drawCutout(ctx, screenVerts, PAPER_FILL)

    return true
  }

  if (phase.tag === 'mismatched') {
    dimSourceTriangle(ctx, phase.srcTriIds, state, viewport, w, h)
    drawGhost(ctx, phase.srcTriIds, state, viewport, w, h)
    drawTargetGlow(ctx, phase.tgtTriIds, state, viewport, w, h, now)

    // Wobble animation: damped sine oscillation
    const wobbleElapsed = now - phase.settleTime
    let verts = phase.cutoutVertices
    if (wobbleElapsed < MISMATCH_WOBBLE_DURATION) {
      const wt = wobbleElapsed / MISMATCH_WOBBLE_DURATION
      const decay = 1 - wt
      const angle = decay * Math.sin(wt * Math.PI * 6) * 0.08 // ~3 oscillations, ±0.08 rad
      const centroid = triangleCentroid(verts[0], verts[1], verts[2])
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      verts = verts.map((v) => {
        const dx = v.x - centroid.x
        const dy = v.y - centroid.y
        return { x: centroid.x + dx * cos - dy * sin, y: centroid.y + dx * sin + dy * cos }
      }) as [Vec2, Vec2, Vec2]
    }

    const screenVerts = vertsToScreen(verts, viewport, w, h)
    drawCutout(ctx, screenVerts, PAPER_FILL)

    // Instruction hint: draw "Tap to flip" near cutout centroid
    const centroid = triangleCentroid(screenVerts[0], screenVerts[1], screenVerts[2])
    if (wobbleElapsed >= MISMATCH_WOBBLE_DURATION) {
      ctx.save()
      ctx.font = '13px system-ui, sans-serif'
      ctx.fillStyle = '#6B5B3E'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Tap to flip', centroid.x, centroid.y)
      ctx.restore()
    }

    return true
  }

  if (phase.tag === 'flipping') {
    dimSourceTriangle(ctx, phase.srcTriIds, state, viewport, w, h)
    drawGhost(ctx, phase.srcTriIds, state, viewport, w, h)
    drawTargetGlow(ctx, phase.tgtTriIds, state, viewport, w, h, now)

    const elapsed = now - phase.startTime
    const rawT = Math.min(1, elapsed / FLIP_DURATION)
    // Ease-in-out
    const t = 0.5 - 0.5 * Math.cos(Math.PI * rawT)

    // Compute flipped vertices
    const flippedVerts = phase.preFlipVertices.map((v) =>
      flipVertex(v, phase.axisPoint, phase.axisDir, t)
    ) as [Vec2, Vec2, Vec2]

    const fill = t > 0.5 ? PAPER_BACK_FILL : PAPER_FILL
    // Shadow intensity peaks at midpoint
    const shadowPeak = Math.sin(Math.PI * t)

    const screenVerts = vertsToScreen(flippedVerts, viewport, w, h)
    drawCutout(ctx, screenVerts, fill, 0.5 + shadowPeak * 0.5)

    return true
  }

  if (phase.tag === 'snapping') {
    dimSourceTriangle(ctx, phase.srcTriIds, state, viewport, w, h)

    const elapsed = now - phase.startTime
    const rawT = Math.min(1, elapsed / SNAP_DURATION)
    // Ease-out quadratic
    const t = 1 - (1 - rawT) * (1 - rawT)

    const lerpedVerts = lerpVertices(phase.fromVertices, phase.toVertices, t)
    const screenVerts = vertsToScreen(lerpedVerts, viewport, w, h)

    // Shadow fades out during snap
    drawCutout(ctx, screenVerts, PAPER_FILL, 1 - t)

    return rawT < 1
  }

  if (phase.tag === 'settled') {
    // Brief gold fill on both triangles, then done
    // (Rendering handled by the existing superposition flash system)
    return false
  }

  return false
}
