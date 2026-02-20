import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

/**
 * e Demo: "The Magic Vine"
 *
 * A vine grows along the number line. Each growth round, every part of the
 * vine (including new growth!) sprouts its own new leaves. This is compound
 * growth: new leaves immediately start growing their own baby leaves.
 *
 * For n growth rounds, the vine reaches (1+1/n)^n. As n → ∞ the vine
 * grows continuously and reaches exactly e ≈ 2.718 — nature's growth limit.
 *
 * Visual: the vine stem lies on the number line axis. Each round, buds
 * pulse along the entire vine, then a tendril arcs upward from the vine's
 * tip and lands further along the line, extending the vine. A dashed amber
 * "growth boundary" line at e shows the limit the vine can never pass.
 */

// ── Utilities ──────────────────────────────────────────────────────────

function mapRange(v: number, s: number, e: number): number {
  if (v <= s) return 0
  if (v >= e) return 1
  return (v - s) / (e - s)
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

function easeOut(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return 1 - (1 - c) ** 3
}

// ── Viewport ───────────────────────────────────────────────────────────

export function eDemoViewport(cssWidth: number, cssHeight: number) {
  const center = Math.E / 2
  const ppu = Math.min((cssWidth * 0.85) / (Math.E + 0.8), cssHeight * 0.3)
  return { center, pixelsPerUnit: ppu }
}

// ── Compound growth ────────────────────────────────────────────────────

function compoundResult(n: number): number {
  return (1 + 1 / n) ** n
}

function compoundAfterSteps(n: number, steps: number): number {
  return (1 + 1 / n) ** steps
}

// ── Phase timing ───────────────────────────────────────────────────────

interface Level {
  n: number
  startP: number
  endP: number
}

const LEVELS: Level[] = [
  { n: 1, startP: 0.06, endP: 0.14 },
  { n: 2, startP: 0.14, endP: 0.4 }, // Centerpiece — extra time to teach
  { n: 3, startP: 0.4, endP: 0.47 },
  { n: 4, startP: 0.47, endP: 0.53 },
  { n: 6, startP: 0.53, endP: 0.57 },
  { n: 8, startP: 0.57, endP: 0.61 },
  { n: 12, startP: 0.61, endP: 0.64 },
  { n: 20, startP: 0.64, endP: 0.67 },
  { n: 50, startP: 0.67, endP: 0.7 },
  { n: 100, startP: 0.7, endP: 0.73 },
]

const SMOOTH_START = 0.73
const SMOOTH_END = 0.83
const CONVERGE_START = 0.83
const CONVERGE_END = 0.92
const LABELS_START = 0.92

// ── Colors ─────────────────────────────────────────────────────────────

function vineCol(isDark: boolean) {
  return isDark ? '#22c55e' : '#16a34a'
}
function vineBright(isDark: boolean) {
  return isDark ? '#86efac' : '#4ade80'
}
function budCol(isDark: boolean) {
  return isDark ? '#a3e635' : '#65a30d'
}
function boundaryCol(isDark: boolean) {
  return isDark ? '#fbbf24' : '#d97706'
}

// ── Drawing helpers ────────────────────────────────────────────────────

/** Vine stem thickness scales with viewport */
function stemW(ppu: number): number {
  return Math.max(7, Math.min(13, ppu * 0.09))
}

/** Draw the vine stem from NL `start` to `end` on the axis. */
function drawStem(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  start: number,
  end: number,
  ppu: number,
  isDark: boolean,
  alpha: number,
  bright = false
) {
  const x0 = toX(start)
  const x1 = toX(end)
  if (x1 - x0 < 1) return

  ctx.beginPath()
  ctx.moveTo(x0, axisY)
  ctx.lineTo(x1, axisY)
  ctx.strokeStyle = bright ? vineBright(isDark) : vineCol(isDark)
  ctx.lineWidth = stemW(ppu)
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha
  ctx.stroke()
}

/** Draw small alternating leaves along the vine. */
function drawLeaves(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  start: number,
  end: number,
  ppu: number,
  isDark: boolean,
  alpha: number
) {
  const x0 = toX(start)
  const x1 = toX(end)
  const len = x1 - x0
  if (len < 20) return

  const sw = stemW(ppu)
  const spacing = Math.max(18, Math.min(35, len / 10))
  const leafLen = Math.max(5, Math.min(10, sw * 0.9))

  ctx.strokeStyle = vineCol(isDark)
  ctx.lineWidth = Math.max(1.2, sw * 0.18)
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha * 0.7

  let side = 1
  for (let x = x0 + spacing * 0.6; x < x1 - spacing * 0.3; x += spacing) {
    const base = axisY - side * sw * 0.45
    const tipX = x + leafLen * 0.5
    const tipY = base - side * leafLen

    ctx.beginPath()
    ctx.moveTo(x, base)
    ctx.quadraticCurveTo(x + leafLen * 0.12, tipY, tipX, tipY)
    ctx.stroke()

    // Tiny leaf blade fill
    ctx.beginPath()
    ctx.moveTo(x, base)
    ctx.quadraticCurveTo(x + leafLen * 0.12, tipY, tipX, tipY)
    ctx.quadraticCurveTo(x + leafLen * 0.35, base - side * leafLen * 0.3, x, base)
    ctx.fillStyle = vineCol(isDark)
    ctx.globalAlpha = alpha * 0.25
    ctx.fill()
    ctx.globalAlpha = alpha * 0.7

    side *= -1
  }
}

/**
 * Draw a tendril arc from startNL to endNL, curving upward like a vine
 * shoot unfurling. `progress` 0→1 controls how much is drawn.
 */
function drawTendril(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  startNL: number,
  endNL: number,
  progress: number,
  ppu: number,
  isDark: boolean,
  alpha: number
) {
  if (progress <= 0) return

  const sx = toX(startNL)
  const ex = toX(endNL)
  const w = ex - sx
  if (w < 2) return

  // Peak: proportional to width, capped
  const peakH = Math.min(45, Math.max(14, w * 0.55))
  // Control point — slightly past midpoint for an organic lean-forward
  const cpx = sx + w * 0.45
  const cpy = axisY - peakH

  const segments = 40
  const drawTo = Math.ceil(easeOut(progress) * segments)

  ctx.beginPath()
  for (let i = 0; i <= drawTo; i++) {
    const t = i / segments
    const mt = 1 - t
    const bx = mt * mt * sx + 2 * mt * t * cpx + t * t * ex
    const by = mt * mt * axisY + 2 * mt * t * cpy + t * t * axisY

    if (i === 0) ctx.moveTo(bx, by)
    else ctx.lineTo(bx, by)
  }

  ctx.strokeStyle = vineBright(isDark)
  ctx.lineWidth = stemW(ppu) * 0.65
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha
  ctx.stroke()

  // Growing tip bud
  if (progress > 0.05 && progress < 0.97) {
    const t = Math.min(1, drawTo / segments)
    const mt = 1 - t
    const tipX = mt * mt * sx + 2 * mt * t * cpx + t * t * ex
    const tipY = mt * mt * axisY + 2 * mt * t * cpy + t * t * axisY
    const r = Math.max(2.5, stemW(ppu) * 0.35)

    ctx.beginPath()
    ctx.arc(tipX, tipY, r, 0, Math.PI * 2)
    ctx.fillStyle = budCol(isDark)
    ctx.globalAlpha = alpha * 0.9
    ctx.fill()
  }
}

/** Draw buds pulsing along the vine (left-to-right ripple). */
function drawBuds(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  vineEnd: number,
  pulseP: number,
  ppu: number,
  isDark: boolean,
  alpha: number
) {
  if (pulseP <= 0 || pulseP >= 1) return

  const x0 = toX(0)
  const x1 = toX(vineEnd)
  const len = x1 - x0
  const count = Math.max(3, Math.min(14, Math.floor(len / 25)))
  const sw = stemW(ppu)
  const budR = Math.max(2, sw * 0.28)

  for (let i = 0; i <= count; i++) {
    const frac = i / count
    const bx = x0 + frac * len

    // Ripple delay: left buds appear first
    const delay = frac * 0.3
    const bp = mapRange(pulseP, delay, delay + 0.45)
    if (bp <= 0 || bp >= 1) continue

    const pulse = Math.sin(bp * Math.PI)
    const r = budR * pulse

    ctx.beginPath()
    ctx.arc(bx, axisY - sw * 0.5 - r - 2, r, 0, Math.PI * 2)
    ctx.fillStyle = budCol(isDark)
    ctx.globalAlpha = alpha * pulse * 0.85
    ctx.fill()
  }
}

/** Small tick mark for completed levels. */
function drawGhostTick(
  ctx: CanvasRenderingContext2D,
  sx: number,
  axisY: number,
  color: string,
  alpha: number,
  halfH = 7
) {
  ctx.beginPath()
  ctx.moveTo(sx, axisY - halfH)
  ctx.lineTo(sx, axisY + halfH)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.globalAlpha = alpha
  ctx.setLineDash([])
  ctx.stroke()
}

/** Draw a simple 5-pointed star (the vine's goal). */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  alpha: number
) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
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

