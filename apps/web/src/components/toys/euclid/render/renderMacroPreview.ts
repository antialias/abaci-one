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

// ── Transition state for click-time position shifts ──
// When the user binds a point, all position indices shift and ghost geometry
// would jump. We capture the displayed positions before the click, compute
// per-position offsets from old→new, and decay those offsets over time.
// Cursor tracking stays fully responsive — the offset decays independently.
let _displayedPositions: { x: number; y: number }[] = []
let _offsets: { x: number; y: number }[] = []
let _transitionStart = 0
let _lastPropId = -1
let _lastSelectedCount = -1

/** Half-life (ms) for offset decay after a selection click. */
const OFFSET_HALF_LIFE = 60

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

  // ── Decaying offset for click transitions ──
  // On each selection click, position indices shift and geometry would jump.
  // We capture the delta between old displayed positions and new computed
  // positions, then decay that delta over time. Cursor tracking stays
  // responsive — the offset is additive and computed once per click.
  {
    const now = performance.now()

    // Reset when macro changes or selectedCount goes backward (undo)
    if (propId !== _lastPropId || selectedCount < _lastSelectedCount) {
      _displayedPositions = []
      _offsets = []
    }

    // Detect forward selection → start transition
    if (
      selectedCount > _lastSelectedCount &&
      _lastSelectedCount >= 0 &&
      _displayedPositions.length === positions.length
    ) {
      _offsets = positions.map((p, i) => ({
        x: _displayedPositions[i].x - p.x,
        y: _displayedPositions[i].y - p.y,
      }))
      _transitionStart = now
    }

    _lastPropId = propId
    _lastSelectedCount = selectedCount

    // Apply decaying offset
    if (_offsets.length === positions.length) {
      const elapsed = now - _transitionStart
      const decay = Math.exp((-elapsed * Math.LN2) / OFFSET_HALF_LIFE)

      if (decay > 0.01) {
        for (let i = 0; i < positions.length; i++) {
          positions[i] = {
            x: positions[i].x + _offsets[i].x * decay,
            y: positions[i].y + _offsets[i].y * decay,
          }
        }
      } else {
        // Transition done — clear offsets
        _offsets = []
      }
    }

    // Store displayed positions for next transition's offset computation
    _displayedPositions = positions.map(p => ({ x: p.x, y: p.y }))
  }

  // ── Mating indicator ──
  // When the primary unbound is attracted toward a construction point, draw a
  // contracting ring on that point. The ring tightens and brightens as the
  // cursor approaches, telegraphing which point will be selected on click.
  if (selectedCount < inputCount) {
    const cursorScreen = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)
    let nearestDist = Infinity
    let nearestScreen: { x: number; y: number } | null = null

    for (const pt of getAllPoints(constructionState)) {
      const s = toScreen(pt.x, pt.y, viewport, w, h)
      const dx = cursorScreen.x - s.x
      const dy = cursorScreen.y - s.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestScreen = s
      }
    }

    if (nearestScreen && nearestDist < ATTRACT_RADIUS) {
      const ratio = nearestDist / ATTRACT_RADIUS
      const t = 1 - ratio * ratio // same curve as attraction
      const color = BYRNE_CYCLE[selectedCount % 3]

      ctx.save()

      // Contracting dashed ring — wide and faint at edge, tight and bright at center
      const ringRadius = 18 - t * 8 // 18px → 10px
      ctx.beginPath()
      ctx.arc(nearestScreen.x, nearestScreen.y, ringRadius, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5 + t * 1.5
      ctx.globalAlpha = t * 0.65
      ctx.setLineDash([4, 3])
      ctx.stroke()
      ctx.setLineDash([])

      ctx.restore()
    }
  }

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
