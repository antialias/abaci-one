import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

/**
 * Ramanujan Demo: "The Ghost Note"
 *
 * Visualises ζ(s) as a smooth curve ("roller coaster track") and shows
 * that ζ(−1) = −1/12 via analytic continuation — NOT algebraic tricks.
 *
 * PEDAGOGICAL APPROACH: Each phase teaches ONE visual concept that
 * builds on the previous. The ending explicitly ties all pieces together.
 *
 * 7 ACTS / ~19 VISUAL PHASES:
 *
 *   Act 1 — Divergence + Hook (0.00–0.10)
 *     diverge:    Dots at partial sums 1,3,6,10,15 → ∞
 *     hook:       "A secret number is hiding inside"
 *
 *   Act 2 — Shrinking & Convergence (0.10–0.26)
 *     harmonic:   Bars at s=1 showing 1+½+⅓+¼… → still ∞!
 *     square:     Bars at s=2 showing 1/n² terms getting tiny
 *     (settle):   Bars converge, dot appears at ζ(2) ≈ 1.645
 *
 *   Act 3 — The Curve (0.26–0.42)
 *     knob:       s=3, s=4 convergence shown
 *     plot:       Points plotted on the graph
 *     curve:      Right branch curve draws through points
 *
 *   Act 4 — The Wall (0.42–0.52)
 *     approach:   Curve shoots up approaching s=1
 *     wall:       Pole marker, ∞ at s=1
 *
 *   Act 5 — The Bridge (0.52–0.70)
 *     smooth:     Highlight the smooth curve + "how to get past?"
 *     failed:     Sharp corner breaks! Wiggly path breaks!
 *     extend:     SEESAW: up on right → must plunge down on left + curve draws
 *     cross:      Watch the flip: path below zero, ζ=0 line emphasis
 *
 *   Act 6 — The Flipper (0.70–0.81)
 *     flipper:    Negative exponent FLIPS: 1/n² tiny → n¹ big!
 *     connect:    "knob = −1 = 1+2+3+… = our original question!"
 *
 *   Act 7 — Volcano, Trust & Reveal (0.81–1.00)
 *     volcano:    Sum explodes at s=−1, particles fly!
 *     trust:      WHY trust the bridge: convergent points with checkmarks
 *     reveal:     Starburst at −1/12!
 *     recap:      Three-line journey summary
 *     ghost:      Ramanujan attribution + the ghost note
 */

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

// ── Zeta function (Hasse/Knopp globally convergent series) ──────────

// Precompute binomial coefficients C(n,k) up to n=25
const BINOM: number[][] = []
{
  for (let n = 0; n <= 25; n++) {
    BINOM[n] = [1]
    for (let k = 1; k <= n; k++) {
      BINOM[n][k] = BINOM[n - 1][k - 1] + (BINOM[n - 1][k] ?? 0)
    }
  }
}

/**
 * Compute ζ(s) using the globally convergent Hasse series.
 * Valid for all real s except s=1 (the pole).
 */
function zetaHasse(s: number): number {
  if (Math.abs(s - 1) < 0.02) return NaN

  const prefactor = 1 / (1 - 2 ** (1 - s))
  let sum = 0
  for (let n = 0; n <= 25; n++) {
    let inner = 0
    for (let k = 0; k <= n; k++) {
      inner += (k % 2 === 0 ? 1 : -1) * BINOM[n][k] * (k + 1) ** -s
    }
    sum += inner / 2 ** (n + 1)
  }
  return prefactor * sum
}

// ── Precomputed curve data ──────────────────────────────────────────

interface CurvePoint {
  s: number
  z: number
}

/** Right branch: s from 1.03 → 6 (ascending), ζ values positive & decreasing */
const ZETA_RIGHT: CurvePoint[] = []
/** Left branch: s from −3 → 0.97 (ascending), ζ values rising from ~0 through negative */
const ZETA_LEFT: CurvePoint[] = []

let _curveReady = false
function ensureCurve() {
  if (_curveReady) return
  _curveReady = true
  for (let si = 103; si <= 600; si += 2) {
    const s = si / 100
    const z = zetaHasse(s)
    if (isFinite(z)) ZETA_RIGHT.push({ s, z })
  }
  for (let si = -300; si <= 97; si += 2) {
    const s = si / 100
    const z = zetaHasse(s)
    if (isFinite(z)) ZETA_LEFT.push({ s, z })
  }
}

// ── Divergence terms for Act 1 ──────────────────────────────────────

/**
 * Each term: addend n, running sum, previous sum, and arrival time
 * within the diverge phase (p = 0–1). First 4 terms are deliberate
 * (seg 0: "one plus two plus three plus four"), then they accelerate
 * (seg 1: "the pile gets bigger faster and faster!").
 */
const DIV_TERMS: { n: number; sum: number; prev: number; arrive: number }[] = [
  { n: 1, sum: 1, prev: 0, arrive: 0.0 },
  { n: 2, sum: 3, prev: 1, arrive: 0.14 },
  { n: 3, sum: 6, prev: 3, arrive: 0.28 },
  { n: 4, sum: 10, prev: 6, arrive: 0.42 },
  { n: 5, sum: 15, prev: 10, arrive: 0.57 },
  { n: 6, sum: 21, prev: 15, arrive: 0.66 },
  { n: 7, sum: 28, prev: 21, arrive: 0.74 },
  { n: 8, sum: 36, prev: 28, arrive: 0.81 },
  { n: 9, sum: 45, prev: 36, arrive: 0.87 },
  { n: 10, sum: 55, prev: 45, arrive: 0.92 },
]

// ── Partial sums for convergent demos ───────────────────────────────

/** Harmonic partial sums: 1 + 1/2 + 1/3 + … (diverges slowly) */
const HARMONIC_SUMS: number[] = []
const PARTIAL_SUMS_2: number[] = []
const PARTIAL_SUMS_3: number[] = []
const PARTIAL_SUMS_4: number[] = []
{
  let h = 0,
    s2 = 0,
    s3 = 0,
    s4 = 0
  for (let n = 1; n <= 15; n++) {
    h += 1 / n
    s2 += 1 / n ** 2
    s3 += 1 / n ** 3
    s4 += 1 / n ** 4
    HARMONIC_SUMS.push(h)
    PARTIAL_SUMS_2.push(s2)
    PARTIAL_SUMS_3.push(s3)
    PARTIAL_SUMS_4.push(s4)
  }
}

/** Fraction labels for the first few terms of each series */
const HARMONIC_LABELS = ['1', '\u00BD', '\u2153', '\u00BC', '\u2155']
const SQUARE_LABELS = ['1', '\u00BC', '\u2079\u2044\u2081', '\u00B9\u2044\u2081\u2086']

// ── Colors ───────────────────────────────────────────────────────────

function sCol(isDark: boolean) {
  return isDark ? '#fbbf24' : '#d97706'
} // amber — S / divergence
function curveCol(isDark: boolean) {
  return isDark ? '#60a5fa' : '#2563eb'
} // blue — ζ curve
function dotCol(isDark: boolean) {
  return isDark ? '#c084fc' : '#7c3aed'
} // purple — key points
function resultCol(isDark: boolean) {
  return isDark ? '#34d399' : '#059669'
} // green — result / −1/12
function textColor(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
}
function subtextColor(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'
}
function dangerCol(isDark: boolean) {
  return isDark ? '#f87171' : '#dc2626'
} // red — pole / danger

// ── Phase timing ─────────────────────────────────────────────────────

const PHASE = {
  // Act 1: Divergence + Hook
  divergeStart: 0.0,
  divergeEnd: 0.07,
  hookStart: 0.07,
  hookEnd: 0.1,

  // Act 2: Shrinking & Convergence
  harmonicStart: 0.1,
  harmonicEnd: 0.15,
  squareStart: 0.15,
  squareEnd: 0.26,

  // Act 3: The Curve
  knobStart: 0.26,
  knobEnd: 0.32,
  plotStart: 0.32,
  plotEnd: 0.37,
  curveStart: 0.37,
  curveEnd: 0.42,

  // Act 4: The Wall
  approachStart: 0.42,
  approachEnd: 0.47,
  wallStart: 0.47,
  wallEnd: 0.52,

  // Act 5: The Bridge
  smoothStart: 0.52,
  smoothEnd: 0.555,
  failedStart: 0.555,
  failedEnd: 0.6,
  extendStart: 0.6,
  extendEnd: 0.65,
  crossStart: 0.65,
  crossEnd: 0.7,

  // Act 6: The Flipper
  flipperStart: 0.7,
  flipperEnd: 0.76,
  connectStart: 0.76,
  connectEnd: 0.81,

  // Act 7: Volcano, Trust & Reveal
  volcanoStart: 0.81,
  volcanoEnd: 0.85,
  trustStart: 0.85,
  trustEnd: 0.895,
  revealStart: 0.895,
  revealEnd: 0.94,
  recapStart: 0.94,
  recapEnd: 0.97,
  ghostStart: 0.97,
  ghostEnd: 1.0,
} as const

// ── Vertical axis viewport ──────────────────────────────────────────

interface VAxis {
  center: number
  ppu: number
}

