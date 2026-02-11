import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

const PHI = (1 + Math.sqrt(5)) / 2
const NUM_LEVELS = 10

/**
 * Target viewport for the golden ratio demo.
 * Centers the rectangle [0, φ] with some padding.
 */
export function goldenRatioDemoViewport(_cssWidth: number, cssHeight: number) {
  const center = PHI / 2
  // Scale so the rectangle height (1 unit) fills ~40% of canvas height
  const ppu = cssHeight * 0.35
  return { center, pixelsPerUnit: ppu }
}

// --- Subdivision computation ---

interface Subdivision {
  /** Square top-left in number-line coords (y=0 is axis) */
  sx: number
  sy: number
  side: number
  /** Arc center in number-line coords */
  arcCx: number
  arcCy: number
  /** Start angle of the 90° clockwise arc (after y-flip) */
  arcStartAngle: number
}

/**
 * Compute the golden rectangle subdivisions.
 *
 * Starting rectangle: [0, φ] × [-1, 0]. Bottom edge on the axis (y=0),
 * extending 1 unit upward. First cut from LEFT so the 1×1 square aligns
 * with "1" on the number line.
 *
 * After computing the canonical subdivisions, a y-flip is applied so the
 * spiral opens downward (toward the axis) instead of upward, giving the
 * classic "opening left" golden spiral orientation.
 */
function computeSubdivisions(): Subdivision[] {
  const subs: Subdivision[] = []

  let rx = 0
  let ry = -1
  let rw = PHI
  let rh = 1
  let dir = 0

  for (let i = 0; i < NUM_LEVELS; i++) {
    const side = dir % 2 === 0 ? rh : rw
    let sx: number, sy: number
    let arcCx: number, arcCy: number
    let arcStart: number

    switch (dir) {
      case 0: // Cut from LEFT
        sx = rx; sy = ry
        rx += side; rw -= side
        arcCx = sx + side; arcCy = sy
        arcStart = Math.PI
        break

      case 1: // Cut from BOTTOM
        sx = rx; sy = ry + rh - side
        rh -= side
        arcCx = sx; arcCy = sy
        arcStart = Math.PI / 2
        break

      case 2: // Cut from RIGHT
        sx = rx + rw - side; sy = ry
        rw -= side
        arcCx = sx; arcCy = sy + side
        arcStart = 0
        break

      case 3: // Cut from TOP
        sx = rx; sy = ry
        ry += side; rh -= side
        arcCx = sx + side; arcCy = sy + side
        arcStart = Math.PI * 1.5
        break

      default:
        throw new Error('unreachable')
    }

    subs.push({ sx, sy, side, arcCx, arcCy, arcStartAngle: arcStart })
    dir = (dir + 1) % 4
  }

  // Y-flip within the rectangle (mirror around y = -0.5).
  // This flips the spiral so it opens toward the axis instead of away from it.
  // y' = -1 - y, angles negate, arcs become clockwise.
  for (const sub of subs) {
    sub.sy = -1 - sub.sy - sub.side
    sub.arcCy = -1 - sub.arcCy
    sub.arcStartAngle = -sub.arcStartAngle
  }

  return subs
}

// Pre-compute once
const SUBDIVISIONS = computeSubdivisions()

/** Every arc sweeps exactly 90° */
const ARC_SWEEP = Math.PI / 2

// --- Stage bounds for convergence animation ---

interface StageBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * STAGE_BOUNDS[k] = bounding box of SUBDIVISIONS[k..N-1].
 *
 * Used to rescale the inside-out construction so that it always fits
 * exactly in [0, φ] on the number line. As k decreases (more squares
 * added), the aspect ratio converges to φ.
 */
function computeStageBounds(): StageBounds[] {
  const result: StageBounds[] = new Array(NUM_LEVELS)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (let k = NUM_LEVELS - 1; k >= 0; k--) {
    const sub = SUBDIVISIONS[k]
    minX = Math.min(minX, sub.sx)
    maxX = Math.max(maxX, sub.sx + sub.side)
    minY = Math.min(minY, sub.sy)
    maxY = Math.max(maxY, sub.sy + sub.side)
    result[k] = { minX, maxX, minY, maxY }
  }

  return result
}

const STAGE_BOUNDS = computeStageBounds()

// --- Animation timing ---

/** Fraction of revealProgress for compass sweeps; remainder for rectangle fade. */
const SWEEP_PHASE = 0.85

