/**
 * Render influence highlight: a prominent glowing ring around the most
 * influential given point when hovering over a derived point, with a
 * connecting line, preview arrow, and motion trail during drag.
 *
 * Features smooth fade-in/fade-out transitions.
 */

import type { ConstructionState, EuclidViewportState } from '../types'
import { getPoint } from '../engine/constructionState'
import { worldToScreen2D } from '../../shared/coordinateConversions'
import { constrainedDragStep } from '../engine/jacobianInfluence'

// ── Visual constants ──
const HIGHLIGHT_COLOR = '#4E79A7' // Byrne blue
const LINE_COLOR_BASE = 'rgba(78, 121, 167, 0.35)'
const OUTER_RING_RADIUS = 20
const INNER_RING_RADIUS = 14
const GLOW_RADIUS = 28
const OUTER_RING_WIDTH = 2
const INNER_RING_WIDTH = 3
const DASH_PATTERN: [number, number] = [6, 4]
const FADE_DURATION_MS = 500
const PREVIEW_ARROW_COLOR = '#4E79A7'
const PREVIEW_ARROW_SCALE = 40 // pixels per unit of Jacobian response
const PREVIEW_ARROW_MAX_LEN = 60 // max arrow length in pixels
const PREVIEW_ARROW_HEAD = 8 // arrowhead size
const PREVIEW_ARROW_FADE_START = 15 // screen px from derived point: arrow fully visible beyond this
const PREVIEW_ARROW_FADE_END = 5 // screen px from derived point: arrow fully hidden below this
const TENSION_START_RADIUS = 40 // screen px: tension visuals begin
const BREAK_FREE_RADIUS = 250 // screen px: constraint snaps
const TENSION_DAMPEN = 0.95 // at max tension, cursor influence reduced to 1 - this
const TENSION_COLOR = '#D98D2F' // amber for strained state
const TENSION_COLOR_RGB = '217, 141, 47'
const HIGHLIGHT_COLOR_RGB = '78, 121, 167'
const BREAK_FREE_FLASH_DURATION_MS = 400
const BREAK_FREE_SHOCKWAVE_MAX_RADIUS = 80
const TRAIL_COLOR = 'rgba(78, 121, 167, 0.6)'
const TRAIL_MAX_POINTS = 20
const TRAIL_MAX_WIDTH = 4
const TRAIL_MIN_WIDTH = 0.5

// ── State types ──

/** Persistent state for smooth highlight transitions. */
export interface InfluenceHighlightState {
  opacity: number
  targetOpacity: number
  derivedPointId: string | null
  givenPointId: string | null
  fadeStartTime: number
  fadeStartOpacity: number
  /** Sub-Jacobian for preview arrow: [∂tx/∂gx, ∂tx/∂gy, ∂ty/∂gx, ∂ty/∂gy] */
  subJacobian: [number, number, number, number] | null
  /** 0..1 tension during constrained drag (0 = relaxed, 1 = about to break) */
  tension: number
  /** Cursor screen position during constrained drag (for rubber band line) */
  cursorScreen: { x: number; y: number } | null
  /**
   * Field targets — derived points whose constraint-response field
   * contributes to the background. Each is rendered with its own
   * proximity factor based on cursor distance, so as the cursor moves
   * between two derived points their fields naturally crossfade
   * (one's prox shrinks while the other's grows) — no hard switch.
   * Updated on every pointer move; entries with negligible proximity
   * are dropped to bound cost.
   */
  fieldTargets: FieldTarget[]
}

export interface FieldTarget {
  derivedPointId: string
  givenPointId: string
  subJacobian: [number, number, number, number]
}

export function createInfluenceHighlightState(): InfluenceHighlightState {
  return {
    opacity: 0,
    targetOpacity: 0,
    derivedPointId: null,
    givenPointId: null,
    fadeStartTime: 0,
    fadeStartOpacity: 0,
    subJacobian: null,
    tension: 0,
    cursorScreen: null,
    fieldTargets: [],
  }
}

/** Visual flash when the constraint breaks free during a drag. */
export interface BreakFreeFlash {
  startTime: number
  /** Screen position of the influential given point at the moment of break */
  givenScreen: { x: number; y: number }
  /** Screen position of the derived point at the moment of break */
  derivedScreen: { x: number; y: number }
}

/** Motion trail state: ring buffer of recent positions for each tracked point. */
export interface MotionTrailState {
  /** Point ID being trailed */
  pointId: string | null
  /** Ring buffer of recent screen positions */
  positions: Array<{ x: number; y: number }>
  /** Write index into the ring buffer */
  writeIdx: number
  /** Number of valid entries */
  count: number
  /** Fade-out opacity (1 while dragging, decays after release) */
  opacity: number
}

