/**
 * Canvas renderer for macro tool live preview.
 *
 * Renders three layers:
 * A. Colored ring highlights around already-selected (bound) construction points.
 * B. Unbound point markers — follow the cursor, with the next-to-select larger
 *    and future inputs arranged around the cursor.
 * C. Preview ghost geometry — dashed circles/segments from MACRO_PREVIEW_REGISTRY.
 */

import type { MacroPhase, ConstructionState, EuclidViewportState, GhostElement } from '../types'
import { BYRNE_CYCLE } from '../types'
import { getPoint, getAllPoints } from '../engine/constructionState'
import { MACRO_PREVIEW_REGISTRY } from '../engine/macroPreview'
import { MACRO_REGISTRY } from '../engine/macros'
import { getGhostBaseOpacity } from './renderGhostGeometry'
import { worldToScreen2D, screenToWorld2D } from '../../shared/coordinateConversions'

function toScreen(wx: number, wy: number, vp: EuclidViewportState, w: number, h: number) {
  return worldToScreen2D(wx, wy, vp.center.x, vp.center.y, vp.pixelsPerUnit, vp.pixelsPerUnit, w, h)
}

function toWorld(sx: number, sy: number, vp: EuclidViewportState, w: number, h: number) {
  return screenToWorld2D(sx, sy, vp.center.x, vp.center.y, vp.pixelsPerUnit, vp.pixelsPerUnit, w, h)
}

/** Screen-space radius (px) at which the preview starts gravitating toward a construction point. */
const ATTRACT_RADIUS = 60

/**
 * Smoothly attract `cursorWorld` toward nearby construction points using
 * inverse-square falloff. Each point within ATTRACT_RADIUS contributes a
 * pull vector weighted by 1 - (d/R)². Summing all contributions gives a
 * smooth blend — no hard switch when the nearest point changes.
 *
 * When totalWeight > 1 (multiple strong pulls), displacement is normalized
 * to prevent overshooting past the weighted centroid.
 */
function attractToNearest(
  cursorWorld: { x: number; y: number },
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number
): { x: number; y: number } {
  const cursorScreen = toScreen(cursorWorld.x, cursorWorld.y, viewport, w, h)
  let dx = 0
  let dy = 0
  let totalWeight = 0

  for (const pt of getAllPoints(state)) {
    const s = toScreen(pt.x, pt.y, viewport, w, h)
    const sdx = cursorScreen.x - s.x
    const sdy = cursorScreen.y - s.y
    const dist = Math.sqrt(sdx * sdx + sdy * sdy)
    if (dist >= ATTRACT_RADIUS) continue

    const ratio = dist / ATTRACT_RADIUS
    const t = 1 - ratio * ratio // 0 at edge, 1 at center
    dx += t * (pt.x - cursorWorld.x)
    dy += t * (pt.y - cursorWorld.y)
    totalWeight += t
  }

  if (totalWeight === 0) return cursorWorld

  // Normalize when total pull exceeds 1 to prevent overshooting
  const scale = Math.min(1, 1 / totalWeight)
  return {
    x: cursorWorld.x + dx * scale,
    y: cursorWorld.y + dy * scale,
  }
}

/** Screen-space offsets for future unbound inputs (relative to cursor). */
const FUTURE_OFFSETS = [
  { dx: 20, dy: -15 },
  { dx: -18, dy: -20 },
  { dx: 25, dy: 10 },
]

/**
 * Build the world-space positions array for a macro preview.
 * Extracted so the auto-fit system can compute preview geometry bounds
 * without duplicating the position-building logic.
 */
export function buildMacroPreviewPositions(
  macroPhase: MacroPhase & { tag: 'selecting' },
  constructionState: ConstructionState,
  pointerWorld: { x: number; y: number },
  snappedPointId: string | null,
  viewport: EuclidViewportState,
  w: number,
  h: number
): { x: number; y: number }[] {
  const { propId, selectedPointIds } = macroPhase
  const macroDef = MACRO_REGISTRY[propId]
  if (!macroDef) return []

  const inputCount = macroDef.inputs.length
  const selectedCount = selectedPointIds.length
  const positions: { x: number; y: number }[] = []

  // Bound positions from construction state
  for (let i = 0; i < selectedCount; i++) {
    const pt = getPoint(constructionState, selectedPointIds[i])
    if (pt) {
      positions.push({ x: pt.x, y: pt.y })
    } else {
      positions.push(pointerWorld) // fallback
    }
  }

  // Primary unbound: gravitational pull toward nearest construction point
  const primaryUnbound = attractToNearest(pointerWorld, constructionState, viewport, w, h)

  if (selectedCount < inputCount) {
    positions.push(primaryUnbound)
  }

  // Secondary unbound: cursor + screen-space offsets
  const cursorScreen = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)
  for (let i = selectedCount + 1; i < inputCount; i++) {
    const offsetIdx = i - selectedCount - 1
    const offset = FUTURE_OFFSETS[offsetIdx % FUTURE_OFFSETS.length]
    const worldPt = toWorld(cursorScreen.x + offset.dx, cursorScreen.y + offset.dy, viewport, w, h)
    positions.push(worldPt)
  }

  return positions
}

/**
 * Render the macro preview overlay.
 * Returns true if animation is ongoing (cursor is present → need continuous draw).
 */