/** Draw bold divider marks splitting the vine into n equal pieces. */
function drawSegmentDividers(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  vineEnd: number,
  n: number,
  ppu: number,
  isDark: boolean,
  alpha: number
) {
  if (n < 2 || alpha <= 0) return
  const sw = stemW(ppu)
  const halfH = sw * 1.1 + 3

  for (let s = 1; s < n; s++) {
    const val = (vineEnd * s) / n
    const sx = toX(val)

    // Glow behind
    ctx.beginPath()
    ctx.moveTo(sx, axisY - halfH)
    ctx.lineTo(sx, axisY + halfH)
    ctx.strokeStyle = isDark ? 'rgba(255,255,200,0.3)' : 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.globalAlpha = alpha
    ctx.setLineDash([])
    ctx.stroke()

    // Crisp line on top
    ctx.beginPath()
    ctx.moveTo(sx, axisY - halfH)
    ctx.lineTo(sx, axisY + halfH)
    ctx.strokeStyle = isDark ? 'rgba(255,255,220,0.9)' : 'rgba(255,255,255,0.95)'
    ctx.lineWidth = 2.5
    ctx.globalAlpha = alpha
    ctx.stroke()
  }
}

/**
 * Draw a pulsing wave across n segments — each segment brightens in
 * sequence left-to-right, showing every piece "pushing" energy to the tip.
 */
