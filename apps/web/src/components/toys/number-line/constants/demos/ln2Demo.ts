import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

/**
 * ln(2) Demo: "The Bouncing Ball"
 *
 * Visualises ln(2) ≈ 0.693 as the alternating harmonic series:
 * ln(2) = 1 − 1/2 + 1/3 − 1/4 + ...
 *
 * A ball bounces back and forth on the number line with diminishing arcs
 * that converge to ln(2). Rightward arcs curve above the axis (orange),
 * leftward arcs curve below (blue).
 */

// ── Constants ────────────────────────────────────────────────────────

const LN2 = Math.LN2 // 0.6931471805599453
const PI = Math.PI

// ── Precomputed bounces ──────────────────────────────────────────────

interface Bounce {
  index: number // 1-based term index
  fromVal: number // partial sum before this bounce
  toVal: number // partial sum after this bounce
  jumpSize: number // 1/n
  isRight: boolean // odd terms go right, even go left
}

const MAX_BOUNCES = 200

const BOUNCES: Bounce[] = (() => {
  const arr: Bounce[] = []
  let sum = 0
  for (let n = 1; n <= MAX_BOUNCES; n++) {
    const size = 1 / n
    const isRight = n % 2 === 1
    const from = sum
    const to = isRight ? sum + size : sum - size
    arr.push({ index: n, fromVal: from, toVal: to, jumpSize: size, isRight })
    sum = to
  }
  return arr
})()

// ── Utilities ────────────────────────────────────────────────────────

function mapRange(v: number, s: number, e: number): number {
  if (v <= s) return 0
  if (v >= e) return 1
  return (v - s) / (e - s)
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

function easeInOut(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2
}

// ── Phase timing ─────────────────────────────────────────────────────
// Must align with ln2DemoNarration.ts segment boundaries.

const PHASE = {
  // Seg 0: Place — ball fades in at 0
  placeBegin: 0.0,
  placeEnd: 0.08,
  // Seg 1: First bounces — bounces 1–4 with piece-of-a-whole visualization
  firstBegin: 0.08,
  firstEnd: 0.35,
  // Seg 2: More bounces — bounces 5–12, faster
  moreBegin: 0.35,
  moreEnd: 0.55,
  // Seg 3: Cascade — bounces 13–26, rapid
  cascadeBegin: 0.55,
  cascadeEnd: 0.72,
  // Seg 4: Converge — bounces 27–40, tiny arcs spiral inward
  convergeBegin: 0.72,
  convergeEnd: 0.86,
  // Seg 5: Reveal — star, label, subtitle
  revealBegin: 0.86,
  revealEnd: 1.0,
} as const

// ── Accelerating bounce timing ───────────────────────────────────────
// Each bounce takes `ratio` of the previous bounce's time.
// ratio < 1 → bounces accelerate (each one faster than the last).

function computeBounceBounds(
  segStart: number,
  segEnd: number,
  count: number,
  ratio: number
): { starts: number[]; ends: number[] } {
  const durations: number[] = []
  let d = 1
  for (let i = 0; i < count; i++) {
    durations.push(d)
    d *= ratio
  }
  const total = durations.reduce((a, b) => a + b, 0)
  const segLen = segEnd - segStart
  const starts: number[] = []
  const ends: number[] = []
  let cum = segStart
  for (let i = 0; i < count; i++) {
    starts.push(cum)
    cum += (durations[i] / total) * segLen
    ends.push(cum)
  }
  return { starts, ends }
}

// Single continuous accelerating sequence for bounces 13–40 (28 bounces)
// spanning seg 3 + seg 4 (progress 0.55–0.86). One curve = no velocity
// discontinuity at the narration boundary. Ratio 0.86 → last bounce is
// ~50× faster than the first, closing the spiral smoothly.
// 188 bounces (13–200). Ratio 0.94 → first ~40 individually visible,
// then a rapid blur closes the spiral to sub-pixel. Error after 200
// terms is ~1/(2·200) = 0.0025 units — invisible at any zoom.
const ACCEL_BOUNDS = computeBounceBounds(PHASE.cascadeBegin, PHASE.convergeEnd, 188, 0.94)

// ── Colors ───────────────────────────────────────────────────────────

function rightCol(isDark: boolean) {
  return isDark ? '#fb923c' : '#ea580c'
} // orange (right/above)
function leftCol(isDark: boolean) {
  return isDark ? '#60a5fa' : '#3b82f6'
} // blue (left/below)
function ballCol(isDark: boolean) {
  return isDark ? '#fbbf24' : '#d97706'
} // amber ball
function resultCol(isDark: boolean) {
  return isDark ? '#34d399' : '#059669'
} // green (result)
function subtextCol(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'
}
function dimCol(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)'
} // dim reference