const V_KEYS: { p: number; center: number; range: number }[] = [
  { p: 0.0, center: 0.8, range: 3 }, // Early (not visible yet)
  { p: 0.15, center: 0.8, range: 3 }, // Square convergence (~1.645 visible)
  { p: 0.37, center: 0.8, range: 4 }, // Curve phase (see multiple points)
  { p: 0.47, center: 1.0, range: 6 }, // Wall (curve shoots up)
  { p: 0.555, center: -0.2, range: 5 }, // Failed attempts (see curve context)
  { p: 0.7, center: -0.15, range: 2 }, // Flipper / crossing
  { p: 0.81, center: -0.08, range: 0.6 }, // Volcano (tight on s=−1)
  { p: 0.85, center: 0.5, range: 3 }, // Trust: zoom out to see convergent points
  { p: 0.895, center: -0.08, range: 0.6 }, // Reveal: zoom back tight for −1/12
  { p: 0.94, center: -0.08, range: 1.5 }, // Recap: zoom out slightly
  { p: 1.0, center: -0.08, range: 1.5 }, // Hold
]

function getVAxis(progress: number, cssHeight: number): VAxis {
  const h = cssHeight * 0.4
  let a = V_KEYS[0],
    b = V_KEYS[0]
  for (let i = 0; i < V_KEYS.length - 1; i++) {
    if (progress >= V_KEYS[i].p && progress <= V_KEYS[i + 1].p) {
      a = V_KEYS[i]
      b = V_KEYS[i + 1]
      break
    }
    if (i === V_KEYS.length - 2) {
      a = V_KEYS[i + 1]
      b = V_KEYS[i + 1]
    }
  }
  const t = a.p === b.p ? 1 : smoothstep((progress - a.p) / (b.p - a.p))
  const center = a.center + (b.center - a.center) * t
  // Log-space interpolation for range (perceptually smooth zoom)
  const logRa = Math.log(a.range),
    logRb = Math.log(b.range)
  const range = Math.exp(logRa + (logRb - logRa) * t)
  return { center, ppu: h / range }
}

function zToY(z: number, va: VAxis, axisY: number): number {
  return axisY - (z - va.center) * va.ppu
}

// ── Viewport ─────────────────────────────────────────────────────────

export function ramanujanDemoViewport(cssWidth: number, _cssHeight: number) {
  const center = 7.5
  const pixelsPerUnit = (cssWidth * 0.85) / 15
  return { center, pixelsPerUnit }
}

// ── Drawing helpers ──────────────────────────────────────────────────

