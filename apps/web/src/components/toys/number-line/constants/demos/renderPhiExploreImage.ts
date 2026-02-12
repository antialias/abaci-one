import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'
import { SUBDIVISIONS, RECT_RATIO, computeSweepTransform } from './goldenRatioDemo'

export interface AlignmentConfig {
  scale: number
  rotation: number
  offsetX: number
  offsetY: number
}

// Spiral convergence point (innermost subdivision center)
const CONV = {
  x: SUBDIVISIONS[SUBDIVISIONS.length - 1].arcCx,
  y: SUBDIVISIONS[SUBDIVISIONS.length - 1].arcCy,
}

// Max distance from convergence to any corner of the golden rectangle
// (in sub-coords). This is where feathering begins — the entire golden
// rectangle is fully opaque within this radius.
// Golden rect corners: (0,0), (φ,0), (φ,-1), (0,-1). CONV.y is negative.
const MAX_CORNER_DIST_SUB = Math.max(
  Math.hypot(CONV.x, CONV.y),                        // to (0, 0)
  Math.hypot(RECT_RATIO - CONV.x, CONV.y),            // to (φ, 0)
  Math.hypot(RECT_RATIO - CONV.x, CONV.y + 1),        // to (φ, -1)
  Math.hypot(CONV.x, CONV.y + 1),                     // to (0, -1)
)

// Full circle radius: feather occupies the outer 25%, so the opaque
// zone (inner 75%) must reach past every corner of the golden rectangle.
const RADIUS_SUB = MAX_CORNER_DIST_SUB / 0.75

// Pre-compute the FINAL sweep transform (revealProgress = 1.0) and the
// convergence point in number-line coordinates. At final position the
// golden rectangle maps to [0, φ] × [-1, 0] in NL space with effScale ≈ 1.
const FINAL = computeSweepTransform(1.0)
const FINAL_COS = Math.cos(FINAL.effRotation)
const FINAL_SIN = Math.sin(FINAL.effRotation)
const CONV_NL: [number, number] = (() => {
  const dx = CONV.x - FINAL.tipX
  const dy = CONV.y - FINAL.tipY
  return [
    (dx * FINAL_COS - dy * FINAL_SIN) * FINAL.effScale,
    (dx * FINAL_SIN + dy * FINAL_COS) * FINAL.effScale,
  ] as [number, number]
})()

// Cached offscreen canvas for feathered circle compositing
let _featherCanvas: HTMLCanvasElement | null = null
let _featherCtx: CanvasRenderingContext2D | null = null

/** Max offscreen canvas dimension to avoid huge allocations */
const MAX_BUFFER_SIZE = 2048

/**
 * Render a phi-explore image behind the golden spiral overlay.
 *
 * The image is positioned at the spiral's FINAL canonical location (not the
 * current animated transform) and fades in as a static background. This
 * avoids the astronomical scale factors at mid-animation that would stretch
 * the image into a single-color wash.
 *
 * The image is drawn inside a feathered circle centered on the spiral
 * convergence point. The circle is sized so its opaque zone (inner 75%)
 * covers every corner of the golden rectangle. The outer 25% feathers
 * to transparent, starting just past the farthest rectangle corner.
 *
 * Admin editor: toCanvasY(y) = oy + (-y) * mapScale  (Y-flipped)
 * Live demo:    toY(nly)     = centerY + nly * ppu    (no flip; subs already flipped)
 *
 * To correct: negate offsetY and negate rotation from alignment data.
 */