// ── Viewport ─────────────────────────────────────────────────────────

export function ln2DemoViewport(cssWidth: number, cssHeight: number) {
  // Fit [−0.15, 1.15] horizontally with vertical room for arcs
  const center = 0.5
  const rangeWidth = 1.3
  const ppu = Math.min((cssWidth * 0.75) / rangeWidth, cssHeight * 0.3)
  return { center, pixelsPerUnit: ppu }
}

// ── Drawing helpers ──────────────────────────────────────────────────

type ToX = (v: number) => number

/**
 * Draw a semicircular arc for a bounce.
 * Above-axis arcs (rightward) curve upward; below-axis arcs (leftward) curve downward.
 *
 * Canvas angle convention (Y-down): 0=right, PI/2=down, PI=left, 3PI/2=up.
 * "clockwise" on screen = anticlockwise=false = increasing angles.
 *
 * Rightward bounce: fromVal < toVal, starts at angle PI (left), sweeps
 *   clockwise through 3PI/2 (top) to 2PI (right) → curves ABOVE axis.
 * Leftward bounce: fromVal > toVal, starts at angle 0 (right), sweeps
 *   clockwise through PI/2 (bottom) to PI (left) → curves BELOW axis.
 */
function drawBounceArc(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  fromVal: number,
  toVal: number,
  isAbove: boolean,
  isDark: boolean,
  alpha: number,
  /** 0-1: how much of the arc to draw (1 = full semicircle) */
  progress: number,
  lineWidth = 2
) {
  if (progress <= 0 || alpha <= 0) return

  const x0 = toX(fromVal)
  const x1 = toX(toVal)
  const cx = (x0 + x1) / 2
  const radius = Math.abs(x1 - x0) / 2

  if (radius < 0.5) return // too small to see

  ctx.beginPath()
  if (isAbove) {
    // Rightward: start at PI (left=fromVal), sweep clockwise to 2PI (right=toVal)
    ctx.arc(cx, axisY, radius, PI, PI + PI * progress, false)
  } else {
    // Leftward: start at 0 (right=fromVal), sweep clockwise to PI (left=toVal)
    ctx.arc(cx, axisY, radius, 0, PI * progress, false)
  }
  ctx.strokeStyle = isAbove ? rightCol(isDark) : leftCol(isDark)
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha
  ctx.stroke()
}

/**
 * Compute ball position along a bounce arc at progress t.
 * Must match drawBounceArc's geometry exactly.
 */
function ballOnArc(
  toX: ToX,
  axisY: number,
  fromVal: number,
  toVal: number,
  isAbove: boolean,
  t: number
): { x: number; y: number } {
  const x0 = toX(fromVal)
  const x1 = toX(toVal)
  const cx = (x0 + x1) / 2
  const radius = Math.abs(x1 - x0) / 2

  // Canvas: y = cy + r*sin(angle), with sin(3PI/2)=-1 (above), sin(PI/2)=+1 (below)
  if (isAbove) {
    // Angle sweeps PI → 2*PI (above axis)
    const angle = PI + PI * t
    return {
      x: cx + radius * Math.cos(angle),
      y: axisY + radius * Math.sin(angle),
    }
  } else {
    // Angle sweeps 0 → PI (below axis)
    const angle = PI * t
    return {
      x: cx + radius * Math.cos(angle),
      y: axisY + radius * Math.sin(angle),
    }
  }
}

/**
 * Draw the bouncing ball with a highlight.
 */
