import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

/**
 * Feigenbaum (delta) Demo V2: "The Dot That Learned to Juggle"
 *
 * Teaches δ ≈ 4.669 through a bouncing dot that iterates the logistic map.
 * The child earns the bifurcation diagram by understanding what each dot does,
 * then discovers the universal ratio through gap measurement.
 *
 * 12 animation segments build from a single settling dot → period doubling →
 * cascade → bifurcation diagram → gap bars → ratio → universality → delta.
 */

// ── Constants ────────────────────────────────────────────────────────

const DELTA = 4.66920160910299
const PI = Math.PI

// Known bifurcation points (period-doubling) for the logistic map
const BIFURCATION_POINTS = [
  { r: 3.0,    period: 2,  label: 'r₁' },
  { r: 3.4495, period: 4,  label: 'r₂' },
  { r: 3.5441, period: 8,  label: 'r₃' },
  { r: 3.5644, period: 16, label: 'r₄' },
  { r: 3.5688, period: 32, label: 'r₅' },
]

// Intervals between successive bifurcation points
const INTERVALS = [
  { from: BIFURCATION_POINTS[0].r, to: BIFURCATION_POINTS[1].r, width: BIFURCATION_POINTS[1].r - BIFURCATION_POINTS[0].r, label: 'Δ₁' },
  { from: BIFURCATION_POINTS[1].r, to: BIFURCATION_POINTS[2].r, width: BIFURCATION_POINTS[2].r - BIFURCATION_POINTS[1].r, label: 'Δ₂' },
  { from: BIFURCATION_POINTS[2].r, to: BIFURCATION_POINTS[3].r, width: BIFURCATION_POINTS[3].r - BIFURCATION_POINTS[2].r, label: 'Δ₃' },
]

// Ratios converge to delta
const RATIOS = [
  { value: INTERVALS[0].width / INTERVALS[1].width, label: 'Δ₁/Δ₂' },
  { value: INTERVALS[1].width / INTERVALS[2].width, label: 'Δ₂/Δ₃' },
]

// Sine map bifurcation points: x → r·sin(πx)
// Precomputed constants for universality segment
const SINE_BIFURCATION = {
  points: [
    { r: 0.7172, label: 's₁' },  // period 1→2
    { r: 0.8333, label: 's₂' },  // period 2→4
    { r: 0.8585, label: 's₃' },  // period 4→8
    { r: 0.8639, label: 's₄' },  // period 8→16
  ],
  get intervals() {
    const p = this.points
    return [
      p[1].r - p[0].r, // ≈ 0.1161
      p[2].r - p[1].r, // ≈ 0.0252
      p[3].r - p[2].r, // ≈ 0.0054
    ]
  },
  get ratios() {
    const i = this.intervals
    return [i[0] / i[1], i[1] / i[2]] // ≈ 4.61, ≈ 4.67
  },
}

// ── Precomputed iteration sequences ─────────────────────────────────

function computeIteration(r: number, x0: number, steps: number): number[] {
  const seq: number[] = [x0]
  let x = x0
  for (let i = 0; i < steps; i++) {
    x = r * x * (1 - x)
    seq.push(x)
  }
  return seq
}

// At r=2.8: converges to one fixed point
const ITER_R28 = computeIteration(2.8, 0.2, 20)
// At r=3.2: period-2 oscillation
const ITER_R32 = computeIteration(3.2, 0.2, 30)
// At r=3.5: period-4 oscillation
const ITER_R35 = computeIteration(3.5, 0.2, 40)

// ── Precomputed bifurcation diagram ─────────────────────────────────

interface BifurcationColumn {
  r: number
  attractors: number[]
}