/**
 * Sequential step timings with growth: later steps (larger outer squares
 * that cause the most dramatic ratio changes) get progressively more time.
 */
function computeStepTimings(count: number): Array<{ start: number; end: number }> {
  const GROWTH = 1.12

  const durations: number[] = []
  let d = 1
  for (let i = 0; i < count; i++) {
    durations.push(d)
    d *= GROWTH
  }

  const total = durations.reduce((a, b) => a + b, 0)
  let cumulative = 0

  return durations.map(dur => {
    const start = cumulative / total
    cumulative += dur
    return { start, end: cumulative / total }
  })
}

const STEP_TIMINGS = computeStepTimings(NUM_LEVELS)

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// --- Canvas rendering ---

const COLOR_LIGHT = '#4338ca'
const COLOR_DARK = '#f59e0b'
const SPIRAL_COLOR_LIGHT = '#7c3aed'
const SPIRAL_COLOR_DARK = '#fbbf24'

/**
 * Render the golden ratio demo overlay on the canvas.
 *
 * The animation builds the golden rectangle from the inside out at
 * a fixed [0, φ] scale. The construction rotates so the currently-
 * drawn compass arm is always horizontal on the number line axis,
 * pinned at position 1. Arcs grow with each step as the aspect
 * ratio converges to φ. After all sweeps, the construction smoothly
 * unrotates to canonical orientation.
 *
 * @param revealProgress 0-1 for the full construction animation
 * @param opacity 0-1 overall overlay opacity for fade-in/fade-out
 */