export function renderPhiExploreImage(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  _cssWidth: number,
  cssHeight: number,
  _revealProgress: number,
  imageOpacity: number,
  image: HTMLImageElement,
  alignment: AlignmentConfig
): void {
  if (imageOpacity <= 0) return

  const centerY = cssHeight / 2
  const ppu = state.pixelsPerUnit

  const toX = (nlx: number) => numberToScreenX(nlx, state.center, ppu, _cssWidth)
  const toY = (nly: number) => centerY + nly * ppu

  // Convergence point in screen coords using the FINAL transform
  const convSx = toX(CONV_NL[0])
  const convSy = toY(CONV_NL[1])

  // Golden rectangle height at final scale (effScale ≈ 1)
  const boxH = FINAL.effScale * ppu

  // Circle radius in CSS pixels — sized so the opaque zone covers
  // the entire golden rectangle and feathering starts beyond it
  const radius = RADIUS_SUB * boxH
  if (radius < 2) return

  // --- Offscreen canvas for feathered circle ---
  const dpr = window.devicePixelRatio || 1
  const pixelDiameter = Math.min(MAX_BUFFER_SIZE, Math.ceil(radius * 2 * dpr))
  if (pixelDiameter < 2) return

  // The effective scale from CSS coords to offscreen pixels
  const bufferScale = pixelDiameter / (radius * 2)

  if (!_featherCanvas) {
    _featherCanvas = document.createElement('canvas')
    _featherCtx = _featherCanvas.getContext('2d')!
  }

  // Resize only when needed; otherwise just clear
  if (_featherCanvas.width !== pixelDiameter || _featherCanvas.height !== pixelDiameter) {
    _featherCanvas.width = pixelDiameter
    _featherCanvas.height = pixelDiameter
  } else {
    _featherCtx!.setTransform(1, 0, 0, 1, 0, 0)
    _featherCtx!.globalCompositeOperation = 'source-over'
    _featherCtx!.clearRect(0, 0, pixelDiameter, pixelDiameter)
  }

  const tc = _featherCtx!
  const cx = pixelDiameter / 2
  const cy = pixelDiameter / 2
  const pixelRadius = pixelDiameter / 2

  // 1) Clip to circle
  tc.save()
  tc.beginPath()
  tc.arc(cx, cy, pixelRadius, 0, Math.PI * 2)
  tc.clip()

  // 2) Apply alignment transform around center (in buffer pixel coords)
  //    Y-axis correction: negate rotation and offsetY from admin data.
  const alignRotRad = (-alignment.rotation * Math.PI) / 180

  tc.translate(cx, cy)
  tc.rotate(alignRotRad)
  tc.scale(alignment.scale, alignment.scale)
  tc.translate(-cx, -cy)

  // 3) Draw image in cover-fit mode, sized to fill the full circle.
  //    The circle is larger than the golden rectangle, so the image must
  //    cover the entire pixelDiameter × pixelDiameter buffer.
  const imgAspect = image.naturalWidth / image.naturalHeight
  let imgDrawW: number, imgDrawH: number
  if (imgAspect > 1) {
    imgDrawH = pixelDiameter
    imgDrawW = pixelDiameter * imgAspect
  } else {
    imgDrawW = pixelDiameter
    imgDrawH = pixelDiameter / imgAspect
  }

  // Image center offset from convergence (in buffer pixels)
  const imgCx = cx + alignment.offsetX * boxH * bufferScale
  const imgCy = cy + (-alignment.offsetY) * boxH * bufferScale

  tc.drawImage(image, imgCx - imgDrawW / 2, imgCy - imgDrawH / 2, imgDrawW, imgDrawH)
  tc.restore()

  // 4) Feather mask: outer 25% of circle fades to transparent
  tc.globalCompositeOperation = 'destination-in'
  const featherStart = pixelRadius * 0.75
  const grad = tc.createRadialGradient(cx, cy, featherStart, cx, cy, pixelRadius)
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  tc.fillStyle = grad
  tc.fillRect(0, 0, pixelDiameter, pixelDiameter)
  tc.globalCompositeOperation = 'source-over'

  // 5) Draw feathered circle onto main canvas
  ctx.save()
  ctx.globalAlpha = imageOpacity
  const drawSize = radius * 2
  ctx.drawImage(_featherCanvas, convSx - radius, convSy - radius, drawSize, drawSize)
  ctx.restore()
}
