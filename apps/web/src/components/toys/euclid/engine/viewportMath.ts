import type { EuclidViewportState, ConstructionState, ConstructionPoint } from '../types'
import { getAllCircles, getPoint, getRadius } from './constructionState'

// ── Auto-fit constants ──

export const AUTO_FIT_PAD_PX = 56
export const AUTO_FIT_PAD_PX_MOBILE = 72
export const AUTO_FIT_LERP = 0.12
export const AUTO_FIT_MIN_PPU = 0.2
export const AUTO_FIT_MIN_WORLD_HIT_RADIUS = 0.08
export const AUTO_FIT_MAX_PPU_HEADROOM = 1.1
export const AUTO_FIT_HIT_RADIUS_TOUCH = 44
export const AUTO_FIT_HIT_RADIUS_MOUSE = 30
export const AUTO_FIT_DOCK_GAP = 12
export const AUTO_FIT_SOFT_MARGIN = 24
export const AUTO_FIT_SWEEP_LERP_MIN = 0.03
export const AUTO_FIT_POST_SWEEP_MS = 750
export const AUTO_FIT_MAX_CENTER_PX = 2
export const AUTO_FIT_MAX_PPU_DELTA = 1
export const AUTO_FIT_SWEEP_PPU_DELTA = 3
export const AUTO_FIT_CEREMONY_PPU_DELTA = 4
/** Fraction of pad used as tip margin in the hard visibility constraint */
export const AUTO_FIT_TIP_PAD_FRACTION = 0.5

// ── Viewport centering ──

/** Compute a good initial viewport center for a proposition's given elements. */
export function computeInitialViewport(
  givenElements: readonly { kind: string; x?: number; y?: number }[]
): EuclidViewportState {
  const points = givenElements.filter(
    (e) => e.kind === 'point' && e.x !== undefined && e.y !== undefined
  ) as { x: number; y: number }[]
  if (points.length === 0) return { center: { x: 0, y: 0 }, pixelsPerUnit: 60 }

  const minX = Math.min(...points.map((p) => p.x))
  const maxX = Math.max(...points.map((p) => p.x))
  const minY = Math.min(...points.map((p) => p.y))
  const maxY = Math.max(...points.map((p) => p.y))

  // Center on given points, shifted up a bit to leave room for construction above
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2 + 1.5

  return { center: { x: cx, y: cy }, pixelsPerUnit: 50 }
}

export function getAutoFitMaxPpu(isTouch: boolean): number {
  const hitRadius = isTouch ? AUTO_FIT_HIT_RADIUS_TOUCH : AUTO_FIT_HIT_RADIUS_MOUSE
  return (hitRadius / AUTO_FIT_MIN_WORLD_HIT_RADIUS) * AUTO_FIT_MAX_PPU_HEADROOM
}

export function clampPpu(ppu: number, maxPpu: number): number {
  return Math.max(AUTO_FIT_MIN_PPU, Math.min(maxPpu, ppu))
}

export function clampPpuWithMin(ppu: number, minPpu: number, maxPpu: number): number {
  return Math.max(minPpu, Math.min(maxPpu, ppu))
}

export function getConstructionBounds(state: ConstructionState): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} | null {
  const points = state.elements.filter((e): e is ConstructionPoint => e.kind === 'point')
  if (points.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const pt of points) {
    minX = Math.min(minX, pt.x)
    minY = Math.min(minY, pt.y)
    maxX = Math.max(maxX, pt.x)
    maxY = Math.max(maxY, pt.y)
  }

  for (const circle of getAllCircles(state)) {
    const r = getRadius(state, circle.id)
    const centerPoint = getPoint(state, circle.centerId)
    if (!centerPoint || r <= 0) continue
    minX = Math.min(minX, centerPoint.x - r)
    minY = Math.min(minY, centerPoint.y - r)
    maxX = Math.max(maxX, centerPoint.x + r)
    maxY = Math.max(maxY, centerPoint.y + r)
  }

  return { minX, minY, maxX, maxY }
}

export function expandBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  x: number,
  y: number,
  r: number
) {
  bounds.minX = Math.min(bounds.minX, x - r)
  bounds.minY = Math.min(bounds.minY, y - r)
  bounds.maxX = Math.max(bounds.maxX, x + r)
  bounds.maxY = Math.max(bounds.maxY, y + r)
}

export function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2
  let a = angle % twoPi
  if (a < 0) a += twoPi
  return a
}

export function isAngleOnArc(start: number, end: number, angle: number, ccw: boolean): boolean {
  if (ccw) {
    if (end >= start) return angle >= start && angle <= end
    return angle >= start || angle <= end
  }
  if (end <= start) return angle <= start && angle >= end
  return angle <= start || angle >= end
}

export function expandBoundsForArc(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  sweep: number
) {
  if (r <= 0) return
  const ccw = sweep >= 0
  const start = normalizeAngle(startAngle)
  const end = normalizeAngle(startAngle + sweep)

  const candidates = [start, end, 0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]
  for (const a of candidates) {
    const ang = normalizeAngle(a)
    if (!isAngleOnArc(start, end, ang, ccw)) continue
    const x = cx + Math.cos(ang) * r
    const y = cy + Math.sin(ang) * r
    bounds.minX = Math.min(bounds.minX, x)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxX = Math.max(bounds.maxX, x)
    bounds.maxY = Math.max(bounds.maxY, y)
  }
}