export function createMotionTrailState(): MotionTrailState {
  return {
    pointId: null,
    positions: new Array(TRAIL_MAX_POINTS).fill({ x: 0, y: 0 }),
    writeIdx: 0,
    count: 0,
    opacity: 0,
  }
}

/** Record a new position in the trail. Call each drag frame. */
export function recordTrailPosition(
  trail: MotionTrailState,
  pointId: string,
  screenX: number,
  screenY: number
): void {
  if (trail.pointId !== pointId) {
    // New drag target — reset
    trail.pointId = pointId
    trail.count = 0
    trail.writeIdx = 0
  }
  trail.positions[trail.writeIdx] = { x: screenX, y: screenY }
  trail.writeIdx = (trail.writeIdx + 1) % TRAIL_MAX_POINTS
  if (trail.count < TRAIL_MAX_POINTS) trail.count++
  trail.opacity = 1
}

/** Call when drag ends to begin fade-out. */
export function clearTrail(trail: MotionTrailState): void {
  trail.pointId = null
  trail.count = 0
  trail.writeIdx = 0
  trail.opacity = 0
}

// ── Highlight target update ──

export function updateInfluenceTarget(
  state: InfluenceHighlightState,
  derivedPointId: string | null,
  givenPointId: string | null,
  now: number
): void {
  const hasTarget = derivedPointId != null && givenPointId != null

  if (hasTarget) {
    state.derivedPointId = derivedPointId
    state.givenPointId = givenPointId
    if (state.targetOpacity !== 1) {
      state.targetOpacity = 1
      state.fadeStartTime = now
      state.fadeStartOpacity = state.opacity
    }
  } else {
    if (state.targetOpacity !== 0) {
      state.targetOpacity = 0
      state.fadeStartTime = now
      state.fadeStartOpacity = state.opacity
    }
  }
}

// ── Helpers ──

function toScreen(wx: number, wy: number, vp: EuclidViewportState, w: number, h: number) {
  return worldToScreen2D(wx, wy, vp.center.x, vp.center.y, vp.pixelsPerUnit, vp.pixelsPerUnit, w, h)
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * Distance-based proximity multiplier. Softened inverse-square falloff:
 * f(d) = R² / (R² + d²). At d = 0 the factor is 1; at d = R it's ½; for
 * d ≫ R it decays as 1/d² (true inverse-square asymptote).
 */
const PROXIMITY_HALF_RADIUS_PX = 220
function proximityFromDistance(d: number): number {
  const r = PROXIMITY_HALF_RADIUS_PX
  return (r * r) / (r * r + d * d)
}

/**
 * Width (px) of the soft Voronoi boundary between adjacent field targets.
 * Targets at distance > d_min + this contribute weight 0; at distance =
 * d_min they get weight 1; linearly interpolated in between. Larger →
 * wider blend zone near bisectors. Smaller → harder Voronoi cells.
 */
const VORONOI_TRANSITION_PX = 70

interface FieldRenderItem {
  target: FieldTarget
  derivedScreen: { x: number; y: number }
  distance: number
  weight: number
}

/**
 * Compute the cursor-relative weighting for each field target. Returns the
 * minimum distance to any target plus a per-target weight that's 1 on the
 * nearest, falls linearly to 0 for any target farther than VORONOI_TRANSITION_PX
 * past the nearest, and is normalized so the weights sum to 1. This gives:
 *   - Firmly near point A: only A's field renders (weight ≈ 1, neighbors 0)
 *   - Near a bisector between A & B: smooth crossfade (weights split)
 *   - Far from all: dMin large, caller can use proximity falloff to fade out
 */
function computeFieldRenderItems(
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  pointerWorld: { x: number; y: number } | null,
  fieldTargets: FieldTarget[]
): { dMin: number; items: FieldRenderItem[] } | null {
  if (!pointerWorld || fieldTargets.length === 0) return null
  const cursor = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)

  const items: Array<FieldRenderItem & { rawWeight: number }> = []
  let dMin = Infinity
  for (const target of fieldTargets) {
    const pt = getPoint(state, target.derivedPointId)
    if (!pt) continue
    const ds = toScreen(pt.x, pt.y, viewport, w, h)
    const dx = cursor.x - ds.x
    const dy = cursor.y - ds.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < dMin) dMin = d
    items.push({ target, derivedScreen: ds, distance: d, weight: 0, rawWeight: 0 })
  }
  if (items.length === 0) return null

  let sumRaw = 0
  for (const it of items) {
    it.rawWeight = Math.max(0, 1 - (it.distance - dMin) / VORONOI_TRANSITION_PX)
    sumRaw += it.rawWeight
  }
  const out: FieldRenderItem[] = items.map((it) => ({
    target: it.target,
    derivedScreen: it.derivedScreen,
    distance: it.distance,
    weight: sumRaw > 0 ? it.rawWeight / sumRaw : 0,
  }))
  return { dMin, items: out }
}

