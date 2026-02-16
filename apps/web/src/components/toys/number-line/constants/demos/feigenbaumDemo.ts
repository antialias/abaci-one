import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

/**
 * Feigenbaum (delta) Demo V2: "The Dot That Learned to Juggle"
 *
 * Teaches δ ≈ 4.669 through a bouncing dot that iterates the logistic map.
 * The child earns the bifurcation diagram by understanding what each dot does,
 * then discovers the universal ratio through gap measurement.
 *
 * 14 narration segments build from a single settling dot → period doubling →
 * cascade → bifurcation diagram → gap bars → ratio → universality (3 maps) → delta.
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
// At r=3.54: period-8 oscillation (cascade)
const ITER_R354 = computeIteration(3.54, 0.2, 60)
// At r=3.564: period-16 oscillation (cascade)
const ITER_R3564 = computeIteration(3.564, 0.2, 80)

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

// High-resolution bifurcation data for the cascade region (r=3.44–3.58)
// Used when zoomed into the right end where period-doubling piles up
const BIFURCATION_DATA_HIRES: BifurcationColumn[] = (() => {
  const data: BifurcationColumn[] = []
  const rMin = 3.44
  const rMax = 3.58
  const step = 0.0003
  const warmup = 800
  const collect = 300
  const precision = 0.0005

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
  // Seg 0a: Dot splash (silent animation)
  splashBegin: 0.000, splashEnd: 0.025,
  // Seg 0b: Meet the dot (narration)
  meetBegin: 0.025, meetEnd: 0.060,
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
  // Seg 10a: Zoom into cascade — fractal self-similarity
  zoomBegin: 0.820, zoomEnd: 0.910,
  // Seg 10b: Delta — star reveal
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
 * Draw gap brackets and in-situ tiling for Seg 8: "Measuring gaps."
 *
 * Instead of abstract bars, we highlight each gap directly on the number line
 * with coloured brackets, then physically slide a "measuring stick" copy of
 * the small gap across the big gap, counting copies as we go. The child sees
 * the small piece marching across the big piece right where the gaps live.
 *
 * Phase 1 (0.00–0.30): Brackets fade in over Δ₁ (green) and Δ₂ (blue)
 * Phase 2 (0.30–0.90): A glowing blue "ruler" slides across the green gap,
 *                       leaving numbered stamps. Count reaches ~4.7.
 * Phase 3 (0.90–1.00): Count label settles; teaser "But how much exactly?"
 */