export function getFitRect(
  cssWidth: number,
  cssHeight: number,
  canvasRect: DOMRect | null,
  dockRect: DOMRect | null,
  pad: number,
  dockGap: number,
  reservedBottom: number
) {
  let left = 0
  let right = cssWidth
  let top = 0
  let bottom = Math.max(0, cssHeight - reservedBottom)

  if (canvasRect && dockRect) {
    const dockLeft = dockRect.left - canvasRect.left
    const dockRight = dockRect.right - canvasRect.left
    const dockTop = dockRect.top - canvasRect.top
    const dockBottom = dockRect.bottom - canvasRect.top
    const overlapsY = dockBottom > 0 && dockTop < cssHeight
    const overlapsX = dockRight > 0 && dockLeft < cssWidth

    if (overlapsX && overlapsY) {
      if (dockLeft >= cssWidth / 2) {
        right = Math.min(right, dockLeft - dockGap)
      } else if (dockRight <= cssWidth / 2) {
        left = Math.max(left, dockRight + dockGap)
      } else if (dockTop >= cssHeight / 2) {
        bottom = Math.min(bottom, dockTop - dockGap)
      } else {
        top = Math.max(top, dockBottom + dockGap)
      }
    }
  }

  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  }
}

export function getScreenBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  viewport: EuclidViewportState,
  cssWidth: number,
  cssHeight: number
) {
  const toScreenX = (x: number) => (x - viewport.center.x) * viewport.pixelsPerUnit + cssWidth / 2
  const toScreenY = (y: number) => (viewport.center.y - y) * viewport.pixelsPerUnit + cssHeight / 2
  const sx1 = toScreenX(bounds.minX)
  const sx2 = toScreenX(bounds.maxX)
  const sy1 = toScreenY(bounds.minY)
  const sy2 = toScreenY(bounds.maxY)
  return {
    minX: Math.min(sx1, sx2),
    maxX: Math.max(sx1, sx2),
    minY: Math.min(sy1, sy2),
    maxY: Math.max(sy1, sy2),
  }
}

export function boundsWithinRect(
  screenBounds: { minX: number; maxX: number; minY: number; maxY: number },
  rect: { left: number; right: number; top: number; bottom: number },
  margin: number
) {
  return (
    screenBounds.minX >= rect.left + margin &&
    screenBounds.maxX <= rect.right - margin &&
    screenBounds.minY >= rect.top + margin &&
    screenBounds.maxY <= rect.bottom - margin
  )
}

export function clampViewportToRect(
  viewport: EuclidViewportState,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  rect: { left: number; right: number; top: number; bottom: number },
  margin: number,
  cssWidth: number,
  cssHeight: number
) {
  const screenBounds = getScreenBounds(bounds, viewport, cssWidth, cssHeight)
  let shiftX = 0
  let shiftY = 0
  if (screenBounds.minX < rect.left + margin) {
    shiftX = rect.left + margin - screenBounds.minX
  } else if (screenBounds.maxX > rect.right - margin) {
    shiftX = rect.right - margin - screenBounds.maxX
  }
  if (screenBounds.minY < rect.top + margin) {
    shiftY = rect.top + margin - screenBounds.minY
  } else if (screenBounds.maxY > rect.bottom - margin) {
    shiftY = rect.bottom - margin - screenBounds.maxY
  }

  if (shiftX !== 0) {
    viewport.center.x -= shiftX / viewport.pixelsPerUnit
  }
  if (shiftY !== 0) {
    viewport.center.y += shiftY / viewport.pixelsPerUnit
  }
}

export function getScreenBoundsForViewport(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  centerX: number,
  centerY: number,
  ppu: number,
  cssWidth: number,
  cssHeight: number
) {
  const toScreenX = (x: number) => (x - centerX) * ppu + cssWidth / 2
  const toScreenY = (y: number) => (centerY - y) * ppu + cssHeight / 2
  const sx1 = toScreenX(bounds.minX)
  const sx2 = toScreenX(bounds.maxX)
  const sy1 = toScreenY(bounds.minY)
  const sy2 = toScreenY(bounds.maxY)
  return {
    minX: Math.min(sx1, sx2),
    maxX: Math.max(sx1, sx2),
    minY: Math.min(sy1, sy2),
    maxY: Math.max(sy1, sy2),
  }
}

export function clampCenterToRect(
  centerX: number,
  centerY: number,
  ppu: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  rect: { left: number; right: number; top: number; bottom: number },
  margin: number,
  cssWidth: number,
  cssHeight: number
) {
  const screenBounds = getScreenBoundsForViewport(
    bounds,
    centerX,
    centerY,
    ppu,
    cssWidth,
    cssHeight
  )
  let shiftX = 0
  let shiftY = 0
  if (screenBounds.minX < rect.left + margin) {
    shiftX = rect.left + margin - screenBounds.minX
  } else if (screenBounds.maxX > rect.right - margin) {
    shiftX = rect.right - margin - screenBounds.maxX
  }
  if (screenBounds.minY < rect.top + margin) {
    shiftY = rect.top + margin - screenBounds.minY
  } else if (screenBounds.maxY > rect.bottom - margin) {
    shiftY = rect.bottom - margin - screenBounds.maxY
  }
  return {
    centerX: centerX - shiftX / ppu,
    centerY: centerY + shiftY / ppu,
  }
}

export function rotatePoint(
  pt: { x: number; y: number },
  center: { x: number; y: number },
  angle: number
) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = pt.x - center.x
  const dy = pt.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}