/** Lerp between two RGB color strings based on t (0..1). Returns CSS rgba(). */
function lerpColor(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
  t: number,
  a: number
): string {
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** Lerp between Byrne blue and tension amber. */
function tensionColor(tension: number, alpha: number): string {
  return lerpColor(78, 121, 167, 217, 141, 47, tension, alpha)
}

/** Hex color lerped between blue and amber based on tension. */
function tensionHex(tension: number): string {
  const r = Math.round(78 + (217 - 78) * tension)
  const g = Math.round(121 + (141 - 121) * tension)
  const b = Math.round(167 + (47 - 167) * tension)
  return `rgb(${r}, ${g}, ${b})`
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  angle: number,
  size: number
): void {
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(
    tipX - size * Math.cos(angle - Math.PI / 6),
    tipY - size * Math.sin(angle - Math.PI / 6)
  )
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(
    tipX - size * Math.cos(angle + Math.PI / 6),
    tipY - size * Math.sin(angle + Math.PI / 6)
  )
  ctx.stroke()
}

// ── Constraint response field ──

/**
 * Paint a per-direction encoding of the constrained-drag response over the
 * entire canvas, anchored at the derived point. The user can read it before
 * dragging to discover how the controlling given will react to each possible
 * cursor direction.
 *
 * The 2×2 sub-Jacobian J is locally constant, so the response is radially
 * symmetric around the derived point — every pixel along a ray from D
 * produces the same Δg direction and gain. We encode that into 120 angular
 * stops on a conic gradient and fill the whole canvas in a single draw.
 *
 * Coordinate handling: J is in world coords (y-up); the canvas is screen
 * coords (y-down). The screen-effective Jacobian J' = (1/det) [[d, b],[c, a]]
 * (derived from J⁻¹ with a y-flip on each side) takes a screen-space
 * Δd_unit directly to a screen-space Δg vector — so screen-angle math
 * produces the rotation the user actually perceives.
 *
 * Encoding:
 *   • Hue from green (intuitive, Δg ‖ Δd) through yellow (sideways) to
 *     red (anti-aligned, Δg ‖ -Δd) — based on |rotation|.
 *   • Lightness from gain |Δg| / |Δd|, normalized within the frame so the
 *     two principal-axis lobes always pop visually (bright = high mechanical
 *     advantage in this direction; dim = the constraint resists motion).
 *
 * @returns true if a field was drawn (caller may want to redraw)
 */
export function renderConstraintField(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  highlightState: InfluenceHighlightState,
  pointerWorld: { x: number; y: number } | null
): boolean {
  if (highlightState.fieldTargets.length === 0) return false

  const result = computeFieldRenderItems(
    state,
    viewport,
    w,
    h,
    pointerWorld,
    highlightState.fieldTargets
  )
  if (!result) return false
  const globalProx = proximityFromDistance(result.dMin)
  if (globalProx < 0.005) return false

  let drewAny = false
  for (const item of result.items) {
    const alphaMultiplier = globalProx * item.weight
    if (alphaMultiplier < 0.005) continue
    if (renderConstraintFieldForTarget(ctx, viewport, w, h, item, alphaMultiplier)) {
      drewAny = true
    }
  }
  return drewAny
}

function renderConstraintFieldForTarget(
  ctx: CanvasRenderingContext2D,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  item: FieldRenderItem,
  alphaMultiplier: number
): boolean {
  const [a, b, c, d] = item.target.subJacobian
  const det = a * d - b * c
  if (Math.abs(det) < 1e-9) return false // degenerate — nothing to show

  const derivedScreen = item.derivedScreen

  const N = 120
  const gains = new Float32Array(N + 1)
  const rotations = new Float32Array(N + 1)
  let maxGain = 0

  for (let i = 0; i <= N; i++) {
    const θ = (i / N) * 2 * Math.PI
    const sx = Math.cos(θ)
    const sy = Math.sin(θ)
    // Screen-effective J': Δg_screen = (1/det) · [[d, b],[c, a]] · Δd_screen
    const gx = (d * sx + b * sy) / det
    const gy = (c * sx + a * sy) / det
    const gain = Math.sqrt(gx * gx + gy * gy)
    if (gain > maxGain) maxGain = gain
    gains[i] = gain

    let rot = Math.atan2(gy, gx) - θ
    while (rot > Math.PI) rot -= 2 * Math.PI
    while (rot < -Math.PI) rot += 2 * Math.PI
    rotations[i] = rot
  }

  // Build conic gradient anchored at the derived point in screen space.
  // Canvas conic angles measure clockwise from +x — same as our screen θ.
  const grad = ctx.createConicGradient(0, derivedScreen.x, derivedScreen.y)
  const fieldAlpha = 0.18 * alphaMultiplier
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const absRot = Math.abs(rotations[i])
    // 0 rotation → 120 (green), π/2 → 60 (yellow), π → 0 (red)
    const hue = 120 * (1 - absRot / Math.PI)
    const normGain = maxGain > 0 ? gains[i] / maxGain : 0
    // Bias lightness toward the bright end of high-gain lobes so the
    // principal axes are unmistakable; dim sectors stay readable.
    const lightness = 32 + 38 * normGain
    grad.addColorStop(t, `hsla(${hue}, 75%, ${lightness}%, ${fieldAlpha})`)
  }

  ctx.save()
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
  return true
}