export function renderGoldenRatioOverlay(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  revealProgress: number,
  opacity: number
): void {
  if (opacity <= 0) return

  const centerY = cssHeight / 2
  const ppu = state.pixelsPerUnit

  const toX = (nlx: number) => numberToScreenX(nlx, state.center, ppu, cssWidth)
  const toY = (nly: number) => centerY + nly * ppu

  const color = isDark ? COLOR_DARK : COLOR_LIGHT
  const spiralColor = isDark ? SPIRAL_COLOR_DARK : SPIRAL_COLOR_LIGHT

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.setLineDash([])

  // --- Base line on axis [0, φ] ---
  ctx.beginPath()
  ctx.moveTo(toX(0), toY(0))
  ctx.lineTo(toX(PHI), toY(0))
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.stroke()

  // --- Compass sweep phase: build inside → out with convergence ---
  // Draws SUBDIVISIONS[N-1] (smallest) first, then [N-2], ... (progressively
  // larger). The currently-drawn compass arm is kept horizontal on the axis.
  // Arcs grow with each step, and the aspect ratio converges to φ.
  // Reversed sweep (endAngle → startAngle) ensures arm continuity between
  // steps in inside-out order.
  const sweepProgress = Math.min(1, revealProgress / SWEEP_PHASE)

  // Find current animation step.
  // Step i (inside-out) reveals SUBDIVISIONS[N-1-i].
  // Pivot, scale, and arc sweep all happen simultaneously.

  let animStep = NUM_LEVELS // all done
  let stepT = 0   // 0→1 progress within current step

  for (let i = 0; i < NUM_LEVELS; i++) {
    if (sweepProgress < STEP_TIMINGS[i].end) {
      animStep = i
      stepT = easeOutCubic(Math.max(0, Math.min(1,
        (sweepProgress - STEP_TIMINGS[i].start) /
        (STEP_TIMINGS[i].end - STEP_TIMINGS[i].start)
      )))
      break
    }
  }

  // --- Transform: arm always spans [0, 1] on the number line ---
  // Tip at 0, pivot at 1, arm horizontal.
  // Pivot, scale, and angle all interpolate together with stepT.

  let armPivotX: number, armPivotY: number, armAngle: number, armSide: number

  if (animStep < NUM_LEVELS) {
    const currSub = SUBDIVISIONS[NUM_LEVELS - 1 - animStep]
    const prevSub = animStep > 0
      ? SUBDIVISIONS[NUM_LEVELS - animStep]
      : currSub

    // Everything transitions simultaneously
    armPivotX = lerp(prevSub.arcCx, currSub.arcCx, stepT)
    armPivotY = lerp(prevSub.arcCy, currSub.arcCy, stepT)
    armSide = lerp(prevSub.side, currSub.side, stepT)

    // Angle sweeps from end to start simultaneously
    const transitionAngle = currSub.arcStartAngle + ARC_SWEEP
    armAngle = transitionAngle - ARC_SWEEP * stepT
  } else {
    // All steps done — use last step's final arm position
    const sub = SUBDIVISIONS[0]
    armPivotX = sub.arcCx
    armPivotY = sub.arcCy
    armSide = sub.side
    armAngle = sub.arcStartAngle
  }

  // Arm tip (arc-drawing endpoint) in subdivision coords
  const tipX = armPivotX + armSide * Math.cos(armAngle)
  const tipY = armPivotY + armSide * Math.sin(armAngle)

  // Transform anchored at the TIP → origin (0, 0). Pivot lands at (1, 0).
  const effRotation = Math.PI - armAngle
  const cosR = Math.cos(effRotation)
  const sinR = Math.sin(effRotation)
  const effScale = 1 / armSide

  // Transform subdivision coords → number-line coords
  function subToNL(x: number, y: number): [number, number] {
    const dx = x - tipX
    const dy = y - tipY
    const rx = dx * cosR - dy * sinR
    const ry = dx * sinR + dy * cosR
    return [rx * effScale, ry * effScale]
  }

  function subToScreen(x: number, y: number): [number, number] {
    const [nlx, nly] = subToNL(x, y)
    return [toX(nlx), toY(nly)]
  }

  // Transform angle from subdivision space to screen space
  function xformAngle(angle: number): number {
    return angle + effRotation
  }

  // Screen radius for a subdivision side length
  function screenR(side: number): number {
    return side * effScale * ppu
  }

  // Draw completed arcs + division lines (from previous steps)
  for (let i = 0; i < animStep && i < NUM_LEVELS; i++) {
    const sub = SUBDIVISIONS[NUM_LEVELS - 1 - i]

    const [cx, cy] = subToScreen(sub.arcCx, sub.arcCy)
    const r = screenR(sub.side)
    const sEnd = xformAngle(sub.arcStartAngle + ARC_SWEEP)
    const sStart = xformAngle(sub.arcStartAngle)

    // Full spiral arc (reversed: end → start, anticlockwise)
    ctx.globalAlpha = opacity
    ctx.strokeStyle = spiralColor
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(cx, cy, r, sEnd, sStart, true)
    ctx.stroke()

    // Division line at endAngle
    const ex = cx + r * Math.cos(sEnd)
    const ey = cy + r * Math.sin(sEnd)
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.stroke()
  }

  // Draw current sweeping arc + compass arm
  // Use interpolated arm parameters so the growing tip stays pinned at origin
  if (animStep < NUM_LEVELS && stepT > 0) {
    const [cx, cy] = subToScreen(armPivotX, armPivotY)
    const r = screenR(armSide)
    const currSub = SUBDIVISIONS[NUM_LEVELS - 1 - animStep]
    const sEnd = xformAngle(currSub.arcStartAngle + ARC_SWEEP)
    const sCur = xformAngle(armAngle)

    // Partial spiral arc (reversed: end → current, anticlockwise)
    ctx.globalAlpha = opacity
    ctx.strokeStyle = spiralColor
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(cx, cy, r, sEnd, sCur, true)
    ctx.stroke()

    // Compass arm
    const ex = cx + r * Math.cos(sCur)
    const ey = cy + r * Math.sin(sCur)
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.stroke()
  }

  // --- Outer rectangle + φ label fade in after construction ---
  if (revealProgress > SWEEP_PHASE) {
    const bb = STAGE_BOUNDS[0]
    const rectFade = Math.min(1, (revealProgress - SWEEP_PHASE) / (1 - SWEEP_PHASE))
    ctx.globalAlpha = opacity * rectFade

    // Draw rectangle as a polygon (in current rotated frame)
    const [c0x, c0y] = subToScreen(bb.minX, bb.minY)
    const [c1x, c1y] = subToScreen(bb.maxX, bb.minY)
    const [c2x, c2y] = subToScreen(bb.maxX, bb.maxY)
    const [c3x, c3y] = subToScreen(bb.minX, bb.maxY)

    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(c0x, c0y)
    ctx.lineTo(c1x, c1y)
    ctx.lineTo(c2x, c2y)
    ctx.lineTo(c3x, c3y)
    ctx.closePath()
    ctx.stroke()

    ctx.fillStyle = color
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const [lx, ly] = subToScreen(
      (bb.minX + bb.maxX) / 2,
      bb.minY
    )
    ctx.fillText('φ', lx, ly - 6)
  }

  ctx.globalAlpha = 1
  ctx.restore()
}