function drawGapMeasureInSitu(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  progress: number,
  isDark: boolean,
  alpha: number,
) {
  if (alpha <= 0) return

  const colors = [bracket1Col(isDark), bracket2Col(isDark), bracket3Col(isDark)]
  const bracketY = axisY + 14

  // Screen positions for Δ₁ (the big gap)
  const d1Left = toX(INTERVALS[0].from)
  const d1Right = toX(INTERVALS[0].to)

  // Screen positions for Δ₂ (the small gap)
  const d2Left = toX(INTERVALS[1].from)
  const d2Right = toX(INTERVALS[1].to)
  const d2ScreenWidth = d2Right - d2Left

  // ── Phase 1: Brackets appear over the actual gaps ─────────────
  const p1 = smoothstep(mapRange(progress, 0.0, 0.30))
  if (p1 > 0) {
    // Green bracket under Δ₁
    ctx.strokeStyle = colors[0]
    ctx.lineWidth = 2.5
    ctx.globalAlpha = alpha * p1 * 0.8
    ctx.beginPath()
    ctx.moveTo(d1Left, bracketY - 6)
    ctx.lineTo(d1Left, bracketY)
    ctx.lineTo(d1Right, bracketY)
    ctx.lineTo(d1Right, bracketY - 6)
    ctx.stroke()

    // Shaded fill over green gap region
    ctx.fillStyle = colors[0]
    ctx.globalAlpha = alpha * p1 * 0.1
    ctx.fillRect(d1Left, axisY - 20, d1Right - d1Left, 20 + bracketY - axisY)

    // Blue bracket under Δ₂ (slightly delayed)
    const p1b = smoothstep(mapRange(progress, 0.10, 0.28))
    if (p1b > 0) {
      ctx.strokeStyle = colors[1]
      ctx.lineWidth = 2.5
      ctx.globalAlpha = alpha * p1b * 0.8
      ctx.beginPath()
      ctx.moveTo(d2Left, bracketY - 6)
      ctx.lineTo(d2Left, bracketY)
      ctx.lineTo(d2Right, bracketY)
      ctx.lineTo(d2Right, bracketY - 6)
      ctx.stroke()

      // Shaded fill over blue gap region
      ctx.fillStyle = colors[1]
      ctx.globalAlpha = alpha * p1b * 0.1
      ctx.fillRect(d2Left, axisY - 20, d2Right - d2Left, 20 + bracketY - axisY)
    }
  }

  // ── Phase 2: Slide the blue ruler across the green gap ────────
  const p2 = mapRange(progress, 0.30, 0.90)
  if (p2 > 0) {
    const ratio = RATIOS[0].value // ≈ 4.75
    // Animate from 0 copies to full ratio
    const count = easeInOut(Math.min(1, p2)) * ratio
    const fullCopies = Math.floor(count)
    const partialFrac = count - fullCopies

    // Draw the stamps (completed copies) inside the green gap
    const stampY = axisY - 16
    const stampH = 8
    for (let i = 0; i <= fullCopies && i < 5; i++) {
      const stampLeft = d1Left + i * d2ScreenWidth
      const stampRight = i < fullCopies
        ? stampLeft + d2ScreenWidth
        : stampLeft + d2ScreenWidth * partialFrac
      if (stampRight <= d1Left) continue
      const clippedRight = Math.min(stampRight, d1Right)
      const w = clippedRight - stampLeft
      if (w <= 0) continue

      ctx.fillStyle = colors[1]
      ctx.globalAlpha = alpha * (i < fullCopies ? 0.35 : 0.2)
      ctx.fillRect(stampLeft, stampY, w, stampH)

      // Number label inside each completed stamp
      if (i < fullCopies && w > 10) {
        ctx.font = 'bold 9px system-ui, sans-serif'
        ctx.fillStyle = isDark ? '#fff' : '#000'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = alpha * 0.8
        ctx.fillText(`${i + 1}`, stampLeft + d2ScreenWidth / 2, stampY + stampH / 2)
      }

      // Divider tick between copies
      if (i > 0) {
        ctx.strokeStyle = colors[1]
        ctx.lineWidth = 1.5
        ctx.globalAlpha = alpha * 0.6
        ctx.beginPath()
        ctx.moveTo(stampLeft, stampY - 2)
        ctx.lineTo(stampLeft, stampY + stampH + 2)
        ctx.stroke()
      }
    }

    // Sliding ruler highlight — the leading edge of the current copy
    if (fullCopies < 5) {
      const rulerLeft = d1Left + fullCopies * d2ScreenWidth
      const rulerRight = Math.min(rulerLeft + d2ScreenWidth * partialFrac, d1Right)
      const rw = rulerRight - rulerLeft
      if (rw > 0) {
        // Glowing edge
        ctx.fillStyle = colors[1]
        ctx.globalAlpha = alpha * 0.5
        ctx.fillRect(rulerLeft, stampY - 2, rw, stampH + 4)
        ctx.strokeStyle = colors[1]
        ctx.lineWidth = 2
        ctx.globalAlpha = alpha * 0.8
        ctx.strokeRect(rulerLeft, stampY - 2, rw, stampH + 4)
      }
    }

    // Running count label below the bracket
    const displayCount = Math.min(count, ratio)
    const countText = (() => {
      if (displayCount < 1.5) return '1…'
      if (displayCount < 2.5) return '1… 2…'
      if (displayCount < 3.5) return '1… 2… 3…'
      if (displayCount < 4.3) return '1… 2… 3… 4…'
      if (p2 >= 0.85) return `≈ 4½!`
      return '1… 2… 3… 4… and a bit…'
    })()

    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.fillStyle = goldCol(isDark)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = alpha * smoothstep(mapRange(p2, 0.08, 0.25))
    ctx.fillText(countText, (d1Left + d1Right) / 2, bracketY + 4)
  }

  // ── Phase 3: Settled count ────────────────────────────────────
  const p3 = mapRange(progress, 0.90, 1.0)
  if (p3 > 0) {
    const fadeIn = smoothstep(p3)

    // Redraw final stamps (all copies complete)
    const ratio = RATIOS[0].value
    const stampY = axisY - 16
    const stampH = 8
    for (let i = 0; i < Math.floor(ratio) && i < 5; i++) {
      const stampLeft = d1Left + i * d2ScreenWidth
      const w = Math.min(d2ScreenWidth, d1Right - stampLeft)
      if (w <= 0) continue
      ctx.fillStyle = colors[1]
      ctx.globalAlpha = alpha * 0.35
      ctx.fillRect(stampLeft, stampY, w, stampH)
      if (w > 10) {
        ctx.font = 'bold 9px system-ui, sans-serif'
        ctx.fillStyle = isDark ? '#fff' : '#000'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = alpha * 0.8
        ctx.fillText(`${i + 1}`, stampLeft + d2ScreenWidth / 2, stampY + stampH / 2)
      }
    }

    // Final count below bracket
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.fillStyle = goldCol(isDark)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = alpha * fadeIn
    ctx.fillText('≈ 4½', (d1Left + d1Right) / 2, bracketY + 4)
  }
}