function drawSegmentWave(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  vineEnd: number,
  n: number,
  waveP: number,
  ppu: number,
  isDark: boolean,
  alpha: number
) {
  if (n < 1 || alpha <= 0 || waveP <= 0) return
  const sw = stemW(ppu)

  for (let s = 0; s < n; s++) {
    const segStart = (vineEnd * s) / n
    const segEnd = (vineEnd * (s + 1)) / n

    // Stagger: each segment starts its pulse slightly later
    const delay = (s / n) * 0.35
    const segP = mapRange(waveP, delay, delay + 0.5)
    if (segP <= 0 || segP >= 1) continue

    // Pulse: brightens then dims
    const pulse = Math.sin(segP * Math.PI)

    const x0 = toX(segStart)
    const x1 = toX(segEnd)

    // Bright glow overlay on this segment
    ctx.beginPath()
    ctx.moveTo(x0, axisY)
    ctx.lineTo(x1, axisY)
    ctx.strokeStyle = vineBright(isDark)
    ctx.lineWidth = sw + 6 * pulse
    ctx.lineCap = 'butt'
    ctx.globalAlpha = alpha * pulse * 0.55
    ctx.stroke()
  }

  // Converging glow at the tip — energy gathering at the launch point
  const tipGlow = mapRange(waveP, 0.5, 0.95)
  if (tipGlow > 0) {
    const tipX = toX(vineEnd)
    const r = (sw * 0.6 + 4) * smoothstep(tipGlow)
    ctx.beginPath()
    ctx.arc(tipX, axisY, r, 0, Math.PI * 2)
    ctx.fillStyle = vineBright(isDark)
    ctx.globalAlpha = alpha * smoothstep(tipGlow) * 0.6
    ctx.fill()
  }
}