export function renderMacroPreview(
  ctx: CanvasRenderingContext2D,
  macroPhase: MacroPhase & { tag: 'selecting' },
  constructionState: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  pointerWorld: { x: number; y: number } | null,
  snappedPointId: string | null
): boolean {
  const { propId, selectedPointIds, inputs } = macroPhase
  const macroDef = MACRO_REGISTRY[propId]
  if (!macroDef) return false

  const inputCount = macroDef.inputs.length
  const selectedCount = selectedPointIds.length

  // ── A. Bound point highlights ──
  for (let i = 0; i < selectedCount; i++) {
    const pt = getPoint(constructionState, selectedPointIds[i])
    if (!pt) continue
    const sp = toScreen(pt.x, pt.y, viewport, w, h)
    const color = BYRNE_CYCLE[i % 3]

    ctx.save()
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, 12, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.55
    ctx.stroke()

    // Small filled dot at center
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.globalAlpha = 0.7
    ctx.fill()
    ctx.restore()
  }

  // If no pointer, we can't render unbound markers or preview geometry
  if (!pointerWorld) return false

  // ── Compute positions for all inputs ──
  const positions = buildMacroPreviewPositions(
    macroPhase,
    constructionState,
    pointerWorld,
    snappedPointId,
    viewport,
    w,
    h
  )

  // ── B. Unbound point markers ──
  for (let i = selectedCount; i < inputCount; i++) {
    const pos = positions[i]
    const sp = toScreen(pos.x, pos.y, viewport, w, h)
    const color = BYRNE_CYCLE[i % 3]
    const isPrimary = i === selectedCount
    const radius = isPrimary ? 7 : 5
    const alpha = isPrimary ? 0.8 : 0.45

    ctx.save()
    ctx.globalAlpha = alpha

    // Filled circle marker
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    // Gentle pulse ring for primary
    if (isPrimary) {
      const t = (performance.now() % 1500) / 1500
      const pulseR = radius + 4 + t * 6
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, pulseR, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.globalAlpha = alpha * (1 - t) * 0.6
      ctx.stroke()
    }

    // Label letter
    const label = (inputs[i]?.label ?? '')[0] ?? String.fromCharCode(65 + i)
    ctx.globalAlpha = isPrimary ? 0.9 : 0.5
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${isPrimary ? 10 : 8}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, sp.x, sp.y + 0.5)

    // Full input label below primary marker (dark pill + white text)
    if (isPrimary) {
      const fullLabel = inputs[i]?.label ?? ''
      if (fullLabel) {
        ctx.font = '11px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const metrics = ctx.measureText(fullLabel)
        const px = 5
        const py = 2
        const tx = sp.x
        const ty = sp.y + 20
        const bw = metrics.width + px * 2
        const bh = 14 + py * 2

        // Dark rounded pill
        ctx.globalAlpha = 0.75
        ctx.fillStyle = '#1a1a1a'
        ctx.beginPath()
        ctx.roundRect(tx - bw / 2, ty - py, bw, bh, 4)
        ctx.fill()

        // Accent-colored left edge
        ctx.fillStyle = color
        ctx.globalAlpha = 0.9
        ctx.beginPath()
        ctx.roundRect(tx - bw / 2, ty - py, 3, bh, [4, 0, 0, 4])
        ctx.fill()

        // White text
        ctx.globalAlpha = 0.95
        ctx.fillStyle = '#fff'
        ctx.fillText(fullLabel, tx, ty)
      }
    }

    ctx.restore()
  }

  // ── C. Preview ghost geometry ──
  const previewFn = MACRO_PREVIEW_REGISTRY[propId]
  if (previewFn && positions.length >= inputCount) {
    const result = previewFn(positions)
    if (result) {
      const base = getGhostBaseOpacity()
      // Ghost elements scale with the debug slider; result elements are slightly brighter
      renderPreviewElements(ctx, result.ghostElements, viewport, w, h, Math.max(0.1, base * 1.25))
      renderPreviewElements(ctx, result.resultElements, viewport, w, h, Math.max(0.15, base * 2))
    }
  }

  // Animating (pulse) whenever pointer is present
  return true
}

/**
 * Render an array of ghost-style elements as dashed, semi-transparent geometry.
 */
function renderPreviewElements(
  ctx: CanvasRenderingContext2D,
  elements: GhostElement[],
  viewport: EuclidViewportState,
  w: number,
  h: number,
  baseAlpha: number
) {
  for (const el of elements) {
    ctx.save()
    ctx.globalAlpha = baseAlpha

    switch (el.kind) {
      case 'circle': {
        const center = toScreen(el.cx, el.cy, viewport, w, h)
        const edge = toScreen(el.cx + el.r, el.cy, viewport, w, h)
        const screenR = Math.abs(edge.x - center.x)

        ctx.beginPath()
        ctx.arc(center.x, center.y, screenR, 0, Math.PI * 2)
        ctx.strokeStyle = el.color
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 4])
        ctx.stroke()
        ctx.setLineDash([])
        break
      }
      case 'segment': {
        const p1 = toScreen(el.x1, el.y1, viewport, w, h)
        const p2 = toScreen(el.x2, el.y2, viewport, w, h)

        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.strokeStyle = el.color
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 4])
        ctx.stroke()
        ctx.setLineDash([])
        break
      }
      case 'point': {
        const sp = toScreen(el.x, el.y, viewport, w, h)

        ctx.beginPath()
        ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = el.color
        ctx.fill()

        // Label
        if (el.label) {
          ctx.fillStyle = el.color
          ctx.font = 'bold 9px system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          ctx.fillText(el.label, sp.x, sp.y - 6)
        }
        break
      }
    }

    ctx.restore()
  }
}