function drawVerticalAxis(
  ctx: CanvasRenderingContext2D,
  va: VAxis,
  toX: (v: number) => number,
  axisY: number,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  alpha: number
) {
  if (alpha <= 0.01) return

  // Adaptive tick spacing: target ~50px between ticks
  const targetVal = 50 / va.ppu
  const mag = 10 ** Math.floor(Math.log10(targetVal))
  const candidates = [mag * 0.1, mag * 0.2, mag * 0.5, mag, mag * 2, mag * 5, mag * 10]
  let spacing = mag
  for (const c of candidates) {
    if (c * va.ppu >= 30) {
      spacing = c
      break
    }
  }

  const topVal = va.center + cssHeight / (2 * va.ppu)
  const botVal = va.center - cssHeight / (2 * va.ppu)
  const axisScreenX = toX(0)
  const axisVisible = axisScreenX > -20 && axisScreenX < cssWidth + 20

  // Axis line at s=0
  if (axisVisible) {
    ctx.beginPath()
    ctx.moveTo(axisScreenX, 0)
    ctx.lineTo(axisScreenX, cssHeight)
    ctx.strokeStyle = subtextColor(isDark)
    ctx.lineWidth = 1
    ctx.globalAlpha = alpha * 0.3
    ctx.stroke()
  }

  // Ticks and grid lines
  const fs = Math.max(8, Math.min(11, va.ppu * 0.08 + 8))
  ctx.font = `${fs}px system-ui, sans-serif`

  const start = Math.ceil(botVal / spacing) * spacing
  for (let v = start; v <= topVal; v += spacing) {
    const sy = zToY(v, va, axisY)
    if (sy < -10 || sy > cssHeight + 10) continue

    // Horizontal grid line
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(cssWidth, sy)
    ctx.strokeStyle = subtextColor(isDark)
    ctx.lineWidth = Math.abs(v) < 0.001 ? 1 : 0.5
    ctx.globalAlpha = alpha * (Math.abs(v) < 0.001 ? 0.2 : 0.08)
    ctx.setLineDash(Math.abs(v) < 0.001 ? [] : [4, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // Tick mark at axis line
    if (axisVisible) {
      ctx.beginPath()
      ctx.moveTo(axisScreenX - 4, sy)
      ctx.lineTo(axisScreenX + 4, sy)
      ctx.strokeStyle = subtextColor(isDark)
      ctx.lineWidth = 1
      ctx.globalAlpha = alpha * 0.4
      ctx.stroke()
    }

    // Label at left margin
    let label: string
    if (Math.abs(v) < 1e-10) label = '0'
    else if (Math.abs(v - Math.round(v)) < 1e-10) label = String(Math.round(v))
    else label = v.toFixed(2).replace(/\.?0+$/, '')

    ctx.fillStyle = subtextColor(isDark)
    ctx.globalAlpha = alpha * 0.6
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 6, sy)
  }
}

/** Draw a portion of a precomputed curve branch */
function drawCurveBranch(
  ctx: CanvasRenderingContext2D,
  points: CurvePoint[],
  startIdx: number,
  endIdx: number,
  toX: (v: number) => number,
  va: VAxis,
  axisY: number,
  color: string,
  alpha: number,
  lineWidth: number,
  cssHeight: number
) {
  if (alpha <= 0.01 || startIdx >= endIdx) return
  ctx.beginPath()
  let started = false
  for (let i = startIdx; i < endIdx; i++) {
    const sx = toX(points[i].s)
    const sy = zToY(points[i].z, va, axisY)
    // Clip to reasonable vertical range
    const clampedY = Math.max(-cssHeight, Math.min(cssHeight * 2, sy))
    if (!started) {
      ctx.moveTo(sx, clampedY)
      started = true
    } else ctx.lineTo(sx, clampedY)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = alpha
  ctx.stroke()
}

/** Draw a glowing dot */
function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
  glow = true
) {
  if (alpha <= 0.01) return
  if (glow) {
    ctx.beginPath()
    ctx.arc(x, y, r * 2.5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.globalAlpha = alpha * 0.15
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.fill()
}

/** Draw a starburst */
function drawStarburst(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  alpha: number,
  time: number
) {
  if (alpha <= 0.01) return
  const numRays = 12
  ctx.beginPath()
  ctx.arc(cx, cy, r * 2, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = alpha * 0.1
  ctx.fill()
  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2 + time * 0.5
    const outerR = r * (1.2 + 0.3 * Math.sin(time * 3 + i))
    const innerR = r * 0.4
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle - 0.08) * innerR, cy + Math.sin(angle - 0.08) * innerR)
    ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR)
    ctx.lineTo(cx + Math.cos(angle + 0.08) * innerR, cy + Math.sin(angle + 0.08) * innerR)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.globalAlpha = alpha * 0.6
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.fill()
}

/** Draw convergence bars — stacking terms at a horizontal position */
function drawConvergenceBars(
  ctx: CanvasRenderingContext2D,
  sx: number,
  va: VAxis,
  axisY: number,
  partialSums: number[],
  numShown: number,
  color: string,
  alpha: number,
  cssHeight: number
) {
  if (alpha <= 0.01 || numShown <= 0) return
  const barW = 20
  let prev = 0
  for (let i = 0; i < Math.min(numShown, partialSums.length); i++) {
    const cur = partialSums[i]
    const y0 = zToY(prev, va, axisY)
    const y1 = zToY(cur, va, axisY)
    if (y0 > cssHeight + 50 || y1 < -50) {
      prev = cur
      continue
    }
    const intensity = 0.3 + 0.7 * 0.85 ** i
    ctx.fillStyle = color
    ctx.globalAlpha = alpha * intensity * 0.5
    ctx.fillRect(sx - barW / 2, Math.min(y0, y1), barW, Math.abs(y1 - y0))
    ctx.strokeStyle = color
    ctx.lineWidth = 0.5
    ctx.globalAlpha = alpha * intensity * 0.3
    ctx.strokeRect(sx - barW / 2, Math.min(y0, y1), barW, Math.abs(y1 - y0))
    prev = cur
  }
}

/** Draw fraction labels next to convergence bars */
function drawTermLabels(
  ctx: CanvasRenderingContext2D,
  sx: number,
  va: VAxis,
  axisY: number,
  partialSums: number[],
  labels: string[],
  numShown: number,
  color: string,
  alpha: number
) {
  if (alpha <= 0.01 || numShown <= 0) return
  const fs = Math.max(8, Math.min(11, va.ppu * 0.06 + 8))
  ctx.font = `${fs}px system-ui, sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  let prev = 0
  for (let i = 0; i < Math.min(numShown, labels.length, partialSums.length); i++) {
    const cur = partialSums[i]
    const midY = zToY((prev + cur) / 2, va, axisY)
    const barH = Math.abs(zToY(prev, va, axisY) - zToY(cur, va, axisY))
    if (barH > 10) {
      ctx.fillStyle = color
      ctx.globalAlpha = alpha * 0.7
      ctx.fillText(labels[i], sx - 16, midY)
    }
    prev = cur
  }
}

// ── Main render ──────────────────────────────────────────────────────

export function renderRamanujanOverlay(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  revealProgress: number,
  opacity: number
): void {
  if (opacity <= 0) return
  ensureCurve()

  const ppu = state.pixelsPerUnit
  const axisY = cssHeight / 2
  const toX = (v: number) => numberToScreenX(v, state.center, ppu, cssWidth)
  const va = getVAxis(revealProgress, cssHeight)
  const dotR = Math.max(4, Math.min(8, ppu * 0.04))

  ctx.save()

  // ================================================================
  // ACT 1: DIVERGENCE + HOOK (0.00–0.10)
  // ================================================================

  // ── Phase: diverge (0.00–0.07) — jumping dot with arcs ──────────
  if (revealProgress < PHASE.hookEnd) {
    const p = mapRange(revealProgress, PHASE.divergeStart, PHASE.divergeEnd)
    const fadeOut = 1 - smoothstep(mapRange(revealProgress, PHASE.hookStart, PHASE.hookEnd))

    // Find which terms have arrived and the current "active" term
    let activeIdx = -1
    for (let i = DIV_TERMS.length - 1; i >= 0; i--) {
      if (p >= DIV_TERMS[i].arrive) {
        activeIdx = i
        break
      }
    }

    if (activeIdx >= 0 && fadeOut > 0.01) {
      const baseA = opacity * fadeOut

      // Duration of each term's jump animation (fraction of p-space)
      const jumpDur = 0.1

      // --- Jump arcs (trail of completed additions) ---
      for (let i = 0; i <= activeIdx; i++) {
        const t = DIV_TERMS[i]
        if (t.prev === 0 && t.n === 1) continue // No arc for first term
        const arcP = smoothstep(mapRange(p, t.arrive + jumpDur * 0.2, t.arrive + jumpDur * 0.7))
        const arcFade = Math.max(0.15, 1 - (activeIdx - i) * 0.12) // Older arcs dimmer
        const arcA = arcP * arcFade * baseA * 0.5
        if (arcA > 0.01) {
          const x1 = toX(t.prev)
          const x2 = toX(t.sum)
          const midX = (x1 + x2) / 2
          // Arc height scales with addend n — bigger jumps, taller arcs
          const arcH = Math.max(15, Math.min(80, t.n * 12))
          const topY = axisY - arcH
          ctx.beginPath()
          ctx.moveTo(x1, axisY)
          ctx.quadraticCurveTo(midX, topY, x2, axisY)
          ctx.strokeStyle = sCol(isDark)
          ctx.lineWidth = Math.max(1, 2 - (activeIdx - i) * 0.2)
          ctx.globalAlpha = arcA
          ctx.stroke()
        }
      }

      // --- Trail dots at previous sum positions ---
      for (let i = 0; i < activeIdx; i++) {
        const t = DIV_TERMS[i]
        const trailA = Math.max(0, 1 - (activeIdx - i) * 0.15) * baseA * 0.5
        if (trailA > 0.01) {
          const sx = toX(t.sum)
          if (sx > -20 && sx < cssWidth + 20) {
            drawDot(ctx, sx, axisY, dotR * 0.5, sCol(isDark), trailA, false)
          }
        }
      }

      // --- Active dot: animates from prev to sum ---
      const active = DIV_TERMS[activeIdx]
      const jumpP = smoothstep(mapRange(p, active.arrive, active.arrive + jumpDur))
      const dotSum = active.prev + (active.sum - active.prev) * easeInOut(jumpP)
      const dotSx = toX(dotSum)

      // Bounce: dot briefly pops up then settles
      const bounceT = mapRange(jumpP, 0.5, 1)
      const bounceY = bounceT > 0 && bounceT < 1 ? axisY - Math.sin(bounceT * Math.PI) * 6 : axisY
      drawDot(ctx, dotSx, bounceY, dotR * 1.3, sCol(isDark), baseA)

      // --- Addend label dropping in ---
      {
        const labelDropP = mapRange(p, active.arrive, active.arrive + jumpDur * 0.5)
        if (labelDropP > 0 && labelDropP < 1.5) {
          const dropY = axisY - 40 + smoothstep(Math.min(1, labelDropP)) * 20
          const addA =
            (labelDropP < 1 ? smoothstep(labelDropP * 2) : Math.max(0, 1 - (labelDropP - 1) * 4)) *
            baseA *
            0.8
          if (addA > 0.01) {
            const afs = Math.max(11, Math.min(16, ppu * 0.12))
            ctx.font = `bold ${afs}px system-ui, sans-serif`
            ctx.fillStyle = sCol(isDark)
            ctx.textAlign = 'center'
            ctx.textBaseline = 'bottom'
            ctx.globalAlpha = addA
            ctx.fillText(active.n === 1 ? '1' : `+${active.n}`, dotSx, dropY)
          }
        }
      }

      // --- Running total above the dot ---
      if (jumpP > 0.5) {
        const totalA = smoothstep(mapRange(jumpP, 0.5, 0.9)) * baseA * 0.85
        const tfs = Math.max(12, Math.min(16, ppu * 0.12))
        ctx.font = `bold ${tfs}px system-ui, sans-serif`
        ctx.fillStyle = sCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = totalA
        ctx.fillText(`${active.sum}`, dotSx, bounceY - dotR * 2 - 4)
      }

      // --- Building expression below axis ---
      if (activeIdx >= 1) {
        const exprParts: string[] = []
        for (let i = 0; i <= Math.min(activeIdx, 4); i++) {
          exprParts.push(`${DIV_TERMS[i].n}`)
        }
        if (activeIdx > 4) exprParts.push('\u2026')
        const expr = exprParts.join(' + ')

        const exprA = baseA * 0.6
        const efs = Math.max(11, Math.min(14, ppu * 0.1))
        ctx.font = `${efs}px system-ui, sans-serif`
        ctx.fillStyle = sCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = exprA
        ctx.fillText(expr, toX(7.5), axisY + dotR + 10)
      }

      // --- → ∞! when dot races off-screen ---
      if (p > 0.85 && fadeOut > 0.01) {
        const ia = smoothstep(mapRange(p, 0.85, 1)) * baseA
        const ifs = Math.max(18, Math.min(28, ppu * 0.2))
        ctx.font = `bold ${ifs}px system-ui, sans-serif`
        ctx.fillStyle = sCol(isDark)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = ia
        ctx.fillText('\u2192 \u221E!', toX(15) + 8, axisY)
      }
    }
  }

  // ── Phase: hook (0.07–0.10) — "secret number hiding" ──────────
  if (revealProgress >= PHASE.hookStart && revealProgress < PHASE.harmonicStart + 0.02) {
    const p = smoothstep(mapRange(revealProgress, PHASE.hookStart + 0.01, PHASE.hookEnd))
    const fadeOut =
      1 - smoothstep(mapRange(revealProgress, PHASE.hookEnd, PHASE.harmonicStart + 0.02))
    const a = p * fadeOut * opacity
    if (a > 0.01) {
      const fs = Math.max(13, Math.min(18, ppu * 0.14))
      ctx.font = `italic ${fs}px system-ui, sans-serif`
      ctx.fillStyle = textColor(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = a * 0.8
      ctx.fillText('A secret number is hiding inside\u2026', cssWidth / 2, axisY - 30)
    }
  }

  // ================================================================
  // ACT 2: SHRINKING & CONVERGENCE (0.10–0.26)
  // ================================================================

  // ── Phase: harmonic (0.10–0.15) — 1+½+⅓+¼ still → ∞ ─────────
  if (revealProgress >= PHASE.harmonicStart && revealProgress < PHASE.squareEnd) {
    const p = mapRange(revealProgress, PHASE.harmonicStart, PHASE.harmonicEnd)
    const fadeIn = smoothstep(mapRange(p, 0, 0.2))
    const fadeOut =
      1 - smoothstep(mapRange(revealProgress, PHASE.squareStart, PHASE.squareStart + 0.02))
    const a = fadeIn * fadeOut * opacity

    if (a > 0.01) {
      const sx1 = toX(1)

      // "s = 1" label on axis
      drawDot(ctx, sx1, axisY, dotR * 0.8, sCol(isDark), a * 0.8)
      const mfs = Math.max(10, Math.min(13, ppu * 0.1))
      ctx.font = `bold ${mfs}px system-ui, sans-serif`
      ctx.fillStyle = sCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = a * 0.8
      ctx.fillText('knob = 1', sx1, axisY + dotR + 6)

      // Bars stacking up (they diverge)
      const numTerms = Math.min(
        HARMONIC_SUMS.length,
        Math.floor(easeInOut(mapRange(p, 0.15, 0.85)) * (HARMONIC_SUMS.length + 1))
      )
      if (numTerms > 0) {
        drawConvergenceBars(
          ctx,
          sx1,
          va,
          axisY,
          HARMONIC_SUMS,
          numTerms,
          sCol(isDark),
          a * 0.6,
          cssHeight
        )
        drawTermLabels(
          ctx,
          sx1,
          va,
          axisY,
          HARMONIC_SUMS,
          HARMONIC_LABELS,
          numTerms,
          sCol(isDark),
          a
        )

        // "still → ∞!" label at top of stack
        if (numTerms >= 5) {
          const lastSum = HARMONIC_SUMS[Math.min(numTerms - 1, HARMONIC_SUMS.length - 1)]
          const topY = zToY(lastSum, va, axisY)
          ctx.font = `bold ${mfs}px system-ui, sans-serif`
          ctx.fillStyle = sCol(isDark)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          ctx.globalAlpha = a * smoothstep(mapRange(p, 0.6, 0.9)) * 0.8
          ctx.fillText('still \u2192 \u221E!', sx1, Math.max(15, topY - 8))
        }
      }

      // Explanatory text
      if (p > 0.3) {
        const ta = smoothstep(mapRange(p, 0.3, 0.6)) * a * 0.7
        const tfs = Math.max(10, Math.min(13, ppu * 0.1))
        ctx.font = `${tfs}px system-ui, sans-serif`
        ctx.fillStyle = textColor(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = ta
        ctx.fillText('1 + \u00BD + \u2153 + \u00BC + \u2026', sx1, axisY + dotR + 24)
      }
    }
  }

  // ── Phase: square convergence (0.15–0.26) ──────────────────────
  if (revealProgress >= PHASE.squareStart && revealProgress < PHASE.curveEnd) {
    const p = mapRange(revealProgress, PHASE.squareStart, PHASE.squareEnd)
    const fadeIn = smoothstep(mapRange(p, 0, 0.1))
    // Fade out during curve phase
    const fadeOut =
      1 - smoothstep(mapRange(revealProgress, PHASE.plotStart, PHASE.plotStart + 0.02))
    const a = fadeIn * fadeOut * opacity

    if (a > 0.01) {
      const sx2 = toX(2)

      // "knob = 2" label
      drawDot(ctx, sx2, axisY, dotR * 0.8, dotCol(isDark), a * 0.8)
      const mfs = Math.max(10, Math.min(13, ppu * 0.1))
      ctx.font = `bold ${mfs}px system-ui, sans-serif`
      ctx.fillStyle = dotCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = a * 0.8
      ctx.fillText('knob = 2', sx2, axisY + dotR + 6)

      // Show individual terms getting tiny, then settling
      const earlyP = mapRange(p, 0, 0.4) // First half: show terms
      const lateP = mapRange(p, 0.3, 0.8) // Second half: show convergence
      const numTerms = Math.min(
        PARTIAL_SUMS_2.length,
        Math.floor(easeInOut(Math.max(earlyP, lateP)) * (PARTIAL_SUMS_2.length + 1))
      )

      // Convergence bars
      drawConvergenceBars(
        ctx,
        sx2,
        va,
        axisY,
        PARTIAL_SUMS_2,
        numTerms,
        dotCol(isDark),
        a * 0.7,
        cssHeight
      )

      // Term labels (first few)
      if (earlyP > 0.1) {
        const labelA = smoothstep(mapRange(earlyP, 0.1, 0.4)) * a
        drawTermLabels(
          ctx,
          sx2,
          va,
          axisY,
          PARTIAL_SUMS_2,
          SQUARE_LABELS,
          numTerms,
          dotCol(isDark),
          labelA
        )
      }

      // Explanatory text: "1/1² + 1/2² + 1/3² + …"
      if (earlyP > 0.2) {
        const ta = smoothstep(mapRange(earlyP, 0.2, 0.5)) * a * 0.7
        const tfs = Math.max(10, Math.min(13, ppu * 0.1))
        ctx.font = `${tfs}px system-ui, sans-serif`
        ctx.fillStyle = textColor(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = ta
        ctx.fillText(
          '1 + \u00BC + \u2079\u2044\u2089 + \u00B9\u2044\u2081\u2086 + \u2026',
          sx2,
          axisY + dotR + 24
        )
      }

      // Final value dot on graph at ζ(2)
      if (lateP > 0.5) {
        const zeta2 = (Math.PI * Math.PI) / 6
        const finalA = smoothstep(mapRange(lateP, 0.5, 0.85)) * a
        const fy = zToY(zeta2, va, axisY)
        drawDot(ctx, sx2, fy, dotR * 1.2, dotCol(isDark), finalA)
        if (finalA > 0.3) {
          ctx.font = `${mfs}px system-ui, sans-serif`
          ctx.fillStyle = dotCol(isDark)
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.globalAlpha = finalA * 0.7
          ctx.fillText('\u2248 1.645', sx2 + dotR + 6, fy)
        }
      }

      // "it settles!" celebratory text
      if (lateP > 0.7) {
        const celA = smoothstep(mapRange(lateP, 0.7, 1)) * a * 0.6
        const cfs = Math.max(11, Math.min(14, ppu * 0.11))
        ctx.font = `italic ${cfs}px system-ui, sans-serif`
        ctx.fillStyle = dotCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = celA
        const zeta2 = (Math.PI * Math.PI) / 6
        ctx.fillText('it settles!', sx2, zToY(zeta2, va, axisY) - dotR * 2 - 8)
      }
    }
  }

  // ── Vertical axis (appears from square phase onward) ───────────
  if (revealProgress >= PHASE.squareStart) {
    const axisAlpha =
      smoothstep(mapRange(revealProgress, PHASE.squareStart, PHASE.squareStart + 0.04)) * opacity
    drawVerticalAxis(ctx, va, toX, axisY, cssWidth, cssHeight, isDark, axisAlpha)

    // "ζ(s)" label near top of vertical axis
    const axisScreenX = toX(0)
    if (axisScreenX > -20 && axisScreenX < cssWidth + 20 && axisAlpha > 0.1) {
      const fs = Math.max(11, Math.min(14, ppu * 0.1))
      ctx.font = `italic ${fs}px system-ui, sans-serif`
      ctx.fillStyle = curveCol(isDark)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = axisAlpha * 0.7
      ctx.fillText('\u03B6(s)', axisScreenX + 6, 8)
    }
  }

  // ================================================================
  // ACT 3: THE CURVE (0.26–0.42)
  // ================================================================

  // ── Phase: knob (0.26–0.32) — s=3, s=4 convergence ────────────
  if (revealProgress >= PHASE.knobStart && revealProgress < PHASE.approachEnd) {
    const p = mapRange(revealProgress, PHASE.knobStart, PHASE.knobEnd)
    const fadeOut =
      1 - smoothstep(mapRange(revealProgress, PHASE.approachStart, PHASE.approachStart + 0.02))
    const a = smoothstep(mapRange(p, 0, 0.2)) * fadeOut * opacity

    if (a > 0.01) {
      // s=3 convergence (brief)
      const p3 = mapRange(p, 0, 0.5)
      if (p3 > 0) {
        const sx3 = toX(3)
        const a3 = smoothstep(mapRange(p3, 0, 0.3)) * a
        drawDot(ctx, sx3, axisY, dotR * 0.7, dotCol(isDark), a3 * 0.7)
        const numT3 = Math.min(
          PARTIAL_SUMS_3.length,
          Math.floor(easeInOut(mapRange(p3, 0.1, 0.8)) * (PARTIAL_SUMS_3.length + 1))
        )
        drawConvergenceBars(
          ctx,
          sx3,
          va,
          axisY,
          PARTIAL_SUMS_3,
          numT3,
          dotCol(isDark),
          a3 * 0.4,
          cssHeight
        )

        // s=3 dot on graph
        if (p3 > 0.5) {
          const zeta3 = zetaHasse(3)
          const fa3 = smoothstep(mapRange(p3, 0.5, 0.9)) * a
          drawDot(ctx, sx3, zToY(zeta3, va, axisY), dotR, dotCol(isDark), fa3)
        }

        const mfs = Math.max(9, Math.min(12, ppu * 0.09))
        ctx.font = `${mfs}px system-ui, sans-serif`
        ctx.fillStyle = dotCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = a3 * 0.7
        ctx.fillText('knob = 3', sx3, axisY + dotR + 6)
      }

      // s=4 convergence
      const p4 = mapRange(p, 0.4, 1)
      if (p4 > 0) {
        const sx4 = toX(4)
        const a4 = smoothstep(mapRange(p4, 0, 0.3)) * a
        drawDot(ctx, sx4, axisY, dotR * 0.7, dotCol(isDark), a4 * 0.7)
        const numT4 = Math.min(
          PARTIAL_SUMS_4.length,
          Math.floor(easeInOut(mapRange(p4, 0.1, 0.7)) * (PARTIAL_SUMS_4.length + 1))
        )
        drawConvergenceBars(
          ctx,
          sx4,
          va,
          axisY,
          PARTIAL_SUMS_4,
          numT4,
          dotCol(isDark),
          a4 * 0.3,
          cssHeight
        )

        // s=4 dot on graph
        if (p4 > 0.5) {
          const zeta4 = Math.PI ** 4 / 90
          const fa4 = smoothstep(mapRange(p4, 0.5, 0.9)) * a
          drawDot(ctx, sx4, zToY(zeta4, va, axisY), dotR, dotCol(isDark), fa4)
        }

        const mfs = Math.max(9, Math.min(12, ppu * 0.09))
        ctx.font = `${mfs}px system-ui, sans-serif`
        ctx.fillStyle = dotCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = a4 * 0.7
        ctx.fillText('knob = 4', sx4, axisY + dotR + 6)
      }
    }
  }

  // ── Phase: plot (0.32–0.37) — points on the graph ──────────────
  // Points persist from here onward (covered by the curve drawing)
  if (revealProgress >= PHASE.plotStart && revealProgress < PHASE.smoothEnd) {
    const p = smoothstep(mapRange(revealProgress, PHASE.plotStart, PHASE.plotEnd))
    const fadeOut =
      1 -
      smoothstep(mapRange(revealProgress, PHASE.approachStart + 0.02, PHASE.approachStart + 0.05))
    const a = p * fadeOut * opacity

    if (a > 0.01) {
      // Highlight all three points
      const zeta2 = (Math.PI * Math.PI) / 6
      const zeta3 = zetaHasse(3)
      const zeta4 = Math.PI ** 4 / 90

      const pts: [number, number, string][] = [
        [2, zeta2, 's=2'],
        [3, zeta3, 's=3'],
        [4, zeta4, 's=4'],
      ]

      for (let i = 0; i < pts.length; i++) {
        const entryA = smoothstep(mapRange(p, i * 0.25, i * 0.25 + 0.35)) * a
        const [s, z, label] = pts[i]
        const sx = toX(s)
        const sy = zToY(z, va, axisY)
        drawDot(ctx, sx, sy, dotR * 1.3, dotCol(isDark), entryA)

        const mfs = Math.max(9, Math.min(12, ppu * 0.09))
        ctx.font = `${mfs}px system-ui, sans-serif`
        ctx.fillStyle = dotCol(isDark)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = entryA * 0.7
        ctx.fillText(label, sx + dotR + 4, sy)
      }
    }
  }

  // ── Phase: curve (0.37–0.42) — right branch draws ─────────────
  if (revealProgress >= PHASE.curveStart && ZETA_RIGHT.length > 1) {
    const curveAlpha =
      smoothstep(mapRange(revealProgress, PHASE.curveStart, PHASE.curveEnd)) * opacity
    if (curveAlpha > 0.01) {
      drawCurveBranch(
        ctx,
        ZETA_RIGHT,
        0,
        ZETA_RIGHT.length,
        toX,
        va,
        axisY,
        curveCol(isDark),
        curveAlpha * 0.8,
        2.5,
        cssHeight
      )
    }
  }

  // ================================================================
  // ACT 4: THE WALL (0.42–0.52)
  // ================================================================

  // ── Phase: approach (0.42–0.47) — curve shoots up ──────────────
  if (revealProgress >= PHASE.approachStart && revealProgress < PHASE.extendStart) {
    const p = mapRange(revealProgress, PHASE.approachStart, PHASE.approachEnd)
    const a = smoothstep(mapRange(p, 0, 0.3)) * opacity

    if (a > 0.01) {
      const sx1 = toX(1)
      const pulse = 1 + 0.15 * Math.sin(p * Math.PI * 8)
      drawDot(ctx, sx1, axisY, dotR * pulse, dangerCol(isDark), a)

      const fs = Math.max(10, Math.min(14, ppu * 0.1))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = dangerCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = a * 0.9
      ctx.fillText('knob = 1', sx1, axisY + dotR + 6)
    }
  }

  // ── Phase: wall (0.47–0.52) — infinity at s=1 ─────────────────
  if (revealProgress >= PHASE.wallStart && revealProgress < PHASE.extendStart) {
    const p = mapRange(revealProgress, PHASE.wallStart, PHASE.wallEnd)
    const a = smoothstep(mapRange(p, 0, 0.3)) * opacity

    if (a > 0.01) {
      const sx1 = toX(1)

      // Pulsing danger dot
      const pulse = 1 + 0.2 * Math.sin(p * Math.PI * 6)
      drawDot(ctx, sx1, axisY, dotR * pulse, dangerCol(isDark), a)

      // "∞ !" label above
      if (p > 0.3) {
        const da = smoothstep(mapRange(p, 0.3, 0.6)) * a
        const dfs = Math.max(14, Math.min(22, ppu * 0.16))
        ctx.font = `bold ${dfs}px system-ui, sans-serif`
        ctx.fillStyle = dangerCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = da
        ctx.fillText('\u221E !', sx1, Math.max(20, zToY(3, va, axisY) - 8))
      }

      // "THE WALL" label
      if (p > 0.5) {
        const wa = smoothstep(mapRange(p, 0.5, 0.8)) * a * 0.6
        const wfs = Math.max(11, Math.min(14, ppu * 0.11))
        ctx.font = `bold ${wfs}px system-ui, sans-serif`
        ctx.fillStyle = dangerCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = wa
        ctx.fillText('the wall!', sx1, axisY + dotR + 6)
      }
    }
  }

  // ================================================================
  // ACT 5: THE BRIDGE (0.52–0.70)
  // ================================================================

  // ── Phase: smooth (0.52–0.555) — highlight the curve ───────────
  if (revealProgress >= PHASE.smoothStart && revealProgress < PHASE.crossEnd) {
    const p = smoothstep(mapRange(revealProgress, PHASE.smoothStart, PHASE.smoothEnd))
    const a = p * opacity

    if (a > 0.01 && ZETA_RIGHT.length > 1) {
      // Glow on right branch
      drawCurveBranch(
        ctx,
        ZETA_RIGHT,
        0,
        ZETA_RIGHT.length,
        toX,
        va,
        axisY,
        curveCol(isDark),
        a * 0.3,
        5,
        cssHeight
      )

      // "smooth track" label
      const fs = Math.max(11, Math.min(14, ppu * 0.11))
      ctx.font = `italic ${fs}px system-ui, sans-serif`
      ctx.fillStyle = curveCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = a * 0.7
      const labelX = toX(3)
      const labelY = zToY(zetaHasse(3), va, axisY)
      if (labelY > 10 && labelY < cssHeight - 10) {
        ctx.fillText('smooth track \u2192', labelX, labelY + 8)
      }

      // "but how to get past?" text
      if (p > 0.5) {
        const qA = smoothstep(mapRange(p, 0.5, 1)) * a * 0.7
        const qfs = Math.max(12, Math.min(15, ppu * 0.12))
        ctx.font = `italic ${qfs}px system-ui, sans-serif`
        ctx.fillStyle = textColor(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = qA
        ctx.fillText('but how to get past the wall?', cssWidth / 2, cssHeight * 0.15)
      }
    }
  }

  // ── Phase: failed (0.555–0.600) — failed bridge attempts ──────
  if (revealProgress >= PHASE.failedStart && revealProgress < PHASE.extendStart) {
    const p = mapRange(revealProgress, PHASE.failedStart, PHASE.failedEnd)
    const a = opacity

    if (a > 0.01) {
      // Sub-phase 1: Sharp corner attempt (p: 0–0.45)
      const sharpP = mapRange(p, 0, 0.45)
      if (sharpP > 0 && sharpP <= 1) {
        const drawP = smoothstep(mapRange(sharpP, 0, 0.35))
        const crackP = smoothstep(mapRange(sharpP, 0.35, 0.55))
        const fadeP = smoothstep(mapRange(sharpP, 0.55, 1))

        // V-shaped path from near pole going left — clearly wrong continuation
        const kinkS = 0.5
        const startS = 0.97
        const endS = -0.5
        const startZ = 4 // near-pole high value
        const kinkZ = -0.8 // sharp angle down
        const endZ = 0.5 // bounces back up

        const sharpAlpha = a * (1 - fadeP) * drawP
        if (sharpAlpha > 0.01) {
          const color = crackP > 0 ? dangerCol(isDark) : curveCol(isDark)

          ctx.beginPath()
          // Segment 1: near-pole → kink
          const seg1draw = Math.min(1, drawP * 2)
          if (seg1draw > 0) {
            const s1 = startS + (kinkS - startS) * seg1draw
            const z1 = startZ + (kinkZ - startZ) * seg1draw
            ctx.moveTo(toX(startS), zToY(startZ, va, axisY))
            ctx.lineTo(toX(s1), zToY(z1, va, axisY))
          }
          // Segment 2: kink → end (different direction)
          const seg2draw = Math.max(0, (drawP - 0.5) * 2)
          if (seg2draw > 0) {
            const s2 = kinkS + (endS - kinkS) * seg2draw
            const z2 = kinkZ + (endZ - kinkZ) * seg2draw
            ctx.lineTo(toX(s2), zToY(z2, va, axisY))
          }

          ctx.strokeStyle = color
          ctx.lineWidth = crackP > 0 ? 2 + crackP * 3 : 2.5
          ctx.globalAlpha = sharpAlpha * (crackP > 0 ? 0.4 + 0.6 * (1 - crackP) : 0.8)
          ctx.stroke()

          // Red X at the kink point
          if (crackP > 0) {
            const kx = toX(kinkS)
            const ky = zToY(kinkZ, va, axisY)
            const xSize = 8 + crackP * 6
            ctx.beginPath()
            ctx.moveTo(kx - xSize, ky - xSize)
            ctx.lineTo(kx + xSize, ky + xSize)
            ctx.moveTo(kx + xSize, ky - xSize)
            ctx.lineTo(kx - xSize, ky + xSize)
            ctx.strokeStyle = dangerCol(isDark)
            ctx.lineWidth = 3
            ctx.globalAlpha = sharpAlpha * crackP
            ctx.stroke()
          }

          // "cracks!" label
          if (crackP > 0.3) {
            const crackLabelA = smoothstep(mapRange(crackP, 0.3, 0.7)) * sharpAlpha
            const cfs = Math.max(11, Math.min(14, ppu * 0.11))
            ctx.font = `bold ${cfs}px system-ui, sans-serif`
            ctx.fillStyle = dangerCol(isDark)
            ctx.textAlign = 'center'
            ctx.textBaseline = 'bottom'
            ctx.globalAlpha = crackLabelA
            ctx.fillText('cracks!', toX(kinkS), zToY(kinkZ, va, axisY) - 12)
          }
        }
      }

      // Sub-phase 2: Wiggly attempt (p: 0.45–1.0)
      const wiggleP = mapRange(p, 0.45, 1)
      if (wiggleP > 0) {
        const drawW = smoothstep(mapRange(wiggleP, 0, 0.35))
        const wobbleP = smoothstep(mapRange(wiggleP, 0.35, 0.55))
        const fadeW = smoothstep(mapRange(wiggleP, 0.55, 1))

        const wiggleAlpha = a * (1 - fadeW) * drawW
        if (wiggleAlpha > 0.01) {
          // Wavy sine-wave path from near-pole going left
          const steps = 60
          const pathStartS = 0.97
          const pathEndS = pathStartS + (-2 - pathStartS) * drawW

          ctx.beginPath()
          let started = false
          for (let i = 0; i <= steps; i++) {
            const t = i / steps
            const s = pathStartS + (pathEndS - pathStartS) * t
            const baseZ = 2 * (1 - t) + -0.3 * t
            const amp = 0.3 + t * 1.2 * (1 + wobbleP * 2)
            const freq = 8 + wobbleP * 12
            const z = baseZ + amp * Math.sin(freq * t + wobbleP * 10)

            const pathSx = toX(s)
            const pathSy = zToY(z, va, axisY)
            if (!started) {
              ctx.moveTo(pathSx, pathSy)
              started = true
            } else ctx.lineTo(pathSx, pathSy)
          }

          const wColor = wobbleP > 0 ? dangerCol(isDark) : curveCol(isDark)
          ctx.strokeStyle = wColor
          ctx.lineWidth = wobbleP > 0 ? 2 + wobbleP * 2 : 2.5
          ctx.globalAlpha = wiggleAlpha * (wobbleP > 0 ? 0.4 + 0.6 * (1 - wobbleP) : 0.8)
          ctx.stroke()

          // "too wobbly!" label
          if (wobbleP > 0.3) {
            const wobbleLabelA = smoothstep(mapRange(wobbleP, 0.3, 0.7)) * wiggleAlpha
            const wfs = Math.max(11, Math.min(14, ppu * 0.11))
            ctx.font = `bold ${wfs}px system-ui, sans-serif`
            ctx.fillStyle = dangerCol(isDark)
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.globalAlpha = wobbleLabelA
            ctx.fillText('too wobbly!', toX(0), zToY(0, va, axisY) + 12)
          }
        }
      }
    }
  }

  // ── Phase: extend (0.60–0.65) — seesaw + smooth continuation ──
  if (revealProgress >= PHASE.extendStart && ZETA_LEFT.length > 1) {
    // Progressive drawing: reveal from the right end (near pole) leftward
    const extP = easeInOut(mapRange(revealProgress, PHASE.extendStart, PHASE.ghostEnd))
    const numPts = Math.max(1, Math.floor(extP * ZETA_LEFT.length))
    const startIdx = ZETA_LEFT.length - numPts
    const a =
      smoothstep(mapRange(revealProgress, PHASE.extendStart, PHASE.extendStart + 0.02)) * opacity

    if (a > 0.01) {
      drawCurveBranch(
        ctx,
        ZETA_LEFT,
        startIdx,
        ZETA_LEFT.length,
        toX,
        va,
        axisY,
        resultCol(isDark),
        a * 0.9,
        2.5,
        cssHeight
      )

      // Glowing tip at the drawing front
      const tip = ZETA_LEFT[startIdx]
      const tipX = toX(tip.s)
      const tipY = zToY(tip.z, va, axisY)
      if (tipY > -50 && tipY < cssHeight + 50) {
        drawDot(ctx, tipX, tipY, dotR * 1.5, resultCol(isDark), a * 0.9, true)
      }
    }

    // Seesaw arrows at the pole — shows WHY path goes negative
    if (revealProgress < PHASE.crossEnd) {
      const seesawIn = smoothstep(
        mapRange(revealProgress, PHASE.extendStart, PHASE.extendStart + 0.02)
      )
      const seesawOut = 1 - smoothstep(mapRange(revealProgress, PHASE.crossStart, PHASE.crossEnd))
      const seesawA = seesawIn * seesawOut * opacity

      if (seesawA > 0.01) {
        const sx1 = toX(1)
        const arrowGap = Math.max(15, Math.min(25, ppu * 0.15))
        const arrowFs = Math.max(10, Math.min(13, ppu * 0.1))

        // UP arrow on right side of pole
        const upX = sx1 + arrowGap
        const upBot = zToY(0.5, va, axisY)
        const upTop = zToY(2.0, va, axisY)
        ctx.beginPath()
        ctx.moveTo(upX, upBot)
        ctx.lineTo(upX, upTop)
        ctx.moveTo(upX - 5, upTop + 8)
        ctx.lineTo(upX, upTop)
        ctx.lineTo(upX + 5, upTop + 8)
        ctx.strokeStyle = curveCol(isDark)
        ctx.lineWidth = 2.5
        ctx.globalAlpha = seesawA * 0.8
        ctx.stroke()

        ctx.font = `bold ${arrowFs}px system-ui, sans-serif`
        ctx.fillStyle = curveCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = seesawA * 0.7
        ctx.fillText('+\u221E', upX, upTop - 4)

        // DOWN arrow on left side of pole
        const downX = sx1 - arrowGap
        const downTop = zToY(-0.5, va, axisY)
        const downBot = zToY(-2.0, va, axisY)
        ctx.beginPath()
        ctx.moveTo(downX, downTop)
        ctx.lineTo(downX, downBot)
        ctx.moveTo(downX - 5, downBot - 8)
        ctx.lineTo(downX, downBot)
        ctx.lineTo(downX + 5, downBot - 8)
        ctx.strokeStyle = resultCol(isDark)
        ctx.lineWidth = 2.5
        ctx.globalAlpha = seesawA * 0.8
        ctx.stroke()

        ctx.fillStyle = resultCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = seesawA * 0.7
        ctx.fillText('\u2212\u221E', downX, downBot + 4)

        // Pole dashed line (keep wall visible during seesaw)
        ctx.beginPath()
        ctx.moveTo(sx1, 0)
        ctx.lineTo(sx1, cssHeight)
        ctx.strokeStyle = dangerCol(isDark)
        ctx.lineWidth = 1.5
        ctx.globalAlpha = seesawA * 0.25
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])

        // "seesaw!" label
        const seesawLabelP = smoothstep(
          mapRange(revealProgress, PHASE.extendStart + 0.02, PHASE.extendEnd - 0.01)
        )
        if (seesawLabelP > 0.01) {
          const sfs = Math.max(11, Math.min(14, ppu * 0.11))
          ctx.font = `italic ${sfs}px system-ui, sans-serif`
          ctx.fillStyle = textColor(isDark)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.globalAlpha = seesawLabelP * seesawA * 0.6
          ctx.fillText('up \u2191 the wall \u2193 down', sx1, axisY + dotR + 6)
        }
      }
    }

    // "the wall flips it" label during early extend
    if (revealProgress < PHASE.extendEnd) {
      const labelA =
        smoothstep(mapRange(revealProgress, PHASE.extendStart + 0.02, PHASE.extendEnd - 0.01)) *
        opacity *
        0.6
      if (labelA > 0.01) {
        const lfs = Math.max(11, Math.min(14, ppu * 0.11))
        ctx.font = `italic ${lfs}px system-ui, sans-serif`
        ctx.fillStyle = resultCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = labelA
        ctx.fillText(
          'one side up \u2192 the wall flips it \u2192 other side down!',
          cssWidth / 2,
          cssHeight * 0.12
        )
      }
    }
  }

  // Keep right branch visible through extension and beyond
  if (revealProgress >= PHASE.curveStart && ZETA_RIGHT.length > 1) {
    const rAlpha =
      opacity * (1 - smoothstep(mapRange(revealProgress, PHASE.ghostStart, PHASE.ghostEnd - 0.02)))
    if (rAlpha > 0.01) {
      drawCurveBranch(
        ctx,
        ZETA_RIGHT,
        0,
        ZETA_RIGHT.length,
        toX,
        va,
        axisY,
        curveCol(isDark),
        rAlpha * 0.5,
        2,
        cssHeight
      )
    }
  }

  // ── Phase: cross (0.65–0.70) — watch the flip happen ─────────
  if (revealProgress >= PHASE.crossStart && revealProgress < PHASE.connectEnd) {
    const crossP = smoothstep(mapRange(revealProgress, PHASE.crossStart, PHASE.crossEnd))

    // ζ=0 emphasis line — highlight where zero is
    if (crossP > 0) {
      const zeroY = zToY(0, va, axisY)
      const zLineA = crossP * opacity * 0.3
      if (zeroY > 0 && zeroY < cssHeight && zLineA > 0.01) {
        ctx.beginPath()
        ctx.moveTo(0, zeroY)
        ctx.lineTo(cssWidth, zeroY)
        ctx.strokeStyle = subtextColor(isDark)
        ctx.lineWidth = 1.5
        ctx.globalAlpha = zLineA
        ctx.setLineDash([6, 4])
        ctx.stroke()
        ctx.setLineDash([])

        // "ζ = 0" label on the emphasis line
        const zlFs = Math.max(9, Math.min(11, ppu * 0.08))
        ctx.font = `${zlFs}px system-ui, sans-serif`
        ctx.fillStyle = subtextColor(isDark)
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = zLineA * 1.5
        ctx.fillText('\u03B6 = 0', cssWidth - 8, zeroY - 3)
      }
    }

    // ζ(0) = −0.5 marker
    const m0p = smoothstep(mapRange(revealProgress, PHASE.crossStart + 0.01, PHASE.crossEnd))
    const m0fade = 1 - smoothstep(mapRange(revealProgress, PHASE.flipperEnd, PHASE.connectStart))
    const m0a = m0p * m0fade * opacity

    if (m0a > 0.01) {
      const sx0 = toX(0)
      const sy0 = zToY(-0.5, va, axisY)
      drawDot(ctx, sx0, sy0, dotR * 1.1, resultCol(isDark), m0a)
      const fs = Math.max(9, Math.min(12, ppu * 0.09))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = resultCol(isDark)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = m0a * 0.7
      ctx.fillText('\u03B6(0) = \u2212\u00BD', sx0 + dotR + 6, sy0)
    }

    // "the wall flipped it below zero!" text
    if (revealProgress < PHASE.flipperStart) {
      const negA =
        smoothstep(mapRange(revealProgress, PHASE.crossStart + 0.02, PHASE.crossEnd)) * opacity
      if (negA > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.11))
        ctx.font = `italic ${fs}px system-ui, sans-serif`
        ctx.fillStyle = resultCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = negA * 0.6
        const zeroY = zToY(0, va, axisY)
        ctx.fillText('the wall flipped it \u2014 below zero!', cssWidth / 2, zeroY + 12)
      }
    }
  }

  // ================================================================
  // ACT 6: THE FLIPPER + ANSWER (0.70–0.87)
  // ================================================================

  // ── Phase: flipper (0.70–0.76) — negative exponent flips ──────
  if (revealProgress >= PHASE.flipperStart && revealProgress < PHASE.connectEnd) {
    const p = mapRange(revealProgress, PHASE.flipperStart, PHASE.flipperEnd)
    const fadeOut =
      1 - smoothstep(mapRange(revealProgress, PHASE.connectStart + 0.02, PHASE.connectEnd))
    const a = smoothstep(mapRange(p, 0, 0.15)) * fadeOut * opacity

    if (a > 0.01) {
      const midX = cssWidth / 2
      const topY = cssHeight * 0.12
      const mfs = Math.max(13, Math.min(18, ppu * 0.14))

      // First concept: squishing (knob = 2)
      const squishA = smoothstep(mapRange(p, 0, 0.35)) * a
      if (squishA > 0.01) {
        ctx.font = `${mfs}px system-ui, sans-serif`
        ctx.fillStyle = dotCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = squishA
        ctx.fillText('knob = 2:  1/4\u00B2 = 1/16', midX, topY)

        // Tiny shrinking dot
        const tinyR = dotR * 0.3
        const tinyDotX = midX + mfs * 8
        drawDot(ctx, tinyDotX, topY + mfs * 0.6, tinyR, dotCol(isDark), squishA * 0.8, false)

        // "tiny!" label
        const tfs = Math.max(10, Math.min(13, ppu * 0.1))
        ctx.font = `italic ${tfs}px system-ui, sans-serif`
        ctx.fillStyle = dotCol(isDark)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = squishA * 0.7
        ctx.fillText('\u2190 tiny!', tinyDotX + 8, topY + mfs * 0.2)
      }

      // Second concept: flipping (knob = −1)
      const flipA = smoothstep(mapRange(p, 0.4, 0.75)) * a
      if (flipA > 0.01) {
        ctx.font = `bold ${mfs}px system-ui, sans-serif`
        ctx.fillStyle = sCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = flipA
        ctx.fillText('knob = \u22121:  4\u207B\u00B9 \u2192 4\u00B9 = 4', midX, topY + mfs * 1.8)

        // Growing dot
        const growP = smoothstep(mapRange(p, 0.5, 0.8))
        const bigR = dotR * (0.5 + growP * 1.5)
        const bigDotX = midX + mfs * 7.5
        drawDot(ctx, bigDotX, topY + mfs * 2.4, bigR, sCol(isDark), flipA * 0.8, false)

        // "it GREW!" label
        const gfs = Math.max(11, Math.min(14, ppu * 0.11))
        ctx.font = `bold italic ${gfs}px system-ui, sans-serif`
        ctx.fillStyle = sCol(isDark)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = flipA * 0.8
        ctx.fillText('\u2190 it GREW!', bigDotX + bigR + 6, topY + mfs * 2)
      }

      // "the minus sign is a flipper!" label
      if (p > 0.7) {
        const flipLabelA = smoothstep(mapRange(p, 0.7, 1)) * a * 0.7
        const flfs = Math.max(12, Math.min(15, ppu * 0.12))
        ctx.font = `bold ${flfs}px system-ui, sans-serif`
        ctx.fillStyle = textColor(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = flipLabelA
        ctx.fillText('the minus sign is a FLIPPER!', midX, topY + mfs * 4)
      }
    }
  }

  // ── Phase: connect (0.76–0.81) — "knob = −1 = our question" ──
  if (revealProgress >= PHASE.connectStart && revealProgress < PHASE.volcanoEnd) {
    const p = smoothstep(mapRange(revealProgress, PHASE.connectStart, PHASE.connectEnd))
    const fadeOut =
      1 - smoothstep(mapRange(revealProgress, PHASE.volcanoStart + 0.02, PHASE.volcanoEnd))
    const a = p * fadeOut * opacity

    if (a > 0.01) {
      const sxn1 = toX(-1)

      // "knob = −1" marker on axis
      drawDot(ctx, sxn1, axisY, dotR, resultCol(isDark), a * 0.6)
      const mfs = Math.max(10, Math.min(13, ppu * 0.1))
      ctx.font = `bold ${mfs}px system-ui, sans-serif`
      ctx.fillStyle = resultCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = a * 0.8
      ctx.fillText('knob = \u22121', sxn1, axisY + dotR + 6)

      // Connection text: "= 1 + 2 + 3 + 4 + …"
      if (p > 0.3) {
        const connA = smoothstep(mapRange(p, 0.3, 0.7)) * a * 0.7
        const cfs = Math.max(10, Math.min(13, ppu * 0.1))
        ctx.font = `${cfs}px system-ui, sans-serif`
        ctx.fillStyle = sCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = connA
        ctx.fillText('= 1 + 2 + 3 + 4 + \u2026', sxn1, axisY + dotR + 22)
      }

      // "our original question!" label
      if (p > 0.5) {
        const oqA = smoothstep(mapRange(p, 0.5, 0.9)) * a * 0.6
        const oqfs = Math.max(11, Math.min(14, ppu * 0.11))
        ctx.font = `italic ${oqfs}px system-ui, sans-serif`
        ctx.fillStyle = textColor(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = oqA
        ctx.fillText('our original question!', sxn1, axisY + dotR + 38)
      }
    }
  }

  // ================================================================
  // ACT 7: VOLCANO, TRUST & REVEAL (0.81–1.00)
  // ================================================================

  // ── Phase: volcano (0.81–0.85) — sum explodes at s=−1 ─────────
  if (revealProgress >= PHASE.volcanoStart && revealProgress < PHASE.trustEnd) {
    const volcP = smoothstep(mapRange(revealProgress, PHASE.volcanoStart, PHASE.volcanoEnd))
    const fadeOut =
      1 - smoothstep(mapRange(revealProgress, PHASE.trustStart, PHASE.trustStart + 0.015))
    const sx = toX(-1)

    // Volcano particles flying upward at s=−1
    if (volcP > 0 && fadeOut > 0.01) {
      const numParticles = 10
      for (let i = 0; i < numParticles; i++) {
        const seed = i * 137.5 + 42
        const xJitter = Math.sin(seed) * 18
        const speed = 0.5 + (Math.sin(seed * 3.7) * 0.5 + 0.5) * 2
        const yOffset = volcP * speed * 100
        const px = sx + xJitter * (0.5 + volcP)
        const py = axisY - yOffset
        const particleAlpha = Math.max(0, 1 - volcP * 1.2) * opacity * fadeOut * 0.6
        if (particleAlpha > 0.01 && py > -20 && py < cssHeight + 20) {
          const pr = dotR * (0.3 + (Math.sin(seed * 2.1) * 0.5 + 0.5) * 0.6)
          drawDot(ctx, px, py, pr, sCol(isDark), particleAlpha, false)
        }
      }

      // "sum explodes!" label near the volcano
      const chaosA = Math.min(smoothstep(mapRange(volcP, 0.15, 0.4)), fadeOut) * opacity * 0.6
      if (chaosA > 0.01) {
        const cfs = Math.max(11, Math.min(14, ppu * 0.11))
        ctx.font = `bold ${cfs}px system-ui, sans-serif`
        ctx.fillStyle = dangerCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = chaosA
        ctx.fillText('sum explodes to \u221E!', sx, axisY + dotR + 6)
      }
    }
  }

  // ── Phase: trust (0.85–0.895) — convergent points prove bridge ─
  if (revealProgress >= PHASE.trustStart && revealProgress < PHASE.revealEnd) {
    const trustP = smoothstep(mapRange(revealProgress, PHASE.trustStart, PHASE.trustEnd))
    const fadeOut =
      1 - smoothstep(mapRange(revealProgress, PHASE.revealStart, PHASE.revealStart + 0.015))
    const a = trustP * fadeOut * opacity

    if (a > 0.01) {
      // Convergent reference points: s=2, s=3, s=4
      // Each appears sequentially with a checkmark
      const checkpoints: { s: number; z: number; label: string; arriveP: number }[] = [
        { s: 2, z: (Math.PI * Math.PI) / 6, label: 's=2: 1.645', arriveP: 0.1 },
        { s: 3, z: zetaHasse(3), label: 's=3: 1.202', arriveP: 0.35 },
        { s: 4, z: zetaHasse(4), label: 's=4: 1.082', arriveP: 0.6 },
      ]

      for (const cp of checkpoints) {
        const cpA = smoothstep(mapRange(trustP, cp.arriveP, cp.arriveP + 0.2)) * a
        if (cpA < 0.01) continue

        const cpx = toX(cp.s)
        const cpy = zToY(cp.z, va, axisY)
        if (cpy < -20 || cpy > cssHeight + 20) continue

        // Dot on the curve at this convergent point
        drawDot(ctx, cpx, cpy, dotR * 1.3, curveCol(isDark), cpA)

        // Checkmark ✓ next to the dot
        const checkA = smoothstep(mapRange(trustP, cp.arriveP + 0.1, cp.arriveP + 0.25)) * a
        if (checkA > 0.01) {
          const cfs = Math.max(13, Math.min(18, ppu * 0.14))
          ctx.font = `bold ${cfs}px system-ui, sans-serif`
          ctx.fillStyle = resultCol(isDark)
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.globalAlpha = checkA
          ctx.fillText('\u2713', cpx + dotR + 4, cpy)
        }

        // Label below the dot
        const labA = smoothstep(mapRange(trustP, cp.arriveP + 0.15, cp.arriveP + 0.3)) * a * 0.7
        if (labA > 0.01) {
          const lfs = Math.max(9, Math.min(12, ppu * 0.09))
          ctx.font = `${lfs}px system-ui, sans-serif`
          ctx.fillStyle = subtextColor(isDark)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.globalAlpha = labA
          ctx.fillText(cp.label, cpx, cpy + dotR + 4)
        }
      }

      // "bridge matches real answers!" summary once all checkpoints visible
      if (trustP > 0.75) {
        const summA = smoothstep(mapRange(trustP, 0.75, 0.95)) * a * 0.7
        const sfs = Math.max(11, Math.min(15, ppu * 0.12))
        ctx.font = `bold ${sfs}px system-ui, sans-serif`
        ctx.fillStyle = curveCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = summA
        ctx.fillText('bridge built from real answers!', cssWidth / 2, cssHeight * 0.88)
      }
    }
  }

  // ── Phase: reveal (0.895–0.94) — starburst at −1/12 ───────────
  if (revealProgress >= PHASE.revealStart) {
    const revP = smoothstep(mapRange(revealProgress, PHASE.revealStart, PHASE.revealEnd))
    const val = -1 / 12
    const sx = toX(-1)
    const sy = zToY(val, va, axisY)

    // Dot on curve at ζ(−1)
    drawDot(ctx, sx, sy, dotR * 1.5 * revP, resultCol(isDark), revP * opacity)

    // Drop line from curve to number line
    if (revP > 0.2) {
      const lineA = smoothstep(mapRange(revP, 0.2, 0.5)) * opacity
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx, axisY)
      ctx.strokeStyle = resultCol(isDark)
      ctx.lineWidth = 1.5
      ctx.globalAlpha = lineA * 0.4
      ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Starburst
    if (revP > 0.35) {
      const burstR = Math.max(14, Math.min(35, ppu * 0.25)) * smoothstep(mapRange(revP, 0.35, 0.8))
      drawStarburst(
        ctx,
        sx,
        sy,
        burstR,
        resultCol(isDark),
        revP * opacity * 0.8,
        revealProgress * Math.PI * 4
      )
    }

    // −1/12 label
    if (revP > 0.4) {
      const labelA = smoothstep(mapRange(revP, 0.4, 0.7)) * opacity
      const fs = Math.max(20, Math.min(32, ppu * 0.26))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = resultCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = labelA
      ctx.fillText('\u22121/12', sx, sy - dotR * 2 - 10)
    }
  }

  // ── Phase: recap (0.94–0.97) — journey summary ────────────────
  if (revealProgress >= PHASE.recapStart) {
    const recapP = smoothstep(mapRange(revealProgress, PHASE.recapStart, PHASE.recapEnd))
    const val = -1 / 12
    const sx = toX(-1)
    const sy = zToY(val, va, axisY)

    // Keep the −1/12 dot and starburst visible
    drawDot(ctx, sx, sy, dotR * 1.5, resultCol(isDark), opacity)
    const burstR = Math.max(10, Math.min(20, ppu * 0.15))
    drawStarburst(
      ctx,
      sx,
      sy,
      burstR,
      resultCol(isDark),
      opacity * 0.4,
      revealProgress * Math.PI * 4
    )

    // −1/12 label persists
    {
      const fs = Math.max(18, Math.min(28, ppu * 0.22))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = resultCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity
      ctx.fillText('\u22121/12', sx, sy - dotR * 2 - 8)
    }

    // "1 + 2 + 3 + … ⇝ −1/12" subtitle
    if (recapP > 0.3) {
      const subA = smoothstep(mapRange(recapP, 0.3, 0.8)) * opacity
      const fs = Math.max(10, Math.min(14, ppu * 0.11))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = subtextColor(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = subA * 0.8
      ctx.fillText('1 + 2 + 3 + 4 + \u2026 \u21DD \u22121/12', sx, sy + dotR * 2 + 8)
    }
  }

  // ── Phase: ghost (0.97–1.00) — Ramanujan attribution ──────────
  if (revealProgress >= PHASE.ghostStart) {
    const ghostP = smoothstep(mapRange(revealProgress, PHASE.ghostStart, PHASE.ghostEnd))
    const val = -1 / 12
    const sx = toX(-1)
    const sy = zToY(val, va, axisY)

    // Keep the −1/12 dot and starburst visible
    drawDot(ctx, sx, sy, dotR * 1.5, resultCol(isDark), opacity)
    const burstR = Math.max(10, Math.min(20, ppu * 0.15))
    drawStarburst(
      ctx,
      sx,
      sy,
      burstR,
      resultCol(isDark),
      opacity * 0.4,
      revealProgress * Math.PI * 4
    )

    // −1/12 label persists
    {
      const fs = Math.max(18, Math.min(28, ppu * 0.22))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = resultCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity
      ctx.fillText('\u22121/12', sx, sy - dotR * 2 - 8)
    }

    // ζ(−1) = −1/12 — Ramanujan (1913)
    if (ghostP > 0.2) {
      const fA = smoothstep(mapRange(ghostP, 0.2, 0.6)) * opacity
      const fs = Math.max(9, Math.min(12, ppu * 0.09))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = subtextColor(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = fA * 0.6
      ctx.fillText('\u03B6(\u22121) = \u22121/12  \u2014 Ramanujan (1913)', sx, sy + dotR * 2 + 26)
    }

    // "the ghost note" final label
    if (ghostP > 0.5) {
      const gnA = smoothstep(mapRange(ghostP, 0.5, 1)) * opacity
      ctx.font = `italic ${Math.max(12, Math.min(16, ppu * 0.13))}px system-ui, sans-serif`
      ctx.fillStyle = textColor(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = gnA * 0.7
      ctx.fillText('the ghost note', sx, sy + dotR * 2 + 44)
    }
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