/**
 * Draw gap tiling for Seg 9: "Same trick, smaller!"
 *
 * Same in-situ approach as seg 8 but one level deeper: we tile pink (Δ₃)
 * copies inside the blue (Δ₂) gap, right on the number line. Then brighten
 * the seg 8 tiling so both are visible simultaneously — the child sees
 * the SAME count of ~4½ copies in both tilings without needing numbers.
 *
 * Phase 1 (0.00–0.10): Brackets highlight blue gap as the new container
 * Phase 2 (0.10–0.55): Pink ruler slides across blue gap, counting copies
 * Phase 3 (0.55–0.80): Both tilings brighten; matching "≈4½" labels pulse
 * Phase 4 (0.80–1.00): "Same count every time!" emphasis
 */
function drawGapRatioVisual(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  progress: number,
  isDark: boolean,
  alpha: number,
) {
  if (alpha <= 0) return

  const gold = goldCol(isDark)
  const colors = [bracket1Col(isDark), bracket2Col(isDark), bracket3Col(isDark)]
  const bracketY = axisY + 14

  // Screen positions
  const d1Left = toX(INTERVALS[0].from)
  const d1Right = toX(INTERVALS[0].to)
  const d2Left = toX(INTERVALS[1].from)
  const d2Right = toX(INTERVALS[1].to)
  const d2ScreenWidth = d2Right - d2Left
  const d3ScreenWidth = toX(INTERVALS[2].to) - toX(INTERVALS[2].from)

  // Seg 8's tiling brightens from faded context to full in phase 3
  const refBrighten = smoothstep(mapRange(progress, 0.55, 0.70))
  const refAlpha = alpha * (0.2 + refBrighten * 0.6)
  {
    const ratio = RATIOS[0].value
    const stampY = axisY - 16
    const stampH = 8
    // Green bracket
    ctx.strokeStyle = colors[0]
    ctx.lineWidth = 1.5 + refBrighten * 1.5
    ctx.globalAlpha = refAlpha * (0.5 + refBrighten * 0.4)
    ctx.beginPath()
    ctx.moveTo(d1Left, bracketY - 6)
    ctx.lineTo(d1Left, bracketY)
    ctx.lineTo(d1Right, bracketY)
    ctx.lineTo(d1Right, bracketY - 6)
    ctx.stroke()
    // Stamps (blue copies inside green)
    for (let i = 0; i < Math.floor(ratio) && i < 5; i++) {
      const stampLeft = d1Left + i * d2ScreenWidth
      const w = Math.min(d2ScreenWidth, d1Right - stampLeft)
      if (w <= 0) continue
      ctx.fillStyle = colors[1]
      ctx.globalAlpha = refAlpha * (0.3 + refBrighten * 0.2)
      ctx.fillRect(stampLeft, stampY, w, stampH)
      // Show stamp numbers when brightened
      if (refBrighten > 0.3 && w > 10) {
        ctx.font = 'bold 9px system-ui, sans-serif'
        ctx.fillStyle = isDark ? '#fff' : '#000'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = refAlpha * refBrighten * 0.8
        ctx.fillText(`${i + 1}`, stampLeft + d2ScreenWidth / 2, stampY + stampH / 2)
      }
    }
    // Count label under green tiling — appears/brightens in phase 3
    if (refBrighten > 0) {
      ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.fillStyle = gold
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = alpha * refBrighten * 0.9
      ctx.fillText('≈ 4½', (d1Left + d1Right) / 2, bracketY + 4)
    }
  }

  // ── Phase 1: Highlight blue gap as new container ──────────────
  const p1 = smoothstep(mapRange(progress, 0.0, 0.10))
  if (p1 > 0) {
    // Bold blue bracket
    ctx.strokeStyle = colors[1]
    ctx.lineWidth = 3
    ctx.globalAlpha = alpha * p1 * 0.9
    ctx.beginPath()
    ctx.moveTo(d2Left, bracketY - 6)
    ctx.lineTo(d2Left, bracketY)
    ctx.lineTo(d2Right, bracketY)
    ctx.lineTo(d2Right, bracketY - 6)
    ctx.stroke()

    // Shaded fill
    ctx.fillStyle = colors[1]
    ctx.globalAlpha = alpha * p1 * 0.1
    ctx.fillRect(d2Left, axisY - 20, d2Right - d2Left, 20 + bracketY - axisY)

    // Pink bracket over Δ₃ (the new ruler)
    const d3Left = toX(INTERVALS[2].from)
    const d3Right = toX(INTERVALS[2].to)
    const p1b = smoothstep(mapRange(progress, 0.04, 0.10))
    if (p1b > 0) {
      ctx.strokeStyle = colors[2]
      ctx.lineWidth = 2.5
      ctx.globalAlpha = alpha * p1b * 0.8
      ctx.beginPath()
      ctx.moveTo(d3Left, bracketY - 6)
      ctx.lineTo(d3Left, bracketY)
      ctx.lineTo(d3Right, bracketY)
      ctx.lineTo(d3Right, bracketY - 6)
      ctx.stroke()

      ctx.fillStyle = colors[2]
      ctx.globalAlpha = alpha * p1b * 0.1
      ctx.fillRect(d3Left, axisY - 20, d3Right - d3Left, 20 + bracketY - axisY)
    }
  }

  // ── Phase 2: Slide pink ruler across blue gap ─────────────────
  const p2 = mapRange(progress, 0.10, 0.55)
  if (p2 > 0) {
    const ratio2 = RATIOS[1].value // ≈ 4.67
    const count = easeInOut(Math.min(1, p2)) * ratio2
    const fullCopies = Math.floor(count)
    const partialFrac = count - fullCopies

    // Stamps inside blue gap
    const stampY = axisY - 16
    const stampH = 8
    for (let i = 0; i <= fullCopies && i < 5; i++) {
      const stampLeft = d2Left + i * d3ScreenWidth
      const stampRight = i < fullCopies
        ? stampLeft + d3ScreenWidth
        : stampLeft + d3ScreenWidth * partialFrac
      if (stampRight <= d2Left) continue
      const clippedRight = Math.min(stampRight, d2Right)
      const w = clippedRight - stampLeft
      if (w <= 0) continue

      ctx.fillStyle = colors[2]
      ctx.globalAlpha = alpha * (i < fullCopies ? 0.35 : 0.2)
      ctx.fillRect(stampLeft, stampY, w, stampH)

      if (i < fullCopies && w > 6) {
        ctx.font = 'bold 8px system-ui, sans-serif'
        ctx.fillStyle = isDark ? '#fff' : '#000'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = alpha * 0.8
        ctx.fillText(`${i + 1}`, stampLeft + d3ScreenWidth / 2, stampY + stampH / 2)
      }

      if (i > 0) {
        ctx.strokeStyle = colors[2]
        ctx.lineWidth = 1.5
        ctx.globalAlpha = alpha * 0.6
        ctx.beginPath()
        ctx.moveTo(stampLeft, stampY - 2)
        ctx.lineTo(stampLeft, stampY + stampH + 2)
        ctx.stroke()
      }
    }

    // Sliding ruler highlight
    if (fullCopies < 5) {
      const rulerLeft = d2Left + fullCopies * d3ScreenWidth
      const rulerRight = Math.min(rulerLeft + d3ScreenWidth * partialFrac, d2Right)
      const rw = rulerRight - rulerLeft
      if (rw > 0) {
        ctx.fillStyle = colors[2]
        ctx.globalAlpha = alpha * 0.5
        ctx.fillRect(rulerLeft, stampY - 2, rw, stampH + 4)
        ctx.strokeStyle = colors[2]
        ctx.lineWidth = 2
        ctx.globalAlpha = alpha * 0.8
        ctx.strokeRect(rulerLeft, stampY - 2, rw, stampH + 4)
      }
    }

    // Running count
    const displayCount = Math.min(count, ratio2)
    const countText = (() => {
      if (displayCount < 1.5) return '1…'
      if (displayCount < 2.5) return '1… 2…'
      if (displayCount < 3.5) return '1… 2… 3…'
      if (displayCount < 4.3) return '1… 2… 3… 4…'
      if (p2 >= 0.85) return 'about 4½!'
      return '1… 2… 3… 4… and a bit…'
    })()

    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.fillStyle = gold
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = alpha * smoothstep(mapRange(p2, 0.08, 0.25))
    ctx.fillText(countText, (d2Left + d2Right) / 2, bracketY + 4)
  }

  // ── Phase 3: Both tilings visible, matching "≈4½" labels ─────
  const p3 = mapRange(progress, 0.55, 0.80)
  if (p3 > 0) {
    // Redraw completed pink stamps in blue gap (held from phase 2)
    const ratio2 = RATIOS[1].value
    const stampY = axisY - 16
    const stampH = 8
    for (let i = 0; i < Math.floor(ratio2) && i < 5; i++) {
      const stampLeft = d2Left + i * d3ScreenWidth
      const w = Math.min(d3ScreenWidth, d2Right - stampLeft)
      if (w <= 0) continue
      ctx.fillStyle = colors[2]
      ctx.globalAlpha = alpha * 0.35
      ctx.fillRect(stampLeft, stampY, w, stampH)
      if (w > 6) {
        ctx.font = 'bold 8px system-ui, sans-serif'
        ctx.fillStyle = isDark ? '#fff' : '#000'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = alpha * 0.8
        ctx.fillText(`${i + 1}`, stampLeft + d3ScreenWidth / 2, stampY + stampH / 2)
      }
    }

    // "≈4½" under blue tiling (pink-in-blue count)
    const fadeIn = smoothstep(p3)
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.fillStyle = gold
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = alpha * fadeIn * 0.9
    ctx.fillText('≈ 4½', (d2Left + d2Right) / 2, bracketY + 4)

    // Connecting line between the two "≈4½" labels — visual echo
    if (fadeIn > 0.3) {
      const lineAlpha = smoothstep(mapRange(fadeIn, 0.3, 0.7))
      const greenMidX = (d1Left + d1Right) / 2
      const blueMidX = (d2Left + d2Right) / 2
      const lineY = bracketY + 13
      ctx.beginPath()
      ctx.moveTo(greenMidX, lineY)
      ctx.lineTo(blueMidX, lineY)
      ctx.strokeStyle = gold
      ctx.lineWidth = 1.5
      ctx.setLineDash([3, 3])
      ctx.globalAlpha = alpha * lineAlpha * 0.5
      ctx.stroke()
      ctx.setLineDash([])

      // "same!" label on the connecting line
      if (lineAlpha > 0.5) {
        const sameAlpha = smoothstep(mapRange(lineAlpha, 0.5, 1.0))
        ctx.font = 'bold 10px system-ui, sans-serif'
        ctx.fillStyle = gold
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = alpha * sameAlpha * 0.8
        ctx.fillText('same!', (greenMidX + blueMidX) / 2, lineY + 2)
      }
    }
  }

  // ── Phase 4: "Same count every time!" emphasis ────────────────
  const p4 = mapRange(progress, 0.80, 1.0)
  if (p4 > 0) {
    const fadeIn = smoothstep(p4)

    // Hold both completed tilings and labels (drawn above via refBrighten)

    // Redraw completed pink stamps (held)
    const ratio2 = RATIOS[1].value
    const stampY = axisY - 16
    const stampH = 8
    for (let i = 0; i < Math.floor(ratio2) && i < 5; i++) {
      const stampLeft = d2Left + i * d3ScreenWidth
      const w = Math.min(d3ScreenWidth, d2Right - stampLeft)
      if (w <= 0) continue
      ctx.fillStyle = colors[2]
      ctx.globalAlpha = alpha * 0.35
      ctx.fillRect(stampLeft, stampY, w, stampH)
    }

    // Both "≈4½" labels held
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.fillStyle = gold
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = alpha * 0.9
    ctx.fillText('≈ 4½', (d1Left + d1Right) / 2, bracketY + 4)
    ctx.fillText('≈ 4½', (d2Left + d2Right) / 2, bracketY + 4)

    // Emphasis text above the tilings
    const emphY = axisY - 34
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.fillStyle = gold
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = alpha * fadeIn
    ctx.fillText('Same count every time!', (d1Left + d2Right) / 2, emphY)
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

  // ── Seg 0a+0b: Dot splash + Meet the dot ─────────────────────────
  // 0a (splashBegin–splashEnd): silent — dot splashes into existence
  // 0b (meetBegin–meetEnd): narration — introduce the dot and its rule
  if (revealProgress >= PHASE.splashBegin && revealProgress < PHASE.ruleEnd) {
    const dotX = toX(2.8)
    const dotY = axisY - 0.2 * verticalScale
    const col = stableCol(isDark)

    // Splash phase: dot materialises with expanding rings
    const splashP = smoothstep(mapRange(revealProgress, PHASE.splashBegin, PHASE.splashEnd))

    // Expanding splash rings (fade out as they grow)
    if (splashP > 0 && splashP < 1) {
      const ringCount = 3
      for (let i = 0; i < ringCount; i++) {
        const ringDelay = i * 0.2
        const ringP = smoothstep(mapRange(splashP, ringDelay, ringDelay + 0.6))
        if (ringP <= 0) continue
        const ringRadius = 6 + ringP * 30
        const ringAlpha = opacity * (1 - ringP) * 0.5
        ctx.beginPath()
        ctx.arc(dotX, dotY, ringRadius, 0, PI * 2)
        ctx.strokeStyle = col
        ctx.lineWidth = 2.5 * (1 - ringP * 0.6)
        ctx.globalAlpha = ringAlpha
        ctx.stroke()
      }
    }

    // The dot itself scales up during the splash, then stays at full size
    const dotScale = smoothstep(mapRange(splashP, 0.2, 0.8))
    const meetP = smoothstep(mapRange(revealProgress, PHASE.meetBegin, PHASE.meetEnd))

    // Gentle pulse once dot is fully materialised (during narration segment)
    const pulse = dotScale >= 1 ? 1 + 0.15 * Math.sin(revealProgress * PI * 30) : 1
    const dotRadius = 6 * dotScale * pulse
    if (dotRadius > 0) {
      ctx.beginPath()
      ctx.arc(dotX, dotY, dotRadius, 0, PI * 2)
      ctx.fillStyle = col
      ctx.globalAlpha = opacity * dotScale
      ctx.fill()
    }

    // "r = 2.8" label below axis — appears during narration segment
    if (meetP > 0.3) {
      const labelP = smoothstep(mapRange(meetP, 0.3, 0.7))
      ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.fillStyle = col
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * labelP * 0.8
      ctx.fillText('r = 2.8', dotX, axisY + 6)
    }

    // The rule formula — visible from mid seg 0b through seg 1
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

      // "next = dial × you × distance to 1" (kid-friendly version)
      ctx.font = '11px system-ui, sans-serif'
      ctx.globalAlpha = formulaAlpha * 0.8
      ctx.fillText('next = dial × you × distance to 1', dotX + 20, axisY - verticalScale * 0.7)

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

      // "you" label — bracket from axis (0) to dot
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
      ctx.fillText('you', trackX + 15, (axisY + spotY) / 2)

      // "distance to 1" label — bracket from dot to top (1)
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
      ctx.fillText('distance to 1', trackX + 15, (spotY + topY) / 2)
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

  // ── Seg 6: The cascade — show iteration dots at 8→16 ───────────
  // Instead of drawing the bifurcation diagram (which steals seg 7's reveal),
  // we show bouncing dots at r=3.54 (period-8) and r=3.564 (period-16)
  // so the child sees the cascade through individual dots, not the diagram.
  if (revealProgress >= PHASE.cascadeBegin && revealProgress < PHASE.fullBegin) {
    const cascP = mapRange(revealProgress, PHASE.cascadeBegin, PHASE.cascadeEnd)
    const fadeOut = 1 - smoothstep(mapRange(revealProgress, PHASE.cascadeEnd - 0.02, PHASE.fullBegin))

    // Phase 1 (0–0.45): period-8 at r=3.54
    const p8P = mapRange(cascP, 0, 0.45)
    if (p8P > 0 && p8P <= 1) {
      const totalBounces = ITER_R354.length - 1
      const bounceFloat = Math.min(1, p8P) * totalBounces
      const bounceIndex = Math.min(Math.floor(bounceFloat), totalBounces)
      const bounceFrac = bounceFloat - Math.floor(bounceFloat)
      const p8Fade = 1 - smoothstep(mapRange(cascP, 0.4, 0.5))

      drawIterationTrack(
        ctx, toX, axisY, 3.54, ITER_R354,
        bounceIndex, bounceFrac, verticalScale,
        chaoticCol(isDark), chaoticCol(isDark),
        opacity * fadeOut * p8Fade,
      )

      // "r = 3.54" label
      const labelP = smoothstep(mapRange(p8P, 0, 0.1))
      ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.fillStyle = chaoticCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * labelP * fadeOut * p8Fade * 0.8
      ctx.fillText('r = 3.54', toX(3.54), axisY + 6)

      // "EIGHT!" callout
      if (p8P > 0.5) {
        const calloutP = smoothstep(mapRange(p8P, 0.5, 0.8))
        ctx.font = 'bold 13px system-ui, sans-serif'
        ctx.fillStyle = chaoticCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = opacity * calloutP * fadeOut * p8Fade * 0.9
        ctx.fillText('Eight homes!', toX(3.54), axisY - verticalScale - 8)
      }
    }

    // Phase 2 (0.45–0.9): period-16 at r=3.564
    const p16P = mapRange(cascP, 0.45, 0.9)
    if (p16P > 0 && p16P <= 1) {
      const totalBounces = ITER_R3564.length - 1
      const bounceFloat = Math.min(1, p16P) * totalBounces
      const bounceIndex = Math.min(Math.floor(bounceFloat), totalBounces)
      const bounceFrac = bounceFloat - Math.floor(bounceFloat)

      drawIterationTrack(
        ctx, toX, axisY, 3.564, ITER_R3564,
        bounceIndex, bounceFrac, verticalScale,
        chaoticCol(isDark), chaoticCol(isDark),
        opacity * fadeOut,
      )

      // "r = 3.564" label
      const labelP = smoothstep(mapRange(p16P, 0, 0.1))
      ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.fillStyle = chaoticCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * labelP * fadeOut * 0.8
      ctx.fillText('r = 3.564', toX(3.564), axisY + 6)

      // "SIXTEEN!" callout
      if (p16P > 0.5) {
        const calloutP = smoothstep(mapRange(p16P, 0.5, 0.8))
        ctx.font = 'bold 13px system-ui, sans-serif'
        ctx.fillStyle = chaoticCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = opacity * calloutP * fadeOut * 0.9
        ctx.fillText('Sixteen homes!', toX(3.564), axisY - verticalScale - 8)
      }
    }

    // Split-point pulse markers — appear as each r is crossed
    for (let i = 1; i < BIFURCATION_POINTS.length && i < 4; i++) {
      const bp = BIFURCATION_POINTS[i]
      const markerAppear = i === 1 ? 0 : i === 2 ? 0.45 : 0.85
      const markerP = smoothstep(mapRange(cascP, markerAppear, markerAppear + 0.1))
      if (markerP <= 0) continue
      const px = toX(bp.r)

      ctx.beginPath()
      ctx.arc(px, axisY, 4 + 2 * Math.sin(revealProgress * PI * 10), 0, PI * 2)
      ctx.fillStyle = chaoticCol(isDark)
      ctx.globalAlpha = opacity * markerP * fadeOut * 0.5
      ctx.fill()
    }
  }

  // ── Seg 7: The full picture — entire bifurcation diagram sweeps in ─
  // The cascade (seg 6) only showed individual iteration dots — the full
  // diagram has NOT been drawn yet. Now we sweep the ENTIRE tree from
  // r=2.5 → 3.58 in one dramatic left-to-right reveal: trunk, fork,
  // branches, and chaos all emerge together.
  if (revealProgress >= PHASE.fullBegin) {
    const fullP = mapRange(revealProgress, PHASE.fullBegin, PHASE.fullEnd)
    // Dim during gap/ratio phases, brighten during Seg 10 zoom-in
    const dimFactor = (() => {
      if (revealProgress < PHASE.gapBegin) return 1.0
      if (revealProgress < PHASE.zoomBegin) return 0.3
      // During Seg 10: brighten back up as we zoom into the fractal
      return 0.3 + 0.7 * smoothstep(mapRange(revealProgress, PHASE.zoomBegin, PHASE.zoomBegin + 0.06))
    })()

    // Full sweep: r=2.5 → 3.58 across the entire segment
    const sweepR = 2.5 + smoothstep(mapRange(fullP, 0, 0.85)) * 1.08

    // During Seg 10a, overlay hi-res data for the cascade region
    const useHires = revealProgress >= PHASE.zoomBegin

    // Batch render for performance
    const groups: Map<string, BifurcationColumn[]> = new Map()
    // Always render the base dataset
    for (const col of BIFURCATION_DATA) {
      if (col.r > sweepR) break
      if (col.r > 3.58) break
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
    // Overlay hi-res data during zoom
    if (useHires) {
      for (const col of BIFURCATION_DATA_HIRES) {
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
    }

    for (const [color, columns] of groups) {
      ctx.fillStyle = color
      ctx.globalAlpha = opacity * 0.5 * dimFactor
      ctx.beginPath()
      for (const col of columns) {
        const screenX = toX(col.r)
        // Fade in columns near the sweep edge for a softer appearance
        const edgeFade = smoothstep(mapRange(sweepR - col.r, 0, 0.04))
        if (edgeFade < 0.01) continue
        for (const a of col.attractors) {
          const screenY = axisY - a * verticalScale
          ctx.moveTo(screenX + dotRadius, screenY)
          ctx.arc(screenX, screenY, dotRadius, 0, PI * 2)
        }
      }
      ctx.fill()
    }

    // ── Overlay: bouncing dot at the sweep frontier ──────────────
    // While the diagram is actively sweeping (seg 7), show a dot at the
    // frontier r-value that jumps between its attractor homes. This
    // connects the static dots in the diagram to the bouncing behavior
    // the child has been watching in earlier segments.
    if (fullP > 0 && fullP < 1 && dimFactor >= 1.0) {
      // Find the bifurcation column closest to the sweep edge
      const frontierCol = BIFURCATION_DATA.find(col => col.r >= sweepR - 0.01 && col.r <= sweepR)
      if (frontierCol && frontierCol.attractors.length > 0) {
        const attractors = frontierCol.attractors
        const screenX = toX(frontierCol.r)
        const nHomes = attractors.length

        // Decelerate as number of homes increases: fewer cycles per unit
        // of progress so the kid has time to watch the dot visit all homes.
        // 1 home → 3 cycles/unit, 2 → 2, 4 → 1.2, 8+ → 0.6
        const cycleSpeed = 3 / Math.sqrt(nHomes)
        const cycleProgress = (fullP * cycleSpeed) % 1

        // Walk through attractors in order so the bounce is sequential
        const attractorIndex = Math.floor(cycleProgress * nHomes) % nHomes
        const nextIndex = (attractorIndex + 1) % nHomes
        const hopFrac = (cycleProgress * nHomes) % 1

        const currY = axisY - attractors[attractorIndex] * verticalScale
        const nextY = axisY - attractors[nextIndex] * verticalScale

        // Arc-shaped hop: the dot lifts away from the track as it jumps,
        // making each bounce much more visible.
        const hopEased = easeInOut(hopFrac)
        const baseY = currY + (nextY - currY) * hopEased
        const hopHeight = Math.abs(nextY - currY) * 0.35 + 12
        const arcLift = Math.sin(hopEased * PI) * hopHeight
        const dotY = baseY - arcLift

        const frontierColor = columnColor(frontierCol.r, isDark)

        // Motion trail: fading echo behind the dot's arc path
        const trailSteps = 4
        for (let t = trailSteps; t >= 1; t--) {
          const trailFrac = Math.max(0, hopFrac - t * 0.06)
          const trailEased = easeInOut(trailFrac)
          const trailBaseY = currY + (nextY - currY) * trailEased
          const trailArc = Math.sin(trailEased * PI) * hopHeight
          const trailY = trailBaseY - trailArc
          ctx.beginPath()
          ctx.arc(screenX, trailY, 4 - t * 0.5, 0, PI * 2)
          ctx.fillStyle = frontierColor
          ctx.globalAlpha = opacity * (0.15 - t * 0.03)
          ctx.fill()
        }

        // Glow ring behind the dot
        ctx.beginPath()
        ctx.arc(screenX, dotY, 10, 0, PI * 2)
        ctx.fillStyle = frontierColor
        ctx.globalAlpha = opacity * 0.15
        ctx.fill()

        // Main dot (larger for visibility)
        ctx.beginPath()
        ctx.arc(screenX, dotY, 6, 0, PI * 2)
        ctx.fillStyle = frontierColor
        ctx.globalAlpha = opacity * 0.95
        ctx.fill()

        // White inner highlight
        ctx.beginPath()
        ctx.arc(screenX, dotY, 2.5, 0, PI * 2)
        ctx.fillStyle = '#fff'
        ctx.globalAlpha = opacity * 0.85
        ctx.fill()

        // Ghost rings at every attractor home — pulsing when the dot
        // arrives so the kid sees "this is where the dot lands"
        for (let i = 0; i < nHomes; i++) {
          const homeY = axisY - attractors[i] * verticalScale
          const isActive = i === attractorIndex && hopFrac < 0.15
          const ringRadius = isActive ? 5.5 : 4
          const ringAlpha = isActive ? 0.7 : 0.35
          ctx.beginPath()
          ctx.arc(screenX, homeY, ringRadius, 0, PI * 2)
          ctx.strokeStyle = frontierColor
          ctx.lineWidth = isActive ? 2 : 1.5
          ctx.globalAlpha = opacity * ringAlpha
          ctx.stroke()
        }
      }
    }
  }

  // ── Seg 8: Measuring gaps — in-situ ruler tiling ───────────────
  if (revealProgress >= PHASE.gapBegin && revealProgress < PHASE.zoomBegin) {
    const gapP = mapRange(revealProgress, PHASE.gapBegin, PHASE.gapEnd)
    const fadeOut = 1 - smoothstep(mapRange(revealProgress, PHASE.ratioEnd - 0.02, PHASE.zoomBegin))
    drawGapMeasureInSitu(ctx, toX, axisY, gapP, isDark, opacity * fadeOut)
  }

  // ── Seg 9: The magic ratio ─────────────────────────────────────
  if (revealProgress >= PHASE.ratioBegin && revealProgress < PHASE.zoomBegin) {
    const ratioP = mapRange(revealProgress, PHASE.ratioBegin, PHASE.ratioEnd)
    const fadeOut = 1 - smoothstep(mapRange(revealProgress, PHASE.ratioEnd, PHASE.zoomBegin))
    drawGapRatioVisual(ctx, toX, axisY, ratioP, isDark, opacity * fadeOut)
  }

  // ── Seg 10b: Delta — star reveal ────────────────────────────────
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