const BIFURCATION_DATA: BifurcationColumn[] = (() => {
  const data: BifurcationColumn[] = []
  const rMin = 2.5
  const rMax = 3.58
  const step = 0.002
  const warmup = 500
  const collect = 200
  const precision = 0.001

  for (let r = rMin; r <= rMax; r += step) {
    let x = 0.5
    for (let i = 0; i < warmup; i++) {
      x = r * x * (1 - x)
    }
    const seen = new Set<number>()
    const attractors: number[] = []
    for (let i = 0; i < collect; i++) {
      x = r * x * (1 - x)
      const rounded = Math.round(x / precision) * precision
      if (!seen.has(rounded)) {
        seen.add(rounded)
        attractors.push(x)
      }
    }
    attractors.sort((a, b) => a - b)
    data.push({ r, attractors })
  }
  return data
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
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2
}

// ── Phase timing (12 segments) ──────────────────────────────────────

const PHASE = {
  // Seg 0: Meet the dot
  meetBegin: 0.000, meetEnd: 0.060,
  // Seg 1: The rule — iterate at r=2.8, dot settles
  ruleBegin: 0.060, ruleEnd: 0.140,
  // Seg 2: Turn up the dial — slide r rightward
  dialBegin: 0.140, dialEnd: 0.200,
  // Seg 3: First split! — r=3.2, period-2
  splitBegin: 0.200, splitEnd: 0.300,
  // Seg 4: Why it splits — overshoot visualization
  whyBegin: 0.300, whyEnd: 0.370,
  // Seg 5: Four! — r=3.5, period-4
  fourBegin: 0.370, fourEnd: 0.450,
  // Seg 6: The cascade — 8→16→32, gaps shrink
  cascadeBegin: 0.450, cascadeEnd: 0.560,
  // Seg 7: The full picture — bifurcation diagram sweeps in
  fullBegin: 0.560, fullEnd: 0.640,
  // Seg 8: Measuring gaps — proportional bars
  gapBegin: 0.640, gapEnd: 0.730,
  // Seg 9: The magic ratio — ratio computation, pan right
  ratioBegin: 0.730, ratioEnd: 0.820,
  // Seg 10: It's always the same! — universality
  univBegin: 0.820, univEnd: 0.910,
  // Seg 11: Delta — star reveal
  revealBegin: 0.910, revealEnd: 1.000,
} as const

// ── Colors ───────────────────────────────────────────────────────────

function stableCol(isDark: boolean) { return isDark ? '#60a5fa' : '#3b82f6' }
function period2Col(isDark: boolean) { return isDark ? '#a78bfa' : '#7c3aed' }
function period4Col(isDark: boolean) { return isDark ? '#fb923c' : '#ea580c' }
function chaoticCol(isDark: boolean) { return isDark ? '#f87171' : '#dc2626' }
function bracket1Col(_isDark: boolean) { return '#22c55e' }
function bracket2Col(_isDark: boolean) { return '#3b82f6' }
function bracket3Col(_isDark: boolean) { return '#ec4899' }
function goldCol(_isDark: boolean) { return '#eab308' }
function subtextCol(isDark: boolean) { return isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }
function tealCol(_isDark: boolean) { return '#2dd4bf' }

function columnColor(r: number, isDark: boolean): string {
  if (r < 3.0) return stableCol(isDark)
  if (r < 3.4495) return period2Col(isDark)
  if (r < 3.5441) return period4Col(isDark)
  return chaoticCol(isDark)
}

// ── Viewport ─────────────────────────────────────────────────────────

export function feigenbaumDemoViewport(cssWidth: number, cssHeight: number) {
  // Initial view fits [2.2, 3.4] with room for iteration track above
  const center = 2.8
  const rangeWidth = 1.2
  const ppu = Math.min(cssWidth * 0.75 / rangeWidth, cssHeight * 0.35)
  return { center, pixelsPerUnit: ppu }
}

// ── Drawing helpers ──────────────────────────────────────────────────

type ToX = (v: number) => number

/**
 * Draw the iteration track: a vertical line at a given r-position,
 * with a bouncing dot showing x-values from the iteration sequence.
 */
function drawIterationTrack(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  r: number,
  sequence: number[],
  bounceIndex: number,
  bounceFrac: number,
  verticalScale: number,
  dotColor: string,
  trailColor: string,
  alpha: number,
) {
  if (alpha <= 0) return
  const screenX = toX(r)

  // Draw vertical track line
  ctx.beginPath()
  ctx.moveTo(screenX, axisY)
  ctx.lineTo(screenX, axisY - verticalScale)
  ctx.strokeStyle = trailColor
  ctx.lineWidth = 1
  ctx.globalAlpha = alpha * 0.2
  ctx.stroke()

  // Draw ghost trail of previous positions
  const trailStart = Math.max(0, bounceIndex - 8)
  for (let i = trailStart; i < bounceIndex && i < sequence.length; i++) {
    const age = bounceIndex - i
    const ghostAlpha = alpha * Math.max(0.05, 0.4 - age * 0.05)
    const y = axisY - sequence[i] * verticalScale
    ctx.beginPath()
    ctx.arc(screenX, y, 3, 0, PI * 2)
    ctx.fillStyle = trailColor
    ctx.globalAlpha = ghostAlpha
    ctx.fill()
  }

  // Draw arc from previous position to current
  if (bounceIndex > 0 && bounceIndex < sequence.length) {
    const prevY = axisY - sequence[bounceIndex - 1] * verticalScale
    const currTarget = axisY - sequence[bounceIndex] * verticalScale
    // Interpolate current position with easing
    const currY = prevY + (currTarget - prevY) * easeInOut(bounceFrac)
    // Draw arc
    const midY = Math.min(prevY, currTarget) - 15
    ctx.beginPath()
    ctx.moveTo(screenX - 8, prevY)
    ctx.quadraticCurveTo(screenX - 15, midY, screenX, currY)
    ctx.strokeStyle = dotColor
    ctx.lineWidth = 1.5
    ctx.globalAlpha = alpha * 0.5
    ctx.stroke()

    // Draw current dot
    ctx.beginPath()
    ctx.arc(screenX, currY, 5, 0, PI * 2)
    ctx.fillStyle = dotColor
    ctx.globalAlpha = alpha
    ctx.fill()
  } else if (bounceIndex === 0 && sequence.length > 0) {
    // Show starting position
    const y = axisY - sequence[0] * verticalScale
    ctx.beginPath()
    ctx.arc(screenX, y, 5, 0, PI * 2)
    ctx.fillStyle = dotColor
    ctx.globalAlpha = alpha
    ctx.fill()
  }

  // Highlight settled positions (last few values if they're close together)
  if (bounceIndex >= sequence.length - 1 && sequence.length > 4) {
    const last4 = sequence.slice(-4)
    const uniqueSettled = [...new Set(last4.map(v => Math.round(v * 100) / 100))]
    for (const v of uniqueSettled) {
      const y = axisY - v * verticalScale
      ctx.beginPath()
      ctx.arc(screenX, y, 6, 0, PI * 2)
      ctx.fillStyle = dotColor
      ctx.globalAlpha = alpha * 0.7
      ctx.fill()
      // White inner dot
      ctx.beginPath()
      ctx.arc(screenX, y, 3, 0, PI * 2)
      ctx.fillStyle = '#fff'
      ctx.globalAlpha = alpha * 0.9
      ctx.fill()
    }
  }
}

/**
 * Draw proportional gap bars below the axis.
 * Green bar for Δ₁ (tallest), blue for Δ₂, pink for Δ₃ (tiny).
 */
function drawGapBars(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  progress: number,
  isDark: boolean,
  alpha: number,
) {
  if (alpha <= 0) return

  const colors = [bracket1Col(isDark), bracket2Col(isDark), bracket3Col(isDark)]
  const barBaseY = axisY + 20
  const maxBarHeight = 80
  // Normalize to first interval width
  const maxWidth = INTERVALS[0].width

  for (let i = 0; i < INTERVALS.length; i++) {
    const fadeIn = smoothstep(mapRange(progress, i * 0.25, i * 0.25 + 0.2))
    if (fadeIn <= 0) continue

    const interval = INTERVALS[i]
    const barHeight = maxBarHeight * (interval.width / maxWidth)
    const barX = toX(interval.from)
    const barW = toX(interval.to) - barX

    // Draw bar
    ctx.fillStyle = colors[i]
    ctx.globalAlpha = alpha * fadeIn * 0.6
    ctx.fillRect(barX, barBaseY, barW, barHeight * fadeIn)

    // Draw label
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.fillStyle = colors[i]
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = alpha * fadeIn * 0.9
    ctx.fillText(interval.label, barX + barW / 2, barBaseY + barHeight * fadeIn + 4)
  }
}

/**
 * Draw ratio comparison: side-by-side bars with labels showing the ratio values.
 */
function drawRatioComparison(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  axisY: number,
  progress: number,
  isDark: boolean,
  alpha: number,
) {
  if (alpha <= 0) return

  const gold = goldCol(isDark)
  const centerX = cssWidth / 2
  const baseY = axisY - 60

  // First ratio: Δ₁/Δ₂
  const r1p = smoothstep(mapRange(progress, 0.0, 0.4))
  if (r1p > 0) {
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.fillStyle = gold
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = alpha * r1p
    ctx.fillText(`${RATIOS[0].label} ≈ ${RATIOS[0].value.toFixed(2)}`, centerX, baseY)
  }

  // Second ratio: Δ₂/Δ₃
  const r2p = smoothstep(mapRange(progress, 0.3, 0.7))
  if (r2p > 0) {
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.fillStyle = gold
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = alpha * r2p
    ctx.fillText(`${RATIOS[1].label} ≈ ${RATIOS[1].value.toFixed(2)}`, centerX, baseY + 24)
  }

  // Arrow converging to delta
  const convP = smoothstep(mapRange(progress, 0.6, 1.0))
  if (convP > 0) {
    ctx.font = 'bold 16px system-ui, sans-serif'
    ctx.fillStyle = gold
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = alpha * convP
    ctx.fillText(`→ ${DELTA.toFixed(3)}…`, centerX, baseY + 52)
  }
}

/**
 * Draw universality hint: sine map split markers + ratio labels.
 */
function drawUniversalityHint(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  verticalScale: number,
  progress: number,
  isDark: boolean,
  alpha: number,
) {
  if (alpha <= 0) return

  const teal = tealCol(isDark)
  const gold = goldCol(isDark)

  // Draw "Different rule!" label
  const labelP = smoothstep(mapRange(progress, 0.0, 0.2))
  if (labelP > 0) {
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.fillStyle = teal
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.globalAlpha = alpha * labelP
    ctx.fillText('Sine map: x → r·sin(πx)', toX(3.25), axisY - verticalScale - 20)
  }

  // Draw split markers at sine bifurcation r-values (mapped onto same visual region)
  // We remap sine r-values [0.7, 0.87] to screen region [2.8, 3.57] to show alongside
  const remapR = (sineR: number) => 2.8 + (sineR - 0.7) * (3.57 - 2.8) / (0.87 - 0.7)

  for (let i = 0; i < SINE_BIFURCATION.points.length; i++) {
    const ptP = smoothstep(mapRange(progress, 0.1 + i * 0.1, 0.25 + i * 0.1))
    if (ptP <= 0) continue

    const rMapped = remapR(SINE_BIFURCATION.points[i].r)
    const sx = toX(rMapped)

    // Vertical split marker
    ctx.beginPath()
    ctx.moveTo(sx, axisY - verticalScale * 0.1)
    ctx.lineTo(sx, axisY - verticalScale * 0.9)
    ctx.strokeStyle = teal
    ctx.lineWidth = 2
    ctx.globalAlpha = alpha * ptP * 0.6
    ctx.stroke()

    // Diamond marker
    const dy = axisY - verticalScale * 0.5
    ctx.beginPath()
    ctx.moveTo(sx, dy - 4)
    ctx.lineTo(sx + 4, dy)
    ctx.lineTo(sx, dy + 4)
    ctx.lineTo(sx - 4, dy)
    ctx.closePath()
    ctx.fillStyle = teal
    ctx.globalAlpha = alpha * ptP * 0.8
    ctx.fill()
  }

  // Show sine map ratios converging to same number
  const ratioP = smoothstep(mapRange(progress, 0.5, 0.8))
  if (ratioP > 0) {
    const sineRatios = SINE_BIFURCATION.ratios
    const textX = toX(3.25)
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.textAlign = 'center'

    ctx.fillStyle = teal
    ctx.textBaseline = 'top'
    ctx.globalAlpha = alpha * ratioP * 0.9
    ctx.fillText(`Ratios: ${sineRatios[0].toFixed(2)}, ${sineRatios[1].toFixed(2)}`, textX, axisY + 8)

    // "Same number!" in gold
    const sameP = smoothstep(mapRange(progress, 0.7, 1.0))
    if (sameP > 0) {
      ctx.font = 'bold 14px system-ui, sans-serif'
      ctx.fillStyle = gold
      ctx.globalAlpha = alpha * sameP
      ctx.fillText(`→ Same! ≈ ${DELTA.toFixed(3)}`, textX, axisY + 26)
    }
  }
}

/** Draw attractor dots for a single r-value column. */
function drawBifurcationColumn(
  ctx: CanvasRenderingContext2D,
  r: number,
  attractors: number[],
  toX: ToX,
  axisY: number,
  verticalScale: number,
  color: string,
  alpha: number,
  dotRadius: number,
) {
  if (alpha <= 0) return
  const screenX = toX(r)
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  for (const a of attractors) {
    const screenY = axisY - a * verticalScale
    ctx.beginPath()
    ctx.arc(screenX, screenY, dotRadius, 0, PI * 2)
    ctx.fill()
  }
}

/** 5-pointed star. */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  alpha: number,
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

/** Gold dots at ratio values converging toward delta on the number line. */
function drawConvergingDots(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  progress: number,
  isDark: boolean,
  alpha: number,
) {
  if (alpha <= 0) return

  const gold = goldCol(isDark)
  const dotRadius = 5
  const values = [
    { val: RATIOS[0].value, label: `≈${RATIOS[0].value.toFixed(2)}` },
    { val: RATIOS[1].value, label: `≈${RATIOS[1].value.toFixed(2)}` },
    { val: DELTA, label: 'δ' },
  ]

  for (let i = 0; i < values.length; i++) {
    const dotProgress = smoothstep(mapRange(progress, i * 0.25, i * 0.25 + 0.35))
    if (dotProgress <= 0) continue

    const v = values[i]
    const x = toX(v.val)
    const y = axisY

    ctx.beginPath()
    ctx.arc(x, y, dotRadius * dotProgress, 0, PI * 2)
    ctx.fillStyle = gold
    ctx.globalAlpha = alpha * dotProgress
    ctx.fill()

    const labelY = axisY - 15 - i * 18
    const fs = i === 2 ? 16 : 12
    ctx.font = `bold ${fs}px system-ui, sans-serif`
    ctx.fillStyle = gold
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.globalAlpha = alpha * dotProgress * 0.9
    ctx.fillText(v.label, x, labelY)
  }

  // Connecting line hint
  if (progress > 0.5) {
    const lineAlpha = smoothstep(mapRange(progress, 0.5, 0.8))
    const x1 = toX(RATIOS[0].value)
    const x2 = toX(DELTA)
    ctx.beginPath()
    ctx.moveTo(x1, axisY + 8)
    ctx.lineTo(x2, axisY + 8)
    ctx.strokeStyle = gold
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.globalAlpha = alpha * lineAlpha * 0.4
    ctx.stroke()
    ctx.setLineDash([])
  }
}

// ── Main render ──────────────────────────────────────────────────────

export function renderFeigenbaumOverlay(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  revealProgress: number,
  opacity: number,
): void {
  if (opacity <= 0) return

  const ppu = state.pixelsPerUnit
  const axisY = cssHeight / 2
  const toX = (v: number) => numberToScreenX(v, state.center, ppu, cssWidth)
  const verticalScale = Math.min(cssHeight * 0.35, 180)
  const dotRadius = Math.max(1.2, Math.min(2, ppu * 0.005))

  ctx.save()

  // ── Seg 0: Meet the dot ──────────────────────────────────────────
  // A dot fades in at r=2.8, starting position x=0.2
  if (revealProgress >= PHASE.meetBegin && revealProgress < PHASE.ruleEnd) {
    const meetP = smoothstep(mapRange(revealProgress, PHASE.meetBegin, PHASE.meetEnd))
    const dotX = toX(2.8)
    const dotY = axisY - 0.2 * verticalScale

    // Pulsing dot appears
    const pulse = 1 + 0.15 * Math.sin(revealProgress * PI * 30)
    ctx.beginPath()
    ctx.arc(dotX, dotY, 6 * meetP * pulse, 0, PI * 2)
    ctx.fillStyle = stableCol(isDark)
    ctx.globalAlpha = opacity * meetP
    ctx.fill()

    // "r = 2.8" label below axis
    if (meetP > 0.5) {
      const labelP = smoothstep(mapRange(meetP, 0.5, 1))
      ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.fillStyle = stableCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * labelP * 0.8
      ctx.fillText('r = 2.8', dotX, axisY + 6)
    }

    // The rule formula — visible from mid seg 0 through seg 1
    if (meetP > 0.4) {
      const formulaP = smoothstep(mapRange(meetP, 0.4, 0.8))
      const formulaFade = 1 - smoothstep(mapRange(revealProgress, PHASE.ruleEnd - 0.02, PHASE.ruleEnd))
      const formulaAlpha = opacity * formulaP * formulaFade

      // "The rule:" header
      ctx.font = 'bold 11px system-ui, sans-serif'
      ctx.fillStyle = isDark ? '#93c5fd' : '#2563eb'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = formulaAlpha * 0.9
      ctx.fillText('The rule:', dotX + 20, axisY - verticalScale * 0.7 - 14)

      // "next = dial × spot × room left" (kid-friendly version)
      ctx.font = '11px system-ui, sans-serif'
      ctx.globalAlpha = formulaAlpha * 0.8
      ctx.fillText('next = dial × spot × room left', dotX + 20, axisY - verticalScale * 0.7)

      // Actual formula underneath (smaller, for the curious)
      ctx.font = '10px system-ui, sans-serif'
      ctx.fillStyle = subtextCol(isDark)
      ctx.globalAlpha = formulaAlpha * 0.5
      ctx.fillText('x → r · x · (1−x)', dotX + 20, axisY - verticalScale * 0.7 + 14)
    }
  }

  // ── Seg 1: The rule — iterate at r=2.8, dot settles ────────────
  if (revealProgress >= PHASE.ruleBegin && revealProgress < PHASE.dialEnd) {
    const ruleP = mapRange(revealProgress, PHASE.ruleBegin, PHASE.ruleEnd)
    const totalBounces = ITER_R28.length - 1
    const bounceFloat = ruleP * totalBounces
    const bounceIndex = Math.min(Math.floor(bounceFloat), totalBounces)
    const bounceFrac = bounceFloat - Math.floor(bounceFloat)
    // Fade out during dial phase
    const fadeOut = 1 - smoothstep(mapRange(revealProgress, PHASE.dialBegin, PHASE.dialEnd))

    drawIterationTrack(
      ctx, toX, axisY, 2.8, ITER_R28,
      bounceIndex, bounceFrac, verticalScale,
      stableCol(isDark), stableCol(isDark),
      opacity * fadeOut,
    )

    // Show "spot" and "room left" annotations on the track during early bounces
    if (ruleP > 0.05 && ruleP < 0.5) {
      const annotP = smoothstep(mapRange(ruleP, 0.05, 0.15))
      const annotFade = 1 - smoothstep(mapRange(ruleP, 0.35, 0.5))
      const annotAlpha = opacity * annotP * annotFade * fadeOut

      const currIdx = Math.min(bounceIndex, ITER_R28.length - 1)
      const xVal = ITER_R28[currIdx]
      const spotY = axisY - xVal * verticalScale
      const topY = axisY - verticalScale
      const trackX = toX(2.8)

      // "spot" label — bracket from axis to dot
      ctx.strokeStyle = stableCol(isDark)
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.globalAlpha = annotAlpha * 0.4
      ctx.beginPath()
      ctx.moveTo(trackX + 12, axisY)
      ctx.lineTo(trackX + 12, spotY)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.font = '10px system-ui, sans-serif'
      ctx.fillStyle = stableCol(isDark)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = annotAlpha * 0.7
      ctx.fillText('spot', trackX + 15, (axisY + spotY) / 2)

      // "room left" label — bracket from dot to top
      ctx.strokeStyle = isDark ? '#86efac' : '#16a34a'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.globalAlpha = annotAlpha * 0.4
      ctx.beginPath()
      ctx.moveTo(trackX + 12, spotY)
      ctx.lineTo(trackX + 12, topY)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = isDark ? '#86efac' : '#16a34a'
      ctx.globalAlpha = annotAlpha * 0.7
      ctx.fillText('room left', trackX + 15, (spotY + topY) / 2)
    }
  }

  // ── Segs 2+3: Continuous dial slide from 2.8 → 3.2 ─────────────
  // One seamless slide. The child watches the SAME dot cross the
  // threshold at r≈3.0 where settling becomes impossible.
  //
  // Seg 2 (dialBegin–dialEnd): r = 2.8 → 3.0 — wobbles more
  // Seg 3 (splitBegin–splitEnd): r = 3.0 → 3.2 — can't settle!
  // Then holds at r=3.2 to let the oscillation sink in.
  if (revealProgress >= PHASE.dialBegin && revealProgress < PHASE.fourBegin) {
    // Continuous r-value: slides from 2.8 through to 3.2 across segs 2+3
    const slideP = mapRange(revealProgress, PHASE.dialBegin, PHASE.splitBegin + (PHASE.splitEnd - PHASE.splitBegin) * 0.4)
    const currentR = 2.8 + Math.min(1, slideP) * 0.4 // 2.8 → 3.2
    const fadeOut = 1 - smoothstep(mapRange(revealProgress, PHASE.whyEnd - 0.02, PHASE.fourBegin))

    // Compute iteration at current r (cheap: ~20 multiplications)
    // More steps at higher r to show the persistent oscillation
    const steps = currentR > 3.05 ? 30 : 20
    const dialSeq = computeIteration(currentR, 0.2, steps)
    const totalBounces = dialSeq.length - 1

    // Animate through bounces in a loop so the child sees the
    // iteration play out. As r increases past 3.0, the "settled"
    // state becomes two oscillating values — visible in real time.
    const elapsed = revealProgress - PHASE.dialBegin
    const loopDuration = 0.04 // each cycle ≈ 4% of total progress
    const loopP = (elapsed % loopDuration) / loopDuration
    const bounceFloat = loopP * totalBounces
    const bounceIndex = Math.min(Math.floor(bounceFloat), totalBounces)
    const bounceFrac = bounceFloat - Math.floor(bounceFloat)

    // Color transitions from stable blue to period-2 purple as r crosses 3.0
    const purpleMix = smoothstep(mapRange(currentR, 2.95, 3.1))
    const dotColor = purpleMix > 0.01
      ? (purpleMix > 0.99 ? period2Col(isDark) : stableCol(isDark))
      : stableCol(isDark)
    const trailColor = dotColor

    drawIterationTrack(
      ctx, toX, axisY, currentR, dialSeq,
      bounceIndex, bounceFrac, verticalScale,
      dotColor, trailColor,
      opacity * fadeOut,
    )

    // Diamond marker on axis showing the dial position
    const markerX = toX(currentR)
    ctx.beginPath()
    ctx.moveTo(markerX, axisY - 6)
    ctx.lineTo(markerX + 4, axisY)
    ctx.lineTo(markerX, axisY + 6)
    ctx.lineTo(markerX - 4, axisY)
    ctx.closePath()
    ctx.fillStyle = dotColor
    ctx.globalAlpha = opacity * Math.min(1, slideP * 3) * fadeOut * 0.8
    ctx.fill()

    // r label tracks the marker
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.fillStyle = dotColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = opacity * 0.7 * fadeOut
    ctx.fillText(`r = ${currentR.toFixed(2)}`, markerX, axisY + 10)

    // "Two homes!" callout once r has arrived at 3.2 and oscillation is visible
    if (revealProgress > PHASE.splitBegin + (PHASE.splitEnd - PHASE.splitBegin) * 0.6) {
      const calloutP = smoothstep(mapRange(revealProgress,
        PHASE.splitBegin + (PHASE.splitEnd - PHASE.splitBegin) * 0.6,
        PHASE.splitBegin + (PHASE.splitEnd - PHASE.splitBegin) * 0.85))
      ctx.font = 'bold 13px system-ui, sans-serif'
      ctx.fillStyle = period2Col(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * calloutP * fadeOut * 0.9
      ctx.fillText('Two homes!', toX(currentR), axisY - verticalScale - 8)
    }
  }

  // ── Seg 4: Why it splits — overshoot visualization ─────────────
  if (revealProgress >= PHASE.whyBegin && revealProgress < PHASE.fourBegin) {
    const whyP = mapRange(revealProgress, PHASE.whyBegin, PHASE.whyEnd)
    const fadeOut = 1 - smoothstep(mapRange(revealProgress, PHASE.whyEnd - 0.02, PHASE.fourBegin))

    // Show target line and overshoot arc
    const targetX = axisY - 0.6875 * verticalScale // fixed point of r=3.2
    const screenX = toX(3.2)

    // Target line (dashed)
    ctx.beginPath()
    ctx.moveTo(screenX - 20, targetX)
    ctx.lineTo(screenX + 20, targetX)
    ctx.strokeStyle = period2Col(isDark)
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.globalAlpha = opacity * smoothstep(whyP) * fadeOut * 0.5
    ctx.stroke()
    ctx.setLineDash([])

    // "Target" label
    ctx.font = '10px system-ui, sans-serif'
    ctx.fillStyle = period2Col(isDark)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = opacity * smoothstep(whyP) * fadeOut * 0.6
    ctx.fillText('target', screenX + 22, targetX)

    // Overshoot arrow
    if (whyP > 0.3) {
      const arrowP = smoothstep(mapRange(whyP, 0.3, 0.7))
      const overshootY = targetX - 25 * arrowP
      ctx.beginPath()
      ctx.moveTo(screenX, targetX)
      ctx.lineTo(screenX, overshootY)
      ctx.strokeStyle = chaoticCol(isDark)
      ctx.lineWidth = 2
      ctx.globalAlpha = opacity * arrowP * fadeOut * 0.7
      ctx.stroke()

      // Arrow head
      ctx.beginPath()
      ctx.moveTo(screenX - 4, overshootY + 6)
      ctx.lineTo(screenX, overshootY)
      ctx.lineTo(screenX + 4, overshootY + 6)
      ctx.strokeStyle = chaoticCol(isDark)
      ctx.lineWidth = 2
      ctx.globalAlpha = opacity * arrowP * fadeOut * 0.7
      ctx.stroke()

      // "Overshoot!" label
      if (whyP > 0.5) {
        const textP = smoothstep(mapRange(whyP, 0.5, 0.8))
        ctx.font = 'bold 11px system-ui, sans-serif'
        ctx.fillStyle = chaoticCol(isDark)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = opacity * textP * fadeOut * 0.8
        ctx.fillText('Overshoot!', screenX + 10, overshootY)
      }
    }
  }

  // ── Seg 5: Four! — r=3.5, period-4 ────────────────────────────
  if (revealProgress >= PHASE.fourBegin && revealProgress < PHASE.cascadeEnd) {
    const fourP = mapRange(revealProgress, PHASE.fourBegin, PHASE.fourEnd)
    const totalBounces = ITER_R35.length - 1
    const bounceFloat = fourP * totalBounces
    const bounceIndex = Math.min(Math.floor(bounceFloat), totalBounces)
    const bounceFrac = bounceFloat - Math.floor(bounceFloat)
    const fadeOut = 1 - smoothstep(mapRange(revealProgress, PHASE.cascadeBegin, PHASE.cascadeBegin + 0.03))

    drawIterationTrack(
      ctx, toX, axisY, 3.5, ITER_R35,
      bounceIndex, bounceFrac, verticalScale,
      period4Col(isDark), period4Col(isDark),
      opacity * fadeOut,
    )

    // "r = 3.5" label
    const labelP = smoothstep(mapRange(fourP, 0, 0.15))
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.fillStyle = period4Col(isDark)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = opacity * labelP * fadeOut * 0.8
    ctx.fillText('r = 3.5', toX(3.5), axisY + 6)

    // "FOUR homes!" callout
    if (fourP > 0.7) {
      const calloutP = smoothstep(mapRange(fourP, 0.7, 0.95))
      ctx.font = 'bold 13px system-ui, sans-serif'
      ctx.fillStyle = period4Col(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * calloutP * fadeOut * 0.9
      ctx.fillText('Four homes!', toX(3.5), axisY - verticalScale - 8)
    }
  }

  // ── Seg 6: The cascade — rapid sweep of bifurcation points ─────
  if (revealProgress >= PHASE.cascadeBegin && revealProgress < PHASE.fullEnd) {
    const cascP = mapRange(revealProgress, PHASE.cascadeBegin, PHASE.cascadeEnd)
    // Sweep through bifurcation data progressively
    const sweepR = 3.0 + cascP * 0.58 // 3.0 → 3.58

    // Draw columns up to sweep point
    for (const col of BIFURCATION_DATA) {
      if (col.r < 3.0) continue
      if (col.r > sweepR) break
      const screenX = toX(col.r)
      if (screenX < -20 || screenX > cssWidth + 20) continue

      const color = columnColor(col.r, isDark)
      const colAlpha = opacity * 0.6 * smoothstep(mapRange(sweepR - col.r, 0, 0.05))
      drawBifurcationColumn(
        ctx, col.r, col.attractors, toX, axisY,
        verticalScale, color, colAlpha, dotRadius,
      )
    }

    // Split point pulse markers
    for (let i = 1; i < BIFURCATION_POINTS.length && i < 4; i++) {
      const bp = BIFURCATION_POINTS[i]
      if (bp.r > sweepR) break
      const pulseP = smoothstep(mapRange(sweepR - bp.r, 0, 0.03))
      const px = toX(bp.r)

      ctx.beginPath()
      ctx.arc(px, axisY, 4 + 2 * Math.sin(revealProgress * PI * 10), 0, PI * 2)
      ctx.fillStyle = chaoticCol(isDark)
      ctx.globalAlpha = opacity * pulseP * 0.5
      ctx.fill()
    }
  }

  // ── Seg 7: The full picture — bifurcation diagram sweeps in ────
  if (revealProgress >= PHASE.fullBegin) {
    const fullP = mapRange(revealProgress, PHASE.fullBegin, PHASE.fullEnd)
    const sweepR = 2.5 + smoothstep(fullP) * 1.08 // 2.5 → 3.58
    // Dim during later phases
    const dimFactor = (() => {
      if (revealProgress < PHASE.gapBegin) return 1.0
      if (revealProgress < PHASE.univBegin) return 0.3
      return 0.15
    })()

    // Batch render for performance
    const groups: Map<string, BifurcationColumn[]> = new Map()
    for (const col of BIFURCATION_DATA) {
      if (col.r > sweepR) break
      const screenX = toX(col.r)
      if (screenX < -20 || screenX > cssWidth + 20) continue
      const color = columnColor(col.r, isDark)
      let group = groups.get(color)
      if (!group) {
        group = []
        groups.set(color, group)
      }
      group.push(col)
    }

    for (const [color, columns] of groups) {
      ctx.fillStyle = color
      ctx.globalAlpha = opacity * 0.5 * dimFactor
      ctx.beginPath()
      for (const col of columns) {
        const screenX = toX(col.r)
        for (const a of col.attractors) {
          const screenY = axisY - a * verticalScale
          ctx.moveTo(screenX + dotRadius, screenY)
          ctx.arc(screenX, screenY, dotRadius, 0, PI * 2)
        }
      }
      ctx.fill()
    }
  }

  // ── Seg 8: Measuring gaps — proportional bars ──────────────────
  if (revealProgress >= PHASE.gapBegin && revealProgress < PHASE.univBegin) {
    const gapP = mapRange(revealProgress, PHASE.gapBegin, PHASE.gapEnd)
    const fadeOut = 1 - smoothstep(mapRange(revealProgress, PHASE.ratioEnd - 0.02, PHASE.univBegin))
    drawGapBars(ctx, toX, axisY, gapP, isDark, opacity * fadeOut)
  }

  // ── Seg 9: The magic ratio ─────────────────────────────────────
  if (revealProgress >= PHASE.ratioBegin && revealProgress < PHASE.univBegin) {
    const ratioP = mapRange(revealProgress, PHASE.ratioBegin, PHASE.ratioEnd)
    const fadeOut = 1 - smoothstep(mapRange(revealProgress, PHASE.ratioEnd, PHASE.univBegin))
    drawRatioComparison(ctx, cssWidth, axisY, ratioP, isDark, opacity * fadeOut)

    // Converging dots on the number line
    const dotsP = mapRange(ratioP, 0.3, 1.0)
    if (dotsP > 0) {
      drawConvergingDots(ctx, toX, axisY, dotsP, isDark, opacity * fadeOut)
    }
  }

  // ── Seg 10: Universality — sine map comparison ─────────────────
  if (revealProgress >= PHASE.univBegin && revealProgress < PHASE.revealEnd) {
    const univP = mapRange(revealProgress, PHASE.univBegin, PHASE.univEnd)
    const fadeOut = 1 - smoothstep(mapRange(revealProgress, PHASE.univEnd, PHASE.revealBegin + 0.03))
    drawUniversalityHint(ctx, toX, axisY, verticalScale, univP, isDark, opacity * fadeOut)
  }

  // ── Seg 11: Delta — star reveal ────────────────────────────────
  if (revealProgress >= PHASE.revealBegin) {
    const revealP = smoothstep(mapRange(revealProgress, PHASE.revealBegin, PHASE.revealEnd))

    const deltaX = toX(DELTA)
    const gold = goldCol(isDark)

    // Star at delta
    const starY = axisY - 24
    const starR = Math.max(8, Math.min(14, ppu * 0.06))
    const starPulse = 1 + 0.1 * Math.sin(revealProgress * PI * 8)
    drawStar(ctx, deltaX, starY, starR * starPulse * revealP, gold, opacity * revealP)

    // "δ" label
    if (revealP > 0.3) {
      const labelP = smoothstep(mapRange(revealP, 0.3, 0.7))
      const fs = Math.max(20, Math.min(28, ppu * 0.12))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = gold
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * labelP
      ctx.fillText('δ', deltaX, starY - starR - 4)
    }

    // "≈ 4.669" value
    if (revealP > 0.5) {
      const valP = smoothstep(mapRange(revealP, 0.5, 0.85))
      const fs = Math.max(14, Math.min(18, ppu * 0.08))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = gold
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * valP
      ctx.fillText('≈ 4.669', deltaX, axisY + 6)
    }

    // Subtitle
    if (revealP > 0.7) {
      const subP = smoothstep(mapRange(revealP, 0.7, 1.0))
      const fs = Math.max(10, Math.min(13, ppu * 0.05))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = subtextCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * subP * 0.7
      ctx.fillText('The speed of chaos', deltaX, axisY + 26)
    }

    // Delta dot on number line
    ctx.beginPath()
    ctx.arc(deltaX, axisY, 4 * revealP, 0, PI * 2)
    ctx.fillStyle = gold
    ctx.globalAlpha = opacity * revealP
    ctx.fill()
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