function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  isDark: boolean,
  alpha: number
) {
  if (alpha <= 0) return

  // Main ball
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, PI * 2)
  ctx.fillStyle = ballCol(isDark)
  ctx.globalAlpha = alpha
  ctx.fill()

  // Highlight
  ctx.beginPath()
  ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.35, 0, PI * 2)
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.6)'
  ctx.globalAlpha = alpha * 0.8
  ctx.fill()
}

/**
 * Draw a small landing dot at a bounce position.
 */
function drawLandingDot(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  val: number,
  isAbove: boolean,
  isDark: boolean,
  alpha: number
) {
  if (alpha <= 0) return
  const x = toX(val)
  ctx.beginPath()
  ctx.arc(x, axisY, 3, 0, PI * 2)
  ctx.fillStyle = isAbove ? rightCol(isDark) : leftCol(isDark)
  ctx.globalAlpha = alpha
  ctx.fill()
}

/**
 * Draw piece subdivision of the first bounce (0→1) into n equal pieces,
 * with one piece highlighted at the bounce's actual location.
 *
 * The 0→1 segment gets dim tick marks showing equal divisions. The
 * highlighted piece is drawn at fromVal→toVal (where the ball actually
 * bounces), showing that this bounce covers exactly one piece.
 */
function drawPieceSubdivision(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  n: number,
  fromVal: number,
  toVal: number,
  isRight: boolean,
  isDark: boolean,
  alpha: number
) {
  if (alpha <= 0 || n < 2) return

  const x0 = toX(0)
  const x1 = toX(1)
  const tickHeight = 10
  const bounceColor = isRight ? rightCol(isDark) : leftCol(isDark)

  // Dim reference line for the full 0→1 segment
  ctx.beginPath()
  ctx.moveTo(x0, axisY)
  ctx.lineTo(x1, axisY)
  ctx.strokeStyle = dimCol(isDark)
  ctx.lineWidth = 3
  ctx.globalAlpha = alpha * 0.5
  ctx.stroke()

  // Tick marks at each division point
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * (i / n)
    ctx.beginPath()
    ctx.moveTo(x, axisY - tickHeight)
    ctx.lineTo(x, axisY + tickHeight)
    ctx.strokeStyle = dimCol(isDark)
    ctx.lineWidth = 1.5
    ctx.globalAlpha = alpha * 0.7
    ctx.stroke()
  }

  // Highlighted piece at the bounce's actual location (fromVal → toVal)
  const pieceX0 = toX(fromVal)
  const pieceX1 = toX(toVal)
  ctx.beginPath()
  ctx.moveTo(pieceX0, axisY)
  ctx.lineTo(pieceX1, axisY)
  ctx.strokeStyle = bounceColor
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha * 0.9
  ctx.stroke()

  // Dots at highlighted piece endpoints
  for (const px of [pieceX0, pieceX1]) {
    ctx.beginPath()
    ctx.arc(px, axisY, 3.5, 0, PI * 2)
    ctx.fillStyle = bounceColor
    ctx.globalAlpha = alpha * 0.9
    ctx.fill()
  }
}

/** Draw a 5-pointed star (reused from √3 demo pattern) */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  alpha: number
) {
  if (alpha <= 0 || r <= 0) return
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const angle = -PI / 2 + (i * PI) / 5
    const rad = i % 2 === 0 ? r : r * 0.4
    const px = cx + rad * Math.cos(angle)
    const py = cy + rad * Math.sin(angle)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.fill()
}

/** Draw the ln(2) target line */
function drawTargetLine(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  isDark: boolean,
  alpha: number,
  height: number
) {
  if (alpha <= 0) return
  const x = toX(LN2)
  ctx.beginPath()
  ctx.moveTo(x, axisY - height)
  ctx.lineTo(x, axisY + height)
  ctx.strokeStyle = resultCol(isDark)
  ctx.lineWidth = 2
  ctx.setLineDash([4, 3])
  ctx.globalAlpha = alpha
  ctx.stroke()
  ctx.setLineDash([])
}

// ── Main render ──────────────────────────────────────────────────────