// ── LIC (Line Integral Convolution) ──
// Continuous flow visualization: smear a noise texture along the field's
// streamlines so coherent flow direction shows up as smeared streaks. Output
// is grayscale, drawn with `multiply` blend so it darkens the existing color
// (the conic gradient from renderConstraintField) without overwriting it.
//
// Computed at low resolution (LIC_W × LIC_H), upscaled to canvas size — the
// upscale's bilinear smoothing is what makes the result feel like a smooth
// gradient rather than a discrete tile pattern.

// Target offscreen pixel count — LIC dimensions adapt to the main canvas
// aspect ratio so a square or 4:3 canvas doesn't stretch streaks horizontally.
const LIC_TARGET_PIXELS = 22000
const NOISE_SIZE = 256 // power-of-two so wrapping uses bitmask; large enough that the table doesn't visibly tile across the canvas
const NOISE_MASK = NOISE_SIZE - 1

let licCanvas: HTMLCanvasElement | null = null
let licCtx2D: CanvasRenderingContext2D | null = null
let licImage: ImageData | null = null
let licW = 0
let licH = 0
let noiseTable: Float32Array | null = null

function computeLicDims(w: number, h: number): { lw: number; lh: number } {
  const aspect = w / h
  let lw = Math.round(Math.sqrt(LIC_TARGET_PIXELS * aspect))
  let lh = Math.round(lw / aspect)
  if (lw < 32) lw = 32
  if (lh < 32) lh = 32
  return { lw, lh }
}

function ensureLicResources(targetW: number, targetH: number): void {
  if (!noiseTable) {
    noiseTable = new Float32Array(NOISE_SIZE * NOISE_SIZE)
    let s = 0x9e3779b9
    for (let i = 0; i < noiseTable.length; i++) {
      s = ((s * 1103515245) >>> 0) + 12345
      noiseTable[i] = ((s >>> 8) & 0xffff) / 65535
    }
  }
  if (typeof document === 'undefined') return
  if (!licCanvas) {
    licCanvas = document.createElement('canvas')
    licCtx2D = licCanvas.getContext('2d')!
  }
  if (licW !== targetW || licH !== targetH || !licImage) {
    licW = targetW
    licH = targetH
    licCanvas.width = licW
    licCanvas.height = licH
    licImage = licCtx2D!.createImageData(licW, licH)
  }
}

function sampleNoise(x: number, y: number): number {
  const t = noiseTable!
  const xfm = x - Math.floor(x)
  const yfm = y - Math.floor(y)
  const xi = Math.floor(x) & NOISE_MASK
  const yi = Math.floor(y) & NOISE_MASK
  const xn = (xi + 1) & NOISE_MASK
  const yn = (yi + 1) & NOISE_MASK
  const r0 = yi * NOISE_SIZE
  const r1 = yn * NOISE_SIZE
  const n00 = t[r0 + xi]
  const n10 = t[r0 + xn]
  const n01 = t[r1 + xi]
  const n11 = t[r1 + xn]
  const a = n00 + (n10 - n00) * xfm
  const b = n01 + (n11 - n01) * xfm
  return a + (b - a) * yfm
}

/**
 * Continuous flow visualization for the constraint response field
 * Δg(P) = J' · (P − D). Rendered via Line Integral Convolution: at every
 * output pixel, walk forward and backward along Δg in small steps, sampling
 * a smooth noise texture; average the samples. The result is high autocorr-
 * elation along streamlines (smooth) and decorrelation across them (sharp),
 * producing a brushed-flow texture without discrete lines.
 *
 * Drawn after the conic gradient (renderConstraintField) with `multiply`
 * blend, so the LIC darkens the colored field rather than replacing it.
 */
export function renderConstraintFieldFlow(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  highlightState: InfluenceHighlightState,
  pointerWorld: { x: number; y: number } | null
): boolean {
  if (highlightState.fieldTargets.length === 0) return false

  const result = computeFieldRenderItems(
    state,
    viewport,
    w,
    h,
    pointerWorld,
    highlightState.fieldTargets
  )
  if (!result) return false
  const globalProx = proximityFromDistance(result.dMin)
  if (globalProx < 0.005) return false

  let drewAny = false
  for (const item of result.items) {
    const alphaMultiplier = globalProx * item.weight
    if (alphaMultiplier < 0.005) continue
    if (renderConstraintFieldFlowForTarget(ctx, viewport, w, h, item, alphaMultiplier)) {
      drewAny = true
    }
  }
  return drewAny
}