// ── Narrative labels ────────────────────────────────────────────────────

const DAY_LABELS = [
  'Day 1: One BIG leap!',
  'Day 2: Let\u2019s share the work!',
  'Day 3: More helpers!',
  'Day 4: Even more helpers!',
  'Day 5: More and more!',
  'Day 6: So many helpers!',
  'Day 7: A whole team!',
  'Day 8: A bigger team!',
  'Day 9: A huge team!',
  'Day 10: Everybody helps!',
]

const RESULT_LABELS = [
  'Not quite!',
  'A bigger vine made a bigger hop!',
  'Getting closer!',
  'Almost!',
  'Closer!',
  'So close!',
  'Even closer!',
  'Almost there!',
  'So nearly there!',
  'Nearly there!',
]

// ── Main render ────────────────────────────────────────────────────────

export function renderEOverlay(
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

  const bc = boundaryCol(isDark)
  const vc = vineCol(isDark)
  const textColor = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
  const subtextColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'

  ctx.save()

  // ── The star: vine's goal at e ──
  const starAlpha =
    mapRange(revealProgress, 0, 0.05) * 0.5 +
    mapRange(revealProgress, CONVERGE_START, CONVERGE_END) * 0.5
  const eSx = toX(Math.E)
  const starY = axisY - cssHeight * 0.28
  const starPulse = 1 + 0.12 * Math.sin(revealProgress * Math.PI * 12)
  const starR = Math.max(7, Math.min(12, ppu * 0.08)) * starPulse

  if (starAlpha > 0) {
    // Dashed path to star
    ctx.beginPath()
    ctx.moveTo(eSx, starY + starR + 2)
    ctx.lineTo(eSx, axisY + 10)
    ctx.strokeStyle = bc
    ctx.lineWidth = 1.5
    ctx.globalAlpha = opacity * starAlpha * 0.4
    ctx.setLineDash([5, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // Star shape
    drawStar(ctx, eSx, starY, starR, bc, opacity * starAlpha * 0.9)
  }

  // ── Ghost ticks from completed levels ──
  for (const level of LEVELS) {
    if (revealProgress < level.endP) break
    const val = compoundResult(level.n)
    const age = mapRange(revealProgress, level.endP, level.endP + 0.15)
    drawGhostTick(ctx, toX(val), axisY, vc, opacity * Math.max(0.3, 1 - age * 0.4))
  }

  // ── Phase 1: Seed vine at length 1 ──
  if (revealProgress < 0.08) {
    const fi = smoothstep(mapRange(revealProgress, 0, 0.04))
    drawStem(ctx, toX, axisY, 0, 1, ppu, isDark, opacity * fi)
    drawLeaves(ctx, toX, axisY, 0, 1, ppu, isDark, opacity * fi)

    // Goal label
    if (fi > 0.3) {
      const fs = Math.max(11, Math.min(14, ppu * 0.12))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = textColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * fi * 0.8
      ctx.fillText(
        'Can the vine reach the star?',
        toX(0) + toX(Math.E / 2),
        axisY - stemW(ppu) / 2 - 8
      )
    }
  }

  // ── Phase 2: Growth levels ──
  let activeLevel: Level | null = null
  let activeLevelIdx = -1
  for (let i = 0; i < LEVELS.length; i++) {
    const level = LEVELS[i]
    if (revealProgress >= level.startP && revealProgress < level.endP) {
      activeLevel = level
      activeLevelIdx = i
      break
    }
  }

  if (activeLevel) {
    const n = activeLevel.n
    const lp = mapRange(revealProgress, activeLevel.startP, activeLevel.endP)

    // Previous level's vine endpoint (for smooth retraction to 1)
    const prevEnd = activeLevelIdx > 0 ? compoundResult(LEVELS[activeLevelIdx - 1].n) : 1
    const hasRetract = activeLevelIdx > 0

    // Sub-phases — retraction only after the first level
    //   0.00–0.15: vine retracts from previous result to 1
    //   0.08–0.22: intro label fades in ("N rounds: grow by 1/N each")
    //   0.18–0.82: n growth rounds (buds → tendril → settle)
    //   0.80–1.00: hold result
    const retractP = hasRetract ? mapRange(lp, 0, 0.15) : 1
    const introP = mapRange(lp, hasRetract ? 0.08 : 0, hasRetract ? 0.22 : 0.08)
    const growStart = hasRetract ? 0.18 : 0.05
    const growP = mapRange(lp, growStart, 0.82)
    const holdP = mapRange(lp, 0.8, 1.0)

    const finalVal = compoundResult(n)

    // Determine current vine endpoint across all sub-phases
    let currentVineEnd = 1

    // Hoist growth-round state for drawing after vine
    let gr_active = false
    let gr_vineBefore = 1
    let gr_vineAfter = 1
    let gr_curRound = 0
    let gr_budP = 0
    let gr_tendrilP = 0
    let gr_settleP = 0
    let gr_isResting = false
    let gr_restProgress = 0

    // --- Retraction: vine smoothly shrinks from previous result to 1 ---
    if (hasRetract && retractP < 1) {
      currentVineEnd = prevEnd + (1 - prevEnd) * easeOut(retractP)
    } else if (growP > 0) {
      // --- Growth rounds with rest periods between hops ---
      gr_active = true

      // For n ≤ 4, add breathing room between hops so kids can follow
      const REST_RATIO = n >= 2 && n <= 4 ? 0.3 : 0
      const totalSlots = n + (n > 1 ? (n - 1) * REST_RATIO : 0)
      const slotSize = 1 / totalSlots
      let roundFrac = 0

      if (growP >= 1) {
        gr_curRound = n - 1
        roundFrac = 1
      } else {
        let remaining = growP
        for (let r = 0; r < n; r++) {
          if (remaining < slotSize) {
            gr_curRound = r
            roundFrac = remaining / slotSize
            break
          }
          remaining -= slotSize
          if (r < n - 1 && REST_RATIO > 0) {
            const restSize = slotSize * REST_RATIO
            if (remaining < restSize) {
              gr_curRound = r
              roundFrac = 1
              gr_isResting = true
              gr_restProgress = remaining / restSize
              break
            }
            remaining -= restSize
          }
          if (r === n - 1) {
            gr_curRound = r
            roundFrac = 1
          }
        }
      }

      gr_vineBefore = compoundAfterSteps(n, gr_curRound)
      gr_vineAfter = compoundAfterSteps(n, gr_curRound + 1)

      if (gr_isResting) {
        // During rest: vine stays at settled position after completed hop
        currentVineEnd = gr_vineAfter
      } else {
        gr_settleP = mapRange(roundFrac, 0.85, 1.0)
        currentVineEnd =
          growP >= 1
            ? finalVal
            : gr_vineBefore + (gr_vineAfter - gr_vineBefore) * smoothstep(gr_settleP)
        gr_budP = mapRange(roundFrac, 0, 0.28)
        gr_tendrilP = mapRange(roundFrac, 0.2, 0.88)
      }
    }

    // ── Draw the vine at its current endpoint ──
    drawStem(ctx, toX, axisY, 0, currentVineEnd, ppu, isDark, opacity)
    drawLeaves(ctx, toX, axisY, 0, currentVineEnd, ppu, isDark, opacity)

    // Brief glow during rest to emphasize the vine's new size
    if (gr_isResting && n <= 4) {
      const glowP = Math.sin(gr_restProgress * Math.PI) * 0.4
      drawStem(ctx, toX, axisY, 0, currentVineEnd, ppu, isDark, opacity * glowP, true)
    }

    // ── Growth overlays: drawn ON TOP of the vine ──
    if (gr_active) {
      // Segment dividers + animated wave for n ≤ 4
      if (n >= 2 && n <= 4 && growP < 1) {
        if (gr_isResting) {
          // During rest: show dividers on the NEW (bigger) vine
          const restPulse = 0.7 + 0.3 * Math.sin(gr_restProgress * Math.PI)
          drawSegmentDividers(ctx, toX, axisY, currentVineEnd, n, ppu, isDark, opacity * restPulse)
        } else {
          const divAlpha =
            gr_budP > 0 ? smoothstep(gr_budP) : gr_settleP > 0 ? 1 - smoothstep(gr_settleP) : 0.6
          drawSegmentDividers(ctx, toX, axisY, gr_vineBefore, n, ppu, isDark, opacity * divAlpha)

          // Pulsing wave: each piece lights up left-to-right, pushing energy to tip
          if (gr_budP > 0) {
            drawSegmentWave(ctx, toX, axisY, gr_vineBefore, n, gr_budP, ppu, isDark, opacity)
          }
        }
      }

      // Buds (only for n > 4 where segments are too small to show)
      if (gr_budP > 0 && growP < 1 && n > 4) {
        drawBuds(ctx, toX, axisY, gr_vineBefore, gr_budP, ppu, isDark, opacity)
      }

      // Tendril growing from vine tip
      if (gr_tendrilP > 0 && gr_settleP < 1 && growP < 1) {
        drawTendril(ctx, toX, axisY, gr_vineBefore, gr_vineAfter, gr_tendrilP, ppu, isDark, opacity)
      }

      // Day 2 ghost arc: show hop 1's arc as a ghost during hop 2
      if (activeLevelIdx === 1 && gr_curRound === 1 && gr_tendrilP > 0.3) {
        drawTendril(ctx, toX, axisY, 1.0, 1.5, 1.0, ppu, isDark, opacity * 0.2)
      }

      // ── Day 2 sub-labels: explain pieces and compound growth ──
      if (activeLevelIdx === 1 && n === 2) {
        const labelX = (toX(0) + toX(Math.E)) / 2
        const aboveY = axisY - stemW(ppu) / 2 - 14
        const belowY = axisY + stemW(ppu) / 2 + 4
        const fs = Math.max(10, Math.min(13, ppu * 0.11))

        // During hop 1's wave: "Each piece of vine makes a hop!"
        if (gr_curRound === 0 && !gr_isResting && gr_budP > 0.1) {
          const a =
            smoothstep(mapRange(gr_budP, 0.1, 0.4)) *
            (1 - smoothstep(mapRange(gr_tendrilP, 0.4, 0.7)))
          if (a > 0.01) {
            ctx.font = `${fs}px system-ui, sans-serif`
            ctx.fillStyle = textColor
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.globalAlpha = opacity * a
            ctx.fillText('Each piece of vine makes a hop!', labelX, belowY)
          }
        }

        // During rest after hop 1: explain compound growth
        if (gr_isResting && gr_curRound === 0) {
          // "The vine is bigger now!" — fades in first
          const biggerA = smoothstep(mapRange(gr_restProgress, 0.05, 0.3))
          if (biggerA > 0.01) {
            ctx.font = `bold ${fs + 1}px system-ui, sans-serif`
            ctx.fillStyle = vc
            ctx.textAlign = 'center'
            ctx.textBaseline = 'bottom'
            ctx.globalAlpha = opacity * biggerA
            ctx.fillText('The vine is bigger now!', labelX, aboveY)
          }

          // "So each piece is bigger too!" — fades in after a beat
          const piecesA = smoothstep(mapRange(gr_restProgress, 0.35, 0.65))
          if (piecesA > 0.01) {
            ctx.font = `${fs}px system-ui, sans-serif`
            ctx.fillStyle = textColor
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.globalAlpha = opacity * piecesA
            ctx.fillText('So each piece is bigger too!', labelX, belowY)
          }
        }

        // During hop 2's tendril: "A bigger hop!"
        if (gr_curRound === 1 && !gr_isResting && gr_tendrilP > 0.5) {
          const a =
            smoothstep(mapRange(gr_tendrilP, 0.5, 0.75)) *
            (1 - smoothstep(mapRange(holdP, 0.2, 0.5)))
          if (a > 0.01) {
            ctx.font = `bold ${fs}px system-ui, sans-serif`
            ctx.fillStyle = vc
            ctx.textAlign = 'center'
            ctx.textBaseline = 'bottom'
            ctx.globalAlpha = opacity * a
            ctx.fillText('A bigger hop!', labelX, aboveY)
          }
        }
      }
    }

    // --- "Let's try again!" during retraction ---
    if (hasRetract && retractP > 0 && retractP < 0.85) {
      const ra =
        smoothstep(mapRange(retractP, 0, 0.3)) * (1 - smoothstep(mapRange(retractP, 0.5, 0.85)))
      if (ra > 0.01) {
        const fs = Math.max(10, Math.min(13, ppu * 0.11))
        ctx.font = `italic ${fs}px system-ui, sans-serif`
        ctx.fillStyle = subtextColor
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = opacity * ra * 0.8
        ctx.fillText("Let's try again!", (toX(0) + toX(Math.E)) / 2, axisY - stemW(ppu) / 2 - 14)
      }
    }

    // --- Level intro label: narrative "Day N" label ---
    if (introP > 0) {
      // For Day 2, fade out earlier since sub-labels take over
      const earlyFade = activeLevelIdx === 1 ? 0.15 : 0.6
      const fadeOut =
        holdP > 0.3
          ? 1 - smoothstep(mapRange(holdP, 0.3, 0.8))
          : growP > earlyFade
            ? 1 - smoothstep(mapRange(growP, earlyFade, earlyFade + 0.15))
            : 1
      const ia = smoothstep(introP) * fadeOut
      if (ia > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.12))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = textColor
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = opacity * ia

        const header = DAY_LABELS[activeLevelIdx] ?? `Day ${activeLevelIdx + 1}`
        const labelX = (toX(0) + toX(Math.E)) / 2
        ctx.fillText(header, labelX, axisY - stemW(ppu) / 2 - 14)
      }
    }

    // --- Result label: emotional response ---
    if (holdP > 0) {
      const ra = smoothstep(holdP)
      const fs = Math.max(11, Math.min(14, ppu * 0.12))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = vc
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * ra

      const resultText = RESULT_LABELS[activeLevelIdx] ?? ''
      const valStr = finalVal.toFixed(n <= 3 ? 2 : 3)
      const label = resultText ? `${valStr} — ${resultText}` : valStr
      ctx.fillText(label, toX(finalVal / 2 + 0.5), axisY + stemW(ppu) / 2 + 4)
    }
  }

  // ── Phase 3: Smooth growth (n → ∞) ──
  const smoothP = mapRange(revealProgress, SMOOTH_START, SMOOTH_END)
  if (smoothP > 0 && revealProgress < CONVERGE_END) {
    const ep = smoothstep(smoothP)
    const curEnd = 1 + ep * (Math.E - 1)

    drawStem(ctx, toX, axisY, 0, curEnd, ppu, isDark, opacity)
    drawLeaves(ctx, toX, axisY, 0, curEnd, ppu, isDark, opacity)

    // Continuous buds shimmer along the growing vine
    if (smoothP < 0.9) {
      const cyclePulse = (smoothP * 5) % 1
      drawBuds(ctx, toX, axisY, curEnd, cyclePulse, ppu, isDark, opacity * 0.6)
    }

    // Label — fades out before convergence text appears
    if (smoothP > 0.35) {
      const fadeIn = smoothstep(mapRange(smoothP, 0.35, 0.6))
      const fadeOut =
        1 - smoothstep(mapRange(revealProgress, CONVERGE_START, CONVERGE_START + 0.03))
      const la = fadeIn * fadeOut
      if (la > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.12))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = vc
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = opacity * la
        ctx.fillText(
          'The secret: everyone grows together!',
          toX(Math.E / 2 + 0.3),
          axisY + stemW(ppu) / 2 + 4
        )
      }
    }
  }

  // ── Phase 4: Convergence ──
  const convergeP = mapRange(revealProgress, CONVERGE_START, CONVERGE_END)
  if (convergeP > 0 && revealProgress < LABELS_START + 0.03) {
    const fadeIn = smoothstep(convergeP)
    const fadeOut =
      1 - smoothstep(mapRange(revealProgress, LABELS_START - 0.01, LABELS_START + 0.02))
    const ca = fadeIn * fadeOut

    if (ca > 0.01) {
      drawStem(ctx, toX, axisY, 0, Math.E, ppu, isDark, opacity * ca)
      drawLeaves(ctx, toX, axisY, 0, Math.E, ppu, isDark, opacity * ca)

      // Ghost ticks only (no text labels — they cluster too tightly)
      for (let i = 0; i < LEVELS.length; i++) {
        const val = compoundResult(LEVELS[i].n)
        drawGhostTick(ctx, toX(val), axisY, vc, opacity * ca, 9)
      }

      // Bold e tick
      drawGhostTick(ctx, toX(Math.E), axisY, bc, opacity * ca, 11)

      // Single summary label above
      const msgFs = Math.max(11, Math.min(14, ppu * 0.12))
      ctx.font = `${msgFs}px system-ui, sans-serif`
      ctx.fillStyle = textColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * ca * 0.9
      ctx.fillText(
        'Each day, the vine got closer...',
        (toX(0) + eSx) / 2,
        axisY - stemW(ppu) / 2 - 14
      )

      // Strengthen boundary line
      ctx.beginPath()
      ctx.moveTo(eSx, starY + starR + 2)
      ctx.lineTo(eSx, axisY + 10)
      ctx.strokeStyle = bc
      ctx.lineWidth = 2
      ctx.globalAlpha = opacity * ca * 0.6
      ctx.setLineDash([5, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // ── Phase 5: Labels ──
  const labelP = mapRange(revealProgress, LABELS_START, 1.0)
  if (labelP > 0) {
    const la = smoothstep(labelP)

    drawStem(ctx, toX, axisY, 0, Math.E, ppu, isDark, opacity * la)
    drawLeaves(ctx, toX, axisY, 0, Math.E, ppu, isDark, opacity * la)

    // "The perfect growth number!" above the vine
    const fFs = Math.max(12, Math.min(16, ppu * 0.14))
    ctx.font = `${fFs}px system-ui, sans-serif`
    ctx.fillStyle = textColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.globalAlpha = opacity * la
    const formulaX = (toX(0) + eSx) / 2
    ctx.fillText('The perfect growth number!', formulaX, axisY - stemW(ppu) / 2 - 14)

    // "e" symbol + value below the vine, centered at e's position
    const eFs = Math.max(16, Math.min(22, ppu * 0.18))
    ctx.font = `bold ${eFs}px system-ui, sans-serif`
    ctx.fillStyle = bc
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = opacity * la
    ctx.fillText('e ≈ 2.718', eSx, axisY + stemW(ppu) / 2 + 4)

    // Small formula above, higher up for curious kids
    const sFs = Math.max(9, Math.min(11, ppu * 0.09))
    ctx.font = `${sFs}px system-ui, sans-serif`
    ctx.fillStyle = subtextColor
    ctx.globalAlpha = opacity * la * 0.5
    ctx.fillText('lim (1 + 1/n)\u207F = e', formulaX, axisY - stemW(ppu) / 2 - 14 - fFs - 4)

    // Star brightens at the end
    drawStar(ctx, eSx, starY, starR * 1.3, bc, opacity * la)
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