export function renderLn2Overlay(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  revealProgress: number,
  opacity: number
): void {
  if (opacity <= 0) return

  const ppu = state.pixelsPerUnit
  const axisY = cssHeight / 2
  const toX = (v: number) => numberToScreenX(v, state.center, ppu, cssWidth)
  const ballRadius = Math.max(5, Math.min(10, ppu * 0.04))

  ctx.save()

  // ── Seg 0: Place — ball fades in at 0 ──
  if (revealProgress >= PHASE.placeBegin && revealProgress < PHASE.firstEnd) {
    const placeP = smoothstep(mapRange(revealProgress, PHASE.placeBegin, PHASE.placeEnd))

    if (placeP > 0 && revealProgress < PHASE.firstBegin + 0.02) {
      // Ball at position 0 with pulse
      const pulse = 1 + 0.15 * Math.sin(placeP * PI * 4)
      drawBall(ctx, toX(0), axisY, ballRadius * pulse * placeP, isDark, opacity * placeP)
    }
  }

  // ── Seg 1: First bounces — bounces 1–4 with piece visualization ──
  if (revealProgress >= PHASE.firstBegin) {
    const segDuration = PHASE.firstEnd - PHASE.firstBegin // 0.27
    const bouncesInSeg = 4
    const bounceSlice = segDuration / bouncesInSeg

    for (let i = 0; i < bouncesInSeg; i++) {
      const bounce = BOUNCES[i]
      const bounceStart = PHASE.firstBegin + i * bounceSlice
      const bounceEnd = bounceStart + bounceSlice
      const bounceP = easeInOut(
        mapRange(revealProgress, bounceStart, bounceEnd - bounceSlice * 0.15)
      )

      if (bounceP <= 0) continue

      // Draw completed arc (ghost if done)
      const arcDone = revealProgress >= bounceEnd
      const arcAlpha = arcDone
        ? Math.max(0.15, 0.5 * 0.85 ** ((revealProgress - bounceEnd) / bounceSlice))
        : 1
      drawBounceArc(
        ctx,
        toX,
        axisY,
        bounce.fromVal,
        bounce.toVal,
        bounce.isRight,
        isDark,
        opacity * arcAlpha,
        Math.min(1, bounceP),
        3
      )

      // Landing dot when arc is done
      if (arcDone) {
        drawLandingDot(
          ctx,
          toX,
          axisY,
          bounce.toVal,
          bounce.isRight,
          isDark,
          opacity * arcAlpha * 0.7
        )
      }

      // Piece subdivision (for bounces 2, 3, 4)
      if (i >= 1) {
        const subdivStart = bounceStart - bounceSlice * 0.1
        const subdivEnd = bounceEnd + bounceSlice * 0.1
        const subdivFadeIn = smoothstep(
          mapRange(revealProgress, subdivStart, bounceStart + bounceSlice * 0.1)
        )
        const subdivFadeOut =
          1 - smoothstep(mapRange(revealProgress, bounceEnd - bounceSlice * 0.15, subdivEnd))
        const subdivAlpha = subdivFadeIn * subdivFadeOut
        if (subdivAlpha > 0.01) {
          drawPieceSubdivision(
            ctx,
            toX,
            axisY,
            bounce.index,
            bounce.fromVal,
            bounce.toVal,
            bounce.isRight,
            isDark,
            opacity * subdivAlpha
          )
        }
      }

      // Ball position during this bounce
      if (!arcDone && bounceP > 0) {
        const pos = ballOnArc(
          toX,
          axisY,
          bounce.fromVal,
          bounce.toVal,
          bounce.isRight,
          Math.min(1, bounceP)
        )
        drawBall(ctx, pos.x, pos.y, ballRadius, isDark, opacity)
      }
    }

    // After all 4 bounces done, ball sits at S(4)
    if (
      revealProgress >= PHASE.firstEnd - bounceSlice * 0.1 &&
      revealProgress < PHASE.moreBegin + 0.02
    ) {
      const restAlpha = smoothstep(
        mapRange(revealProgress, PHASE.firstEnd - bounceSlice * 0.15, PHASE.firstEnd)
      )
      if (restAlpha > 0) {
        drawBall(ctx, toX(BOUNCES[3].toVal), axisY, ballRadius, isDark, opacity * restAlpha)
      }
    }
  }

  // ── Seg 2: More bounces — bounces 5–12, faster ──
  if (revealProgress >= PHASE.moreBegin) {
    const startBounce = 4 // index into BOUNCES (0-based)
    const endBounce = 12
    const count = endBounce - startBounce
    const segDuration = PHASE.moreEnd - PHASE.moreBegin
    const bounceSlice = segDuration / count

    for (let i = startBounce; i < endBounce; i++) {
      const bounce = BOUNCES[i]
      const bounceStart = PHASE.moreBegin + (i - startBounce) * bounceSlice
      const bounceEnd = bounceStart + bounceSlice
      const bounceP = easeInOut(
        mapRange(revealProgress, bounceStart, bounceEnd - bounceSlice * 0.1)
      )

      if (bounceP <= 0) continue

      const arcDone = revealProgress >= bounceEnd
      const age = arcDone ? (revealProgress - bounceEnd) / segDuration : 0
      const arcAlpha = arcDone ? Math.max(0.12, 0.5 * 0.92 ** (age * 30)) : 1
      drawBounceArc(
        ctx,
        toX,
        axisY,
        bounce.fromVal,
        bounce.toVal,
        bounce.isRight,
        isDark,
        opacity * arcAlpha,
        Math.min(1, bounceP),
        2
      )

      if (arcDone) {
        drawLandingDot(
          ctx,
          toX,
          axisY,
          bounce.toVal,
          bounce.isRight,
          isDark,
          opacity * arcAlpha * 0.5
        )
      }

      if (!arcDone && bounceP > 0) {
        const pos = ballOnArc(
          toX,
          axisY,
          bounce.fromVal,
          bounce.toVal,
          bounce.isRight,
          Math.min(1, bounceP)
        )
        drawBall(ctx, pos.x, pos.y, ballRadius * 0.9, isDark, opacity)
      }
    }

    // Rest position after seg 2
    if (
      revealProgress >= PHASE.moreEnd - bounceSlice &&
      revealProgress < PHASE.cascadeBegin + 0.02
    ) {
      const lastBounce = BOUNCES[endBounce - 1]
      const restP = smoothstep(
        mapRange(revealProgress, PHASE.moreEnd - bounceSlice * 0.5, PHASE.moreEnd)
      )
      if (restP > 0) {
        drawBall(ctx, toX(lastBounce.toVal), axisY, ballRadius * 0.9, isDark, opacity * restP)
      }
    }
  }

  // ── Seg 3+4: Bounces 13–40 — one continuous accelerating sequence ──
  // Single acceleration curve across both narration segments so the ball
  // never pauses at the seg 3/4 boundary.
  if (revealProgress >= PHASE.cascadeBegin) {
    const startBounce = 12
    const count = 188 // bounces 13–200
    const totalDuration = PHASE.convergeEnd - PHASE.cascadeBegin

    for (let j = 0; j < count; j++) {
      const i = startBounce + j
      const bounce = BOUNCES[i]
      const bStart = ACCEL_BOUNDS.starts[j]
      const bEnd = ACCEL_BOUNDS.ends[j]
      const bounceP = smoothstep(mapRange(revealProgress, bStart, bEnd))

      if (bounceP <= 0) continue

      const arcDone = revealProgress >= bEnd
      const age = arcDone ? (revealProgress - bEnd) / totalDuration : 0
      const arcAlpha = arcDone
        ? Math.max(0.06, 0.4 * 0.92 ** (age * 30))
        : Math.max(0.5, 0.8 - j * 0.01)
      const lw = Math.max(1, 2 - j * 0.04)
      const ballScale = Math.max(0.5, 0.7 - j * 0.007)
      drawBounceArc(
        ctx,
        toX,
        axisY,
        bounce.fromVal,
        bounce.toVal,
        bounce.isRight,
        isDark,
        opacity * arcAlpha,
        Math.min(1, bounceP),
        lw
      )

      if (!arcDone && bounceP > 0) {
        const pos = ballOnArc(
          toX,
          axisY,
          bounce.fromVal,
          bounce.toVal,
          bounce.isRight,
          Math.min(1, bounceP)
        )
        drawBall(ctx, pos.x, pos.y, ballRadius * ballScale, isDark, opacity * 0.9)
      }
    }

    // Ball rests at final position after all bounces
    const lastEnd = ACCEL_BOUNDS.ends[count - 1]
    if (revealProgress >= lastEnd) {
      drawBall(
        ctx,
        toX(BOUNCES[startBounce + count - 1].toVal),
        axisY,
        ballRadius * 0.5,
        isDark,
        opacity
      )
    }

    // Target line fades in during convergence
    const lineAlpha = smoothstep(
      mapRange(revealProgress, PHASE.convergeBegin + 0.06, PHASE.convergeEnd - 0.02)
    )
    drawTargetLine(ctx, toX, axisY, isDark, opacity * lineAlpha * 0.6, 30)
  }

  // ── Ghost arcs from previous segments persist so the full pattern is visible ──
  if (revealProgress >= PHASE.moreBegin) {
    for (let i = 0; i < 4 && i < BOUNCES.length; i++) {
      const bounce = BOUNCES[i]
      const age = (revealProgress - PHASE.firstEnd) / (1 - PHASE.firstEnd)
      const ghostAlpha = Math.max(0.06, 0.3 * 0.85 ** (age * 10))
      drawBounceArc(
        ctx,
        toX,
        axisY,
        bounce.fromVal,
        bounce.toVal,
        bounce.isRight,
        isDark,
        opacity * ghostAlpha,
        1,
        1.5
      )
    }
  }

  if (revealProgress >= PHASE.cascadeBegin) {
    for (let i = 4; i < 12 && i < BOUNCES.length; i++) {
      const bounce = BOUNCES[i]
      const age = (revealProgress - PHASE.moreEnd) / (1 - PHASE.moreEnd)
      const ghostAlpha = Math.max(0.05, 0.25 * 0.88 ** (age * 10))
      drawBounceArc(
        ctx,
        toX,
        axisY,
        bounce.fromVal,
        bounce.toVal,
        bounce.isRight,
        isDark,
        opacity * ghostAlpha,
        1,
        1
      )
    }
  }

  // ── Seg 5: Reveal — star, label, subtitle ──
  if (revealProgress >= PHASE.revealBegin) {
    const revealP = smoothstep(mapRange(revealProgress, PHASE.revealBegin, PHASE.revealEnd))

    // Ball at ln(2)
    drawBall(ctx, toX(LN2), axisY, ballRadius, isDark, opacity)

    // Target line (full)
    drawTargetLine(ctx, toX, axisY, isDark, opacity * 0.5, 35)

    // Star at ln(2)
    const ln2X = toX(LN2)
    const starY = axisY - 22
    const starR = Math.max(6, Math.min(10, ppu * 0.06))
    const starPulse = 1 + 0.1 * Math.sin(revealProgress * PI * 8)
    drawStar(ctx, ln2X, starY, starR * starPulse * revealP, resultCol(isDark), opacity * revealP)

    // "ln 2" label
    if (revealP > 0.3) {
      const labelP = smoothstep(mapRange(revealP, 0.3, 0.7))
      const fs = Math.max(18, Math.min(26, ppu * 0.22))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = resultCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * labelP
      ctx.fillText('ln 2', ln2X, starY - starR - 4)
    }

    // "≈ 0.693" value
    if (revealP > 0.5) {
      const valP = smoothstep(mapRange(revealP, 0.5, 0.85))
      const fs = Math.max(14, Math.min(18, ppu * 0.16))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = resultCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * valP
      ctx.fillText('≈ 0.693', ln2X, axisY + 6)
    }

    // Subtitle
    if (revealP > 0.7) {
      const subP = smoothstep(mapRange(revealP, 0.7, 1.0))
      const fs = Math.max(10, Math.min(13, ppu * 0.11))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = subtextCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * subP * 0.7
      ctx.fillText('The bouncing ball that found its home', ln2X, axisY + 26)
    }
  }

  // Ensure we don't carry globalAlpha/lineDash leaks
  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