function renderConstraintFieldFlowForTarget(
  ctx: CanvasRenderingContext2D,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  item: FieldRenderItem,
  alphaMultiplier: number
): boolean {
  const [a, b, c, d] = item.target.subJacobian
  const det = a * d - b * c
  if (Math.abs(det) < 1e-9) return false

  const dims = computeLicDims(w, h)
  ensureLicResources(dims.lw, dims.lh)
  if (!licCanvas || !licCtx2D || !licImage) return false

  const D = item.derivedScreen
  // Map derived-point screen position into LIC pixel space.
  const sxk = licW / w
  const syk = licH / h
  const Dlx = D.x * sxk
  const Dly = D.y * syk

  // Tunables. Step/half scaled with LIC resolution so streak length on the
  // final canvas stays comparable across resolution changes.
  const STEP = 1.6 // LIC px per integration step
  const HALF = 16 // steps each direction
  const NOISE_SCALE = 0.45 // LIC-px-to-noise-px scale (smaller = chunkier streaks)
  const CONTRAST = 1.9 // amplify deviation from 0.5 → more visible streaks
  const NEAR_D_LIC = 2 // skip only the very pixel at D — blur covers residue

  // Magnitude reference: |Δg| at (P−D) of length halfDiagLic in the worst
  // direction is bounded by Frobenius(J')·halfDiagLic. We use this to map
  // local |Δg(P)| into a 0..1 "intensity" so far-from-D pixels darken more
  // (= bigger required given-point move). Both numerator and denominator
  // carry the same |det| factor below, so it cancels — no need to divide.
  const halfDiagLic2 = (licW * licW + licH * licH) / 4
  const frobSquared = a * a + b * b + c * c + d * d
  const refMag2 = frobSquared * halfDiagLic2

  const data = licImage.data
  let idx = 0

  for (let py = 0; py < licH; py++) {
    for (let px = 0; px < licW; px++) {
      const xC = px + 0.5
      const yC = py + 0.5
      const dxN = xC - Dlx
      const dyN = yC - Dly

      let v = 0.5
      let intensity = 0
      if (dxN * dxN + dyN * dyN >= NEAR_D_LIC * NEAR_D_LIC) {
        let sum = 0
        let count = 0

        // Forward walk
        let cx = xC
        let cy = yC
        for (let i = 0; i < HALF; i++) {
          const ex = cx - Dlx
          const ey = cy - Dly
          // Field direction (J' · e) — we normalize by m below, so direction
          // matters but absolute scale doesn't here.
          const gx = d * ex + b * ey
          const gy = c * ex + a * ey
          const m = Math.sqrt(gx * gx + gy * gy)
          if (m < 1e-9) break
          cx += (gx / m) * STEP
          cy += (gy / m) * STEP
          sum += sampleNoise(cx * NOISE_SCALE, cy * NOISE_SCALE)
          count++
        }

        // Backward walk
        cx = xC
        cy = yC
        for (let i = 0; i < HALF; i++) {
          const ex = cx - Dlx
          const ey = cy - Dly
          const gx = d * ex + b * ey
          const gy = c * ex + a * ey
          const m = Math.sqrt(gx * gx + gy * gy)
          if (m < 1e-9) break
          cx -= (gx / m) * STEP
          cy -= (gy / m) * STEP
          sum += sampleNoise(cx * NOISE_SCALE, cy * NOISE_SCALE)
          count++
        }

        if (count > 0) v = sum / count

        // Local |J' · (P−D)|² (proportional to |Δg(P)|², |det|² factor
        // cancels with refMag2 below).
        const lgx = d * dxN + b * dyN
        const lgy = c * dxN + a * dyN
        const localMag2 = lgx * lgx + lgy * lgy
        intensity = Math.sqrt(localMag2 / refMag2)
        if (intensity > 1) intensity = 1
      }

      // Stretch contrast around 0.5 → streak value in [0,1].
      let streak = 0.5 + (v - 0.5) * CONTRAST
      if (streak < 0) streak = 0
      else if (streak > 1) streak = 1

      // Lerp from white (1.0 = no multiply effect) to the streak value,
      // weighted by intensity. Near D: pixels stay white → multiply leaves
      // canvas alone → light region. Far from D: full streak → multiply
      // darkens streaks → "expensive zone" reads as denser, busier canvas.
      const final = 1 + (streak - 1) * intensity
      const g = (final * 255) | 0
      data[idx++] = g
      data[idx++] = g
      data[idx++] = g
      data[idx++] = 255
    }
  }

  licCtx2D.putImageData(licImage, 0, 0)

  // Composite LIC onto main canvas: multiply darkens (streaks become darker
  // brush strokes against the conic gradient). Bilinear upscale alone leaves
  // a Minecraft-grid look at ~7-10× factor, so we layer a Gaussian blur via
  // ctx.filter on top — the radius scales with the upscale factor, large
  // enough to dissolve cell boundaries while still preserving streak shape.
  const upscaleFactor = w / licW
  const blurPx = Math.max(1.5, upscaleFactor * 1.4)

  ctx.save()
  ctx.globalAlpha = 0.20 * alphaMultiplier
  ctx.globalCompositeOperation = 'multiply'
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.filter = `blur(${blurPx.toFixed(2)}px)`
  ctx.drawImage(licCanvas, 0, 0, w, h)
  ctx.restore()

  return true
}

