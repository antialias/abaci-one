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

// --- Animation timing ---

/** Compute staggered timing for N steps, normalized to [0, 1]. */
function computeStepTimings(count: number): Array<{ start: number; end: number }> {
  const OVERLAP = 0.7 // next step starts at 70% of previous duration
  const DECAY = 0.88  // each step is 88% the duration of the previous

  const durations: number[] = []
  let d = 1
  for (let i = 0; i < count; i++) {
    durations.push(d)
    d *= DECAY
  }

  const starts: number[] = [0]
  for (let i = 1; i < count; i++) {
    starts[i] = starts[i - 1] + durations[i - 1] * OVERLAP
  }

  const totalSpan = starts[count - 1] + durations[count - 1]

  return durations.map((dur, i) => ({
    start: starts[i] / totalSpan,
    end: (starts[i] + dur) / totalSpan,
  }))
}

/** Fraction of revealProgress used for compass sweeps; remainder is rectangle fade-in. */
const SWEEP_PHASE = 0.85

const STEP_TIMINGS = computeStepTimings(NUM_LEVELS)

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

// --- Canvas rendering ---

const COLOR_LIGHT = '#4338ca'
const COLOR_DARK = '#f59e0b'
const SPIRAL_COLOR_LIGHT = '#7c3aed'
const SPIRAL_COLOR_DARK = '#fbbf24'

/**
 * Render the golden ratio demo overlay on the canvas.
 *
 * Animation within revealProgress [0, 1]:
 *   [0, SWEEP_PHASE]:  compass arms sweep, tracing golden spiral arcs;
 *                       each arm lands as a subdivision division line.
 *   [SWEEP_PHASE, 1]:  outer rectangle + φ label fade in.
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

  // --- Compass sweep phase: trace golden spiral arcs ---
  const sweepProgress = Math.min(1, revealProgress / SWEEP_PHASE)

  for (let i = 0; i < NUM_LEVELS; i++) {
    const timing = STEP_TIMINGS[i]
    const rawT = (sweepProgress - timing.start) / (timing.end - timing.start)
    if (rawT <= 0) continue

    const t = easeOutCubic(Math.min(1, rawT))
    const stepAlpha = opacity * Math.min(1, rawT * 3)
    const sub = SUBDIVISIONS[i]

    const cx = toX(sub.arcCx)
    const cy = toY(sub.arcCy)
    const r = sub.side * ppu
    const currentAngle = sub.arcStartAngle + ARC_SWEEP * t

    // Golden spiral arc (traced by the compass tip)
    ctx.globalAlpha = stepAlpha
    ctx.strokeStyle = spiralColor
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(cx, cy, r, sub.arcStartAngle, currentAngle, false)
    ctx.stroke()

    // Compass arm / division line
    const ex = cx + r * Math.cos(currentAngle)
    const ey = cy + r * Math.sin(currentAngle)
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.stroke()
  }

  // --- Rectangle + label fade in after arcs are drawn ---
  if (revealProgress > SWEEP_PHASE) {
    const rectFade = Math.min(1, (revealProgress - SWEEP_PHASE) / (1 - SWEEP_PHASE))
    ctx.globalAlpha = opacity * rectFade

    // Outer golden rectangle
    const rectLeft = toX(0)
    const rectTop = toY(-1)
    const rectWidth = PHI * ppu
    const rectHeight = 1 * ppu

    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.strokeRect(rectLeft, rectTop, rectWidth, rectHeight)

    // φ label above the rectangle
    ctx.fillStyle = color
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('φ', toX(PHI), toY(-1) - 6)
  }

  ctx.globalAlpha = 1
  ctx.restore()
}