// ── Main render ──

/**
 * @returns true if still animating (needs redraw)
 */
export function renderInfluenceHighlight(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  highlightState: InfluenceHighlightState,
  time: number,
  pointerWorld: { x: number; y: number } | null
): boolean {
  const now = time * 1000

  // Animate opacity
  if (highlightState.opacity !== highlightState.targetOpacity) {
    const elapsed = now - highlightState.fadeStartTime
    const t = Math.min(1, elapsed / FADE_DURATION_MS)
    const eased = easeOutCubic(t)
    highlightState.opacity =
      highlightState.fadeStartOpacity +
      (highlightState.targetOpacity - highlightState.fadeStartOpacity) * eased
    if (t >= 1) {
      highlightState.opacity = highlightState.targetOpacity
      if (highlightState.targetOpacity === 0) {
        highlightState.derivedPointId = null
        highlightState.givenPointId = null
        highlightState.subJacobian = null
      }
    }
  }

  if (highlightState.opacity <= 0.001) return false
  if (!highlightState.derivedPointId || !highlightState.givenPointId) return false

  const derivedPt = getPoint(state, highlightState.derivedPointId)
  const givenPt = getPoint(state, highlightState.givenPointId)
  if (!derivedPt || !givenPt) return false

  const derivedScreen = toScreen(derivedPt.x, derivedPt.y, viewport, w, h)
  const givenScreen = toScreen(givenPt.x, givenPt.y, viewport, w, h)

  const alpha = highlightState.opacity
  const tension = highlightState.tension
  const pulse = 0.75 + 0.25 * Math.sin(time * 3.5)

  // Tension-driven ring vibration: random offset scaled by tension
  const vibeX = tension > 0.01 ? (Math.random() - 0.5) * tension * 8 : 0
  const vibeY = tension > 0.01 ? (Math.random() - 0.5) * tension * 8 : 0
  const ringX = givenScreen.x + vibeX
  const ringY = givenScreen.y + vibeY

  // Color that shifts with tension
  const lineColor = tensionColor(tension, 0.35 + tension * 0.4)
  const ringColor = tensionHex(tension)

  ctx.save()

  // ── Rubber band line (cursor → derived point, visible during tension) ──
  if (tension > 0.01 && highlightState.cursorScreen) {
    const rbAlpha = alpha * tension * 0.8
    const rbWidth = 1 + tension * 2.5
    ctx.beginPath()
    ctx.moveTo(highlightState.cursorScreen.x, highlightState.cursorScreen.y)
    ctx.lineTo(derivedScreen.x, derivedScreen.y)
    ctx.strokeStyle = tensionColor(tension, 1)
    ctx.lineWidth = rbWidth
    ctx.globalAlpha = rbAlpha
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  // ── Connecting dashed line ──
  ctx.beginPath()
  ctx.setLineDash(DASH_PATTERN)
  ctx.moveTo(derivedScreen.x, derivedScreen.y)
  ctx.lineTo(ringX, ringY)
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1.5 + tension * 1.5
  ctx.globalAlpha = alpha * 0.8
  ctx.stroke()
  ctx.setLineDash([])

  // ── Soft glow ──
  const gradient = ctx.createRadialGradient(ringX, ringY, 0, ringX, ringY, GLOW_RADIUS * pulse)
  gradient.addColorStop(0, tensionColor(tension, 0.4))
  gradient.addColorStop(0.5, tensionColor(tension, 0.15))
  gradient.addColorStop(1, tensionColor(tension, 0))
  ctx.beginPath()
  ctx.arc(ringX, ringY, GLOW_RADIUS * pulse, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.globalAlpha = alpha
  ctx.fill()

  // ── Outer ring ──
  ctx.beginPath()
  ctx.arc(ringX, ringY, OUTER_RING_RADIUS, 0, Math.PI * 2)
  ctx.strokeStyle = ringColor
  ctx.lineWidth = OUTER_RING_WIDTH
  ctx.globalAlpha = alpha * 0.4 * pulse
  ctx.stroke()

  // ── Inner ring ──
  ctx.beginPath()
  ctx.arc(ringX, ringY, INNER_RING_RADIUS, 0, Math.PI * 2)
  ctx.strokeStyle = ringColor
  ctx.lineWidth = INNER_RING_WIDTH
  ctx.globalAlpha = alpha * pulse
  ctx.stroke()

  // ── Center disc ──
  ctx.beginPath()
  ctx.arc(ringX, ringY, 5, 0, Math.PI * 2)
  ctx.fillStyle = ringColor
  ctx.globalAlpha = alpha * 0.7
  ctx.fill()

  // ── Diamond marker on derived point ──
  const s = 5
  ctx.beginPath()
  ctx.moveTo(derivedScreen.x, derivedScreen.y - s)
  ctx.lineTo(derivedScreen.x + s, derivedScreen.y)
  ctx.lineTo(derivedScreen.x, derivedScreen.y + s)
  ctx.lineTo(derivedScreen.x - s, derivedScreen.y)
  ctx.closePath()
  ctx.strokeStyle = ringColor
  ctx.lineWidth = 1.5
  ctx.globalAlpha = alpha * 0.6
  ctx.stroke()

  // ── Preview arrow: shows where given point would move ──
  if (pointerWorld && highlightState.subJacobian) {
    // Compute cursor-to-derived-point distance in SCREEN pixels for fade
    const pointerScreen = toScreen(pointerWorld.x, pointerWorld.y, viewport, w, h)
    const dxScreen = pointerScreen.x - derivedScreen.x
    const dyScreen = pointerScreen.y - derivedScreen.y
    const cursorScreenDist = Math.sqrt(dxScreen * dxScreen + dyScreen * dyScreen)

    // Fade arrow based on proximity: full at FADE_START, zero at FADE_END
    const proximityAlpha =
      cursorScreenDist <= PREVIEW_ARROW_FADE_END
        ? 0
        : cursorScreenDist >= PREVIEW_ARROW_FADE_START
          ? 1
          : (cursorScreenDist - PREVIEW_ARROW_FADE_END) /
            (PREVIEW_ARROW_FADE_START - PREVIEW_ARROW_FADE_END)

    // Vector from derived point to cursor in world coords
    const dxWorld = pointerWorld.x - derivedPt.x
    const dyWorld = pointerWorld.y - derivedPt.y
    const cursorDist = Math.sqrt(dxWorld * dxWorld + dyWorld * dyWorld)

    if (proximityAlpha > 0.01 && cursorDist > 0.01) {
      // Normalize to unit direction, then compute given-point response
      const scale = 1 / cursorDist
      const unitDx = dxWorld * scale
      const unitDy = dyWorld * scale

      const response = constrainedDragStep(
        { x: 0, y: 0 }, // we only care about the delta
        { x: unitDx, y: unitDy },
        highlightState.subJacobian
      )

      if (response) {
        // Convert response to screen pixels
        const respScreenX = response.x * viewport.pixelsPerUnit
        const respScreenY = -response.y * viewport.pixelsPerUnit // Y flipped in screen

        let arrowLen = Math.sqrt(respScreenX * respScreenX + respScreenY * respScreenY)
        arrowLen *= PREVIEW_ARROW_SCALE

        if (arrowLen > 2) {
          const clampedLen = Math.min(arrowLen, PREVIEW_ARROW_MAX_LEN)
          const normFactor =
            clampedLen / Math.sqrt(respScreenX * respScreenX + respScreenY * respScreenY)
          const ax = respScreenX * normFactor
          const ay = respScreenY * normFactor

          const tipX = givenScreen.x + ax
          const tipY = givenScreen.y + ay
          const angle = Math.atan2(ay, ax)

          const arrowAlpha = alpha * 0.7 * proximityAlpha

          // Arrow shaft
          ctx.beginPath()
          ctx.moveTo(givenScreen.x, givenScreen.y)
          ctx.lineTo(tipX, tipY)
          ctx.strokeStyle = PREVIEW_ARROW_COLOR
          ctx.lineWidth = 2.5
          ctx.globalAlpha = arrowAlpha
          ctx.lineCap = 'round'
          ctx.stroke()

          // Arrowhead
          ctx.lineWidth = 2.5
          drawArrowhead(ctx, tipX, tipY, angle, PREVIEW_ARROW_HEAD)
        }
      }
    }
  }

  ctx.restore()

  return highlightState.opacity !== highlightState.targetOpacity || highlightState.opacity > 0
}

// ── Motion trail rendering ──

/**
 * Render the motion trail for a given point during/after drag.
 * @returns true if still animating
 */
export function renderMotionTrail(ctx: CanvasRenderingContext2D, trail: MotionTrailState): boolean {
  if (trail.count < 2 || trail.opacity <= 0.01) return false

  ctx.save()

  // Read positions in order from oldest to newest
  const startIdx = trail.count < TRAIL_MAX_POINTS ? 0 : trail.writeIdx // oldest is at writeIdx when buffer is full

  for (let i = 0; i < trail.count - 1; i++) {
    const idx0 = (startIdx + i) % TRAIL_MAX_POINTS
    const idx1 = (startIdx + i + 1) % TRAIL_MAX_POINTS
    const p0 = trail.positions[idx0]
    const p1 = trail.positions[idx1]

    // Age: 0 = oldest, 1 = newest
    const age = i / (trail.count - 1)
    const segAlpha = age * trail.opacity
    const segWidth = TRAIL_MIN_WIDTH + (TRAIL_MAX_WIDTH - TRAIL_MIN_WIDTH) * age

    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.lineTo(p1.x, p1.y)
    ctx.strokeStyle = TRAIL_COLOR
    ctx.lineWidth = segWidth
    ctx.globalAlpha = segAlpha
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  ctx.restore()
  return trail.opacity > 0
}

// ── Break-free flash rendering ──

/**
 * Render the break-free flash: expanding shockwave ring + line fragment burst.
 * @returns true if still animating
 */
export function renderBreakFreeFlash(
  ctx: CanvasRenderingContext2D,
  flash: BreakFreeFlash,
  now: number
): boolean {
  const elapsed = now - flash.startTime
  if (elapsed >= BREAK_FREE_FLASH_DURATION_MS) return false

  const t = elapsed / BREAK_FREE_FLASH_DURATION_MS
  const eased = easeOutCubic(t)

  ctx.save()

  // ── Expanding shockwave ring from given point ──
  const shockRadius =
    INNER_RING_RADIUS + (BREAK_FREE_SHOCKWAVE_MAX_RADIUS - INNER_RING_RADIUS) * eased
  const shockAlpha = (1 - eased) * 0.8
  ctx.beginPath()
  ctx.arc(flash.givenScreen.x, flash.givenScreen.y, shockRadius, 0, Math.PI * 2)
  ctx.strokeStyle = TENSION_COLOR
  ctx.lineWidth = 3 * (1 - eased) + 0.5
  ctx.globalAlpha = shockAlpha
  ctx.stroke()

  // ── Bright flash on given point (white → amber, fast fade) ──
  const flashT = Math.min(1, elapsed / 100) // 100ms flash
  const flashAlpha = (1 - flashT) * 0.9
  if (flashAlpha > 0.01) {
    const flashGrad = ctx.createRadialGradient(
      flash.givenScreen.x,
      flash.givenScreen.y,
      0,
      flash.givenScreen.x,
      flash.givenScreen.y,
      20
    )
    flashGrad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`)
    flashGrad.addColorStop(0.4, `rgba(${TENSION_COLOR_RGB}, ${flashAlpha * 0.6})`)
    flashGrad.addColorStop(1, `rgba(${TENSION_COLOR_RGB}, 0)`)
    ctx.beginPath()
    ctx.arc(flash.givenScreen.x, flash.givenScreen.y, 20, 0, Math.PI * 2)
    ctx.fillStyle = flashGrad
    ctx.globalAlpha = 1
    ctx.fill()
  }

  // ── Line fragment burst from midpoint of the old constraint line ──
  const midX = (flash.givenScreen.x + flash.derivedScreen.x) / 2
  const midY = (flash.givenScreen.y + flash.derivedScreen.y) / 2
  const lineAngle = Math.atan2(
    flash.derivedScreen.y - flash.givenScreen.y,
    flash.derivedScreen.x - flash.givenScreen.x
  )
  const perpAngle = lineAngle + Math.PI / 2
  const fragAlpha = (1 - eased) * 0.7

  if (fragAlpha > 0.01) {
    ctx.strokeStyle = TENSION_COLOR
    ctx.lineWidth = 2
    ctx.globalAlpha = fragAlpha
    ctx.lineCap = 'round'

    // 4 fragments: 2 pairs going in opposite perpendicular directions
    const fragLen = 8
    const driftDist = 30 * eased
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? 1 : -1
      const offset = (i % 2 === 0 ? -0.3 : 0.3) * fragLen
      const fx = midX + offset * Math.cos(lineAngle) + side * driftDist * Math.cos(perpAngle)
      const fy = midY + offset * Math.sin(lineAngle) + side * driftDist * Math.sin(perpAngle)
      ctx.beginPath()
      ctx.moveTo(fx, fy)
      ctx.lineTo(
        fx + fragLen * Math.cos(lineAngle + side * 0.3),
        fy + fragLen * Math.sin(lineAngle + side * 0.3)
      )
      ctx.stroke()
    }
  }

  ctx.restore()
  return true
}

/** Exported constants for use by the drag handler. */
export { TENSION_START_RADIUS, BREAK_FREE_RADIUS, TENSION_DAMPEN }
